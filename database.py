"""数据库模型和会话管理模块。

这个模块包含了所有数据库相关的模型定义和数据库会话管理功能。
"""

import datetime
import enum
from typing import Generator, Optional

from sqlalchemy import (JSON, Boolean, Column, DateTime, Enum, Float,
                        ForeignKey, Integer, LargeBinary, String, Table, Text,
                        create_engine)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

from config import get_settings

settings = get_settings()

# 创建数据库引擎
engine = create_engine(
    settings.DATABASE_URL,
    # SQLite 特定配置
    connect_args=(
        {"check_same_thread": False} if settings.DATABASE_TYPE == "sqlite" else {}
    ),
    # PostgreSQL 特定配置
    pool_size=5 if settings.DATABASE_TYPE == "postgresql" else None,
    max_overflow=10 if settings.DATABASE_TYPE == "postgresql" else None,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class ProcessingStatus(enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# 会话和文档的多对多关系表
conversation_documents = Table(
    "conversation_documents",
    Base.metadata,
    Column("conversation_id", Integer, ForeignKey("conversations.id")),
    Column("document_id", Integer, ForeignKey("documents.id")),
)


class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    path = Column(String, index=True, unique=True)  # 完整路径，如 "/文档/工作"
    parent_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)
    updated_at = Column(
        DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now
    )

    # 关系
    parent = relationship("Folder", remote_side=[id], backref="subfolders")
    documents = relationship("Document", back_populates="folder")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True)
    base_url = Column(String, nullable=True)
    api_type = Column(String, nullable=True)
    model = Column(String, nullable=True)
    name = Column(String)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.now)
    last_used_at = Column(DateTime, nullable=True)
    last_error_message = Column(Text, nullable=True)
    counter = Column(Integer, default=0)


class Document(Base):
    """文档模型类。

    存储上传文档的元数据信息。
    """

    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    content_type = Column(String)
    file_data = Column(LargeBinary)  # 存储原始文件二进制数据
    file_size = Column(Integer)  # 文件大小（字节）

    # 分页文本内容，格式：{"1": "第一页内容", "2": "第二页内容", ...}
    content_pages = Column(JSON, default=dict)
    # 分页摘要，格式：{"1": "第一页摘要", "2": "第二页摘要", ...}
    summary_pages = Column(JSON, default=dict)
    # 分页翻译，格式：{"1": "第一页翻译", "2": "第二页翻译", ...}
    translation_pages = Column(JSON, default=dict)
    # 分页关键词，格式：{"1": ["关键词1", "关键词2"], "2": ["关键词3", "关键词4"], ...}
    keywords_pages = Column(JSON, default=dict)

    # 每页字数限制
    page_size = Column(Integer, default=2000)  # 默认每页2000字
    total_pages = Column(Integer, default=0)  # 总页数

    # 处理状态
    processing_status = Column(Enum(ProcessingStatus), default=ProcessingStatus.PENDING)
    processor = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)

    # 文件夹关联
    folder_id = Column(Integer, ForeignKey("folders.id"))
    folder = relationship("Folder", back_populates="documents")

    # 时间戳
    created_at = Column(DateTime, default=datetime.datetime.now)
    updated_at = Column(
        DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now
    )
    processed_at = Column(DateTime, nullable=True)

    conversations = relationship(
        "Conversation",
        secondary=conversation_documents,
        back_populates="documents",
    )

    processing_records = relationship(
        "ProcessingRecord",
        back_populates="document",
        order_by="ProcessingRecord.created_at.desc()",
    )

    def get_page_content(self, page: int) -> str:
        """获取指定页的内容"""
        return self.content_pages.get(str(page), "")

    def get_page_summary(self, page: int) -> str:
        """获取指定页的摘要"""
        return self.summary_pages.get(str(page), "")

    def get_page_translation(self, page: int) -> str:
        """获取指定页的翻译"""
        return self.translation_pages.get(str(page), "")

    def get_page_keywords(self, page: int) -> list:
        """获取指定页的关键词"""
        return self.keywords_pages.get(str(page), [])


class Conversation(Base):
    """对话模型类。

    存储用户与系统之间的对话记录。
    """

    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.now)
    updated_at = Column(
        DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now
    )

    documents = relationship(
        "Document",
        secondary=conversation_documents,
        back_populates="conversations",
    )
    messages = relationship(
        "Message", back_populates="conversation", cascade="all, delete-orphan"
    )


class Message(Base):
    """消息模型类。

    存储对话中的具体消息内容。
    """

    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"))
    content = Column(Text)
    is_ai = Column(Boolean, default=False)
    position_x = Column(Float)
    position_y = Column(Float)
    created_at = Column(DateTime, default=datetime.datetime.now)
    updated_at = Column(
        DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now
    )

    conversation = relationship("Conversation", back_populates="messages")


class ProcessingRecord(Base):
    __tablename__ = "processing_records"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    file_hash = Column(String, index=True)  # 文件内容的哈希值
    version = Column(Integer, default=1)  # 处理版本号
    processor_version = Column(String)  # 处理器版本
    processing_config = Column(JSON)  # 处理配置
    created_at = Column(DateTime, default=datetime.datetime.now)

    # 关系
    document = relationship("Document", backref="processing_records")


# 创建数据库表
def create_tables():
    Base.metadata.create_all(bind=engine)


# 获取数据库会话
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
