import os
import boto3
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from rich.console import Console
load_dotenv()

BUCKET_NAME = "health-pearl"
REGION = "ap-south-1"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

# AWS Configuration
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_DEFAULT_REGION = os.getenv("AWS_DEFAULT_REGION", "ap-south-1")

openAi_Client = ChatOpenAI(model="gpt-4", temperature=0, api_key=OPENAI_API_KEY)

# Gemini (Google) — selectable alternative to OpenAI.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
gemini_Client = None
if GEMINI_API_KEY:
    from langchain_google_genai import ChatGoogleGenerativeAI
    gemini_Client = ChatGoogleGenerativeAI(model=GEMINI_MODEL, temperature=0, google_api_key=GEMINI_API_KEY, transport="rest")

# Active chat model used by the graph nodes and title generation.
# LLM_PROVIDER=gemini | openai (default: gemini when a Gemini key is set, else openai).
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini" if GEMINI_API_KEY else "openai").lower()
llm_Client = gemini_Client if (LLM_PROVIDER == "gemini" and gemini_Client is not None) else openAi_Client

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