import io
import os

import pytest
from fastapi import status


@pytest.fixture
def test_file():
    """创建测试文件"""
    return io.BytesIO(b"test file content"), "test.pdf"


def test_upload_document(client, auth_headers, cleanup_files):
    """测试文档上传功能"""
    # 创建测试文件
    test_file_path = "test_upload.txt"
    with open(test_file_path, "w") as f:
        f.write("This is a test upload document")

    # 上传文件
    with open(test_file_path, "rb") as f:
        response = client.post(
            "/documents/upload",
            files={"file": ("test_upload.txt", f, "text/plain")},
            headers=auth_headers,
        )

    # 清理测试文件
    os.remove(test_file_path)

    # 验证响应
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "document_id" in data
    assert data["filename"] == "test_upload.txt"
    assert data["content_type"] == "text/plain"


def test_get_document(client, auth_headers, test_document):
    """测试获取文档功能"""
    document_id = test_document["document_id"]

    # 获取文档
    response = client.get(f"/documents/{document_id}", headers=auth_headers)

    # 验证响应
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["document_id"] == document_id
    assert "content" in data
    assert "metadata" in data


def test_list_documents(client, auth_headers, test_document):
    """测试文档列表功能"""
    # 获取文档列表
    response = client.get("/documents/", headers=auth_headers)

    # 验证响应
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

    # 验证分页参数
    response = client.get("/documents/?page=1&per_page=10", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert isinstance(data, list)
    assert len(data) <= 10


def test_delete_document(client, auth_headers, test_document):
    """测试删除文档功能"""
    document_id = test_document["document_id"]

    # 删除文档
    response = client.delete(f"/documents/{document_id}", headers=auth_headers)

    # 验证响应
    assert response.status_code == status.HTTP_200_OK

    # 验证文档已被删除
    response = client.get(f"/documents/{document_id}", headers=auth_headers)
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_update_document_metadata(client, auth_headers, test_document):
    """测试更新文档元数据功能"""
    document_id = test_document["document_id"]
    update_data = {
        "title": "Updated Title",
        "description": "Updated description",
        "tags": ["test", "update"],
    }

    # 更新元数据
    response = client.patch(
        f"/documents/{document_id}/metadata",
        json=update_data,
        headers=auth_headers,
    )

    # 验证响应
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["metadata"]["title"] == update_data["title"]
    assert data["metadata"]["description"] == update_data["description"]
    assert data["metadata"]["tags"] == update_data["tags"]


def test_search_documents(client, auth_headers, test_document):
    """测试文档搜索功能"""
    # 搜索文档
    response = client.get("/documents/search?query=test", headers=auth_headers)

    # 验证响应
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_process_document(client, auth_headers, test_document):
    """测试文档处理功能"""
    document_id = test_document["document_id"]

    # 触发文档处理
    response = client.post(f"/documents/{document_id}/process", headers=auth_headers)

    # 验证响应
    assert response.status_code == status.HTTP_202_ACCEPTED
    data = response.json()
    assert "task_id" in data

    # 检查处理状态
    task_id = data["task_id"]
    response = client.get(f"/documents/tasks/{task_id}", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "status" in data


def test_invalid_document_id(client, auth_headers):
    """测试无效文档ID的处理"""
    invalid_id = "nonexistent_id"

    # 尝试获取不存在的文档
    response = client.get(f"/documents/{invalid_id}", headers=auth_headers)
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_invalid_file_type(client, auth_headers, cleanup_files):
    """测试无效文件类型的处理"""
    # 创建测试文件
    test_file_path = "test_invalid.exe"
    with open(test_file_path, "w") as f:
        f.write("Invalid file content")

    # 尝试上传无效文件类型
    with open(test_file_path, "rb") as f:
        response = client.post(
            "/documents/upload",
            files={"file": ("test_invalid.exe", f, "application/x-msdownload")},
            headers=auth_headers,
        )

    # 清理测试文件
    os.remove(test_file_path)

    # 验证响应
    assert response.status_code == status.HTTP_400_BAD_REQUEST
