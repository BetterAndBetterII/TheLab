import asyncio
import hashlib
import logging
import os
import queue
import tempfile
import threading
import traceback
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Dict, Optional

from fastapi import Request
from sqlalchemy.orm import Session

from config import get_settings
from database import Document, ProcessingRecord, ProcessingStatus, get_db
from models.users import User
from prepdocs.config import FileType, Page, Section
from prepdocs.parse_images import parse_images
from prepdocs.parse_page import DocsIngester
from prepdocs.translate import translate_text
from rag.knowledgebase import KnowledgeBase

logger = logging.getLogger(__name__)

settings = get_settings()


class DocumentPipeline:
    VERSION = "1.0.0"  # 处理器版本号

    def __init__(self, max_workers=3):
        self.task_queue = queue.Queue()
        self.thread_pool = ThreadPoolExecutor(max_workers=max_workers)
        self.is_running = True
        db = next(get_db())
        # 删除之前未完成的任务
        db.query(Document).filter(Document.processing_status == ProcessingStatus.PROCESSING).update(
            {Document.processing_status: ProcessingStatus.FAILED}
        )
        db.commit()

        # 启动守护线程处理任务
        self.forever_loop = asyncio.new_event_loop()
        self.daemon_thread = threading.Thread(target=self._process_queue, daemon=True)
        self.daemon_thread.start()
        # 继续处理队列中的任务
        pending_documents = (
            db.query(Document)
            .filter(Document.processing_status == ProcessingStatus.PENDING)
            .with_entities(Document.id)
            .all()
        )
        for document in pending_documents:
            self.add_task(document.id)

        db.close()

    def _calculate_file_hash(self, file_data: bytes) -> str:
        """计算文件的SHA256哈希值."""
        sha256_hash = hashlib.sha256()
        sha256_hash.update(file_data)
        return sha256_hash.hexdigest()

    def _get_processing_config(self) -> Dict:
        """获取当前的处理配置."""
        return {
            "version": self.VERSION,
            "max_workers": self.thread_pool._max_workers,
            "timestamp": datetime.now().isoformat(),
        }

    def _should_process_document(self, document: Document, db: Session, force: bool = False) -> bool:
        """检查文档是否需要处理 :param document: Document对象 :param force: 是否强制处理 :return: 是否需要处理."""
        if force:
            return True
        file_hash = self._calculate_file_hash(document.file_data)
        # 检查是否存在相同哈希值的处理记录
        existing_record: ProcessingRecord | None = (
            db.query(ProcessingRecord)
            .filter(
                ProcessingRecord.file_hash == file_hash,
                ProcessingRecord.processor_version == self.VERSION,
            )
            .first()
        )

        # 如果存在相同哈希值的处理记录，则不处理
        if existing_record:
            existing_document = existing_record.document
            if not existing_document:
                db.delete(existing_record)
                db.commit()
                return True
            # 复制处理记录
            document.processing_status = existing_document.processing_status
            document.processor = existing_document.processor
            document.content_pages = existing_document.content_pages
            document.summary_pages = existing_document.summary_pages
            document.translation_pages = existing_document.translation_pages
            document.keywords_pages = existing_document.keywords_pages
            document.total_pages = existing_document.total_pages
            document.thumbnail = existing_document.thumbnail
            document.updated_at = datetime.now()
            document.mime_type = existing_document.mime_type
            document.created_at = existing_document.created_at
            document.updated_at = datetime.now()
            db.commit()
            return False

        return existing_record is None

    def add_task(
        self,
        document_id: int,
        force: bool = False,
    ) -> bool:
        """添加新任务到流水线 :param document_id: 文档ID :param force: 是否强制处理 :return: 是否成功添加任务."""
        db = next(get_db())
        document = db.query(Document).get(document_id)
        if not document:
            logger.error(f"文档不存在: {document_id}")
            return False

        # 检查是否需要处理
        if not self._should_process_document(document, db, force):
            logger.info(f"文档 {document.filename} 已经处理过，跳过处理")
            return False

        # 更新文档状态为待处理
        document.processing_status = ProcessingStatus.PENDING
        db.commit()
        db.close()

        # self.task_queue.put(document_id)
        asyncio.run_coroutine_threadsafe(self._process_document(document_id), self.forever_loop)

        return True

    def _create_processing_record(self, document: Document, db: Session):
        """创建处理记录."""
        file_hash = self._calculate_file_hash(document.file_data)
        # 获取最新的处理记录版本号
        latest_record = (
            db.query(ProcessingRecord)
            .filter(ProcessingRecord.document_id == document.id)
            .order_by(ProcessingRecord.version.desc())
            .first()
        )

        version = (latest_record.version + 1) if latest_record else 1

        record = ProcessingRecord(
            file_hash=file_hash,
            version=version,
            processor_version=self.VERSION,
            processing_config=self._get_processing_config(),
        )
        db.add(record)
        db.commit()

    def _update_document_status(
        self,
        document: Document,
        db: Session,
        status: ProcessingStatus,
        processor_msg: Optional[str] = None,
        error_message: Optional[str] = None,
    ):
        """更新文档状态."""
        document.processing_status = status
        document.updated_at = datetime.now()
        if error_message:
            document.error_message = error_message
        if processor_msg:
            document.processor = processor_msg
        if status == ProcessingStatus.COMPLETED:
            document.processed_at = datetime.now()
        db.commit()

    async def _process_document(self, document_id: int):
        """处理单个文档的流水线逻辑."""
        db = next(get_db())
        document = db.query(Document).get(document_id)
        if not document:
            logger.error(f"文档不存在: {document_id}")
            return

        try:
            # ------------------预处理阶段------------------
            self._update_document_status(
                document,
                db,
                ProcessingStatus.PROCESSING,
                processor_msg="预处理阶段...",
            )
            document = await self.stage_1(document, db)
            logger.debug(f"预处理阶段完成: {document.filename}")

            # ------------------文本提取阶段------------------
            self._update_document_status(
                document,
                db,
                ProcessingStatus.PROCESSING,
                processor_msg="文本提取阶段...",
            )
            document = await self.stage_2(document, db)
            logger.debug(f"文本提取阶段完成: {document.filename}")

            # ------------------翻译阶段------------------
            self._update_document_status(
                document,
                db,
                ProcessingStatus.PROCESSING,
                processor_msg="翻译阶段...",
            )
            document = await self.stage_3(document, db)
            logger.debug(f"翻译阶段完成: {document.filename}")

            # ------------------保存到知识库阶段------------------
            self._update_document_status(
                document,
                db,
                ProcessingStatus.PROCESSING,
                processor_msg="保存到知识库阶段...",
            )
            document = await self.stage_4(document, db)
            logger.debug(f"保存到知识库阶段完成: {document.filename}")

            # 创建处理记录
            self._create_processing_record(document, db)

            # 完成
            self._update_document_status(
                document,
                db,
                ProcessingStatus.COMPLETED,
                processor_msg="处理完成",
            )
            return document

        except Exception as e:
            logger.error(f"处理文档失败: {str(e)}")
            logger.error(traceback.format_exc())
            self._update_document_status(
                document,
                db,
                ProcessingStatus.FAILED,
                error_message=str(e),
            )
            raise
        finally:
            db.close()

    def _process_queue(self):
        """守护线程：持续处理队列中的任务."""
        asyncio.set_event_loop(self.forever_loop)
        self.forever_loop.run_forever()

    def shutdown(self):
        """关闭流水线."""
        self.is_running = False
        self.thread_pool.shutdown(wait=True)
        self.daemon_thread.join(timeout=5)
        logger.info("Document Pipeline shutdown complete")

    async def stage_1(self, document: Document, db: Session) -> Document:
        """预处理阶段：将文档转换为图片."""
        logger.info(f"开始预处理文档: {document.filename}")

        # 使用系统临时目录
        temp_dir = tempfile.gettempdir()
        temp_file = os.path.join(temp_dir, document.filename)
        logger.debug(f"使用临时文件路径: {temp_file}")

        with open(temp_file, "wb") as f:
            f.write(document.file_data)
        logger.debug(f"成功写入临时文件，大小: {len(document.file_data)} bytes")

        # 使用DocsIngester处理文档
        logger.debug(f"开始使用DocsIngester处理文档")
        ingester = DocsIngester()
        section = await ingester.process_document(temp_file, document.filename)
        # temp_file 存储到数据库
        with open(temp_file, "rb") as f:
            document.file_data = f.read()
            document.mime_type = "application/pdf"
            document.content_type = "application/pdf"
            document.file_size = len(document.file_data)
        logger.debug(f"DocsIngester处理完成，共 {len(section.pages)} 页")

        # 更新文档状态
        document.total_pages = len(section.pages)
        document.content_pages = {}  # 清空现有内容
        document.summary_pages = {}
        document.translation_pages = {}
        document.keywords_pages = {}

        # 生成缩略图
        document.thumbnail = self._generate_thumbnail(section.pages[0].file_path)

        # 保存图片数据到content_pages
        for i, page in enumerate(section.pages, 1):
            with open(page.file_path, "rb") as f:
                image_data = f.read()
            document.content_pages[str(i)] = {
                "type": "image",
                "data": image_data.hex(),  # 将二进制数据转换为hex字符串存储
            }

        db.commit()
        return document

    async def stage_2(self, document: Document, db: Session) -> Document:
        """文本提取阶段：将图片转换为文本."""
        logger.info(f"开始提取文档文本: {document.filename}")

        # 构建图片Section
        image_section = Section(
            title=document.filename,
            pages=[],
            file_type=FileType.IMAGE,
            filename=document.filename,
        )

        # 创建临时图片文件，使用系统临时目录
        temp_dir = tempfile.gettempdir()
        temp_files = []
        for page_num, page_data in document.content_pages.items():
            if page_data["type"] == "image":
                temp_file = os.path.join(temp_dir, f"page_{page_num}.png")
                with open(temp_file, "wb") as f:
                    f.write(bytes.fromhex(page_data["data"]))
                temp_files.append(temp_file)
                image_section.pages.append(Page(file_path=temp_file))

        try:
            # 解析图片
            user: User = document.owner
            logger.debug(f"开始处理图片，共 {len(image_section.pages)} 页")
            text_section = await parse_images(image_section, user)
            logger.debug(f"文本提取完成，结果页数: {len(text_section.pages)}")

            # 创建新的content_pages字典
            new_content_pages = {}

            # 更新文档内容
            for i, page in enumerate(text_section.pages):
                new_content_pages[str(i)] = page.content

            # 更新文档的content_pages
            document.content_pages = new_content_pages
            logger.debug(f"处理后的content_pages: {document.content_pages}")

            # 提交更改
            db.commit()
            logger.info(f"文本提取阶段完成，共处理 {len(new_content_pages)} 页")
            return document

        except Exception as e:
            logger.error(f"文本提取阶段失败: {str(e)}")
            logger.error(traceback.format_exc())
            raise

    async def stage_3(self, document: Document, db: Session) -> Document:
        """翻译阶段：将英文文本翻译为中文."""
        logger.info(f"开始翻译文档: {document.filename}")

        # 构建文本Section
        text_section = Section(
            title=document.filename,
            pages=[Page(content=page_data) for page_data in document.content_pages.values()],
            file_type=FileType.TEXT,
            filename=document.filename,
        )

        # 翻译文本
        user: User = document.owner
        translated_section = await translate_text(text_section, user)

        # 更新文档翻译
        new_translation_pages = {}
        for i, page in enumerate(translated_section.pages):
            new_translation_pages[str(i)] = page.content
        document.translation_pages = new_translation_pages

        db.commit()
        return document

    async def stage_4(self, document: Document, db: Session) -> Document:
        """保存阶段：将处理后的内容保存到知识库."""
        logger.info(f"开始保存文档到知识库: {document.filename}")
        if settings.GLOBAL_MODE == "public":
            namespace = "public"
        else:
            namespace = document.owner.email

        pg_docs_uri = (
            f"postgresql+asyncpg://"
            f"{settings.DATABASE_USER}:{settings.DATABASE_PASSWORD}"
            f"@{settings.DATABASE_HOST}:{settings.DATABASE_PORT}/{settings.RAG_DATABASE_NAME}"
        )
        pg_vector_uri = (
            f"postgresql+asyncpg://"
            f"{settings.DATABASE_USER}:{settings.DATABASE_PASSWORD}@"
            f"{settings.DATABASE_HOST}:{settings.DATABASE_PORT}/{settings.RAG_DATABASE_NAME}"
        )
        rag = KnowledgeBase(
            pg_docs_uri,
            pg_vector_uri,
            "public",
            namespace,
        )

        # 为每一页创建知识库条目
        await rag.upload_document(document)
        return document

    def _generate_thumbnail(self, file_path: str) -> bytes:
        """生成缩略图."""
        import io

        from PIL import Image

        # 打开图片
        with Image.open(file_path) as img:
            # 调整大小
            img.thumbnail((512, 512))
            # 转换为字节流
            thumb_io = io.BytesIO()
            img.save(thumb_io, format="JPEG")
            return thumb_io.getvalue()


def get_document_pipeline(request: Request) -> DocumentPipeline:
    """获取或创建DocumentPipeline实例 这是一个FastAPI依赖函数，用于管理DocumentPipeline的生命周期."""
    if not hasattr(request.app.state, "document_pipeline"):
        request.app.state.document_pipeline = DocumentPipeline()
    return request.app.state.document_pipeline
