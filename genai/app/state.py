from typing import Optional, Union
from langgraph.graph import MessagesState

class ChatStateMain(MessagesState):
    imageURL: Optional[str] = None
    prediction: Optional[str] = None
    rImageUrl: Optional[str] = None
    output: Optional[str] = None 
    request: Optional[str] = None
    # Structured inputs from a health-check form
    features: Optional[Union[dict, list]] = None
    # The latest model or calculator result, kept as context for follow-up questions
    analysis: Optional[dict] = None
