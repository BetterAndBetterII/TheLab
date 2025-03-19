# TheLab - AI文档处理系统

## 项目简介

TheLab 是一个基于 FastAPI 的 AI 文档处理系统，提供文档上传、文本提取、智能分析、翻译等功能。系统采用现代化的技术栈，支持多种 AI 模型，并具有良好的可扩展性。

### 主要特性

- 🚀 支持多种文档格式（PDF、Word、PPT等）
- 🤖 集成多个AI模型（OpenAI、Google Gemini）
- 📝 智能文档分析和摘要生成
- 🌐 翻译
- 💬 智能对话和内容增强
- 📊 思维导图知识图谱
- 🔒 安全的用户认证和权限管理

## 快速开始

### 使用 Docker（推荐）

1. 克隆仓库
```bash
git clone https://github.com/yourusername/TheLab.git
cd TheLab
```

2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，填写必要的配置
```

3. 启动服务
```bash
docker-compose up -d
```

4. 访问系统
```
http://localhost:8000
```

### 手动安装

1. 安装依赖
```bash
pip install -r requirements.txt
```

2. 配置环境
```bash
cp .env.example .env
# 编辑 .env 文件
```

3. 启动服务
```bash
uvicorn main:app --reload
```

## 系统架构

```
TheLab/
├── api/          # API层
├── services/     # 业务服务层
├── database/     # 数据访问层
├── models/       # 数据模型
├── pipeline/     # 文档处理流水线
├── rag/          # 知识库检索生成
└── tasks/        # 异步任务
```

### 技术栈

- 后端框架：FastAPI
- 数据库：PostgreSQL
- 缓存：Redis
- AI模型：OneAPI中转的OpenAI API、Google Gemini
- 文档处理：LibreOffice、Poppler
- 容器化：Docker

## 许可证

本项目采用 MIT 许可证，详见 [LICENSE](LICENSE) 文件。
