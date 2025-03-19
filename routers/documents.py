"""文档相关的路由处理模块。

这个模块包含了所有与文档相关的路由处理器，包括文档上传、下载、预览、处理状态查询等功能。 支持文件夹管理、批量操作和笔记功能。
"""

import mimetypes
import os
import urllib.parse
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import Settings, get_settings
from database import (
    Conversation,
    Document,
    DocumentReadRecord,
    Folder,
    Note,
    ProcessingRecord,
    ProcessingStatus,
    QuizHistory,
    get_db,
)
from models.users import User
from pipeline.document_pipeline import DocumentPipeline, get_document_pipeline
from services.session import get_current_user

router = APIRouter(prefix="/documents", tags=["documents"])


class FileResponse(BaseModel):
    """文件响应模型。

    包含文件的基本信息和元数据。
    """

    id: str
    name: str
    type: str
    size: int
    lastModified: datetime
    owner: str
    parentId: Optional[str]
    path: Optional[str] = None
    isFolder: bool
    mimeType: Optional[str]
    processingStatus: Optional[str] = None
    errorMessage: Optional[str] = None

    class Config:
        """模型配置类。

        设置模型的行为和验证规则。
        """

        from_attributes = True


class MoveFileRequest(BaseModel):
    """移动文件请求模型。

    包含文件移动操作所需的参数。
    """

    sourceId: str
    targetFolderId: Optional[str]


class RenameFileRequest(BaseModel):
    """重命名文件请求模型。

    包含文件重命名操作所需的参数。
    """

    newName: str


class BatchDeleteRequest(BaseModel):
    """批量删除请求模型。

    包含批量删除操作所需的文件ID列表。
    """

    fileIds: List[str]


class BatchMoveRequest(BaseModel):
    """批量移动请求模型。

    包含批量移动操作所需的文件和文件夹ID列表。
    """

    fileIds: List[str]
    folderIds: List[str]
    targetFolderId: Optional[str]


class DocumentSummaryResponse(BaseModel):
    """文档摘要响应模型。

    包含文档摘要信息和总页数。
    """

    summaries: Dict[str, Dict[str, str]]
    total_pages: int

    class Config:
        """模型配置类。

        设置模型的行为和验证规则。
        """

        from_attributes = True


class NoteCreate(BaseModel):
    """笔记创建请求模型。

    包含创建笔记所需的内容和高亮区域信息。
    """

    content: str
    quote: str
    highlight_areas: List[dict]


class NoteResponse(BaseModel):
    """笔记响应模型。

    包含笔记的完整信息。
    """

    id: str
    content: str
    quote: str
    highlight_areas: List[dict]
    created_at: datetime
    updated_at: datetime

    class Config:
        """模型配置类。

        设置模型的行为和验证规则。
        """

        from_attributes = True


class NoteUpdate(BaseModel):
    """笔记更新请求模型。

    包含更新笔记所需的字段。
    """

    content: str
    quote: str
    highlight_areas: List[dict]


class ThumbnailResponse(BaseModel):
    """缩略图响应模型。

    包含缩略图的二进制数据。
    """

    thumbnail: bytes


@router.post("/{documentId}/read")
async def record_read(
    documentId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """记录文档阅读记录。

    Args:
        documentId: 文档ID
        db: 数据库会话
        current_user: 当前用户

    Returns:
        dict: 操作结果信息
    """
    # 查找现有记录
    existing_record = (
        db.query(DocumentReadRecord)
        .filter(
            DocumentReadRecord.document_id == int(documentId),
            DocumentReadRecord.user_id == current_user.id,
        )
        .first()
    )

    if existing_record:
        # 更新现有记录的时间戳
        existing_record.read_at = datetime.now()
    else:
        # 创建新记录
        db.add(
            DocumentReadRecord(
                document_id=int(documentId),
                user_id=current_user.id,
            )
        )

    db.commit()
    return {"message": "阅读记录已保存"}


@router.get("/read-history")
async def get_read_history(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取用户的阅读历史记录。

    Args:
        skip: 跳过的记录数
        limit: 返回的最大记录数
        db: 数据库会话
        current_user: 当前用户

    Returns:
        dict: 阅读历史记录列表
    """
    """获取用户的阅读历史记录."""
    records = (
        db.query(DocumentReadRecord, Document)
        .join(Document, DocumentReadRecord.document_id == Document.id)
        .filter(DocumentReadRecord.user_id == current_user.id)
        .order_by(DocumentReadRecord.read_at.desc())
        .offset(skip)
        .limit(limit)
        .with_entities(
            DocumentReadRecord.id.label("record_id"),
            DocumentReadRecord.document_id,
            DocumentReadRecord.read_at,
            Document.filename,
            Document.mime_type,
            Document.file_size,
        )
        .all()
    )

    return {
        "records": [
            {
                "id": str(record.record_id),
                "document_id": str(record.document_id),
                "document_name": record.filename,
                "read_at": record.read_at,
                "document_type": record.mime_type,
                "document_size": record.file_size,
            }
            for record in records
        ]
    }


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    folderId: Optional[str] = Form(default=None),
    filename: Optional[str] = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    document_pipeline: DocumentPipeline = Depends(get_document_pipeline),
    settings: Settings = Depends(get_settings),
):
    """上传文件。

    Args:
        file: 上传的文件
        folderId: 目标文件夹ID
        filename: 自定义文件名
        db: 数据库会话
        current_user: 当前用户
        document_pipeline: 文档处理管道
        settings: 应用配置

    Returns:
        FileResponse: 上传的文件信息

    Raises:
        HTTPException: 当文件夹不存在时抛出404错误
    """
    if settings.GLOBAL_MODE == "public":
        base_query_folder = db.query(Folder)
    else:
        base_query_folder = db.query(Folder).filter(Folder.owner_id == current_user.id)
    # 验证文件夹
    folder_path = "/"
    if folderId:
        folder = base_query_folder.filter(Folder.id == int(folderId)).first()
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
        processing_status=ProcessingStatus.PENDING,  # 设置初始状态为待处理
    )

    db.add(db_document)
    db.commit()
    db.refresh(db_document)

    # 直接添加到处理队列
    document_pipeline.add_task(db_document.id)

    return FileResponse(
        id=str(db_document.id),
        name=db_document.filename,
        type=db_document.content_type,
        size=db_document.file_size,
        lastModified=db_document.updated_at,
        owner=str(db.query(User).filter(User.id == db_document.owner_id).first().username),
        parentId=(str(db_document.folder_id) if db_document.folder_id else None),
        path=db_document.path,
        isFolder=False,
        mimeType=db_document.content_type,
        processingStatus=db_document.processing_status,
    )


@router.get("", response_model=List[FileResponse])
async def list_files(
    parentId: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    document_pipeline: DocumentPipeline = Depends(get_document_pipeline),
    settings: Settings = Depends(get_settings),
):
    """获取文件列表。

    Args:
        parentId: 父文件夹ID
        db: 数据库会话
        current_user: 当前用户
        document_pipeline: 文档处理管道
        settings: 应用配置

    Returns:
        List[FileResponse]: 文件列表
    """
    if settings.GLOBAL_MODE == "public":
        base_query = db.query(Document)
    else:
        base_query = db.query(Document).filter(Document.owner_id == current_user.id)
    if parentId is not None:
        query = base_query.filter(Document.folder_id == int(parentId)).with_entities(
            Document.id,
            Document.filename,
            Document.content_type,
            Document.file_size,
            Document.updated_at,
            Document.owner_id,
            Document.folder_id,
            Document.path,
            Document.mime_type,
            Document.processing_status,
            Document.error_message,
        )
    else:
        # 只返回当前用户的文档
        query = base_query.filter(
            (Document.folder_id.is_(None) if parentId is None else True),
        ).with_entities(
            Document.id,
            Document.filename,
            Document.content_type,
            Document.file_size,
            Document.updated_at,
            Document.owner_id,
            Document.folder_id,
            Document.path,
            Document.mime_type,
            Document.processing_status,
            Document.error_message,
        )

    documents: List[Document] = query.all()
    return [
        FileResponse(
            id=str(doc.id),
            name=doc.filename,
            type=doc.content_type,
            size=doc.file_size,
            lastModified=doc.updated_at,
            owner=str(db.query(User).filter(User.id == doc.owner_id).first().username),
            parentId=str(doc.folder_id) if doc.folder_id else None,
            path=doc.path,
            isFolder=False,
            mimeType=doc.content_type,
            processingStatus=doc.processing_status,
            errorMessage=doc.error_message,
        )
        for doc in documents
    ]


@router.get("/{fileId}/processing-status")
async def get_processing_status(
    fileId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """获取文件处理状态。

    Args:
        fileId: 文件ID
        db: 数据库会话
        current_user: 当前用户
        settings: 应用配置

    Returns:
        dict: 处理状态信息

    Raises:
        HTTPException: 当文档不存在时抛出404错误
    """
    if settings.GLOBAL_MODE == "public":
        base_query = db.query(Document)
    else:
        base_query = db.query(Document).filter(Document.owner_id == current_user.id)
    document = (
        base_query.filter(Document.id == int(fileId))
        .with_entities(
            Document.processing_status,
            Document.processor,
            Document.error_message,
        )
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="文档未找到")

    return {
        "processing_status": document.processing_status,
        "error_message": (
            document.processor if not document.processing_status == ProcessingStatus.FAILED else document.error_message
        ),
    }


@router.get("/{fileId}", response_model=FileResponse)
async def get_file_details(
    fileId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """获取文件详细信息。

    Args:
        fileId: 文件ID
        db: 数据库会话
        current_user: 当前用户
        settings: 应用配置

    Returns:
        FileResponse: 文件详细信息

    Raises:
        HTTPException: 当文档不存在时抛出404错误
    """
    if settings.GLOBAL_MODE == "public":
        base_query = db.query(Document)
    else:
        base_query = db.query(Document).filter(Document.owner_id == current_user.id)
    document = base_query.filter(Document.id == int(fileId)).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档未找到")

    return FileResponse(
        id=str(document.id),
        name=document.filename,
        type=document.content_type,
        size=document.file_size,
        lastModified=document.updated_at,
        ownerId=str(document.owner_id),
        parentId=(str(document.folder_id) if document.folder_id else None),
        path=document.path,
        isFolder=False,
        mimeType=document.content_type,
    )


@router.get("/{fileId}/download")
async def download_file(
    fileId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """下载文件。

    Args:
        fileId: 文件ID
        db: 数据库会话
        current_user: 当前用户
        settings: 应用配置

    Returns:
        Response: 文件下载响应

    Raises:
        HTTPException: 当文档不存在时抛出404错误
    """
    if settings.GLOBAL_MODE == "public":
        base_query = db.query(Document)
    else:
        base_query = db.query(Document).filter(Document.owner_id == current_user.id)
    document = base_query.filter(Document.id == int(fileId)).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档未找到")

    # 获取文件的 MIME 类型
    mime_type = document.mime_type or mimetypes.guess_type(document.filename)[0] or "application/octet-stream"

    # 处理文件名编码
    filename = document.filename
    # 使用 RFC 2231/5987 编码方式
    encoded_filename = urllib.parse.quote(filename)

    # 设置多种格式的文件名，以确保最大兼容性
    content_disposition = (
        f"attachment; "
        f'filename="{encoded_filename}"; '  # 普通格式
        f"filename*=UTF-8''{encoded_filename}"  # RFC 5987 格式
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
    settings: Settings = Depends(get_settings),
):
    """获取文件预览URL。

    Args:
        fileId: 文件ID
        db: 数据库会话
        current_user: 当前用户
        settings: 应用配置

    Returns:
        dict: 预览URL信息

    Raises:
        HTTPException: 当文档不存在时抛出404错误
    """
    if settings.GLOBAL_MODE == "public":
        base_query = db.query(Document)
    else:
        base_query = db.query(Document).filter(Document.owner_id == current_user.id)
    document = base_query.filter(Document.id == int(fileId)).first()
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
    settings: Settings = Depends(get_settings),
):
    """删除文件。

    Args:
        fileId: 文件ID
        db: 数据库会话
        current_user: 当前用户
        settings: 应用配置

    Returns:
        dict: 删除结果信息

    Raises:
        HTTPException: 当文档不存在时抛出404错误
    """
    if current_user.id in [1, 2]:
        base_query = db.query(Document)
    else:
        base_query = db.query(Document).filter(Document.owner_id == current_user.id)
    document = base_query.filter(Document.id == int(fileId)).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档未找到")
    processing_record = db.query(ProcessingRecord).filter(ProcessingRecord.document_id == int(fileId)).first()
    if processing_record:
        db.delete(processing_record)

    conversation = db.query(Conversation).filter(Conversation.documents.any(Document.id == int(fileId))).all()
    for c in conversation:
        db.delete(c)

    note = db.query(Note).filter(Note.document_id == int(fileId)).all()
    for n in note:
        db.delete(n)

    quiz_history = db.query(QuizHistory).filter(QuizHistory.document_id == int(fileId)).all()
    for q in quiz_history:
        db.delete(q)

    db.delete(document)
    db.commit()
    return {"message": "文件已删除"}


@router.put("/{fileId}/rename")
async def rename_file(
    fileId: str,
    request: RenameFileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """重命名文件。

    Args:
        fileId: 文件ID
        request: 重命名请求数据
        db: 数据库会话
        current_user: 当前用户
        settings: 应用配置

    Returns:
        FileResponse: 更新后的文件信息

    Raises:
        HTTPException: 当文档不存在时抛出404错误
    """
    if settings.GLOBAL_MODE == "public":
        base_query = db.query(Document)
    else:
        base_query = db.query(Document).filter(Document.owner_id == current_user.id)
    if current_user.id in [1, 2]:
        base_query = db.query(Document)
    document = base_query.filter(Document.id == int(fileId)).first()
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
        owner=str(db.query(User).filter(User.id == document.owner_id).first().username),
        parentId=(str(document.folder_id) if document.folder_id else None),
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
    settings: Settings = Depends(get_settings),
):
    """移动文件。

    Args:
        fileId: 文件ID
        request: 移动请求数据
        db: 数据库会话
        current_user: 当前用户
        settings: 应用配置

    Returns:
        FileResponse: 更新后的文件信息

    Raises:
        HTTPException: 当文档或目标文件夹不存在时抛出404错误
    """
    if settings.GLOBAL_MODE == "public":
        base_query = db.query(Document)
        base_query_folder = db.query(Folder)
    else:
        base_query = db.query(Document).filter(Document.owner_id == current_user.id)
        base_query_folder = db.query(Folder).filter(Folder.owner_id == current_user.id)
    document = base_query.filter(Document.id == int(fileId)).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档未找到")

    if request.targetFolderId:
        folder = base_query_folder.filter(Folder.id == int(request.targetFolderId)).first()
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
        owner=str(db.query(User).filter(User.id == document.owner_id).first().username),
        parentId=(str(document.folder_id) if document.folder_id else None),
        path=document.path,
        isFolder=False,
        mimeType=document.content_type,
    )


@router.post("/batch-delete")
async def batch_delete_files(
    request: BatchDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """批量删除文件。

    Args:
        request: 批量删除请求数据
        db: 数据库会话
        current_user: 当前用户
        settings: 应用配置

    Returns:
        dict: 删除结果信息
    """
    if current_user.id in [1, 2]:
        base_query = db.query(Document)
    else:
        base_query = db.query(Document).filter(Document.owner_id == current_user.id)
    file_ids = []
    for file_id in request.fileIds:
        document = base_query.filter(Document.id == int(file_id)).with_entities(Document.id).first()
        if document:
            file_ids.append(document.id)

    # 先删除相关的处理记录
    db.query(ProcessingRecord).filter(ProcessingRecord.document_id.in_(file_ids)).delete(synchronize_session=False)

    # 删除阅读记录
    db.query(DocumentReadRecord).filter(DocumentReadRecord.document_id.in_(file_ids)).delete(synchronize_session=False)

    # 删除会话文档关联记录
    conversations = db.query(Conversation).filter(Conversation.documents.any(Document.id.in_(file_ids))).all()
    for conversation in conversations:
        conversation.documents = [doc for doc in conversation.documents if doc.id not in file_ids]
    db.commit()

    # 删除笔记
    db.query(Note).filter(Note.document_id.in_(file_ids)).delete(synchronize_session=False)

    # 删除笔记
    db.query(QuizHistory).filter(QuizHistory.document_id.in_(file_ids)).delete(synchronize_session=False)

    # 然后删除文档
    db.query(Document).filter(Document.id.in_(file_ids)).delete(synchronize_session=False)
    db.commit()
    return {"message": "文件已批量删除"}


@router.post("/batch-move")
async def batch_move_files(
    request: BatchMoveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """批量移动文件。

    Args:
        request: 批量移动请求数据
        db: 数据库会话
        current_user: 当前用户
        settings: 应用配置

    Returns:
        dict: 移动结果信息

    Raises:
        HTTPException: 当目标文件夹不存在或移动操作无效时抛出错误
    """
    if settings.GLOBAL_MODE == "public":
        base_query_document = db.query(Document)
        base_query_folder = db.query(Folder)
    else:
        base_query_document = db.query(Document).filter(Document.owner_id == current_user.id)
        base_query_folder = db.query(Folder).filter(Folder.owner_id == current_user.id)
    if current_user.id in [1, 2]:
        base_query_document = db.query(Document)
        base_query_folder = db.query(Folder)
    if request.targetFolderId:
        folder = base_query_folder.filter(Folder.id == int(request.targetFolderId)).first()
        if not folder:
            raise HTTPException(status_code=404, detail="目标文件夹不存在")

    # 处理文件移动 - 使用update语句而不是修改查询结果对象
    for file_id in request.fileIds:
        base_query_document.filter(Document.id == int(file_id)).update(
            {"folder_id": int(request.targetFolderId) if request.targetFolderId else None}
        )

    # 处理文件夹移动
    for folder_id in request.folderIds:
        folder = base_query_folder.filter(Folder.id == int(folder_id)).first()
        if folder:
            # 不能移动到自己里面
            if folder.id == int(request.targetFolderId) if request.targetFolderId else False:
                raise HTTPException(status_code=400, detail="不能移动到自己里面")
            else:
                base_query_folder.filter(Folder.id == int(folder_id)).update(
                    {"parent_id": int(request.targetFolderId) if request.targetFolderId else None}
                )

    db.commit()
    return {"message": "文件已批量移动"}


@router.get("/{fileId}/summaries", response_model=DocumentSummaryResponse)
async def get_document_summaries(
    fileId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """获取文档摘要。

    Args:
        fileId: 文件ID
        db: 数据库会话
        current_user: 当前用户
        settings: 应用配置

    Returns:
        DocumentSummaryResponse: 文档摘要信息

    Raises:
        HTTPException: 当文档不存在或未处理完成时抛出错误
    """
    if settings.GLOBAL_MODE == "public":
        base_query_document = db.query(Document)
    else:
        base_query_document = db.query(Document).filter(Document.owner_id == current_user.id)
    document = (
        base_query_document.filter(Document.id == int(fileId))
        .with_entities(
            Document.content_pages,
            Document.translation_pages,
            Document.total_pages,
            Document.processing_status,
        )
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="文档未找到")

    # 检查文档是否已经处理完成
    if document.processing_status != ProcessingStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="文档尚未处理完成")

    # 构建摘要响应
    summaries = {}
    for i, content in document.content_pages.items():
        summaries[str(i)] = {
            "en": content,
            "cn": document.translation_pages[str(i)],
        }

    return DocumentSummaryResponse(
        summaries=summaries,
        total_pages=document.total_pages,
    )


@router.post("/{fileId}/retry-processing")
async def retry_processing(
    fileId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    document_pipeline: DocumentPipeline = Depends(get_document_pipeline),
):
    """重试处理失败的文件。

    Args:
        fileId: 文件ID
        db: 数据库会话
        current_user: 当前用户
        settings: 应用配置
        document_pipeline: 文档处理管道

    Returns:
        dict: 重试结果信息

    Raises:
        HTTPException: 当文档不存在或状态不是失败时抛出错误
    """
    if settings.GLOBAL_MODE == "public":
        base_query_document = db.query(Document)
    else:
        base_query_document = db.query(Document).filter(Document.owner_id == current_user.id)
    """重试处理失败的文件"""
    document = (
        base_query_document.filter(Document.id == int(fileId))
        .with_entities(Document.id, Document.processing_status)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="文档未找到")

    if document.processing_status != ProcessingStatus.FAILED:
        raise HTTPException(status_code=400, detail="只能重试处理失败的文件")

    # 直接执行更新
    base_query_document.filter(
        Document.id == int(fileId),
    ).update(
        {
            "processing_status": ProcessingStatus.PENDING,
            "error_message": None,
        }
    )
    db.commit()

    # 重新添加到处理队列
    document_pipeline.add_task(document.id)

    return {"message": "文件已重新加入处理队列"}


@router.post("/{documentId}/notes", response_model=NoteResponse)
async def create_note(
    documentId: str,
    note: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """创建新笔记."""
    if settings.GLOBAL_MODE == "public":
        base_query_document = db.query(Document)
    else:
        base_query_document = db.query(Document).filter(Document.owner_id == current_user.id)
    document = base_query_document.filter(Document.id == int(documentId)).with_entities(Document.id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档未找到")

    db_note = Note(
        content=note.content,
        quote=note.quote,
        highlight_areas=note.highlight_areas,
        document_id=int(documentId),
        user_id=current_user.id,
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)

    return NoteResponse(
        id=str(db_note.id),
        content=db_note.content,
        quote=db_note.quote,
        highlight_areas=db_note.highlight_areas,
        created_at=db_note.created_at,
        updated_at=db_note.updated_at,
    )


@router.get("/{documentId}/notes", response_model=List[NoteResponse])
async def get_document_notes(
    documentId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取文档的所有笔记."""
    notes = (
        db.query(Note)
        .filter(
            Note.document_id == int(documentId),
            Note.user_id == current_user.id,
        )
        .order_by(Note.created_at.desc())
        .all()
    )

    return [
        NoteResponse(
            id=str(note.id),
            content=note.content,
            quote=note.quote,
            highlight_areas=note.highlight_areas,
            created_at=note.created_at,
            updated_at=note.updated_at,
        )
        for note in notes
    ]


@router.delete("/{documentId}/notes/{noteId}")
async def delete_note(
    documentId: str,
    noteId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除笔记."""
    note = (
        db.query(Note)
        .filter(
            Note.id == int(noteId),
            Note.document_id == int(documentId),
            Note.user_id == current_user.id,
        )
        .with_entities(Note.id)
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="笔记未找到")

    db.query(Note).filter(Note.id == int(noteId)).delete(synchronize_session=False)
    db.commit()
    return {"message": "笔记已删除"}


@router.put("/{documentId}/notes/{noteId}", response_model=NoteResponse)
async def update_note(
    documentId: str,
    noteId: str,
    note: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新笔记."""
    db_note = (
        db.query(Note)
        .filter(
            Note.id == int(noteId),
            Note.document_id == int(documentId),
            Note.user_id == current_user.id,
        )
        .first()
    )
    if not db_note:
        raise HTTPException(status_code=404, detail="笔记未找到")

    # 更新笔记内容
    db_note.content = note.content
    db_note.quote = note.quote
    db_note.highlight_areas = note.highlight_areas
    db_note.updated_at = datetime.now()

    db.commit()
    db.refresh(db_note)

    return NoteResponse(
        id=str(db_note.id),
        content=db_note.content,
        quote=db_note.quote,
        highlight_areas=db_note.highlight_areas,
        created_at=db_note.created_at,
        updated_at=db_note.updated_at,
    )


@router.get("/{documentId}/thumbnail")
async def get_thumbnail(
    documentId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取文档缩略图."""
    document = db.query(Document).filter(Document.id == int(documentId)).with_entities(Document.thumbnail).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档未找到")
    if not document.thumbnail:
        raise HTTPException(status_code=404, detail="缩略图不存在")
    return Response(content=document.thumbnail, media_type="image/png")
