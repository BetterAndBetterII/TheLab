import React, { useState } from 'react';
import { List, Button, Empty } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import styles from './ChatList.module.css';

export interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  createdAt: string;
}

interface ChatListProps {
  onSelectSession: (session: ChatSession) => void;
}

const ChatList: React.FC<ChatListProps> = ({ onSelectSession }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  const handleCreateSession = () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: `对话 ${sessions.length + 1}`,
      lastMessage: '新建对话',
      createdAt: new Date().toLocaleString(),
    };

    setSessions([newSession, ...sessions]);
    onSelectSession(newSession);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>我的对话</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreateSession}
        >
          新建对话
        </Button>
      </div>

      {sessions.length === 0 ? (
        <Empty
          description="暂无对话记录"
          className={styles.empty}
        />
      ) : (
        <List
          className={styles.list}
          dataSource={sessions}
          renderItem={(session) => (
            <List.Item
              className={styles.listItem}
              onClick={() => onSelectSession(session)}
            >
              <div className={styles.sessionInfo}>
                <div className={styles.sessionTitle}>{session.title}</div>
                <div className={styles.sessionMeta}>
                  <span className={styles.lastMessage}>{session.lastMessage}</span>
                  <span className={styles.time}>{session.createdAt}</span>
                </div>
              </div>
            </List.Item>
          )}
        />
      )}
    </div>
  );
};

export default ChatList;
