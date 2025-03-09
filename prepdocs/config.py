"""文档预处理配置模块。

定义了文档预处理过程中使用的数据结构和配置类， 包括文件类型、页面和文档片段的定义。
"""

from dataclasses import dataclass


class FileType:
    """文件类型定义类。

    定义了处理后的文件类型常量：
    - IMAGE: 图片文件
    - TEXT: 文本文件
    """

    IMAGE = "image"
    TEXT = "text"


@dataclass
class Page:
    """页面数据类。

    存储单个页面的文件路径和文本内容。
    """

    file_path: str = None  # 文件路径
    content: str = None  # 可选的文本内容

    def to_dict(self):
        """将页面数据转换为字典格式。

        Returns:
            dict: 包含文件路径和内容的字典
        """
        return {"file_path": self.file_path, "content": self.content}


@dataclass
class Section:
    """文档片段数据类。

    存储文档的一个片段，包含标题、页面列表和文件类型信息。
    """

    title: str
    pages: list[Page]
    file_type: FileType
    filename: str

    def to_dict(self):
        """将文档片段数据转换为字典格式。

        Returns:
            dict: 包含标题、页面列表、文件类型和文件名的字典
        """
        return {
            "title": self.title,
            "pages": [page.to_dict() for page in self.pages],
            "file_type": self.file_type,
            "filename": self.filename,
        }
