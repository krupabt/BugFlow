import os
import urllib.parse
from datetime import timedelta
from dotenv import load_dotenv

# Load .env file from backend directory or parent directories
basedir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
load_dotenv(os.path.join(basedir, ".env"))

class Config:
    # Flask Security
    SECRET_KEY = os.getenv("SECRET_KEY", "bugflow-secret-key-change-in-production")
    
    # Database Settings
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "bugflow_db")
    
    # Encode password to handle special characters safely
    _encoded_password = urllib.parse.quote_plus(DB_PASSWORD) if DB_PASSWORD else ""
    _auth = f"{DB_USER}:{_encoded_password}@" if _encoded_password else f"{DB_USER}@"
    
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        f"postgresql+psycopg2://{_auth}{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300
    }
    
    # JWT Authentication
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "bugflow-jwt-secret-key-change-in-production")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        hours=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_HOURS", 24))
    )
    
    # CORS
    CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:5173")
