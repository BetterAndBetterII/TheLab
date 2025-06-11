import React, { useEffect, useState } from 'react';
import { documentApi } from '../../api/documents';
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
        return <FileType className="text-blue-600 dark:text-blue-400 opacity-90" size={18} />;
      case 'msword':
      case 'docx':
        return <FileWord className="text-blue-600 dark:text-blue-400 opacity-90" size={18} />;
      case 'excel':
      case 'xlsx':
        return <FileSpreadsheet className="text-blue-600 dark:text-blue-400 opacity-90" size={18} />;
      case 'zip':
      case 'rar':
      case '7z':
        return <Archive className="text-blue-600 dark:text-blue-400 opacity-90" size={18} />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
        return <Image className="text-blue-600 dark:text-blue-400 opacity-90" size={18} />;
      default:
        return <FileText className="text-blue-600 dark:text-blue-400 opacity-90" size={18} />;
    }
  };

  return (
    <div className="w-full h-full p-6">
      <div className="flex justify-between items-center mb-7 pb-5 border-b border-gray-200 dark:border-gray-700 relative">
        <h2 className="m-0 text-2xl font-semibold text-gray-900 dark:text-gray-100 relative pb-1">
          阅读历史
          <div className="absolute -bottom-5 left-0 w-12 h-0.5 bg-gradient-to-r from-blue-600 to-sky-500 dark:from-blue-400 dark:to-sky-400 rounded-sm"></div>
        </h2>
      </div>

      {records.length === 0 && !loading ? (
        <div className="my-15 text-gray-500 dark:text-gray-400 flex flex-col items-center">
          <FileText size={48} className="text-gray-400 dark:text-gray-500" />
          <p className="text-gray-400 dark:text-gray-500">暂无阅读记录</p>
        </div>
      ) : (
        <div className="w-full px-1">
          {loading && records.length === 0 && (
            <div className="flex justify-center items-center py-8">
              <Loading size="medium" text="加载中..." />
            </div>
          )}

          {records.map((record) => (
            <div
              key={record.id}
              className="group relative p-5 cursor-pointer transition-all duration-300 ease-out rounded-xl mb-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:bg-gray-50 dark:hover:bg-gray-750 hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-gray-900/50 hover:border-transparent dark:hover:border-transparent before:content-[''] before:absolute before:left-0 before:top-0 before:w-1 before:h-full before:bg-gradient-to-b before:from-blue-600 before:to-sky-500 dark:before:from-blue-400 dark:before:to-sky-400 before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-100"
              onClick={() => navigate(`/chat/${record.document_id}`)}
            >
              <div className="mx-5 w-full pr-4">
                <div className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-3">
                  {getFileIcon(record.document_type)}
                  <span className="truncate" title={record.document_name}>
                    {record.document_name}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-2xl text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 ml-3 tracking-wide">
                    {record.document_type.split('/')[1]?.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-500 dark:text-gray-400">
                  <span className="flex items-center text-gray-600 dark:text-gray-400 text-sm gap-1.5">
                    <Clock size={14} />
                    {formatTime(record.read_at)}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1" title="文件大小">
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
        <div className="text-center mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-8 py-2.5 border-none bg-gradient-to-r from-blue-600 to-sky-500 dark:from-blue-500 dark:to-sky-400 text-white rounded-3xl cursor-pointer text-sm font-medium transition-all duration-300 shadow-md hover:-translate-y-0.5 hover:shadow-lg disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none disabled:from-gray-300 disabled:to-gray-300 dark:disabled:from-gray-600 dark:disabled:to-gray-600"
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