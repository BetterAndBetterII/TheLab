import React, { useState, useEffect, useRef } from 'react';
import Loading from '../Loading';
import { fileApi, type FileItem, type FolderTree } from '../../api';
import DragZone from './DragZone';
import { useNavigate, useLocation } from 'react-router-dom';
import { List, Grid } from 'lucide-react';
import { BASE_URL } from '../../api/config';

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

// 声明toast类型
declare global {
  interface Window {
    toast: {
      success: (message: string) => void;
      error: (message: string) => void;
      info: (message: string) => void;
    };
  }
}

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
      window.toast.success('上传文件成功');
    } catch (error) {
      console.error('Error uploading files:', error);
      window.toast.error('上传文件失败');
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
      window.toast.success('文件夹创建成功');
    } catch (error) {
      console.error('Error creating folder:', error);
      window.toast.error('创建文件夹失败');
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
        window.toast.success('删除成功');
      } catch (error) {
        console.error('Error deleting files:', error);
        window.toast.error('删除失败');
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
      window.toast.success('移动成功');
    } catch (error) {
      console.error('Error moving files:', error);
      window.toast.error('移动失败');
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
      window.toast.success('重命名成功');
    } catch (error) {
      console.error('Error renaming file:', error);
      window.toast.error('重命名失败');
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
      window.toast.success('重命名成功');
    } catch (error) {
      console.error('Error renaming folder:', error);
      window.toast.error('重命名失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileId: string, isFolder: boolean) => {
    window.toast.info("文件正在下载中...");
    try {
      if (isFolder) {
        await fileApi.downloadFolder(fileId);
      } else {
        await fileApi.downloadFile(fileId);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      window.toast.error('下载失败');
    }
    window.toast.success('下载成功');
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
              className="flex items-center p-2 cursor-pointer rounded transition-colors hover:bg-gray-100"
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
      window.toast.success('已重新开始处理文件');
    } catch (error) {
      console.error('Error retrying file processing:', error);
      window.toast.error('重试处理失败');
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
        className={`flex flex-col items-center p-4 rounded-lg cursor-pointer transition-all relative border h-60 box-border justify-start group ${
          isSelected
            ? 'bg-blue-50 border-blue-500'
            : 'border-transparent hover:bg-gray-50'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          handleFileSelect(file, e);
        }}
        onDoubleClick={() => handleFileDoubleClick(file)}
      >
        <div className="text-6xl mb-4 flex items-center justify-center h-25 w-full relative">
          {showThumbnail ? (
            <img
              src={getThumbnailUrl(file.id)}
              alt={file.name}
              className="max-w-full max-h-full object-contain rounded shadow-sm bg-gray-50"
              onError={() => handleThumbnailError(file.id)}
            />
          ) : (
            getFileIcon(file)
          )}
        </div>
        <div className="w-full overflow-hidden flex flex-col items-center">
          <div className="text-center w-full text-sm font-medium text-gray-900 mb-2 overflow-hidden text-ellipsis line-clamp-2 h-9 break-words">
            {file.name}
          </div>
          <div className="grid grid-cols-2 items-center gap-1">
            {!file.isFolder && <div className="text-xs text-gray-500 text-center w-full">
              {formatFileSize(file.size)}
            </div>}
            <div className="text-xs text-gray-500 text-center w-full">{file.owner}</div>
            <div className="text-xs text-gray-500 text-center w-full col-span-2">
              {new Date(file.lastModified).toLocaleDateString()}
            </div>
            {file.processingStatus && (
              <div className="relative mt-2 w-full flex flex-col items-center text-xs gap-1 col-span-2">
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
                  <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
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
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white bg-opacity-80 rounded p-1 shadow-sm z-10">
          <button
            className="p-1 border-none bg-none cursor-pointer rounded transition-colors hover:bg-gray-200"
            onClick={(e) => {
              e.stopPropagation();
              setOperation({ type: 'rename', fileId: file.id });
            }}
            title="重命名"
          >
            ✏️
          </button>
          <button
            className="p-1 border-none bg-none cursor-pointer rounded transition-colors hover:bg-gray-200"
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
              className="p-1 border-none bg-none cursor-pointer rounded transition-colors hover:bg-gray-200"
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
      <div className={`p-6 h-full flex flex-col ${className || ''}`}>
        <Loading size="large" text="加载中..." />
      </div>
    );
  }

  return (
    <div
      className={`p-6 h-full flex flex-col ${className || ''}`}
      onClick={handleContainerClick}
    >
      <div className="flex justify-between items-center p-3 pb-3 border-b border-gray-200">
        <div className="flex gap-2 items-center">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 border-none rounded-md bg-gray-100 text-gray-900 text-sm cursor-pointer transition-all h-8 hover:bg-gray-200"
            onClick={() => setOperation({ type: 'upload' })}
            title="上传新文件"
          >
            <span>📤</span>
            上传文件
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 border-none rounded-md bg-gray-100 text-gray-900 text-sm cursor-pointer transition-all h-8 hover:bg-gray-200"
            onClick={() => setShowNewFolderDialog(true)}
            title="创建新文件夹"
          >
            <span>📁</span>
            新建文件夹
          </button>
          {selectedFiles.size > 0 && (
            <>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 border-none rounded-md bg-gray-100 text-gray-900 text-sm cursor-pointer transition-all h-8 hover:bg-gray-200"
                onClick={handleDelete}
                title="删除选中项"
              >
                <span>🗑️</span>
                删除
              </button>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 border-none rounded-md bg-gray-100 text-gray-900 text-sm cursor-pointer transition-all h-8 hover:bg-gray-200"
                onClick={() => setOperation({ type: 'move', fileId: Array.from(selectedFiles)[0] })}
                title="移动到其他文件夹"
              >
                <span>📦</span>
                移动到
              </button>
            </>
          )}
        </div>
        <div className="flex gap-2 items-center ml-auto">
          <button
            className="px-3 py-1.5 border border-gray-300 rounded bg-white text-gray-900 text-sm cursor-pointer transition-all h-8 flex items-center hover:border-blue-500 hover:text-blue-500"
            onClick={() => handleSort('name')}
          >
            按名称排序
            {sortBy === 'name' && (
              <span>{sortOrder === 'asc' ? ' ↑' : ' ↓'}</span>
            )}
          </button>
          <button
            className="px-3 py-1.5 border border-gray-300 rounded bg-white text-gray-900 text-sm cursor-pointer transition-all h-8 flex items-center hover:border-blue-500 hover:text-blue-500"
            onClick={() => handleSort('date')}
          >
            按日期排序
            {sortBy === 'date' && (
              <span>{sortOrder === 'asc' ? ' ↑' : ' ↓'}</span>
            )}
          </button>

          <div className="flex items-center gap-1 ml-2 border-l border-gray-300 pl-2">
            <button
              className={`p-1.5 border border-gray-300 rounded bg-white text-gray-900 text-sm cursor-pointer transition-all flex items-center justify-center h-8 w-8 ${
                viewMode === 'list' ? 'bg-blue-500 text-white border-blue-500' : 'hover:border-blue-500 hover:text-blue-500'
              }`}
              onClick={() => setViewMode('list')}
              title="列表视图"
            >
              <List />
            </button>
            <button
              className={`p-1.5 border border-gray-300 rounded bg-white text-gray-900 text-sm cursor-pointer transition-all flex items-center justify-center h-8 w-8 ${
                viewMode === 'grid' ? 'bg-blue-500 text-white border-blue-500' : 'hover:border-blue-500 hover:text-blue-500'
              }`}
              onClick={() => setViewMode('grid')}
              title="网格视图"
            >
              <Grid />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6 p-2 bg-gray-100 rounded-md">
        <span
          className="text-gray-900 cursor-pointer transition-colors hover:text-blue-500"
          onClick={() => handleBreadcrumbClick(null)}
        >
          根目录
        </span>
        {folderPath.map((folder) => (
          <React.Fragment key={folder.id}>
            <span className="text-gray-500">/</span>
            <span
              className="text-gray-900 cursor-pointer transition-colors hover:text-blue-500"
              onClick={() => handleBreadcrumbClick(folder.id)}
            >
              {folder.name}
            </span>
          </React.Fragment>
        ))}
      </div>

      <div className="flex-1 bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
        {viewMode === 'list' ? (
          <div className="p-4 flex flex-col gap-2 flex-1 overflow-y-auto min-h-0" ref={fileListRef}>
            {sortedFiles.map((file) => {
              const isSelected = selectedFiles.has(getItemKey({ id: file.id, type: file.isFolder ? 'folder' : 'file' }));
              return (
                <div
                  key={file.id}
                  className={`flex items-center p-3 rounded-md cursor-pointer transition-all group ${
                    isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFileSelect(file, e);
                  }}
                  onDoubleClick={() => handleFileDoubleClick(file)}
                >
                  <div className="text-2xl mr-4 w-6 text-center flex items-center justify-center">
                    {getFileIcon(file)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="h-4.5 text-sm font-medium text-gray-900 mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
                      {file.name}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {!file.isFolder && <span>{formatFileSize(file.size)}</span>}
                      <span>•</span>
                      <span>{new Date(file.lastModified).toLocaleString()}</span>
                      {file.processingStatus && (
                        <div className="flex items-center gap-2 ml-2">
                          <span>•</span>
                          <span
                            className={`${
                              file.processingStatus === 'pending' ? 'text-yellow-500' :
                              file.processingStatus === 'processing' ? 'text-blue-500' :
                              file.processingStatus === 'completed' ? 'text-green-500' :
                              'text-red-500'
                            }`}
                            title={file.errorMessage || TOOLTIPS[file.processingStatus.toLowerCase() as ProcessingStatus]}
                          >
                            {ICONS[file.processingStatus.toLowerCase() as ProcessingStatus]} {file.processingStatus}
                          </span>
                          {file.processingStatus === "processing" && (
                            <div className="w-25 h-1.5 bg-gray-200 rounded-full overflow-hidden">
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
                  <div className="text-sm text-gray-600 mx-6">{file.owner}</div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-1 border-none bg-none cursor-pointer rounded transition-colors hover:bg-gray-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOperation({ type: 'rename', fileId: file.id });
                      }}
                      title="重命名"
                    >
                      ✏️
                    </button>
                    <button
                      className="p-1 border-none bg-none cursor-pointer rounded transition-colors hover:bg-gray-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(file.id, file.isFolder);
                      }}
                      title="下载"
                    >
                      ⬇️
                    </button>
                    {!file.isFolder && (
                      <>
                        {file.processingStatus === 'failed' && (
                          <button
                            className="p-1 border-none bg-none cursor-pointer rounded transition-colors hover:bg-gray-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRetryProcessing(file.id);
                            }}
                            title="重试处理"
                          >
                            🔄
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 grid grid-cols-4 gap-4 flex-1 overflow-y-auto min-h-0 xl:grid-cols-4 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1" ref={fileListRef}>
            {sortedFiles.map(renderGridItem)}
          </div>
        )}
      </div>

      {showNewFolderDialog && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg min-w-96 max-w-[90vw] max-h-[90vh] overflow-y-auto">
            <h3 className="m-0 mb-4 text-lg text-gray-900">新建文件夹</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="请输入文件夹名称"
              className="w-full p-2 border border-gray-300 rounded text-sm mb-4 focus:border-blue-500 focus:outline-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowNewFolderDialog(false)}
                className="px-4 py-1.5 rounded text-sm cursor-pointer transition-all border border-gray-300 bg-white text-gray-900 hover:opacity-80"
              >
                取消
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-4 py-1.5 rounded text-sm cursor-pointer transition-all border-none bg-blue-500 text-white hover:opacity-80"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {operation?.type === 'rename' && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg min-w-96 max-w-[90vw] max-h-[90vh] overflow-y-auto">
            <h3 className="m-0 mb-4 text-lg text-gray-900">重命名</h3>
            <input
              type="text"
              defaultValue={files.find(f => f.id === operation.fileId)?.name}
              onChange={(e) => operation.data = { ...operation.data, newName: e.target.value }}
              placeholder="请输入新名称"
              className="w-full p-2 border border-gray-300 rounded text-sm mb-4 focus:border-blue-500 focus:outline-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setOperation(null)}
                className="px-4 py-1.5 rounded text-sm cursor-pointer transition-all border border-gray-300 bg-white text-gray-900 hover:opacity-80"
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
                className="px-4 py-1.5 rounded text-sm cursor-pointer transition-all border-none bg-blue-500 text-white hover:opacity-80"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {operation?.type === 'move' && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg min-w-96 max-w-[90vw] max-h-[90vh] overflow-y-auto">
            <h3 className="m-0 mb-4 text-lg text-gray-900">移动到</h3>
            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded p-2 my-2.5">
              <div
                className={`flex items-center p-2 cursor-pointer rounded transition-colors ${
                  getCurrentFolderId() === null ? 'bg-blue-50' : 'hover:bg-gray-100'
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
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setOperation(null)}
                className="px-4 py-1.5 rounded text-sm cursor-pointer transition-all border border-gray-300 bg-white text-gray-900 hover:opacity-80"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {operation?.type === 'upload' && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg min-w-96 max-w-[90vw] max-h-[90vh] overflow-y-auto">
            <h3 className="m-0 mb-4 text-lg text-gray-900">上传文件</h3>
            <DragZone onFileSelect={handleUpload} />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setOperation(null)}
                className="px-4 py-1.5 rounded text-sm cursor-pointer transition-all border border-gray-300 bg-white text-gray-900 hover:opacity-80"
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
