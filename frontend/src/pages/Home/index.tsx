import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { messageApi, forumApi } from '../../api';
import type { Message, Post, FileItem } from '../../api';
import styles from './Home.module.css';
import Loading from '../../components/Loading';
import FileList from '../../components/FileList';
import { RiBookmarkLine } from 'react-icons/ri';
import { FaGithub } from 'react-icons/fa';
import confetti from 'canvas-confetti';

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
  const [confettiShown, setConfettiShown] = useState(false);

  useEffect(() => {
    fetchRecentActivities();

    // 彩带显示逻辑
    const checkConfettiDisplay = () => {
      // 检查是否已经在本地存储中记录过显示
      const hasShownConfetti = localStorage.getItem('confettiShown');

      // 检查当前日期是否在截止日期之前
      const currentDate = new Date();
      const endDate = new Date('2025-03-27');

      // 如果没有显示过，并且当前日期在截止日期之前，显示彩带
      if (hasShownConfetti && currentDate < endDate) {
        setTimeout(() => {
          // 多彩的彩带效果
          const duration = 1000;
          const animationEnd = Date.now() + duration;
          const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

          function randomInRange(min: number, max: number): number {
            return Math.random() * (max - min) + min;
          }

          const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
              return clearInterval(interval);
            }

            const particleCount = 70 * (timeLeft / duration);

            // 从左侧发射
            confetti({
              ...defaults,
              particleCount,
              origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
            });

            // 从右侧发射
            confetti({
              ...defaults,
              particleCount,
              origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
            });
          }, 250);

          // 标记为已显示
          localStorage.setItem('confettiShown', 'true');
          setConfettiShown(true);
        }, 1000); // 页面加载1秒后显示
      } else {
        // 查看本地存储中是否已标记为显示过
        if (localStorage.getItem('confettiShown') === 'true') {
          setConfettiShown(true);
        }
      }
    };

    checkConfettiDisplay();
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
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>欢迎回来</h1>
          <p className={styles.subtitle}>
            这里是您的工作空间，可以方便地管理文件和查看最近的活动。
          </p>
          {confettiShown && (
            <div className={styles.openSourceNotice}>
              🎉 重要通知：我们已正式开源！感谢您的支持与信任。
              <a
                href="https://github.com/BetterAndBetterII/TheLab"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.githubLink}
              >
                <FaGithub /> 访问我们的 GitHub 仓库
              </a>
            </div>
          )}
        </div>
        <Link to="/about" className={styles.aboutLink}>
          <RiBookmarkLine />
          <span className={styles.aboutLinkText}>关于我们</span>
        </Link>
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
