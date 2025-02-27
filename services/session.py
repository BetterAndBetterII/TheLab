import json
import uuid
from datetime import timedelta
from typing import Any, Optional

from fastapi import HTTPException, Request, status
from redis import Redis

from config import get_settings

settings = get_settings()


class SessionManager:
    def __init__(self, redis_client: Redis):
        self.redis = redis_client
        self.cookie_name = "session_id"
        self.session_prefix = "session:"
        self.expire_days = 7  # 会话有效期（天）

    def _generate_session_id(self) -> str:
        """生成唯一的会话ID"""
        return str(uuid.uuid4())

    def _get_session_key(self, session_id: str) -> str:
        """获取Redis中的会话键名"""
        return f"{self.session_prefix}{session_id}"

    def create_session(self, data: dict) -> str:
        """创建新会话"""
        session_id = self._generate_session_id()
        session_key = self._get_session_key(session_id)

        # 将数据存储到Redis
        self.redis.setex(
            session_key, timedelta(days=self.expire_days), json.dumps(data)
        )

        return session_id

    def get_session(self, session_id: str) -> Optional[dict]:
        """获取会话数据"""
        session_key = self._get_session_key(session_id)
        data = self.redis.get(session_key)

        if data:
            # 刷新过期时间
            self.redis.expire(session_key, timedelta(days=self.expire_days))
            return json.loads(data)

        return None

    def update_session(self, session_id: str, data: dict) -> bool:
        """更新会话数据"""
        session_key = self._get_session_key(session_id)
        if self.redis.exists(session_key):
            self.redis.setex(
                session_key, timedelta(days=self.expire_days), json.dumps(data)
            )
            return True
        return False

    def delete_session(self, session_id: str) -> bool:
        """删除会话"""
        session_key = self._get_session_key(session_id)
        return bool(self.redis.delete(session_key))

    def get_user_id_from_session(self, request: Request) -> Optional[int]:
        """从请求中获取用户ID"""
        session_id = request.cookies.get(self.cookie_name)
        if not session_id:
            return None

        session_data = self.get_session(session_id)
        if not session_data:
            return None

        return session_data.get("user_id")


# 创建全局会话管理器实例
from redis.connection import ConnectionPool

redis_pool = ConnectionPool(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=settings.REDIS_DB,
    password=settings.REDIS_PASSWORD,
    decode_responses=True,
)
redis_client = Redis(connection_pool=redis_pool)
session_manager = SessionManager(redis_client)


# 依赖函数
async def get_current_user(request: Request) -> int:
    """获取当前登录用户ID的依赖函数"""
    user_id = session_manager.get_user_id_from_session(request)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未登录或会话已过期",
        )
    return user_id
