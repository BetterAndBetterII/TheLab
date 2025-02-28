import base64
import io
import os
from datetime import datetime
from typing import Literal

import openai
from PIL import Image

from clients.llm_client import LLMClient
from database import ApiKey
from models.users import AIProvider, User


class OpenAIClient(LLMClient):
    def __init__(self, user: User = None):
        """
        初始化OpenAI客户端
        :param user: 用户对象，包含AI服务配置
        """
        if user and user.ai_provider == AIProvider.OPENAI:
            api_key = user.ai_api_key
            base_url = user.ai_base_url or os.getenv(
                "OPENAI_API_BASE", "https://api.openai.com/v1"
            )
            self.model = user.ai_model or "gpt-4"
            self.max_tokens = user.ai_max_tokens or 500
            self.temperature = user.ai_temperature or 0.7
        else:
            api_key = os.getenv("OPENAI_API_KEY")
            base_url = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
            self.model = os.getenv("OPENAI_MODEL", "gpt-4")
            self.max_tokens = int(os.getenv("OPENAI_MAX_TOKENS", "500"))
            self.temperature = float(os.getenv("OPENAI_TEMPERATURE", "0.7"))

        super().__init__(api_key, base_url)

        try:
            self.api_key_model = ApiKey.objects.get(key=self.api_key)
        except ApiKey.DoesNotExist:
            self.api_key_model = None

        # 创建 OpenAI 模型客户端
        self.client = openai.Client(api_key=self.api_key, base_url=self.base_url)

        # 使用相同的模型配置
        self.text_model = self.model
        self.vision_model = self.model

    def chat_with_text(self, message) -> dict:
        """
        纯文本对话功能
        :param message: 用户输入的文本消息
        :return: 模型的回复
        """
        try:
            messages = [
                {
                    "role": "developer",
                    "content": "You are a helpful assistant",
                },
                {"role": "user", "content": message},
            ]
            request_params = {
                "model": self.text_model,
                "messages": messages,
                "max_tokens": self.max_tokens,
                "temperature": self.temperature,
            }
            response = self.client.chat.completions.create(**request_params)
            self.update_api_key_usage()
            return {"text": response.choices[0].message.content}

        except Exception as e:
            self.update_api_key_error(str(e))
            return {"error": str(e)}

    def chat_with_image(
        self,
        message,
        image_data,
        image_type: Literal["base64", "path"] = "base64",
    ):
        """
        图片+文本对话功能，使用 messages 模式
        注：处理完图片后，将其作为文本传递
        """
        try:
            # 将不同来源的图片统一转换为 base64 URL
            if image_type == "base64":
                # 如果已经是data URI格式，直接使用
                if image_data.startswith("data:image/"):
                    image_url = image_data
                else:
                    # 处理纯base64字符串
                    if "," in image_data:
                        # 如果包含data URI前缀，提取base64部分
                        prefix, image_data = image_data.split(",", 1)
                    # 添加padding
                    padding = (
                        4 - (len(image_data) % 4) if len(image_data) % 4 != 0 else 0
                    )
                    image_data += "=" * padding
                    # 构造完整的data URI
                    image_url = f"data:image/jpeg;base64,{image_data}"

            elif image_type == "path":
                # 读取文件并转换为base64 URL
                with open(image_data, "rb") as img_file:
                    img_data = base64.b64encode(img_file.read()).decode()
                    image_url = f"data:image/jpeg;base64,{img_data}"
            else:
                return {"error": "不支持的图片类型，请使用 base64 或 path"}

            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": message},
                        {"type": "image_url", "image_url": {"url": image_url}},
                    ],
                }
            ]

            request_params = {
                "model": self.vision_model,
                "messages": messages,
                "max_tokens": self.max_tokens,
                "temperature": self.temperature,
            }
            response = self.client.chat.completions.create(**request_params)
            self.update_api_key_usage()
            return {"text": response.choices[0].message.content}
        except Exception as e:
            self.update_api_key_error(str(e))
            return {"error": str(e)}

    def update_api_key_usage(self):
        if not self.api_key_model:
            return
        self.api_key_model.counter += 1
        self.api_key_model.last_used_at = datetime.now()
        self.api_key_model.save()

    def update_api_key_error(self, error_message):
        if not self.api_key_model:
            return
        self.api_key_model.last_error_message = error_message
        self.api_key_model.save()
