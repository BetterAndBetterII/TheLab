from celery import Celery

from config import get_settings

settings = get_settings()

# 创建Celery实例
celery_app = Celery(
    "ai_doc_system",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["tasks.document_tasks"],
)

# Celery配置
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    # 定时任务配置
    beat_schedule={
        "process-documents": {
            "task": "tasks.document_tasks.process_pending_documents",
            "schedule": settings.TASK_PROCESSING_INTERVAL,
        },
        "sync-documents-to-rag": {
            "task": "tasks.document_tasks.sync_documents_to_rag",
            "schedule": 3600.0,  # 每1小时执行一次
        },
    },
    # 并发配置
    worker_concurrency=settings.MAX_CONCURRENT_TASKS,
    task_acks_late=True,  # 任务完成后再确认
    task_reject_on_worker_lost=True,  # worker异常时重新分配任务
    # 任务超时设置
    task_soft_time_limit=300,  # 5分钟软超时
    task_time_limit=600,  # 10分钟硬超时
)
