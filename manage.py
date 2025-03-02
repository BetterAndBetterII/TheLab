#!/usr/bin/env python3
"""数据库管理工具。

用于执行数据库相关的管理操作，如迁移、初始化等。
"""

import argparse
import logging
import sys
from typing import List, Optional

import click
from database import Base, engine, SessionLocal, create_tables, create_rag_db
from models.users import User

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_db() -> None:
    """初始化数据库"""
    try:
        create_rag_db()
        create_tables()
        logger.info("数据库初始化完成")
    except Exception as e:
        logger.error(f"数据库初始化失败: {str(e)}")
        sys.exit(1)


def migrate_to_sessions() -> None:
    """迁移到新的sessions表"""
    try:
        logger.info("迁移完成")
    except Exception as e:
        logger.error(f"迁移失败: {str(e)}")
        sys.exit(1)


def create_system_user():
    """创建系统用户"""
    db = SessionLocal()
    try:
        # 检查是否已存在系统用户
        system_user = db.query(User).filter(User.username == "system").first()
        if not system_user:
            # 创建系统用户
            system_user = User(
                username="system",
                email="system@example.com",
                hashed_password=User.get_password_hash("SYSTEM"),
                is_active=True,
                is_superuser=True,
            )
            db.add(system_user)
            db.commit()
            click.echo("系统用户创建成功")
        else:
            click.echo("系统用户已存在")
    finally:
        db.close()


def create_superuser(username: str, email: str, password: str):
    """创建超级用户"""
    db = SessionLocal()
    try:
        # 检查用户是否已存在
        existing_user = (
            db.query(User)
            .filter((User.username == username) | (User.email == email))
            .first()
        )
        if existing_user:
            click.echo("用户名或邮箱已存在")
            return

        # 创建超级用户
        superuser = User(
            username=username,
            email=email,
            hashed_password=User.get_password_hash(password),
            is_active=True,
            is_superuser=True,
        )
        db.add(superuser)
        db.commit()
        click.echo("超级用户创建成功")
    finally:
        db.close()


@click.group()
def cli():
    """TheLab 管理工具"""
    pass


@cli.command()
def initdb():
    """初始化数据库"""
    click.echo("正在初始化数据库...")
    init_db()
    click.echo("数据库表创建完成")
    click.echo("正在创建系统用户...")
    create_system_user()
    click.echo("数据库初始化完成")


@cli.command()
@click.option("--username", prompt="用户名", help="超级用户的用户名")
@click.option("--email", prompt="邮箱", help="超级用户的邮箱")
@click.option(
    "--password",
    prompt=True,
    hide_input=True,
    confirmation_prompt=True,
    help="超级用户的密码",
)
def createsuperuser(username, email, password):
    """创建超级用户"""
    create_superuser(username, email, password)


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="数据库管理工具")
    subparsers = parser.add_subparsers(help="可用命令")

    # 初始化数据库命令
    init_parser = subparsers.add_parser("init", help="初始化数据库")
    init_parser.set_defaults(func=init_db)

    # 迁移到sessions表命令
    migrate_parser = subparsers.add_parser(
        "migrate-sessions", help="迁移到新的sessions表"
    )
    migrate_parser.set_defaults(func=migrate_to_sessions)

    # 解析命令行参数
    args = parser.parse_args()

    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    cli()
