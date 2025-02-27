import os

import pytest
from app.database import Base, get_db
from app.main import app
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# 创建测试数据库
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建测试数据库表
Base.metadata.create_all(bind=engine)


@pytest.fixture
def db_session():
    """提供测试数据库会话"""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    """提供测试客户端"""

    def override_get_db():
        try:
            yield db_session
        finally:
            db_session.close()

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


@pytest.fixture
def test_user(client):
    """创建测试用户"""
    user_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "testpassword123",
    }
    response = client.post("/auth/register", json=user_data)
    assert response.status_code == 200
    return response.json()


@pytest.fixture
def auth_headers(client, test_user):
    """提供认证头信息"""
    login_data = {"username": "testuser", "password": "testpassword123"}
    response = client.post("/auth/login", data=login_data)
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def test_document(client, auth_headers):
    """创建测试文档"""
    # 创建一个临时文件
    test_file_path = "test_document.txt"
    with open(test_file_path, "w") as f:
        f.write("This is a test document")

    # 上传文件
    with open(test_file_path, "rb") as f:
        response = client.post(
            "/documents/upload",
            files={"file": ("test.txt", f, "text/plain")},
            headers=auth_headers,
        )

    # 清理临时文件
    os.remove(test_file_path)

    assert response.status_code == 200
    return response.json()


@pytest.fixture
def cleanup_files():
    """清理测试文件"""
    yield
    # 测试后清理上传的文件
    upload_dir = "uploads"
    if os.path.exists(upload_dir):
        for file in os.listdir(upload_dir):
            if file.startswith("test_"):
                os.remove(os.path.join(upload_dir, file))
