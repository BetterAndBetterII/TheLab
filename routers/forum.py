"""论坛相关的路由处理模块。

提供论坛主题的创建、查询、修改、删除等功能的API接口。 支持主题分类、回复管理和AI生成内容功能。
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from database import get_db
from models.forum import TopicCategory
from models.users import User
from services.forum import ForumService
from services.session import get_current_user

router = APIRouter(prefix="/forum", tags=["forum"])


class TopicCreate(BaseModel):
    """主题创建请求模型。

    包含创建新主题所需的参数。
    """

    title: str
    content: str
    category: TopicCategory
    enable_agent: Optional[bool] = True


class TopicUpdate(BaseModel):
    """主题更新请求模型。

    包含更新主题所需的参数。
    """

    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[TopicCategory] = None


class ReplyCreate(BaseModel):
    """回复创建请求模型。

    包含创建新回复所需的参数。
    """

    content: str
    parent_id: Optional[int] = None
    enable_agent: Optional[bool] = True


class UserResponse(BaseModel):
    """用户响应模型。

    包含用户基本信息。
    """

    id: int
    username: str

    class Config:
        """模型配置类。

        设置模型的行为和验证规则。
        """

        from_attributes = True


class ReplyResponse(BaseModel):
    """回复响应模型。

    包含回复的完整信息。
    """

    id: int
    content: str
    topic_id: int
    user_id: int
    username: str | None = None
    parent_id: Optional[int]
    is_ai_generated: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        """模型配置类。

        设置模型的行为和验证规则。
        """

        from_attributes = True

    @field_validator("username")
    def set_username(cls, v, info):
        """设置用户名的验证器。

        当用户名为空时返回默认值。

        Args:
            v: 用户名值
            info: 验证器信息

        Returns:
            str: 处理后的用户名
        """
        if v is None:
            return "Unknown User"
        return v


class TopicResponse(BaseModel):
    """主题响应模型。

    包含主题的完整信息和相关回复。
    """

    id: int
    title: str
    content: str
    category: TopicCategory
    user_id: int
    username: str | None = None
    views: int
    is_pinned: bool
    is_locked: bool
    created_at: datetime
    updated_at: datetime
    replies: List[ReplyResponse]

    class Config:
        """模型配置类。

        设置模型的行为和验证规则。
        """

        from_attributes = True

    @field_validator("username")
    def set_username(cls, v, info):
        """设置用户名的验证器。

        当用户名为空时返回默认值。

        Args:
            v: 用户名值
            info: 验证器信息

        Returns:
            str: 处理后的用户名
        """
        if v is None:
            return "Unknown User"
        return v


# 路由处理函数
@router.post("/topics", response_model=TopicResponse)
async def create_topic(
    topic: TopicCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建新主题."""
    forum_service = ForumService(db)
    return forum_service.create_topic(
        user_id=current_user.id,
        username=current_user.username,
        title=topic.title,
        content=topic.content,
        category=topic.category,
        enable_agent=topic.enable_agent,
    )


@router.get("/topics", response_model=List[TopicResponse])
async def list_topics(
    category: Optional[TopicCategory] = None,
    page: int = 1,
    page_size: int = 10,
    db: Session = Depends(get_db),
):
    """获取主题列表."""
    forum_service = ForumService(db)
    return forum_service.list_topics(category, page, page_size)


@router.get("/topics/{topic_id}", response_model=TopicResponse)
async def get_topic(topic_id: int, db: Session = Depends(get_db)):
    """获取主题详情."""
    forum_service = ForumService(db)
    return forum_service.get_topic(topic_id)


@router.put("/topics/{topic_id}", response_model=TopicResponse)
async def update_topic(
    topic_id: int,
    topic_update: TopicUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新主题."""
    forum_service = ForumService(db)
    return forum_service.update_topic(
        topic_id=topic_id,
        user_id=current_user.id,
        title=topic_update.title,
        content=topic_update.content,
        category=topic_update.category,
    )


@router.delete("/topics/{topic_id}")
async def delete_topic(
    topic_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除主题."""
    forum_service = ForumService(db)
    forum_service.delete_topic(topic_id, current_user.id)
    return {"message": "主题已删除"}


@router.post("/topics/{topic_id}/replies", response_model=ReplyResponse)
async def create_reply(
    topic_id: int,
    reply: ReplyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建回复."""
    forum_service = ForumService(db)
    return forum_service.create_reply(
        topic_id=topic_id,
        user_id=current_user.id,
        username=current_user.username,
        content=reply.content,
        parent_id=reply.parent_id,
        enable_agent=reply.enable_agent,
    )


@router.get("/topics/{topic_id}/replies", response_model=List[ReplyResponse])
async def get_topic_replies(
    topic_id: int,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
):
    """获取主题的回复列表."""
    forum_service = ForumService(db)
    return forum_service.get_topic_replies(topic_id, page, page_size)


@router.post("/topics/{topic_id}/trigger-agent", response_model=ReplyResponse)
async def trigger_agent_reply(
    topic_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """手动触发Agent回复."""
    forum_service = ForumService(db)
    reply = forum_service._trigger_agent_reply(topic_id)
    if not reply:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Agent回复生成失败",
        )
    return reply


@router.post("/generate-ai-topic", response_model=TopicResponse)
async def generate_ai_topic(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """生成AI推文."""
    forum_service = ForumService(db)
    return await forum_service.generate_ai_topic(current_user)
