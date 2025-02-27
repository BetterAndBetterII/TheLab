import React, { useState, useEffect } from 'react';
import styles from './FileList.module.css';
import Loading from '../../components/Loading';

interface File {
  id: string;
  name: string;
  type: string;
  size: number;
  lastModified: string;
  owner: string;
}

const FileList: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      // 模拟从 API 获取文件列表
      const mockFiles: File[] = [
        {
          id: '1',
          name: '项目计划书.docx',
          type: 'document',
          size: 1024 * 1024,
          lastModified: '2024-02-27T10:00:00Z',
          owner: 'Alice',
        },
        {
          id: '2',
          name: '财务报表.xlsx',
          type: 'spreadsheet',
          size: 2048 * 1024,
          lastModified: '2024-02-26T15:30:00Z',
          owner: 'Bob',
        },
        {
          id: '3',
          name: '产品设计稿.psd',
          type: 'image',
          size: 5120 * 1024,
          lastModified: '2024-02-25T09:15:00Z',
          owner: 'Charlie',
        },
      ];

      await new Promise((resolve) => setTimeout(resolve, 1000));
      setFiles(mockFiles);
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
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

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'document':
        return '📄';
      case 'spreadsheet':
        return '📊';
      case 'image':
        return '🖼️';
      default:
        return '📁';
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Loading size="large" text="加载中..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>文件列表</h1>
        <button className={styles.uploadButton}>
          <span>📤</span>
          上传文件
        </button>
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

        <div className={styles.fileList}>
          {sortedFiles.map((file) => (
            <div
              key={file.id}
              className={`${styles.fileItem} ${
                selectedFile?.id === file.id ? styles.fileItemActive : ''
              }`}
              onClick={() => setSelectedFile(file)}
            >
              <div className={styles.fileIcon}>
                {getFileIcon(file.type)}
              </div>
              <div className={styles.fileInfo}>
                <div className={styles.fileName}>{file.name}</div>
                <div className={styles.fileMeta}>
                  <span>{formatFileSize(file.size)}</span>
                  <span>•</span>
                  <span>{new Date(file.lastModified).toLocaleString()}</span>
                </div>
              </div>
              <div className={styles.fileOwner}>{file.owner}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FileList;
