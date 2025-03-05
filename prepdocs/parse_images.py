# 解析图片
import asyncio
import logging
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed

from clients.openai_client import OpenAIClient
from config import Settings, get_settings
from models.users import User
from prepdocs.config import FileType, Page, Section

logger = logging.getLogger(__name__)

settings: Settings = get_settings()


def get_parse_markdown_system_prompt() -> str:
    return """
You are a markdown parser, convert images to markdown format. Format tables using markdown tables, and use $..$ or $$..$$ to wrap formulas, prevent using html tags. Replace images with as accurate descriptions as possible, and never output image links. Only ignore prescript, postscript and small icons in them at the very beginning or end of the image.
"""


async def process_single_page(openai_client: OpenAIClient, page: Page) -> Page:
    """处理单个页面的图片转文本"""
    response = await openai_client.chat_with_image(
        get_parse_markdown_system_prompt(),
        page.file_path,
        "path",
    )
    if "error" in response:
        raise ValueError(f"解析图片失败: {response['error']}")
    return Page(content=response["text"])


async def parse_images(section: Section, user: User) -> Section:
    """
    将图片Section转换为文本Section
    :param section: 输入的图片Section
    :return: 文本Section
    """

    result_section = Section(
        title=section.title,
        pages=[None] * len(section.pages),  # 预分配空间以保持顺序
        file_type=FileType.TEXT,
        filename=section.filename,
    )

    max_workers = 5

    semaphore = asyncio.Semaphore(max_workers)

    async def process_page(page: Page, s: asyncio.Semaphore):
        async with s:
            if settings.GLOBAL_LLM == "public":
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
            return await process_single_page(openai_client, page)

    tasks = [process_page(page, semaphore) for page in section.pages]
    result_section.pages = await asyncio.gather(*tasks)
    # for i, page in enumerate(section.pages):
    #     result_section.pages[i] = await process_single_page(openai_client, page)

    # 移除任何处理失败的页面（None值）
    result_section.pages = [page for page in result_section.pages if page is not None]

    return result_section
