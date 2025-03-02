from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import create_tables
from routers import auth, conversations, documents, folders, forum, settings, search
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # 清理工作
    if hasattr(app.state, "document_pipeline"):
        app.state.document_pipeline.shutdown()


app = FastAPI(
    title="AI文档处理系统",
    description="基于FastAPI的文档处理系统，支持文件上传、文本提取、总结和翻译",
    version="1.0.0",
    lifespan=lifespan,
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "欢迎使用AI文档系统"}


# 包含路由
app.include_router(auth.router)  # 用户认证路由
app.include_router(documents.router)  # 文档路由
app.include_router(folders.router)  # 文件夹路由
app.include_router(conversations.router)  # 对话路由
app.include_router(forum.router)  # 论坛路由
app.include_router(search.router)  # 搜索路由
app.include_router(settings.router)  # 设置路由

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
