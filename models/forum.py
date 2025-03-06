import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from database import Base


class TopicCategory(enum.Enum):
    GENERAL = "general"  # 综合讨论
    TECHNICAL = "technical"  # 技术交流
    QUESTION = "question"  # 问答
    SHARING = "sharing"  # 分享
    FEEDBACK = "feedback"  # 反馈


class Topic(Base):
    __tablename__ = "forum_topics"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    content = Column(Text)
    category = Column(SQLAlchemyEnum(TopicCategory), default=TopicCategory.GENERAL)
    user_id = Column(Integer, ForeignKey("users.id"))
    username = Column(String, index=True)
    views = Column(Integer, default=0)
    is_pinned = Column(Boolean, default=False)
    is_locked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="topics")
    replies = relationship("Reply", back_populates="topic", cascade="all, delete-orphan")


class Reply(Base):
    __tablename__ = "forum_replies"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text)
    topic_id = Column(Integer, ForeignKey("forum_topics.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    username = Column(String, index=True)
    parent_id = Column(Integer, ForeignKey("forum_replies.id"), nullable=True)
    is_ai_generated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    topic = relationship("Topic", back_populates="replies")
    user = relationship("User", back_populates="replies")
    parent = relationship("Reply", remote_side=[id], backref="children")
