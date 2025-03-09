"""搜索相关的路由处理模块。

提供基于向量数据库的文档搜索功能，支持语义搜索和相似度排序。
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import Settings, get_settings
from database import get_db
from models.users import User
from rag.knowledgebase import KnowledgeBase
from services.session import get_current_user

router = APIRouter(prefix="/search", tags=["search"])


class SearchRequest(BaseModel):
    """搜索请求模型。

    包含搜索查询和配置参数。
    """

    query: str
    top_k: Optional[int] = 10
    rerank: Optional[bool] = True
    mode: Optional[str] = "hybrid"


class SearchResult(BaseModel):
    """搜索结果项模型。

    包含单个搜索结果的详细信息。
    """

    text: str
    score: float
    metadata: dict
    doc_id: str


class SearchResponse(BaseModel):
    """搜索响应模型。

    包含搜索结果列表。
    """

    results: List[SearchResult]


@router.post("", response_model=SearchResponse)
async def search(
    request: SearchRequest,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """执行文档搜索。

    Args:
        request: 搜索请求参数
        settings: 应用配置
        db: 数据库会话
        current_user: 当前用户

    Returns:
        SearchResponse: 搜索结果

    Raises:
        HTTPException: 当搜索过程中发生错误时抛出
    """
    try:
        if settings.GLOBAL_MODE == "public":
            namespace = "public"
        else:
            namespace = str(current_user.email)
        # 初始化 KnowledgeBase
        pg_docs_uri = (
            f"postgresql+asyncpg://"
            f"{settings.DATABASE_USER}:{settings.DATABASE_PASSWORD}@"
            f"{settings.DATABASE_HOST}:{settings.DATABASE_PORT}/{settings.RAG_DATABASE_NAME}"
        )
        pg_vector_uri = (
            f"postgresql+asyncpg://"
            f"{settings.DATABASE_USER}:{settings.DATABASE_PASSWORD}@"
            f"{settings.DATABASE_HOST}:{settings.DATABASE_PORT}/{settings.RAG_DATABASE_NAME}"
        )
        kb = KnowledgeBase(
            pg_docs_uri=pg_docs_uri,
            pg_vector_uri=pg_vector_uri,
            namespace=namespace,
        )

        # 调用检索方法
        nodes = await kb.retrieve(
            query=request.query,
            top_k=request.top_k,
            rerank=request.rerank,
            mode=request.mode,
        )

        # 转换结果格式
        results = [
            SearchResult(
                text=node.node.text,
                score=node.score if node.score else 0.0,
                metadata=node.node.metadata,
                doc_id=node.node.ref_doc_id.split("_")[1],
            )
            for node in nodes
        ]

        return SearchResponse(results=results)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
