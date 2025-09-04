from typing import Iterable, List

from sqlalchemy import delete
from sqlalchemy.orm import Session

from database import (
    Document,
    DocumentReadRecord,
    Note,
    ProcessingRecord,
    QuizHistory,
    conversation_documents,
)


def delete_documents_by_ids(db: Session, document_ids: Iterable[int]) -> int:
    """按ID批量删除文档及其所有关联数据。

    删除顺序：
    - ProcessingRecord
    - DocumentReadRecord
    - Note
    - QuizHistory
    - conversation_documents（通过解除关系）
    - Document

    返回成功删除的文档数量。
    """
    ids: List[int] = list({int(i) for i in document_ids})
    if not ids:
        return 0

    # 直接删除会话-文档关联记录，避免外键约束问题
    db.execute(
        delete(conversation_documents).where(conversation_documents.c.document_id.in_(ids))
    )

    # 依赖表先删
    db.query(ProcessingRecord).filter(ProcessingRecord.document_id.in_(ids)).delete(synchronize_session=False)
    db.query(DocumentReadRecord).filter(DocumentReadRecord.document_id.in_(ids)).delete(synchronize_session=False)
    db.query(Note).filter(Note.document_id.in_(ids)).delete(synchronize_session=False)
    db.query(QuizHistory).filter(QuizHistory.document_id.in_(ids)).delete(synchronize_session=False)

    # 最后删文档本体
    deleted = db.query(Document).filter(Document.id.in_(ids)).delete(synchronize_session=False)

    return deleted


