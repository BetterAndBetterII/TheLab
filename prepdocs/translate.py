"""文档翻译模块。

提供文本翻译功能，使用OpenAI的语言模型将文档内容翻译成目标语言。 主要用于将英文文档翻译成中文或其他目标语言。
"""

# 解析英文文档
import asyncio

from clients.openai_client import OpenAIClient
from config import Settings, get_settings
from models.users import User
from prepdocs.config import FileType, Page, Section

settings: Settings = get_settings()


def get_translate_system_prompt(target_language: str) -> str:
    """获取翻译系统提示。

    Args:
        target_language: 目标语言

    Returns:
        str: 系统提示文本
    """
    return (
        f"You are a professional translator, translate the following text into {target_language},"
        f" and cannot output any other extra content:"
    )


async def process_single_translation(
    openai_client: OpenAIClient,
    page_content: str,
    target_language: str,
) -> Page:
    """处理单个页面的翻译。

    Args:
        openai_client: OpenAI客户端实例
        page_content: 要翻译的页面内容
        target_language: 目标语言

    Returns:
        Page: 包含翻译后内容的页面对象

    Raises:
        ValueError: 当翻译失败时抛出
    """
    response = await openai_client.chat_with_text(
        f"{get_translate_system_prompt(target_language)}\n{page_content}",
    )
    if "error" in response:
        raise ValueError(f"翻译失败: {response['error']}")
    return Page(content=response["text"])


async def translate_text(
    section: Section,
    user: User,
    target_language: str = "Simplified Chinese",
) -> Section:
    """多线程翻译文本，保持原始顺序."""
    if settings.GLOBAL_LLM == "private":
        openai_client = OpenAIClient(
            api_key=user.ai_api_key,
            base_url=user.ai_base_url,
            model=user.ai_standard_model,
        )
    else:
        openai_client = OpenAIClient(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_BASE_URL,
            model=settings.LLM_STANDARD_MODEL,
        )

    result_section = Section(
        title=section.title,
        pages=[None] * len(section.pages),  # 预分配空间以保持顺序
        file_type=FileType.TEXT,
        filename=section.filename,
    )
    max_workers = 3

    semaphore = asyncio.Semaphore(max_workers)

    async def process_page(page: Page):
        async with semaphore:
            return await process_single_translation(openai_client, page.content, target_language)

    tasks = [process_page(page) for page in section.pages]
    result_section.pages = await asyncio.gather(*tasks)

    # 移除任何处理失败的页面（None值）
    result_section.pages = [page for page in result_section.pages if page is not None]

    return result_section
