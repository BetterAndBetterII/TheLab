"""用户管理模块。

处理用户相关的数据模型，包括用户信息、认证和权限管理。
"""

import enum
from datetime import datetime
from typing import Optional

from passlib.context import CryptContext
from sqlalchemy import JSON, Boolean, DateTime
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base
from models.sessions import Session

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserStatus(enum.Enum):
    """用户状态枚举。

    定义了用户的不同状态：
    - PENDING: 待激活
    - ACTIVE: 已激活
    - DISABLED: 已禁用
    """

    PENDING = "pending"
    ACTIVE = "active"
    DISABLED = "disabled"


class AIProvider(enum.Enum):
    """AI服务提供商枚举。

    定义了支持的AI服务提供商：
    - OPENAI: OpenAI服务
    - GEMINI: Google Gemini服务
    """

    OPENAI = "openai"
    GEMINI = "gemini"


class User(Base):
    """用户模型。

    存储用户的基本信息、认证信息和配置信息。 包含与文档、笔记、对话等资源的关联关系。 支持AI服务配置和通知设置。
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String)
    full_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[UserStatus] = mapped_column(SQLAlchemyEnum(UserStatus), default=UserStatus.PENDING)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # 基本信息
    bio: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # 通知设置默认值:
    # {
    #   "email": true,  # 是否开启邮件通知
    #   "push": true    # 是否开启推送通知
    # } {"email": true, "push": true}
    notifications: Mapped[dict] = mapped_column(JSON, default={"email": True, "push": True})

    # AI服务配置
    ai_provider: Mapped[AIProvider] = mapped_column(SQLAlchemyEnum(AIProvider), default=AIProvider.OPENAI)
    ai_api_key: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ai_base_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ai_standard_model: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ai_advanced_model: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # 关联到会话
    sessions = relationship(Session, back_populates="user", cascade="all, delete-orphan")

    # 添加文档和文件夹的反向关系
    documents = relationship("Document", back_populates="owner")
    folders = relationship("Folder", back_populates="owner")

    # 定义反向关系
    api_keys = relationship("ApiKey", back_populates="user")

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
        """验证密码。

        比较明文密码和哈希密码是否匹配。

        Args:
            plain_password: 明文密码
            hashed_password: 哈希后的密码

        Returns:
            bool: 密码是否匹配
        """
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def get_password_hash(password: str) -> str:
        """生成密码哈希。

        将明文密码转换为安全的哈希形式。

        Args:
            password: 明文密码

        Returns:
            str: 哈希后的密码
        """
        return pwd_context.hash(password)
