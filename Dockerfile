# 使用多阶段构建，创建基础镜像层
FROM python:3.11-slim@sha256:614c8691ab74150465ec9123378cd4dde7a6e57be9e558c3108df40664667a4c AS base

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    poppler-utils \
    libreoffice \
    && rm -rf /var/lib/apt/lists/*

# 创建依赖层
FROM base AS python-deps

# 设置工作目录
WORKDIR /deps

# 只复制依赖文件
COPY requirements.txt .

# 安装Python依赖
RUN pip install --no-cache-dir -r requirements.txt

# 前端构建层
FROM node:18@sha256:ba756f198b4b1e0114b53b23121c8ae27f7ae4d5d95ca4a0554b0649cc9c7dcf AS frontend-builder

# 设置前端构建工作目录
WORKDIR /frontend
COPY frontend/package*.json frontend/pnpm-lock.yaml ./
RUN npm install pnpm -g
RUN pnpm install
COPY frontend/ .
RUN pnpm run build

# 最终运行层
FROM base AS runner

# 设置工作目录
WORKDIR /app

# 从依赖层复制 Python 依赖
COPY --from=python-deps /usr/local/lib/python3.11/site-packages/ /usr/local/lib/python3.11/site-packages/
COPY --from=python-deps /usr/local/bin/ /usr/local/bin/

# 复制项目代码
COPY . .

# 从前端构建层复制构建产物
COPY --from=frontend-builder /frontend/dist /app/frontend/dist

EXPOSE 8000

# 设置默认命令
# uvicorn main:app --host 0.0.0.0 --port 8000 --reload
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
