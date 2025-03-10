"""数据库模型和会话管理模块.

这个模块包含了所有数据库相关的模型定义和数据库会话管理功能.
"""

import enum
import logging
from datetime import datetime

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Table,
    Text,
    create_engine,
    inspect,
    text,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

from config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# 创建数据库引擎
engine = create_engine(
    settings.DATABASE_URL,
    # SQLite 特定配置
    connect_args=({"check_same_thread": False} if settings.DATABASE_TYPE == "sqlite" else {}),
    # PostgreSQL 特定配置
    pool_size=20 if settings.DATABASE_TYPE == "postgresql" else None,  # 增加连接池大小
    max_overflow=30 if settings.DATABASE_TYPE == "postgresql" else None,  # 增加最大溢出连接数
    pool_timeout=60 if settings.DATABASE_TYPE == "postgresql" else None,  # 增加连接超时时间
    pool_recycle=3600 if settings.DATABASE_TYPE == "postgresql" else None,  # 添加连接回收时间
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class ProcessingStatus(enum.Enum):
    """文档处理状态枚举类.

    定义了文档处理的各个状态：
    - PENDING: 等待处理
    - PROCESSING: 处理中
    - COMPLETED: 处理完成
    - FAILED: 处理失败
    """

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
    """文件夹模型类.

    用于组织和管理文档的文件夹结构，支持嵌套文件夹.
    """

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
    """API密钥模型类.

    管理用户的API密钥信息，包括使用统计和错误记录.
    """

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
    """文档处理记录模型类.

    记录文档处理的历史记录，包括处理版本和配置信息.
    """

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
    """文档模型类.

    存储上传文档的元数据信息，包括文件内容、处理状态和关联数据.
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
    notes = relationship(
        "Note",
        back_populates="document",
        cascade="all, delete-orphan",
    )

    # 总结历史记录，格式：{
    #     "created": int(datetime.now().timestamp()),
    #     "summary": "总结内容"
    # }
    flow_history = Column(JSON, default=list)
    # 测验历史记录，格式：[{"page": 1, "questions": [...], "created_at": "2024-03-21T10:00:00"}]
    # quiz_history = Column(JSON, default=list)

    # 思维导图
    mindmap = Column(JSON, default=dict)

    # 测验历史记录
    quiz_history = relationship(
        "QuizHistory",
        back_populates="document",
        cascade="all, delete-orphan",
    )

    def get_page_content(self, page: int) -> str:
        """获取指定页的内容."""
        return self.content_pages.get(str(page), "")

    def get_page_summary(self, page: int) -> str:
        """获取指定页的摘要."""
        return self.summary_pages.get(str(page), "")

    def get_page_translation(self, page: int) -> str:
        """获取指定页的翻译."""
        return self.translation_pages.get(str(page), "")

    def get_page_keywords(self, page: int) -> list:
        """获取指定页的关键词."""
        return self.keywords_pages.get(str(page), [])


class QuizHistory(Base):
    """测验历史记录模型类.

    存储用户的文档测验历史记录，包括测验内容和结果.
    """

    __tablename__ = "quiz_history"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    quiz_history = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # 关系
    document = relationship("Document", back_populates="quiz_history")
    user = relationship("User", back_populates="quiz_history")


class DocumentReadRecord(Base):
    """文档阅读记录模型类.

    存储用户的文档阅读历史，记录阅读时间和进度.
    """

    __tablename__ = "document_read_records"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    read_at = Column(DateTime, default=datetime.now)


class Note(Base):
    """笔记模型类.

    存储用户在文档上添加的笔记，包括笔记内容和高亮区域.
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
    """对话模型类.

    存储用户与系统之间的对话历史，包括对话内容和相关文档.
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
    """创建RAG数据库."""
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
    """获取RAG数据库会话."""
    _, SessionLocal = create_rag_db()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """创建或更新所有数据库表.

    如果表不存在则创建新表，如果表存在则更新表结构以匹配最新的模型定义.
    """
    # 创建迁移上下文
    with engine.connect() as conn:
        # 开始事务
        trans = conn.begin()
        try:
            context = MigrationContext.configure(conn)
            op = Operations(context)

            # 获取现有表的结构
            inspector = inspect(engine)
            existing_tables = inspector.get_table_names()

            if settings.DATABASE_TYPE == "postgresql":
                # PostgreSQL 数据库，使用 ALTER TABLE 进行表结构更新
                for table in Base.metadata.sorted_tables:
                    if table.name not in existing_tables:
                        # 如果表不存在，创建新表
                        logger.info(f"创建表 {table.name}")
                        table.create(engine)
                    else:
                        # 如果表存在，更新表结构
                        existing_columns = {col["name"]: col for col in inspector.get_columns(table.name)}
                        metadata_columns = {col.name: col for col in table.columns}
                        # 添加新列
                        for (
                            col_name,
                            col,
                        ) in metadata_columns.items():
                            if col_name not in existing_columns:
                                logger.info(f"添加列 {col_name}")
                                try:
                                    op.add_column(table.name, col)
                                except Exception as e:
                                    logger.error(f"添加列 {col_name} 时出错: {str(e)}")
                logger.info("表结构更新完成")
            else:
                # SQLite 数据库，由于 SQLite 限制，使用临时表进行迁移
                Base.metadata.create_all(bind=engine)

            # 提交事务
            trans.commit()
        except Exception as e:
            # 回滚事务
            trans.rollback()
            logger.error(f"更新表结构时出错: {str(e)}")
            raise

    # 初始化数据库数据
    initialize_database()


def initialize_database():
    """初始化数据库数据."""
    from models.users import User  # 添加 User 模型的导入

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


def get_db():
    """获取数据库会话.

    创建一个新的数据库会话，使用完毕后自动关闭.

    Yields:
        Session: SQLAlchemy会话对象
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
