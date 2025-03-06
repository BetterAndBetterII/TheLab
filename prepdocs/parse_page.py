# DocsIngester

import logging
import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

from pdf2image import convert_from_path

from prepdocs.config import FileType, Page, Section

logger = logging.getLogger(__name__)


class DocsIngester:
    def __init__(self):
        self.temp_dir = tempfile.mkdtemp()
        self.supported_formats = {"pdf", "docx", "pptx"}

    def _convert_to_pdf_with_libreoffice(self, input_file: str) -> str:
        """使用 LibreOffice 将文档转换为 PDF"""
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

    def process_document(self, file_path: str, title: str) -> Section:
        """处理文档并返回Section对象"""
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
            image_paths = self._process_pdf(file_path)
        else:
            # 对于 docx 和 pptx，先转换为 PDF
            pdf_path = self._convert_to_pdf_with_libreoffice(str(file_path))
            image_paths = self._process_pdf(Path(pdf_path))
            # 将转换后的 PDF 移动到原始文件位置
            shutil.move(pdf_path, file_path)

        # 将图片路径转换为Page对象列表
        pages = [Page(file_path=path) for path in image_paths]

        # 创建并返回Section对象
        return Section(
            title=title, pages=pages, file_type=FileType.IMAGE, filename=title
        )

    def _process_pdf(self, file_path: Path) -> list[str]:
        """处理 PDF 文件，返回图片路径列表"""
        images = convert_from_path(file_path)
        image_paths = []

        for i, image in enumerate(images):
            image_path = os.path.join(self.temp_dir, f"page_{i+1}.png")
            image.save(image_path, "PNG")
            image_paths.append(image_path)

        return image_paths

    def cleanup(self):
        """清理临时文件"""
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
