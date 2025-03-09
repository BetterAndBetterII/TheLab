"""用户管理模块。

处理用户相关的数据模型，包括用户信息、认证和权限管理。
"""

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
