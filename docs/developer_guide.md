# 开发者指南

## 开发环境设置

### 系统要求
- Python 3.11+
- PostgreSQL 14+
- Redis 6+
- LibreOffice (用于文档转换)
- Poppler-utils (用于PDF处理)

### 本地开发环境设置

1. 克隆代码仓库
```bash
git clone https://github.com/yourusername/TheLab.git
cd TheLab
```

2. 创建虚拟环境
```bash
python -m venv venv
source venv/bin/activate  # Linux/macOS
.\venv\Scripts\activate   # Windows
```

3. 安装依赖
```bash
pip install -r requirements.txt
```

4. 配置环境变量
复制 `.env.example` 到 `.env` 并修改配置：
```bash
cp .env.example .env
```

## 代码规范

### Python代码规范
- 遵循 PEP 8 规范
- 使用 4 空格缩进
- 最大行长度 120 字符
- 使用类型注解
- 编写文档字符串

### 命名规范
- 类名：使用 PascalCase
- 函数和变量：使用 snake_case
- 常量：使用大写 SNAKE_CASE
- 私有成员：使用下划线前缀 _

### 注释规范
```python
def complex_function(param1: str, param2: int) -> dict:
    """
    函数功能简述

    Args:
        param1 (str): 参数1的说明
        param2 (int): 参数2的说明

    Returns:
        dict: 返回值说明

    Raises:
        ValueError: 异常说明
    """
    pass
```

## 架构设计

### 分层架构
1. 表示层 (API)
   - routers/: API路由和请求处理
   - models/: 请求/响应模型

2. 业务层 (Services)
   - services/: 业务逻辑实现
   - pipeline/: 文档处理流水线
   - rag/: 知识库检索生成

3. 数据层 (Database)
   - database/: 数据库模型和操作
   - clients/: 外部服务客户端

### 关键组件

1. 文档处理流水线
```python
Document -> Stage1(解析) -> Stage2(提取) -> Stage3(翻译) -> Stage4(存储)
```

2. 会话管理
```python
Request -> SessionManager -> Redis -> User
```

3. RAG检索生成
```python
Query -> VectorDB检索 -> 重排序 -> 上下文增强 -> 生成
```

## 开发流程

### 功能开发流程
1. 创建功能分支
```bash
git checkout -b feature/xxx
```

2. 编写测试用例
```python
def test_new_feature():
    # 准备测试数据
    # 执行测试
    # 验证结果
```

3. 实现功能代码
4. 运行测试
```bash
pytest tests/
```

5. 提交代码
```bash
git add .
git commit -m "feat: 添加新功能xxx"
```

### 代码审查清单
- [ ] 代码符合规范
- [ ] 测试覆盖充分
- [ ] 文档已更新
- [ ] 性能已优化
- [ ] 安全已考虑

## 测试指南

### 单元测试
```python
# tests/test_service.py
def test_document_processing():
    # 准备测试数据
    doc = create_test_document()

    # 执行测试
    result = process_document(doc)

    # 验证结果
    assert result.status == "completed"
    assert len(result.pages) > 0
```

### 集成测试
```python
# tests/integration/test_api.py
async def test_document_upload():
    # 准备测试客户端
    client = TestClient(app)

    # 执行测试
    response = await client.post("/documents/upload", files={"file": test_file})

    # 验证结果
    assert response.status_code == 200
    assert "document_id" in response.json()
```

## 性能优化

### 数据库优化
1. 索引优化
```sql
CREATE INDEX idx_documents_status ON documents(processing_status);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
```

2. 查询优化
```python
# 使用 select_from 优化连接查询
query = (
    select(Document)
    .select_from(Document)
    .join(Folder)
    .options(selectinload(Document.folder))
)
```

### 缓存策略
1. Redis缓存
```python
# 缓存用户会话
session_data = await redis.get(f"session:{session_id}")
if not session_data:
    session_data = await load_session_from_db()
    await redis.setex(f"session:{session_id}", 3600, session_data)
```

2. 页面缓存
```python
# 缓存文档页面
@cache(ttl=3600)
async def get_document_page(document_id: int, page: int):
    return await load_page_content(document_id, page)
```

## 错误处理

### 异常处理
```python
try:
    await process_document(doc_id)
except DocumentNotFoundError:
    raise HTTPException(status_code=404, detail="文档不存在")
except ProcessingError as e:
    logger.error(f"处理失败: {str(e)}")
    raise HTTPException(status_code=500, detail="处理失败")
```

### 日志记录
```python
# 配置结构化日志
logging.config.dictConfig({
    "version": 1,
    "formatters": {
        "json": {
            "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "fmt": "%(asctime)s %(name)s %(levelname)s %(message)s"
        }
    },
    "handlers": {
        "json": {
            "class": "logging.StreamHandler",
            "formatter": "json"
        }
    },
    "loggers": {
        "app": {
            "handlers": ["json"],
            "level": "INFO"
        }
    }
})
```

## 安全指南

### 数据安全
1. 密码加密
```python
# 使用 bcrypt 加密密码
password_hash = pwd_context.hash(password)
```

2. 敏感数据加密
```python
# 使用 Fernet 加密API密钥
fernet = Fernet(settings.ENCRYPTION_KEY)
encrypted_key = fernet.encrypt(api_key.encode())
```

### API安全
1. 输入验证
```python
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    username: str = Field(..., regex="^[a-zA-Z0-9_-]+$")
```

2. CORS配置
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 部署检查清单

### 上线前检查
- [ ] 所有测试通过
- [ ] 性能测试达标
- [ ] 安全扫描通过
- [ ] 文档已更新
- [ ] 监控已配置
- [ ] 备份已设置

### 发布流程
1. 合并代码到主分支
2. 创建发布标签
3. 执行自动化测试
4. 构建生产镜像
5. 执行数据库迁移
6. 更新生产服务
7. 验证服务状态

## 常见问题

### 开发环境问题
1. 数据库连接失败
   - 检查PostgreSQL服务是否运行
   - 验证连接参数是否正确
   - 确认网络连接是否正常

2. Redis连接错误
   - 检查Redis服务状态
   - 验证密码配置
   - 确认端口是否正确

### 部署问题
1. Docker构建失败
   - 检查Dockerfile语法
   - 确认基础镜像可用
   - 验证构建上下文

2. 服务启动失败
   - 检查日志输出
   - 验证配置文件
   - 确认依赖服务状态
