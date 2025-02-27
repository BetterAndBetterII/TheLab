import React, { useState, useRef, useEffect } from 'react';
import { IoMdTime, IoMdClose } from 'react-icons/io';
import styles from './ChatPanel.module.css';

interface Message {
  id: string;
  content: string;
  type: 'user' | 'assistant';
  timestamp: number;
}

interface ChatPanelProps {
  messages: Message[];
  isLoading: boolean;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isLoading,
}) => {
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (messageListRef.current) {
      const scrollHeight = messageListRef.current.scrollHeight;
      messageListRef.current.scrollTo({
        top: scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading]); // 当消息列表或加载状态改变时触发滚动

  // 模拟历史聊天记录数据
  const chatHistory = [
    {
      id: '1',
      title: '关于量子计算的讨论',
      date: '2024-03-20',
      lastMessage: '量子计算机的发展前景如何？'
    },
    {
      id: '2',
      title: '机器学习算法探讨',
      date: '2024-03-19',
      lastMessage: '深度学习在图像识别中的应用'
    },
    {
      id: '3',
      title: '人工智能伦理问题',
      date: '2024-03-18',
      lastMessage: 'AI发展中的伦理边界在哪里？'
    }
  ];

  return (
    <div className={styles.chatPanel}>
      <button
        className={styles.historyButton}
        onClick={() => setIsHistoryVisible(!isHistoryVisible)}
        title="聊天历史"
      >
        <IoMdTime size={24} />
      </button>

      {/* 历史记录侧边栏 */}
      <div className={`${styles.historyPanel} ${isHistoryVisible ? styles.visible : ''}`}>
        <div className={styles.historyHeader}>
          <h3>聊天历史</h3>
          <button
            className={styles.closeButton}
            onClick={() => setIsHistoryVisible(false)}
          >
            <IoMdClose size={18} />
          </button>
        </div>
        <div className={styles.historyList}>
          {chatHistory.map(chat => (
            <div key={chat.id} className={styles.historyItem}>
              <h4>{chat.title}</h4>
              <p>{chat.lastMessage}</p>
              <span className={styles.date}>{chat.date}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 消息列表 */}
      <div className={styles.messageList} ref={messageListRef}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>💭</div>
            <div className={styles.emptyText}>我可以帮到你吗？</div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`${styles.message} ${
                message.type === 'user' ? styles.userMessage : styles.assistantMessage
              }`}
            >
              <div className={styles.messageContent}>{message.content}</div>
            </div>
          ))
        )}
        {isLoading && (
          <div className={styles.loadingMessage}>
            <div className={styles.typingIndicator}>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPanel;
