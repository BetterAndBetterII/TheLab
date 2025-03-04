import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import styles from './QuizPanel.module.css';
import { conversationApi } from '../../api/conversations';
import { IoIosArrowBack } from 'react-icons/io';

interface Option {
  id: string;
  text: string;
}

interface Question {
  id: string;
  text: string;
  options: Option[];
  correctOptionId: string;
  explanation: string;
}

export interface QuizData {
  questions: Question[];
  page: number;
  created_at: string;
}

interface QuizPanelProps {
  currentPage: number;
  documentId: string;
  currentQuizData: QuizData | null;
  setCurrentQuizData: (data: QuizData | null) => void;
  quizHistory: QuizData[];
  setQuizHistory: (data: QuizData[]) => void;
  onSelectPage: (page: number) => void;
}

const QuizPanel: React.FC<QuizPanelProps> = ({ 
  currentPage, 
  documentId,
  currentQuizData,
  setCurrentQuizData,
  onSelectPage,
  quizHistory,
  setQuizHistory
}) => {
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: string]: string }>({});
  const [showAnswers, setShowAnswers] = useState<{ [key: string]: boolean }>({});
  const [allCorrect, setAllCorrect] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(true); // 默认显示历史记录

  useEffect(() => {
    loadQuizHistory();
  }, [documentId]);

  const loadQuizHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const response = await conversationApi.getQuizHistory(documentId);
      setQuizHistory(response.quiz_history || []);
      setIsLoadingHistory(false);
    } catch (err) {
      console.error('加载测验历史记录失败:', err);
      setIsLoadingHistory(false);
    }
  };

  const handleGenerateQuiz = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await conversationApi.generateQuiz(documentId, currentPage, true);
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应数据');
      }

      const decoder = new TextDecoder();
      let content = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            if (line.indexOf('[DONE]') !== -1) continue;
            const data = JSON.parse(line.slice(5));
            if (data.error) {
              setError(data.error);
              setIsLoading(false);
              return;
            } else {
              content += data.content;
            }
          }
        }
      }

      // 解析最终的JSON内容
      const strippedContent = content.replace('```json', '').replace('```', '');
      console.log(strippedContent);
      const quizData = JSON.parse(strippedContent);
      quizData.page = currentPage;
      quizData.created_at = new Date().toISOString();
      setCurrentQuizData(quizData);
      setShowHistory(false);
      await loadQuizHistory(); // 重新加载历史记录
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : '生成测验题失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptionSelect = (questions: Question[], questionId: string, optionId: string) => {
    if (showAnswers[questionId]) return; // 如果已经显示答案，则不允许再选择

    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: optionId
    }));

    // 检查是否所有题目都回答正确
    const allAnswered = questions.every(q => showAnswers[q.id] || q.id === questionId);
    
    setShowAnswers(prev => ({
      ...prev,
      [questionId]: true
    }));
    if (allAnswered) {
      const allCorrect = questions.every(q =>
        (selectedAnswers[q.id] === q.correctOptionId) ||
        (q.id === questionId && optionId === q.correctOptionId)
      );

      if (allCorrect) {
        setAllCorrect(true);
        // 触发彩带效果
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }
  };

  const getOptionClassName = (questions: Question[], questionId: string, optionId: string) => {
    if (!showAnswers[questionId]) {
      return styles.option;
    }

    if (optionId === questions.find(q => q.id === questionId)?.correctOptionId) {
      return `${styles.option} ${styles.correct}`;
    }

    if (selectedAnswers[questionId] === optionId) {
      return `${styles.option} ${styles.incorrect}`;
    }

    return styles.option;
  };

  const handleRetry = () => {
    setSelectedAnswers({});
    setShowAnswers({});
    setAllCorrect(false);
  };

  const handleLoadHistoryQuiz = (historyEntry: QuizData) => {
    setCurrentQuizData(historyEntry);
    setSelectedAnswers({});
    setShowAnswers({});
    setAllCorrect(false);
    setShowHistory(false);
    onSelectPage(historyEntry.page - 1);
  };

  // 渲染历史记录面板
  const renderHistoryPanel = () => {
    const pageHistory = quizHistory
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .sort((a, b) => a.page - b.page);

    return (
      <div className={styles.historyPanel}>
        <div className={styles.header}>
          <h2>历史测验</h2>
          <button
            className={styles.generateButton}
            onClick={handleGenerateQuiz}
            disabled={isLoading}
          >
            生成新测验
          </button>
        </div>
        <div className={styles.historyList}>
          {pageHistory.length === 0 ? (
            <div className={styles.emptyHistory}>
              {isLoadingHistory ? <div className={styles.loadingState}>
                <div className={styles.typingIndicator}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div> : <p>暂无历史测验记录</p>}
            </div>
          ) : (
            pageHistory.map((history, index) => (
              <div key={index} className={styles.historyItem}>
                <div 
                  className={styles.historyInfo}
                  onClick={() => handleLoadHistoryQuiz(history)}
                >
                  <div className={styles.historyInfoContent}>
                    <span className={styles.historyInfoTitle}>{
                      history.questions[0].text.length > 25 ?
                      history.questions[0].text.slice(0, 25) + '...' : 
                      history.questions[0].text
                    }</span>
                    <div className={styles.historyInfoDetail}>
                      <span>第 {history.page} 页</span>
                      <span>创建时间: {new Date(history.created_at).toLocaleString()}</span>
                      <span>题目数量: {history.questions.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          {isLoading && <div className={styles.loadingState}>
            <div className={styles.typingIndicator}>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>}
        </div>
      </div>
    );
  };

  // 渲染当前测验面板
  const renderQuizPanel = (quizData: QuizData) => {
    if (error) {
      return (
        <div className={styles.errorState}>
          <p className={styles.errorMessage}>{error}</p>
          <button 
            className={styles.retryButton}
            onClick={handleGenerateQuiz}
          >
            重试
          </button>
        </div>
      );
    }

    if (!quizData.questions.length) {
      return (
        <div className={styles.emptyState}>
          <button 
            className={styles.generateButton}
            onClick={handleGenerateQuiz}
            disabled={!documentId || isLoading}
          >
            生成测验题
          </button>
        </div>
      );
    }

    return (
      <div className={styles.activeQuizPanel}>
        <div className={styles.header}>
          <div className={styles.backButton} onClick={() => setShowHistory(true)}>
            <IoIosArrowBack />
          </div>
          <h2 className={styles.pageTitle}>第 {quizData.page} 页测验</h2>
          <button
            className={styles.retryButton}
            onClick={handleRetry}
            disabled={!Object.keys(showAnswers).length}
          >
            重新作答
          </button>
        </div>
        <div className={styles.questions}>
          {quizData.questions.map((question) => (
            <div key={question.id} className={styles.questionCard}>
              <h3 className={styles.questionText}>{question.text}</h3>
              <div className={styles.options}>
                {question.options.map((option) => (
                  <button
                    key={option.id}
                    className={getOptionClassName(quizData.questions, question.id, option.id)}
                    onClick={() => handleOptionSelect(quizData.questions, question.id, option.id)}
                    disabled={showAnswers[question.id]}
                  >
                    <span className={styles.optionLabel}>{option.id.toUpperCase()}</span>
                    <span className={styles.optionText}>{option.text}</span>
                  </button>
                ))}
              </div>
              {showAnswers[question.id] && (
                <div className={styles.explanation}>
                  <p>{question.explanation}</p>
                </div>
              )}
            </div>
          ))}
        </div>
        {allCorrect && (
          <div className={styles.congratulations}>
            🎉 恭喜你全部回答正确！
          </div>
        )}
      </div>
    );
  };

  // 主渲染
  return (
    <div className={styles.mainContainer}>
      {!showHistory ? <div className={styles.quizContainer}>
        {renderQuizPanel(currentQuizData || {
          questions: [],
          page: 0,
          created_at: ''
        })}
      </div> : <div className={styles.historyContainer}>
        {renderHistoryPanel()}
      </div>}
    </div>
  );
};

export default QuizPanel;
