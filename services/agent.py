from typing import List, Optional

from sqlalchemy.orm import Session

from clients.gemini_client import GeminiClient
from clients.openai_client import OpenAIClient
from database import get_db
from models.forum import Reply, Topic, TopicCategory
from models.users import AIProvider, User


class ForumAgent:
    def __init__(self, db: Session, user: Optional[User] = None):
        """
        初始化论坛Agent
        :param db: 数据库会话
        :param user: 用户对象，包含AI配置
        """
        self.db = db
        self.user = user
        self.client = self._init_ai_client()

    def _init_ai_client(self):
        """初始化AI客户端"""
        if not self.user:
            return OpenAIClient()  # 使用默认配置

        if self.user.ai_provider == AIProvider.OPENAI:
            return OpenAIClient(user=self.user)
        elif self.user.ai_provider == AIProvider.GEMINI:
            return GeminiClient(user=self.user)
        else:
            return OpenAIClient()  # 默认使用OpenAI

    def _generate_prompt(self, topic: Topic, replies: List[Reply] = None) -> str:
        """
        生成提示词
        :param topic: 主题
        :param replies: 回复列表
        :return: 提示词
        """
        prompt = f"""作为一个AI助手，请针对以下论坛帖子生成一个专业、友好且有见地的回复。

主题类别：{topic.category.value}
标题：{topic.title}
内容：{topic.content}
"""

        if replies:
            prompt += "\n已有的回复：\n"
            for reply in replies:
                prompt += f"- {reply.content}\n"

        prompt += "\n请生成一个合适的回复，要求：\n1. 保持专业性\n2. 友好有礼\n3. 提供有价值的见解\n4. 鼓励进一步讨论"

        return prompt

    def _get_topic_context(self, topic_id: int) -> tuple:
        """
        获取主题上下文
        :param topic_id: 主题ID
        :return: (主题, 回复列表)
        """
        topic = self.db.query(Topic).filter(Topic.id == topic_id).first()
        if not topic:
            raise ValueError(f"主题不存在: {topic_id}")

        replies = (
            self.db.query(Reply)
            .filter(Reply.topic_id == topic_id)
            .order_by(Reply.created_at.asc())
            .all()
        )

        return topic, replies

    def run(self, topic_id: int) -> Optional[Reply]:
        """
        运行Agent，生成回复
        :param topic_id: 主题ID
        :return: 生成的回复
        """
        try:
            # 获取主题上下文
            topic, replies = self._get_topic_context(topic_id)

            # 生成提示词
            prompt = self._generate_prompt(topic, replies)

            # 调用AI生成回复
            response = self.client.chat_with_text(prompt)
            if "error" in response:
                raise Exception(response["error"])

            # 创建回复
            reply = Reply(
                content=response["text"],
                topic_id=topic_id,
                user_id=self.user.id if self.user else None,
                is_ai_generated=True,
            )

            self.db.add(reply)
            self.db.commit()
            self.db.refresh(reply)

            return reply

        except Exception as e:
            print(f"Agent回复失败: {str(e)}")
            return None
