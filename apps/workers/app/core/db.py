import os
import hashlib
import structlog
import asyncpg
from typing import Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

logger = structlog.get_logger(__name__)

_pool: Optional[asyncpg.Pool] = None


def get_database_url() -> str:
    if os.getenv("DATABASE_URL"):
        return os.getenv("DATABASE_URL")
    
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    db = os.getenv("POSTGRES_DB", "aiva")
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "postgres")
    
    return f"postgresql://{user}:{password}@{host}:{port}/{db}"


async def get_db_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None or _pool._closed:
        db_url = get_database_url()
        logger.info("Initializing asyncpg PostgreSQL pool...", url=db_url.split("@")[-1])
        _pool = await asyncpg.create_pool(
            dsn=db_url,
            min_size=2,
            max_size=10,
            command_timeout=60,
        )
    return _pool


async def close_db_pool() -> None:
    global _pool
    if _pool is not None and not _pool._closed:
        await _pool.close()
        _pool = None


def decrypt_secret(encrypted_str: str) -> str:
    if not encrypted_str:
        return ""
    
    parts = encrypted_str.split(":")
    if len(parts) != 3:
        return encrypted_str
    
    try:
        secret = os.getenv("APP_SECRET", "aiva_default_local_master_secret_2026")
        key = hashlib.sha256(secret.encode("utf-8")).digest()
        aesgcm = AESGCM(key)
        
        iv = bytes.fromhex(parts[0])
        auth_tag = bytes.fromhex(parts[1])
        ciphertext = bytes.fromhex(parts[2])
        
        decrypted_bytes = aesgcm.decrypt(iv, ciphertext + auth_tag, None)
        return decrypted_bytes.decode("utf-8")
    except Exception as err:
        logger.error("Failed to decrypt secret payload in Python worker", error=str(err))
        return ""


async def get_app_setting(key: str) -> Optional[str]:
    """
    Reads an app setting by key from `app_settings` PostgreSQL table.
    Decrypts automatically if `is_encrypted` is True.
    Falls back to pydantic settings (.env) and then os.getenv if missing in database.
    """
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT value, is_encrypted FROM public.app_settings WHERE key = $1 LIMIT 1",
                key
            )
            if row:
                val = row["value"]
                is_encrypted = row["is_encrypted"]
                if is_encrypted and val:
                    return decrypt_secret(val)
                return val
    except Exception as err:
        logger.warning("Database app_settings lookup failed, using env fallback", key=key, error=str(err))
    
    # Fallback to Pydantic settings (.env file)
    try:
        from app.core.config import get_settings
        settings = get_settings()
        if hasattr(settings, key.lower()):
            val = getattr(settings, key.lower())
            if val:
                return str(val)
    except Exception:
        pass
        
    return os.getenv(key.upper()) or os.getenv(key)
