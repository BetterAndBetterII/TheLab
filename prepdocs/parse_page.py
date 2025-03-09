"""文档处理模块。

提供文档预处理功能，包括将各种格式的文档转换为PDF，并将PDF页面转换为图片。 支持的文档格式包括PDF、DOCX和PPTX。
"""

import logging
import os
import shutil
import subprocess
import tempfile
import uuid
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import pypdfium2 as pdfium
from tqdm import tqdm

from prepdocs.config import FileType, Page, Section

logger = logging.getLogger(__name__)


class DocsIngester:
    """文档处理器类。

    处理各种格式的文档，将其转换为标准化的图片格式，以便后续处理。 支持PDF、DOCX、PPTX等格式的文档转换。
    """

    def __init__(self):
        """初始化文档处理器。

        创建临时目录用于文件处理，并设置支持的文件格式。
        """
        self.temp_dir = tempfile.mkdtemp()
        self.supported_formats = {"pdf", "docx", "pptx"}

    def _convert_to_pdf_with_libreoffice(self, input_file: str) -> str:
        """使用 LibreOffice 将文档转换为 PDF."""
        output_pdf = os.path.join(self.temp_dir, f"{uuid.uuid4()}.pdf")
        try:
            # 使用 LibreOffice 进行转换
            cmd = [
                "soffice",
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                os.path.dirname(output_pdf),
                input_file,
            ]
            process = subprocess.run(cmd, capture_output=True, text=True)

            if process.returncode != 0:
                logger.error(f"LibreOffice 转换失败: {process.stderr}")
                raise Exception(f"LibreOffice 转换失败: {process.stderr}")

            # 重命名输出文件
            temp_pdf = os.path.join(
                os.path.dirname(output_pdf),
                f"{os.path.splitext(os.path.basename(input_file))[0]}.pdf",
            )
            if os.path.exists(temp_pdf):
                os.rename(temp_pdf, output_pdf)

            logger.info(f"文件成功转换为 PDF: {output_pdf}")
            return output_pdf
        except Exception as e:
            logger.error(f"转换文件失败: {str(e)}")
            raise

    def _process_batch_pages(
        self, pdf_path: str, start_page: int, end_page: int, temp_dir: str
    ) -> list[tuple[int, str]]:
        """处理一批PDF页面并返回图片路径列表."""
        image_paths = []
        try:
            pdf = pdfium.PdfDocument(pdf_path)
            for page_num in range(start_page, end_page):
                # 获取页面
                page = pdf[page_num]
                # 渲染为位图
                bitmap = page.render(scale=300 / 72, rotation=0)  # 300 DPI
                # 转换为RGB格式
                pil_image = bitmap.to_pil()
                # 保存图片
                image_path = os.path.join(temp_dir, f"page_{page_num+1}.png")
                pil_image.save(image_path, "PNG")
                image_paths.append((page_num, image_path))
                # 释放资源
                bitmap.close()
                page.close()

            pdf.close()
            return image_paths
        except Exception as e:
            logger.error(f"处理页面批次 {start_page}-{end_page} 时发生错误: {str(e)}")
            raise

    async def _process_pdf(self, file_path: Path) -> list[str]:
        """异步处理 PDF 文件，返回图片路径列表."""
        print("PDF processing start")

        # 打开PDF文件
        pdf = pdfium.PdfDocument(file_path)
        total_pages = len(pdf)
        pdf.close()  # 关闭主进程的PDF文件，让子进程自己打开

        # 创建进度条
        pbar = tqdm(total=total_pages, desc="处理PDF页面")

        # 如果页数少于60，使用单线程处理
        if total_pages < 50:
            image_paths = []
            try:
                pdf = pdfium.PdfDocument(file_path)
                for page_num in range(total_pages):
                    page = pdf[page_num]
                    bitmap = page.render(scale=300 / 72)
                    pil_image = bitmap.to_pil()
                    image_path = os.path.join(self.temp_dir, f"page_{page_num+1}.png")
                    pil_image.save(image_path, "PNG")
                    image_paths.append(image_path)
                    pbar.update(1)
                    # 释放资源
                    bitmap.close()
                    page.close()
                pdf.close()
            except Exception as e:
                logger.error(f"单线程处理PDF时发生错误: {str(e)}")
                raise
            finally:
                pbar.close()
            return image_paths

        # 使用4进程处理，将页面分成4个批次
        batch_size = (total_pages + 3) // 4
        temp_paths = [None] * total_pages

        try:
            # 创建进程池
            with ProcessPoolExecutor(max_workers=4) as executor:
                # 创建4个批次的任务
                futures = []
                for i in range(4):
                    start_page = i * batch_size
                    end_page = min((i + 1) * batch_size, total_pages)
                    if start_page < total_pages:
                        future = executor.submit(
                            self._process_batch_pages, str(file_path), start_page, end_page, self.temp_dir
                        )
                        futures.append(future)

                # 等待所有任务完成并处理结果
                for future in futures:
                    batch_results = future.result()
                    for page_num, image_path in batch_results:
                        temp_paths[page_num] = image_path
                        pbar.update(1)

        except Exception as e:
            logger.error(f"处理PDF时发生错误: {str(e)}")
            raise
        finally:
            pbar.close()

        # 确保页面顺序正确
        image_paths = [path for path in temp_paths if path is not None]

        print("PDF processing end")
        return image_paths

    async def process_document_async(self, file_path: str, title: str) -> Section:
        """异步处理文档并返回Section对象."""
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        file_ext = title.split(".")[-1].lower()
        if file_ext not in self.supported_formats:
            logger.debug(f"不支持的文件格式: {file_ext}")
            raise ValueError(f"不支持的文件格式: {file_ext}")

        # 根据文件类型处理并获取图片路径列表
        image_paths = []
        if file_ext == "pdf":
            image_paths = await self._process_pdf(file_path)
        else:
            # 对于 docx 和 pptx，先转换为 PDF
            pdf_path = self._convert_to_pdf_with_libreoffice(str(file_path))
            image_paths = await self._process_pdf(Path(pdf_path))
            # 将转换后的 PDF 移动到原始文件位置
            shutil.move(pdf_path, file_path)

        # 将图片路径转换为Page对象列表
        pages = [Page(file_path=path) for path in image_paths]

        # 创建并返回Section对象
        return Section(
            title=title,
            pages=pages,
            file_type=FileType.IMAGE,
            filename=title,
        )

    async def process_document(self, file_path: str, title: str) -> Section:
        """同步处理文档的包装方法."""
        return await self.process_document_async(file_path, title)

    def cleanup(self):
        """清理临时文件."""
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
