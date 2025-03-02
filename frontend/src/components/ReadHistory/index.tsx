import React, { useEffect, useState } from 'react';
import { List, Empty, Spin, message, Tooltip } from 'antd';
import { 
  FileTextOutlined, 
  ClockCircleOutlined, 
  FileZipOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FileImageOutlined,
  FileUnknownOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import { documentApi } from '../../api/documents';
import styles from './ReadHistory.module.css';
import { useNavigate } from 'react-router-dom';

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
      message.error('获取阅读历史失败');
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
        return <FilePdfOutlined className={styles.fileIcon} />;
      case 'msword':
      case 'docx':
        return <FileWordOutlined className={styles.fileIcon} />;
      case 'excel':
      case 'xlsx':
        return <FileExcelOutlined className={styles.fileIcon} />;
      case 'zip':
      case 'rar':
      case '7z':
        return <FileZipOutlined className={styles.fileIcon} />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
        return <FileImageOutlined className={styles.fileIcon} />;
      default:
        return <FileTextOutlined className={styles.fileIcon} />;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>阅读历史</h2>
      </div>

      {records.length === 0 && !loading ? (
        <Empty
          description="暂无阅读记录"
          className={styles.empty}
        />
      ) : (
        <List
          className={styles.list}
          dataSource={records}
          loading={{
            spinning: loading,
            indicator: <LoadingOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          }}
          renderItem={(record) => (
            <List.Item className={styles.listItem} onClick={() => {
              navigate(`/chat/${record.document_id}`);
            }}>
              <div className={styles.sessionInfo}>
                <div className={styles.sessionTitle}>
                  {getFileIcon(record.document_type)}
                  <Tooltip title={record.document_name}>
                    {record.document_name}
                  </Tooltip>
                  <span className={styles.badge}>
                    {record.document_type.split('/')[1]?.toUpperCase()}
                  </span>
                </div>
                <div className={styles.sessionMeta}>
                  <span className={styles.lastMessage}>
                    <ClockCircleOutlined />
                    {formatTime(record.read_at)}
                  </span>
                  <Tooltip title="文件大小">
                    <span className={styles.time}>
                      <FileUnknownOutlined />
                      {formatFileSize(record.document_size)}
                    </span>
                  </Tooltip>
                </div>
              </div>
            </List.Item>
          )}
        />
      )}

      {hasMore && records.length > 0 && (
        <div className={styles.loadMore}>
          <button onClick={handleLoadMore} disabled={loading}>
            {loading ? '加载中...' : '加载更多'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ReadHistory; 