import json
import random
from typing import List, Optional

import openai
from fastapi import HTTPException, status
from openai.types.chat import ChatCompletionChunk
from sqlalchemy.orm import Session

from clients.openai_client import OpenAIClient
from config import get_settings
from models.forum import Reply, Topic, TopicCategory
from models.users import User
from services.agent import ForumAgent

settings = get_settings()


class ForumService:
    def __init__(self, db: Session):
        self.db = db

    def create_topic(
        self,
        user_id: int,
        username: str,
        title: str,
        content: str,
        category: TopicCategory,
        enable_agent: bool = True,
    ) -> Topic:
        """创建新主题."""
        topic = Topic(
            title=title,
            content=content,
            category=category,
            user_id=user_id,
            username=username,
        )
        self.db.add(topic)
        self.db.commit()
        self.db.refresh(topic)

        # 如果启用了Agent，生成AI回复
        if enable_agent:
            self._trigger_agent_reply(topic.id)

        return topic

    def get_topic(self, topic_id: int) -> Topic:
        """获取主题详情."""
        topic = self.db.query(Topic).filter(Topic.id == topic_id).first()
        if not topic:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="主题不存在",
            )

        # 增加浏览次数
        topic.views += 1
        self.db.commit()

        return topic

    def list_topics(
        self,
        category: Optional[TopicCategory] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> List[Topic]:
        """获取主题列表."""
        # 构建基础查询
        base_query = self.db.query(Topic).join(User, Topic.user_id == User.id)

        # 添加分类过滤
        if category:
            base_query = base_query.filter(Topic.category == category)

        # 获取置顶主题
        pinned_query = base_query.filter(Topic.is_pinned == True)
        pinned_topics = pinned_query.order_by(Topic.updated_at.desc()).all()

        # 获取普通主题
        normal_query = base_query.filter(Topic.is_pinned == False)
        offset = (page - 1) * page_size
        normal_topics = normal_query.order_by(Topic.updated_at.desc()).offset(offset).limit(page_size).all()

        # 合并结果并确保用户名存在
        all_topics = pinned_topics + normal_topics
        for topic in all_topics:
            if not topic.username and topic.user:
                topic.username = topic.user.username

        return all_topics

    def update_topic(
        self,
        topic_id: int,
        user_id: int,
        title: Optional[str] = None,
        content: Optional[str] = None,
        category: Optional[TopicCategory] = None,
    ) -> Topic:
        """更新主题."""
        topic = self.db.query(Topic).filter(Topic.id == topic_id).first()
        if not topic:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="主题不存在",
            )

        if topic.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权修改此主题",
            )

        if title:
            topic.title = title
        if content:
            topic.content = content
        if category:
            topic.category = category

        self.db.commit()
        self.db.refresh(topic)
        return topic

    def delete_topic(self, topic_id: int, user_id: int):
        """删除主题."""
        topic = self.db.query(Topic).filter(Topic.id == topic_id).first()
        if not topic:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="主题不存在",
            )

        if topic.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权删除此主题",
            )

        self.db.delete(topic)
        self.db.commit()

    def create_reply(
        self,
        topic_id: int,
        user_id: int,
        username: str,
        content: str,
        parent_id: Optional[int] = None,
        enable_agent: bool = True,
    ) -> Reply:
        """创建回复."""
        # 检查主题是否存在且未锁定
        topic = self.db.query(Topic).filter(Topic.id == topic_id).first()
        if not topic:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="主题不存在",
            )

        if topic.is_locked:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="主题已锁定，无法回复",
            )

        # 如果是回复其他回复，检查父回复是否存在
        if parent_id:
            parent = self.db.query(Reply).filter(Reply.id == parent_id).first()
            if not parent or parent.topic_id != topic_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="父回复不存在",
                )

        reply = Reply(
            content=content,
            topic_id=topic_id,
            user_id=user_id,
            username=username,
            parent_id=parent_id,
        )

        self.db.add(reply)
        self.db.commit()
        self.db.refresh(reply)

        # 如果启用了Agent，生成AI回复
        if enable_agent:
            self._trigger_agent_reply(topic_id)

        return reply

    def _trigger_agent_reply(self, topic_id: int) -> Optional[Reply]:
        """触发Agent回复."""
        try:
            # 获取系统用户（可以是管理员或特定的AI用户）
            system_user = self.db.query(User).filter(User.is_superuser == True).first()

            # 创建Agent实例
            agent = ForumAgent(self.db, user=system_user)

            # 运行Agent生成回复
            return agent.run(topic_id)

        except Exception as e:
            print(f"触发Agent回复失败: {str(e)}")
            return None

    def _generate_ai_replies(self, topic: Topic, trigger_reply: Optional[Reply] = None):
        """生成AI回复."""
        try:
            # 构建提示信息
            prompt = f"主题：{topic.title}\n内容：{topic.content}\n"
            if trigger_reply:
                prompt += f"回复：{trigger_reply.content}\n"
            prompt += "请生成一个合适的回复："

            # 调用OpenAI API
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": "你是一个论坛中的AI用户，需要对帖子或回复进行回应。",
                    },
                    {"role": "user", "content": prompt},
                ],
            )

            # 创建AI回复
            ai_content = response.choices[0].message.content
            ai_reply = Reply(
                content=ai_content,
                topic_id=topic.id,
                user_id=None,  # AI回复没有用户ID
                parent_id=(trigger_reply.id if trigger_reply else None),
                is_ai_generated=True,
            )

            self.db.add(ai_reply)
            self.db.commit()

        except Exception as e:
            # 记录错误但不影响主流程
            print(f"生成AI回复时出错: {str(e)}")

    def get_topic_replies(self, topic_id: int, page: int = 1, page_size: int = 20) -> List[Reply]:
        """获取主题的回复列表."""
        offset = (page - 1) * page_size
        return (
            self.db.query(Reply)
            .filter(Reply.topic_id == topic_id)
            .order_by(Reply.created_at.asc())
            .offset(offset)
            .limit(page_size)
            .all()
        )

    async def generate_ai_topic(self, current_user: User) -> Topic:
        """生成AI推文."""
        try:
            # 调用OpenAI API生成主题内容
            # response = openai.ChatCompletion.create(
            #     model="gpt-3.5-turbo",
            #     messages=[
            #         {
            #             "role": "system",
            #             "content": "你是一个论坛中的AI用户，需要生成一个有趣的主题帖子。主题应该包含标题和内容。
            #             内容应该是有见解的、有趣的或有教育意义的。",
            #         },
            #         {
            #             "role": "user",
            #             "content": "请生成一个论坛主题帖子，包含标题和内容。主题可以是技术、生活、分享等任意分类。",
            #         },
            #     ],
            # )

            # 随机选择一个分类
            categories = list(TopicCategory)
            category = random.choice(categories)

            openai_client = OpenAIClient(
                api_key=current_user.ai_api_key,
                base_url=current_user.ai_base_url,
                model=current_user.ai_standard_model,
            )
            generated_content = ""
            finish_reason = None
            POST_PROMPT = f"""
请生成一个论坛主题帖子，包含标题和内容。
可以是{category}相关的内容
标题要吸引人，内容要有趣，有教育意义。
使用JSON格式输出，格式如下：
{
    "title": "标题",
    "content": "内容",
    "username": "用户名"
}
"""
            async for chunk in await openai_client.chat_stream(
                messages=[
                    {
                        "role": "user",
                        "content": POST_PROMPT,
                    },
                ],
            ):
                chunk: ChatCompletionChunk
                if chunk.choices[0].delta.content:
                    generated_content += chunk.choices[0].delta.content

            # 分离标题和内容
            generated_content = generated_content.replace("```json", "").replace("```", "").strip()
            print(generated_content)
            generated_content = json.loads(generated_content)

            # 获取系统用户（AI用户）
            system_user = self.db.query(User).filter(User.is_superuser == True).first()
            if not system_user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="系统用户不存在",
                )

            # 创建主题
            topic = Topic(
                title=generated_content["title"],
                content=generated_content["content"],
                category=category,
                user_id=system_user.id,
                username=generated_content["username"],
            )

            self.db.add(topic)
            self.db.commit()
            self.db.refresh(topic)

            return topic

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"生成AI推文失败: {str(e)}",
            )
