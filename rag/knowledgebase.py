import asyncio
import hashlib
import os
import traceback
from concurrent.futures.thread import ThreadPoolExecutor

import dotenv
from llama_index.core import (
    Document,
    PromptTemplate,
    QueryBundle,
    StorageContext,
    VectorStoreIndex,
)
from llama_index.core.extractors import KeywordExtractor, QuestionsAnsweredExtractor
from llama_index.core.indices.vector_store import VectorIndexRetriever
from llama_index.core.ingestion import IngestionPipeline
from llama_index.core.node_parser import SentenceSplitter, SentenceWindowNodeParser
from llama_index.core.postprocessor import (
    MetadataReplacementPostProcessor,
    SimilarityPostprocessor,
)
from llama_index.core.schema import NodeWithScore
from llama_index.core.settings import Settings
from llama_index.core.vector_stores.types import VectorStoreQueryMode
from llama_index.llms.openai import OpenAI
from llama_index.postprocessor.siliconflow_rerank import SiliconFlowRerank
from llama_index.storage.docstore.postgres import PostgresDocumentStore
from llama_index.vector_stores.postgres import PGVectorStore
from pydantic import BaseModel
from tqdm import tqdm

from llama_index.embeddings.siliconflow import SiliconFlowEmbedding
from llama_index.llms.siliconflow import SiliconFlow

from database import Document as DBDocument

# DEBUG日志

# logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)
# logging.getLogger().addHandler(logging.StreamHandler(stream=sys.stdout))
dotenv.load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"), override=True)

Settings.llm = SiliconFlow(
    api_key=os.getenv("OPENAI_API_KEY"),
    api_base=os.getenv("OPENAI_BASE_URL"),
    model="Qwen/Qwen2.5-7B-Instruct",
    max_retries=5,
)
Settings.embed_model = SiliconFlowEmbedding(
    api_key=os.getenv("EMBEDDING_API_KEY"),
    api_base=os.getenv("EMBEDDING_BASE_URL"),
    model="BAAI/bge-m3",
    timeout=30,
    max_retries=5,
    num_workers=10,
)


class KnowledgeBase:
    vector_store: PGVectorStore
    doc_store: PostgresDocumentStore
    pipeline: IngestionPipeline
    sc: StorageContext
    index: VectorStoreIndex

    def __init__(
        self,
        pg_docs_uri,
        pg_vector_uri,
        schema: str = "public",
        namespace: str = "default_user",
    ):
        hashed_namespace = hashlib.md5(namespace.encode()).hexdigest()
        # 创建一个与 PostgreSQL 数据库交互的键值存储 (PostgresKVStore) 实例，用于存储向量化后的文档
        # 存储向量化的文档（例如嵌入向量）
        self.vector_store = PGVectorStore.from_params(
            connection_string=pg_vector_uri.replace("asyncpg", "psycopg2"),
            async_connection_string=pg_vector_uri,
            table_name=f"{hashed_namespace}_vector",
            schema_name=schema,
            hybrid_search=True,
            embed_dim=int(os.getenv("EMB_DIMENSIONS", 1536)),
            cache_ok=True,
        )
        # 创建一个键值存储实例 doc_store，用于存储原始文档内容。
        # 存储原始的文本文档，供后续检索和使用
        self.doc_store = PostgresDocumentStore.from_uri(
            uri=pg_docs_uri,
            table_name=f"{hashed_namespace}_docs",
            schema_name=schema,
        )
        # StorageContext负责将文档存储和向量存储集成在一起，为索引操作提供统一的接口
        self.storage_context = StorageContext.from_defaults(
            docstore=self.doc_store,
            vector_store=self.vector_store,
        )
        # 创建一个基于向量存储的检索索引(VectorStoreIndex)。
        # 索引的作用是将文档向量化并存储，以支持高效的相似性搜索。
        self.index = VectorStoreIndex.from_vector_store(vector_store=self.vector_store)
        self.pipeline = IngestionPipeline(
            transformations=[
                SentenceSplitter(
                    chunk_size=1024,
                    chunk_overlap=200,
                ),
                SentenceWindowNodeParser(
                    window_size=5,
                    window_metadata_key="window",
                    original_text_metadata_key="original_text",
                ),
                QuestionsAnsweredExtractor(
                    questions=3,
                    num_workers=5,
                ),
                KeywordExtractor(
                    keywords=5,
                    num_workers=5,
                ),
                Settings.embed_model,
            ],
            vector_store=self.vector_store,
            docstore=self.doc_store,
            disable_cache=True,
        )
        # 用于存储用户的查询和模型的回答，以支持上下文增强生成(RAG)。
        # 格式通常为[(用户查询, 模型回答), ...]，在后续查询中，历史上下文将拼接到用户的新查询中。
        self.history = []
        print("RAG 初始化完成")

    # async：这是一个异步函数，允许通过await 调用异步操作，提高性能（特别是涉及I/O操作时，如数据库或网络访问）
    # text: str：用户提供的文本内容，通常为需要存储和处理的文档。
    # doc_id: str：文档的唯一标识符，用于将文档存储到数据库中并便于后续检索。
    async def upload_text(self, text: str, doc_id: str, metadata: dict = None):
        """
        处理用户手动输入的纯文本并存储为文档
        """
        # 如果没有提供元数据，使用默认值
        if metadata is None:
            metadata = {"source": "manual_input"}

        # 将用户提供的文本封装为一个Document对象
        doc = Document(text=text, id_=doc_id, metadata=metadata)

        # 执行文档注入管道
        await self.pipeline.arun(documents=[doc])
        return doc_id

    async def upload_document(self, document: DBDocument):
        """
        上传文档并存储到数据库
        """
        # 将分页内容拼接为完整的文本
        text = f"{document.content_pages}\n{document.translation_pages}\n{document.keywords_pages}"
        # 生成文档ID
        hash_text = hashlib.md5(text.encode()).hexdigest()
        doc_id = f"doc_{document.id}_{hash_text}"
        metadata = {
            "source": "document",
            "title": document.filename,
            "owner": document.owner.email,
            "url": document.path,
            "mimetype": document.content_type,
        }

        # 将文档内容封装为Document对象
        doc = Document(
            text=text,
            id_=doc_id,
            metadata=metadata,
            excluded_embed_metadata_keys=["owner"],
            excluded_llm_metadata_keys=["owner"],
        )

        # 执行文档注入管道
        await self.pipeline.arun(documents=[doc])
        return doc_id

    async def upload_files(self, file_paths: list[str]):
        """
        上传文件并存储到数据库
        """
        docs = []
        for file_path in file_paths[:50]:
            print(f"Ingesting file: {file_path}")
            with open(file_path, "r", encoding="utf-8") as f:
                text = f.read()
                print(f"Text length: {len(text)}")
                doc_id = f"web_{os.path.basename(file_path)}_{hashlib.md5(text.encode()).hexdigest()}"
                docs.append(
                    Document(text=text, id_=doc_id, metadata={"source": "web_input"})
                )
        await self.pipeline.arun(documents=docs)

    async def list_documents(self):
        """
        列出所有已上传的文档
        """
        all_docs = self.doc_store.docs
        return [
            {
                "id": id_,
                "metadata": doc.metadata,
                "text": doc.text[:100],
            }
            for id_, doc in all_docs.items()
        ]

    async def query_documents(self, doc_ids: list[str]):
        """
        查询文档
        """
        docs = []
        for doc_id in doc_ids:
            doc = await self.doc_store.aget_document(doc_id)
            docs.append(doc)
        return docs

    async def remove_document_by_id(self, doc_id: str | list[str]):
        """
        删除指定文档
        """
        if isinstance(doc_id, str):
            await self.index.adelete_ref_doc(
                ref_doc_id=doc_id, delete_from_docstore=True
            )
            await self.doc_store.adelete_document(doc_id)
        else:
            for id_ in doc_id:
                await self.index.adelete_ref_doc(
                    ref_doc_id=id_, delete_from_docstore=True
                )
                await self.doc_store.adelete_document(id_)

    async def remove_all_documents(self, num_workers: int = 5):
        """
        删除所有文档
        """
        all_docs = self.doc_store.docs
        loop = asyncio.get_event_loop()
        if num_workers and num_workers > 1:
            with ThreadPoolExecutor(max_workers=num_workers) as executor:
                doc_batches = [
                    list(all_docs.keys())[i : i + num_workers]
                    for i in range(0, len(all_docs.keys()), num_workers)
                ]
                tasks = [
                    loop.run_in_executor(
                        executor,
                        lambda x: asyncio.run(self.remove_document_by_id(x)),
                        batch,
                    )
                    for batch in doc_batches
                ]
                await asyncio.gather(*tasks)
        else:
            tasks = [self.remove_document_by_id(doc_id) for doc_id in all_docs.keys()]
            await asyncio.gather(*tasks)
        print("All documents removed")

    async def retrieve(
        self,
        query: str,
        top_k: int = 10,
        rerank: bool = True,
        mode: str = "hybrid",
    ):
        postprocessor = MetadataReplacementPostProcessor(
            target_metadata_key="window",
        )
        # reranker = LLMRerank(
        #     llm=Settings.llm,
        #     top_n=top_k,
        #     choice_batch_size=10,  # Batch size for processing nodes
        # )
        reranker = SiliconFlowRerank(
            model="BAAI/bge-reranker-v2-m3",
            api_key=os.getenv("EMBEDDING_API_KEY"),
            top_n=top_k,
        )
        mode_dict = {
            "hybrid": VectorStoreQueryMode.HYBRID,
            "text_search": VectorStoreQueryMode.TEXT_SEARCH,
            "sparse": VectorStoreQueryMode.SPARSE,
        }
        vector_retriever = VectorIndexRetriever(
            index=self.index,
            similarity_top_k=top_k * 4 if rerank else top_k,
            vector_store_query_mode=mode_dict[mode],
        )

        qb = QueryBundle(query)
        nodes = await vector_retriever.aretrieve(qb)
        nodes = postprocessor.postprocess_nodes(nodes)
        if rerank:
            nodes = reranker.postprocess_nodes(nodes, qb)
            nodes = SimilarityPostprocessor(similarity_cutoff=0.6).postprocess_nodes(
                nodes
            )
        return nodes

    async def rerank(
        self,
        nodes: list[NodeWithScore],
        query: str,
        top_k: int = 15,
        cutoff: float = 0.6,
    ):
        qb = QueryBundle(query)
        reranker = SiliconFlowRerank(
            model="BAAI/bge-reranker-v2-m3",
            api_key=os.getenv("EMBEDDING_API_KEY"),
            top_n=top_k,
        )
        nodes = reranker.postprocess_nodes(nodes, qb)
        nodes = SimilarityPostprocessor(similarity_cutoff=cutoff).postprocess_nodes(
            nodes
        )
        return nodes

    # query 查询指令
    # 指定相似性检索的 top_k 值（即返回的最相似文档数量）
    async def query_with_context(self, query: str, top_k: int = 5):
        """
        查询时包含上下文信息
        """

        custom_prompt_str = (
            "Context information is below. Ensure that the answer is based on the provided context. Provide relevant valid links.\n"
            "---------------------\n"
            "{context_str}\n"
            "---------------------\n"
            "Given the context information, answer the question: {query_str}\n"
        )
        custom_prompt = PromptTemplate(custom_prompt_str)

        # context：历史对话的拼接字符串
        # 遍历历史对话 (self.history) 中的每一条记录
        context = " ".join([f"user: {q} model: {a}" for q, a in self.history])
        # combined_query：包含上下文的完整查询
        # 如果没有历史记录，直接使用当前查询
        combined_query = f"{context} user: {query}" if context else query

        # 查询引擎调用
        query_engine = self.index.as_query_engine(
            similarity_top_k=top_k, text_qa_template=custom_prompt
        )
        response = await query_engine.aquery(QueryBundle(combined_query))

        # 更新历史记录
        self.history.append((query, response.response))
        # response：模型的回答文本；text：源文档的文本内容； metadata：文档的元数据（例如来源信息）。
        return {
            "response": response.response,
            "sources": [
                {"text": node.node.text, "metadata": node.node.metadata}
                for node in response.source_nodes
            ],
        }

    def reset_history(self):
        """重置对话历史"""
        self.history = []


# 定义请求和响应模型
class QueryRequest(BaseModel):
    query: str
    top_k: int = 5


class QueryResponse(BaseModel):
    response: str
    sources: list


async def query_documents(rag, request: QueryRequest):
    """
    查询接口：检索数据库中文档并生成回答
    """
    try:
        result = await rag.query_with_context(query=request.query, top_k=request.top_k)
        return QueryResponse(response=result["response"], sources=result["sources"])
    except Exception as e:
        traceback.print_exc()
        raise e


async def upload_text_to_rag(rag, text: str):
    """
    上传纯文本并存储到数据库
    """
    try:
        doc_id = f"manual_{hash(text)}"
        await rag.upload_text(text=text, doc_id=doc_id)
        return {"message": "文本上传成功", "doc_id": doc_id}
    except Exception as e:
        traceback.print_exc()
        raise e


async def run():
    # 初始化 RAG 实例
    PG_DOCS_URI = os.getenv("PG_DOCS_URI")
    PG_VECTOR_URI = os.getenv("PG_VECTOR_URI")
    rag = KnowledgeBase(pg_docs_uri=PG_DOCS_URI, pg_vector_uri=PG_VECTOR_URI)


if __name__ == "__main__":
    # 配置数据库 URI
    asyncio.run(run())
