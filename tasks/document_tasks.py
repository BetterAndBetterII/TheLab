import logging
import os
import traceback
from datetime import datetime, timezone
from typing import List, Optional

from celery import Task
from sqlalchemy.orm import Session

from database import Document, ProcessingStatus, SessionLocal
from rag.knowledgebase import KnowledgeBase

from .celery_app import celery_app

logger = logging.getLogger(__name__)


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
            PG_DOCS_URI = os.getenv("PG_DOCS_URI")
            PG_VECTOR_URI = os.getenv("PG_VECTOR_URI")
            self._rag = KnowledgeBase(
                pg_docs_uri=PG_DOCS_URI, pg_vector_uri=PG_VECTOR_URI
            )
        return self._rag

    def after_return(self, *args, **kwargs):
        if self._db is not None:
            self._db.close()
            self._db = None


@celery_app.task(base=DatabaseTask, bind=True)
def process_document(self, document_id: int) -> dict:
    """处理单个文档的任务"""
    try:
        # 获取文档
        document = self.db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise ValueError(f"文档不存在: {document_id}")

        # 更新处理状态
        document.processing_status = ProcessingStatus.PROCESSING
        document.processor = self.request.hostname
        self.db.commit()

        # TODO: 实现文档处理逻辑
        # 1. 提取文本
        # 2. 生成摘要
        # 3. 进行分类
        # 4. 更新文档属性

        # 更新处理状态为完成
        document.processing_status = ProcessingStatus.COMPLETED
        document.processed_at = datetime.now(timezone.utc)
        self.db.commit()

        return {
            "status": "success",
            "document_id": document_id,
            "message": "文档处理完成",
        }

    except Exception as e:
        # 记录错误并更新状态
        error_msg = f"处理文档 {document_id} 时出错: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)

        try:
            document = (
                self.db.query(Document).filter(Document.id == document_id).first()
            )
            if document:
                document.processing_status = ProcessingStatus.FAILED
                document.error_message = error_msg
                self.db.commit()
        except Exception as db_error:
            logger.error(f"更新文档状态时出错: {str(db_error)}")

        return {"status": "error", "document_id": document_id, "error": str(e)}


@celery_app.task(base=DatabaseTask, bind=True)
def process_pending_documents(self) -> dict:
    """定期处理待处理的文档"""
    try:
        # 获取所有待处理的文档
        pending_docs = (
            self.db.query(Document)
            .filter(Document.processing_status == ProcessingStatus.PENDING)
            .all()
        )

        # 为每个文档创建处理任务
        for doc in pending_docs:
            process_document.delay(doc.id)

        return {
            "status": "success",
            "message": f"已创建 {len(pending_docs)} 个文档处理任务",
        }

    except Exception as e:
        error_msg = f"处理待处理文档时出错: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        return {"status": "error", "error": str(e)}


@celery_app.task(base=DatabaseTask, bind=True)
async def sync_documents_to_rag(self) -> dict:
    """同步文档到知识库的定时任务"""
    try:
        # 获取所有已处理完成的文档
        documents = (
            self.db.query(Document)
            .filter(Document.processing_status == ProcessingStatus.COMPLETED)
            .all()
        )

        # 将文档转换为知识库需要的格式
        for doc in documents:
            try:
                # 生成文档ID
                doc_id = f"doc_{doc.id}"

                # 构建文档内容
                # 如果有摘要，将摘要和提取的文本组合
                content = ""
                if doc.summary:
                    content += f"摘要：\n{doc.summary}\n\n"
                if doc.extracted_text:
                    content += f"正文：\n{doc.extracted_text}"
                elif doc.translation:  # 如果没有提取文本但有翻译，使用翻译
                    content += f"翻译内容：\n{doc.translation}"

                if not content:
                    logger.warning(f"文档 {doc.id} 没有可用的文本内容")
                    continue

                # 构建元数据
                metadata = {
                    "source": "document",
                    "doc_id": doc.id,
                    "filename": doc.filename,
                    "content_type": doc.content_type,
                    "folder_id": doc.folder_id,
                    "created_at": doc.created_at.isoformat(),
                    "processed_at": (
                        doc.processed_at.isoformat() if doc.processed_at else None
                    ),
                }

                # 上传到知识库
                await self.rag.upload_text(
                    text=content, doc_id=doc_id, metadata=metadata
                )

                logger.info(f"文档 {doc.id} 已同步到知识库")

            except Exception as e:
                logger.error(f"同步文档 {doc.id} 时出错: {str(e)}")
                continue

        return {
            "status": "success",
            "message": f"成功同步 {len(documents)} 个文档到知识库",
        }

    except Exception as e:
        error_msg = f"同步文档到知识库时出错: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        return {"status": "error", "error": str(e)}
