// 用户设置相关类型
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

// 消息相关类型
export interface Message {
  id: string;
  subject: string;
  sender: string;
  content: string;
  createdAt: string;
  read: boolean;
}

// 聊天相关类型
export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  createdAt: string;
}

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

// 论坛相关类型
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

// 文件相关类型
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

export interface MoveFileRequest {
  sourceId: string;
  targetFolderId: string | null;
}

export interface RenameFileRequest {
  newName: string;
}

// 认证相关类型
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

// AI设置相关类型
export interface AISettings {
  apiKey: string;
  baseUrl: string;
  standardModel: string;
  advancedModel: string;
}

// 搜索相关类型
export interface SearchResult {
  id: string;
  type: 'post' | 'file' | 'message';
  title: string;
  content: string;
  createdAt: string;
  author: string;
  url: string;
}

// PDF文档相关类型
export interface DocumentSummary {
  summaries: {
    [page: string]: {
      en: string;
      cn: string;
    }
  };
  total_pages: number;
}

export interface DocumentTranslation {
  content: string;
  page: number;
} 