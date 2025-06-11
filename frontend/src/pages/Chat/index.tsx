import React from 'react';
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
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 overflow-hidden relative h-full">
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