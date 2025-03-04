import { BASE_URL, getAuthHeaders, handleRequest } from './config';
import { QuizData } from '../components/PDFReader/QuizPanel';

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

interface QuizHistory {
  quiz_history: QuizData[];
}

type ModelType = 'standard' | 'advanced';

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
    stream: boolean = true,
    model: ModelType = 'standard'
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
        model,
      }),
    });

    if (!response.ok) {
      throw new Error('聊天请求失败');
    }

    return response;
  },

  // 生成文档总结
  generateFlow: async (documentId: string, stream: boolean = true): Promise<Response> => {
    const response = await fetch(`${BASE_URL}/conversations/documents/${documentId}/flow`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stream,
      }),
    });

    if (!response.ok) {
      throw new Error('生成总结请求失败');
    }

    return response;
  },

  // 生成文档测验题
  generateQuiz: async (documentId: string, pageNumber?: number, stream: boolean = true): Promise<Response> => {
    const response = await fetch(`${BASE_URL}/conversations/documents/${documentId}/quiz`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page_number: pageNumber,
        stream,
      }),
    });

    if (!response.ok) {
      throw new Error('生成测验题请求失败');
    }

    return response;
  },

  // 获取文档测验历史记录
  getQuizHistory: async (documentId: string): Promise<QuizHistory> => {
    const response = await fetch(`${BASE_URL}/conversations/documents/${documentId}/quiz/history`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('获取测验历史记录失败');
    }

    return response.json();
  },
};
