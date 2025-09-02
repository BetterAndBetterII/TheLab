"""FastAPI应用程序入口模块.

该模块是应用程序的主入口，负责配置FastAPI应用实例， 包括CORS中间件、API路由注册、静态文件服务等功能.
"""

import logging
import os
import sys
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from routers import auth, conversations, documents, folders, search, settings

# 配置根日志记录器
root_logger = logging.getLogger()
root_logger.setLevel(logging.DEBUG)

# 配置控制台处理器
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.DEBUG)
console_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_handler.setFormatter(console_formatter)

# 移除所有现有的处理器
for handler in root_logger.handlers[:]:
    root_logger.removeHandler(handler)

# 添加新的处理器
root_logger.addHandler(console_handler)

if os.getenv("LOKI_URL", None):
    import logging_loki

    # 配置Loki处理器
    loki_handler = logging_loki.LokiHandler(
        url=os.getenv("LOKI_URL"),
        tags={"application": os.getenv("LOKI_TAG", "ai_doc_system")},
        version="1",
        auth=None,
    )
    loki_handler.setLevel(logging.DEBUG)
    root_logger.addHandler(loki_handler)


logging.getLogger("urllib3").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用程序生命周期管理器.

    处理应用程序的启动和关闭事件，确保资源的正确清理.

    Args:
        app: FastAPI应用实例

    Yields:
        None
    """
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
api_app.include_router(search.router)  # 搜索路由
api_app.include_router(settings.router)  # 设置路由

# 将API应用挂载到主应用的/api路径下
app.mount("/api", api_app)

# 托管静态资源文件（js/css/images等）
app.mount(
    "/static",
    StaticFiles(directory="frontend/dist/static"),
    name="static",
)


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """处理所有前端路由请求.

    实现单页应用(SPA)的客户端路由支持，将所有未匹配的路由
    重定向到index.html，同时支持静态文件的直接访问.

    Args:
        full_path: 请求的完整路径

    Returns:
        FileResponse: 静态文件或index.html的响应
    """
    # 检查是否存在对应的静态文件
    static_file = f"frontend/dist/{full_path}"
    if os.path.isfile(static_file):
        return FileResponse(static_file)
    # 否则返回 index.html 以支持客户端路由
    return FileResponse("frontend/dist/index.html")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
