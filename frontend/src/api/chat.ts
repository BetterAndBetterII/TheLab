import { BASE_URL, getAuthHeaders, handleRequest } from './config';
import type { ChatMessage, ChatSession, ChatMessagePosition } from './types';

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
