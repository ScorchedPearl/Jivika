import os
import boto3
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from rich.console import Console
load_dotenv()

BUCKET_NAME = "health-pearl"
REGION = "ap-south-1"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# LLM provider: "openai" or "gemini"
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai").lower()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

DATABASE_URL = os.getenv("DATABASE_URL")

# AWS Configuration
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_DEFAULT_REGION = os.getenv("AWS_DEFAULT_REGION", "ap-south-1")

# The unified ML service (ML/service.py). When unset, the hosted single-model endpoints below are used.
ML_SERVICE_URL = os.getenv("ML_SERVICE_URL")
# Ask the vision LLM what kind of image it is before a diagnosis model runs. Set to "off" to keep images away from the LLM.
IMAGE_TYPE_CHECK = os.getenv("IMAGE_TYPE_CHECK", "on").lower() != "off"

XRAY_CLASSIFIER_URL = os.getenv("XRAY_CLASSIFIER_URL", "https://kyanmahajan-x-ray-classification-docker.hf.space/predict_classify")
BRAIN_MODEL_URL = os.getenv("BRAIN_MODEL_URL", "https://kyanmahajan-brain-tumour-classifier.hf.space/predict")
LUNG_MODEL_URL = os.getenv("LUNG_MODEL_URL", "https://kyanmahajan-lung-classifier.hf.space/predict_lung")
WOUND_MODEL_URL = os.getenv("WOUND_MODEL_URL", "https://kyanmahajan-wound-classifier.hf.space/predict_wound")
HEART_MODEL_URL = os.getenv("HEART_MODEL_URL", "https://kyanmahajan-heart-disease-predicition.hf.space/predict")

if LLM_PROVIDER == "gemini":
    # Gemini's OpenAI-compatible endpoint works with the same client
    llm_client = ChatOpenAI(model=GEMINI_MODEL, temperature=0, api_key=GEMINI_API_KEY, base_url=GEMINI_BASE_URL)
else:
    llm_client = ChatOpenAI(model="gpt-4", temperature=0, api_key=OPENAI_API_KEY)
s3Client = boto3.client(
    "s3",
    region_name=AWS_DEFAULT_REGION,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY
)
rich = Console()

PSQL_USERNAME = os.getenv("PSQL_USERNAME")
PSQL_PASSWORD = os.getenv("PSQL_PASSWORD")
PSQL_HOST = os.getenv("PSQL_HOST")
PSQL_PORT = os.getenv("PSQL_PORT")
PSQL_DATABASE = os.getenv("PSQL_DATABASE")
PSQL_SSLMODE = os.getenv("PSQL_SSLMODE")