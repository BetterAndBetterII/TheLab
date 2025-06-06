import React, { useEffect, useState } from 'react';
import { documentApi } from '../../api/documents';
import styles from './ReadHistory.module.css';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Clock, 
  Archive, 
  FileType, 
  FileText as FileWord, 
  FileSpreadsheet, 
  Image, 
  File, 
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/tooltip';
import Loading from '../Loading';

interface ReadRecord {
  id: string;
  document_id: string;
  document_name: string;
  read_at: string;
  document_type: string;
  document_size: number;
}

const ReadHistory: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<ReadRecord[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const navigate = useNavigate();

  const loadRecords = async (pageNum: number) => {
    try {
      setLoading(true);
      const response = await documentApi.getReadHistory({
        skip: pageNum * pageSize,
        limit: pageSize,
      });

      if (pageNum === 0) {
        setRecords(response.records);
      } else {
        setRecords([...records, ...response.records]);
      }

      setHasMore(response.records.length === pageSize);
    } catch (error) {
      // 使用console.error代替message
      console.error('获取阅读历史失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords(0);
  }, []);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadRecords(nextPage);
  };

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTime = (time: string) => {
    const date = new Date(time);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60 * 1000) return '刚刚';
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `${minutes}分钟前`;
    }
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours}小时前`;
    }
    if (diff < 30 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days}天前`;
    }

    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getFileIcon = (mimeType: string) => {
    const type = mimeType.split('/')[1]?.toLowerCase();
    switch (type) {
      case 'pdf':
        return <FileType className={styles.fileIcon} size={18} />;
      case 'msword':
      case 'docx':
        return <FileWord className={styles.fileIcon} size={18} />;
      case 'excel':
      case 'xlsx':
        return <FileSpreadsheet className={styles.fileIcon} size={18} />;
      case 'zip':
      case 'rar':
      case '7z':
        return <Archive className={styles.fileIcon} size={18} />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
        return <Image className={styles.fileIcon} size={18} />;
      default:
        return <FileText className={styles.fileIcon} size={18} />;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>阅读历史</h2>
      </div>

      {records.length === 0 && !loading ? (
        <div className={styles.empty}>
          <FileText size={48} className="text-muted-foreground" />
          <p className="text-muted-foreground">暂无阅读记录</p>
        </div>
      ) : (
        <div className={styles.list}>
          {loading && records.length === 0 && (
            <div className={styles.loadingContainer}>
              <Loading size="medium" text="加载中..." />
            </div>
          )}
          
          {records.map((record) => (
            <div 
              key={record.id}
              className={styles.listItem} 
              onClick={() => navigate(`/chat/${record.document_id}`)}
            >
              <div className={styles.sessionInfo}>
                <div className={styles.sessionTitle}>
                  {getFileIcon(record.document_type)}
                  <span className="truncate" title={record.document_name}>
                    {record.document_name}
                  </span>
                  <span className={styles.badge}>
                    {record.document_type.split('/')[1]?.toUpperCase()}
                  </span>
                </div>
                <div className={styles.sessionMeta}>
                  <span className={styles.lastMessage}>
                    <Clock size={14} />
                    {formatTime(record.read_at)}
                  </span>
                  <span className={styles.time} title="文件大小">
                    <File size={14} />
                    {formatFileSize(record.document_size)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && records.length > 0 && (
        <div className={styles.loadMore}>
          <button 
            onClick={handleLoadMore} 
            disabled={loading}
            className="flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? '加载中...' : '加载更多'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ReadHistory;

