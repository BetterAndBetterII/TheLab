from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.users import AIProvider, User
from services.session import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])


class AISettings(BaseModel):
    provider: AIProvider
    api_key: str
    base_url: Optional[str] = None
    model: Optional[str] = None
    max_tokens: Optional[int] = 500
    temperature: Optional[float] = 0.7


class AISettingsResponse(BaseModel):
    provider: AIProvider
    base_url: Optional[str]
    model: Optional[str]
    max_tokens: Optional[int]
    temperature: Optional[float]

    class Config:
        from_attributes = True


@router.get("/ai", response_model=AISettingsResponse)
async def get_ai_settings(
    current_user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户的AI设置"""
    user = db.query(User).filter(User.id == current_user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    return {
        "provider": user.ai_provider,
        "base_url": user.ai_base_url,
        "model": user.ai_model,
        "max_tokens": user.ai_max_tokens,
        "temperature": user.ai_temperature,
    }


@router.put("/ai", response_model=AISettingsResponse)
async def update_ai_settings(
    settings: AISettings,
    current_user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """更新用户的AI设置"""
    user = db.query(User).filter(User.id == current_user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    user.ai_provider = settings.provider
    user.ai_api_key = settings.api_key
    user.ai_base_url = settings.base_url
    user.ai_model = settings.model
    user.ai_max_tokens = settings.max_tokens
    user.ai_temperature = settings.temperature

    db.commit()
    db.refresh(user)

    return {
        "provider": user.ai_provider,
        "base_url": user.ai_base_url,
        "model": user.ai_model,
        "max_tokens": user.ai_max_tokens,
        "temperature": user.ai_temperature,
    }
