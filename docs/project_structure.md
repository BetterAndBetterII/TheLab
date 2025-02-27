# 项目结构说明

## 目录结构

```
TheLab/
├── api/                    # API相关模型和视图
│   ├── models.py          # 数据模型定义
│   └── views.py           # API视图和路由处理
│
├── clients/               # 外部服务客户端
│   ├── client_pool.py     # 客户端连接池管理
│   ├── openai_client.py   # OpenAI API客户端
│   └── gemini_client.py   # Google Gemini API客户端
│
├── database/             # 数据库相关
│   ├── __init__.py       # 数据库初始化和会话管理
│   └── models/           # 数据库模型定义
│
├── models/               # 业务模型
│   ├── users.py          # 用户相关模型
│   └── forum.py          # 论坛相关模型
│
├── pipeline/             # 文档处理流水线
│   ├── document_pipeline.py  # 文档处理主流水线
│   └── processors/          # 各类文档处理器
│
├── prepdocs/            # 文档预处理模块
│   ├── parse_page.py     # 文档转换为图片
│   ├── parse_images.py   # 图片文本提取
│   └── translate.py      # 文本翻译处理
│
├── rag/                 # 检索增强生成
│   └── knowledgebase.py  # 知识库管理
│
├── routers/             # FastAPI路由
│   ├── auth.py          # 认证相关路由
│   ├── documents.py     # 文档管理路由
│   ├── conversations.py # 对话管理路由
│   └── forum.py         # 论坛相关路由
│
├── services/            # 业务服务层
│   ├── auth.py          # 认证服务
│   ├── email.py         # 邮件服务
│   ├── session.py       # 会话管理
│   └── forum.py         # 论坛服务
│
├── tasks/              # Celery任务
│   ├── celery_app.py    # Celery应用配置
│   └── document_tasks.py # 文档处理任务
│
├── docs/               # 项目文档
├── tests/              # 测试用例
├── data/               # 数据存储目录
│   ├── uploads/         # 上传文件存储
│   └── temp/           # 临时文件目录
│
├── main.py            # 应用入口
├── config.py          # 配置管理
├── requirements.txt   # 项目依赖
├── Dockerfile         # Docker构建文件
└── docker-compose.yml # Docker服务编排
```

## 模块职责说明

### 1. API模块 (`api/`)
- 定义数据模型和数据库结构
- 处理API请求和响应
- 实现API接口逻辑

### 2. 客户端模块 (`clients/`)
- 管理与外部服务的连接
- 实现API客户端连接池
- 处理API调用重试和错误

### 3. 数据库模块 (`database/`)
- 数据库连接和会话管理
- 定义数据库模型和关系
- 处理数据库迁移

### 4. 业务模型模块 (`models/`)
- 定义核心业务实体
- 实现业务逻辑和规则
- 处理数据验证和转换

### 5. 文档处理流水线 (`pipeline/`)
- 实现文档处理主流程
- 协调各个处理阶段
- 管理处理状态和错误

### 6. 文档预处理模块 (`prepdocs/`)
- 文档格式转换
- 图片文本提取
- 多语言翻译支持

### 7. 检索增强生成模块 (`rag/`)
- 知识库管理
- 文档索引和检索
- 向量存储接口

### 8. 路由模块 (`routers/`)
- API路由定义
- 请求参数验证
- 响应格式化

### 9. 服务模块 (`services/`)
- 实现核心业务逻辑
- 提供可复用的服务
- 处理跨模块调用

### 10. 任务模块 (`tasks/`)
- 异步任务定义
- 定时任务管理
- 任务状态追踪

## 关键功能流程

1. **文档处理流程**
   - 文档上传 → 格式转换 → 文本提取 → 翻译 → 知识库存储

2. **用户认证流程**
   - 注册 → 邮件验证 → 登录 → 会话管理

3. **对话增强流程**
   - 用户输入 → 知识检索 → 内容生成 → 响应优化

4. **论坛交互流程**
   - 发帖 → 智能回复 → 用户互动 → 内容管理

## 部署架构

1. **容器服务**
   - FastAPI应用服务器
   - Celery工作节点
   - Celery Beat定时任务
   - Flower监控服务

2. **数据存储**
   - PostgreSQL（pgvector）
   - Redis缓存和消息队列

3. **文件存储**
   - 本地文件系统
   - 临时文件管理
