from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from database import Base


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True)  # 使用UUID作为session_id
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at = Column(DateTime, default=datetime.now)
    expires_at = Column(DateTime, nullable=False)
    last_accessed_at = Column(DateTime, default=datetime.now)
    data = Column(JSON, nullable=True)  # 存储会话上下文信息
    user_agent = Column(String, nullable=True)  # 存储用户代理信息
    ip_address = Column(String, nullable=True)  # 存储IP地址

    # 关联到用户
    user = relationship("User", back_populates="sessions")

    def is_expired(self) -> bool:
        """检查会话是否已过期"""
        return datetime.now() > self.expires_at

    def to_dict(self) -> dict:
        """将会话信息转换为字典"""
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