import React, { useState, useEffect } from 'react';
import styles from './Email.module.css';
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
      <div className={styles.container}>
        <Loading size="large" text="加载中..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>收件箱</h1>
        <button className={styles.composeButton} onClick={handleCompose}>
          <Plus size={18} />
          写邮件
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.emailList}>
          {emails.map((email) => (
            <div
              key={email.id}
              className={`${styles.emailItem} ${
                selectedEmail?.id === email.id ? styles.emailItemActive : ''
              } ${!email.isRead ? styles.emailItemUnread : ''}`}
              onClick={() => handleEmailClick(email)}
            >
              <div className={styles.emailSender}>{email.sender}</div>
              <div className={styles.emailSubject}>{email.subject}</div>
              <div className={styles.emailPreview}>{email.preview}</div>
              <div className={styles.emailTime}>
                {new Date(email.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.emailDetail}>
          {selectedEmail ? (
            <>
              <div className={styles.emailDetailHeader}>
                <h2 className={styles.emailDetailSubject}>
                  {selectedEmail.subject}
                </h2>
                <div className={styles.emailDetailMeta}>
                  <div className={styles.emailDetailSender}>
                    发件人：{selectedEmail.sender}
                  </div>
                  <div className={styles.emailDetailTime}>
                    {new Date(selectedEmail.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className={styles.emailDetailContent}>
                {selectedEmail.preview}
              </div>
            </>
          ) : (
            <div className={styles.emailDetailEmpty}>
              选择一封邮件以查看详情
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Email;

