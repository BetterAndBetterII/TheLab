from abc import ABC, abstractmethod
from typing import Literal


class LLMClient(ABC):
    def __init__(self, api_key=None, base_url=None):
        self.api_key = api_key
        self.base_url = base_url

    @abstractmethod
    async def chat_with_text(self, message) -> dict:
        """纯文本对话功能 :param message: 用户输入的文本消息 :return: 模型的回复."""

    @abstractmethod
    async def chat_with_image(
        self,
        message,
        image_data,
        image_type: Literal["base64", "path"] = "base64",
    ) -> dict:
        """图片+文本对话功能 :param message: 用户输入的文本消息 :param image_data: 图片数据（base64字符串或图片路径） :param image_type:
        图片数据类型（"base64"或"path"） :return: 模型的回复."""

    @abstractmethod
    async def update_api_key_usage(self): ...

    @abstractmethod
    async def update_api_key_error(self, error_message): ...
