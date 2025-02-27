import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { ClipboardIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import 'katex/dist/katex.min.css';
import styles from './SummaryPanel.module.css';

interface SummaryPanelProps {
  summaryEn: string;
  summaryCn: string;
}

const SummaryPanel: React.FC<SummaryPanelProps> = ({
  summaryEn,
  summaryCn
}) => {
  const [isEnglish, setIsEnglish] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  return (
    <div className={styles.summaryPanel}>
      <div className={styles.languageToggle}>
        <button
          className={`${styles.langToggleButton} ${isEnglish ? styles.english : styles.chinese}`}
          onClick={() => setIsEnglish(!isEnglish)}
        >
          {isEnglish ? 'EN' : '中'}
        </button>
      </div>

      <div className={styles.markdownContainer}>
        <button
          className={`${styles.copyButton} ${isCopied ? styles.copied : ''}`}
          onClick={() => handleCopy(isEnglish ? summaryEn : summaryCn)}
          title={isCopied ? '已复制' : '复制内容'}
        >
          {isCopied ? (
            <CheckIcon className={styles.icon} />
          ) : (
            <ClipboardIcon className={styles.icon} />
          )}
        </button>
        <div className={styles.markdownContent}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex, rehypeRaw]}
          >
            {isEnglish ? summaryEn : summaryCn}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default SummaryPanel;
