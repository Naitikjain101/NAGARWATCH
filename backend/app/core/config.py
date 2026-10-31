import os
import logging
from typing import Optional, List
from dotenv import load_dotenv

# Load environment variables from .env if present
_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
load_dotenv(dotenv_path=_env_path)
load_dotenv()

logger = logging.getLogger(__name__)

class Config:
    """Application configuration settings with strict security validation."""
    
    ENV: str = os.getenv("FLASK_ENV", "development").lower().strip()
    DEBUG: bool = os.getenv("FLASK_DEBUG", "True").lower() in ("true", "1")
    
    # Supabase credentials (Service-role or anon keys; NEVER logged or exposed)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "").strip()
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "").strip()
    SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "").strip()
    SUPABASE_BUCKET: str = os.getenv("SUPABASE_BUCKET", "complaints").strip()
    
    # Supported asymmetric signing algorithms for Supabase JWKS
    SUPPORTED_ALGORITHMS: List[str] = ["HS256", "RS256", "ES256"]
    
    # PostgreSQL / PostGIS Database credentials
    DB_HOST: str = os.getenv("DB_HOST", "localhost").strip()
    DB_PORT: int = int(os.getenv("DB_PORT", "5432"))
    DB_NAME: str = os.getenv("DB_NAME", "postgres").strip()
    DB_USER: str = os.getenv("DB_USER", "postgres").strip()
    DB_PASS: str = os.getenv("DB_PASS", "").strip()
    
    # Database Pool Settings
    DB_POOL_MIN: int = int(os.getenv("DB_POOL_MIN", "1"))
    DB_POOL_MAX: int = int(os.getenv("DB_POOL_MAX", "10"))
    
    # Security & CORS
    raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000")
    ALLOWED_ORIGINS: List[str] = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    
    # Upload settings
    UPLOAD_FOLDER: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
    MAX_CONTENT_LENGTH: int = int(os.getenv("MAX_CONTENT_LENGTH", 15 * 1024 * 1024))  # 15 MB
    
    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    @property
    def is_production(self) -> bool:
        return self.ENV == "production"

    @property
    def SUPABASE_ISSUER(self) -> Optional[str]:
        """Returns the canonical Supabase issuer URL if SUPABASE_URL is configured."""
        if self.SUPABASE_URL:
            return f"{self.SUPABASE_URL.rstrip('/')}/auth/v1"
        return None

    def is_auth_configured(self) -> bool:
        """Checks if server possesses valid signing configuration for token verification."""
        has_secret = bool(self.SUPABASE_JWT_SECRET and len(self.SUPABASE_JWT_SECRET) >= 16)
        has_client = bool(self.SUPABASE_URL and self.SUPABASE_KEY)
        return has_secret or has_client

    def validate_production_config(self) -> None:
        """
        Validates that required authentication secrets exist in production.
        Fails fast to prevent running without signature verification.
        """
        if self.ENV == "production":
            if not self.is_auth_configured():
                raise RuntimeError(
                    "CRITICAL SECURITY CONFIGURATION ERROR: Production server cannot start without "
                    "Supabase authentication credentials. Configure SUPABASE_JWT_SECRET or "
                    "(SUPABASE_URL and SUPABASE_KEY)."
                )
            if self.DEBUG:
                logger.warning("SECURITY WARNING: FLASK_DEBUG is enabled in a production environment.")

    def __repr__(self) -> str:
        """Safe string representation that never exposes secrets or passwords."""
        return (
            f"<Config env={self.ENV} debug={self.DEBUG} "
            f"supabase_url={'configured' if self.SUPABASE_URL else 'missing'} "
            f"jwt_secret={'configured' if self.SUPABASE_JWT_SECRET else 'missing'} "
            f"db_host={self.DB_HOST}>"
        )

config = Config()
