import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import styles from './PostDetail.module.css';
import Loading from '../../components/Loading';

interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  likes: number;
}

interface Post {
  id: string;
  title: string;
  author: string;
  content: string;
  createdAt: string;
  likes: number;
  tags: string[];
  comments: Comment[];
}

const PostDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    fetchPost();
  }, [id]);

  const fetchPost = async () => {
    try {
      // 模拟从 API 获取帖子详情
      const mockPost: Post = {
        id: '1',
        title: '如何提高工作效率？',
        author: 'Alice',
        content: `在当今快节奏的工作环境中，提高工作效率变得越来越重要。以下是一些实用的建议：

1. 合理规划时间
- 使用番茄工作法
- 制定每日待办清单
- 设置任务优先级

2. 保持工作环境整洁
- 定期整理桌面
- 文件分类存储
- 保持通风明亮

3. 善用工具提高效率
- 项目管理软件
- 自动化工具
- 协作平台

希望这些建议对大家有帮助！`,
        createdAt: '2024-02-27T10:00:00Z',
        likes: 15,
        tags: ['效率', '工作', '技巧'],
        comments: [
          {
            id: '1',
            author: 'Bob',
            content: '非常实用的建议，特别是番茄工作法确实很有效。',
            createdAt: '2024-02-27T10:30:00Z',
            likes: 5,
          },
          {
            id: '2',
            author: 'Charlie',
            content: '补充一点，适当的休息也很重要。',
            createdAt: '2024-02-27T11:00:00Z',
            likes: 3,
          },
        ],
      };

      await new Promise((resolve) => setTimeout(resolve, 1000));
      setPost(mockPost);
    } catch (error) {
      console.error('Error fetching post:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: Date.now().toString(),
      author: 'You',
      content: newComment,
      createdAt: new Date().toISOString(),
      likes: 0,
    };

    setPost((prev) => prev ? {
      ...prev,
      comments: [...prev.comments, comment],
    } : null);
    setNewComment('');
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Loading size="large" text="加载中..." />
      </div>
    );
  }

  if (!post) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>帖子不存在</div>
      </div>
    );
  }

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
            <span className={styles.postAuthor}>{post.author}</span>
            <span>•</span>
            <span className={styles.postTime}>
              {new Date(post.createdAt).toLocaleString()}
            </span>
          </div>
          <div className={styles.postTags}>
            {post.tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.postContent}>
          {post.content.split('\n\n').map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        <div className={styles.postActions}>
          <button className={styles.likeButton}>
            👍 点赞 ({post.likes})
          </button>
          <button className={styles.shareButton}>
            分享
          </button>
        </div>
      </article>

      <div className={styles.comments}>
        <h2 className={styles.commentsTitle}>
          评论 ({post.comments.length})
        </h2>

        <form onSubmit={handleSubmitComment} className={styles.commentForm}>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="写下你的评论..."
            className={styles.commentInput}
            rows={3}
          />
          <button type="submit" className={styles.submitButton}>
            发表评论
          </button>
        </form>

        <div className={styles.commentList}>
          {post.comments.map((comment) => (
            <div key={comment.id} className={styles.commentItem}>
              <div className={styles.commentHeader}>
                <span className={styles.commentAuthor}>
                  {comment.author}
                </span>
                <span className={styles.commentTime}>
                  {new Date(comment.createdAt).toLocaleString()}
                </span>
              </div>
              <p className={styles.commentContent}>{comment.content}</p>
              <div className={styles.commentActions}>
                <button className={styles.commentLikeButton}>
                  👍 ({comment.likes})
                </button>
                <button className={styles.commentReplyButton}>
                  回复
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PostDetail;
