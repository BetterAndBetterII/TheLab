import asyncio
import logging
import random
import time
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from typing import Any, Callable, Dict, List, Optional

from api.models import ApiKey

from clients.gemini_client import GeminiClient
from clients.openai_client import OpenAIClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ClientStatus:
    def __init__(self):
        self.active_requests = 0  # 当前活跃请求数
        self.total_requests = 0  # 总请求数
        self.failed_requests = 0  # 失败请求数
        self.last_error = None  # 最后一次错误
        self.last_used = 0  # 最后使用时间
        self.lock = Lock()  # 线程锁

    def increment_active(self):
        with self.lock:
            self.active_requests += 1
            self.total_requests += 1
            self.last_used = time.time()

    def decrement_active(self):
        with self.lock:
            self.active_requests = max(0, self.active_requests - 1)

    def record_failure(self, error):
        with self.lock:
            self.failed_requests += 1
            self.last_error = error


class ClientPool:
    def __init__(
        self,
        clients: List[GeminiClient] = None,
        max_retries: int = 9999999,
        retry_delay: float = 2.0,
        max_concurrent_requests: int = 2,
    ):
        """
        初始化客户端池
        :param clients: 客户端列表
        :param max_retries: 最大重试次数
        :param retry_delay: 重试延迟（秒）
        :param max_concurrent_requests: 每个客户端的最大并发请求数
        """
        self.clients = clients
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.max_concurrent_requests = max_concurrent_requests

        # 初始化客户端状态
        self.client_status = (
            {client: ClientStatus() for client in clients} if clients else {}
        )

        # 用于同步的锁
        self.pool_lock = Lock()

        # 线程池用于异步操作
        self.thread_pool = ThreadPoolExecutor(max_workers=max_concurrent_requests)

        logger.info(
            f"ClientPool initialized with {len(clients) if clients else 0} clients"
        )

    def _get_clients(self):
        """
        获取客户端列表
        """
        if self.clients is None:
            self.clients = self.gather_clients()
            # retry_delay 设置为客户端越少，重试延迟越大
            self.retry_delay = 2.0 / len(self.clients) if len(self.clients) > 0 else 0
            # 设置最大重试次数为客户端数量
            self.max_retries = len(self.clients) * 9999999
            self.client_status = {client: ClientStatus() for client in self.clients}
        return self.clients

    @staticmethod
    def gather_clients():
        logger.debug("Gathering clients from database")
        # 从数据库中获取所有API密钥
        api_keys = ApiKey.objects.all()
        # 创建GeminiClient实例
        clients = []
        for api_key in api_keys:
            if api_key.api_type == "gemini":
                clients.append(GeminiClient(api_key.key, api_key.base_url))
                logger.debug("Gemini client added")
            elif api_key.api_type == "openai":
                clients.append(OpenAIClient(api_key.key, api_key.base_url))
                logger.debug("OpenAI client added")

        logger.debug("*" * 25 + f"Found {len(clients)} clients" + "*" * 25)
        logger.debug(
            f"Client API keys: {' '.join([client.api_key[-8:] for client in clients])}"
        )

        return clients

    def _select_client(self) -> Optional[GeminiClient]:
        """
        使用负载均衡算法选择最佳客户端
        采用最小活跃连接数 + 随机权重的方式
        """
        with self.pool_lock:
            # 过滤出可用的客户端（活跃请求数未达到最大值）
            available_clients = [
                client
                for client in self._get_clients()
                if self.client_status[client].active_requests
                < self.max_concurrent_requests
            ]

            if not available_clients:
                return None

            # 按活跃请求数分组
            clients_by_load = {}
            for client in available_clients:
                active_requests = self.client_status[client].active_requests
                if active_requests not in clients_by_load:
                    clients_by_load[active_requests] = []
                clients_by_load[active_requests].append(client)

            # 选择活跃请求数最少的分组
            min_load = min(clients_by_load.keys())

            # 在负载最小的客户端中随机选择一个
            logger.debug("*" * 20 + "Client load distribution" + "*" * 20)
            for load, clients in clients_by_load.items():
                logger.debug(f"Load {load}: {len(clients)} clients")
            logger.debug(f"Selected client with load {min_load}")
            return random.choice(clients_by_load[min_load])

    def execute_with_retry(self, operation: str, *args, **kwargs) -> Dict[str, Any]:
        """
        执行操作，包含重试逻辑
        :param operation: 要执行的操作函数
        :return: 操作结果
        """
        last_error = None

        for attempt in range(self.max_retries):
            self.clients = self.gather_clients()
            client = self._select_client()

            time.sleep(self.retry_delay * attempt)

            if client is None:
                continue

            try:
                # 更新客户端状态
                self.client_status[client].increment_active()

                # 获取客户端对应的方法
                actual_method = getattr(client, operation)

                # 执行操作
                result = actual_method(*args, **kwargs)

                # 如果成功，重置错误计数
                self.client_status[client].decrement_active()

                # 检查结果中是否包含错误
                if isinstance(result, dict) and "error" in result:
                    raise Exception(result["error"])
                logger.debug(
                    f"Operation succeeded on attempt {attempt + 1} at client {client.api_key[-8:]}"
                )
                return result

            except Exception as e:
                last_error = str(e)
                logger.debug(f"Operation failed on attempt {attempt + 1}: {last_error}")

                # 记录失败并更新客户端状态
                self.client_status[client].record_failure(last_error)
                self.client_status[client].decrement_active()

                # 如果还有重试机会，等待后继续
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay ** (attempt + 1))
                    continue

                break

        # 所有重试都失败
        return {"error": f"All retry attempts failed. Last error: {last_error}"}

    def get_pool_status(self) -> Dict[str, Dict]:
        """
        获取客户端池状态
        """
        status = {}
        for client in self._get_clients():
            client_stat = self.client_status[client]
            status[id(client)] = {
                "active_requests": client_stat.active_requests,
                "total_requests": client_stat.total_requests,
                "failed_requests": client_stat.failed_requests,
                "last_error": (
                    str(client_stat.last_error) if client_stat.last_error else None
                ),
                "last_used": client_stat.last_used,
            }
        return status

    def shutdown(self):
        """
        关闭客户端池
        """
        self.thread_pool.shutdown(wait=True)
        logger.info("ClientPool shutdown complete")
