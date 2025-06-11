import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import Loading from '../../components/Loading';
import { forumApi } from '../../api/forum';
import type { Post, Reply } from '../../api/types';

const PostDetail: React.FC = () => {
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 路径中获取id
  const id = window.location.pathname.split('/').pop();

  const fetchPost = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const postData = await forumApi.getPost(id);
      setPost(postData);
    } catch (error) {
      console.error('Error fetching post:', error);
      setError('加载帖子失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) {
      navigate('/forum');
      return;
    }
    fetchPost();
  }, [id, navigate]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newComment.trim() || submitting) return;

    try {
      setSubmitting(true);
      const reply = await forumApi.createReply(id, newComment.trim());

      // 更新帖子的回复列表
      setPost(prev => {
        if (!prev) return null;
        return {
          ...prev,
          replies: [...prev.replies, reply]
        };
      });

      setNewComment('');
    } catch (error) {
      console.error('Error creating reply:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-5">
        <Loading size="large" text="加载中..." />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-4xl mx-auto p-5">
        <div className="mb-6">
          <Link to="/forum" className="inline-flex items-center gap-2 px-4 py-2 bg-transparent border-none rounded-lg text-gray-600 dark:text-gray-400 text-sm font-medium no-underline transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100">
            ← 返回论坛
          </Link>
        </div>
        <div className="flex justify-center items-center h-52 text-base text-red-600 dark:text-red-400">{error || '帖子不存在'}</div>
      </div>
    );
  }

  const categoryNames: Record<string, string> = {
    general: '综合讨论',
    technical: '技术交流',
    question: '问答',
    sharing: '分享',
    feedback: '反馈'
  };

  return (
    <div className="max-w-4xl mx-auto p-5">
      <div className="mb-6">
        <Link to="/forum" className="inline-flex items-center gap-2 px-4 py-2 bg-transparent border-none rounded-lg text-gray-600 dark:text-gray-400 text-sm font-medium no-underline transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100">
          ← 返回论坛
        </Link>
      </div>

      <article className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-12 mb-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-3">{post.title}</h1>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
            <span className="font-medium text-blue-600 dark:text-blue-400">{post.username}</span>
            <span>•</span>
            <span>
              {new Date(post.created_at).toLocaleString()}
            </span>
          </div>
          <div className="mb-4">
            <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-xs text-blue-600 dark:text-blue-400 font-medium">
              {categoryNames[post.category] || post.category}
            </span>
          </div>
        </div>

        <div className="text-base leading-relaxed text-gray-900 dark:text-gray-100 prose prose-gray dark:prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex, rehypeRaw]}
          >
            {post.content}
          </ReactMarkdown>
        </div>

        <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 border-none rounded-lg text-gray-600 dark:text-gray-400 text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100">
            👁️ 浏览 ({post.views})
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 border-none rounded-lg text-gray-600 dark:text-gray-400 text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100">
            💬 回复 ({post.replies.length})
          </button>
        </div>
      </article>

      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
          回复 ({post.replies.length})
        </h2>

        <form onSubmit={handleSubmitComment} className="mb-6">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="写下你的回复..."
            className="w-full p-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded text-sm resize-vertical mb-3 transition-colors duration-200 focus:outline-none focus:border-blue-600 dark:focus:border-blue-400 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
            rows={3}
            disabled={submitting}
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white border-none rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
            disabled={submitting || !newComment.trim()}
          >
            {submitting ? '发送中...' : '发表回复'}
          </button>
        </form>

        <div className="flex flex-col gap-4">
          {post.replies.map((reply) => (
            <div key={reply.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  {reply.username}
                  {reply.is_ai_generated && (
                    <span className="px-1.5 py-0.5 bg-green-500 dark:bg-green-600 text-white rounded text-[10px] font-semibold">AI</span>
                  )}
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {new Date(reply.created_at).toLocaleString()}
                </span>
              </div>
              <div className="text-sm leading-relaxed text-gray-900 dark:text-gray-100 mb-3 whitespace-pre-wrap">
                {reply.content.split('\n').map((line, index) => (
                  <p key={index}>{line}</p>
                ))}
              </div>
              {reply.parent_id && (
                <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded mt-2">
                  回复：{post.replies.find(r => r.id === reply.parent_id)?.username}
                </div>
              )}
            </div>
          ))}

          {post.replies.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm bg-gray-50 dark:bg-gray-800 rounded-lg">
              暂无回复，来说第一句吧
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostDetail;
