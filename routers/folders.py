import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import Document, Folder, get_db

router = APIRouter(prefix="/folders", tags=["folders"])


class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None


class FolderUpdate(BaseModel):
    name: str


class FolderResponse(BaseModel):
    id: int
    name: str
    path: str
    parent_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


@router.post("", response_model=FolderResponse)
async def create_folder(
    folder_data: FolderCreate,
    db: Session = Depends(get_db),
):
    # 构建文件夹路径
    if folder_data.parent_id:
        parent = db.query(Folder).filter(Folder.id == folder_data.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="父文件夹不存在")
        path = os.path.join(parent.path, folder_data.name)
    else:
        path = f"/{folder_data.name}"

    # 检查路径是否已存在
    existing = db.query(Folder).filter(Folder.path == path).first()
    if existing:
        raise HTTPException(status_code=400, detail="该路径已存在")

    # 创建文件夹
    folder = Folder(name=folder_data.name, path=path, parent_id=folder_data.parent_id)

    db.add(folder)
    db.commit()
    db.refresh(folder)
    return folder


@router.get("", response_model=List[FolderResponse])
async def list_folders(
    parent_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Folder)
    if parent_id is not None:
        query = query.filter(Folder.parent_id == parent_id)
    return query.all()


@router.put("/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: int,
    folder_data: FolderUpdate,
    db: Session = Depends(get_db),
):
    folder = (
        db.query(Folder)
        .filter(
            Folder.id == folder_id,
        )
        .first()
    )
    if not folder:
        raise HTTPException(status_code=404, detail="文件夹不存在")

    # 更新文件夹名称和路径
    old_path = folder.path
    new_path = os.path.join(os.path.dirname(old_path), folder_data.name)

    # 检查新路径是否已存在
    existing = db.query(Folder).filter(Folder.path == new_path).first()
    if existing and existing.id != folder_id:
        raise HTTPException(status_code=400, detail="该路径已存在")

    # 更新当前文件夹及其子文件夹的路径
    folder.name = folder_data.name
    folder.path = new_path

    # 更新子文件夹路径
    for subfolder in db.query(Folder).filter(Folder.path.startswith(old_path + "/")):
        subfolder.path = subfolder.path.replace(old_path, new_path, 1)

    db.commit()
    db.refresh(folder)
    return folder


@router.delete("/{folder_id}")
async def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
):
    folder = (
        db.query(Folder)
        .filter(
            Folder.id == folder_id,
        )
        .first()
    )
    if not folder:
        raise HTTPException(status_code=404, detail="文件夹不存在")

    # 检查是否有子文件夹
    if db.query(Folder).filter(Folder.parent_id == folder_id).first():
        raise HTTPException(status_code=400, detail="文件夹不为空，请先删除子文件夹")

    # 检查是否有文档
    if db.query(Document).filter(Document.folder_id == folder_id).first():
        raise HTTPException(status_code=400, detail="文件夹不为空，请先删除文档")

    db.delete(folder)
    db.commit()
    return {"message": "文件夹已删除"}
