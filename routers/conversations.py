"""对话相关的路由处理模块。

这个模块包含了所有与对话相关的路由处理器，包括创建对话、发送消息、获取历史记录等功能。
"""

from datetime import datetime
from typing import List, Optional, AsyncGenerator, Literal
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
import re

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
    model: str = Literal["standard", "advanced"]


class ConversationResponse(BaseModel):
    """对话响应模型类。"""

    id: int
    title: str
    messages: List[dict]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FlowJsonResponse(BaseModel):
    id: str
    object: str
    created: int
    model: str
    choices: List[dict]


class QuizRequest(BaseModel):
    page_number: int
    stream: Optional[bool]

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


def remove_system_prompt(content: str) -> str:
    # 替换<|SYSTEM_PROMPT|>****<|SYSTEM_PROMPT|>之间所有内容为空
    result = re.sub(
        r"<\|SYSTEM_PROMPT\|>.*?<\|SYSTEM_PROMPT\|>",
        "",
        content,
        flags=re.DOTALL | re.MULTILINE,
    )
    # 移除多余的空行
    result = re.sub(r"\n\s*\n", "\n", result)
    return result.strip()


def clean_messages(messages):
    for m in messages:
        m["content"] = remove_system_prompt(m["content"])
    return messages


SYSTEM_PROMPT = """<|SYSTEM_PROMPT|>
你是一个可以帮助用户分析学术论文的助手。
你可以在答案的结尾使用"<note>keyword:note_content</note>" 帮我记笔记。
keyword **必须是论文原文中出现的一模一样的关键词**，不要自己造关键词，不要翻译过来。
例子：
<note>Coverage:Coverage is a measure of the extent to which a dataset covers the entire population.</note>
<note>AI:Artificial Intelligence is a field of computer science that focuses on building intelligent systems that can perform tasks that typically require human-like intelligence.</note>
<|SYSTEM_PROMPT|>
"""


async def chat_stream(
    messages: List[dict],
    conversation: Conversation,
    model: str,
    db: Session,
    current_user: User,
) -> AsyncGenerator[str, None]:
    """生成聊天响应流"""

    # 更新对话消息记录
    messages[-1]["content"] = SYSTEM_PROMPT + messages[-1]["content"]
    new_messages = conversation.messages.copy()
    new_messages.append(
        {
            "role": "user",
            "content": messages[-1]["content"],
            "timestamp": datetime.now().isoformat(),
        }
    )

    try:
        openai_client = OpenAIClient(
            api_key=current_user.ai_api_key,
            base_url=current_user.ai_base_url,
            model=(
                current_user.ai_standard_model
                if model == "standard"
                else current_user.ai_advanced_model
            ),
        )
        cum_content = ""
        is_reasoning = False
        finish_reason = None
        async for chunk in await openai_client.chat_stream(messages):
            chunk: ChatCompletionChunk
            # 更新最后一条AI消息的内容
            _c = ""
            if chunk.choices[0].delta.content and chunk.choices[0].delta.content != "":
                if is_reasoning:
                    is_reasoning = False
                    _c += "</think>"
                _c += chunk.choices[0].delta.content

            if getattr(chunk.choices[0].delta, "reasoning_content", None):
                if not is_reasoning:
                    is_reasoning = True
                    _c += "<think>"
                _c += chunk.choices[0].delta.reasoning_content

            cum_content += _c
            # 构造 OpenAI 格式的响应
            response = {
                "id": f"chatcmpl-{conversation.id}",
                "object": "chat.completion.chunk",
                "created": int(datetime.now().timestamp()),
                "model": current_user.ai_standard_model,
                "choices": [
                    {
                        "index": 0,
                        "delta": {"content": _c},
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
        conversation.messages = clean_messages(new_messages.copy())
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
            chat_stream(messages, c, request.model, db, current_user),
            media_type="text/event-stream",
        )

    # 如果请求非流式响应
    try:
        openai_client = OpenAIClient(
            api_key=current_user.ai_api_key,
            base_url=current_user.ai_base_url,
            model=(
                current_user.ai_standard_model
                if request.model == "standard"
                else current_user.ai_advanced_model
            ),
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


FLOW_PROMPT = """请你作为一个学术论文分析专家，仔细阅读这篇论文，并按照以下JSON格式生成一个结构化的总结：
{
    "title": "论文标题",
    "authors": ["作者1", "作者2"],
    "coreContributions": [
        "核心贡献点1",
        "核心贡献点2",
        "核心贡献点3"
    ],
    "questions": [
        "值得探讨或质疑的点1",
        "值得探讨或质疑的点2"
    ],
    "application": "主要应用场景描述",
    "keywords": [
        {"text": "关键词1", "type": "disruptive"},
        {"text": "关键词2", "type": "innovative"},
        {"text": "关键词3", "type": "potential"}
    ]
}

请确保：
1. 核心贡献点要简明扼要，突出创新点
2. 质疑点要客观中立，具有建设性
3. 应用场景要具体且实际
4. 关键词分类：
   - disruptive: 颠覆性的概念或方法
   - innovative: 创新性的改进或优化
   - potential: 潜在的应用或发展方向

请直接返回JSON格式的内容，不要添加其他说明文字。"""


async def generate_flow_stream(
    full_content: str,
    document_id: int,
    db: Session,
    current_user: User,
):
    try:
        openai_client = OpenAIClient(
            api_key=current_user.ai_api_key,
            base_url=current_user.ai_base_url,
            model=current_user.ai_standard_model,
        )
        messages = [
            {"role": "system", "content": FLOW_PROMPT},
            {"role": "user", "content": full_content},
        ]
        content = ""
        async for chunk in await openai_client.chat_stream(messages):
            if chunk.choices[0].delta.content and chunk.choices[0].delta.content != "":
                _c = chunk.choices[0].delta.content
                content += _c
                yield f"data: {json.dumps({'content': _c})}\n\n"

        flow_data = json.loads(
            content.replace("```json", "").replace("```", "").strip()
        )
        history_entry = {
            "summary": flow_data,
            "created": int(datetime.now().timestamp()),
        }
        document = (
            db.query(Document)
            .filter(Document.id == document_id, Document.owner_id == current_user.id)
            .first()
        )
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        flag_modified(document, "flow_history")
        document.flow_history = history_entry
        db.commit()
        db.refresh(document)
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
    finally:
        yield "data: [DONE]\n\n"


@router.post("/documents/{document_id}/flow")
async def generate_flow(
    document_id: int,
    stream: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """生成文档总结"""
    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.owner_id == current_user.id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    if document.flow_history:
        return FlowJsonResponse(
            id=f"flowcmpl-{document_id}",
            object="flow.completion",
            created=int(datetime.now().timestamp()),
            model=current_user.ai_standard_model,
            choices=[
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": json.dumps(document.flow_history),
                    },
                    "finish_reason": "stop",
                }
            ],
        )
    pages = "\n".join(
        [
            f"以下是第{int(i) + 1}页的内容: \n{page}\n"
            for i, page in document.content_pages.items()
        ]
    )
    full_content = f"论文标题: {document.filename} 论文内容: {pages}"
    messages = [
        {"role": "system", "content": FLOW_PROMPT},
        {"role": "user", "content": full_content},
    ]

    # 如果请求流式响应
    if stream:
        return StreamingResponse(
            generate_flow_stream(full_content, document_id, db, current_user),
            media_type="text/event-stream",
        )

    # 如果请求非流式响应
    try:
        openai_client = OpenAIClient(
            api_key=current_user.ai_api_key,
            base_url=current_user.ai_base_url,
            model=current_user.ai_standard_model,
        )
        response = await openai_client.chat(messages)

        return {
            "id": f"flowcmpl-{document_id}",
            "object": "flow.completion",
            "created": int(datetime.now().timestamp()),
            "model": current_user.ai_standard_model,
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


QUIZ_PROMPT = """请你作为一个学术论文测验专家，仔细阅读这篇论文，并按照以下JSON格式生成一个结构化的测验题：
{
    "questions": [
        {
            "id": "1",
            "text": "问题1",
            "options": [
                {"id": "a", "text": "选项A"},
                {"id": "b", "text": "选项B"},
                {"id": "c", "text": "选项C"},
                {"id": "d", "text": "选项D"}
            ],
            "correctOptionId": "a",
            "explanation": "解释为什么这是正确答案"
        }
    ]
}

请确保：
1. 问题要有深度，考察论文的核心内容
2. 选项要合理，具有一定的迷惑性
3. 解释要详细，帮助理解为什么这是正确答案
4. 每页生成3-4个问题

请直接返回JSON格式的内容，不要添加其他说明文字。"""


async def generate_quiz_stream(
    full_content: str,
    current_user: User,
    document: Document,
    db: Session,
    page_number: int = None,
):
    try:
        openai_client = OpenAIClient(
            api_key=current_user.ai_api_key,
            base_url=current_user.ai_base_url,
            model=current_user.ai_standard_model,
        )
        messages = [
            {"role": "system", "content": QUIZ_PROMPT},
            {"role": "user", "content": full_content},
        ]

        content = ""
        async for chunk in await openai_client.chat_stream(messages):
            if chunk.choices[0].delta.content and chunk.choices[0].delta.content != "":
                _c = chunk.choices[0].delta.content
                content += _c
                yield f"data: {json.dumps({'content': _c})}\n\n"

        # 解析生成的测验内容并保存到历史记录
        try:
            quiz_data = json.loads(
                content.replace("```json", "").replace("```", "").strip()
            )
            history_entry = {
                "page": page_number,
                "questions": quiz_data["questions"],
                "created_at": datetime.now().isoformat(),
            }
            if not document.quiz_history:
                document.quiz_history = []
            new_quiz_history = document.quiz_history.copy()
            new_quiz_history.append(history_entry)
            flag_modified(document, "quiz_history")
            document.quiz_history = new_quiz_history
            db.commit()
            db.refresh(document)
        except:
            traceback.print_exc()

    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
    finally:
        yield "data: [DONE]\n\n"


@router.post("/documents/{document_id}/quiz")
async def generate_quiz(
    document_id: int,
    quiz_request: QuizRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """生成文档测验题"""
    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.owner_id == current_user.id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")

    if quiz_request.page_number is not None:
        if str(quiz_request.page_number - 1) not in document.content_pages:
            raise HTTPException(status_code=404, detail="页面不存在")
        page_window = 3
        page_start = max(0, quiz_request.page_number - page_window)
        page_end = min(
            len(document.content_pages), quiz_request.page_number + page_window
        )
        content = "\n".join(
            [
                f"以下是第{i + 1}页的内容: \n{document.content_pages[str(i)]}"
                for i in range(page_start, page_end)
            ]
        )

    # 如果请求流式响应
    if quiz_request.stream:
        print("生成测验题流式响应")
        return StreamingResponse(
            generate_quiz_stream(
                content, current_user, document, db, quiz_request.page_number
            ),
            media_type="text/event-stream",
        )

    # 如果请求非流式响应
    try:
        openai_client = OpenAIClient(
            api_key=current_user.ai_api_key,
            base_url=current_user.ai_base_url,
            model=current_user.ai_standard_model,
        )
        messages = [
            {"role": "system", "content": QUIZ_PROMPT},
            {"role": "user", "content": content},
        ]
        response = await openai_client.chat(messages)

        # 保存消息记录
        document.messages.extend(
            [
                {"role": "user", "content": content},
                {"role": "assistant", "content": response.content},
            ]
        )

        quiz_data = json.loads(
            response.content.replace("```json", "").replace("```", "").strip()
        )
        history_entry = {
            "page": quiz_request.page_number,
            "questions": quiz_data["questions"],
            "created_at": datetime.now().isoformat(),
        }
        new_quiz_history = document.quiz_history.copy()
        new_quiz_history.append(history_entry)
        flag_modified(document, "quiz_history")
        document.quiz_history = new_quiz_history
        db.commit()
        db.refresh(document)

        return {
            "id": f"quizcmpl-{document_id}",
            "object": "quiz.completion",
            "created": int(datetime.now().timestamp()),
            "model": current_user.ai_standard_model,
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


@router.get("/documents/{document_id}/quiz/history")
async def get_quiz_history(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取文档测验历史记录"""
    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.owner_id == current_user.id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")

    return {"quiz_history": document.quiz_history}
