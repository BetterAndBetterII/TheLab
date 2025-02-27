"""对话相关的路由处理模块。

这个模块包含了所有与对话相关的路由处理器，包括创建对话、发送消息、获取历史记录等功能。
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import Conversation, Document, Message, get_db
from models.users import User
from services.conversation_enhancer import (ConversationEnhancer,
                                            EnhancementType)
from services.session import get_current_user

router = APIRouter(prefix="/conversations", tags=["conversations"])


class ConversationCreate(BaseModel):
    title: str
    document_ids: List[int]


class ConversationUpdate(BaseModel):
    title: str


class MessageCreate(BaseModel):
    content: str
    position_x: float
    position_y: float


class MessageResponse(BaseModel):
    """消息响应模型类。

    用于返回消息相关的信息。
    """

    id: int
    conversation_id: int
    content: str
    is_ai: bool
    position_x: float
    position_y: float
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class ConversationResponse(BaseModel):
    """对话响应模型类。

    用于返回对话相关的信息。
    """

    id: int
    title: str
    documents: List[Document]
    messages: List[MessageResponse]
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class EnhanceRequest(BaseModel):
    conversation_id: int
    message_id: int
    enhancement_types: List[EnhancementType]


class EnhanceResponse(BaseModel):
    conversation_id: int
    message_id: int
    enhancements: List[dict]


class PageEnhanceRequest(BaseModel):
    conversation_id: int
    document_id: int
    page: int
    enhancement_types: List[EnhancementType]
    window_size: Optional[int] = 3


class PageEnhanceResponse(BaseModel):
    conversation_id: int
    document_id: int
    page: int
    enhancements: List[dict]


@router.post("", response_model=ConversationResponse)
async def create_conversation(
    conversation_data: ConversationCreate, db: Session = Depends(get_db)
):
    # 验证所有文档是否存在
    documents = []
    for doc_id in conversation_data.document_ids:
        document = db.query(Document).filter(Document.id == doc_id).first()
        if not document:
            raise HTTPException(status_code=404, detail=f"文档 {doc_id} 不存在")
        documents.append(document)

    # 创建新的对话
    conversation = Conversation(title=conversation_data.title, documents=documents)

    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.get("", response_model=List[ConversationResponse])
async def list_conversations(db: Session = Depends(get_db)):
    return db.query(Conversation).all()


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(conversation_id: int, db: Session = Depends(get_db)):
    conversation = (
        db.query(Conversation).filter(Conversation.id == conversation_id).first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="对话不存在")
    return conversation


@router.post("/{conversation_id}/messages", response_model=MessageResponse)
async def create_message(
    conversation_id: int,
    message_data: MessageCreate,
    db: Session = Depends(get_db),
):
    # 验证对话是否存在
    conversation = (
        db.query(Conversation).filter(Conversation.id == conversation_id).first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="对话不存在")

    # 创建用户消息
    user_message = Message(
        conversation_id=conversation_id,
        content=message_data.content,
        is_ai=False,
        position_x=message_data.position_x,
        position_y=message_data.position_y,
    )

    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    # TODO: 调用AI服务生成回复
    # 这里需要实现AI回复的逻辑
    ai_response = "这是一个AI回复的示例"  # 临时示例

    # 创建AI回复消息
    ai_message = Message(
        conversation_id=conversation_id,
        content=ai_response,
        is_ai=True,
        position_x=message_data.position_x,
        position_y=message_data.position_y + 100,  # 临时将AI回复放在用户消息下方
    )

    db.add(ai_message)
    db.commit()
    db.refresh(ai_message)

    return user_message


@router.put("/messages/{message_id}", response_model=MessageResponse)
async def update_message_position(
    message_id: int,
    position_x: float,
    position_y: float,
    db: Session = Depends(get_db),
):
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="消息不存在")

    message.position_x = position_x
    message.position_y = position_y

    db.commit()
    db.refresh(message)
    return message


@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: int, db: Session = Depends(get_db)):
    conversation = (
        db.query(Conversation).filter(Conversation.id == conversation_id).first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="对话不存在")

    db.delete(conversation)
    db.commit()
    return {"message": "对话已删除"}


@router.post("/enhance-page", response_model=PageEnhanceResponse)
async def enhance_page(
    request: PageEnhanceRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user),
):
    """增强文档指定页面的内容"""
    # 获取用户
    user = db.query(User).filter(User.id == current_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 获取对话
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == request.conversation_id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="对话不存在")

    # 获取文档
    document = db.query(Document).filter(Document.id == request.document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")

    # 验证页码
    if request.page < 1 or request.page > document.total_pages:
        raise HTTPException(status_code=400, detail="无效的页码")

    # 创建增强器
    enhancer = ConversationEnhancer(user=user)

    # 执行增强
    enhancements = await enhancer.batch_enhance_page(
        document=document,
        page=request.page,
        enhancement_types=request.enhancement_types,
        window_size=request.window_size,
    )

    # 为每个增强结果创建新的AI消息
    for enhancement in enhancements:
        if enhancement["status"] == "success":
            message = Message(
                conversation_id=request.conversation_id,
                content=f"[第 {request.page} 页 - {enhancement['type']}]\n\n{enhancement['result']}",
                is_ai=True,
                position_x=0,  # 可以根据需要设置位置
                position_y=0,
            )
            db.add(message)

    db.commit()

    return {
        "conversation_id": request.conversation_id,
        "document_id": request.document_id,
        "page": request.page,
        "enhancements": enhancements,
    }
