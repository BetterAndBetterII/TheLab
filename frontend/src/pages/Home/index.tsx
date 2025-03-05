import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { messageApi, forumApi } from '../../api';
import type { Message, Post, FileItem } from '../../api';
import styles from './Home.module.css';
import Loading from '../../components/Loading';
import FileList from '../../components/FileList';

interface RecentActivity {
  id: string;
  type: 'file' | 'message' | 'post';
  title: string;
  date: string;
  link: string;
}

const Home: React.FC = () => {
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  useEffect(() => {
    fetchRecentActivities();
  }, []);

  const fetchRecentActivities = async () => {
    try {
      const [messages, posts] = await Promise.all([
        messageApi.getMessages(),
        forumApi.getRecentPosts(),
      ]);

      const activities: RecentActivity[] = [
        ...messages.slice(0, 3).map((message: Message) => ({
          id: message.id.toString(),
          type: 'message' as const,
          title: message.subject,
          date: message.createdAt,
          link: `/email`,
        })),
        ...posts.slice(0, 3).map((post: Post) => ({
          id: post.id.toString(),
          type: 'post' as const,
          title: post.title,
          date: post.created_at,
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

  const handleFileSelect = (file: FileItem) => {
    setSelectedFile(file);
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
        <div className={styles.fileManager} style={{ width: '100%' }}>
          <FileList
            onFileSelect={handleFileSelect}
            className={styles.fileList}
          />
        </div>

        {/* 最近活动 */}
        {/* <div className={styles.recentActivities}>
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
        </div> */}
      </div>
    </div>
  );
};

export default Home;
