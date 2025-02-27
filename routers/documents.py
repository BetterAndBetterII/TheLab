from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import Document, Folder, get_db

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    folder_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    # 验证文件夹
    if folder_id:
        folder = db.query(Folder).filter(Folder.id == folder_id).first()
        if not folder:
            raise HTTPException(status_code=404, detail="文件夹不存在")

    # 读取文件内容
    file_content = await file.read()

    # 创建新的文档记录
    db_document = Document(
        filename=file.filename,
        content_type=file.content_type,
        file_data=file_content,
        file_size=len(file_content),
        folder_id=folder_id,
        extracted_text="",
    )

    db.add(db_document)
    db.commit()
    db.refresh(db_document)

    return {
        "message": "文件上传成功",
        "document_id": db_document.id,
        "filename": db_document.filename,
        "folder_id": folder_id,
    }


@router.get("/{document_id}")
async def get_document(document_id: int, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档未找到")

    return {
        "id": document.id,
        "filename": document.filename,
        "extracted_text": document.extracted_text,
        "summary": document.summary,
        "translation": document.translation,
        "created_at": document.created_at,
        "updated_at": document.updated_at,
    }


@router.get("/")
async def list_documents(
    folder_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Document)
    if folder_id is not None:
        query = query.filter(Document.folder_id == folder_id)
    return query.all()
