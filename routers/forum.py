from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.forum import TopicCategory
from services.forum import ForumService
from services.session import get_current_user

router = APIRouter(prefix="/forum", tags=["forum"])


# 请求和响应模型
class TopicCreate(BaseModel):
    title: str
    content: str
    category: TopicCategory
    enable_agent: Optional[bool] = True


class TopicUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[TopicCategory] = None


class ReplyCreate(BaseModel):
    content: str
    parent_id: Optional[int] = None
    enable_agent: Optional[bool] = True


class ReplyResponse(BaseModel):
    id: int
    content: str
    topic_id: int
    user_id: Optional[int]
    parent_id: Optional[int]
    is_ai_generated: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class TopicResponse(BaseModel):
    id: int
    title: str
    content: str
    category: TopicCategory
    user_id: int
    views: int
    is_pinned: bool
    is_locked: bool
    created_at: datetime
    updated_at: datetime
    replies: List[ReplyResponse]

    class Config:
        orm_mode = True


# 路由处理函数
@router.post("/topics", response_model=TopicResponse)
async def create_topic(
    topic: TopicCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user),
):
    """创建新主题"""
    forum_service = ForumService(db)
    return forum_service.create_topic(
        user_id=current_user_id,
        title=topic.title,
        content=topic.content,
        category=topic.category,
    )


@router.get("/topics", response_model=List[TopicResponse])
async def list_topics(
    category: Optional[TopicCategory] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
):
    """获取主题列表"""
    forum_service = ForumService(db)
    return forum_service.list_topics(category, page, page_size)


@router.get("/topics/{topic_id}", response_model=TopicResponse)
async def get_topic(topic_id: int, db: Session = Depends(get_db)):
    """获取主题详情"""
    forum_service = ForumService(db)
    return forum_service.get_topic(topic_id)


@router.put("/topics/{topic_id}", response_model=TopicResponse)
async def update_topic(
    topic_id: int,
    topic_update: TopicUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user),
):
    """更新主题"""
    forum_service = ForumService(db)
    return forum_service.update_topic(
        topic_id=topic_id,
        user_id=current_user_id,
        title=topic_update.title,
        content=topic_update.content,
        category=topic_update.category,
    )


@router.delete("/topics/{topic_id}")
async def delete_topic(
    topic_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user),
):
    """删除主题"""
    forum_service = ForumService(db)
    forum_service.delete_topic(topic_id, current_user_id)
    return {"message": "主题已删除"}


@router.post("/topics/{topic_id}/replies", response_model=ReplyResponse)
async def create_reply(
    topic_id: int,
    reply: ReplyCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user),
):
    """创建回复"""
    forum_service = ForumService(db)
    return forum_service.create_reply(
        topic_id=topic_id,
        user_id=current_user_id,
        content=reply.content,
        parent_id=reply.parent_id,
    )


@router.get("/topics/{topic_id}/replies", response_model=List[ReplyResponse])
async def get_topic_replies(
    topic_id: int,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
):
    """获取主题的回复列表"""
    forum_service = ForumService(db)
    return forum_service.get_topic_replies(topic_id, page, page_size)


@router.post("/topics/{topic_id}/trigger-agent", response_model=ReplyResponse)
async def trigger_agent_reply(
    topic_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user),
):
    """手动触发Agent回复"""
    forum_service = ForumService(db)
    reply = forum_service._trigger_agent_reply(topic_id)
    if not reply:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Agent回复生成失败",
        )
    return reply
