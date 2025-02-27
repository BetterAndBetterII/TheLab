import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import styles from './Forum.module.css';
import Loading from '../../components/Loading';

interface Post {
  id: string;
  title: string;
  author: string;
  content: string;
  createdAt: string;
  likes: number;
  comments: number;
  tags: string[];
  coverImage?: string;
}

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
    { id: 'tech', name: '技术', icon: '💻' },
    { id: 'life', name: '生活', icon: '🌟' },
    { id: 'share', name: '分享', icon: '🎯' },
    { id: 'question', name: '问答', icon: '❓' },
    { id: 'news', name: '资讯', icon: '📰' },
  ];

  const fetchPosts = async (pageNum: number, refresh: boolean = false) => {
    try {
      setLoading(true);
      // 模拟API请求延迟
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 模拟获取帖子数据
      const newPosts: Post[] = Array(10).fill(null).map((_, index) => ({
        id: pageNum + '-' + index,
        title: '帖子标题 #' + (pageNum * 10 + index),
        author: '用户' + Math.floor(Math.random() * 100),
        content: '这是帖子的内容预览，展示一些基本信息...',
        createdAt: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
        likes: Math.floor(Math.random() * 100),
        comments: Math.floor(Math.random() * 50),
        tags: ['标签1', '标签2'],
        coverImage: Math.random() > 0.5 ? 'https://picsum.photos/400/300?random=' + (pageNum * 10 + index) : undefined,
      }));

      if (refresh) {
        setPosts(newPosts);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
      }
      setHasMore(pageNum < 5); // 模拟只有5页数据
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await fetchPosts(1, true);
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
              {post.coverImage && (
                <div className={styles.postCover}>
                  <img src={post.coverImage} alt={post.title} />
                </div>
              )}
              <div className={styles.postContent}>
                <h2 className={styles.postTitle}>{post.title}</h2>
                <p className={styles.postPreview}>{post.content}</p>
                <div className={styles.postMeta}>
                  <span className={styles.postAuthor}>{post.author}</span>
                  <span className={styles.postTime}>
                    {new Date(post.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className={styles.postFooter}>
                  <div className={styles.postTags}>
                    {post.tags.map(tag => (
                      <span key={tag} className={styles.tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className={styles.postStats}>
                    <span>👍 {post.likes}</span>
                    <span>💬 {post.comments}</span>
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
