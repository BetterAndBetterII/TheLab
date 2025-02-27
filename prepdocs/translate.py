# 解析英文文档
from concurrent.futures import ThreadPoolExecutor, as_completed

from api.views import GeminiClient, global_env

from clients.client_pool import ClientPool
from prepdocs.config import FileType, Page, Section


def get_translate_system_prompt(target_language: str) -> str:
    return f"""
You are a professional translator, translate the following text into {target_language}, and cannot output any other extra content:
"""


def process_single_translation(
    client_pool, page_content: str, target_language: str
) -> Page:
    response = client_pool.execute_with_retry(
        "chat_with_text",
        f"{get_translate_system_prompt(target_language)}\n{page_content}",
    )
    if "error" in response:
        raise ValueError(f"翻译失败: {response['error']}")
    return Page(content=response["text"])


def translate_text(
    section: Section, target_language: str = "Simplified Chinese"
) -> Section:
    """
    多线程翻译文本，保持原始顺序
    """
    client_pool: ClientPool = global_env["gemini_client_pool"]
    if not client_pool._get_clients():
        raise ValueError(
            "No GeminiClient available. Please check your API keys and permissions."
        )
    result_section = Section(
        title=section.title,
        pages=[None] * len(section.pages),  # 预分配空间以保持顺序
        file_type=FileType.TEXT,
        filename=section.filename,
    )
    max_workers = min(len(client_pool._get_clients()) * 2, 8)
    # 使用线程池并行处理翻译，但保持顺序
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_index = {
            executor.submit(
                process_single_translation,
                client_pool,
                page.content,
                target_language,
            ): idx
            for idx, page in enumerate(section.pages)
        }

        # 收集翻译结果
        for future in as_completed(future_to_index):
            idx = future_to_index[future]
            try:
                result_page = future.result()
                result_section.pages[idx] = result_page  # 使用原始索引存储结果
            except Exception as e:
                print(f"翻译页面 {idx + 1} 时发生错误: {str(e)}")

    # 移除任何处理失败的页面（None值）
    result_section.pages = [page for page in result_section.pages if page is not None]

    return result_section
