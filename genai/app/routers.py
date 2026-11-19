from typing import Literal
from .state import ChatStateMain
from .nodes import FORM_CHECKS
from langgraph.graph import StateGraph, START, END

def startRouter(state: ChatStateMain) -> Literal['imageAnalysisNode', 'HeartNode', 'healthCheckNode', 'clinicalNode']:
    imageUrl = state.get("imageURL")
    request = (state.get("request") or "").lower()
    print("🚦 Start Router - imageURL:", imageUrl, "request:", request)
    if imageUrl:
        return "imageAnalysisNode"
    elif "heart" in request:
        return "HeartNode"
    elif request in FORM_CHECKS and state.get("features"):
        return "healthCheckNode"
    else:
        return "clinicalNode"


def afterImageAnalysis(state: ChatStateMain) -> Literal["explainNode", "unreadableImageNode"]:
    analysis = state.get("analysis") or {}
    print("🔍 Image analysis:", analysis.get("kind"), analysis.get("prediction"), analysis.get("confidence"))
    return "explainNode" if analysis.get("supported") else "unreadableImageNode"


def afterHealthCheck(state: ChatStateMain) -> Literal["explainNode", "clinicalNode"]:
    # Without a usable result, fall back to a normal answer from the message itself
    return "explainNode" if (state.get("analysis") or {}).get("supported") else "clinicalNode"
