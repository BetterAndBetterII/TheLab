"""对话相关的路由处理模块。

这个模块包含了所有与对话相关的路由处理器，包括创建对话、发送消息、获取历史记录等功能。
"""

from datetime import datetime
from typing import List, Optional, AsyncGenerator
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from openai.types.chat import ChatCompletionChunk
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from database import Conversation, Document, get_db
from models.users import User
from services.session import get_current_user
from clients.openai_client import OpenAIClient
import traceback

router = APIRouter(prefix="/conversations", tags=["conversations"])


class ConversationCreate(BaseModel):
    title: str
    document_ids: List[int]


class ConversationUpdate(BaseModel):
    title: str


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    stream: bool = True


class ConversationResponse(BaseModel):
    """对话响应模型类。"""

    id: int
    title: str
    messages: List[dict]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.post("", response_model=ConversationResponse)
async def create_conversation(
    conversation_data: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 验证所有文档是否存在
    documents = []
    for doc_id in conversation_data.document_ids:
        document = db.query(Document).filter(Document.id == doc_id).first()
        if not document:
            raise HTTPException(status_code=404, detail=f"文档 {doc_id} 不存在")
        documents.append(document)

    # 创建新的对话
    conversation = Conversation(
        title=conversation_data.title,
        documents=documents,
        user_id=current_user.id,
        messages=[],
    )

    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.get("", response_model=List[ConversationResponse])
async def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversations = (
        db.query(Conversation).filter(Conversation.user_id == current_user.id).all()
    )
    result = [
        ConversationResponse(
            id=c.id,
            title=c.title,
            messages=c.messages or [],
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in conversations
    ]
    print(result)
    return result


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id, Conversation.user_id == current_user.id
        )
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="对话不存在")

    return ConversationResponse(
        id=conversation.id,
        title=conversation.title,
        messages=conversation.messages or [],
        documents=conversation.documents,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
    )


async def chat_stream(
    messages: List[dict],
    conversation: Conversation,
    db: Session,
    current_user: User,
) -> AsyncGenerator[str, None]:
    """生成聊天响应流"""

    # 更新对话消息记录
    new_messages = conversation.messages.copy()
    new_messages.append(
        {
            "role": "user",
            "content": messages[-1]["content"],
            "timestamp": datetime.now().isoformat(),
        }
    )

    print(new_messages)

    try:
        openai_client = OpenAIClient(
            api_key=current_user.ai_api_key,
            base_url=current_user.ai_base_url,
            model=current_user.ai_standard_model,
        )
        print(messages)
        cum_content = ""
        finish_reason = None
        async for chunk in await openai_client.chat_stream(messages):
            chunk: ChatCompletionChunk
            # 更新最后一条AI消息的内容
            if chunk.choices[0].delta.content:
                cum_content += chunk.choices[0].delta.content

            # 构造 OpenAI 格式的响应
            response = {
                "id": f"chatcmpl-{conversation.id}",
                "object": "chat.completion.chunk",
                "created": int(datetime.now().timestamp()),
                "model": current_user.ai_standard_model,
                "choices": [
                    {
                        "index": 0,
                        "delta": {"content": chunk.choices[0].delta.content},
                        "finish_reason": chunk.choices[0].finish_reason,
                    }
                ],
            }

            if chunk.choices[0].finish_reason:
                finish_reason = chunk.choices[0].finish_reason

            yield f"data: {json.dumps(response)}\n\n"

        if isinstance(new_messages, list):
            new_messages.append(
                {
                    "role": "assistant",
                    "content": cum_content,
                    "timestamp": datetime.now().isoformat(),
                    "finish_reason": finish_reason,
                }
            )
        else:
            new_messages = [
                {
                    "role": "assistant",
                    "content": cum_content,
                    "timestamp": datetime.now().isoformat(),
                    "finish_reason": finish_reason,
                }
            ]
        flag_modified(conversation, "messages")
        conversation.messages = new_messages
        db.commit()
        db.refresh(conversation)
    except Exception as e:
        traceback.print_exc()
        error_response = {
            "error": {
                "message": str(e),
                "type": "api_error",
                "code": "internal_error",
            }
        }
        yield f"data: {json.dumps(error_response)}\n\n"

    finally:
        yield "data: [DONE]\n\n"


@router.post("/{conversation_id}/chat")
async def chat(
    conversation_id: int,
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """聊天接口"""
    c = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id, Conversation.user_id == current_user.id
        )
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="对话不存在")

    # 转换消息格式
    messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]

    # 如果请求流式响应
    if request.stream:
        return StreamingResponse(
            chat_stream(messages, c, db, current_user),
            media_type="text/event-stream",
        )

    # 如果请求非流式响应
    try:
        openai_client = OpenAIClient(
            api_key=current_user.ai_api_key,
            base_url=current_user.ai_base_url,
            model=current_user.ai_standard_model,
        )
        response = await openai_client.chat_stream(messages)

        # 保存消息记录
        c.messages.extend(
            [
                {
                    "role": "user",
                    "content": messages[-1]["content"],
                    "timestamp": datetime.now().isoformat(),
                },
                {
                    "role": "assistant",
                    "content": response.content,
                    "timestamp": datetime.now().isoformat(),
                    "finish_reason": response.finish_reason,
                },
            ]
        )
        db.commit()

        return {
            "id": f"chatcmpl-{c.id}",
            "object": "chat.completion",
            "created": int(datetime.now().timestamp()),
            "model": "gpt-3.5-turbo",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": response.content},
                    "finish_reason": response.finish_reason,
                }
            ],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id, Conversation.user_id == current_user.id
        )
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="对话不存在")

    db.delete(conversation)
    db.commit()
    return {"message": "对话已删除"}
