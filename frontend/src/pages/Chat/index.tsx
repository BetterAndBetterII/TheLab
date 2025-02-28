import React, { useState, useEffect } from 'react';
import styles from './Chat.module.css';
import PDFReader from '../../components/PDFReader';
import ChatList, { ChatSession } from '../../components/ChatList';
import { useParams, useNavigate } from 'react-router-dom';
import { BASE_URL } from '../../api';

const Chat: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const { conversationId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (conversationId) {
      setPdfUrl(`${BASE_URL}/documents/${conversationId}/download`);
    }
  }, [conversationId]);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const handleSelectSession = (session: ChatSession) => {
    navigate(`/chat/${session.id}`);
  };

  if (!conversationId) {
    return <ChatList onSelectSession={handleSelectSession} />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.pdfContainer}>
          <PDFReader
            pdfUrl={pdfUrl || ''}
            onPageChange={handlePageChange}
          />
        </div>
      </div>
    </div>
  );
};

export default Chat;
