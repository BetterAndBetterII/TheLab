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
  aiConfig?: {
    apiKey: string;
    baseUrl: string;
    standardModel: string;
    advancedModel: string;
  };
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
  owner: string;
  parentId: string | null;
  path: string;
  isFolder: boolean;
  mimeType?: string;
  processingStatus?: string;
}

export interface FolderTree {
  id: string;
  name: string;
  path: string;
  children: FolderTree[] | null;
}

// AI设置相关类型定义
export interface AISettings {
  apiKey: string;
  baseUrl: string;
  standardModel: string;
  advancedModel: string;
}

// API 基础配置
export const BASE_URL = '/api';

// 获取认证头
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

// 统一的请求处理函数
async function handleRequest(url: string, options: RequestInit = {}) {
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

// 认证相关接口定义
export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserResponse {
  id: number;
  email: string;
  username: string;
  full_name?: string;
  status: string;
  created_at: string;
}

export interface VerificationRequest {
  email: string;
}

export interface VerificationConfirmRequest {
  email: string;
  code: string;
  username: string;
  password: string;
  full_name?: string;
}

export interface SessionInfo {
  id: string;
  created_at: string;
  last_accessed_at: string;
  user_agent?: string;
  ip_address?: string;
}

// 认证相关 API
export const authApi = {
  // 请求验证码
  requestVerification: async (email: string) => {
    return handleRequest(`${BASE_URL}/auth/register/request-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  },

  // 验证并注册
  verifyAndRegister: async (data: VerificationConfirmRequest): Promise<UserResponse> => {
    return handleRequest(`${BASE_URL}/auth/register/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  // 登录
  login: async (data: LoginRequest): Promise<UserResponse> => {
    // return handleRequest(`${BASE_URL}/auth/login`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(data),
    // });
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

// 用户设置相关 API
export const settingsApi = {
  getSettings: async (): Promise<UserSettings> => {
    const settings = await handleRequest(`${BASE_URL}/settings`, {
      headers: getAuthHeaders(),
    })

    return settings;
  },

  updateSettings: async (settings: UserSettings) => {
    const { aiConfig, ...basicSettings } = settings;
    
    return await handleRequest(`${BASE_URL}/settings`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(basicSettings),
    })
  },

  testAISettings: async (settings: AISettings) => {
    return handleRequest(`${BASE_URL}/settings/ai/test`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(settings),
    });
  },
};

// 消息相关 API
export const messageApi = {
  getMessages: async (): Promise<Message[]> => {
    return handleRequest(`${BASE_URL}/messages`, {
      headers: getAuthHeaders(),
    });
  },

  markAsRead: async (messageId: string) => {
    return handleRequest(`${BASE_URL}/messages/${messageId}/read`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  },
};

// 扩展聊天相关接口
export interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  createdAt: string;
}

export interface ChatMessagePosition {
  x: number;
  y: number;
}

export interface EnhancementType {
  type: 'summary' | 'core_analysis' | 'questions' | 'humorous' | 'keywords';
  content: string;
}

// 扩展聊天API
export const chatApi = {
  getMessages: async (conversationId: string): Promise<ChatMessage[]> => {
    return handleRequest(`${BASE_URL}/conversations/${conversationId}/messages`, {
      headers: getAuthHeaders(),
    });
  },

  sendMessage: async (conversationId: string, content: string) => {
    return handleRequest(`${BASE_URL}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content }),
    });
  },

  createSession: async (title: string, documentIds?: number[]): Promise<ChatSession> => {
    return handleRequest(`${BASE_URL}/conversations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        title,
        document_ids: documentIds || [],
      }),
    });
  },

  getSessions: async (): Promise<ChatSession[]> => {
    return handleRequest(`${BASE_URL}/conversations`, {
      headers: getAuthHeaders(),
    });
  },

  getSession: async (sessionId: string): Promise<ChatSession> => {
    return handleRequest(`${BASE_URL}/conversations/${sessionId}`, {
      headers: getAuthHeaders(),
    });
  },

  deleteSession: async (sessionId: string) => {
    return handleRequest(`${BASE_URL}/conversations/${sessionId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  },

  updateMessagePosition: async (messageId: string, position: ChatMessagePosition) => {
    return handleRequest(`${BASE_URL}/conversations/messages/${messageId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(position),
    });
  },

  enhanceMessage: async (
    conversationId: string,
    messageId: string,
    enhancementTypes: string[]
  ) => {
    return handleRequest(`${BASE_URL}/conversations/enhance-page`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        conversation_id: conversationId,
        message_id: messageId,
        enhancement_types: enhancementTypes,
      }),
    });
  },
};

// 扩展论坛相关接口
export interface ForumPost extends Post {
  likes: number;
  comments: number;
  tags: string[];
  coverImage?: string;
}

export interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  likes: number;
}

// 扩展论坛API
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

  createPost: async (post: { title: string; content: string; tags: string[] }) => {
    const response = await fetch(`${BASE_URL}/forum/posts`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(post),
    });
    return response.json();
  },

  likePost: async (postId: string) => {
    const response = await fetch(`${BASE_URL}/forum/posts/${postId}/like`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return response.json();
  },

  unlikePost: async (postId: string) => {
    const response = await fetch(`${BASE_URL}/forum/posts/${postId}/unlike`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return response.json();
  },

  getComments: async (postId: string): Promise<Comment[]> => {
    const response = await fetch(`${BASE_URL}/forum/posts/${postId}/comments`, {
      headers: getAuthHeaders(),
    });
    return response.json();
  },

  createComment: async (postId: string, content: string) => {
    const response = await fetch(`${BASE_URL}/forum/posts/${postId}/comments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content }),
    });
    return response.json();
  },

  likeComment: async (postId: string, commentId: string) => {
    const response = await fetch(`${BASE_URL}/forum/posts/${postId}/comments/${commentId}/like`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return response.json();
  },
};

// 扩展文件相关接口
export interface MoveFileRequest {
  sourceId: string;
  targetFolderId: string | null;
}

export interface RenameFileRequest {
  newName: string;
}

// 文件相关 API
export const fileApi = {
  // 获取文件列表
  getFiles: async (folderId: string | null = null): Promise<FileItem[]> => {
    const params = new URLSearchParams();
    if (folderId) {
      params.append('parentId', folderId);
    }
    
    try {
      // 获取文件夹和文件
      const [folders, files] = await Promise.all([
        handleRequest(`${BASE_URL}/folders?${params.toString()}`, {
          headers: getAuthHeaders(),
        }),
        handleRequest(`${BASE_URL}/documents?${params.toString()}`, {
          headers: getAuthHeaders(),
        })
      ]);
      
      // 合并文件和文件夹列表
      return [...folders, ...files];
    } catch (error) {
      console.error('获取文件列表失败:', error);
      throw error;
    }
  },

  // 获取文件夹树结构
  getFolderTree: async (): Promise<FolderTree[]> => {
    return handleRequest(`${BASE_URL}/folders/tree`, {
      headers: getAuthHeaders(),
    });
  },

  // 创建文件夹
  createFolder: async (name: string, parentId: string | null = null): Promise<FileItem> => {
    return handleRequest(`${BASE_URL}/folders`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, parentId }),
    });
  },

  // 上传文件
  uploadFile: async (file: File, folderId: string | null = null) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', file.name);
    if (folderId) {
      formData.append('folderId', folderId);
    }

    return handleRequest(`${BASE_URL}/documents/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: formData,
    });
  },

  // 下载文件
  downloadFile: async (fileId: string) => {
    try {
      const response = await fetch(`${BASE_URL}/documents/${fileId}/download`, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('下载失败');
      }

      const blob = await response.blob();
      
      // 从 Content-Disposition 头中获取文件名
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = '';
      
      if (contentDisposition) {
        // 尝试获取 filename* 参数（RFC 5987）
        const matches = /filename\*=UTF-8''(.+)/i.exec(contentDisposition);
        if (matches && matches[1]) {
          filename = decodeURIComponent(matches[1]);
        } else {
          // 回退到普通 filename 参数
          const filenameMatch = /filename="(.+?)"/i.exec(contentDisposition);
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1];
          }
        }
      }

      // 如果没有获取到文件名，使用默认文件名
      if (!filename) {
        filename = 'downloaded_file';
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;  // 使用从服务器获取的文件名
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('下载文件失败:', error);
      throw error;
    }
  },

  // 删除文件或文件夹
  deleteFile: async (fileId: string) => {
    return handleRequest(`${BASE_URL}/documents/${fileId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  },

  // 重命名文件或文件夹
  renameFile: async (fileId: string, request: RenameFileRequest) => {
    return handleRequest(`${BASE_URL}/documents/${fileId}/rename`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });
  },

  // 移动文件或文件夹
  moveFile: async (fileId: string, request: MoveFileRequest) => {
    return handleRequest(`${BASE_URL}/documents/${fileId}/move`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });
  },

  // 获取文件详情
  getFileDetails: async (fileId: string): Promise<FileItem> => {
    return handleRequest(`${BASE_URL}/documents/${fileId}`, {
      headers: getAuthHeaders(),
    });
  },

  // 获取文件详情
  getFolderDetails: async (folderId: string): Promise<FileItem> => {
    return handleRequest(`${BASE_URL}/folders/${folderId}`, {
      headers: getAuthHeaders(),
    });
  },

  // 获取文件预览URL
  getFilePreviewUrl: async (fileId: string): Promise<string> => {
    return handleRequest(`${BASE_URL}/documents/${fileId}/preview`, {
      headers: getAuthHeaders(),
    });
  },

  // 批量删除文件或文件夹
  batchDeleteFiles: async (fileIds: string[]) => {
    return handleRequest(`${BASE_URL}/documents/batch-delete`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ fileIds }),
    });
  },

  batchDeleteFolders: async (folderIds: string[]) => {
    return handleRequest(`${BASE_URL}/folders/batch-delete`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ folderIds }),
    });
  },

  // 批量移动文件或文件夹
  batchMove: async (fileIds: string[], folderIds: string[], targetFolderId: string | null) => {
    return handleRequest(`${BASE_URL}/documents/batch-move`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ fileIds, folderIds, targetFolderId }),
    });
  },
};

// 搜索相关API
export interface SearchResult {
  id: string;
  type: 'post' | 'file' | 'message';
  title: string;
  content: string;
  createdAt: string;
  author: string;
  url: string;
}

export const searchApi = {
  search: async (query: string, type?: string): Promise<SearchResult[]> => {
    const params = new URLSearchParams();
    params.append('q', query);
    if (type) {
      params.append('type', type);
    }

    return handleRequest(`${BASE_URL}/search?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
  },

  getSearchSuggestions: async (query: string): Promise<string[]> => {
    return handleRequest(`${BASE_URL}/search/suggestions?q=${encodeURIComponent(query)}`, {
      headers: getAuthHeaders(),
    });
  },
};
