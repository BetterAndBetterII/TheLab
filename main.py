from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

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

# 创建API路由前缀
api_app = FastAPI(title="API")

# 注册所有 API 路由到 api_app
api_app.include_router(auth.router)  # 用户认证路由
api_app.include_router(documents.router)  # 文档路由
api_app.include_router(folders.router)  # 文件夹路由
api_app.include_router(conversations.router)  # 对话路由
api_app.include_router(forum.router)  # 论坛路由
api_app.include_router(search.router)  # 搜索路由
api_app.include_router(settings.router)  # 设置路由

# 将API应用挂载到主应用的/api路径下
app.mount("/api", api_app)

# 托管静态资源文件（js/css/images等）
app.mount("/static", StaticFiles(directory="frontend/dist/static"), name="static")

# 处理所有其他路由，返回index.html
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    # 检查是否存在对应的静态文件
    static_file = f"frontend/dist/{full_path}"
    if os.path.isfile(static_file):
        return FileResponse(static_file)
    # 否则返回 index.html 以支持客户端路由
    return FileResponse("frontend/dist/index.html")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
