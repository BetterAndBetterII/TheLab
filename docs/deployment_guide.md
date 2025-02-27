# 部署指南

## 系统要求

- Docker 20.10+
- Docker Compose 2.0+
- 至少 4GB RAM
- 至少 20GB 磁盘空间
- 支持的操作系统：
  - Ubuntu 20.04/22.04 LTS
  - CentOS 8
  - Windows Server 2019/2022
  - macOS 12+

## 环境准备

1. 安装 Docker
```bash
curl -fsSL https://get.docker.com | sh
```

2. 安装 Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

3. 创建必要的目录
```bash
mkdir -p data/{postgres,redis,uploads}
```

## 配置文件

1. 创建环境变量文件 `.env`：
```env
# 应用配置
APP_NAME=TheLab
APP_ENV=production
DEBUG=false
SECRET_KEY=your-secret-key
ALLOWED_HOSTS=*

# 数据库配置
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-password
POSTGRES_DB=thelab
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Redis配置
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0

# AI服务配置
OPENAI_API_KEY=your-openai-key
GEMINI_API_KEY=your-gemini-key

# 邮件配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

## 部署步骤

1. 克隆代码仓库
```bash
git clone https://github.com/yourusername/TheLab.git
cd TheLab
```

2. 构建 Docker 镜像
```bash
docker-compose build
```

3. 启动服务
```bash
docker-compose up -d
```

4. 执行数据库迁移
```bash
docker-compose exec app python manage.py migrate
```

5. 创建超级用户
```bash
docker-compose exec app python manage.py createsuperuser
```

## 服务管理

### 查看服务状态
```bash
docker-compose ps
```

### 查看服务日志
```bash
docker-compose logs -f [service_name]
```

### 重启服务
```bash
docker-compose restart [service_name]
```

### 停止服务
```bash
docker-compose down
```

## 备份与恢复

### 数据库备份
```bash
docker-compose exec postgres pg_dump -U postgres thelab > backup.sql
```

### 数据库恢复
```bash
cat backup.sql | docker-compose exec -T postgres psql -U postgres thelab
```

### 文件备份
```bash
tar -czf uploads_backup.tar.gz data/uploads/
```

## 监控与维护

1. 使用 Prometheus 和 Grafana 监控系统指标
2. 定期检查日志文件
3. 设置自动备份任务
4. 配置告警通知

## 安全建议

1. 更改默认密码
2. 限制访问IP
3. 启用 HTTPS
4. 定期更新依赖包
5. 配置防火墙规则

## 故障排除

### 常见问题

1. 数据库连接失败
   - 检查数据库配置
   - 确认数据库服务状态
   - 验证网络连接

2. Redis 连接错误
   - 检查 Redis 配置
   - 确认 Redis 服务状态
   - 验证内存使用情况

3. 文件上传失败
   - 检查目录权限
   - 确认磁盘空间
   - 验证文件大小限制

### 日志位置

- 应用日志：`/app/logs/`
- Nginx 日志：`/var/log/nginx/`
- PostgreSQL 日志：`/var/lib/postgresql/data/log/`

## 性能优化

1. 数据库优化
   - 添加适当的索引
   - 优化查询语句
   - 配置连接池

2. 缓存优化
   - 配置 Redis 缓存
   - 使用页面缓存
   - CDN 加速

3. 应用优化
   - 异步任务处理
   - 代码性能优化
   - 负载均衡

## 升级指南

1. 备份数据
```bash
./scripts/backup.sh
```

2. 拉取最新代码
```bash
git pull origin main
```

3. 重建镜像
```bash
docker-compose build
```

4. 执行迁移
```bash
docker-compose run --rm app python manage.py migrate
```

5. 重启服务
```bash
docker-compose down
docker-compose up -d
```

## 联系支持

- 技术支持邮箱：support@example.com
- 问题追踪：https://github.com/yourusername/TheLab/issues
- 文档网站：https://docs.thelab.example.com
