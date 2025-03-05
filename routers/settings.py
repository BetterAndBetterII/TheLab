import traceback
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from clients.openai_client import OpenAIClient
from config import Settings, get_settings
from database import ApiKey, get_db
from models.users import User
from services.session import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])


class BasicSettings(BaseModel):
    email: str
    fullName: str
    bio: str | None = None
    notifications: dict


class AISettings(BaseModel):
    apiKey: str
    baseUrl: str
    standardModel: str = "gemini-1.5-flash"
    advancedModel: str = "deepseek-r1"


class AISettingsResponse(BaseModel):
    email: str
    fullName: str
    bio: str | None = None
    notifications: dict
    aiConfig: dict
    globalLLM: str
    globalMODE: str
    isAdmin: bool

    class Config:
        from_attributes = True


@router.get("", response_model=AISettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """获取用户的设置"""
    if not current_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    return {
        "email": current_user.email,
        "fullName": current_user.full_name,
        "bio": current_user.bio,
        "notifications": {
            "email": current_user.notifications["email"],
            "push": current_user.notifications["push"],
        },
        "aiConfig": (
            {
                "apiKey": "***",
                "baseUrl": current_user.ai_base_url or "https://api.openai.com/v1",
                "standardModel": current_user.ai_standard_model or "gemini-1.5-flash",
                "advancedModel": current_user.ai_advanced_model or "deepseek-r1",
            }
            if settings.GLOBAL_LLM == "private"
            else {}
        ),
        "globalLLM": settings.GLOBAL_LLM,
        "globalMODE": settings.GLOBAL_MODE,
        "isAdmin": current_user.id in [1, 2],
    }


@router.post("/ai/test")
async def test_ai_settings(
    settings: AISettings,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """测试AI设置是否有效"""
    if settings.GLOBAL_LLM == "public":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="公共模式下无法测试AI设置",
        )
    try:
        openai_client = OpenAIClient(settings.apiKey, settings.baseUrl)
        if not await openai_client.test_connection(
            settings.standardModel, settings.advancedModel
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="连接测试失败: 请检查API密钥和基础URL是否正确",
            )
        else:
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在"
                )
            query = db.query(ApiKey).filter(ApiKey.user_id == current_user.id)
            if query.count() > 1:
                for api_key_model in query:
                    db.delete(api_key_model)
            api_key_model = (
                db.query(ApiKey).filter(ApiKey.user_id == current_user.id).first()
            )
            if not api_key_model:
                api_key_model = ApiKey(
                    key=settings.apiKey,
                    base_url=settings.baseUrl,
                    user_id=current_user.id,
                )
                db.add(api_key_model)
            current_user.ai_api_key = settings.apiKey
            current_user.ai_base_url = settings.baseUrl
            current_user.ai_standard_model = settings.standardModel
            current_user.ai_advanced_model = settings.advancedModel
            api_key_model.key = settings.apiKey
            api_key_model.base_url = settings.baseUrl
            api_key_model.created_at = datetime.now()
            api_key_model.last_used_at = None
            api_key_model.last_error_message = None
            db.commit()
            db.refresh(current_user)  # 刷新用户信息
            return {"status": "success", "message": "连接测试成功"}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"连接测试失败: {str(e)}"
        )


@router.put("", response_model=BasicSettings)
async def update_settings(
    settings: BasicSettings,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """更新用户的设置"""
    if not current_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    current_user.email = settings.email
    current_user.full_name = settings.fullName
    current_user.bio = settings.bio
    current_user.notifications = settings.notifications

    db.commit()
    db.refresh(current_user)

    return {
        "email": current_user.email,
        "fullName": current_user.full_name,
        "bio": current_user.bio,
        "notifications": current_user.notifications,
    }


@router.put("/ai", response_model=AISettingsResponse)
async def update_ai_settings(
    settings: AISettings,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    global_settings: Settings = Depends(get_settings),
):
    """更新用户的AI设置"""
    if global_settings.GLOBAL_LLM == "public":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="公共模式下无法更新AI设置",
        )
    if not current_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    # 先测试设置是否有效
    try:
        openai_client = OpenAIClient(settings.apiKey, settings.baseUrl)
        if not openai_client.test_connection(
            settings.standardModel, settings.advancedModel
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="连接测试失败: 请检查API密钥和基础URL是否正确",
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"AI设置无效: {str(e)}"
        )

    current_user.ai_api_key = settings.apiKey
    current_user.ai_base_url = settings.baseUrl
    current_user.ai_standard_model = settings.standardModel
    current_user.ai_advanced_model = settings.advancedModel

    db.commit()
    db.refresh(current_user)

    return {
        "apiKey": current_user.ai_api_key,
        "baseUrl": current_user.ai_base_url,
        "standardModel": current_user.ai_standard_model,
        "advancedModel": current_user.ai_advanced_model,
    }
