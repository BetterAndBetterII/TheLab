import { BASE_URL, getAuthHeaders, handleRequest } from './config';
import type { DocumentSummary, DocumentTranslation } from './types';

export const documentApi = {
  // 记录阅读文档
  recordRead: async (documentId: string): Promise<void> => {
    return handleRequest(`${BASE_URL}/documents/${documentId}/read`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  },

  // 获取阅读历史记录
  getReadHistory: async (params: { skip?: number; limit?: number } = {}): Promise<{
    records: Array<{
      id: string;
      document_id: string;
      document_name: string;
      read_at: string;
      document_type: string;
      document_size: number;
    }>;
  }> => {
    const queryParams = new URLSearchParams();
    if (params.skip !== undefined) queryParams.append('skip', params.skip.toString());
    if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
    
    return handleRequest(`${BASE_URL}/documents/read-history?${queryParams.toString()}`, {
      headers: getAuthHeaders(),
    });
  },

  // 获取文档所有页面的摘要
  getSummary: async (documentId: string): Promise<DocumentSummary> => {
    return handleRequest(`${BASE_URL}/documents/${documentId}/summaries`, {
      headers: getAuthHeaders(),
    });
  },

  // 获取指定页面的翻译
  getTranslation: async (documentId: string, page: number): Promise<DocumentTranslation> => {
    return handleRequest(`${BASE_URL}/documents/${documentId}/translation/${page}`, {
      headers: getAuthHeaders(),
    });
  },

  // 获取文档的所有页面翻译
  getAllTranslations: async (documentId: string): Promise<{ [key: string]: string }> => {
    return handleRequest(`${BASE_URL}/documents/${documentId}/translations`, {
      headers: getAuthHeaders(),
    });
  },

  // 请求生成文档摘要
  generateSummary: async (documentId: string): Promise<void> => {
    return handleRequest(`${BASE_URL}/documents/${documentId}/generate-summary`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  },

  // 请求生成文档翻译
  generateTranslation: async (documentId: string): Promise<void> => {
    return handleRequest(`${BASE_URL}/documents/${documentId}/generate-translation`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  },

  // 创建笔记
  createNote: async (documentId: string, note: {
    content: string;
    quote: string;
    highlight_areas: any[];
  }): Promise<{
    id: string;
    content: string;
    quote: string;
    highlight_areas: any[];
    created_at: string;
    updated_at: string;
  }> => {
    return handleRequest(`${BASE_URL}/documents/${documentId}/notes`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(note),
    });
  },

  // 获取文档的所有笔记
  getNotes: async (documentId: string): Promise<Array<{
    id: string;
    content: string;
    quote: string;
    highlight_areas: any[];
    created_at: string;
    updated_at: string;
  }>> => {
    return handleRequest(`${BASE_URL}/documents/${documentId}/notes`, {
      headers: getAuthHeaders(),
    });
  },

  // 删除笔记
  deleteNote: async (documentId: string, noteId: string): Promise<void> => {
    return handleRequest(`${BASE_URL}/documents/${documentId}/notes/${noteId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  },

  // 更新笔记
  updateNote: async (documentId: string, noteId: string, data: {
    content: string;
    quote: string;
    highlight_areas: any[];
  }): Promise<{
    id: string;
    content: string;
    quote: string;
    highlight_areas: any[];
    created_at: string;
    updated_at: string;
  }> => {
    return handleRequest(`${BASE_URL}/documents/${documentId}/notes/${noteId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
  },
}; 