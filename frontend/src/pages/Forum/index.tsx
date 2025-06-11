import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
    <div className="max-w-[1400px] mx-auto p-2 md:p-4 min-h-[calc(100vh-80px)]">
      {/* 顶部分类栏 */}
      <div className="sticky top-2 z-10 bg-white dark:bg-gray-800 p-2 md:p-4 mb-4 flex justify-between items-center rounded-2xl border-b border-gray-200 dark:border-gray-700 h-12">
        <div className="flex gap-2 overflow-x-auto mr-4 scrollbar-hide">
          {categories.map(category => (
            <button
              key={category.id}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium cursor-pointer transition-all duration-200 whitespace-nowrap ${
                activeCategory === category.id 
                  ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
              onClick={() => setActiveCategory(category.id)}
            >
              <span className="text-base md:text-xl">{category.icon}</span>
              <span>{category.name}</span>
            </button>
          ))}
        </div>
        <button
          className="px-3 md:px-4 py-2 bg-gray-100 dark:bg-gray-700 border-none rounded-lg text-gray-600 dark:text-gray-400 text-xs md:text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? '刷新中...' : '刷新'}
        </button>
      </div>

      {/* 帖子瀑布流 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 p-2">
        {posts.map((post, index) => (
          <div
            key={post.id}
            ref={index === posts.length - 1 ? lastPostRef : undefined}
          >
            <Link
              to={'/forum/post/' + post.id}
              className="flex flex-col bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 no-underline text-inherit h-full hover:-translate-y-1"
            >
              <div className="p-4 flex-1 flex flex-col">
                <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">
                  {post.title}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-3 leading-relaxed">
                  {post.content}
                </p>
                <div className="flex justify-between items-center mb-4 text-xs text-gray-500 dark:text-gray-500">
                  <span className="font-medium text-blue-600 dark:text-blue-400">{post.username}</span>
                  <span>
                    {new Date(post.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-auto">
                  <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-500">
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
        <div ref={loadingRef} className="flex justify-center items-center py-8 text-gray-500 dark:text-gray-400">
          <Loading size="medium" text="加载中..." />
        </div>
      )}

      {/* 没有更多数据 */}
      {!hasMore && !loading && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          没有更多内容了
        </div>
      )}

      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default Forum;