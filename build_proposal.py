from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
)


OUT = Path("output/pdf/jivika_ai_ml_project_proposal.pdf")
OUT.parent.mkdir(parents=True, exist_ok=True)

PAGE_W, PAGE_H = A4
MARGIN = 16 * mm
ACCENT = colors.HexColor("#202020")
INK = colors.HexColor("#161616")
MUTED = colors.HexColor("#606060")
PALE = colors.HexColor("#F2F2F2")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="ProposalTitle", parent=styles["Title"], fontName="Helvetica-Bold",
    fontSize=18, leading=22, alignment=TA_CENTER, textColor=INK, spaceAfter=4,
))
styles.add(ParagraphStyle(
    name="Subtitle", parent=styles["Normal"], fontName="Helvetica",
    fontSize=9.5, leading=13, alignment=TA_CENTER, textColor=MUTED, spaceAfter=10,
))
styles.add(ParagraphStyle(
    name="Section", parent=styles["Heading2"], fontName="Helvetica-Bold",
    fontSize=10.5, leading=13, textColor=ACCENT, spaceBefore=7, spaceAfter=3,
))
styles.add(ParagraphStyle(
    name="BodyProposal", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=9.25, leading=13, textColor=INK, alignment=TA_LEFT, spaceAfter=3,
))
styles.add(ParagraphStyle(
    name="Tiny", parent=styles["Normal"], fontName="Helvetica-Oblique",
    fontSize=7.4, leading=9.5, textColor=MUTED, alignment=TA_LEFT,
))
styles.add(ParagraphStyle(
    name="TableText", parent=styles["Normal"], fontName="Helvetica",
    fontSize=7.65, leading=9.5, textColor=INK,
))
styles.add(ParagraphStyle(
    name="TableHeader", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=7.65, leading=9.5, textColor=colors.white,
))


def P(text, style="BodyProposal"):
    return Paragraph(text, styles[style])


def section(title, body):
    return [P(title, "Section"), P(body)]


story = []
story.append(P("Jivika AI: A Multimodal Health Support Assistant", "ProposalTitle"))
story.append(P("Project category: Application Project | Machine Learning / Generative AI", "Subtitle"))

members = [
    [P("Team member", "TableHeader"), P("Enrollment no.", "TableHeader"), P("Primary contribution", "TableHeader")],
    [P("Saumya Sood", "TableText"), P("IIT2024018", "TableText"), P("ML; Generative AI and backend", "TableText")],
    [P("Vichanshu", "TableText"), P("IIT2024083", "TableText"), P("ML; Generative AI and backend", "TableText")],
    [P("Vishwas Pahwa", "TableText"), P("IIT2024087", "TableText"), P("ML; Generative AI and backend", "TableText")],
    [P("Kunal", "TableText"), P("IIT2024066", "TableText"), P("ML; frontend, DevOps, and diagnostic UI", "TableText")],
    [P("Yash", "TableText"), P("IIT2024071", "TableText"), P("ML; frontend, DevOps, and testing UI", "TableText")],
]
member_table = Table(members, colWidths=[40*mm, 27*mm, 101*mm], repeatRows=1)
member_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
    ("BACKGROUND", (0, 1), (-1, -1), colors.white),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#A0A0A0")),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
]))
story.append(member_table)
story.append(Spacer(1, 7))

story += section("Project Overview and Motivation", "Jivika AI will be a health-support web application. Users will be able to ask health questions, enter heart-related details, or upload a chest X-ray, brain tumor image, or wound image. The system will identify the input, send it to the right model, and return a clear result, image explanation, and safe next steps. It will support, not replace, a doctor; uncertain or risky cases will be directed to a clinician or emergency service.")

story += section("Planned Method", "We will train ResNet-18 image models for three tasks: brain-image classification into glioma, meningioma, pituitary tumor, or no tumor; chest X-ray classification into COVID, healthy, or pneumonia; and seven wound classes. A first-stage classifier will identify the image type. Images will be resized, cropped, and normalized before prediction. Grad-CAM will highlight the image region that most influenced the result. For heart-risk screening, we will compare logistic regression, random forest, and XGBoost, then build a voting model from the best models. The five inputs will be heart rate, chest-pain type, cholesterol, oldpeak, and ST-slope.")

story += section("LangGraph and Generative AI", "LangGraph will route each text or image request to the correct ML service and keep the conversation state in PostgreSQL. The structured output will be passed to GPT with a fixed prompt. GPT will explain the result in plain English, ask for missing information, and give safe follow-up advice. The prompt will state that it must not give a final medical diagnosis. This will keep the chatbot response tied to the ML prediction.")

story += section("Experiments and Evaluation", "We will create separate training, validation, and test sets. For image models, we will report accuracy, precision, recall, macro F1-score, confusion matrices, and class-wise errors. For heart risk, we will also report ROC-AUC and calibration. Baselines will include logistic regression on image embeddings, logistic regression/random forest for tabular data, and a shallow CNN or non-pretrained model for images. We will also test routing accuracy, response time, Grad-CAM examples, and whether generated answers match the ML output and safety rules.")

story += section("Expected Contributions", "The project will combine image classification, a classical tabular ML model, explainable AI, and a controlled chatbot in one application. All five members will contribute to data preparation, model training, testing, and error analysis. Saumya Sood, Vichanshu, and Vishwas will handle Generative AI and backend integration. Kunal and Yash will work on frontend delivery and DevOps. This keeps ML work shared by everyone, with two frontend and three backend members.")

doc = SimpleDocTemplate(
    str(OUT), pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN,
    topMargin=13*mm, bottomMargin=13*mm,
    title="Jivika AI - Machine Learning Project Proposal",
    author="Jivika AI Team",
)
doc.build(story)
print(OUT)
