"""数据库模型和会话管理模块。

这个模块包含了所有数据库相关的模型定义和数据库会话管理功能。
"""

import enum
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Table,
    Text,
    create_engine,
    text,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker, Session

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

# 导入所有模型以确保它们在创建表时被注册
from models.users import User
from models.sessions import Session
from models.forum import Topic, Reply


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
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # 修改为外键
    is_folder = Column(Boolean, default=True)  # 添加类型标识字段
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # 关系
    parent = relationship("Folder", remote_side=[id], backref="subfolders")
    documents = relationship("Document", back_populates="folder")
    owner = relationship("User", back_populates="folders")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True)
    base_url = Column(String, nullable=True)
    api_type = Column(String, nullable=True)
    name = Column(String)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    last_used_at = Column(DateTime, nullable=True)
    last_error_message = Column(Text, nullable=True)
    counter = Column(Integer, default=0)

    # 添加外键关联
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    # 关系
    user = relationship("User", back_populates="api_keys")


class ProcessingRecord(Base):
    __tablename__ = "processing_records"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    file_hash = Column(String, index=True)  # 文件内容的哈希值
    version = Column(Integer, default=1)  # 处理版本号
    processor_version = Column(String)  # 处理器版本
    processing_config = Column(JSON)  # 处理配置
    created_at = Column(DateTime, default=datetime.now)

    # 关系
    document = relationship("Document", back_populates="processing_records")


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
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # 修改为外键
    path = Column(String)  # 添加路径字段
    is_folder = Column(Boolean, default=False)  # 添加类型标识字段
    mime_type = Column(String)  # 添加MIME类型字段

    # 分页文本内容，格式：{"1": "第一页内容", "2": "第二页内容", ...}
    content_pages = Column(JSON, default=dict)
    # 分页摘要，格式：{"1": "第一页摘要", "2": "第二页摘要", ...}
    summary_pages = Column(JSON, default=dict)
    # 分页翻译，格式：{"1": "第一页翻译", "2": "第二页翻译", ...}
    translation_pages = Column(JSON, default=dict)
    # 分页关键词，格式：{"1": ["关键词1", "关键词2"], "2": ["关键词3", "关键词4"], ...}
    keywords_pages = Column(JSON, default=dict)

    # thumbnail缩略图
    thumbnail = Column(LargeBinary, nullable=True)

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

    # 用户关联
    owner = relationship("User", back_populates="documents")

    # 时间戳
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    processed_at = Column(DateTime, nullable=True)

    # 关系
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
    notes = relationship("Note", back_populates="document", cascade="all, delete-orphan")

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

class DocumentReadRecord(Base):
    """文档阅读记录模型类。

    存储用户阅读文档的记录。
    """

    __tablename__ = "document_read_records"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    read_at = Column(DateTime, default=datetime.now)

class Note(Base):
    """笔记模型类。

    存储用户在文档上添加的笔记。
    """

    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    quote = Column(Text)  # 引用的原文内容
    document_id = Column(Integer, ForeignKey("documents.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    highlight_areas = Column(JSON)  # 存储高亮区域信息
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # 关系
    document = relationship("Document", back_populates="notes")
    user = relationship("User", back_populates="notes")

class Conversation(Base):
    """对话模型类。

    存储用户与系统之间的对话记录。
    """

    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    user_id = Column(Integer, ForeignKey("users.id"))  # 添加用户关联
    messages = Column(JSON, default=list)  # 存储聊天消息的JSON字段

    documents = relationship(
        "Document",
        secondary=conversation_documents,
        back_populates="conversations",
    )
    user = relationship("User", back_populates="conversations")  # 添加用户关系


def create_rag_db():
    """创建RAG数据库"""
    if settings.DATABASE_TYPE == "postgresql":
        # 首先连接到默认的postgres数据库
        default_engine = create_engine(
            f"postgresql://{settings.DATABASE_USER}:{settings.DATABASE_PASSWORD}"
            f"@{settings.DATABASE_HOST}:{settings.DATABASE_PORT}/postgres"
        )
        
        # 创建数据库（如果不存在）
        with default_engine.connect() as conn:
            # 断开可能存在的连接
            conn.execute(text("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'rag'"))
            conn.execute(text("commit"))
            
            # 创建数据库
            conn.execute(text("DROP DATABASE IF EXISTS rag"))
            conn.execute(text("commit"))
            conn.execute(text("CREATE DATABASE rag"))
            conn.execute(text("commit"))
        
        default_engine.dispose()
    
    return engine, SessionLocal


def get_rag_db():
    """获取RAG数据库会话"""
    _, SessionLocal = create_rag_db()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# 创建数据库表
def create_tables():
    """创建所有数据库表"""
    # 使用 CASCADE 删除所有表及其依赖
    with engine.connect() as conn:
        if settings.DATABASE_TYPE == "postgresql":
            conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
        else:
            Base.metadata.drop_all(bind=engine)  # SQLite 使用默认的 drop_all

    Base.metadata.create_all(bind=engine)  # 创建所有表
    initialize_database()  # 初始化数据


def initialize_database():
    """初始化数据库数据"""
    db = SessionLocal()
    try:
        # 检查是否已存在系统用户
        system_user = db.query(User).filter(User.username == "system").first()
        if not system_user:
            # 创建系统用户
            system_user = User(
                username="system",
                email="system@example.com",
                hashed_password=User.get_password_hash("SYSTEM"),
                is_active=True,
                is_superuser=True,
            )
            db.add(system_user)
            db.commit()
            db.refresh(system_user)
    finally:
        db.close()


# 获取数据库会话
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
