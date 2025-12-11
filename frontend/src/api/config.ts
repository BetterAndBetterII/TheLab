export const BASE_URL = '/api';

// 注册接口的基础地址:
// - 默认与 BASE_URL 相同
// - 可通过 VITE_REGISTER_BASE_URL 指定为内网注册域名，例如:
//   https://ai-register.gitfetch.dev/api
export const REGISTER_BASE_URL = "https://ai-register.gitfetch.dev/api";

// 获取认证头
export const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

type RequestOptionsWithTimeout = RequestInit & {
  timeoutMs?: number;
  timeoutMessage?: string;
};

// 统一的请求处理函数
export async function handleRequest(url: string, options: RequestOptionsWithTimeout = {}) {
  const { timeoutMs, timeoutMessage, ...fetchOptions } = options;

  let controller: AbortController | undefined;
  let timeoutId: number | undefined;

  if (timeoutMs && typeof AbortController !== 'undefined') {
    controller = new AbortController();
    timeoutId = window.setTimeout(() => {
      controller?.abort();
    }, timeoutMs);
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller?.signal,
    });

    // 处理401和403错误
    if (response.status === 401 || response.status === 403) {
      // 清除本地存储的token
      localStorage.removeItem('token');
      // 跳转到登录页面
      window.location.href = '/login';
      throw new Error('认证失败，请重新登录');
    }

    // 处理其他错误
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || '请求失败');
    }

    return response.json();
  } catch (error) {
    if (controller && controller.signal.aborted) {
      throw new Error(timeoutMessage || '请求超时，请稍后重试');
    }

    if (error instanceof Error) {
      throw error;
    }
    throw new Error('请求失败');
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
