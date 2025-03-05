import { BASE_URL, getAuthHeaders } from './config';
import type { Category, Post, Reply, Comment } from './types';

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

  getPosts: async (page: number = 1, category: string = 'all'): Promise<Post[]> => {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: '10',
    });
    if (category !== 'all') {
      params.append('category', category);
    }
    const response = await fetch(`${BASE_URL}/forum/topics?${params}`, {
      headers: getAuthHeaders(),
    });
    return response.json();
  },

  getPost: async (postId: string): Promise<Post> => {
    const response = await fetch(`${BASE_URL}/forum/topics/${postId}`, {
      headers: getAuthHeaders(),
    });
    return response.json();
  },

  getReplies: async (postId: string): Promise<Reply[]> => {
    const response = await fetch(`${BASE_URL}/forum/topics/${postId}/replies`, {
      headers: getAuthHeaders(),
    });
    return response.json();
  },

  createReply: async (postId: string, content: string) => {
    const response = await fetch(`${BASE_URL}/forum/topics/${postId}/replies`, {
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

  generateAiTopic: async () => {
    const response = await fetch(`${BASE_URL}/forum/generate-ai-topic`, {
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
