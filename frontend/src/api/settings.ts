import { BASE_URL, getAuthHeaders, handleRequest } from './config';
import type { UserSettings, AISettings, UpdateUserSettings } from './types';

export const settingsApi = {
  getSettings: async (): Promise<UserSettings> => {
    const settings = await handleRequest(`${BASE_URL}/settings`, {
      headers: getAuthHeaders(),
    })

    return settings;
  },

  updateSettings: async (settings: UpdateUserSettings) => {
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