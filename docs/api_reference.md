# API 参考文档

## 认证接口

### 用户注册
```http
POST /auth/register/request-verification
Content-Type: application/json

{
    "email": "user@example.com"
}
```

### 验证注册
```http
POST /auth/register/verify
Content-Type: application/json

{
    "email": "user@example.com",
    "code": "123456",
    "username": "username",
    "password": "password",
    "full_name": "Full Name"
}
```

### 用户登录
```http
POST /auth/login
Content-Type: application/json

{
    "email": "user@example.com",
    "password": "password"
}
```

## 文档管理

### 上传文档
```http
POST /documents/upload
Content-Type: multipart/form-data

file: [文件]
folder_id: [可选，文件夹ID]
```

### 获取文档列表
```http
GET /documents?folder_id={folder_id}
```

### 获取文档详情
```http
GET /documents/{document_id}
```

## 对话管理

### 创建对话
```http
POST /conversations
Content-Type: application/json

{
    "title": "对话标题",
    "document_ids": [1, 2, 3]
}
```

### 发送消息
```http
POST /conversations/{conversation_id}/messages
Content-Type: application/json

{
    "content": "消息内容",
    "position_x": 0.5,
    "position_y": 0.5
}
```

### 增强消息
```http
POST /conversations/enhance-page
Content-Type: application/json

{
    "conversation_id": 1,
    "document_id": 1,
    "page": 1,
    "enhancement_types": ["summary", "core_analysis", "questions"],
    "window_size": 3
}
```

## 论坛管理

### 创建主题
```http
POST /forum/topics
Content-Type: application/json

{
    "title": "主题标题",
    "content": "主题内容",
    "category": "general",
    "enable_agent": true
}
```

### 回复主题
```http
POST /forum/topics/{topic_id}/replies
Content-Type: application/json

{
    "content": "回复内容",
    "parent_id": null,
    "enable_agent": true
}
```

## 设置管理

### 获取AI设置
```http
GET /settings/ai
```

### 更新AI设置
```http
PUT /settings/ai
Content-Type: application/json

{
    "provider": "openai",
    "api_key": "your-api-key",
    "base_url": "https://api.openai.com/v1",
    "model": "gpt-4",
    "max_tokens": 500,
    "temperature": 0.7
}
```

## 响应格式

### 成功响应
```json
{
    "status": "success",
    "data": {
        // 响应数据
    }
}
```

### 错误响应
```json
{
    "status": "error",
    "error": {
        "code": "ERROR_CODE",
        "message": "错误信息"
    }
}
```

## 状态码说明

- 200: 请求成功
- 201: 创建成功
- 400: 请求参数错误
- 401: 未认证
- 403: 权限不足
- 404: 资源不存在
- 500: 服务器错误

## 注意事项

1. 所有需要认证的接口都需要在请求头中包含 `session_id` Cookie
2. 文件上传大小限制为 50MB
3. 图片格式支持：PNG, JPEG, PDF
4. API 限流：每个用户每分钟 100 次请求
5. 文档处理为异步操作，需要轮询状态
