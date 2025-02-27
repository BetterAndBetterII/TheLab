import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import styles from './QuizPanel.module.css';

interface Option {
  id: string;
  text: string;
}

interface Question {
  id: string;
  text: string;
  options: Option[];
  correctOptionId: string;
}

interface QuizPanelProps {
  currentPage: number;
}

const QuizPanel: React.FC<QuizPanelProps> = ({ currentPage }) => {
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: string]: string }>({});
  const [showAnswers, setShowAnswers] = useState<{ [key: string]: boolean }>({});
  const [allCorrect, setAllCorrect] = useState(false);

  // 模拟每页的测验题目
  const questions: Question[] = [
    {
      id: '1',
      text: '这篇论文的主要研究方向是？',
      options: [
        { id: 'a', text: '深度学习' },
        { id: 'b', text: '计算机视觉' },
        { id: 'c', text: '自然语言处理' },
        { id: 'd', text: '强化学习' }
      ],
      correctOptionId: 'b'
    },
    {
      id: '2',
      text: '作者提出的方法主要解决了什么问题？',
      options: [
        { id: 'a', text: '模型效率问题' },
        { id: 'b', text: '数据稀疏问题' },
        { id: 'c', text: '训练速度问题' },
        { id: 'd', text: '泛化能力问题' }
      ],
      correctOptionId: 'a'
    },
    {
      id: '3',
      text: '与现有方法相比，本文方法的优势是？',
      options: [
        { id: 'a', text: '更快的训练速度' },
        { id: 'b', text: '更低的内存占用' },
        { id: 'c', text: '更好的准确率' },
        { id: 'd', text: '以上都是' }
      ],
      correctOptionId: 'd'
    }
  ];

  useEffect(() => {
    // 重置当前页的答案状态
    setSelectedAnswers({});
    setShowAnswers({});
    setAllCorrect(false);
  }, [currentPage]);

  const handleOptionSelect = (questionId: string, optionId: string) => {
    if (showAnswers[questionId]) return; // 如果已经显示答案，则不允许再选择

    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: optionId
    }));

    setShowAnswers(prev => ({
      ...prev,
      [questionId]: true
    }));

    // 检查是否所有题目都回答正确
    const allAnswered = questions.every(q => showAnswers[q.id] || q.id === questionId);
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

  const getOptionClassName = (questionId: string, optionId: string) => {
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

  return (
    <div className={styles.quizPanel}>
      <div className={styles.header}>
        <h2 className={styles.pageTitle}>第 {currentPage} 页测验</h2>
        <button
          className={styles.retryButton}
          onClick={handleRetry}
          disabled={!Object.keys(showAnswers).length}
        >
          重新作答
        </button>
      </div>
      <div className={styles.questions}>
        {questions.map((question) => (
          <div key={question.id} className={styles.questionCard}>
            <h3 className={styles.questionText}>{question.text}</h3>
            <div className={styles.options}>
              {question.options.map((option) => (
                <button
                  key={option.id}
                  className={getOptionClassName(question.id, option.id)}
                  onClick={() => handleOptionSelect(question.id, option.id)}
                  disabled={showAnswers[question.id]}
                >
                  <span className={styles.optionLabel}>{option.id.toUpperCase()}</span>
                  <span className={styles.optionText}>{option.text}</span>
                </button>
              ))}
            </div>
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

export default QuizPanel;
