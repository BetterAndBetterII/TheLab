from dataclasses import dataclass


# 处理后，返回的文件类型
class FileType:
    IMAGE = "image"
    TEXT = "text"


@dataclass
class Page:
    file_path: str = None  # 文件路径
    content: str = None  # 可选的文本内容

    def to_dict(self):
        return {"file_path": self.file_path, "content": self.content}


@dataclass
class Section:
    title: str
    pages: list[Page]
    file_type: FileType
    filename: str

    def to_dict(self):
        return {
            "title": self.title,
            "pages": [page.to_dict() for page in self.pages],
            "file_type": self.file_type,
            "filename": self.filename,
        }
