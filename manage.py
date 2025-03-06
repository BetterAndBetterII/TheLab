#!/usr/bin/env python3
"""数据库管理工具。

用于执行数据库相关的管理操作，如迁移、初始化等。
"""

import argparse
import logging
import sys

import click

from config import get_settings
from database import Document, Folder, ProcessingStatus, SessionLocal, create_rag_db, create_tables
from models.users import User
from rag.knowledgebase import KnowledgeBase

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_db() -> None:
    """初始化数据库."""
    try:
        create_rag_db()
        create_tables()
        logger.info("数据库初始化完成")
    except Exception as e:
        logger.error(f"数据库初始化失败: {str(e)}")
        sys.exit(1)


def migrate_to_sessions() -> None:
    """迁移到新的sessions表."""
    try:
        logger.info("迁移完成")
    except Exception as e:
        logger.error(f"迁移失败: {str(e)}")
        sys.exit(1)


def create_system_user():
    """创建系统用户."""
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
    """创建超级用户."""
    db = SessionLocal()
    try:
        # 检查用户是否已存在
        existing_user = db.query(User).filter((User.username == username) | (User.email == email)).first()
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


def migrate_legacy_db():
    """迁移旧数据库."""
    db = SessionLocal()
    try:
        logger.info("迁移旧数据库...")
        # 读取sqlite，./tmp/persist/db.sqlite3
        import os
        import sqlite3

        conn = sqlite3.connect("./tmp/persist/db.sqlite3")
        cursor = conn.cursor()
        # 读取 api_project 表： id, name, created_at, updated_at
        cursor.execute("SELECT id, name, created_at, updated_at FROM api_project")
        projects = cursor.fetchall()
        # 读取 api_project_collections 表： id, project_id, collection_id
        cursor.execute("SELECT id, project_id, collection_id FROM api_project_collections")
        project_collections = cursor.fetchall()
        # 读取 api_collection 表： id, name, created_at, updated_at
        cursor.execute("SELECT id, name, created_at, updated_at FROM api_collection")
        collections = cursor.fetchall()
        # 读取 api_collection_documents 表： id, collection_id, document_id
        cursor.execute("SELECT id, collection_id, document_id FROM api_collection_documents")
        collections_documents = cursor.fetchall()
        # 读取 api_document 表： id, title, linked_file_path, linked_task_id, created_at, updated_at
        cursor.execute("SELECT id, title, linked_file_path, linked_task_id, created_at, updated_at FROM api_document")
        documents = cursor.fetchall()

        print(documents[:10])

        # 创建项目
        project_id_to_folder_id = {}
        project_id_to_project_name = {}
        for project in projects:
            project_id = project[0]
            project_name = project[1]
            project_created_at = project[2]
            project_updated_at = project[3]
            print(
                project_id,
                project_name,
                project_created_at,
                project_updated_at,
            )
            # 创建文件夹
            folder = Folder(
                name=project_name,
                path=f"/{project_name}",
                created_at=project_created_at,
                updated_at=project_updated_at,
                owner_id=1,
                is_folder=True,
            )
            db.add(folder)
            db.flush()
            db.refresh(folder)
            project_id_to_folder_id[project_id] = folder.id
            project_id_to_project_name[project_id] = project_name
            print(folder.id)

        # 集合对应项目的映射
        collection_id_to_project_id = {}
        for project_collection in project_collections:
            project_id = project_collection[1]
            collection_id = project_collection[2]
            collection_id_to_project_id[collection_id] = project_id

        # 创建集合
        collection_id_to_folder_id = {}
        folder_id_to_path = {}
        collection_id_to_collection_name = {}
        for collection in collections:
            collection_id = collection[0]
            collection_name = collection[1]
            collection_created_at = collection[2]
            collection_updated_at = collection[3]
            if not collection_id in collection_id_to_project_id:
                # 该集合已被无引用，被删除了
                continue
            # 所属的项目
            project_id = collection_id_to_project_id[collection_id]
            project_name = project_id_to_project_name[project_id]
            print(
                collection_id,
                collection_name,
                collection_created_at,
                collection_updated_at,
                project_id,
            )
            # 创建文件夹
            folder = Folder(
                name=collection_name,
                parent_id=project_id_to_folder_id[project_id],
                path=f"/{project_name}/{collection_name}",
                created_at=collection_created_at,
                updated_at=collection_updated_at,
                owner_id=1,
                is_folder=True,
            )
            db.add(folder)
            db.flush()
            db.refresh(folder)
            collection_id_to_folder_id[collection_id] = folder.id
            folder_id_to_path[folder.id] = folder.path
            collection_id_to_collection_name[collection_id] = collection_name

        # 文档对应集合的映射
        document_id_to_collection_id = {}
        for collection_document in collections_documents:
            collection_id = collection_document[1]
            document_id = collection_document[2]
            document_id_to_collection_id[document_id] = collection_id

        # 创建文档
        document_id_to_folder_id = {}
        # 读取文件夹，uuid/en/uuid_index_0.md  uuid/en/uuid_index_0.md  uuid/filename.pdf  uuid/thumbnail.png
        for doc in documents:
            doc_id = doc[0]
            doc_title = doc[1]
            doc_file_path = doc[2]
            doc_uuid = doc[2].split("/")[-1]
            doc_persist_path = os.path.join(os.path.dirname(__file__), "./tmp/persist", doc_uuid)
            doc_abs_path = os.path.join(doc_persist_path, doc_title)
            doc_thumbnail_path = os.path.join(doc_persist_path, "thumbnail.png")
            print(
                doc_title,
                doc_uuid,
                doc_file_path,
                doc_thumbnail_path,
            )
            if not doc_id in document_id_to_collection_id:
                # 该文档已被无引用，被删除了
                continue
            collection_id = document_id_to_collection_id[doc_id]
            if not collection_id in collection_id_to_folder_id:
                # 该集合已被无引用，被删除了
                continue
            folder_id = collection_id_to_folder_id[collection_id]
            folder_path = folder_id_to_path[folder_id]
            # 读取文件
            with open(doc_abs_path, "rb") as f:
                file_content = f.read()
            # 读取缩略图
            with open(doc_thumbnail_path, "rb") as f:
                thumbnail_content = f.read()
            # 读取内容页
            en_page_length = len(os.listdir(os.path.join(doc_persist_path, "en")))
            zh_page_length = len(os.listdir(os.path.join(doc_persist_path, "zh")))
            content_pages = {}
            translation_pages = {}
            for i in range(en_page_length):
                with open(
                    os.path.join(
                        doc_persist_path,
                        "en",
                        f"{doc_uuid}_index_{i}.md",
                    ),
                    "r",
                    encoding="utf-8",
                ) as f:
                    content_pages[str(i)] = f.read()
            for i in range(zh_page_length):
                with open(
                    os.path.join(
                        doc_persist_path,
                        "zh",
                        f"{doc_uuid}_index_{i}.md",
                    ),
                    "r",
                    encoding="utf-8",
                ) as f:
                    translation_pages[str(i)] = f.read()
            padding_length = max(en_page_length, zh_page_length)
            for i in range(padding_length):
                if i >= en_page_length:
                    content_pages[str(i)] = ""
                if i >= zh_page_length:
                    translation_pages[str(i)] = ""
            doc = Document(
                filename=doc_title,
                content_type="application/pdf",
                file_data=file_content,
                file_size=len(file_content),
                folder_id=folder_id,
                owner_id=1,  # 使用当前用户ID
                path=f"{folder_path}/{doc_title}",  # 构建完整路径
                is_folder=False,
                mime_type="application/pdf",
                processing_status=ProcessingStatus.COMPLETED,  # 设置初始状态为待处理
                content_pages=content_pages,
                summary_pages={},
                translation_pages=translation_pages,
                keywords_pages={},
                thumbnail=thumbnail_content,
                total_pages=padding_length,
            )
            db.add(doc)
            db.flush()
            db.refresh(doc)
            document_id_to_folder_id[doc.id] = folder_id

        logger.info(projects)
        db.commit()
        logger.info("迁移成功完成！")
    except Exception as e:
        # 如果发生任何错误，回滚所有更改
        db.rollback()
        logger.error(f"迁移失败，已回滚所有更改: {str(e)}")
        # 记录详细的错误信息
        logger.exception("详细错误信息：")
        sys.exit(1)

    finally:
        # 清理资源
        db.close()
        if "conn" in locals():
            conn.close()


def ingest_data():
    """导入数据."""
    import asyncio
    import platform

    async def process_documents(documents, rag):
        for document in documents:
            try:
                await rag.upload_document(document)
            except Exception as e:
                logger.error(f"处理文档 {document.filename} 时出错: {str(e)}")

    async def main():
        settings = get_settings()
        if settings.GLOBAL_MODE == "public":
            namespace = "public"
        else:
            raise ValueError("GLOBAL_MODE 必须为 public")

        pg_docs_uri = (
            f"postgresql+asyncpg://"
            f"{settings.DATABASE_USER}:{settings.DATABASE_PASSWORD}"
            f"@{settings.DATABASE_HOST}:{settings.DATABASE_PORT}/{settings.RAG_DATABASE_NAME}"
        )
        pg_vector_uri = (
            f"postgresql+asyncpg://"
            f"{settings.DATABASE_USER}:{settings.DATABASE_PASSWORD}"
            f"@{settings.DATABASE_HOST}:{settings.DATABASE_PORT}/{settings.RAG_DATABASE_NAME}"
        )
        rag = KnowledgeBase(
            pg_docs_uri,
            pg_vector_uri,
            "public",
            namespace,
        )
        db = SessionLocal()
        try:
            documents = db.query(Document).all()
            await process_documents(documents, rag)
            logger.info("导入数据完成")
        finally:
            db.close()

    if platform.system() == "Windows":
        # Windows 平台特殊处理
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    asyncio.run(main())


@click.group()
def cli():
    """TheLab 管理工具."""


@cli.command()
def initdb():
    """初始化数据库."""
    click.echo("正在初始化数据库...")
    init_db()
    click.echo("数据库表创建完成")
    click.echo("正在创建系统用户...")
    create_system_user()
    click.echo("数据库初始化完成")


@cli.command()
def from_legacy():
    """迁移旧数据库."""
    migrate_legacy_db()


@cli.command()
def ingest():
    """导入数据."""
    ingest_data()


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
    """创建超级用户."""
    create_superuser(username, email, password)


def main():
    """主函数."""
    parser = argparse.ArgumentParser(description="数据库管理工具")
    subparsers = parser.add_subparsers(help="可用命令")

    # 初始化数据库命令
    init_parser = subparsers.add_parser("init", help="初始化数据库")
    init_parser.set_defaults(func=init_db)

    # 从旧数据库迁移命令
    from_legacy_parser = subparsers.add_parser("from-legacy", help="从旧数据库迁移")
    from_legacy_parser.set_defaults(func=migrate_legacy_db)

    # 导入数据命令
    ingest_parser = subparsers.add_parser("ingest", help="导入数据")
    ingest_parser.set_defaults(func=ingest_data)

    # 迁移到sessions表命令
    migrate_parser = subparsers.add_parser("migrate-sessions", help="迁移到新的sessions表")
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
