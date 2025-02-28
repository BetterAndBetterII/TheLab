from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
import os
import mimetypes
import urllib.parse

from database import Document, Folder, get_db
from models.users import User
from services.session import get_current_user

router = APIRouter(prefix="/documents", tags=["documents"])


class FileResponse(BaseModel):
    id: str
    name: str
    type: str
    size: int
    lastModified: datetime
    ownerId: str
    parentId: Optional[str]
    path: Optional[str] = None
    isFolder: bool
    mimeType: Optional[str]

    class Config:
        from_attributes = True


class MoveFileRequest(BaseModel):
    sourceId: str
    targetFolderId: Optional[str]


class RenameFileRequest(BaseModel):
    newName: str


class BatchDeleteRequest(BaseModel):
    fileIds: List[str]


class BatchMoveRequest(BaseModel):
    fileIds: List[str]
    folderIds: List[str]
    targetFolderId: Optional[str]


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    folderId: Optional[str] = Form(default=None),
    filename: Optional[str] = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 验证文件夹
    folder_path = "/"
    if folderId:
        folder = (
            db.query(Folder)
            .filter(Folder.id == int(folderId), Folder.owner_id == current_user.id)
            .first()
        )
        if not folder:
            raise HTTPException(status_code=404, detail="文件夹不存在")
        folder_path = folder.path

    # 读取文件内容
    file_content = await file.read()

    # 创建新的文档记录
    db_document = Document(
        filename=filename or file.filename,
        content_type=file.content_type,
        file_data=file_content,
        file_size=len(file_content),
        folder_id=int(folderId) if folderId else None,
        owner_id=current_user.id,  # 使用当前用户ID
        path=os.path.join(folder_path, file.filename),  # 构建完整路径
        is_folder=False,
        mime_type=file.content_type,
    )

    db.add(db_document)
    db.commit()
    db.refresh(db_document)

    return FileResponse(
        id=str(db_document.id),
        name=db_document.filename,
        type=db_document.content_type,
        size=db_document.file_size,
        lastModified=db_document.updated_at,
        ownerId=str(db_document.owner_id),
        parentId=str(db_document.folder_id) if db_document.folder_id else None,
        path=db_document.path,
        isFolder=False,
        mimeType=db_document.content_type,
    )


@router.get("", response_model=List[FileResponse])
async def list_files(
    parentId: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Document)
    if parentId is not None:
        query = query.filter(
            Document.folder_id == int(parentId), Document.owner_id == current_user.id
        ).with_entities(
            Document.id,
            Document.filename,
            Document.content_type,
            Document.file_size,
            Document.updated_at,
            Document.owner_id,
            Document.folder_id,
            Document.path,
        )

    # 只返回当前用户的文档
    query = query.filter(
        Document.owner_id == current_user.id,
        Document.folder_id.is_(None) if parentId is None else True,
    ).with_entities(
        Document.id,
        Document.filename,
        Document.content_type,
        Document.file_size,
        Document.updated_at,
        Document.owner_id,
        Document.folder_id,
        Document.path,
    )

    documents = query.all()
    return [
        FileResponse(
            id=str(doc.id),
            name=doc.filename,
            type=doc.content_type,
            size=doc.file_size,
            lastModified=doc.updated_at,
            ownerId=str(doc.owner_id),
            parentId=str(doc.folder_id) if doc.folder_id else None,
            path=doc.path,
            isFolder=False,
            mimeType=doc.content_type,
        )
        for doc in documents
    ]


@router.get("/{fileId}", response_model=FileResponse)
async def get_file_details(
    fileId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = (
        db.query(Document)
        .filter(Document.id == int(fileId), Document.owner_id == current_user.id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="文档未找到")

    return FileResponse(
        id=str(document.id),
        name=document.filename,
        type=document.content_type,
        size=document.file_size,
        lastModified=document.updated_at,
        ownerId=str(document.owner_id),
        parentId=str(document.folder_id) if document.folder_id else None,
        path=document.path,
        isFolder=False,
        mimeType=document.content_type,
    )


@router.get("/{fileId}/download")
async def download_file(
    fileId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = (
        db.query(Document)
        .filter(Document.id == int(fileId), Document.owner_id == current_user.id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="文档未找到")

    # 获取文件的 MIME 类型
    mime_type = (
        document.mime_type
        or mimetypes.guess_type(document.filename)[0]
        or "application/octet-stream"
    )

    # 处理文件名编码
    filename = document.filename
    # 使用 RFC 2231/5987 编码方式
    encoded_filename = urllib.parse.quote(filename)
    
    # 设置多种格式的文件名，以确保最大兼容性
    content_disposition = (
        f'attachment; '
        f'filename="{filename}"; '  # 普通格式
        f'filename*=UTF-8\'\'{encoded_filename}'  # RFC 5987 格式
    )

    # 创建响应
    response = Response(
        content=document.file_data,
        media_type=mime_type,
        headers={
            "Content-Disposition": content_disposition,
            "Content-Length": str(document.file_size),
            "Access-Control-Expose-Headers": "Content-Disposition",  # 允许前端访问此头
        },
    )

    return response


@router.get("/{fileId}/preview")
async def get_file_preview(
    fileId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = (
        db.query(Document)
        .filter(Document.id == int(fileId), Document.owner_id == current_user.id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="文档未找到")

    # 这里需要实现预览URL的生成逻辑
    preview_url = f"/api/documents/{fileId}/preview-content"
    return {"url": preview_url}


@router.delete("/{fileId}")
async def delete_file(
    fileId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = (
        db.query(Document)
        .filter(Document.id == int(fileId), Document.owner_id == current_user.id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="文档未找到")

    db.delete(document)
    db.commit()
    return {"message": "文件已删除"}


@router.put("/{fileId}/rename")
async def rename_file(
    fileId: str,
    request: RenameFileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = (
        db.query(Document)
        .filter(Document.id == int(fileId), Document.owner_id == current_user.id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="文档未找到")

    document.filename = request.newName
    document.path = f"/{request.newName}"  # 需要构建完整路径

    db.commit()
    db.refresh(document)

    return FileResponse(
        id=str(document.id),
        name=document.filename,
        type=document.content_type,
        size=document.file_size,
        lastModified=document.updated_at,
        ownerId=str(document.owner_id),
        parentId=str(document.folder_id) if document.folder_id else None,
        path=document.path,
        isFolder=False,
        mimeType=document.content_type,
    )


@router.put("/{fileId}/move")
async def move_file(
    fileId: str,
    request: MoveFileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = (
        db.query(Document)
        .filter(Document.id == int(fileId), Document.owner_id == current_user.id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="文档未找到")

    if request.targetFolderId:
        folder = (
            db.query(Folder)
            .filter(
                Folder.id == int(request.targetFolderId),
                Folder.owner_id == current_user.id,
            )
            .first()
        )
        if not folder:
            raise HTTPException(status_code=404, detail="目标文件夹不存在")
        document.folder_id = int(request.targetFolderId)
    else:
        document.folder_id = None

    db.commit()
    db.refresh(document)

    return FileResponse(
        id=str(document.id),
        name=document.filename,
        type=document.content_type,
        size=document.file_size,
        lastModified=document.updated_at,
        ownerId=str(document.owner_id),
        parentId=str(document.folder_id) if document.folder_id else None,
        path=document.path,
        isFolder=False,
        mimeType=document.content_type,
    )


@router.post("/batch-delete")
async def batch_delete_files(
    request: BatchDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    file_ids = []
    for file_id in request.fileIds:
        document = (
            db.query(Document)
            .filter(Document.id == int(file_id), Document.owner_id == current_user.id)
            .with_entities(Document.id)
            .first()
        )
        if document:
            file_ids.append(document.id)
    db.query(Document).filter(Document.id.in_(file_ids)).delete(
        synchronize_session=False
    )
    db.commit()
    return {"message": "文件已批量删除"}


@router.post("/batch-move")
async def batch_move_files(
    request: BatchMoveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if request.targetFolderId:
        folder = (
            db.query(Folder)
            .filter(
                Folder.id == int(request.targetFolderId),
                Folder.owner_id == current_user.id,
            )
            .first()
        )
        if not folder:
            raise HTTPException(status_code=404, detail="目标文件夹不存在")

    for file_id in request.fileIds:
        document = (
            db.query(Document)
            .filter(Document.id == int(file_id), Document.owner_id == current_user.id)
            .first()
        ).with_entities(Document.id, Document.folder_id)
        if document:
            document.folder_id = (
                int(request.targetFolderId) if request.targetFolderId else None
            )

    for folder_id in request.folderIds:
        folder = (
            db.query(Folder)
            .filter(Folder.id == int(folder_id), Folder.owner_id == current_user.id)
            .first()
        )

        if folder:
            # 不能自动到自己里面
            if folder.id != int(request.targetFolderId):
                folder.parent_id = (
                    int(request.targetFolderId) if request.targetFolderId else None
                )
            else:
                raise HTTPException(status_code=400, detail="不能移动到自己里面")

    db.commit()
    return {"message": "文件已批量移动"}
