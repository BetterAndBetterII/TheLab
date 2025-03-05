# 使用多阶段构建，创建基础镜像层
FROM python:3.11-slim@sha256:614c8691ab74150465ec9123378cd4dde7a6e57be9e558c3108df40664667a4c AS base

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    poppler-utils \
    libreoffice \
    && rm -rf /var/lib/apt/lists/*

FROM node:18@sha256:ba756f198b4b1e0114b53b23121c8ae27f7ae4d5d95ca4a0554b0649cc9c7dcf AS frontend-builder

# 设置前端构建工作目录
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install pnpm -g
RUN pnpm install
COPY frontend/ .
RUN pnpm run build

# 创建新的构建阶段，继承基础镜像
FROM base

# 设置工作目录
WORKDIR /app

# 首先只复制依赖文件
COPY requirements.txt .

# 安装Python依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制项目代码
COPY . .

COPY --from=frontend-builder /frontend/dist /app/frontend/dist

EXPOSE 8000

# 设置默认命令
# uvicorn main:app --host 0.0.0.0 --port 8000 --reload
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
