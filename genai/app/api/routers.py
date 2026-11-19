import json
import os
from fastapi import APIRouter, Depends, Header, HTTPException, Request, BackgroundTasks
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage, AIMessage, AIMessageChunk, SystemMessage
import requests
from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session 
from .schemas import (
    ChatRequest, ChatResponseChunk, SessionCreate, 
    SessionResponse, MessageCreate, MessageResponse, SessionUpdate
)
from app.db import get_db, SessionLocal
from app import crud, models
from app.clients import llm_client
from app.prompts import titlePrompt

# Use environment variable for backend URL, defaulting to local dev
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:2706/api/v1/user/current-user")

def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    try:
        response = requests.get(
            BACKEND_URL,
            headers={"Authorization": authorization},
            timeout=5
        )
        response.raise_for_status()
        user_data = response.json()
        if "email" not in user_data:
            raise HTTPException(status_code=401, detail="Invalid user data from auth service")
        return user_data
    except requests.exceptions.HTTPError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Unauthorized")
    except requests.exceptions.RequestException:
        raise HTTPException(status_code=500, detail="Auth service unreachable")

# Graph nodes whose LLM output is the reply shown to the user
REPLY_NODES = {"explainNode", "clinicalNode"}

def get_langgraph_agent(request: Request):
    return request.app.state.langgraph_agent

router = APIRouter(prefix="/sessions", tags=["Sessions & Chat"])

@router.post("/", response_model=SessionResponse)
def create_new_session(
    session_in: SessionCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Creates a new, empty chat session for the current user.
    """
    user_email = current_user.get("email")
    user = crud.get_or_create_user(db, email=user_email)
    session = crud.create_session(db, user_id=user.id, session_in=session_in)
    return session

@router.delete("/{session_id}", response_model=dict)
def delete_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Deletes a specific chat session and all associated messages for the current user.
    """
    user_email = current_user.get("email")
    user = crud.get_or_create_user(db, email=user_email)

    if not crud.check_session_owner(db, session_id=session_id, user_id=user.id):
        raise HTTPException(status_code=404, detail="Session not found or not owned by user")

    deleted = crud.delete_session(db, session_id=session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"detail": f"Session {session_id} deleted successfully."}


@router.get("/", response_model=List[SessionResponse])
def get_all_user_sessions(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Gets a list of all chat sessions for the current user.
    """
    user_email = current_user.get("email")
    user = crud.get_user_by_email(db, email=user_email)
    if not user:
        return [] 
    return crud.get_user_sessions(db, user_id=user.id)

@router.post("/{session_id}/chat", response_model=ChatResponseChunk)
async def chat_with_bot(
    session_id: UUID,
    message: ChatRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    agent = Depends(get_langgraph_agent)
):
    """
    Main chat endpoint. Receives a message, runs it through the graph,
    and streams the response.
    """
    if not agent:
        raise HTTPException(status_code=503, detail="Graph not initialized")

    user_email = current_user.get("email")
    user = crud.get_or_create_user(db, email=user_email)
    if not crud.check_session_owner(db, session_id=session_id, user_id=user.id):
        raise HTTPException(status_code=404, detail="Session not found or not owned by user")
    thread_id = str(session_id)

    user_msg_lower = message.content.lower()
    image_url = message.imageURL
    print("🚦 Chat Endpoint - message:", message.content, "imageURL:", image_url)

    crud.add_message(db, session_id, MessageCreate(role="human", content=message.content))
    if image_url:
        crud.add_message(db, session_id, MessageCreate(role="human", content=image_url))

    invocation_input = {
        "messages": [HumanMessage(content=message.content)],
        "request": message.tag or "None",
        "imageURL": message.imageURL or "",
        "features": message.features,
    }
    print("🚦 Invocation Input:", invocation_input)

    config = {"configurable": {"thread_id": thread_id}}

    def chunk(type: str, content: str) -> str:
        return ChatResponseChunk(type=type, content=content).model_dump_json() + "\n"

    async def stream_generator():
        final_ai_response = ""
        final_analysis = None
        # Nodes whose reply already went out token by token
        streamed_nodes = set()
        try:
            async for mode, data in agent.astream(
                invocation_input, config, stream_mode=["updates", "messages", "custom"]
            ):
                if mode == "custom":
                    if isinstance(data, dict) and data.get("status"):
                        yield chunk("status", data["status"])

                elif mode == "messages":
                    token, metadata = data
                    is_reply = metadata.get("langgraph_node") in REPLY_NODES
                    if is_reply and isinstance(token, AIMessageChunk) and isinstance(token.content, str) and token.content:
                        streamed_nodes.add(metadata.get("langgraph_node"))
                        final_ai_response += token.content
                        yield chunk("message", token.content)

                else:
                    for node_name, node_output in data.items():
                        if not isinstance(node_output, dict):
                            continue

                        if node_output.get("analysis"):
                            final_analysis = node_output["analysis"]
                            yield chunk("analysis", json.dumps(final_analysis))

                        if "messages" in node_output and node_name not in streamed_nodes:
                            ai_message_or_list = node_output["messages"]

                            if isinstance(ai_message_or_list, list):
                                ai_message = ai_message_or_list[-1]
                            else:
                                ai_message = ai_message_or_list

                            if isinstance(ai_message, AIMessage) and ai_message.content:
                                final_ai_response += ai_message.content
                                yield chunk("message", ai_message.content)

            if final_ai_response or final_analysis:
                with SessionLocal() as db_session:
                    if final_analysis:
                        # Saved as its own message so the result card comes back when the chat is reopened
                        crud.add_message(
                            db_session, session_id,
                            MessageCreate(role="ai", content=json.dumps({"type": "analysis", "data": final_analysis}))
                        )
                    if final_ai_response:
                        crud.add_message(
                            db_session, session_id,
                            MessageCreate(role="ai", content=final_ai_response)
                        )

        except Exception as e:
            print(f"❌ Chat stream error: {e}")
            yield chunk("error", str(e))

    return StreamingResponse(stream_generator(), media_type="application/x-ndjson")

@router.get("/{session_id}/messages", response_model=List[MessageResponse])
def get_session_chat_history(
    session_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Gets all messages for a specific chat session.
    Triggers title generation if title is default.
    """
    user_email = current_user.get("email")
    user = crud.get_or_create_user(db, email=user_email)

    if not crud.check_session_owner(db, session_id=session_id, user_id=user.id):
        raise HTTPException(status_code=404, detail="Session not found or not owned by user")
    
    session = crud.get_session(db, session_id=session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found") 

    messages = crud.get_session_messages(db, session_id=session_id)

    if session.title == "New Chat" and len(messages) > 0:
        background_tasks.add_task(_generate_title_task, session_id, messages)
    
    return messages

def _generate_title_task(session_id: UUID, messages: List[models.Message]):
    """
    Uses OpenAI to generate a title for the session and updates the DB.
    """
    print(f"Background task started: Generating title for session {session_id}")
    try:
        conversation_history = "\n".join(
            [f"{msg.role}: {msg.content}" for msg in messages[:3] if not msg.content.startswith('{"type": "analysis"')]
        )
        
        prompt = titlePrompt.replace("{conversation}", conversation_history)

        # Gemini rejects a request that has only a system message
        response = llm_client.invoke([HumanMessage(content=prompt)])
        
        new_title = response.content.strip().strip('"') 
        
        if not new_title:
            return 
        with SessionLocal() as db:
            crud.update_session_title(db, session_id=session_id, title=new_title)
            print(f"Background task finished: Title for {session_id} set to '{new_title}'")
            
    except Exception as e:
        print(f"Background task failed for session {session_id}: {e}")

@router.patch("/{session_id}", response_model=SessionResponse)
def update_session_title(
    session_id: UUID,
    session_in: SessionUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Manually updates the title of a specific chat session.
    """
    user_email = current_user.get("email")
    user = crud.get_or_create_user(db, email=user_email)

    if not crud.check_session_owner(db, session_id=session_id, user_id=user.id):
        raise HTTPException(status_code=404, detail="Session not found or not owned by user")
    
    updated_session = crud.update_session_title(db, session_id, session_in.title)
    if not updated_session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    return updated_session