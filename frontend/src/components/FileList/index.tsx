import React, { useState, useEffect, useRef } from 'react';
import styles from './FileList.module.css';
import Loading from '../Loading';
import { fileApi, type FileItem, type FolderTree } from '../../api';
import DragZone from './DragZone';
import { useNavigate } from 'react-router-dom';

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

const FileList: React.FC<FileListProps> = ({
  onFileSelect,
  onFolderChange,
  className
}) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<FileItem[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [operation, setOperation] = useState<FileOperation | null>(null);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const fileListRef = useRef<HTMLDivElement>(null);
  const [folderTree, setFolderTree] = useState<FolderTree[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    setSelectedFiles(new Set());
    fetchFiles();
    fileApi.getFolderTree().then(setFolderTree);
  }, [currentFolder]);

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

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await fileApi.getFiles(currentFolder);
      setFiles(response);
      
      if (currentFolder) {
        const folderDetails = await fileApi.getFolderDetails(currentFolder);
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

      onFolderChange?.(currentFolder);
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
        await fileApi.uploadFile(files[i], currentFolder);
      }
      fetchFiles();
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
      await fileApi.createFolder(newFolderName, currentFolder);
      setNewFolderName('');
      setShowNewFolderDialog(false);
      fetchFiles();
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
        fetchFiles();
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
      fetchFiles();
      (window as any).toast.success('移动成功');
    } catch (error) {
      console.error('Error moving files:', error);
      (window as any).toast.error('移动失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (fileId: string, newName: string) => {
    try {
      setLoading(true);
      await fileApi.renameFile(fileId, { newName });
      setOperation(null);
      fetchFiles();
      (window as any).toast.success('重命名成功');
    } catch (error) {
      console.error('Error renaming file:', error);
      (window as any).toast.error('重命名失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileId: string) => {
    try {
      await fileApi.downloadFile(fileId);
      (window as any).toast.success('下载成功');
    } catch (error) {
      console.error('Error downloading file:', error);
      (window as any).toast.error('下载失败');
    }
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

  const getProcessingStatusInfo = (status: string | undefined, errorMessage?: string) => {
    if (!status) return null;
    
    let icon = '';
    let color = '';
    let progress = 0;
    let tooltip = '';
    
    switch (status.toLowerCase()) {
      case 'pending':
        icon = '⏳';
        color = 'pending';
        progress = 0;
        tooltip = '等待处理';
        break;
      case 'processing':
        icon = '🔄';
        color = 'processing';
        progress = 50;
        tooltip = '处理中';
        break;
      case 'completed':
        icon = '✅';
        color = 'completed';
        progress = 100;
        tooltip = '处理完成';
        break;
      case 'failed':
        icon = '❌';
        color = 'failed';
        progress = 100;
        tooltip = errorMessage || '处理失败';
        break;
      default:
        return null;
    }
    
    return { icon, color, progress, tooltip };
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
              className={styles.folderTreeItem}
              onClick={() => handleMove(folder.id)}
            >
              <span className={styles.folderIcon}>
                {folder.children?.length ? '📁' : '📂'}
              </span>
              <span className={styles.folderName}>{folder.name}</span>
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
      fetchFiles();
      (window as any).toast.success('已重新开始处理文件');
    } catch (error) {
      console.error('Error retrying file processing:', error);
      (window as any).toast.error('重试处理失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`${styles.container} ${className || ''}`}>
        <Loading size="large" text="加载中..." />
      </div>
    );
  }

  return (
    <div 
      className={`${styles.container} ${className || ''}`} 
      onClick={handleContainerClick}
    >
      <div className={styles.header}>
        <div className={styles.actions}>
          <button 
            className={styles.actionButton}
            onClick={() => setOperation({ type: 'upload' })}
          >
            <span>📤</span>
            上传文件
          </button>
          <button 
            className={styles.actionButton}
            onClick={() => setShowNewFolderDialog(true)}
          >
            <span>📁</span>
            新建文件夹
          </button>
          {selectedFiles.size > 0 && (
            <>
              <button 
                className={styles.actionButton}
                onClick={handleDelete}
              >
                <span>🗑️</span>
                删除
              </button>
              <button 
                className={styles.actionButton}
                onClick={() => setOperation({ type: 'move', fileId: Array.from(selectedFiles)[0] })}
              >
                <span>📦</span>
                移动到
              </button>
            </>
          )}
        </div>
      </div>

      <div className={styles.breadcrumb}>
        <span 
          className={styles.breadcrumbItem} 
          onClick={() => setCurrentFolder(null)}
        >
          根目录
        </span>
        {folderPath.map((folder) => (
          <React.Fragment key={folder.id}>
            <span className={styles.breadcrumbSeparator}>/</span>
            <span
              className={styles.breadcrumbItem}
              onClick={() => setCurrentFolder(folder.id)}
            >
              {folder.name}
            </span>
          </React.Fragment>
        ))}
      </div>

      <div className={styles.content}>
        <div className={styles.toolbar}>
          <button
            className={styles.sortButton}
            onClick={() => handleSort('name')}
          >
            按名称排序
            {sortBy === 'name' && (
              <span>{sortOrder === 'asc' ? ' ↑' : ' ↓'}</span>
            )}
          </button>
          <button
            className={styles.sortButton}
            onClick={() => handleSort('date')}
          >
            按日期排序
            {sortBy === 'date' && (
              <span>{sortOrder === 'asc' ? ' ↑' : ' ↓'}</span>
            )}
          </button>
        </div>

        <div className={styles.fileList} ref={fileListRef}>
          {sortedFiles.map((file) => (
            <div
              key={file.id}
              className={`${styles.fileItem} ${
                selectedFiles.has(getItemKey({ id: file.id, type: file.isFolder ? 'folder' : 'file' })) ? styles.fileItemActive : ''
              }`}
              onClick={(e) => {
                e.stopPropagation(); // 阻止事件冒泡
                handleFileSelect(file, e);
              }}
              onDoubleClick={() => {
                if (file.isFolder) {
                  setCurrentFolder(file.id);
                } else {
                  // handleDownload(file.id);
                  navigate(`/chat/${file.id}`);
                }
              }}
            >
              <div className={styles.fileIcon}>
                {getFileIcon(file)}
              </div>
              <div className={styles.fileInfo}>
                <div className={styles.fileName}>{file.name}</div>
                <div className={styles.fileMeta}>
                  {!file.isFolder && <span>{formatFileSize(file.size)}</span>}
                  <span>•</span>
                  <span>{new Date(file.lastModified).toLocaleString()}</span>
                  {file.processingStatus && (
                    <div className={styles.processingStatus}>
                      <span>•</span>
                      {(() => {
                        const statusInfo = getProcessingStatusInfo(file.processingStatus, file.errorMessage);
                        if (!statusInfo) return null;
                        
                        return (
                          <>
                            <span 
                              className={styles[statusInfo.color]} 
                              title={statusInfo.tooltip}
                            >
                              {statusInfo.icon} {file.processingStatus}
                            </span>
                            {file.processingStatus === "processing" && <div className={styles.progressBar}>
                              <div 
                                className={styles.progressFill} 
                                style={{ width: `${statusInfo.progress}%` }}
                              />
                            </div>}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.fileOwner}>{file.owner}</div>
              <div className={styles.fileActions}>
                <button
                  className={styles.iconButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOperation({ type: 'rename', fileId: file.id });
                  }}
                >
                  ✏️
                </button>
                {!file.isFolder && (
                  <>
                    <button
                      className={styles.iconButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(file.id);
                      }}
                    >
                      ⬇️
                    </button>
                    {file.processingStatus === 'failed' && (
                      <button
                        className={styles.iconButton}
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
          ))}
        </div>
      </div>

      {showNewFolderDialog && (
        <div className={styles.dialog}>
          <div className={styles.dialogContent}>
            <h3>新建文件夹</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="请输入文件夹名称"
            />
            <div className={styles.dialogActions}>
              <button onClick={() => setShowNewFolderDialog(false)}>取消</button>
              <button onClick={handleCreateFolder}>确定</button>
            </div>
          </div>
        </div>
      )}

      {operation?.type === 'rename' && (
        <div className={styles.dialog}>
          <div className={styles.dialogContent}>
            <h3>重命名</h3>
            <input
              type="text"
              defaultValue={files.find(f => f.id === operation.fileId)?.name}
              onChange={(e) => operation.data = { ...operation.data, newName: e.target.value }}
              placeholder="请输入新名称"
            />
            <div className={styles.dialogActions}>
              <button onClick={() => setOperation(null)}>取消</button>
              <button onClick={() => handleRename(operation.fileId || '', operation.data?.newName || '')}>
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {operation?.type === 'move' && (
        <div className={styles.dialog}>
          <div className={styles.dialogContent}>
            <h3>移动到</h3>
            <div className={styles.folderList}>
              <div
                className={`${styles.folderTreeItem} ${currentFolder === null ? styles.folderTreeItemSelected : ''}`}
                onClick={() => handleMove(null)}
              >
                <span className={styles.folderIcon}>📁</span>
                <span className={styles.folderName}>根目录</span>
              </div>
              <FolderTreeView 
                folders={folderTree} 
                level={1}
                selectedItems={selectedFiles}
              />
            </div>
            <div className={styles.dialogActions}>
              <button onClick={() => setOperation(null)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {operation?.type === 'upload' && (
        <div className={styles.dialog}>
          <div className={styles.dialogContent}>
            <h3>上传文件</h3>
            <DragZone onFileSelect={handleUpload} />
            <div className={styles.dialogActions}>
              <button onClick={() => setOperation(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileList; 