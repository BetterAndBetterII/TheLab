"""论坛模块。

包含论坛相关的数据模型，如主题、回复等。
"""

import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from database import Base


class TopicCategory(enum.Enum):
    """主题分类枚举。

    定义了论坛主题的不同分类：
    - GENERAL: 综合讨论
    - TECHNICAL: 技术交流
    - QUESTION: 问答
    - SHARING: 分享
    - FEEDBACK: 反馈
    """

    GENERAL = "general"  # 综合讨论
    TECHNICAL = "technical"  # 技术交流
    QUESTION = "question"  # 问答
    SHARING = "sharing"  # 分享
    FEEDBACK = "feedback"  # 反馈


class Topic(Base):
    """论坛主题模型。

    存储论坛主题的基本信息，包括标题、内容、分类、作者等。 支持置顶和锁定功能。
    """

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
    """论坛回复模型。

    存储论坛主题的回复信息，支持多级回复。 包含回复内容、作者信息、时间戳等。 支持AI生成的回复标记。
    """

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
