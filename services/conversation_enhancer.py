"""对话增强服务模块。

这个模块提供了对话增强相关的功能，包括上下文管理、消息处理等。
"""

from enum import Enum
from typing import Dict, List, Optional

from clients.client_pool import ClientPool
from clients.gemini_client import GeminiClient
from clients.openai_client import OpenAIClient
from database import Conversation, Document, Message, Session
from models.conversations import ConversationCreate, MessageCreate
from models.users import User


class EnhancementType(Enum):
    SUMMARY = "summary"  # 文档摘要
    CORE_ANALYSIS = "core_analysis"  # 核心提炼
    QUESTIONS = "questions"  # 问题导向
    HUMOROUS = "humorous"  # 诙谐幽默
    KEYWORDS = "keywords"  # 关键词提取


class ConversationEnhancer:
    """对话增强器类。

    提供对话增强相关的功能，包括消息处理、上下文管理等。
    """

    def __init__(self, db: Session, client_pool: ClientPool):
        """初始化对话增强器。

        Args:
            db (Session): 数据库会话
            client_pool (ClientPool): 客户端连接池
        """
        self.db = db
        self.client_pool = client_pool

    def _get_prompt_template(self, enhancement_type: EnhancementType) -> str:
        """
        获取不同类型的提示词模板
        """
        templates = {
            EnhancementType.SUMMARY: """
请对以下文档内容进行全面的摘要总结，要求：
1. 提供100-150字的整体摘要
2. 突出文档的主要观点和结论
3. 使用清晰的结构和段落
4. 保持客观准确的表述

文档内容：
{text}
            """,
            EnhancementType.CORE_ANALYSIS: """
请对以下文档进行深入分析，提供：
1. 3个核心贡献点：列出文档最重要的三个发现、创新或见解
2. 2个质疑点：指出文档中可能存在的问题、局限性或待验证的观点
3. 1个应用场景：提供一个具体的实际应用场景或案例

文档内容：
{text}
            """,
            EnhancementType.QUESTIONS: """
请基于以下文档内容，生成3-5个引导性问题，要求：
1. 问题应该由浅入深，循序渐进
2. 包含事实性问题和思考性问题
3. 引导读者深入思考文档的核心内容
4. 每个问题后附带简短的思考提示

文档内容：
{text}
            """,
            EnhancementType.HUMOROUS: """
请用诙谐幽默的方式解释以下文档内容，要求：
1. 使用生动有趣的比喻
2. 运用日常生活中的例子
3. 保持专业性的同时增加趣味性
4. 可以适当使用轻松的语气和幽默元素
5. 确保不影响内容的准确性

文档内容：
{text}
            """,
            EnhancementType.KEYWORDS: """
请从以下文档中提取关键词和概念，要求：
1. 提供5-8个核心关键词
2. 对每个关键词提供简短的解释（1-2句话）
3. 按重要性排序

文档内容：
{text}
            """,
        }
        return templates.get(enhancement_type, "")

    def _get_context_window(
        self, document: Document, current_page: int, window_size: int = 3
    ) -> str:
        """
        获取当前页面周围的上下文窗口
        :param document: 文档对象
        :param current_page: 当前页码
        :param window_size: 窗口大小（单侧），默认为3页
        :return: 合并后的文本内容
        """
        start_page = max(1, current_page - window_size)
        end_page = min(document.total_pages, current_page + window_size)

        context_text = []
        for page in range(start_page, end_page + 1):
            page_content = document.get_page_content(page)
            if page == current_page:
                context_text.append(f"[当前页 {page}]\n{page_content}")
            else:
                context_text.append(f"[第 {page} 页]\n{page_content}")

        return "\n\n".join(context_text)

    async def enhance_page(
        self,
        document: Document,
        page: int,
        enhancement_type: EnhancementType,
        window_size: int = 3,
    ) -> Dict:
        """
        增强指定页面的内容
        :param document: 文档对象
        :param page: 页码
        :param enhancement_type: 增强类型
        :param window_size: 上下文窗口大小
        :return: 增强结果
        """
        # 获取上下文窗口的文本
        context_text = self._get_context_window(document, page, window_size)
        if not context_text:
            return {"status": "error", "error": "无法获取页面内容"}

        # 生成提示词并调用AI
        prompt = self._get_prompt_template(enhancement_type).format(text=context_text)
        response = await self.client_pool.get_client().chat_with_text(prompt)

        if "error" in response:
            return {"status": "error", "error": response["error"]}

        return {
            "status": "success",
            "type": enhancement_type.value,
            "page": page,
            "result": response["text"],
        }

    async def batch_enhance_page(
        self,
        document: Document,
        page: int,
        enhancement_types: List[EnhancementType],
        window_size: int = 3,
    ) -> List[Dict]:
        """
        批量增强指定页面的内容
        :param document: 文档对象
        :param page: 页码
        :param enhancement_types: 增强类型列表
        :param window_size: 上下文窗口大小
        :return: 增强结果列表
        """
        results = []
        for enhancement_type in enhancement_types:
            result = await self.enhance_page(
                document, page, enhancement_type, window_size
            )
            results.append(result)
        return results

    async def process_message(self, message: MessageCreate) -> Message:
        """处理新的消息。

        Args:
            message (MessageCreate): 待处理的消息

        Returns:
            Message: 处理后的消息对象
        """
        # 处理消息的具体实现
        pass

    async def get_conversation_context(self, conversation_id: int) -> List[Message]:
        """获取对话上下文。

        Args:
            conversation_id (int): 对话ID

        Returns:
            List[Message]: 对话上下文消息列表
        """
        # 获取对话上下文的具体实现
        pass
