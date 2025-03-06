import { BASE_URL, getAuthHeaders, handleRequest } from './config';

export interface SearchResult {
  text: string;
  score: number;
  doc_id: string;
  metadata: {
    source?: string;
    title?: string;
    url?: string;
    [key: string]: any;
  };
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface SearchParams {
  query: string;
  top_k?: number;
  rerank?: boolean;
  mode?: 'hybrid' | 'text_search' | 'sparse';
}

export const searchApi = {
  search: async (params: SearchParams): Promise<SearchResponse> => {
    return handleRequest(`${BASE_URL}/search`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
  },

  getSearchSuggestions: async (query: string): Promise<string[]> => {
    return handleRequest(`${BASE_URL}/search/suggestions?q=${encodeURIComponent(query)}`, {
      headers: getAuthHeaders(),
    });
  },
};
