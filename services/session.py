import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from redis import Redis
from sqlalchemy.orm import Session as DBSession

from config import get_settings
from database import get_db
from models.sessions import Session
from models.users import User

settings = get_settings()


class SessionManager:
    def __init__(self, redis_client: Redis):
        self.redis = redis_client
        self.cookie_name = "session_id"
        self.session_prefix = "session:"
        self.expire_days = settings.SESSION_EXPIRE_DAYS

    def _generate_session_id(self) -> str:
        """生成唯一的会话ID."""
        return str(uuid.uuid4())

    def _get_session_key(self, session_id: str) -> str:
        """获取Redis中的会话键名."""
        return f"{self.session_prefix}{session_id}"

    def create_session(
        self,
        db: DBSession,
        user: User,
        initial_data: Optional[dict] = None,
        request: Optional[Request] = None,
    ) -> str:
        """创建新会话."""
        session_id = self._generate_session_id()
        session_key = self._get_session_key(session_id)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=self.expire_days)

        # 创建新的会话记录
        session = Session(
            id=session_id,
            user_id=user.id,
            created_at=now,
            expires_at=expires_at,
            last_accessed_at=now,
            data=initial_data or {},
            user_agent=(request.headers.get("user-agent") if request else None),
            ip_address=request.client.host if request else None,
        )
        db.add(session)
        db.commit()

        # 将数据存储到Redis用于快速访问
        session_data = session.to_dict()
        self.redis.setex(
            session_key,
            timedelta(days=self.expire_days),
            json.dumps(session_data),
        )

        return session_id

    def get_session(self, db: DBSession, session_id: str) -> Optional[Session]:
        """获取会话数据，同时刷新过期时间."""
        session = db.query(Session).filter(Session.id == session_id).first()

        if not session or session.is_expired():
            return None

        # 更新最后访问时间
        now = datetime.now(timezone.utc)
        session.last_accessed_at = now
        session.expires_at = now + timedelta(days=self.expire_days)
        db.commit()

        # 更新Redis中的数据
        session_key = self._get_session_key(session_id)
        self.redis.setex(
            session_key,
            timedelta(days=self.expire_days),
            json.dumps(session.to_dict()),
        )

        return session

    def update_session(self, db: DBSession, session_id: str, data: dict) -> bool:
        """更新会话数据."""
        session = db.query(Session).filter(Session.id == session_id).first()

        if not session or session.is_expired():
            return False

        # 更新会话数据
        session.data = data
        session.last_accessed_at = datetime.now(timezone.utc)
        db.commit()

        # 更新Redis中的数据
        session_key = self._get_session_key(session_id)
        self.redis.setex(
            session_key,
            timedelta(days=self.expire_days),
            json.dumps(session.to_dict()),
        )

        return True

    def delete_session(self, db: DBSession, session_id: str) -> bool:
        """删除会话."""
        session = db.query(Session).filter(Session.id == session_id).first()
        if session:
            db.delete(session)
            db.commit()

        # 删除Redis中的会话数据
        session_key = self._get_session_key(session_id)
        return bool(self.redis.delete(session_key))

    def get_user_sessions(self, db: DBSession, user_id: int) -> list[Session]:
        """获取用户的所有有效会话."""
        now = datetime.now(timezone.utc)
        return db.query(Session).filter(Session.user_id == user_id).filter(Session.expires_at > now).all()

    def get_user_from_session(self, db: DBSession, request: Request) -> Optional[User]:
        """从请求中获取用户信息."""
        session_id = request.cookies.get(self.cookie_name)
        if not session_id:
            return None

        session = self.get_session(db, session_id)
        if not session:
            return None

        return session.user


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
async def get_current_user(request: Request, db: DBSession = Depends(get_db)) -> User:
    """获取当前登录用户的依赖函数."""
    user = session_manager.get_user_from_session(db, request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未登录或会话已过期",
        )
    return user
