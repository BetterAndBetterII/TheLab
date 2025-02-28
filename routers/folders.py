import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

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
    ownerId: str
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
):
    # 构建文件夹路径
    if folder_data.parentId:
        parent = (
            db.query(Folder)
            .filter(
                Folder.id == int(folder_data.parentId),
                Folder.owner_id == current_user.id,
            )
            .first()
        )
        if not parent:
            raise HTTPException(status_code=404, detail="父文件夹不存在")
        path = os.path.join(parent.path, folder_data.name)
    else:
        path = f"/{folder_data.name}"

    # 检查路径是否已存在
    existing = (
        db.query(Folder)
        .filter(Folder.path == path, Folder.owner_id == current_user.id)
        .first()
    )
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
        ownerId=str(folder.owner_id),
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
):
    query = db.query(Folder)
    if parentId is not None:
        query = query.filter(Folder.parent_id == int(parentId))

    # 只返回当前用户的文件夹
    query = query.filter(
        Folder.owner_id == current_user.id,
        Folder.parent_id.is_(None) if parentId is None else True
    )

    folders = query.all()
    return [
        FileResponse(
            id=str(folder.id),
            name=folder.name,
            type="folder",
            size=0,
            lastModified=folder.updated_at,
            ownerId=str(folder.owner_id),
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
):
    # 获取所有文件夹
    folders = db.query(Folder).filter(Folder.owner_id == current_user.id).all()

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
):
    folder = (
        db.query(Folder)
        .filter(Folder.id == int(folderId), Folder.owner_id == current_user.id)
        .first()
    )
    if not folder:
        raise HTTPException(status_code=404, detail="文件夹不存在")

    # 更新文件夹名称和路径
    old_path = folder.path
    new_path = os.path.join(os.path.dirname(old_path), folder_data.name)

    # 检查新路径是否已存在
    existing = (
        db.query(Folder)
        .filter(Folder.path == new_path, Folder.owner_id == current_user.id)
        .first()
    )
    if existing and existing.id != int(folderId):
        raise HTTPException(status_code=400, detail="该路径已存在")

    # 更新当前文件夹及其子文件夹的路径
    folder.name = folder_data.name
    folder.path = new_path

    # 更新子文件夹路径
    for subfolder in db.query(Folder).filter(
        Folder.path.startswith(old_path + "/"), Folder.owner_id == current_user.id
    ):
        subfolder.path = subfolder.path.replace(old_path, new_path, 1)

    db.commit()
    db.refresh(folder)

    return FileResponse(
        id=str(folder.id),
        name=folder.name,
        type="folder",
        size=0,
        lastModified=folder.updated_at,
        ownerId=str(folder.owner_id),
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
):
    folder = (
        db.query(Folder)
        .filter(Folder.id == int(folderId), Folder.owner_id == current_user.id)
        .first()
    )
    if not folder:
        raise HTTPException(status_code=404, detail="文件夹不存在")

    # 检查是否有子文件夹
    if (
        db.query(Folder)
        .filter(Folder.parent_id == int(folderId), Folder.owner_id == current_user.id)
        .first()
    ):
        raise HTTPException(status_code=400, detail="文件夹不为空，请先删除子文件夹")

    # 检查是否有文档
    if (
        db.query(Document)
        .filter(
            Document.folder_id == int(folderId), Document.owner_id == current_user.id
        )
        .first()
    ):
        raise HTTPException(status_code=400, detail="文件夹不为空，请先删除文档")

    db.delete(folder)
    db.commit()
    return {"message": "文件夹已删除"}


@router.post("/batch-delete")
async def batch_delete_folders(
    request: BatchDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    folder_ids = []
    for folderId in request.folderIds:
        folder = (
            db.query(Folder)
            .filter(Folder.id == int(folderId), Folder.owner_id == current_user.id)
            .first()
        )
        if not folder:
            raise HTTPException(status_code=404, detail="文件夹不存在")
        folder_ids.append(folder.id)
    
    # 先删除文件夹下的所有文档
    db.query(Document).filter(Document.folder_id.in_(folder_ids)).delete(synchronize_session=False)
    # 然后删除文件夹
    db.query(Folder).filter(Folder.id.in_(folder_ids)).delete(synchronize_session=False)
    db.commit()
    return {"message": "文件夹已删除"}

@router.get("/{folderId}", response_model=FileResponse)
async def get_folder(
    folderId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    folder = (
        db.query(Folder)
        .filter(Folder.id == int(folderId), Folder.owner_id == current_user.id)
        .first()
    )
    if not folder:
        raise HTTPException(status_code=404, detail="文件夹不存在")

    return FileResponse(
        id=str(folder.id),
        name=folder.name,
        type="folder",
        size=0,
        lastModified=folder.updated_at,
        ownerId=str(folder.owner_id),
        parentId=str(folder.parent_id) if folder.parent_id else None,
        path=folder.path,
        isFolder=True,
        mimeType=None,
    )
