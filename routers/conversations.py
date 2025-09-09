"""对话相关的路由处理模块。

这个模块包含了所有与对话相关的路由处理器，包括创建对话、发送消息、获取历史记录等功能。
"""

import json
import logging
import re
import traceback
from datetime import datetime
from typing import AsyncGenerator, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from openai.types.chat import ChatCompletionChunk
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from clients.openai_client import OpenAIClient
from config import Settings, get_settings
from database import Conversation, Document, QuizHistory, get_db
from models.users import User
from services.session import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/conversations", tags=["conversations"])


class ConversationCreate(BaseModel):
    """对话创建请求模型。

    包含创建新对话所需的基本信息字段。
    """

    title: str
    document_ids: List[int]


class ConversationUpdate(BaseModel):
    """对话更新请求模型。

    包含更新对话所需的字段。
    """

    title: str


class ChatMessage(BaseModel):
    """聊天消息模型。

    定义单条聊天消息的结构。
    """

    role: str
    content: str


class ChatRequest(BaseModel):
    """聊天请求模型。

    包含发送聊天消息所需的参数。
    """

    messages: List[ChatMessage]
    stream: bool = True
    model: str = Literal["standard", "advanced"]
    add_notes: bool = False


class ConversationResponse(BaseModel):
    """对话响应模型类。"""

    id: int
    title: str
    messages: List[dict]
    created_at: datetime
    updated_at: datetime

    class Config:
        """模型配置类。

        设置模型的行为和验证规则。
        """

        from_attributes = True


class FlowJsonResponse(BaseModel):
    """流式响应模型。

    用于处理流式响应的数据结构。
    """

    id: str
    object: str
    created: int
    model: str
    choices: List[dict]


class QuizRequest(BaseModel):
    """测验请求模型。

    包含生成测验题所需的参数。
    """

    page_number: int
    stream: Optional[bool]

    class Config:
        """模型配置类。

        设置模型的行为和验证规则。
        """

        from_attributes = True


class MindmapResponse(BaseModel):
    """思维导图响应模型。

    包含思维导图的数据结构。
    """

    mindmap: str


@router.post("", response_model=ConversationResponse)
async def create_conversation(
    conversation_data: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建新的对话。

    Args:
        conversation_data: 对话创建请求数据
        db: 数据库会话
        current_user: 当前用户

    Returns:
        ConversationResponse: 创建的对话信息

    Raises:
        HTTPException: 当文档不存在时抛出404错误
    """
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


@router.get(
    "/documents/{document_id}",
    response_model=List[ConversationResponse],
)
async def list_conversations(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取指定文档的所有对话列表。

    Args:
        document_id: 文档ID
        db: 数据库会话
        current_user: 当前用户

    Returns:
        List[ConversationResponse]: 对话列表
    """
    conversations = (
        db.query(Conversation)
        .filter(
            Conversation.user_id == current_user.id,
            Conversation.documents.any(Document.id == document_id),
        )
        .all()
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
    """获取指定对话的详细信息。

    Args:
        conversation_id: 对话ID
        db: 数据库会话
        current_user: 当前用户

    Returns:
        ConversationResponse: 对话详细信息

    Raises:
        HTTPException: 当对话不存在时抛出404错误
    """
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
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
    """移除系统提示内容。

    Args:
        content: 原始内容

    Returns:
        str: 移除系统提示后的内容
    """
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
    """清理消息内容。

    Args:
        messages: 原始消息列表

    Returns:
        list: 清理后的消息列表
    """
    for m in messages:
        m["content"] = remove_system_prompt(m["content"])
    return messages


SYSTEM_PROMPT = """<|SYSTEM_PROMPT|>
你是一个可以帮助用户分析学术论文的助手。
<|SYSTEM_PROMPT|>
"""

SYSTEM_PROMPT_NOTE = """<|SYSTEM_PROMPT|>
你是一个可以帮助用户分析学术论文的助手。
你可以在答案的结尾使用"<note>keyword:note_content</note>" 帮我记笔记。
keyword **必须是论文原文中出现的一模一样的关键词**，不要自己造关键词，不要翻译过来。
例子：
<note>Coverage:Coverage is a measure of the extent to which a dataset covers the entire population.</note>
<note>AI:Artificial Intelligence is a field of computer science that focuses on building intelligent systems
that can perform tasks that typically require human-like intelligence.</note>
<|SYSTEM_PROMPT|>
"""


async def chat_stream(
    messages: List[dict],
    conversation: Conversation,
    model: str,
    db: Session,
    current_user: User,
    add_notes: bool,
    settings: Settings,
) -> AsyncGenerator[str, None]:
    """生成聊天响应流。

    Args:
        messages: 消息列表
        conversation: 对话对象
        model: 模型名称
        db: 数据库会话
        current_user: 当前用户
        add_notes: 是否添加笔记
        settings: 应用配置

    Yields:
        str: 流式响应数据
    """
    # 更新对话消息记录
    messages[-1]["content"] = (SYSTEM_PROMPT_NOTE if add_notes else SYSTEM_PROMPT) + messages[-1]["content"]
    new_messages = conversation.messages.copy()
    new_messages.append(
        {
            "role": "user",
            "content": messages[-1]["content"],
            "timestamp": datetime.now().isoformat(),
        }
    )

    try:
        model = {
            "public": {
                "standard": settings.LLM_STANDARD_MODEL,
                "advanced": settings.LLM_ADVANCED_MODEL,
            },
            "private": {
                "standard": current_user.ai_standard_model,
                "advanced": current_user.ai_advanced_model,
            },
        }[settings.GLOBAL_LLM][model]
        if settings.GLOBAL_LLM == "private":
            openai_client = OpenAIClient(
                api_key=current_user.ai_api_key,
                base_url=current_user.ai_base_url,
                model=model,
            )
        else:
            openai_client = OpenAIClient(
                api_key=settings.OPENAI_API_KEY,
                base_url=settings.OPENAI_BASE_URL,
                model=model,
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
                "model": model,
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
        logger.error(f"聊天时发生错误: {str(e)} {traceback.format_exc()}")
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
    settings: Settings = Depends(get_settings),
):
    """聊天接口。

    Args:
        conversation_id: 对话ID
        request: 聊天请求数据
        db: 数据库会话
        current_user: 当前用户
        settings: 应用配置

    Returns:
        StreamingResponse: 流式响应对象

    Raises:
        HTTPException: 当对话不存在时抛出404错误
    """
    c = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="对话不存在")

    # 转换消息格式
    messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]

    # 如果请求流式响应
    return StreamingResponse(
        chat_stream(
            messages,
            c,
            request.model,
            db,
            current_user,
            request.add_notes,
            settings,
        ),
        media_type="text/event-stream",
    )


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除指定对话。

    Args:
        conversation_id: 对话ID
        db: 数据库会话
        current_user: 当前用户

    Returns:
        dict: 删除结果信息

    Raises:
        HTTPException: 当对话不存在时抛出404错误
    """
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
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
    settings: Settings,
):
    """生成文档流程图的流式响应。

    Args:
        full_content: 文档完整内容
        document_id: 文档ID
        db: 数据库会话
        current_user: 当前用户
        settings: 应用配置

    Yields:
        str: 流式响应数据
    """
    try:
        if settings.GLOBAL_LLM == "private":
            openai_client = OpenAIClient(
                api_key=current_user.ai_api_key,
                base_url=current_user.ai_base_url,
                model=current_user.ai_standard_model,
            )
        else:
            openai_client = OpenAIClient(
                api_key=settings.OPENAI_API_KEY,
                base_url=settings.OPENAI_BASE_URL,
                model=settings.LLM_STANDARD_MODEL,
            )
        messages = [
            {"role": "system", "content": FLOW_PROMPT},
            {"role": "user", "content": full_content},
        ]
        content = ""
        async for chunk in await openai_client.chat_stream(messages):
            if chunk.choices and len(chunk.choices) > 0:
                if chunk.choices[0].delta.content and chunk.choices[0].delta.content != "":
                    _c = chunk.choices[0].delta.content
                    content += _c
                    yield f"data: {json.dumps({'content': _c})}\n\n"

    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        raise e
    finally:
        yield "data: [DONE]\n\n"

    try:
        flow_data = json.loads(content.replace("```json", "").replace("```", "").strip())
        history_entry = {
            "summary": flow_data,
            "created": int(datetime.now().timestamp()),
        }
        if settings.GLOBAL_MODE == "public":
            base_query = db.query(Document)
        else:
            base_query = db.query(Document).filter(Document.owner_id == current_user.id)
        document = base_query.filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        flag_modified(document, "flow_history")
        document.flow_history = history_entry
        db.commit()
        db.refresh(document)
    except Exception as e:
        traceback.print_exc()
        logger.error(f"生成文档流程图时发生错误: {str(e)} {traceback.format_exc()}")
        raise e


@router.post("/documents/{document_id}/flow")
async def generate_flow(
    document_id: int,
    stream: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """生成文档总结。

    Args:
        document_id: 文档ID
        stream: 是否使用流式响应
        db: 数据库会话
        current_user: 当前用户
        settings: 应用配置

    Returns:
        StreamingResponse: 流式响应对象

    Raises:
        HTTPException: 当文档不存在时抛出404错误
    """
    if settings.GLOBAL_MODE == "public":
        base_query = db.query(Document)
    else:
        base_query = db.query(Document).filter(Document.owner_id == current_user.id)
    document = base_query.filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    if document.flow_history:
        return FlowJsonResponse(
            id=f"flowcmpl-{document_id}",
            object="flow.completion",
            created=int(datetime.now().timestamp()),
            model=(current_user.ai_standard_model if settings.GLOBAL_LLM == "private" else settings.LLM_STANDARD_MODEL),
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
            if page.strip()  # 添加条件以跳过空页面
        ]
    )
    full_content = f"论文标题: {document.filename}\n论文内容:\n{pages}"

    # 如果请求流式响应
    return StreamingResponse(
        generate_flow_stream(full_content, document_id, db, current_user, settings),
        media_type="text/event-stream",
    )


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
    settings: Settings,
    page_number: int = None,
):
    """生成文档测验题的流式响应。

    Args:
        full_content: 文档完整内容
        current_user: 当前用户
        document: 文档对象
        db: 数据库会话
        settings: 应用配置
        page_number: 页码

    Returns:
        StreamingResponse: 流式响应对象

    Raises:
        Exception: 当生成测验题失败时抛出异常
    """
    try:
        if settings.GLOBAL_LLM == "private":
            openai_client = OpenAIClient(
                api_key=current_user.ai_api_key,
                base_url=current_user.ai_base_url,
                model=current_user.ai_standard_model,
            )
        else:
            openai_client = OpenAIClient(
                api_key=settings.OPENAI_API_KEY,
                base_url=settings.OPENAI_BASE_URL,
                model=settings.LLM_STANDARD_MODEL,
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

    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        raise e
    finally:
        yield "data: [DONE]\n\n"

    # 解析生成的测验内容并保存到历史记录
    try:
        logger.info(content)
        # 清洗latex中的反斜杠，避免被转义
        quiz_data = json.loads(content.replace("```json", "").replace("```", "").strip())
        history_entry = {
            "page": page_number,
            "questions": quiz_data["questions"],
            "created_at": datetime.now().isoformat(),
        }
        # if not document.quiz_history:
        #     document.quiz_history = []
        # new_quiz_history = document.quiz_history.copy()
        # new_quiz_history.append(history_entry)
        # flag_modified(document, "quiz_history")
        # document.quiz_history = new_quiz_history
        quiz_history = QuizHistory(
            document_id=document.id,
            user_id=current_user.id,
            quiz_history=history_entry,
        )
        db.add(quiz_history)
        db.commit()
    except Exception as e:
        traceback.print_exc()
        logger.error(f"生成文档测验题时发生错误: {str(e)} {traceback.format_exc()}")
        raise e


@router.post("/documents/{document_id}/quiz")
async def generate_quiz(
    document_id: int,
    quiz_request: QuizRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """生成文档测验题。

    Args:
        document_id: 文档ID
        quiz_request: 测验请求数据
        db: 数据库会话
        current_user: 当前用户
        settings: 应用配置

    Returns:
        StreamingResponse: 流式响应对象

    Raises:
        HTTPException: 当文档不存在时抛出404错误
    """
    if settings.GLOBAL_MODE == "public":
        base_query = db.query(Document)
    else:
        base_query = db.query(Document).filter(Document.owner_id == current_user.id)
    document = base_query.filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")

    if quiz_request.page_number is not None:
        if str(quiz_request.page_number - 1) not in document.content_pages:
            raise HTTPException(status_code=404, detail="页面不存在")
        page_window = 3
        page_start = max(0, quiz_request.page_number - page_window)
        page_end = min(
            len(document.content_pages),
            quiz_request.page_number + page_window,
        )
        content = "\n".join(
            [f"以下是第{i + 1}页的内容: \n{document.content_pages[str(i)]}" for i in range(page_start, page_end)]
        )

    # 如果请求流式响应
    logger.info("生成测验题流式响应")
    return StreamingResponse(
        generate_quiz_stream(
            content,
            current_user,
            document,
            db,
            settings,
            quiz_request.page_number,
        ),
        media_type="text/event-stream",
    )


@router.get("/documents/{document_id}/quiz/history")
async def get_quiz_history(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取文档测验历史记录。

    Args:
        document_id: 文档ID
        db: 数据库会话
        current_user: 当前用户

    Returns:
        dict: 测验历史记录

    Raises:
        HTTPException: 当测验历史记录不存在时抛出404错误
    """
    quiz_histories: QuizHistory = (
        db.query(QuizHistory)
        .filter(
            QuizHistory.document_id == document_id,
            QuizHistory.user_id == current_user.id,
        )
        .all()
    )
    if not quiz_histories:
        raise HTTPException(status_code=404, detail="测验历史记录不存在")

    return {
        "quiz_history": [
            {
                "page": qh.quiz_history["page"],
                "questions": qh.quiz_history["questions"],
                "created_at": qh.quiz_history["created_at"],
            }
            for qh in quiz_histories
        ]
    }


MINDMAP_PROMPT = """请你作为一个学术论文思维导图专家，仔细阅读这篇论文，
生成一个结构化的思维导图**必须**使用Markdown格式，使用n-level的标题格式，并按照以下JSON格式：
{
    "mindmap": "思维导图内容"
}

请直接返回JSON格式的内容，不要添加其他说明文字。"""


async def get_mindmap(
    full_content: str,
    document_id: int,
    db: Session,
    current_user: User,
    settings: Settings,
):
    """生成文档思维导图内容。

    Args:
        full_content: 文档完整内容
        document_id: 文档ID
        db: 数据库会话
        current_user: 当前用户
        settings: 应用配置

    Returns:
        str: 生成的思维导图内容

    Raises:
        Exception: 当生成思维导图失败时抛出异常
    """
    try:
        if settings.GLOBAL_LLM == "private":
            openai_client = OpenAIClient(
                api_key=current_user.ai_api_key,
                base_url=current_user.ai_base_url,
                model=current_user.ai_standard_model,
            )
        else:
            openai_client = OpenAIClient(
                api_key=settings.OPENAI_API_KEY,
                base_url=settings.OPENAI_BASE_URL,
                model=settings.LLM_STANDARD_MODEL,
            )

        messages = [
            {"role": "system", "content": MINDMAP_PROMPT},
            {"role": "user", "content": full_content},
        ]
        content = ""
        async for chunk in await openai_client.chat_stream(messages):
            if chunk.choices[0].delta.content and chunk.choices[0].delta.content != "":
                _c = chunk.choices[0].delta.content
                content += _c

        mindmap_data = json.loads(content.replace("```json", "").replace("```", "").strip())
        logger.info(mindmap_data)
        document = db.query(Document).filter(Document.id == document_id).first()
        flag_modified(document, "mindmap")
        document.mindmap = {
            "mindmap": mindmap_data["mindmap"],
            "created_at": datetime.now().isoformat(),
        }
        db.commit()
        db.refresh(document)
        return mindmap_data["mindmap"]

    except Exception as e:
        traceback.print_exc()
        if "content" in locals():
            logger.info(content)
        logger.error(f"生成文档思维导图时发生错误: {str(e)} {traceback.format_exc()}")
        return "# 生成思维导图失败，请稍后再试。"


@router.get("/mindmap/{document_id}")
async def generate_mindmap(
    document_id: int,
    retry: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """生成文档思维导图。

    Args:
        document_id: 文档ID
        retry: 是否重试生成
        db: 数据库会话
        current_user: 当前用户
        settings: 应用配置

    Returns:
        MindmapResponse: 思维导图响应对象

    Raises:
        HTTPException: 当文档不存在时抛出404错误
    """
    if settings.GLOBAL_MODE == "public":
        base_query = db.query(Document)
    else:
        base_query = db.query(Document).filter(Document.owner_id == current_user.id)
    document = base_query.filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")

    if document.mindmap and not retry:
        return MindmapResponse(
            mindmap=str(document.mindmap["mindmap"]),
        )

    pages = "\n".join(
        [
            f"以下是第{int(i) + 1}页的内容: \n{page}\n"
            for i, page in document.content_pages.items()
            if page.strip()  # 添加条件以跳过空页面
        ]
    )
    full_content = f"论文标题: {document.filename}\n论文内容:\n{pages}"

    # 如果请求流式响应
    mindmap_result = await get_mindmap(full_content, document_id, db, current_user, settings)
    return MindmapResponse(
        mindmap=mindmap_result,
    )
