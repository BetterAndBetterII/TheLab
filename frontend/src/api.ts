// 类型定义
export interface UserSettings {
  email: string;
  fullName: string;
  bio: string;
  notifications: {
    email: boolean;
    push: boolean;
  };
  theme: 'light' | 'dark' | 'system';
  language: string;
}

export interface Message {
  id: string;
  subject: string;
  sender: string;
  content: string;
  createdAt: string;
  read: boolean;
}

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  createdAt: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: string;
}

export interface Reply {
  id: string;
  content: string;
  author: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

export interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  lastModified: string;
}

// API 基础配置
const BASE_URL = '/api';

// 获取认证头
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

// 认证相关 API
export const authApi = {
  login: async (username: string, password: string) => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return response.json();
  },

  logout: async () => {
    return fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  },

  register: async (userData: { username: string; email: string; password: string }) => {
    const response = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    return response.json();
  },

  resetPasswordRequest: async (email: string) => {
    const response = await fetch(`${BASE_URL}/auth/password-reset-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return response.json();
  },

  resetPassword: async (token: string, newPassword: string) => {
    const response = await fetch(`${BASE_URL}/auth/password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword }),
    });
    return response.json();
  },
};

// 用户设置相关 API
export const settingsApi = {
  getSettings: async (): Promise<UserSettings> => {
    const response = await fetch(`${BASE_URL}/settings`, {
      headers: getAuthHeaders(),
    });
    return response.json();
  },

  updateSettings: async (settings: UserSettings) => {
    const response = await fetch(`${BASE_URL}/settings`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(settings),
    });
    return response.json();
  },
};

// 消息相关 API
export const messageApi = {
  getMessages: async (): Promise<Message[]> => {
    const response = await fetch(`${BASE_URL}/messages`, {
      headers: getAuthHeaders(),
    });
    return response.json();
  },

  markAsRead: async (messageId: string) => {
    const response = await fetch(`${BASE_URL}/messages/${messageId}/read`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return response.json();
  },
};

// 聊天相关 API
export const chatApi = {
  getMessages: async (conversationId: string): Promise<ChatMessage[]> => {
    const response = await fetch(`${BASE_URL}/conversations/${conversationId}/messages`, {
      headers: getAuthHeaders(),
    });
    return response.json();
  },

  sendMessage: async (conversationId: string, content: string) => {
    const response = await fetch(`${BASE_URL}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content }),
    });
    return response.json();
  },
};

// 论坛相关 API
export const forumApi = {
  getCategories: async (): Promise<Category[]> => {
    const response = await fetch(`${BASE_URL}/forum/categories`, {
      headers: getAuthHeaders(),
    });
    return response.json();
  },

  getRecentPosts: async (): Promise<Post[]> => {
    const response = await fetch(`${BASE_URL}/forum/posts/recent`, {
      headers: getAuthHeaders(),
    });
    return response.json();
  },

  getPost: async (postId: string): Promise<Post> => {
    const response = await fetch(`${BASE_URL}/forum/posts/${postId}`, {
      headers: getAuthHeaders(),
    });
    return response.json();
  },

  getReplies: async (postId: string): Promise<Reply[]> => {
    const response = await fetch(`${BASE_URL}/forum/posts/${postId}/replies`, {
      headers: getAuthHeaders(),
    });
    return response.json();
  },

  createReply: async (postId: string, content: string) => {
    const response = await fetch(`${BASE_URL}/forum/posts/${postId}/replies`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content }),
    });
    return response.json();
  },
};

// 文件相关 API
export const fileApi = {
  getFiles: async (): Promise<FileItem[]> => {
    const response = await fetch(`${BASE_URL}/documents`, {
      headers: getAuthHeaders(),
    });
    return response.json();
  },

  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${BASE_URL}/documents/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: formData,
    });
    return response.json();
  },
};
