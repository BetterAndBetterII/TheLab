# 测试运行指南

## 测试环境设置

1. 安装测试依赖
```bash
pip install -r requirements-dev.txt
```

requirements-dev.txt 包含以下依赖：
```
pytest==7.4.3
pytest-asyncio==0.21.1
pytest-cov==4.1.0
httpx==0.25.1
```

2. 配置测试环境变量
```bash
cp .env.example .env.test
```

编辑 `.env.test` 文件，设置测试环境的配置：
```env
DATABASE_TYPE=sqlite
DATABASE_NAME=:memory:
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 运行测试

### 运行所有测试
```bash
pytest
```

### 运行特定测试文件
```bash
pytest tests/test_auth.py
pytest tests/test_documents.py
```

### 运行特定测试用例
```bash
pytest tests/test_auth.py::test_login_user
```

### 运行测试并显示详细输出
```bash
pytest -v
```

### 运行测试并显示打印信息
```bash
pytest -s
```

### 运行测试并生成覆盖率报告
```bash
pytest --cov=app --cov-report=html
```

覆盖率报告将生成在 `htmlcov` 目录中。

## 测试结构

```
tests/
├── conftest.py          # 测试配置和fixtures
├── test_auth.py         # 认证相关测试
└── test_documents.py    # 文档相关测试
```

### 主要测试组件

1. `conftest.py`
   - 数据库配置
   - 测试客户端
   - 通用fixtures

2. `test_auth.py`
   - 用户注册测试
   - 用户登录测试
   - 用户信息测试
   - 登出测试

3. `test_documents.py`
   - 文档上传测试
   - 文档获取测试
   - 文档列表测试
   - 错误处理测试

## 编写测试指南

### 1. 使用 Fixtures

```python
@pytest.fixture
def test_data():
    return {"key": "value"}

def test_something(test_data):
    assert test_data["key"] == "value"
```

### 2. 测试异步函数

```python
@pytest.mark.asyncio
async def test_async_function():
    result = await some_async_function()
    assert result is not None
```

### 3. 模拟外部服务

```python
from unittest.mock import patch

def test_external_service():
    with patch("module.external_service") as mock_service:
        mock_service.return_value = "mocked_result"
        result = function_using_external_service()
        assert result == "mocked_result"
```

### 4. 参数化测试

```python
@pytest.mark.parametrize("input,expected", [
    ("test1", "result1"),
    ("test2", "result2"),
])
def test_multiple_inputs(input, expected):
    assert process_input(input) == expected
```

## 最佳实践

1. 测试命名规范
   - 使用描述性名称
   - 遵循 `test_应该做什么_当什么情况` 格式

2. 测试组织
   - 按功能模块组织测试文件
   - 相关测试放在同一个类中

3. 断言最佳实践
   - 每个测试只测试一个功能点
   - 使用具体的断言消息
   - 测试边界条件和错误情况

4. 测试数据管理
   - 使用 fixtures 管理测试数据
   - 每个测试后清理数据
   - 避免测试间的数据依赖

## 常见问题

### 1. 测试数据库连接失败
- 检查数据库配置
- 确保测试数据库存在
- 验证权限设置

### 2. 异步测试失败
- 使用 `@pytest.mark.asyncio` 装饰器
- 确保正确使用 `await`
- 检查事件循环配置

### 3. 测试覆盖率不足
- 检查未测试的代码路径
- 添加边界条件测试
- 包含错误处理测试

### 4. 测试执行太慢
- 使用内存数据库
- 模拟耗时操作
- 并行执行测试
