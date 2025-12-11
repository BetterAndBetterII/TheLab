import { BASE_URL, REGISTER_BASE_URL, getAuthHeaders, handleRequest } from './config';
import type { LoginRequest, UserResponse, VerificationConfirmRequest, SessionInfo } from './types';

export const authApi = {
  // 获取认证提供者
  getProviders: async () => {
    return handleRequest(`${BASE_URL}/auth/providers`, {
      headers: getAuthHeaders(),
    });
  },

  // 请求验证码
  requestVerification: async (email: string) => {
    return handleRequest(`${REGISTER_BASE_URL}/auth/register/request-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      timeoutMs: 8000,
      timeoutMessage: '仅能在内网注册',
    });
  },

  // 验证并注册
  verifyAndRegister: async (data: VerificationConfirmRequest): Promise<UserResponse> => {
    return handleRequest(`${REGISTER_BASE_URL}/auth/register/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  // 登录
  login: async (data: LoginRequest): Promise<UserResponse> => {
    return fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => {
      if (res.ok) {
        return res.json();
      }
      throw new Error('登录失败');
    });
  },

  // 登出
  logout: async () => {
    return handleRequest(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  },

  // 获取当前用户信息
  getCurrentUser: async (): Promise<UserResponse> => {
    return handleRequest(`${BASE_URL}/auth/me`, {
      headers: getAuthHeaders(),
    });
  },

  // 获取用户会话列表
  getSessions: async (): Promise<SessionInfo[]> => {
    return handleRequest(`${BASE_URL}/auth/sessions`, {
      headers: getAuthHeaders(),
    });
  },

  // 删除指定会话
  deleteSession: async (sessionId: string) => {
    return handleRequest(`${BASE_URL}/auth/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  },
};
