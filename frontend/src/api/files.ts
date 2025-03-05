import { BASE_URL, getAuthHeaders, handleRequest } from './config';
import type { FileItem, FolderTree, MoveFileRequest, RenameFileRequest } from './types';

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

  // 获取文件处理状态
  getProcessingStatus: async (fileId: string): Promise<{ id: string; processing_status: string; error_message: string }> => {
    return handleRequest(`${BASE_URL}/documents/${fileId}/processing-status`, {
      headers: getAuthHeaders(),
    });
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

  // 下载文件夹
  downloadFolder: async (folderId: string) => {
    try {
      window.open(`${BASE_URL}/folders/${folderId}/download`, '_blank');
    } catch (error) {
      console.error('下载文件失败:', error);
      throw error;
    }
  },

  // 重试处理文件
  retryProcessing: async (documentId: string): Promise<void> => {
    return handleRequest(`${BASE_URL}/documents/${documentId}/retry-processing`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
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

  // 获取文件夹详情
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