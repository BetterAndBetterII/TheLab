import { BASE_URL, getAuthHeaders, handleRequest } from './config';
import type { Message } from './types';

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
