import React, { useState, useEffect } from 'react';
import styles from './Chat.module.css';
import PDFReader from '../../components/PDFReader';
import ChatList, { ChatSession } from '../../components/ChatList';
import { useParams, useNavigate } from 'react-router-dom';
import { BASE_URL } from '../../api';
import ReadHistory from '../../components/ReadHistory';

const Chat: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const handleSelectSession = (session: ChatSession) => {
    navigate(`/chat/${session.id}`);
  };
  console.log(conversationId, `${BASE_URL}/documents/${conversationId}/download`);

  if (!conversationId) {
    return <ReadHistory />;
  }


  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.pdfContainer}>
          <PDFReader
            pdfUrl={conversationId ? `${BASE_URL}/documents/${conversationId}/download` : ''}
            documentId={conversationId}
            onPageChange={handlePageChange}
          />
        </div>
      </div>
    </div>
  );
};

export default Chat;
