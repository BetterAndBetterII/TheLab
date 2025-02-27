import React, { useState } from 'react';
import styles from './Chat.module.css';
import PDFReader from '../../components/PDFReader';
import ChatList, { ChatSession } from '../../components/ChatList';
import pdfUrl from '../../assets/2501.12948v1.pdf';

const Chat: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const handleSelectSession = (session: ChatSession) => {
    setSelectedSession(session);
  };

  if (!selectedSession) {
    return <ChatList onSelectSession={handleSelectSession} />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.pdfContainer}>
          <PDFReader
            pdfUrl={pdfUrl}
            onPageChange={handlePageChange}
          />
        </div>
      </div>
    </div>
  );
};

export default Chat;
