"""认证相关的路由处理模块。

这个模块包含了所有与用户认证相关的路由处理器，包括注册、登录、登出等功能。
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from redis import Redis
from sqlalchemy.orm import Session

from config import get_settings
from database import get_db
from models.sessions import Session as DBSession
from models.users import User, UserStatus
from services.auth import AuthService
from services.email import EmailService
from services.session import get_current_user, session_manager

settings = get_settings()

# 创建Redis客户端
redis_client = Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=settings.REDIS_DB,
    password=settings.REDIS_PASSWORD,
    decode_responses=True,
)

# 创建认证服务实例
auth_service = AuthService(redis_client)

router = APIRouter(prefix="/auth", tags=["authentication"])

email_service = EmailService(
    smtp_host=settings.SMTP_SERVER,
    smtp_port=settings.SMTP_PORT,
    smtp_user=settings.SMTP_USERNAME,
    smtp_password=settings.SMTP_PASSWORD,
    default_sender=settings.SMTP_FROM_EMAIL,
    default_sender_name=settings.SMTP_FROM_NAME,
)


class UserRegisterRequest(BaseModel):
    """用户注册请求模型。

    包含用户注册所需的基本信息字段。
    """

    email: EmailStr
    username: str
    password: str
    full_name: Optional[str] = None


class VerificationRequest(BaseModel):
    """验证请求模型。

    用于请求发送验证码的邮箱信息。
    """

    email: EmailStr


class VerificationConfirmRequest(BaseModel):
    """验证确认请求模型。

    用于验证码确认和完成注册的请求数据。
    """

    email: EmailStr
    code: str
    username: str
    password: str
    full_name: Optional[str] = None


class LoginRequest(BaseModel):
    """登录请求模型。

    包含用户登录所需的认证信息。
    """

    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """用户响应模型。

    用于返回用户信息的数据结构。
    """

    id: int
    email: str
    username: str
    full_name: Optional[str]
    status: UserStatus
    created_at: datetime

    class Config:
        """模型配置类。

        设置模型的行为和验证规则。
        """

        from_attributes = True


class Token(BaseModel):
    """令牌模型类。

    用于返回JWT令牌信息。
    """

    access_token: str
    token_type: str


class TokenData(BaseModel):
    """令牌数据模型类。

    用于存储JWT令牌中的用户信息。
    """

    username: Optional[str] = None


class UserBase(BaseModel):
    """用户基础模型类。

    包含用户的基本信息字段。
    """

    username: str
    email: EmailStr


class SessionInfo(BaseModel):
    """会话信息模型。

    包含用户会话的详细信息。
    """

    id: str
    created_at: datetime
    last_accessed_at: datetime
    user_agent: Optional[str]
    ip_address: Optional[str]

    class Config:
        """模型配置类。

        设置模型的行为和验证规则。
        """

        from_attributes = True


class OAuthCallbackRequest(BaseModel):
    """OAuth回调请求模型。

    用于处理OAuth认证回调的请求数据。
    """

    code: str


@router.get("/providers")
async def get_available_providers():
    """获取可用的认证提供者."""
    providers = []
    if settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET and settings.GITHUB_REDIRECT_URI:
        providers.append(
            {
                "name": "github",
                "url": f"https://github.com/login/oauth/authorize?"
                f"client_id={settings.GITHUB_CLIENT_ID}&redirect_uri={settings.GITHUB_REDIRECT_URI}",
                "client_id": settings.GITHUB_CLIENT_ID,
            }
        )
    if settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET and settings.GOOGLE_REDIRECT_URI:
        providers.append(
            {
                "name": "google",
                "url": f"https://accounts.google.com/o/oauth2/v2/auth?"
                f"client_id={settings.GOOGLE_CLIENT_ID}&redirect_uri={settings.GOOGLE_REDIRECT_URI}",
                "client_id": settings.GOOGLE_CLIENT_ID,
            }
        )
    return providers


@router.post("/register/request-verification")
async def request_verification(request: VerificationRequest, db: Session = Depends(get_db)):
    """请求发送验证码."""
    # 检查邮箱是否已被注册
    if db.query(User).filter(User.email == request.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该邮箱已被注册",
        )

    # 生成验证码
    code = auth_service.generate_verification_code()

    # 保存验证码
    auth_service.save_verification_code(str(request.email), code)

    # 发送验证码邮件
    if not email_service.send_verification_email(str(request.email), code):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="验证码发送失败",
        )

    return {"message": "验证码已发送到您的邮箱"}


@router.post("/register/verify", response_model=UserResponse)
async def verify_and_register(
    request: VerificationConfirmRequest,
    response: Response,
    request_obj: Request,
    db: Session = Depends(get_db),
):
    """验证验证码并完成注册."""
    # 验证验证码
    if not auth_service.verify_code(str(request.email), request.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码无效或已过期",
        )

    # 注册用户
    user = auth_service.register_user(
        db,
        str(request.email),
        request.username,
        request.password,
        request.full_name,
    )

    # 激活用户
    user = auth_service.activate_user(db, user.id)

    # 创建会话
    initial_data = {"registration_completed": True}
    session_id = session_manager.create_session(db, user, initial_data, request=request_obj)
    response.set_cookie(
        key=session_manager.cookie_name,
        value=session_id,
        httponly=True,
        max_age=60 * 60 * 24 * settings.SESSION_EXPIRE_DAYS,  # 转换为秒
        samesite="lax",
    )

    return user


@router.post("/login", response_model=UserResponse)
async def login(
    request: LoginRequest,
    response: Response,
    request_obj: Request,
    db: Session = Depends(get_db),
):
    """用户登录."""
    user = auth_service.authenticate_user(db, request.email, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="邮箱或密码错误",
        )

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账号未激活",
        )

    # 更新最后登录时间
    user.last_login = datetime.now()
    db.commit()

    # 创建会话
    initial_data = {"last_login": datetime.now().isoformat()}
    session_id = session_manager.create_session(db, user, initial_data, request=request_obj)
    response.set_cookie(
        key=session_manager.cookie_name,
        value=session_id,
        httponly=True,
        max_age=60 * 60 * 24 * settings.SESSION_EXPIRE_DAYS,  # 转换为秒
        samesite="lax",
    )

    return user


@router.post("/logout")
async def logout(
    response: Response,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """用户登出."""
    session_id = request.cookies.get(session_manager.cookie_name)
    if session_id:
        session_manager.delete_session(db, session_id)

    response.delete_cookie(session_manager.cookie_name)
    return {"message": "已成功登出"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
):
    """获取当前用户信息."""
    return current_user


@router.get("/sessions", response_model=List[SessionInfo])
async def get_user_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户的所有活跃会话."""
    return session_manager.get_user_sessions(db, current_user.id)


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """删除指定的会话."""
    # 获取要删除的会话
    session = db.query(DBSession).filter(DBSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="会话不存在",
        )

    # 验证会话是否属于当前用户
    if session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权删除此会话",
        )

    # 如果是当前会话，同时清除cookie
    current_session_id = request.cookies.get(session_manager.cookie_name)
    response = Response()
    if session_id == current_session_id:
        response.delete_cookie(session_manager.cookie_name)

    # 删除会话
    session_manager.delete_session(db, session_id)

    return {"message": "会话已删除"}
