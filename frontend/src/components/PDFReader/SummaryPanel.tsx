import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { ClipboardIcon, LanguageIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import 'katex/dist/katex.min.css';
import styles from './SummaryPanel.module.css';

interface SummaryPanelProps {
  summaryEn: string;
  summaryCn: string;
  handleCopyAll: (lang: string) => void;
}

const SummaryPanel: React.FC<SummaryPanelProps> = ({
  summaryEn,
  summaryCn,
  handleCopyAll
}) => {
  const [isEnglish, setIsEnglish] = useState(false);
  const [isCopied, setIsCopied] = useState<'none' | 'current' | 'alternate'>('none');
  const [copyAllStatus, setCopyAllStatus] = useState<'none' | 'current' | 'alternate'>('none');
  const [buttonPositions, setButtonPositions] = useState<{ [key: string]: { top: number; left: number } }>({});
  const buttonRefs = {
    copyAll: React.useRef<HTMLButtonElement>(null),
    copy: React.useRef<HTMLButtonElement>(null),
  };

  const updateButtonPosition = () => {
    const positions: { [key: string]: { top: number; left: number } } = {};
    Object.entries(buttonRefs).forEach(([key, ref]) => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        positions[key] = {
          top: rect.top - 40,
          left: rect.left
        };
      }
    });
    setButtonPositions(positions);
  };

  React.useEffect(() => {
    updateButtonPosition();
    window.addEventListener('scroll', updateButtonPosition);
    window.addEventListener('resize', updateButtonPosition);
    return () => {
      window.removeEventListener('scroll', updateButtonPosition);
      window.removeEventListener('resize', updateButtonPosition);
    };
  }, []);

  const handleCopy = async (text: string, type: 'current' | 'alternate') => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(type);
      setTimeout(() => setIsCopied('none'), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const handleCopyAllWithStatus = (lang: string, type: 'current' | 'alternate') => {
    handleCopyAll(lang);
    setCopyAllStatus(type);
    setTimeout(() => setCopyAllStatus('none'), 2000);
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
        <div className={styles.copyButtons}>
          <div className={styles.copyAllButtonGroup}>
            <button
              ref={buttonRefs.copyAll}
              className={`${styles.copyButton} ${copyAllStatus === 'current' ? styles.copied : ''}`}
              onClick={() => handleCopyAllWithStatus(isEnglish ? 'en' : 'cn', 'current')}
              title={`复制全部${isEnglish ? '英文' : '中文'}内容`}
              onMouseEnter={() => updateButtonPosition()}
            >
              <div className={styles.buttonContent}>
                {copyAllStatus === 'current' ? (
                  <CheckIcon className={styles.icon} />
                ) : (
                  <DocumentDuplicateIcon className={styles.icon} />
                )}
                <span>复制全部{isEnglish ? '英文' : '中文'}</span>
              </div>
            </button>

            <button
              className={`${styles.copyButton} ${styles.alternateButton} ${copyAllStatus === 'alternate' ? styles.copied : ''}`}
              onClick={() => handleCopyAllWithStatus(isEnglish ? 'cn' : 'en', 'alternate')}
              title={`复制全部${isEnglish ? '中文' : '英文'}内容`}
              style={buttonPositions.copyAll}
            >
              <div className={styles.buttonContent}>
                {copyAllStatus === 'alternate' ? (
                  <CheckIcon className={styles.icon} />
                ) : (
                  <>
                    {/* <DocumentDuplicateIcon className={styles.icon} /> */}
                    <LanguageIcon className={`${styles.icon} ${styles.smallIcon}`} />
                  </>
                )}
                <span>复制全部{isEnglish ? '中文' : '英文'}</span>
              </div>
            </button>
          </div>
          <div className={styles.copyButtonGroup}>
            <button
              ref={buttonRefs.copy}
              className={`${styles.copyButton} ${isCopied === 'current' ? styles.copied : ''}`}
              onClick={() => handleCopy(isEnglish ? summaryEn : summaryCn, 'current')}
              title={`复制${isEnglish ? '英文' : '中文'}内容`}
              onMouseEnter={() => updateButtonPosition()}
            >
              <div className={styles.buttonContent}>
                {isCopied === 'current' ? (
                  <CheckIcon className={styles.icon} />
                ) : (
                  <ClipboardIcon className={styles.icon} />
                )}
                <span>复制{isEnglish ? '英文' : '中文'}</span>
              </div>
            </button>

            <button
              className={`${styles.copyButton} ${styles.alternateButton} ${isCopied === 'alternate' ? styles.copied : ''}`}
              onClick={() => handleCopy(isEnglish ? summaryCn : summaryEn, 'alternate')}
              title={`复制${isEnglish ? '中文' : '英文'}内容`}
              style={buttonPositions.copy}
            >
              <div className={styles.buttonContent}>
                {isCopied === 'alternate' ? (
                  <CheckIcon className={styles.icon} />
                ) : (
                  <>
                    {/* <ClipboardIcon className={styles.icon} /> */}
                    <LanguageIcon className={`${styles.icon} ${styles.smallIcon}`} />
                  </>
                )}
                <span>复制{isEnglish ? '中文' : '英文'}</span>
              </div>
            </button>
          </div>
        </div>
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
