import os
import shutil
import tempfile
import zipfile
from datetime import datetime
from io import BytesIO
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import Settings, get_settings
from database import Document, Folder, get_db
from models.users import User
from services.session import get_current_user

router = APIRouter(prefix="/folders", tags=["folders"])


class FileResponse(BaseModel):
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

    class Config:
        from_attributes = True


class FolderCreate(BaseModel):
    name: str
    parentId: Optional[str] = None


class FolderUpdate(BaseModel):
    name: str


class BatchDeleteRequest(BaseModel):
    folderIds: List[str]


@router.post("", response_model=FileResponse)
async def create_folder(
    folder_data: FolderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    if settings.GLOBAL_MODE == "public":
        base_query_folder = db.query(Folder)
    else:
        base_query_folder = db.query(Folder).filter(Folder.owner_id == current_user.id)
    # 构建文件夹路径
    if folder_data.parentId:
        parent = base_query_folder.filter(
            Folder.id == int(folder_data.parentId)
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="父文件夹不存在")
        path = os.path.join(parent.path, folder_data.name)
    else:
        path = f"/{folder_data.name}"

    # 检查路径是否已存在
    existing = base_query_folder.filter(Folder.path == path).first()
    if existing:
        raise HTTPException(status_code=400, detail="该路径已存在")

    # 创建文件夹
    folder = Folder(
        name=folder_data.name,
        path=path,
        parent_id=int(folder_data.parentId) if folder_data.parentId else None,
        owner_id=current_user.id,
        is_folder=True,
    )

    db.add(folder)
    db.commit()
    db.refresh(folder)

    return FileResponse(
        id=str(folder.id),
        name=folder.name,
        type="folder",
        size=0,
        lastModified=folder.updated_at,
        owner=str(db.query(User).filter(User.id == folder.owner_id).first().username),
        parentId=str(folder.parent_id) if folder.parent_id else None,
        path=folder.path,
        isFolder=True,
        mimeType=None,
    )


@router.get("", response_model=List[FileResponse])
async def list_folders(
    parentId: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    if settings.GLOBAL_MODE == "public":
        base_query_folder = db.query(Folder)
    else:
        base_query_folder = db.query(Folder).filter(Folder.owner_id == current_user.id)
    query = base_query_folder
    if parentId is not None:
        query = query.filter(Folder.parent_id == int(parentId))

    # 只返回当前用户的文件夹
    query = query.filter(Folder.parent_id.is_(None) if parentId is None else True)

    folders = query.all()
    return [
        FileResponse(
            id=str(folder.id),
            name=folder.name,
            type="folder",
            size=0,
            lastModified=folder.updated_at,
            owner=str(
                db.query(User).filter(User.id == folder.owner_id).first().username
            ),
            parentId=str(folder.parent_id) if folder.parent_id else None,
            path=folder.path,
            isFolder=True,
            mimeType=None,
        )
        for folder in folders
    ]


@router.get("/tree")
async def get_folder_tree(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    if settings.GLOBAL_MODE == "public":
        base_query_folder = db.query(Folder)
    else:
        base_query_folder = db.query(Folder).filter(Folder.owner_id == current_user.id)
    # 获取所有文件夹
    folders = base_query_folder.all()

    # 构建树结构
    def build_tree(parent_id: Optional[int] = None):
        children = [f for f in folders if f.parent_id == parent_id]
        return [
            {
                "id": str(folder.id),
                "name": folder.name,
                "path": folder.path,
                "children": build_tree(folder.id),
            }
            for folder in children
        ]

    return build_tree(None)


@router.put("/{folderId}", response_model=FileResponse)
async def update_folder(
    folderId: str,
    folder_data: FolderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    if settings.GLOBAL_MODE == "public":
        base_query_folder = db.query(Folder)
    else:
        base_query_folder = db.query(Folder).filter(Folder.owner_id == current_user.id)
    folder = base_query_folder.filter(Folder.id == int(folderId)).first()
    if not folder:
        raise HTTPException(status_code=404, detail="文件夹不存在")

    # 更新文件夹名称和路径
    old_path = folder.path
    new_path = os.path.join(os.path.dirname(old_path), folder_data.name)

    # 检查新路径是否已存在
    existing = base_query_folder.filter(Folder.path == new_path).first()
    if existing and existing.id != int(folderId):
        raise HTTPException(status_code=400, detail="该路径已存在")

    # 更新当前文件夹及其子文件夹的路径
    folder.name = folder_data.name
    folder.path = new_path

    # 更新子文件夹路径
    for subfolder in base_query_folder.filter(Folder.path.startswith(old_path + "/")):
        subfolder.path = subfolder.path.replace(old_path, new_path, 1)

    db.commit()
    db.refresh(folder)

    return FileResponse(
        id=str(folder.id),
        name=folder.name,
        type="folder",
        size=0,
        lastModified=folder.updated_at,
        owner=str(db.query(User).filter(User.id == folder.owner_id).first().username),
        parentId=str(folder.parent_id) if folder.parent_id else None,
        path=folder.path,
        isFolder=True,
        mimeType=None,
    )


@router.delete("/{folderId}")
async def delete_folder(
    folderId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    if settings.GLOBAL_MODE == "public":
        base_query_folder = db.query(Folder)
        base_query_document = db.query(Document)
    else:
        base_query_folder = db.query(Folder).filter(Folder.owner_id == current_user.id)
        base_query_document = db.query(Document).filter(
            Document.owner_id == current_user.id
        )
    if current_user.id in [1, 2]:
        base_query_folder = db.query(Folder)
        base_query_document = db.query(Document)
    folder = base_query_folder.filter(Folder.id == int(folderId)).first()
    if not folder:
        raise HTTPException(status_code=404, detail="文件夹不存在")

    # 检查是否有子文件夹
    if base_query_folder.filter(Folder.parent_id == int(folderId)).first():
        raise HTTPException(status_code=400, detail="文件夹不为空，请先删除子文件夹")

    # 检查是否有文档
    if base_query_document.filter(Document.folder_id == int(folderId)).first():
        raise HTTPException(status_code=400, detail="文件夹不为空，请先删除文档")

    db.delete(folder)
    db.commit()
    return {"message": "文件夹已删除"}


@router.post("/batch-delete")
async def batch_delete_folders(
    request: BatchDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    if settings.GLOBAL_MODE == "public":
        base_query_folder = db.query(Folder)
        base_query_document = db.query(Document)
    else:
        base_query_folder = db.query(Folder).filter(Folder.owner_id == current_user.id)
        base_query_document = db.query(Document).filter(
            Document.owner_id == current_user.id
        )
    if current_user.id in [1, 2]:
        base_query_folder = db.query(Folder)
        base_query_document = db.query(Document)
    folder_ids = []
    for folderId in request.folderIds:
        folder = base_query_folder.filter(Folder.id == int(folderId)).first()
        if not folder:
            raise HTTPException(status_code=404, detail="文件夹不存在")
        folder_ids.append(folder.id)

    # 先删除文件夹下的所有文档
    base_query_document.filter(Document.folder_id.in_(folder_ids)).delete(
        synchronize_session=False
    )
    # 然后删除文件夹
    base_query_folder.filter(Folder.id.in_(folder_ids)).delete(
        synchronize_session=False
    )
    db.commit()
    return {"message": "文件夹已删除"}


@router.get("/{folderId}", response_model=FileResponse)
async def get_folder(
    folderId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    if settings.GLOBAL_MODE == "public":
        base_query_folder = db.query(Folder)
    else:
        base_query_folder = db.query(Folder).filter(Folder.owner_id == current_user.id)
    folder = base_query_folder.filter(Folder.id == int(folderId)).first()
    if not folder:
        raise HTTPException(status_code=404, detail="文件夹不存在")

    return FileResponse(
        id=str(folder.id),
        name=folder.name,
        type="folder",
        size=0,
        lastModified=folder.updated_at,
        owner=str(db.query(User).filter(User.id == folder.owner_id).first().username),
        parentId=str(folder.parent_id) if folder.parent_id else None,
        path=folder.path,
        isFolder=True,
        mimeType=None,
    )


@router.get("/{folderId}/download")
async def download_folder(
    folderId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    if settings.GLOBAL_MODE == "public":
        base_query_folder = db.query(Folder)
        base_query_document = db.query(Document)
    else:
        base_query_folder = db.query(Folder).filter(Folder.owner_id == current_user.id)
        base_query_document = db.query(Document).filter(
            Document.owner_id == current_user.id
        )
    folder = base_query_folder.filter(Folder.id == int(folderId)).first()
    if not folder:
        raise HTTPException(status_code=404, detail="文件夹不存在")
    # 获取文件夹下的所有文件
    files: List[Document] = base_query_document.filter(
        Document.folder_id == int(folderId)
    ).all()

    tmp_folder = tempfile.mkdtemp()
    for file in files:
        file_path = os.path.join(tmp_folder, file.filename)
        with open(file_path, "wb") as f:
            f.write(file.file_data)
    # 将文件夹和文件打包成zip
    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zip_file:
        for file in files:
            zip_file.write(f"{tmp_folder}/{file.filename}", file.filename)
    zip_buffer.seek(0)
    # 删除临时文件夹
    shutil.rmtree(tmp_folder)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename={folder.name}.zip",
            "Content-Length": str(zip_buffer.getbuffer().nbytes),
            "Access-Control-Expose-Headers": "Content-Disposition",  # 允许前端访问此头
        },
    )
