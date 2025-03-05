import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import styles from './PostDetail.module.css';
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
      <div className={styles.container}>
        <Loading size="large" text="加载中..." />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <Link to="/forum" className={styles.backButton}>
            ← 返回论坛
          </Link>
        </div>
        <div className={styles.error}>{error || '帖子不存在'}</div>
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
    <div className={styles.container}>
      <div className={styles.header}>
        <Link to="/forum" className={styles.backButton}>
          ← 返回论坛
        </Link>
      </div>

      <article className={styles.post}>
        <div className={styles.postHeader}>
          <h1 className={styles.postTitle}>{post.title}</h1>
          <div className={styles.postMeta}>
            <span className={styles.postAuthor}>{post.username}</span>
            <span>•</span>
            <span className={styles.postTime}>
              {new Date(post.created_at).toLocaleString()}
            </span>
          </div>
          <div className={styles.postCategory}>
            <span className={styles.tag}>
              {categoryNames[post.category] || post.category}
            </span>
          </div>
        </div>

        <div className={styles.postContent}>
          {/* {post.content.split('\n').map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))} */}
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex, rehypeRaw]}
          >
            {post.content}
          </ReactMarkdown>
        </div>

        <div className={styles.postActions}>
          <button className={styles.viewsButton}>
            👁️ 浏览 ({post.views})
          </button>
          <button className={styles.replyButton}>
            💬 回复 ({post.replies.length})
          </button>
        </div>
      </article>

      <div className={styles.comments}>
        <h2 className={styles.commentsTitle}>
          回复 ({post.replies.length})
        </h2>

        <form onSubmit={handleSubmitComment} className={styles.commentForm}>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="写下你的回复..."
            className={styles.commentInput}
            rows={3}
            disabled={submitting}
          />
          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={submitting || !newComment.trim()}
          >
            {submitting ? '发送中...' : '发表回复'}
          </button>
        </form>

        <div className={styles.commentList}>
          {post.replies.map((reply) => (
            <div key={reply.id} className={styles.commentItem}>
              <div className={styles.commentHeader}>
                <span className={styles.commentAuthor}>
                  {reply.username}
                  {reply.is_ai_generated && (
                    <span className={styles.aiTag}>AI</span>
                  )}
                </span>
                <span className={styles.commentTime}>
                  {new Date(reply.created_at).toLocaleString()}
                </span>
              </div>
              <div className={styles.commentContent}>
                {reply.content.split('\n').map((line, index) => (
                  <p key={index}>{line}</p>
                ))}
              </div>
              {reply.parent_id && (
                <div className={styles.replyTo}>
                  回复：{post.replies.find(r => r.id === reply.parent_id)?.username}
                </div>
              )}
            </div>
          ))}

          {post.replies.length === 0 && (
            <div className={styles.noComments}>
              暂无回复，来说第一句吧
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostDetail;
