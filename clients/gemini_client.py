import base64
import io
import os
from datetime import datetime
from typing import Literal

from google import generativeai as genai
from google.ai import generativelanguage as glm
from PIL import Image

from database import ApiKey


class GeminiClient:
    def __init__(self, api_key=None, base_url=None):
        # 初始化Gemini API配置
        self.api_key = api_key if api_key else os.getenv("GEMINI_API_KEY")
        self.base_url = base_url if base_url else os.getenv("GEMINI_API_BASE")
        try:
            self.api_key_model = ApiKey.objects.get(key=self.api_key)
        except ApiKey.DoesNotExist:
            self.api_key_model = None

        # 创建模型配置
        client = glm.GenerativeServiceClient(
            transport="rest",
            client_options={
                "api_key": self.api_key,
                "api_endpoint": self.base_url,
            },
        )
        # 使用局部配置创建模型实例
        self.text_model = genai.GenerativeModel("gemini-1.5-flash-latest")
        self.text_model._client = client
        self.vision_model = genai.GenerativeModel("gemini-1.5-flash-latest")
        self.vision_model._client = client

    def chat_with_text(self, message) -> dict:
        """
        纯文本对话功能
        :param message: 用户输入的文本消息
        :param chat_history: 可选的聊天历史记录
        :return: 模型的回复
        """
        try:
            chat = self.text_model.start_chat()

            response = chat.send_message(message)
            self.update_api_key_usage()
            return {
                "text": response.text,
            }
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
        图片+文本对话功能
        :param message: 用户输入的文本消息
        :param image_data: 图片数据（base64字符串或图片路径）
        :param image_type: 图片数据类型（"base64"或"path"）
        :return: 模型的回复
        """
        try:
            # 处理图片数据
            if image_type == "base64":
                # 处理可能的 base64 前缀
                if "," in image_data:
                    prefix, image_data = image_data.split(",", 1)
                    if not any(
                        valid_prefix in prefix.lower()
                        for valid_prefix in [
                            "image/jpeg",
                            "image/png",
                            "image/gif",
                        ]
                    ):
                        return {
                            "error": "不支持的图片格式，请使用 JPEG、PNG 或 GIF 格式"
                        }

                # 添加必要的填充
                padding = 4 - (len(image_data) % 4) if len(image_data) % 4 != 0 else 0
                image_data += "=" * padding

                try:
                    image_bytes = base64.b64decode(image_data)
                    if len(image_bytes) == 0:
                        return {"error": "Base64解码后的数据为空"}
                except Exception as e:
                    return {"error": f"Base64解码错误: {str(e)}"}

                try:
                    image = Image.open(io.BytesIO(image_bytes))
                    # 验证图片格式
                    if image.format not in ["JPEG", "PNG", "GIF"]:
                        return {
                            "error": f"不支持的图片格式: {image.format}，请使用 JPEG、PNG 或 GIF 格式"
                        }
                    # 确保图片被完全加载
                    image.load()
                except Exception as e:
                    return {
                        "error": f"图片解析错误: {str(e)}，请确保提供了有效的图片数据"
                    }
            elif image_type == "path":  # path
                try:
                    image = Image.open(image_data)
                    if image.format not in ["JPEG", "PNG", "GIF"]:
                        return {
                            "error": f"不支持的图片格式: {image.format}，请使用 JPEG、PNG 或 GIF 格式"
                        }
                    # 确保图片被完全加载
                    image.load()
                except Exception as e:
                    return {"error": f"图片文件打开错误: {str(e)}"}
            else:
                return {
                    "error": f"不支持的图片类型: {image_type}，请使用 base64 或 path 类型"
                }

            # 发送图片和文本到模型
            response = self.vision_model.generate_content([message, image])
            self.update_api_key_usage()
            return {"text": response.text}
        except Exception as e:
            self.update_api_key_error(str(e))
            return {"error": f"处理请求时发生错误: {str(e)}"}

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
