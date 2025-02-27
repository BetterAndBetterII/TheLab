import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fileApi, messageApi, forumApi } from '../../api';
import type { FileItem, Message, Post } from '../../api';
import styles from './Home.module.css';
import Loading from '../../components/Loading';

interface RecentActivity {
  id: string;
  type: 'file' | 'message' | 'post';
  title: string;
  date: string;
  link: string;
}

interface FileSystemItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  lastModified: string;
  path: string;
}

const Home: React.FC = () => {
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [fileSystem, setFileSystem] = useState<FileSystemItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<FileSystemItem | null>(null);

  useEffect(() => {
    fetchRecentActivities();
    fetchFileSystem();
  }, []);

  useEffect(() => {
    fetchFileSystem();
  }, [currentPath]);

  const fetchRecentActivities = async () => {
    try {
      const [files, messages, posts] = await Promise.all([
        fileApi.getFiles(),
        messageApi.getMessages(),
        forumApi.getRecentPosts(),
      ]);

      const activities: RecentActivity[] = [
        ...files.slice(0, 3).map((file: FileItem) => ({
          id: file.id,
          type: 'file' as const,
          title: file.name,
          date: file.lastModified,
          link: `/file/${file.id}`,
        })),
        ...messages.slice(0, 3).map((message: Message) => ({
          id: message.id,
          type: 'message' as const,
          title: message.subject,
          date: message.createdAt,
          link: `/email`,
        })),
        ...posts.slice(0, 3).map((post: Post) => ({
          id: post.id,
          type: 'post' as const,
          title: post.title,
          date: post.createdAt,
          link: `/forum/post/${post.id}`,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setRecentActivities(activities);
    } catch (error) {
      console.error('Error fetching recent activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFileSystem = async () => {
    try {
      // 模拟从 API 获取文件系统数据
      const mockFiles: FileSystemItem[] = [
        {
          id: '1',
          name: '文档',
          type: 'folder',
          lastModified: '2024-02-28T10:00:00Z',
          path: '/文档'
        },
        {
          id: '2',
          name: '图片',
          type: 'folder',
          lastModified: '2024-02-28T09:00:00Z',
          path: '/图片'
        },
        {
          id: '3',
          name: '项目报告.docx',
          type: 'file',
          size: 1024 * 1024,
          lastModified: '2024-02-28T08:00:00Z',
          path: '/项目报告.docx'
        },
        {
          id: '4',
          name: '会议记录.pdf',
          type: 'file',
          size: 512 * 1024,
          lastModified: '2024-02-28T07:00:00Z',
          path: '/会议记录.pdf'
        }
      ];

      setFileSystem(mockFiles);
    } catch (error) {
      console.error('Error fetching file system:', error);
    }
  };

  const handleFileClick = (item: FileSystemItem) => {
    setSelectedItem(item);
    if (item.type === 'folder') {
      setCurrentPath(item.path);
    }
  };

  const handleBack = () => {
    if (currentPath === '/') return;
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    setCurrentPath(parentPath);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'file':
        return <div className={`${styles.icon} ${styles.fileIcon}`}>📄</div>;
      case 'message':
        return <div className={`${styles.icon} ${styles.messageIcon}`}>✉️</div>;
      case 'post':
        return <div className={`${styles.icon} ${styles.postIcon}`}>📝</div>;
      default:
        return null;
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
        <h1 className={styles.title}>欢迎回来</h1>
        <p className={styles.subtitle}>
          这里是您的工作空间，可以方便地管理文件和查看最近的活动。
        </p>
      </div>

      <div className={styles.content}>
        {/* 文件管理器 */}
        <div className={styles.fileManager}>
          <div className={styles.fileManagerHeader}>
            <div className={styles.breadcrumb}>
              <button
                onClick={handleBack}
                className={styles.backButton}
                disabled={currentPath === '/'}
              >
                ⬅️ 返回
              </button>
              <span className={styles.currentPath}>
                当前位置: {currentPath || '/'}
              </span>
            </div>
            <button className={styles.uploadButton}>
              📤 上传文件
            </button>
          </div>

          <div className={styles.fileList}>
            {fileSystem.map((item) => (
              <div
                key={item.id}
                className={`${styles.fileItem} ${
                  selectedItem?.id === item.id ? styles.fileItemSelected : ''
                }`}
                onClick={() => handleFileClick(item)}
              >
                <div className={styles.fileIcon}>
                  {item.type === 'folder' ? '📁' : '📄'}
                </div>
                <div className={styles.fileInfo}>
                  <div className={styles.fileName}>{item.name}</div>
                  <div className={styles.fileMeta}>
                    <span>{formatFileSize(item.size)}</span>
                    <span>•</span>
                    <span>
                      {new Date(item.lastModified).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 最近活动 */}
        <div className={styles.recentActivities}>
          <h2 className={styles.sectionTitle}>最近活动</h2>
          <div className={styles.activityGrid}>
            {recentActivities.map((activity) => (
              <Link key={activity.id} to={activity.link} className={styles.card}>
                <div className={styles.cardHeader}>
                  {getActivityIcon(activity.type)}
                  <div>
                    <h3 className={styles.cardTitle}>{activity.title}</h3>
                    <p className={styles.cardDate}>{activity.date}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
