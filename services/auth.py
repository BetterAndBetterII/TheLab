"""认证服务模块。

提供用户认证相关的功能，包括注册、登录、验证码管理、OAuth认证等。 支持多种认证方式和令牌管理。
"""

import random
import string
from datetime import datetime, timedelta, timezone
from typing import Optional

import requests
from fastapi import HTTPException, status
from jose import JWTError, jwt
from redis import Redis
from sqlalchemy.orm import Session

from config import get_settings
from models.users import User, UserStatus

settings = get_settings()


class AuthService:
    """认证服务类。

    提供用户认证相关的功能实现，包括：
    - 验证码生成和验证
    - 用户注册和激活
    - 令牌生成和验证
    - OAuth认证
    """

    def __init__(self, redis_client: Redis):
        """初始化认证服务。

        Args:
            redis_client: Redis客户端实例，用于存储验证码等临时数据
        """
        self.redis = redis_client

    def generate_verification_code(self) -> str:
        """生成数字验证码."""
        return "".join(random.choices(string.digits, k=settings.VERIFICATION_CODE_LENGTH))

    def save_verification_code(self, email: str, code: str) -> None:
        """保存验证码到Redis."""
        key = f"verification_code:{email}"
        self.redis.setex(
            key,
            timedelta(minutes=settings.VERIFICATION_CODE_EXPIRE_MINUTES),
            code,
        )

    def verify_code(self, email: str, code: str) -> bool:
        """验证验证码."""
        key = f"verification_code:{email}"
        stored_code = self.redis.get(key)
        if not stored_code:
            return False
        return stored_code == code

    def create_access_token(self, data: dict) -> str:
        """创建访问令牌."""
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        return jwt.encode(
            to_encode,
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )

    def create_refresh_token(self, data: dict) -> str:
        """创建刷新令牌."""
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode.update({"exp": expire})
        return jwt.encode(
            to_encode,
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )

    def verify_token(self, token: str) -> dict:
        """验证令牌."""
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
            )
            return payload
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的认证凭据",
            )

    def authenticate_user(self, db: Session, email: str, password: str) -> Optional[User]:
        """验证用户凭据."""
        user = db.query(User).filter(User.email == email).first()
        if not user or not User.verify_password(password, user.hashed_password):
            return None
        return user

    def register_user(
        self,
        db: Session,
        email: str,
        username: str,
        password: str,
        full_name: Optional[str] = None,
    ) -> User:
        """注册新用户."""
        # 检查邮箱是否已存在
        if db.query(User).filter(User.email == email).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该邮箱已被注册",
            )

        # 检查用户名是否已存在
        if db.query(User).filter(User.username == username).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该用户名已被使用",
            )

        # 创建新用户
        user = User(
            email=email,
            username=username,
            hashed_password=User.get_password_hash(password),
            full_name=full_name,
            status=UserStatus.PENDING,
        )

        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def activate_user(self, db: Session, user_id: int) -> User:
        """激活用户账号."""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在",
            )

        user.status = UserStatus.ACTIVE
        db.commit()
        db.refresh(user)
        return user

    def get_github_access_token(self, code: str) -> str:
        """获取GitHub OAuth访问令牌."""
        try:
            response = requests.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": settings.GITHUB_REDIRECT_URI,
                },
            )
            response.raise_for_status()
            data = response.json()

            if "error" in data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"GitHub OAuth错误: {data['error_description']}",
                )

            return data["access_token"]
        except requests.RequestException as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"GitHub OAuth请求失败: {str(e)}",
            )

    def get_github_user_info(self, token: str) -> dict:
        """获取GitHub用户信息."""
        try:
            response = requests.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                },
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取GitHub用户信息失败: {str(e)}",
            )
