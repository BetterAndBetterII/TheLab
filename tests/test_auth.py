import pytest
from fastapi import status


def test_register_user(client):
    """测试用户注册功能"""
    user_data = {
        "username": "newuser",
        "email": "newuser@example.com",
        "password": "newpassword123",
    }

    response = client.post("/auth/register", json=user_data)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "user_id" in data
    assert data["username"] == user_data["username"]
    assert data["email"] == user_data["email"]


def test_login_user(client, test_user):
    """测试用户登录功能"""
    login_data = {"username": "testuser", "password": "testpassword123"}

    response = client.post("/auth/login", data=login_data)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert "token_type" in data
    assert data["token_type"] == "bearer"


def test_get_current_user(client, auth_headers):
    """测试获取当前用户信息功能"""
    response = client.get("/auth/me", headers=auth_headers)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "username" in data
    assert "email" in data
    assert "user_id" in data


def test_logout_user(client, auth_headers):
    """测试用户登出功能"""
    response = client.post("/auth/logout", headers=auth_headers)

    assert response.status_code == status.HTTP_200_OK

    # 验证token已失效
    response = client.get("/auth/me", headers=auth_headers)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_register_duplicate_user(client, test_user):
    """测试注册重复用户"""
    user_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "testpassword123",
    }

    response = client.post("/auth/register", json=user_data)

    assert response.status_code == status.HTTP_400_BAD_REQUEST


def test_login_invalid_credentials(client):
    """测试使用无效凭据登录"""
    login_data = {"username": "nonexistent", "password": "wrongpassword"}

    response = client.post("/auth/login", data=login_data)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_password_reset_request(client, test_user):
    """测试密码重置请求功能"""
    email_data = {"email": "test@example.com"}

    response = client.post("/auth/password-reset-request", json=email_data)

    assert response.status_code == status.HTTP_200_OK


def test_password_reset(client, test_user):
    """测试密码重置功能"""
    # 注意：这里假设我们有一个有效的重置token
    reset_data = {
        "token": "valid_reset_token",
        "new_password": "newpassword123",
    }

    response = client.post("/auth/password-reset", json=reset_data)

    assert response.status_code == status.HTTP_200_OK

    # 验证新密码可以登录
    login_data = {"username": "testuser", "password": "newpassword123"}

    response = client.post("/auth/login", data=login_data)
    assert response.status_code == status.HTTP_200_OK


def test_update_user_profile(client, auth_headers):
    """测试更新用户资料功能"""
    update_data = {"full_name": "Test User", "bio": "This is a test bio"}

    response = client.patch("/auth/profile", json=update_data, headers=auth_headers)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["full_name"] == update_data["full_name"]
    assert data["bio"] == update_data["bio"]


def test_change_password(client, auth_headers):
    """测试修改密码功能"""
    password_data = {
        "current_password": "testpassword123",
        "new_password": "newpassword456",
    }

    response = client.post(
        "/auth/change-password", json=password_data, headers=auth_headers
    )

    assert response.status_code == status.HTTP_200_OK

    # 验证新密码可以登录
    login_data = {"username": "testuser", "password": "newpassword456"}

    response = client.post("/auth/login", data=login_data)
    assert response.status_code == status.HTTP_200_OK
