import re
from langchain_core.messages import SystemMessage, AIMessage
from langgraph.config import get_stream_writer
from .state import ChatStateMain
from .clients import llm_client, rich
from .ml_client import analyze_image, diabetes_check, heart_check, unsupported
from .health_checks import CHECKS
from .prompts import clinicalPrompt, analysisPrompt, analysisGuidance, describe_analysis

# Forms that send structured answers, and what works out the result
FORM_CHECKS = {**CHECKS, "diabetes": diabetes_check}

# How many recent messages the model sees
HISTORY = 10


def report_progress(text):
    """Shows the user what is happening while they wait."""
    try:
        get_stream_writer()({"status": text})
    except Exception:
        pass


def imageAnalysisNode(state: ChatStateMain) -> ChatStateMain:
    report_progress("Looking at your image")
    try:
        analysis = analyze_image(state.get("imageURL"), report_progress)
    except Exception as e:
        rich.print(f"[red]Image analysis error: {e}[/red]")
        analysis = unsupported("Something went wrong while reading the image. Please try again.")

    print("✅ Image analysed as:", analysis.get("kind"), analysis.get("prediction"))
    return {"analysis": analysis, "prediction": analysis.get("prediction")}


def unreadableImageNode(state: ChatStateMain) -> ChatStateMain:
    reason = " ".join((state.get("analysis") or {}).get("reasons", []))
    message = (
        f"I couldn't read this image reliably. {reason}\n\n"
        "I can read **brain MRI scans**, **chest X-rays** and **photos of wounds**. "
        "For a wound, take the photo in good light with the wound filling most of the frame. "
        "You can also describe what you're seeing and I'll help from there."
    )
    return {"messages": AIMessage(message)}


def HeartNode(state: ChatStateMain) -> ChatStateMain:
    report_progress("Running the heart risk model")
    try:
        features = state.get("features")
        if not features:
            # A typed message instead of the form: take the first five numbers
            messages = state.get("messages", [])
            last_message = messages[-1].content if messages else ""
            nums = re.findall(r"[-+]?\d*\.\d+|\d+", last_message)
            features = [float(x) for x in nums[:5]]
            if len(features) != 5:
                raise ValueError(
                    "No heart form answers, and the message doesn't hold the five legacy values "
                    "[MaxHR, ChestPainType (0–3), Cholesterol, Oldpeak, ST_Slope (0–2)]."
                )

        analysis = heart_check(features)
        print("💓 Heart Model Prediction:", analysis.get("prediction"), analysis.get("probability"))
        return {"analysis": analysis, "prediction": analysis.get("prediction")}

    except Exception as e:
        print(f"❌ Exception in HeartNode: {e}")
        return {"analysis": None}


def healthCheckNode(state: ChatStateMain) -> ChatStateMain:
    report_progress("Working out your result")
    try:
        analysis = FORM_CHECKS[state.get("request").lower()](state.get("features"))
        return {"analysis": analysis}
    except Exception as e:
        print(f"❌ Exception in healthCheckNode: {e}")
        return {"analysis": None}


def explainNode(state: ChatStateMain) -> ChatStateMain:
    report_progress("Writing your explanation")
    analysis = state.get("analysis")
    system_message = SystemMessage(
        analysisPrompt
        .replace("{analysis}", describe_analysis(analysis))
        .replace("{guidance}", analysisGuidance.get(analysis.get("kind"), ""))
    )
    messages = state.get("messages") or []
    response = llm_client.invoke([system_message] + messages[-HISTORY:])
    return {"messages": response}


def clinicalNode(state: ChatStateMain) -> ChatStateMain:
    analysis = state.get("analysis")
    context = ""
    if analysis and analysis.get("supported"):
        context = "\nEarlier in this chat a tool gave this result, which they may ask about:\n" + describe_analysis(analysis)

    system_message = SystemMessage(clinicalPrompt.replace("{context}", context))
    messages = state.get("messages") or []
    response = llm_client.invoke([system_message] + messages[-HISTORY:])
    return {"messages": response}
