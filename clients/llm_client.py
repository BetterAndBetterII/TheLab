"""LLM客户端抽象基类，定义了与大语言模型交互的标准接口."""

from abc import ABC, abstractmethod
from typing import Literal


class LLMClient(ABC):
    """LLM客户端的抽象基类.

    提供了与大语言模型交互的标准接口，包括文本对话和多模态对话功能.
    """

    def __init__(self, api_key=None, base_url=None):
        """初始化LLM客户端.

        Args:
            api_key: API密钥
            base_url: API基础URL
        """
        self.api_key = api_key
        self.base_url = base_url

    @abstractmethod
    async def chat_with_text(self, message) -> dict:
        """纯文本对话功能.

        Args:
            message: 用户输入的文本消息

        Returns:
            dict: 模型的回复
        """

    @abstractmethod
    async def chat_with_image(
        self,
        message,
        image_data,
        image_type: Literal["base64", "path"] = "base64",
    ) -> dict:
        """图片+文本对话功能.

        Args:
            message: 用户输入的文本消息
            image_data: 图片数据（base64字符串或图片路径）
            image_type: 图片数据类型（"base64"或"path"）

        Returns:
            dict: 模型的回复
        """

    @abstractmethod
    async def update_api_key_usage(self):
        """更新API密钥的使用情况."""

    @abstractmethod
    async def update_api_key_error(self, error_message):
        """更新API密钥的错误信息.

        Args:
            error_message: 错误信息
        """
