export const BASE_URL = '/api';

// 获取认证头
export const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

// 统一的请求处理函数
export async function handleRequest(url: string, options: RequestInit = {}) {
  try {
    const response = await fetch(url, options);
    
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
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('请求失败');
  }
} 