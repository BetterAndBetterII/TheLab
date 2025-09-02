import React, { useState, useEffect, useRef } from 'react';
import Loading from '../Loading';
import { fileApi, type FileItem, type FolderTree } from '../../api';
import DragZone from './DragZone';
import { useNavigate, useLocation } from 'react-router-dom';
import { List, Grid } from 'lucide-react';
import { BASE_URL } from '../../api/config';
import { useToast } from '../Toast/ToastManager';

interface FileOperation {
  type: 'rename' | 'move' | 'upload';
  fileId?: string;
  data?: {
    newName?: string;
    targetFolderId?: string | null;
  };
}

interface FileListProps {
  onFileSelect?: (file: FileItem) => void;
  onFolderChange?: (folderId: string | null) => void;
  className?: string;
}

interface Item {
  id: string;
  type: 'file' | 'folder';
}

// 添加一个工具函数来生成和解析选中项的键
const getItemKey = (item: Item): string => `${item.type}:${item.id}`;
const parseItemKey = (key: string): Item => {
  const [type, id] = key.split(':');
  return { type: type as 'file' | 'folder', id };
};

type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

const TOOLTIPS: Record<ProcessingStatus, string> = {
  'pending': '等待处理',
  'processing': '处理中',
  'completed': '处理完成',
  'failed': '处理失败',
};

// 同样修改其他常量对象
const ICONS: Record<ProcessingStatus, string> = {
  'pending': '⏳',
  'processing': '🔄',
  'completed': '✅',
  'failed': '❌',
};

const PROGRESS: Record<ProcessingStatus, number> = {
  'pending': 0,
  'processing': 50,
  'completed': 100,
  'failed': 100,
};

const FileList: React.FC<FileListProps> = ({
  onFileSelect,
  onFolderChange,
  className
}) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [folderPath, setFolderPath] = useState<FileItem[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'date'>(() => {
    const savedSortBy = localStorage.getItem('fileSortBy');
    return (savedSortBy as 'name' | 'date') || 'date';
  });
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
    const savedSortOrder = localStorage.getItem('fileSortOrder');
    return (savedSortOrder as 'asc' | 'desc') || 'desc';
  });
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    const savedViewMode = localStorage.getItem('fileViewMode');
    return (savedViewMode as 'list' | 'grid') || 'grid';
  });
  const [operation, setOperation] = useState<FileOperation | null>(null);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const fileListRef = useRef<HTMLDivElement>(null);
  const [folderTree, setFolderTree] = useState<FolderTree[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();

  const getErrorMessage = (error: unknown): string => {
    if (!error) return '未知错误';
    if (typeof error === 'string') return error;
    if (error instanceof Error && error.message) return error.message;
    type MaybeAxiosError = {
      response?: { data?: { message?: unknown; detail?: unknown; error?: unknown } };
      message?: unknown;
    };
    const anyErr = error as MaybeAxiosError;
    const axiosMsg =
      anyErr?.response?.data?.message ||
      anyErr?.response?.data?.detail ||
      anyErr?.response?.data?.error ||
      anyErr?.message;
    if (typeof axiosMsg === 'string') return axiosMsg;
    try {
      return JSON.stringify(anyErr);
    } catch {
      return '未知错误';
    }
  };

  // 添加缩略图加载错误状态
  const [thumbnailErrors, setThumbnailErrors] = useState<Set<string>>(new Set());

  // 从URL路径获取当前文件夹ID
  const getCurrentFolderId = () => {
    const path = location.pathname;
    if (!path.startsWith('/files/')) {
      return null;
    }
    const segments = path.split('/');
    return segments[segments.length - 1] || null;
  };

  useEffect(() => {
    setSelectedFiles(new Set());
    const currentFolder = getCurrentFolderId();
    fetchFiles(currentFolder);
    fileApi.getFolderTree().then(setFolderTree);
  }, [location.pathname]);

  useEffect(() => {
    const fetchFolderTree = async () => {
      if (operation?.type === 'move') {
        try {
          const folders = await fileApi.getFolderTree();
          setFolderTree(folders);
        } catch (error) {
          console.error('获取文件夹树失败:', error);
        }
      }
    };

    fetchFolderTree();
  }, [operation]);

  useEffect(() => {
    const interval = setInterval(() => {
      updateProcessingStatus();
    }, 2500);
    return () => clearInterval(interval);
  }, [files]);

  useEffect(() => {
    localStorage.setItem('fileSortBy', sortBy);
    localStorage.setItem('fileSortOrder', sortOrder);
    localStorage.setItem('fileViewMode', viewMode);
  }, [sortBy, sortOrder, viewMode]);

  const updateProcessingStatus = async () => {
    const targetFiles = files.filter(file => file.processingStatus === 'pending' || file.processingStatus === 'processing')
      .filter(file => file.isFolder === false)
    if (targetFiles.length === 0) return;
    const statuses = await Promise.all(targetFiles.map(async (file) => {
      const status = await fileApi.getProcessingStatus(file.id);
      return { ...file, ...status };
    }));
    setFiles(prevFiles => prevFiles.map(file => {
      const status = statuses.find(status => status.id === file.id);
      return status ? { ...file, processingStatus: status.processing_status, errorMessage: status.error_message } : file;
    }));
  };

  const fetchFiles = async (folderId: string | null) => {
    try {
      setLoading(true);
      const response = await fileApi.getFiles(folderId);
      setFiles(response);

      if (folderId) {
        const folderDetails = await fileApi.getFolderDetails(folderId);
        const pathItems: FileItem[] = [folderDetails];
        let currentItem = folderDetails;

        while (currentItem.parentId) {
          const parentFolder = await fileApi.getFolderDetails(currentItem.parentId);
          pathItems.unshift(parentFolder);
          currentItem = parentFolder;
        }
        setFolderPath(pathItems);
      } else {
        setFolderPath([]);
      }

      onFolderChange?.(folderId);
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file: FileItem, event: React.MouseEvent) => {
    const item: Item = {
      id: file.id,
      type: file.isFolder ? 'folder' : 'file' as const
    };
    const itemKey = getItemKey(item);

    if (event.ctrlKey || event.metaKey) {
      const newSelected = new Set(selectedFiles);
      if (newSelected.has(itemKey)) {
        newSelected.delete(itemKey);
      } else {
        newSelected.add(itemKey);
      }
      setSelectedFiles(newSelected);
    } else {
      setSelectedFiles(new Set([itemKey]));
    }

    if (!file.isFolder) {
      onFileSelect?.(file);
    }
  };

  const handleUpload = async (files: FileList) => {
    if (!files || files.length === 0) return;

    try {
      setLoading(true);
      for (let i = 0; i < files.length; i++) {
        await fileApi.uploadFile(files[i], getCurrentFolderId());
      }
      fetchFiles(getCurrentFolderId());
      setOperation(null);
      addToast({ title: '成功', description: '上传文件成功', type: 'default' });
    } catch (error) {
      console.error('Error uploading files:', error);
      addToast({ title: '错误', description: `上传文件失败：${getErrorMessage(error)}` , type: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      setLoading(true);
      await fileApi.createFolder(newFolderName, getCurrentFolderId());
      setNewFolderName('');
      setShowNewFolderDialog(false);
      fetchFiles(getCurrentFolderId());
      addToast({ title: '成功', description: '文件夹创建成功', type: 'default' });
    } catch (error) {
      console.error('Error creating folder:', error);
      addToast({ title: '错误', description: `创建文件夹失败：${getErrorMessage(error)}`, type: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (selectedFiles.size === 0) return;

    const selectedItems = Array.from(selectedFiles).map(parseItemKey);
    const files = selectedItems.filter(item => item.type === 'file');
    const folders = selectedItems.filter(item => item.type === 'folder');

    const message = `确定要删除选中的 ${files.length ? files.length + ' 个文件' : ''}${
      files.length && folders.length ? ' 和 ' : ''
    }${folders.length ? folders.length + ' 个文件夹' : ''}吗？`;

    const confirm = window.confirm(message);

    if (confirm) {
      try {
        setLoading(true);
        await Promise.all([
          files.length > 0 && fileApi.batchDeleteFiles(files.map(item => item.id)),
          folders.length > 0 && fileApi.batchDeleteFolders(folders.map(item => item.id))
        ].filter(Boolean));

        setSelectedFiles(new Set());
        fetchFiles(getCurrentFolderId());
        addToast({ title: '成功', description: '删除成功', type: 'default' });
      } catch (error) {
        console.error('Error deleting files:', error);
        addToast({ title: '错误', description: `删除失败：${getErrorMessage(error)}`, type: 'destructive' });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleMove = async (targetFolderId: string | null) => {
    if (selectedFiles.size === 0) return;

    try {
      setLoading(true);
      const selectedItems = Array.from(selectedFiles).map(parseItemKey);
      await fileApi.batchMove(
        selectedItems.filter(item => item.type === 'file').map(item => item.id),
        selectedItems.filter(item => item.type === 'folder').map(item => item.id),
        targetFolderId
      );
      setSelectedFiles(new Set());
      setOperation(null);
      fetchFiles(targetFolderId);
      addToast({ title: '成功', description: '移动成功', type: 'default' });
    } catch (error) {
      console.error('Error moving files:', error);
      addToast({ title: '错误', description: `移动失败：${getErrorMessage(error)}`, type: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRenameDocument = async (fileId: string, newName: string) => {
    if (!fileId || !newName) return;
    try {
      setLoading(true);
      await fileApi.renameFile(fileId, { newName });
      setOperation(null);
      fetchFiles(getCurrentFolderId());
      addToast({ title: '成功', description: '重命名成功', type: 'default' });
    } catch (error) {
      console.error('Error renaming file:', error);
      addToast({ title: '错误', description: `重命名失败：${getErrorMessage(error)}`, type: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRenameFolder = async (folderId: string, newName: string) => {
    if (!folderId || !newName) return;
    try {
      setLoading(true);
      await fileApi.renameFolder(folderId, { newName });
      setOperation(null);
      fetchFiles(getCurrentFolderId());
      addToast({ title: '成功', description: '重命名成功', type: 'default' });
    } catch (error) {
      console.error('Error renaming folder:', error);
      addToast({ title: '错误', description: `重命名失败：${getErrorMessage(error)}`, type: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileId: string, isFolder: boolean) => {
    addToast({ title: '提示', description: '文件正在下载中...', type: 'default' });
    try {
      if (isFolder) {
        await fileApi.downloadFolder(fileId);
      } else {
        await fileApi.downloadFile(fileId);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      addToast({ title: '错误', description: `下载失败：${getErrorMessage(error)}`, type: 'destructive' });
    }
    addToast({ title: '成功', description: '下载成功', type: 'default' });
  };

  const handleSort = (key: 'name' | 'date') => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  };

  const sortedFiles = [...files].sort((a, b) => {
    // 首先按照类型排序（文件夹在前）
    if (a.isFolder !== b.isFolder) {
      return a.isFolder ? -1 : 1;
    }

    // 然后按照选择的排序方式排序
    const order = sortOrder === 'asc' ? 1 : -1;
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name) * order;
    } else {
      return (
        (new Date(a.lastModified).getTime() -
          new Date(b.lastModified).getTime()) *
        order
      );
    }
  });

  const formatFileSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const getFileIcon = (file: FileItem) => {
    if (file.isFolder) {
      return '📁';
    }

    // 根据 MIME 类型判断
    if (file.mimeType) {
      if (file.mimeType.startsWith('image/')) {
        return '🖼️';
      }
      if (file.mimeType.startsWith('video/')) {
        return '🎥';
      }
      if (file.mimeType.startsWith('audio/')) {
        return '🎵';
      }
      if (file.mimeType.includes('pdf')) {
        return '📑';
      }
      if (file.mimeType.includes('word') || file.mimeType.includes('document')) {
        return '📝';
      }
      if (file.mimeType.includes('excel') || file.mimeType.includes('spreadsheet')) {
        return '📊';
      }
      if (file.mimeType.includes('powerpoint') || file.mimeType.includes('presentation')) {
        return '📊';
      }
      if (file.mimeType.includes('zip') || file.mimeType.includes('rar') || file.mimeType.includes('7z')) {
        return '📦';
      }
      if (file.mimeType.includes('text')) {
        return '📄';
      }
    }

    // 根据文件扩展名判断
    const extension = file.name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'txt':
        return '📄';
      case 'doc':
      case 'docx':
        return '📝';
      case 'xls':
      case 'xlsx':
        return '📊';
      case 'ppt':
      case 'pptx':
        return '📊';
      case 'pdf':
        return '📑';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return '🖼️';
      case 'mp3':
      case 'wav':
        return '🎵';
      case 'mp4':
      case 'avi':
      case 'mov':
        return '🎥';
      case 'zip':
      case 'rar':
      case '7z':
        return '📦';
      default:
        return '📄';
    }
  };

  const handleContainerClick = (event: React.MouseEvent) => {
    // 如果点击的是文件列表容器本身（而不是文件项）
    if (event.target === fileListRef.current || event.target === event.currentTarget) {
      setSelectedFiles(new Set());
    }
  };

  // 添加递归渲染文件夹树的组件
  const FolderTreeView: React.FC<{
    folders: FolderTree[];
    level: number;
    selectedItems: Set<string>;
  }> = ({ folders, level, selectedItems }) => {
    return (
      <>
        {folders.filter(folder => !selectedItems.has(getItemKey({ id: folder.id, type: 'folder' }))).map(folder => (
          <div key={folder.id} style={{ paddingLeft: `${level * 20}px` }}>
            <div
              className="flex items-center p-2 cursor-pointer rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => handleMove(folder.id)}
            >
              <span className="mr-2 text-lg">
                {folder.children?.length ? '📁' : '📂'}
              </span>
              <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{folder.name}</span>
            </div>
            {folder.children && (
              <FolderTreeView
                folders={folder.children}
                level={level + 1}
                selectedItems={selectedItems}
              />
            )}
          </div>
        ))}
      </>
    );
  };

  const handleRetryProcessing = async (fileId: string) => {
    try {
      setLoading(true);
      await fileApi.retryProcessing(fileId);
      fetchFiles(getCurrentFolderId());
      addToast({ title: '成功', description: '已重新开始处理文件', type: 'default' });
    } catch (error) {
      console.error('Error retrying file processing:', error);
      addToast({ title: '错误', description: `重试处理失败：${getErrorMessage(error)}`, type: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // 修改文件夹导航相关函数
  const navigateToFolder = (folderId: string | null) => {
    if (folderId === null) {
      navigate('/files');
    } else {
      navigate(`/files/${folderId}`);
    }
  };

  // 修改面包屑导航点击处理
  const handleBreadcrumbClick = (folderId: string | null) => {
    navigateToFolder(folderId);
  };

  // 修改文件夹双击处理
  const handleFileDoubleClick = (file: FileItem) => {
    if (file.isFolder) {
      navigateToFolder(file.id);
    } else {
      navigate(`/chat/${file.id}`);
    }
  };

  // 处理缩略图加载错误
  const handleThumbnailError = (fileId: string) => {
    setThumbnailErrors(prev => new Set([...prev, fileId]));
  };

  // 获取缩略图URL
  const getThumbnailUrl = (fileId: string) => {
    return `${BASE_URL}/documents/${fileId}/thumbnail`;
  };

  // 修改渲染网格视图的部分
  const renderGridItem = (file: FileItem) => {
    const showThumbnail = !file.isFolder && !thumbnailErrors.has(file.id);
    const isSelected = selectedFiles.has(getItemKey({ id: file.id, type: file.isFolder ? 'folder' : 'file' }));

    return (
      <div
        key={file.id}
        className={`flex flex-col items-center p-3 sm:p-4 rounded-lg cursor-pointer transition-all relative border box-border justify-start group touch-manipulation ${
          isSelected
            ? 'bg-blue-50 dark:bg-gray-700 border-blue-500 dark:border-gray-500'
            : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
        } h-48 sm:h-48 md:h-52`}
        onClick={(e) => {
          e.stopPropagation();
          handleFileSelect(file, e);
        }}
        onDoubleClick={() => handleFileDoubleClick(file)}
      >
        <div className="text-3xl sm:text-4xl md:text-5xl mb-2 flex items-center justify-center flex-1 w-full max-h-24 relative">
          {showThumbnail ? (
            <img
              src={getThumbnailUrl(file.id)}
              alt={file.name}
              className="max-w-full max-h-full object-contain rounded shadow-sm bg-gray-50 dark:bg-gray-800"
              onError={() => handleThumbnailError(file.id)}
            />
          ) : (
            getFileIcon(file)
          )}
        </div>
        <div className="w-full overflow-hidden flex flex-col items-center">
          <div className="text-center w-full text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 mb-1 sm:mb-2 overflow-hidden text-ellipsis line-clamp-2 break-words leading-tight whitespace-nowrap truncate w-full">
            {file.name}
          </div>
          <div className="grid grid-cols-2 items-center text-xs text-gray-500 dark:text-gray-400">
            {!file.isFolder && <div className="text-center w-full">
              {formatFileSize(file.size)}
            </div>}
            <div className="text-center">{file.owner}</div>
            <div className="text-center">
              {new Date(file.lastModified).toLocaleDateString()}
            </div>
            {file.processingStatus && (
              <div className="relative w-full flex flex-col items-center text-xs gap-1">
                <span
                  className={`${
                    file.processingStatus === 'pending' ? 'text-yellow-500' :
                    file.processingStatus === 'processing' ? 'text-blue-500' :
                    file.processingStatus === 'completed' ? 'text-green-500' :
                    'text-red-500'
                  }`}
                  title={file.errorMessage || TOOLTIPS[file.processingStatus.toLowerCase() as ProcessingStatus]}
                >
                  {ICONS[file.processingStatus.toLowerCase() as ProcessingStatus]}
                </span>
                {file.processingStatus === "processing" && (
                  <div className="w-16 sm:w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${PROGRESS[file.processingStatus.toLowerCase() as ProcessingStatus]}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="absolute top-1 sm:top-2 right-1 sm:right-2 flex gap-0.5 sm:gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-800 bg-opacity-90 dark:bg-opacity-90 rounded p-1 shadow-sm z-10">
          <button
            className="p-1.5 sm:p-1 border-none bg-none cursor-pointer rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 touch-manipulation min-h-[36px] min-w-[36px] sm:min-h-auto sm:min-w-auto flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              setOperation({ type: 'rename', fileId: file.id });
            }}
            title="重命名"
          >
            ✏️
          </button>
          <button
            className="p-1.5 sm:p-1 border-none bg-none cursor-pointer rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 touch-manipulation min-h-[36px] min-w-[36px] sm:min-h-auto sm:min-w-auto flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(file.id, file.isFolder);
            }}
            title="下载"
          >
            ⬇️
          </button>
          {!file.isFolder && file.processingStatus === 'failed' && (
            <button
              className="p-1.5 sm:p-1 border-none bg-none cursor-pointer rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 touch-manipulation min-h-[36px] min-w-[36px] sm:min-h-auto sm:min-w-auto flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                handleRetryProcessing(file.id);
              }}
              title="重试处理"
            >
              🔄
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`p-3 sm:p-4 md:p-6 h-full flex flex-col ${className || ''}`}>
        <Loading size="large" text="加载中..." />
      </div>
    );
  }

  return (
    <div
      className={`p-3 sm:p-4 md:p-6 h-full flex flex-col ${className || ''}`}
      onClick={handleContainerClick}
    >
      {/* 工具栏 - 移动端优化 */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center p-2 sm:p-3 pb-3 border-b border-gray-200 dark:border-gray-700 gap-3 sm:gap-0">
        {/* 操作按钮区域 */}
        <div className="flex flex-wrap gap-1 sm:gap-2 items-center">
          <button
            className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 border-none rounded-md bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm cursor-pointer transition-all min-h-[44px] sm:min-h-[32px] hover:bg-gray-200 dark:hover:bg-gray-600 touch-manipulation flex-1 sm:flex-initial"
            onClick={() => setOperation({ type: 'upload' })}
            title="上传新文件"
          >
            <span>📤</span>
            <span className="hidden sm:inline text-xs sm:text-sm">上传文件</span>
            <span className="sm:hidden text-xs sm:text-sm">上传</span>
          </button>
          <button
            className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 border-none rounded-md bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm cursor-pointer transition-all min-h-[44px] sm:min-h-[32px] hover:bg-gray-200 dark:hover:bg-gray-600 touch-manipulation flex-1 sm:flex-initial"
            onClick={() => setShowNewFolderDialog(true)}
            title="创建新文件夹"
          >
            <span>📁</span>
            <span className="hidden sm:inline text-xs sm:text-sm">新建文件夹</span>
            <span className="sm:hidden text-xs sm:text-sm">新建</span>
          </button>
          {selectedFiles.size > 0 && (
            <>
              <button
                className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 border-none rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm cursor-pointer transition-all min-h-[44px] sm:min-h-[32px] hover:bg-red-200 dark:hover:bg-red-900/50 touch-manipulation"
                onClick={handleDelete}
                title="删除选中项"
              >
                <span>🗑️</span>
                <span className="inline text-xs sm:text-sm">删除</span>
              </button>
              <button
                className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 border-none rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm cursor-pointer transition-all min-h-[44px] sm:min-h-[32px] hover:bg-blue-200 dark:hover:bg-blue-900/50 touch-manipulation"
                onClick={() => setOperation({ type: 'move', fileId: Array.from(selectedFiles)[0] })}
                title="移动到其他文件夹"
              >
                <span>📦</span>
                <span className="inline text-xs sm:text-sm">移动</span>
              </button>
            </>
          )}
        </div>

        {/* 排序和视图控制区域 */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1 sm:gap-2 flex-1 sm:flex-initial">
            <button
              className="px-0 sm:px-0.5 md:px-3 py-0 sm:py-0.5 md:py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm cursor-pointer transition-all min-h-[44px] sm:min-h-[32px] flex items-center justify-center hover:border-blue-500 hover:text-blue-500 touch-manipulation flex-1 sm:flex-initial"
              onClick={() => handleSort('name')}
            >
              <span className="hidden sm:inline">按名称排序</span>
              <span className="sm:hidden">名称</span>
              {sortBy === 'name' && (
                <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
              )}
            </button>
            <button
              className="px-0 sm:px-0.5 md:px-3 py-0 sm:py-0.5 md:py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm cursor-pointer transition-all min-h-[44px] sm:min-h-[32px] flex items-center justify-center hover:border-blue-500 hover:text-blue-500 touch-manipulation flex-1 sm:flex-initial"
              onClick={() => handleSort('date')}
            >
              <span className="hidden sm:inline">按日期排序</span>
              <span className="sm:hidden">日期</span>
              {sortBy === 'date' && (
                <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-1 border-l border-gray-300 dark:border-gray-600 pl-2">
            <button
              className={`p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 cursor-pointer transition-all flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px] touch-manipulation ${
                viewMode === 'list' ? 'bg-blue-50 text-blue-500 border-blue-500 dark:bg-blue-900/30' : 'hover:border-blue-500 hover:text-blue-500'
              }`}
              onClick={() => setViewMode('list')}
              title="列表视图"
            >
              <List size={16} className="sm:w-4 sm:h-4" />
            </button>
            <button
              className={`p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 cursor-pointer transition-all flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px] touch-manipulation ${
                viewMode === 'grid' ? 'bg-blue-50 text-blue-500 border-blue-500 dark:bg-blue-900/30' : 'hover:border-blue-500 hover:text-blue-500'
              }`}
              onClick={() => setViewMode('grid')}
              title="网格视图"
            >
              <Grid size={16} className="sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 面包屑导航 - 移动端优化 */}
      <div className="flex items-center gap-1 sm:gap-2 mb-4 sm:mb-6 p-2 bg-gray-100 dark:bg-gray-700 rounded-md overflow-x-auto scrollbar-hide">
        <span
          className="text-gray-900 dark:text-gray-100 cursor-pointer transition-colors hover:text-blue-500 flex items-center"
          onClick={() => handleBreadcrumbClick(null)}
        >
          根目录
        </span>
        {folderPath.map((folder) => (
          <React.Fragment key={folder.id}>
            <span className="text-gray-500 dark:text-gray-400 flex items-center">/</span>
            <span
              className="text-gray-900 dark:text-gray-100 cursor-pointer transition-colors hover:text-blue-500 flex items-center"
              onClick={() => handleBreadcrumbClick(folder.id)}
            >
              {folder.name}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* 文件列表区域 */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm sm:shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
        {viewMode === 'list' ? (
          <div className="p-2 sm:p-4 flex flex-col gap-1 sm:gap-2 flex-1 overflow-y-auto min-h-0 touch-scroll" ref={fileListRef}>
            {sortedFiles.map((file) => {
              const isSelected = selectedFiles.has(getItemKey({ id: file.id, type: file.isFolder ? 'folder' : 'file' }));
              return (
                <div
                  key={file.id}
                  className={`flex items-center p-3 sm:p-3 rounded-md cursor-pointer transition-all group touch-manipulation ${
                    isSelected ? 'bg-blue-50 dark:bg-gray-700 border border-blue-200 dark:border-gray-600' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFileSelect(file, e);
                  }}
                  onDoubleClick={() => handleFileDoubleClick(file)}
                >
                  <div className="text-xl sm:text-2xl mr-3 sm:mr-4 w-6 text-center flex items-center justify-center">
                    {getFileIcon(file)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100 mb-1 overflow-hidden text-ellipsis whitespace-nowrap">
                      {file.name}
                    </div>
                    <div className="flex flex-row sm:items-center gap-1 sm:gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        {!file.isFolder && <span className="hidden md:inline">{formatFileSize(file.size)}</span>}
                        {!file.isFolder && <span className="hidden md:inline">•</span>}
                        <span className="hidden sm:inline">{new Date(file.lastModified).toLocaleString()}</span>
                        <span className="sm:hidden">{new Date(file.lastModified).toLocaleDateString()}</span>
                      </div>
                      {file.processingStatus && (
                        <div className="flex items-center gap-2">
                          <span className="hidden sm:inline">•</span>
                          <span
                            className={`flex items-center gap-1 ${
                              file.processingStatus === 'pending' ? 'text-yellow-500' :
                              file.processingStatus === 'processing' ? 'text-blue-500' :
                              file.processingStatus === 'completed' ? 'text-green-500' :
                              'text-red-500'
                            }`}
                            title={file.errorMessage || TOOLTIPS[file.processingStatus.toLowerCase() as ProcessingStatus]}
                          >
                            {ICONS[file.processingStatus.toLowerCase() as ProcessingStatus]}
                            <span className="hidden sm:inline">{file.processingStatus}</span>
                          </span>
                          {file.processingStatus === "processing" && (
                            <div className="w-16 sm:w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                style={{ width: `${PROGRESS[file.processingStatus.toLowerCase() as ProcessingStatus]}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="hidden sm:block text-sm text-gray-600 dark:text-gray-400 mx-6">{file.owner}</div>
                  <div className="flex gap-1 sm:gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-2 border-none bg-none cursor-pointer rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 touch-manipulation min-h-[44px] min-w-[44px] sm:min-h-auto sm:min-w-auto sm:p-1 flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOperation({ type: 'rename', fileId: file.id });
                      }}
                      title="重命名"
                    >
                      ✏️
                    </button>
                    <button
                      className="p-2 border-none bg-none cursor-pointer rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 touch-manipulation min-h-[44px] min-w-[44px] sm:min-h-auto sm:min-w-auto sm:p-1 flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(file.id, file.isFolder);
                      }}
                      title="下载"
                    >
                      ⬇️
                    </button>
                    {!file.isFolder && file.processingStatus === 'failed' && (
                      <button
                        className="p-2 border-none bg-none cursor-pointer rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 touch-manipulation min-h-[44px] min-w-[44px] sm:min-h-auto sm:min-w-auto sm:p-1 flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRetryProcessing(file.id);
                        }}
                        title="重试处理"
                      >
                        🔄
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-2 sm:p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4 overflow-y-auto min-h-0 touch-scroll" ref={fileListRef}>
            {sortedFiles.map(renderGridItem)}
          </div>
        )}
      </div>

      {/* 对话框 - 移动端优化 */}
      {showNewFolderDialog && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-700 p-4 sm:p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="m-0 mb-4 text-lg text-gray-900 dark:text-gray-100">新建文件夹</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="请输入文件夹名称"
              className="w-full p-3 sm:p-2 border border-gray-300 dark:border-gray-600 rounded text-sm mb-4 min-h-[44px] sm:min-h-auto focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              autoFocus
            />
            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
              <button
                onClick={() => setShowNewFolderDialog(false)}
                className="px-4 py-3 sm:py-1.5 rounded text-sm cursor-pointer transition-all border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:opacity-80 touch-manipulation order-2 sm:order-1"
              >
                取消
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-4 py-3 sm:py-1.5 rounded text-sm cursor-pointer transition-all border-none bg-blue-500 text-white hover:opacity-80 touch-manipulation order-1 sm:order-2"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {operation?.type === 'rename' && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-700 p-4 sm:p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="m-0 mb-4 text-lg text-gray-900 dark:text-gray-100">重命名</h3>
            <input
              type="text"
              defaultValue={files.find(f => f.id === operation.fileId)?.name}
              onChange={(e) => operation.data = { ...operation.data, newName: e.target.value }}
              placeholder="请输入新名称"
              className="w-full p-3 sm:p-2 border border-gray-300 dark:border-gray-600 rounded text-sm mb-4 min-h-[44px] sm:min-h-auto focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              autoFocus
            />
            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
              <button
                onClick={() => setOperation(null)}
                className="px-4 py-3 sm:py-1.5 rounded text-sm cursor-pointer transition-all border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:opacity-80 touch-manipulation order-2 sm:order-1"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (files.find(f => f.id === operation.fileId)?.isFolder) {
                    handleRenameFolder(operation.fileId || '', operation.data?.newName || '');
                  } else {
                    handleRenameDocument(operation.fileId || '', operation.data?.newName || '');
                  }
                }}
                className="px-4 py-3 sm:py-1.5 rounded text-sm cursor-pointer transition-all border-none bg-blue-500 text-white hover:opacity-80 touch-manipulation order-1 sm:order-2"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {operation?.type === 'move' && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-700 p-4 sm:p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="m-0 mb-4 text-lg text-gray-900 dark:text-gray-100">移动到</h3>
            <div className="max-h-64 sm:max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded p-2 my-2.5 touch-scroll">
              <div
                className={`flex items-center p-3 sm:p-2 cursor-pointer rounded transition-colors touch-manipulation ${
                  getCurrentFolderId() === null ? 'bg-blue-50 dark:bg-gray-700' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => handleMove(null)}
              >
                <span className="mr-2 text-lg">📁</span>
                <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">根目录</span>
              </div>
              <FolderTreeView
                folders={folderTree}
                level={1}
                selectedItems={selectedFiles}
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
              <button
                onClick={() => setOperation(null)}
                className="px-4 py-3 sm:py-1.5 rounded text-sm cursor-pointer transition-all border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:opacity-80 touch-manipulation"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {operation?.type === 'upload' && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-700 p-4 sm:p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="m-0 mb-4 text-lg text-gray-900 dark:text-gray-100">上传文件</h3>
            <DragZone onFileSelect={handleUpload} />
            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
              <button
                onClick={() => setOperation(null)}
                className="px-4 py-3 sm:py-1.5 rounded text-sm cursor-pointer transition-all border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:opacity-80 touch-manipulation"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileList;
