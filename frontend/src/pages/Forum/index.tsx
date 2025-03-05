import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import styles from './Forum.module.css';
import Loading from '../../components/Loading';
import { forumApi } from '../../api/forum';
import type { Post } from '../../api/types';

const Forum: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const observer = useRef<IntersectionObserver>();
  const loadingRef = useRef<HTMLDivElement>(null);

  // 分类列表
  const categories = [
    { id: 'all', name: '全部', icon: '📑' },
    { id: 'general', name: '综合讨论', icon: '💬' },
    { id: 'technical', name: '技术交流', icon: '💻' },
    { id: 'question', name: '问答', icon: '❓' },
    { id: 'sharing', name: '分享', icon: '🎯' },
    { id: 'feedback', name: '反馈', icon: '📝' },
  ];

  const fetchPosts = async (pageNum: number, refresh: boolean = false) => {
    try {
      setLoading(true);
      const newPosts = await forumApi.getPosts(pageNum, activeCategory);

      if (refresh) {
        setPosts(newPosts);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
      }
      setHasMore(newPosts.length === 10); // 如果返回10条数据，说明可能还有更多
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      // 先生成一个AI推文
      // await forumApi.generateAiTopic();
      // 然后刷新页面
      setPage(1);
      await fetchPosts(1, true);
    } catch (error) {
      console.error('Error refreshing posts:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const lastPostRef = useCallback((node: HTMLDivElement) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  useEffect(() => {
    fetchPosts(page);
  }, [page]);

  useEffect(() => {
    handleRefresh();
  }, [activeCategory]);

  return (
    <div className={styles.container}>
      {/* 顶部分类栏 */}
      <div className={styles.categoryBar}>
        <div className={styles.categories}>
          {categories.map(category => (
            <button
              key={category.id}
              className={styles.categoryButton + ' ' +
                (activeCategory === category.id ? styles.categoryButtonActive : '')}
              onClick={() => setActiveCategory(category.id)}
            >
              <span className={styles.categoryIcon}>{category.icon}</span>
              <span>{category.name}</span>
            </button>
          ))}
        </div>
        <button
          className={styles.refreshButton}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? '刷新中...' : '刷新'}
        </button>
      </div>

      {/* 帖子瀑布流 */}
      <div className={styles.postsGrid}>
        {posts.map((post, index) => (
          <div
            key={post.id}
            ref={index === posts.length - 1 ? lastPostRef : undefined}
          >
            <Link
              to={'/forum/post/' + post.id}
              className={styles.postCard}
            >
              <div className={styles.postContent}>
                <h2 className={styles.postTitle}>{post.title}</h2>
                <p className={styles.postPreview}>{post.content}</p>
                <div className={styles.postMeta}>
                  <span className={styles.postAuthor}>{post.username}</span>
                  <span className={styles.postTime}>
                    {new Date(post.created_at).toLocaleString()}
                  </span>
                </div>
                <div className={styles.postFooter}>
                  <div className={styles.postStats}>
                    <span>👁️ {post.views}</span>
                    <span>💬 {post.replies.length}</span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {/* 加载状态 */}
      {loading && (
        <div ref={loadingRef} className={styles.loading}>
          <Loading size="medium" text="加载中..." />
        </div>
      )}

      {/* 没有更多数据 */}
      {!hasMore && !loading && (
        <div className={styles.noMore}>
          没有更多内容了
        </div>
      )}
    </div>
  );
};

export default Forum;
