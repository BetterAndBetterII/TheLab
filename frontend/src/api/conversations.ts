import { BASE_URL, getAuthHeaders, handleRequest } from './config';

interface Message {
  role: string;
  content: string;
  timestamp: string;
  finish_reason?: string;
}

interface Document {
  id: number;
  filename: string;
}

interface Conversation {
  id: number;
  title: string;
  messages: Message[];
  documents: Document[];
  created_at: string;
  updated_at: string;
  user_id: number;
}

export const conversationApi = {
  // 创建新对话
  create: async (title: string, documentIds: string[]): Promise<Conversation> => {
    return handleRequest(`${BASE_URL}/conversations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        title,
        document_ids: documentIds.map(Number),
      }),
    });
  },

  // 获取对话列表
  list: async (): Promise<Conversation[]> => {
    return handleRequest(`${BASE_URL}/conversations`, {
      headers: getAuthHeaders(),
    });
  },

  // 获取单个对话
  get: async (conversationId: number): Promise<Conversation> => {
    return handleRequest(`${BASE_URL}/conversations/${conversationId}`, {
      headers: getAuthHeaders(),
    });
  },

  // 删除对话
  delete: async (conversationId: number): Promise<void> => {
    return handleRequest(`${BASE_URL}/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  },

  // 发送聊天消息
  chat: async (
    conversationId: number,
    messages: { role: string; content: string }[],
    stream: boolean = true
  ): Promise<Response> => {
    const response = await fetch(`${BASE_URL}/conversations/${conversationId}/chat`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        stream,
      }),
    });

    if (!response.ok) {
      throw new Error('聊天请求失败');
    }

    return response;
  },
}; 