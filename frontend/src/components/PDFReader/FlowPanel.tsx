import React, { useState, useEffect } from 'react';
import styles from './FlowPanel.module.css';
import { conversationApi } from '../../api/conversations';
  
interface Keyword {
  text: string;
  type: 'disruptive' | 'innovative' | 'potential';
}

interface FlowPanelProps {
  documentId?: string;
  flowData: FlowData | null;
  setFlowData: (flowData: FlowData) => void;
}

export interface FlowData {
  title: string;
  authors: string[];
  coreContributions: string[];
  questions: string[];
  application: string;
  keywords: Keyword[];
}

const FlowPanel: React.FC<FlowPanelProps> = ({
  flowData,
  setFlowData,
  documentId,
}) => {
  const [streamContent, setStreamContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const getKeywordColor = (type: string) => {
    switch (type) {
      case 'disruptive':
        return styles.keywordRed;
      case 'innovative':
        return styles.keywordBlue;
      case 'potential':
        return styles.keywordGreen;
      default:
        return '';
    }
  };

  const handleStreamEnd = () => {
    setIsLoading(false);
  };

  const parseFlowData = (content: string) => {
    // 去除```json```
    const strippedContent = content.replace('```json', '').replace('```', '');
    console.log(strippedContent);
    const data = JSON.parse(strippedContent);
    setFlowData(data);
  };

  const onGenerate = async () => {
    setIsLoading(true);
    setStreamContent('');
    if (!documentId) {
      return;
    }
    const response = await conversationApi.generateFlow(documentId, true)
    if (response.headers.get('content-type')?.includes('application/json')) {
      const data = await response.json();
      const content = JSON.parse(data.choices[0].message.content);
      setFlowData(content.summary);
      setIsLoading(false);
      return;
    }
    const reader = response.body?.getReader();
    if (!reader) {
      return;
    }
    const decoder = new TextDecoder();
    let content = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          if (line.indexOf('[DONE]') !== -1) continue;
          const data = JSON.parse(line.slice(5));
          if (data.error) {
            setIsLoading(false);
            return;
          } else {
            content += data.content;
            setStreamContent(prev => prev + data.content);
          }
        }
      }
    }
    handleStreamEnd();
    setIsLoading(false);
    parseFlowData(content);
  };

  if (!flowData && !documentId) {
    return null;
  }

  useEffect(() => {
    if (!flowData && !isLoading) {
      onGenerate();
    }
  }, []);

  if (isLoading || streamContent && !flowData) {
    return (
      <>
        {isLoading && <div className={styles.typingIndicator}>
          <span></span>
          <span></span>
          <span></span>
        </div>}
        {streamContent && <div className={styles.loadingState}>
          <div className={styles.streamContent}>
            {streamContent}
          </div>
        </div>}
      </>
    );
  }

  if (!flowData) {
    return null;
  }

  return (
    <div className={styles.flowPanel}>
      <div className={styles.header}>
        <h1 className={styles.title}>{flowData.title}</h1>
        <div className={styles.authors}>
          {flowData.authors.map((author, index) => (
            <span key={index} className={styles.author}>
              {author}
              {index < flowData.authors.length - 1 && ', '}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>核心贡献</h2>
        <div className={styles.contributions}>
          {flowData.coreContributions.map((contribution, index) => (
            <div key={index} className={styles.contribution}>
              <span className={styles.contributionNumber}>{index + 1}</span>
              <p>{contribution}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>质疑点</h2>
        <div className={styles.questions}>
          {flowData.questions.map((question, index) => (
            <div key={index} className={styles.question}>
              <span className={styles.questionMark}>?</span>
              <p>{question}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>应用场景</h2>
        <div className={styles.application}>
          <div className={styles.applicationIcon}>🎯</div>
          <p>{flowData.application}</p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>关键词</h2>
        <div className={styles.keywords}>
          {flowData.keywords.map((keyword, index) => (
            <span
              key={index}
              className={`${styles.keyword} ${getKeywordColor(keyword.type)}`}
            >
              {keyword.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FlowPanel;
