# 解析英文文档
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed

from clients.openai_client import OpenAIClient
from config import Settings, get_settings
from models.users import User
from prepdocs.config import FileType, Page, Section

settings: Settings = get_settings()


def get_translate_system_prompt(target_language: str) -> str:
    return f"""
You are a professional translator, translate the following text into {target_language}, and cannot output any other extra content:
"""


async def process_single_translation(
    openai_client: OpenAIClient, page_content: str, target_language: str
) -> Page:
    response = await openai_client.chat_with_text(
        f"{get_translate_system_prompt(target_language)}\n{page_content}",
    )
    if "error" in response:
        raise ValueError(f"翻译失败: {response['error']}")
    return Page(content=response["text"])


async def translate_text(
    section: Section, user: User, target_language: str = "Simplified Chinese"
) -> Section:
    """
    多线程翻译文本，保持原始顺序
    """
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

    result_section = Section(
        title=section.title,
        pages=[None] * len(section.pages),  # 预分配空间以保持顺序
        file_type=FileType.TEXT,
        filename=section.filename,
    )
    max_workers = 3
    # 使用线程池并行处理翻译，但保持顺序
    # with ThreadPoolExecutor(max_workers=max_workers) as executor:
    #     future_to_index = {
    #         executor.submit(
    #             process_single_translation,
    #             openai_client,
    #             page.content,
    #             target_language,
    #         ): idx
    #         for idx, page in enumerate(section.pages)
    #     }

    #     # 收集翻译结果
    #     for future in as_completed(future_to_index):
    #         idx = future_to_index[future]
    #         try:
    #             result_page = future.result()
    #             result_section.pages[idx] = result_page  # 使用原始索引存储结果
    #         except Exception as e:
    #             print(f"翻译页面 {idx + 1} 时发生错误: {str(e)}")

    semaphore = asyncio.Semaphore(max_workers)

    async def process_page(page: Page):
        async with semaphore:
            return await process_single_translation(
                openai_client, page.content, target_language
            )

    tasks = [process_page(page) for page in section.pages]
    result_section.pages = await asyncio.gather(*tasks)

    # 移除任何处理失败的页面（None值）
    result_section.pages = [page for page in result_section.pages if page is not None]

    return result_section
