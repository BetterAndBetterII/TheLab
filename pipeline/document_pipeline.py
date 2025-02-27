import hashlib
import logging
import os
import queue
import shutil
import threading
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Dict, Optional

from api.models import (Collection, Document, ProcessingRecord, Project, Task,
                        TextSection)
from celery import Task
from django.conf import settings
from django.utils import timezone
from sqlalchemy.orm import Session

from database import Document, ProcessingStatus, SessionLocal
from prepdocs.config import FileType, Page, Section
from prepdocs.parse_images import parse_images
from prepdocs.parse_page import DocsIngester
from prepdocs.translate import translate_text
from rag.knowledgebase import KnowledgeBase

from .celery_app import celery_app

logger = logging.getLogger(__name__)


class DocumentPipeline:
    VERSION = "1.0.0"  # 处理器版本号

    def __init__(self, max_workers=3):
        self.task_queue = queue.Queue()
        self.thread_pool = ThreadPoolExecutor(max_workers=max_workers)
        self.is_running = True
        # 删除之前未完成的任务
        Task.objects.filter(status=Task.Status.PENDING).delete()
        # 启动守护线程处理任务
        self.daemon_thread = threading.Thread(target=self._process_queue, daemon=True)
        self.daemon_thread.start()

    def _calculate_file_hash(self, file_path: str) -> str:
        """计算文件的SHA256哈希值"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def _get_processing_config(self) -> Dict:
        """获取当前的处理配置"""
        return {
            "version": self.VERSION,
            "max_workers": self.thread_pool._max_workers,
            "timestamp": datetime.now().isoformat(),
        }

    def _should_process_document(self, file_path: str, force: bool = False) -> bool:
        """
        检查文档是否需要处理
        :param file_path: 文件路径
        :param force: 是否强制处理
        :return: 是否需要处理
        """
        if force:
            return True

        file_hash = self._calculate_file_hash(file_path)
        # 检查是否存在相同哈希值的处理记录
        existing_record = ProcessingRecord.objects.filter(
            file_hash=file_hash, processor_version=self.VERSION
        ).first()

        return existing_record is None

    def add_task(
        self,
        title: str,
        file_path: str,
        collection_id: int,
        force: bool = False,
    ) -> int:
        """
        添加新任务到流水线
        :param title: 文档标题
        :param file_path: 文件路径
        :param collection_id: 集合ID
        :param force: 是否强制处理
        :return: 任务ID
        """
        # 检查是否需要处理
        if not self._should_process_document(file_path, force):
            logger.info(f"文档 {title} 已经处理过，跳过处理")
            return None

        task = Task.objects.create(
            title=title,
            file_path=file_path,
            status=Task.Status.PENDING,
            collection_id=collection_id,
        )
        self.task_queue.put(task.id)
        return task.id

    def _create_processing_record(self, document: Document, file_path: str):
        """创建处理记录"""
        file_hash = self._calculate_file_hash(file_path)
        # 获取最新的处理记录版本号
        latest_record = (
            ProcessingRecord.objects.filter(document_id=document.id)
            .order_by("-version")
            .first()
        )

        version = (latest_record.version + 1) if latest_record else 1

        ProcessingRecord.objects.create(
            document=document,
            file_hash=file_hash,
            version=version,
            processor_version=self.VERSION,
            processing_config=self._get_processing_config(),
        )

    def _update_task_status(
        self,
        task: Task,
        status: str,
        progress: int = None,
        error_message: Optional[str] = None,
    ):
        """更新任务状态"""
        task.status = status
        task.updated_at = timezone.now()
        if progress is not None:
            task.progress = progress
        if error_message:
            task.error_message = error_message
        if status == Task.Status.COMPLETED:
            task.completed_at = timezone.now()
        task.save()

    def _process_document(self, task: Task):
        """处理单个文档的流水线逻辑"""
        try:
            # ------------------预处理阶段------------------
            self._update_task_status(task, Task.Status.PREPROCESSING, 25)
            image_section = self.stage_1(task.file_path, task.title)
            logger.debug(f"预处理阶段完成: {image_section}")

            # ------------------文本提取阶段------------------
            self._update_task_status(task, Task.Status.EXTRACTING, 50)
            english_section = self.stage_2(image_section)
            logger.debug(f"文本提取阶段完成: {english_section}")

            # ------------------翻译阶段------------------
            self._update_task_status(task, Task.Status.TRANSLATING, 75)
            chinese_section = self.stage_3(english_section)
            logger.debug(f"翻译阶段完成: {chinese_section}")

            # ------------------保存阶段------------------
            document = self.stage_4(
                english_section,
                chinese_section,
                task.file_path,
                task,
                image_section,
            )

            # 创建处理记录
            self._create_processing_record(document, task.file_path)

            # 完成
            self._update_task_status(task, Task.Status.COMPLETED, 100)
            return document

        except Exception as e:
            logger.error(f"处理文档失败: {str(e)}")
            self._update_task_status(task, Task.Status.FAILED, error_message=str(e))
            raise

    def _process_queue(self):
        """守护线程：持续处理队列中的任务"""
        while self.is_running:
            try:
                task_id = self.task_queue.get(timeout=1)  # 1秒超时
                task = Task.objects.get(id=task_id)
                self.thread_pool.submit(self._process_document, task)
            except queue.Empty:
                continue  # 队列为空，继续等待
            except Exception as e:
                print(f"Error processing task: {str(e)}")
                continue

    def shutdown(self):
        """关闭流水线"""
        self.is_running = False
        self.thread_pool.shutdown(wait=True)
        self.daemon_thread.join(timeout=5)
        print("Document Pipeline shutdown complete")

    # 具体实现
    def stage_1(self, file_path: str, title: str) -> Section:
        """
        预处理阶段，将文档转换为图片，或文本
        """
        logger.debug(f"Processing {file_path} with title {title}")
        ingester = DocsIngester()
        return ingester.process_document(file_path, title)

    def stage_2(self, section: Section):
        """
        文本提取阶段，将图片转换为文本：使用ClientPool来调用GeminiClient的chat_with_image方法
        """
        logger.debug(f"Processing {section} with title {section.title}")
        return parse_images(section)

    def stage_3(self, section: Section):
        """
        翻译阶段，将文本翻译为中文
        """
        logger.debug(f"Translating {section} with title {section.title}")
        return translate_text(section, "Simplified Chinese")

    async def stage_4(
        self,
        english_section: Section,
        chinese_section: Section,
        original_file_path: str,
        task: Task,
        image_section: Section,
    ):
        """
        保存阶段，将文本保存到数据库
        """
        logger.debug(f"Saving {english_section} with title {english_section.title}")
        # 保存文档到persist目录
        persist_dir = settings.PERSIST_DIR
        persist_dir.mkdir(parents=True, exist_ok=True)
        # 生成唯一id
        document_id = str(uuid.uuid4())
        os.makedirs(persist_dir / document_id, exist_ok=True)
        os.makedirs(persist_dir / document_id / "en", exist_ok=True)
        os.makedirs(persist_dir / document_id / "zh", exist_ok=True)
        # 使用 shutil.move 替代 os.rename
        persist_file_path = persist_dir / document_id / task.title
        shutil.move(original_file_path, persist_file_path)
        # 保存缩略图
        shutil.move(
            image_section.pages[0].file_path,
            persist_dir / document_id / "thumbnail.png",
        )
        for i, page in enumerate(english_section.pages):
            english_file_path = (
                persist_dir / document_id / "en" / f"{document_id}_index_{i}.md"
            )
            with open(english_file_path, "w", encoding="utf-8") as f:
                f.write(page.content)
        for i, page in enumerate(chinese_section.pages):
            chinese_file_path = (
                persist_dir / document_id / "zh" / f"{document_id}_index_{i}.md"
            )
            with open(chinese_file_path, "w", encoding="utf-8") as f:
                f.write(page.content)
        # ------------------保存到数据库------------------
        document = Document.objects.create(
            title=english_section.title,
            linked_file_path=persist_dir / document_id,
            linked_task=task,
        )
        logger.debug(f"Creating document {document} with title {document.title}")
        english_text_section = TextSection.objects.create(
            title=english_section.title,
            section=english_section.to_dict(),
            linked_file_path=persist_file_path,
        )
        chinese_text_section = TextSection.objects.create(
            title=chinese_section.title,
            section=chinese_section.to_dict(),
            linked_file_path=persist_file_path,
        )
        document.english_sections.add(english_text_section)
        document.chinese_sections.add(chinese_text_section)
        document.save()

        # 链接项目和集合
        collection = Collection.objects.get(id=task.collection_id)
        collection.documents.add(document)

        logger.debug(f"Document {document} with title {document.title} created")
        return document


class DatabaseTask(Task):
    _db = None
    _rag = None

    @property
    def db(self) -> Session:
        if self._db is None:
            self._db = SessionLocal()
        return self._db

    @property
    def rag(self) -> KnowledgeBase:
        if self._rag is None:
            self._rag = KnowledgeBase()
        return self._rag

    def after_return(self, *args, **kwargs):
        if self._db is not None:
            self._db.close()


@celery_app.task(base=DatabaseTask, bind=True)
async def process_document(self, document_id: int) -> dict:
    """处理单个文档"""
    try:
        # 获取文档
        document = self.db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise ValueError(f"文档不存在: {document_id}")

        # 更新处理状态
        document.processing_status = ProcessingStatus.PROCESSING
        document.processor = "document_pipeline"
        self.db.commit()

        # 保存文件到临时目录
        temp_file_path = os.path.join("/tmp", document.filename)
        with open(temp_file_path, "wb") as f:
            f.write(document.file_data)

        try:
            # 阶段1：文档预处理（转换为图片）
            ingester = DocsIngester()
            document = stage_1(document, temp_file_path, ingester)
            self.db.commit()

            # 阶段2：图片转文本
            document = stage_2(document)
            self.db.commit()

            # 阶段3：翻译处理
            document = stage_3(document)
            self.db.commit()

            # 阶段4：保存到知识库
            document = await stage_4(document, self.rag)
            self.db.commit()

            # 更新处理状态
            document.processing_status = ProcessingStatus.COMPLETED
            document.processed_at = datetime.now(timezone.utc)
            self.db.commit()

            return {"status": "success", "document_id": document.id}

        finally:
            # 清理临时文件
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            ingester.cleanup()

    except Exception as e:
        logger.error(f"处理文档失败: {str(e)}")
        logger.error(traceback.format_exc())

        # 更新错误状态
        document.processing_status = ProcessingStatus.FAILED
        document.error_message = str(e)
        self.db.commit()

        return {"status": "error", "error": str(e)}


def stage_1(document: Document, file_path: str, ingester: DocsIngester) -> Document:
    """预处理阶段：将文档转换为图片"""
    logger.info(f"开始预处理文档: {document.filename}")

    # 使用DocsIngester处理文档
    section = ingester.process_document(file_path, document.filename)

    # 更新文档状态
    document.total_pages = len(section.pages)
    document.content_pages = {}  # 清空现有内容
    document.summary_pages = {}
    document.translation_pages = {}
    document.keywords_pages = {}

    # 保存图片路径到content_pages
    for i, page in enumerate(section.pages, 1):
        document.content_pages[str(i)] = {
            "type": "image",
            "path": page.file_path,
        }

    return document


def stage_2(document: Document) -> Document:
    """文本提取阶段：将图片转换为文本"""
    logger.info(f"开始提取文档文本: {document.filename}")

    # 构建图片Section
    image_section = Section(
        title=document.filename,
        pages=[
            Page(file_path=page_data["path"])
            for page_data in document.content_pages.values()
            if page_data["type"] == "image"
        ],
        file_type=FileType.IMAGE,
        filename=document.filename,
    )

    # 解析图片
    text_section = parse_images(image_section)

    # 更新文档内容
    for i, page in enumerate(text_section.pages, 1):
        if str(i) in document.content_pages:
            document.content_pages[str(i)] = {
                "type": "text",
                "content": page.content,
            }

    return document


def stage_3(document: Document) -> Document:
    """翻译阶段：将英文文本翻译为中文"""
    logger.info(f"开始翻译文档: {document.filename}")

    # 构建文本Section
    text_section = Section(
        title=document.filename,
        pages=[
            Page(content=page_data["content"])
            for page_data in document.content_pages.values()
            if page_data["type"] == "text"
        ],
        file_type=FileType.TEXT,
        filename=document.filename,
    )

    # 翻译文本
    translated_section = translate_text(text_section)

    # 更新文档翻译
    for i, page in enumerate(translated_section.pages, 1):
        document.translation_pages[str(i)] = page.content

    return document


async def stage_4(document: Document, rag: KnowledgeBase) -> Document:
    """保存阶段：将处理后的内容保存到知识库"""
    logger.info(f"开始保存文档到知识库: {document.filename}")

    # 为每一页创建知识库条目
    for page_num, content in document.content_pages.items():
        if content["type"] == "text":
            # 准备元数据
            metadata = {
                "document_id": document.id,
                "page": page_num,
                "filename": document.filename,
                "translation": document.translation_pages.get(page_num),
                "created_at": document.created_at.isoformat(),
                "updated_at": document.updated_at.isoformat(),
            }

            # 上传到知识库
            doc_id = f"doc_{document.id}_page_{page_num}"
            await rag.upload_text(content["content"], doc_id, metadata)

    return document


@celery_app.task(base=DatabaseTask, bind=True)
def process_pending_documents(self) -> dict:
    """处理所有待处理的文档"""
    try:
        # 获取所有待处理的文档
        pending_docs = (
            self.db.query(Document)
            .filter(Document.processing_status == ProcessingStatus.PENDING)
            .all()
        )

        processed_count = 0
        error_count = 0

        for doc in pending_docs:
            try:
                result = process_document.delay(doc.id)
                if result.get("status") == "success":
                    processed_count += 1
                else:
                    error_count += 1
            except Exception as e:
                logger.error(f"处理文档 {doc.id} 失败: {str(e)}")
                error_count += 1

        return {
            "status": "success",
            "processed": processed_count,
            "errors": error_count,
        }

    except Exception as e:
        logger.error(f"批量处理文档失败: {str(e)}")
        return {"status": "error", "error": str(e)}


@celery_app.task(base=DatabaseTask, bind=True)
async def sync_documents_to_rag(self) -> dict:
    """同步已完成的文档到知识库"""
    try:
        # 获取所有已完成的文档
        completed_docs = (
            self.db.query(Document)
            .filter(Document.processing_status == ProcessingStatus.COMPLETED)
            .all()
        )

        synced_count = 0
        error_count = 0

        for doc in completed_docs:
            try:
                # 同步到知识库
                await stage_4(doc, self.rag)
                synced_count += 1
            except Exception as e:
                logger.error(f"同步文档 {doc.id} 失败: {str(e)}")
                error_count += 1

        return {
            "status": "success",
            "synced": synced_count,
            "errors": error_count,
        }

    except Exception as e:
        logger.error(f"同步文档到知识库失败: {str(e)}")
        return {"status": "error", "error": str(e)}
