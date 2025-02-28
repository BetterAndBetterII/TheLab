"""迁移脚本：从用户表的session字段迁移到独立的sessions表。

此脚本将执行以下操作：
1. 创建新的sessions表
2. 将用户表中的session数据迁移到新表
3. 删除用户表中的旧session字段
"""

from datetime import datetime, timezone
import logging
from typing import Optional

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from config import get_settings
from database import Base, SessionLocal
from models.sessions import Session as DBSession
from models.users import User

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


def migrate_user_sessions(db: Session) -> None:
    """迁移用户的会话数据"""
    try:
        # 获取所有有活跃会话的用户
        users = db.query(User).filter(User.session_id.isnot(None)).all()
        logger.info(f"找到 {len(users)} 个有活跃会话的用户")

        for user in users:
            # 创建新的会话记录
            if user.session_id and user.session_expires_at and user.session_expires_at > datetime.now(timezone.utc):
                session = DBSession(
                    id=user.session_id,
                    user_id=user.id,
                    created_at=user.session_created_at or datetime.now(timezone.utc),
                    expires_at=user.session_expires_at,
                    last_accessed_at=datetime.now(timezone.utc),
                    data=user.session_data or {},
                )
                db.add(session)
                logger.info(f"为用户 {user.id} 创建新的会话记录")

        # 提交更改
        db.commit()
        logger.info("会话数据迁移完成")

    except Exception as e:
        db.rollback()
        logger.error(f"迁移过程中发生错误: {str(e)}")
        raise


def drop_old_session_columns(db: Session) -> None:
    """删除用户表中的旧session字段"""
    try:
        # 使用原始SQL删除列
        with db.begin():
            db.execute(
                text(
                    """
                    ALTER TABLE users 
                    DROP COLUMN IF EXISTS session_id,
                    DROP COLUMN IF EXISTS session_created_at,
                    DROP COLUMN IF EXISTS session_expires_at,
                    DROP COLUMN IF EXISTS session_data;
                    """
                )
            )
        logger.info("已删除用户表中的旧session字段")

    except Exception as e:
        logger.error(f"删除旧字段时发生错误: {str(e)}")
        raise


def main():
    """执行迁移"""
    logger.info("开始数据迁移...")
    
    # 创建数据库会话
    db = SessionLocal()
    try:
        # 确保sessions表存在
        Base.metadata.create_all(bind=db.get_bind())
        logger.info("已创建sessions表")

        # 迁移会话数据
        migrate_user_sessions(db)

        # 删除旧字段
        drop_old_session_columns(db)

        logger.info("迁移完成!")

    except Exception as e:
        logger.error(f"迁移失败: {str(e)}")
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main() 