import React from 'react';
import styles from './Chat.module.css';
import PDFReader from '../../components/PDFReader';
import { useParams } from 'react-router-dom';
import { BASE_URL } from '../../api';
import ReadHistory from '../../components/ReadHistory';

const Chat: React.FC = () => {
  const { conversationId } = useParams();

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
            onPageChange={() => {}}
          />
        </div>
      </div>
    </div>
  );
};

export default Chat;
