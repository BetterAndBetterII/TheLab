import React from 'react';
import styles from './FlowPanel.module.css';

interface Keyword {
  text: string;
  type: 'disruptive' | 'innovative' | 'potential';
}

interface FlowPanelProps {
  title: string;
  authors: string[];
  coreContributions: string[];
  questions: string[];
  application: string;
  keywords: Keyword[];
}

const FlowPanel: React.FC<FlowPanelProps> = ({
  title = '文章标题',
  authors = ['作者1', '作者2'],
  coreContributions = [
    '第一个核心贡献点',
    '第二个核心贡献点',
    '第三个核心贡献点'
  ],
  questions = [
    '第一个质疑点',
    '第二个质疑点'
  ],
  application = '应用场景描述',
  keywords = [
    { text: '颠覆性概念', type: 'disruptive' },
    { text: '创新方法', type: 'innovative' },
    { text: '潜在应用', type: 'potential' }
  ]
}) => {
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

  return (
    <div className={styles.flowPanel}>
      <div className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.authors}>
          {authors.map((author, index) => (
            <span key={index} className={styles.author}>
              {author}
              {index < authors.length - 1 && ', '}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>核心贡献</h2>
        <div className={styles.contributions}>
          {coreContributions.map((contribution, index) => (
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
          {questions.map((question, index) => (
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
          <p>{application}</p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>关键词</h2>
        <div className={styles.keywords}>
          {keywords.map((keyword, index) => (
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
