import os
from datetime import timedelta
from functools import lru_cache
from typing import Literal, Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # 数据库设置
    DATABASE_TYPE: str = "sqlite"  # 默认使用 SQLite
    DATABASE_HOST: Optional[str] = None
    DATABASE_PORT: Optional[int] = None
    DATABASE_USER: Optional[str] = None
    DATABASE_PASSWORD: Optional[str] = None
    DATABASE_NAME: str = "app.db"
    RAG_DATABASE_NAME: str = "rag.db"

    # Redis设置
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: Optional[str] = None

    # Celery设置
    CELERY_BROKER_URL: Optional[str] = None
    CELERY_RESULT_BACKEND: Optional[str] = None

    # 任务处理设置
    TASK_PROCESSING_INTERVAL: int = 300  # 5分钟处理一次
    MAX_CONCURRENT_TASKS: int = 3  # 最大并发任务数

    # 邮件设置
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str
    SMTP_PASSWORD: str
    SMTP_FROM_EMAIL: str
    SMTP_FROM_NAME: str = "AI文档系统"

    # 验证码设置
    VERIFICATION_CODE_LENGTH: int = 6
    VERIFICATION_CODE_EXPIRE_MINUTES: int = 10

    # 会话设置
    SESSION_COOKIE_NAME: str = "session_id"
    SESSION_EXPIRE_DAYS: int = 7

    # OAuth2 设置
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    GITHUB_REDIRECT_URI: Optional[str] = None
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: Optional[str] = None

    # JWT设置（保留用于API访问）
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # OpenAI设置
    OPENAI_API_KEY: str
    OPENAI_BASE_URL: str
    LLM_MODEL: str
    EMBEDDING_MODEL: str
    EMBEDDING_API_KEY: str
    EMBEDDING_BASE_URL: str
    EMB_DIMENSIONS: int = 1024
    LLM_STANDARD_MODEL: str
    LLM_ADVANCED_MODEL: str

    # 全局模式
    GLOBAL_MODE: Literal["public", "private"] = "public"
    GLOBAL_LLM: Literal["public", "private"] = "public"

    @property
    def DATABASE_URL(self) -> str:
        if self.DATABASE_TYPE == "sqlite":
            return f"sqlite:///./{self.DATABASE_NAME}"
        elif self.DATABASE_TYPE == "postgresql":
            return (
                f"postgresql://{self.DATABASE_USER}:{self.DATABASE_PASSWORD}"
                f"@{self.DATABASE_HOST}:{self.DATABASE_PORT}/{self.DATABASE_NAME}"
            )
        else:
            raise ValueError(f"不支持的数据库类型: {self.DATABASE_TYPE}")

    @property
    def RAG_DATABASE_URL(self) -> str:
        if self.DATABASE_TYPE == "sqlite":
            return f"sqlite:///./{self.RAG_DATABASE_NAME}"
        elif self.DATABASE_TYPE == "postgresql":
            return (
                f"postgresql://{self.DATABASE_USER}:{self.DATABASE_PASSWORD}"
                f"@{self.DATABASE_HOST}:{self.DATABASE_PORT}/{self.RAG_DATABASE_NAME}"
            )
        else:
            raise ValueError(f"不支持的数据库类型: {self.DATABASE_TYPE}")

    @property
    def REDIS_URL(self) -> str:
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # 如果没有显式设置，使用Redis URL作为Celery的broker和backend
        if not self.CELERY_BROKER_URL:
            self.CELERY_BROKER_URL = self.REDIS_URL
        if not self.CELERY_RESULT_BACKEND:
            self.CELERY_RESULT_BACKEND = self.REDIS_URL

        # 配置OpenAI
        import openai

        openai.api_key = self.OPENAI_API_KEY

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
