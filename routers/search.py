# 搜索相关的路由
import os
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
    query: str
    top_k: Optional[int] = 10
    rerank: Optional[bool] = True
    mode: Optional[str] = "hybrid"


class SearchResult(BaseModel):
    text: str
    score: float
    metadata: dict
    doc_id: str


class SearchResponse(BaseModel):
    results: List[SearchResult]


@router.post("", response_model=SearchResponse)
async def search(
    request: SearchRequest,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        if settings.GLOBAL_MODE == "public":
            namespace = "public"
        else:
            namespace = str(current_user.email)
        # 初始化 KnowledgeBase
        pg_docs_uri = f"postgresql+asyncpg://{settings.DATABASE_USER}:{settings.DATABASE_PASSWORD}@{settings.DATABASE_HOST}:{settings.DATABASE_PORT}/{settings.RAG_DATABASE_NAME}"
        pg_vector_uri = f"postgresql+asyncpg://{settings.DATABASE_USER}:{settings.DATABASE_PASSWORD}@{settings.DATABASE_HOST}:{settings.DATABASE_PORT}/{settings.RAG_DATABASE_NAME}"
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
