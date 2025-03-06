import base64
import logging
import os
from datetime import datetime
from typing import List, Literal

import openai
from openai.types.chat import ChatCompletionMessageParam

from clients.llm_client import LLMClient
from database import ApiKey, get_db

logger = logging.getLogger(__name__)


class OpenAIClient(LLMClient):
    def __init__(
        self,
        api_key=None,
        base_url=None,
        model=None,
        max_tokens=None,
        temperature=None,
    ):
        """初始化OpenAI客户端."""
        self.api_key = api_key if api_key else os.getenv("OPENAI_API_KEY")
        self.base_url = base_url if base_url else os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
        self.model = model if model else os.getenv("OPENAI_MODEL", "gpt-4")
        self.max_tokens = max_tokens if max_tokens else None
        self.temperature = temperature if temperature else float(os.getenv("OPENAI_TEMPERATURE", "0.7"))

        # 获取数据库会话
        self.db = next(get_db())
        self.api_model = self.db.query(ApiKey).filter(ApiKey.key == self.api_key).first()

        super().__init__(api_key, base_url)

        # 创建 OpenAI 模型客户端
        self.client = openai.AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            max_retries=64,
        )

        # 使用相同的模型配置
        self.text_model = self.model
        self.vision_model = self.model

    async def chat_with_text(self, message) -> dict:
        """纯文本对话功能 :param message: 用户输入的文本消息 :return: 模型的回复."""
        try:
            messages = [
                {
                    "role": "system",
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
            response = await self.client.chat.completions.create(**request_params)
            await self.update_api_key_usage()
            result = {"text": response.choices[0].message.content}
            return result

        except Exception as e:
            await self.update_api_key_error(str(e))
            return {"error": str(e)}

    async def test_connection(self, standard_model, advanced_model):
        """测试OpenAI连接是否有效."""
        self.client.max_retries = 2
        response = await self.client.chat.completions.create(
            model=standard_model,
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=500,
        )
        if response.choices[0].message.content is None:
            raise Exception("标准模型测试失败")
        response = await self.client.chat.completions.create(
            model=advanced_model,
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=500,
        )
        if response.choices[0].message.content is None:
            raise Exception("高级模型测试失败")
        return True

    async def chat_with_image(
        self,
        message,
        image_data,
        image_type: Literal["base64", "path"] = "base64",
    ):
        """图片+文本对话功能，使用 messages 模式 注：处理完图片后，将其作为文本传递."""
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
                    padding = 4 - (len(image_data) % 4) if len(image_data) % 4 != 0 else 0
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
                        {
                            "type": "image_url",
                            "image_url": {"url": image_url},
                        },
                    ],
                }
            ]

            request_params = {
                "model": self.vision_model,
                "messages": messages,
                "max_tokens": self.max_tokens,
                "temperature": self.temperature,
            }
            response = await self.client.chat.completions.create(**request_params)
            await self.update_api_key_usage()
            return {"text": response.choices[0].message.content}
        except Exception as e:
            await self.update_api_key_error(str(e))
            return {"error": str(e)}

    async def update_api_key_usage(self):
        if not self.api_model:
            return
        self.api_model.counter += 1
        self.api_model.last_used_at = datetime.now()
        self.db.commit()

    async def update_api_key_error(self, error_message):
        if not self.api_model:
            return
        self.api_model.last_error_message = error_message
        self.db.commit()

    async def chat_stream(self, messages: List[ChatCompletionMessageParam]):
        """流式对话功能 :param messages: 用户输入的文本消息 :return: 模型的回复."""
        response = await self.client.chat.completions.create(
            model=self.text_model,
            messages=messages,
            stream=True,
        )
        return response

    def __del__(self):
        """确保在对象被销毁时关闭数据库连接."""
        if hasattr(self, "db"):
            self.db.close()
