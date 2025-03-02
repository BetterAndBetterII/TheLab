# 解析图片
import logging
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from prepdocs.config import FileType, Page, Section
from clients.openai_client import OpenAIClient
from models.users import User
import asyncio

logger = logging.getLogger(__name__)


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
    openai_client = OpenAIClient(
        api_key=user.api_keys[0].key,
        base_url=user.api_keys[0].base_url,
        model=user.ai_standard_model,
    )

    result_section = Section(
        title=section.title,
        pages=[None] * len(section.pages),  # 预分配空间以保持顺序
        file_type=FileType.TEXT,
        filename=section.filename,
    )

    max_workers = 3
    # 使用线程池并行处理图片，但保持顺序
    # with ThreadPoolExecutor(max_workers=max_workers) as executor:
    #     future_to_index = {
    #         executor.submit(process_single_page, openai_client, page): idx
    #         for idx, page in enumerate(section.pages)
    #     }

    #     for future in as_completed(future_to_index):
    #         idx = future_to_index[future]
    #         try:
    #             result_page = future.result()
    #             result_section.pages[idx] = result_page  # 使用原始索引存储结果
    #         except Exception as e:
    #             logger.error(f"处理页面 {idx + 1} 时发生错误: {str(e)}")
    #             logger.error(traceback.format_exc())
    #             # 创建一个包含错误信息的页面
    #             result_section.pages[idx] = Page(
    #                 content=f"Error processing page: {str(e)}"
    #             )

    semaphore = asyncio.Semaphore(max_workers)
    async def process_page(page: Page, s: asyncio.Semaphore):
        async with s:
            return await process_single_page(openai_client, page)

    tasks = [process_page(page, semaphore) for page in section.pages]
    result_section.pages = await asyncio.gather(*tasks)

    # 移除任何处理失败的页面（None值）
    result_section.pages = [page for page in result_section.pages if page is not None]

    return result_section
