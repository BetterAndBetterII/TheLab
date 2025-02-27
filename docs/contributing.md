# 贡献指南

## 欢迎贡献

感谢您对项目的关注！我们欢迎任何形式的贡献，包括但不限于：

- 报告问题
- 提交功能建议
- 改进文档
- 提交代码修复
- 添加新功能
- 优化性能

## 如何贡献

### 报告问题

1. 使用 GitHub Issues 提交问题
2. 使用问题模板填写必要信息
3. 提供详细的复现步骤
4. 附上相关的日志和截图

### 提交代码

1. Fork 项目仓库
2. 创建功能分支
```bash
git checkout -b feature/your-feature
```

3. 提交变更
```bash
git add .
git commit -m "feat: 添加新功能xxx"
```

4. 推送到远程
```bash
git push origin feature/your-feature
```

5. 创建 Pull Request

### 代码提交规范

提交信息格式：
```
<type>(<scope>): <subject>

<body>

<footer>
```

类型（type）：
- feat: 新功能
- fix: 修复问题
- docs: 文档变更
- style: 代码格式
- refactor: 代码重构
- perf: 性能优化
- test: 测试相关
- chore: 构建过程或辅助工具的变动

示例：
```
feat(auth): 添加邮箱验证功能

- 添加邮箱验证服务
- 实现验证码发送
- 添加验证接口

Closes #123
```

### 分支管理

- main: 主分支，用于发布
- develop: 开发分支
- feature/*: 功能分支
- bugfix/*: 问题修复
- release/*: 发布准备

### 代码审查

提交 PR 后：
1. 等待 CI 检查通过
2. 等待代码审查
3. 根据反馈进行修改
4. 合并到目标分支

## 开发指南

### 环境设置

1. 安装依赖
```bash
pip install -r requirements-dev.txt
```

2. 安装预提交钩子
```bash
pre-commit install
```

### 代码风格

使用 black 格式化代码：
```bash
black .
```

使用 isort 排序导入：
```bash
isort .
```

使用 flake8 检查代码：
```bash
flake8 .
```

### 运行测试

1. 单元测试
```bash
pytest tests/unit
```

2. 集成测试
```bash
pytest tests/integration
```

3. 测试覆盖率
```bash
pytest --cov=app tests/
```

## 文档贡献

### 文档结构

```
docs/
├── api_reference.md     # API参考
├── deployment_guide.md  # 部署指南
├── developer_guide.md   # 开发者指南
└── contributing.md      # 贡献指南
```

### 文档风格

- 使用 Markdown 格式
- 保持简洁明了
- 提供代码示例
- 包含必要的说明

### 文档检查

1. 检查拼写错误
2. 验证链接有效性
3. 确保格式正确
4. 更新目录索引

## 发布流程

### 版本号规范

遵循语义化版本 2.0.0：
- 主版本号：不兼容的API修改
- 次版本号：向下兼容的功能性新增
- 修订号：向下兼容的问题修正

### 发布步骤

1. 更新版本号
```bash
bump2version patch  # 或 minor 或 major
```

2. 更新更新日志
```markdown
## [0.2.1] - 2024-03-20

### 新增
- 功能A
- 功能B

### 修复
- 问题X
- 问题Y
```

3. 创建发布标签
```bash
git tag -a v0.2.1 -m "发布0.2.1版本"
git push origin v0.2.1
```

## 社区参与

### 行为准则

1. 尊重所有贡献者
2. 保持专业和友善
3. 接受建设性批评
4. 关注问题本身

### 交流渠道

- GitHub Issues: 问题报告和讨论
- GitHub Discussions: 一般讨论
- 邮件列表: 重要通知

### 获取帮助

1. 查看文档
2. 搜索已有问题
3. 创建新的问题
4. 参与讨论

## 奖励计划

### 贡献者等级

- 新手贡献者：首次贡献
- 活跃贡献者：持续贡献
- 核心贡献者：重要贡献

### 荣誉表彰

- README 贡献者列表
- 特别感谢名单
- 贡献者徽章

## 法律事项

### 许可证

本项目采用 MIT 许可证：
```
MIT License

Copyright (c) 2024 TheLab

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software...
```

### 贡献者协议

提交代码即表示您同意：
1. 您的代码将使用项目的开源协议
2. 您有权提交该代码
3. 您同意遵守项目的行为准则
