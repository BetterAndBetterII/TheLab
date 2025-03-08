import enum
from datetime import datetime

from passlib.context import CryptContext
from sqlalchemy import JSON, Boolean, Column, DateTime
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy import Integer, String
from sqlalchemy.orm import relationship

from database import Base
from models.forum import Reply, Topic
from models.sessions import Session

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserStatus(enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    DISABLED = "disabled"


class AIProvider(enum.Enum):
    OPENAI = "openai"
    GEMINI = "gemini"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String, nullable=True)
    status = Column(SQLAlchemyEnum(UserStatus), default=UserStatus.PENDING)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    last_login = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)

    # 基本信息
    bio = Column(String, nullable=True)
    # 通知设置默认值:
    # {
    #   "email": true,  # 是否开启邮件通知
    #   "push": true    # 是否开启推送通知
    # } {"email": true, "push": true}
    notifications = Column(JSON, default={"email": True, "push": True})

    # AI服务配置
    ai_provider = Column(SQLAlchemyEnum(AIProvider), default=AIProvider.OPENAI)
    ai_api_key = Column(String, nullable=True)
    ai_base_url = Column(String, nullable=True)
    ai_standard_model = Column(String, nullable=True)
    ai_advanced_model = Column(String, nullable=True)

    # 关联到会话
    sessions = relationship(Session, back_populates="user", cascade="all, delete-orphan")

    # 添加文档和文件夹的反向关系
    documents = relationship("Document", back_populates="owner")
    folders = relationship("Folder", back_populates="owner")

    # 定义反向关系
    api_keys = relationship("ApiKey", back_populates="user")

    # 添加 topics 和 replies 关系
    topics = relationship(Topic, back_populates="user", cascade="all, delete-orphan")
    replies = relationship(Reply, back_populates="user", cascade="all, delete-orphan")

    # 添加笔记关系
    notes = relationship("Note", back_populates="user", cascade="all, delete-orphan")

    # 添加对话关系
    conversations = relationship(
        "Conversation",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    # 添加QuizHistory关系
    quiz_history = relationship(
        "QuizHistory",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def get_password_hash(password: str) -> str:
        return pwd_context.hash(password)
