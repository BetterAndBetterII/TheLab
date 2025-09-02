import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import Loading from '../../components/Loading';

interface Email {
  id: string;
  subject: string;
  sender: string;
  preview: string;
  timestamp: string;
  isRead: boolean;
}

const Email: React.FC = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      // 模拟从 API 获取邮件
      const mockEmails: Email[] = [
        {
          id: '1',
          subject: '项目进度更新',
          sender: 'project@thelab.com',
          preview: '本周的项目进度报告已经生成，请查看附件...',
          timestamp: '2024-02-27T10:00:00Z',
          isRead: false,
        },
        {
          id: '2',
          subject: '团队会议通知',
          sender: 'team@thelab.com',
          preview: '请各位准时参加下周一上午10点的团队会议...',
          timestamp: '2024-02-27T09:30:00Z',
          isRead: true,
        },
        {
          id: '3',
          subject: '系统维护通知',
          sender: 'system@thelab.com',
          preview: '系统将于本周日凌晨2点进行例行维护...',
          timestamp: '2024-02-27T09:00:00Z',
          isRead: true,
        },
      ];

      await new Promise((resolve) => setTimeout(resolve, 1000));
      setEmails(mockEmails);
    } catch (error) {
      console.error('Error fetching emails:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailClick = (email: Email) => {
    setSelectedEmail(email);
    if (!email.isRead) {
      setEmails((prev) =>
        prev.map((e) => (e.id === email.id ? { ...e, isRead: true } : e))
      );
    }
  };

  const handleCompose = () => {
    // Implementation of handleCompose function
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen p-4">
        <Loading size="large" text="加载中..." />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col p-4 md:p-6">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">收件箱</h1>
        <button 
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200"
          onClick={handleCompose}
        >
          <Plus size={18} />
          写邮件
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[350px_1fr] gap-4 md:gap-6 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 overflow-y-auto">
          {emails.map((email) => (
            <div
              key={email.id}
              className={`p-4 mb-3 rounded-lg cursor-pointer transition-all duration-200 ${
                selectedEmail?.id === email.id 
                  ? 'bg-gray-200 dark:bg-gray-700' 
                  : 'bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800'
              } ${!email.isRead ? 'font-semibold' : ''}`}
              onClick={() => handleEmailClick(email)}
            >
              <div className="text-sm text-gray-900 dark:text-gray-100 mb-1">{email.sender}</div>
              <div className="text-base text-gray-900 dark:text-gray-100 mb-1">{email.subject}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-1">{email.preview}</div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                {new Date(email.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 overflow-y-auto">
          {selectedEmail ? (
            <>
              <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  {selectedEmail.subject}
                </h2>
                <div className="space-y-1">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    发件人：{selectedEmail.sender}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-500">
                    {new Date(selectedEmail.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {selectedEmail.preview}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              选择一封邮件以查看详情
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Email;