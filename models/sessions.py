"""会话管理模块。

处理用户会话相关的数据模型，包括会话创建、过期和数据存储。
"""

from datetime import datetime
from typing import Optional, Dict, Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Session(Base):
    """用户会话模型。

    存储用户会话信息，包括会话ID、用户信息、过期时间等。 支持会话数据的JSON存储和用户代理信息记录。
    """

    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # 使用UUID作为session_id
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_accessed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)  # 存储会话上下文信息
    user_agent: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # 存储用户代理信息
    ip_address: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # 存储IP地址

    # 关联到用户
    user = relationship("User", back_populates="sessions")

    def is_expired(self) -> bool:
        """检查会话是否已过期."""
        return datetime.now() > self.expires_at

    def to_dict(self) -> dict:
        """将会话信息转换为字典."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "last_accessed_at": self.last_accessed_at.isoformat(),
            "data": self.data or {},
            "user_agent": self.user_agent,
            "ip_address": self.ip_address,
        }
