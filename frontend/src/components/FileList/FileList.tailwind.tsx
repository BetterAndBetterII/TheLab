import React, { useState, useEffect, useRef } from 'react';
import Loading from '../Loading';
import { fileApi, type FileItem, type FolderTree } from '../../api';
import DragZone from './DragZone';
import { useNavigate, useLocation } from 'react-router-dom';
import { List, Grid, Upload, FolderPlus, Trash2, MoveIcon, RefreshCw } from 'lucide-react';
import { BASE_URL } from '../../api/config';
import { cn } from '../../lib/utils';

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
      (window as any).toast.success('上传文件成功');
    } catch (error) {
      console.error('Error uploading files:', error);
      (window as any).toast.error('上传文件失败');
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
      (window as any).toast.success('文件夹创建成功');
    } catch (error) {
      console.error('Error creating folder:', error);
      (window as any).toast.error('创建文件夹失败');
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
        (window as any).toast.success('删除成功');
      } catch (error) {
        console.error('Error deleting files:', error);
        (window as any).toast.error('删除失败');
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
      (window as any).toast.success('移动成功');
    } catch (error) {
      console.error('Error moving files:', error);
      (window as any).toast.error('移动失败');
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
      (window as any).toast.success('重命名成功');
    } catch (error) {
      console.error('Error renaming file:', error);
      (window as any).toast.error('重命名失败');
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
      (window as any).toast.success('重命名成功');
    } catch (error) {
      console.error('Error renaming folder:', error);
      (window as any).toast.error('重命名失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileId: string, isFolder: boolean) => {
    (window as any).toast.info("文件正在下载中...");
    try {
      if (isFolder) {
        await fileApi.downloadFolder(fileId);
      } else {
        await fileApi.downloadFile(fileId);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      (window as any).toast.error('下载失败');
    }
    (window as any).toast.success('下载成功');
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
              className={cn(
                "flex items-center p-2 cursor-pointer rounded-md hover:bg-gray-100 transition-colors"
              )}
              onClick={() => handleMove(folder.id)}
            >
              <span className="mr-2 text-lg">
                {folder.children?.length ? '📁' : '📂'}
              </span>
              <span className="truncate">{folder.name}</span>
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
      (window as any).toast.success('已重新开始处理文件');
    } catch (error) {
      console.error('Error retrying file processing:', error);
      (window as any).toast.error('重试处理失败');
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
    const itemKey = getItemKey({ id: file.id, type: file.isFolder ? 'folder' : 'file' });
    const isSelected = selectedFiles.has(itemKey);

    return (
      <div
        key={file.id}
        className={cn(
          "flex flex-col items-center p-4 rounded-lg cursor-pointer transition-all h-60 border border-transparent justify-start",
          isSelected ? "bg-blue-50 border-blue-500" : "hover:bg-gray-50"
        )}
        onClick={(e) => handleFileSelect(file, e)}
        onDoubleClick={() => handleFileDoubleClick(file)}
      >
        <div className="relative flex items-center justify-center h-24 w-full mb-4">
          {showThumbnail ? (
            <img
              src={getThumbnailUrl(file.id)}
              alt={file.name}
              className="max-w-full max-h-full object-contain rounded shadow-sm bg-gray-50"
              onError={() => handleThumbnailError(file.id)}
            />
          ) : (
            <span className="text-5xl">{getFileIcon(file)}</span>
          )}
        </div>
        
        <div className="w-full overflow-hidden flex flex-col items-center">
          <h3 className="text-sm font-medium text-gray-900 text-center mb-2 line-clamp-2 h-9 break-words">
            {file.name}
          </h3>
          
          <div className="grid grid-cols-2 gap-1 w-full">
            <span className="text-xs text-gray-500 text-center">
              {new Date(file.lastModified).toLocaleDateString()}
            </span>
            <span className="text-xs text-gray-500 text-center">
              {file.isFolder ? `${file.fileCount || 0} 个文件` : formatFileSize(file.size || 0)}
            </span>
          </div>
          
          {file.processingStatus && !file.isFolder && (
            <div className="relative mt-2 w-full flex flex-col items-center text-xs gap-1">
              <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all",
                    file.processingStatus === 'pending' ? "bg-yellow-400" :
                    file.processingStatus === 'processing' ? "bg-blue-500" :
                    file.processingStatus === 'completed' ? "bg-green-500" : "bg-red-500"
                  )}
                  style={{ width: `${PROGRESS[file.processingStatus]}%` }}
                />
              </div>
              <span className={cn(
                file.processingStatus === 'pending' ? "text-yellow-600" :
                file.processingStatus === 'processing' ? "text-blue-600" :
                file.processingStatus === 'completed' ? "text-green-600" : "text-red-600"
              )}>
                {TOOLTIPS[file.processingStatus]}
              </span>
            </div>
          )}
        </div>
        
        <div className={cn(
          "absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity bg-white/80 rounded p-1 shadow-sm",
          "group-hover:opacity-100"
        )}>
          {file.processingStatus === 'failed' && (
            <button
              className="p-1 rounded hover:bg-gray-200 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleRetryProcessing(file.id);
              }}
              title="重试处理"
            >
              <RefreshCw size={16} />
            </button>
          )}
        </div>
      </div>
    );
  };

  // 修改渲染列表视图的部分
  const renderListItem = (file: FileItem) => {
    const itemKey = getItemKey({ id: file.id, type: file.isFolder ? 'folder' : 'file' });
    const isSelected = selectedFiles.has(itemKey);

    return (
      <div
        key={file.id}
        className={cn(
          "flex items-center p-3 rounded-md cursor-pointer transition-all",
          isSelected ? "bg-blue-50" : "hover:bg-gray-50"
        )}
        onClick={(e) => handleFileSelect(file, e)}
        onDoubleClick={() => handleFileDoubleClick(file)}
      >
        <div className="text-2xl mr-4 w-6 text-center flex items-center justify-center">
          {getFileIcon(file)}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 mb-1 truncate">
            {file.name}
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{new Date(file.lastModified).toLocaleDateString()}</span>
            <span>{file.isFolder ? `${file.fileCount || 0} 个文件` : formatFileSize(file.size || 0)}</span>
          </div>
        </div>
        
        <span className="mx-6 text-sm text-gray-600">
          {file.owner || '系统'}
        </span>
        
        {file.processingStatus && !file.isFolder && (
          <div className="flex items-center gap-2 ml-2">
            <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all",
                  file.processingStatus === 'pending' ? "bg-yellow-400" :
                  file.processingStatus === 'processing' ? "bg-blue-500" :
                  file.processingStatus === 'completed' ? "bg-green-500" : "bg-red-500"
                )}
                style={{ width: `${PROGRESS[file.processingStatus]}%` }}
              />
            </div>
            <span className={cn(
              "text-xs whitespace-nowrap",
              file.processingStatus === 'pending' ? "text-yellow-600" :
              file.processingStatus === 'processing' ? "text-blue-600" :
              file.processingStatus === 'completed' ? "text-green-600" : "text-red-600"
            )}>
              {TOOLTIPS[file.processingStatus]}
            </span>
          </div>
        )}
        
        <div className={cn(
          "flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
        )}>
          {file.processingStatus === 'failed' && (
            <button
              className="p-1 rounded hover:bg-gray-200 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleRetryProcessing(file.id);
              }}
              title="重试处理"
            >
              <RefreshCw size={16} />
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className={cn("p-6 h-full flex flex-col", className)}>
      {/* 头部区域 */}
      <div className="flex justify-between items-center p-3 border-b border-gray-200 mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-gray-900 m-0">文件管理</h1>
        
        <div className="flex gap-2 items-center flex-wrap">
          <button
            className="flex items-center gap-1.5 py-1.5 px-3 bg-gray-100 hover:bg-gray-200 rounded-md text-sm transition-colors"
            onClick={() => setOperation({ type: 'upload' })}
          >
            <Upload size={16} />
            <span>上传文件</span>
          </button>
          
          <button
            className="flex items-center gap-1.5 py-1.5 px-3 bg-gray-100 hover:bg-gray-200 rounded-md text-sm transition-colors"
            onClick={() => setShowNewFolderDialog(true)}
          >
            <FolderPlus size={16} />
            <span>新建文件夹</span>
          </button>
          
          {selectedFiles.size > 0 && (
            <>
              <button
                className="flex items-center gap-1.5 py-1.5 px-3 bg-gray-100 hover:bg-gray-200 rounded-md text-sm transition-colors"
                onClick={() => setOperation({ type: 'move' })}
              >
                <MoveIcon size={16} />
                <span>移动</span>
              </button>
              
              <button
                className="flex items-center gap-1.5 py-1.5 px-3 bg-red-100 hover:bg-red-200 text-red-600 rounded-md text-sm transition-colors"
                onClick={handleDelete}
              >
                <Trash2 size={16} />
                <span>删除</span>
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* 面包屑导航 */}
      <div className="flex items-center gap-2 mb-6 p-2 bg-gray-50 rounded-md">
        <span
          className="text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
          onClick={() => handleBreadcrumbClick(null)}
        >
          根目录
        </span>
        
        {folderPath.map((folder, index) => (
          <React.Fragment key={folder.id}>
            <span className="text-gray-500">/</span>
            <span
              className={cn(
                "cursor-pointer transition-colors",
                index === folderPath.length - 1 
                  ? "text-blue-600" 
                  : "text-gray-900 hover:text-blue-600"
              )}
              onClick={() => handleBreadcrumbClick(folder.id)}
            >
              {folder.name}
            </span>
          </React.Fragment>
        ))}
      </div>
      
      {/* 内容区域 */}
      <div className="flex-1 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
        {/* 工具栏 */}
        <div className="flex items-center gap-2 p-3 border-b border-gray-200">
          <div className="ml-auto flex items-center">
            <button
              className={cn(
                "px-3 py-1.5 border rounded-md text-sm transition-colors",
                sortBy === 'name' 
                  ? "border-blue-500 text-blue-600" 
                  : "border-gray-300 hover:border-blue-500 hover:text-blue-600"
              )}
              onClick={() => handleSort('name')}
            >
              按名称{sortBy === 'name' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
            </button>
            
            <button
              className={cn(
                "px-3 py-1.5 border rounded-md text-sm transition-colors ml-2",
                sortBy === 'date' 
                  ? "border-blue-500 text-blue-600" 
                  : "border-gray-300 hover:border-blue-500 hover:text-blue-600"
              )}
              onClick={() => handleSort('date')}
            >
              按日期{sortBy === 'date' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
            </button>
            
            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-300">
              <button
                className={cn(
                  "p-1.5 border rounded-md flex items-center justify-center w-8 h-8 transition-colors",
                  viewMode === 'list' 
                    ? "bg-blue-500 text-white border-blue-500" 
                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-500 hover:text-blue-600"
                )}
                onClick={() => setViewMode('list')}
              >
                <List size={16} />
              </button>
              
              <button
                className={cn(
                  "p-1.5 border rounded-md flex items-center justify-center w-8 h-8 transition-colors",
                  viewMode === 'grid' 
                    ? "bg-blue-500 text-white border-blue-500" 
                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-500 hover:text-blue-600"
                )}
                onClick={() => setViewMode('grid')}
              >
                <Grid size={16} />
              </button>
            </div>
          </div>
        </div>
        
        {/* 文件列表 */}
        {viewMode === 'grid' ? (
          <div 
            className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 flex-1 overflow-y-auto"
            ref={fileListRef}
            onClick={handleContainerClick}
          >
            {sortedFiles.map(renderGridItem)}
          </div>
        ) : (
          <div 
            className="p-4 flex flex-col gap-2 flex-1 overflow-y-auto"
            ref={fileListRef}
            onClick={handleContainerClick}
          >
            {sortedFiles.map(renderListItem)}
          </div>
        )}
      </div>
      
      {/* 上传文件对话框 */}
      {operation?.type === 'upload' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">上传文件</h3>
            <DragZone onFilesDrop={handleUpload} />
            <div className="flex justify-end gap-3 mt-4">
              <button
                className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition-colors"
                onClick={() => setOperation(null)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 新建文件夹对话框 */}
      {showNewFolderDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">新建文件夹</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="请输入文件夹名称"
              className="w-full p-2 border border-gray-300 rounded-md text-sm focus:border-blue-500 focus:outline-none mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition-colors"
                onClick={() => {
                  setShowNewFolderDialog(false);
                  setNewFolderName('');
                }}
              >
                取消
              </button>
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors"
                onClick={handleCreateFolder}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 移动文件对话框 */}
      {operation?.type === 'move' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">移动到</h3>
            <div className="border border-gray-200 rounded-md p-2 max-h-96 overflow-y-auto mb-4">
              <div
                className="flex items-center p-2 cursor-pointer rounded-md hover:bg-gray-100 transition-colors"
                onClick={() => handleMove(null)}
              >
                <span className="mr-2 text-lg">📂</span>
                <span className="truncate">根目录</span>
              </div>
              <FolderTreeView
                folders={folderTree}
                level={0}
                selectedItems={selectedFiles}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition-colors"
                onClick={() => setOperation(null)}
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

