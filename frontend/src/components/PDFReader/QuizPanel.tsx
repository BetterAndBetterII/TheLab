import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { conversationApi } from '../../api/conversations';
import { ArrowLeft } from 'lucide-react';

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
  const [showHistory, setShowHistory] = useState(!currentQuizData); // 默认显示历史记录

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

      // eslint-disable-next-line no-constant-condition
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
      setSelectedAnswers({});
      setShowAnswers({});
      setAllCorrect(false);
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
    const baseClasses = "flex items-center gap-3 p-4 border-2 rounded-xl bg-white dark:bg-gray-800 cursor-pointer transition-all duration-300 text-base text-gray-800 dark:text-gray-200 w-full text-left disabled:cursor-default disabled:opacity-70";

    if (!showAnswers[questionId]) {
      return baseClasses + " border-gray-300 dark:border-gray-600 hover:border-blue-600 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:translate-x-1";
    }

    if (optionId === questions.find(q => q.id === questionId)?.correctOptionId) {
      return baseClasses + " border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-900/20 hover:border-green-500 dark:hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20";
    }

    if (selectedAnswers[questionId] === optionId) {
      return baseClasses + " border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-900/20 hover:border-red-500 dark:hover:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20";
    }

    return baseClasses + " border-gray-300 dark:border-gray-600";
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

  return (
    <div className="flex gap-5 h-full overflow-hidden">
      {!showHistory ? (
        <div className="flex-[2] min-w-0 h-full overflow-hidden flex flex-col">
          {error ? (
            <div className="p-5 text-center">
              <p className="text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-900/20 p-4 rounded-md mb-4">{error}</p>
              <button
                className="px-4 py-2 border-2 border-blue-600 dark:border-blue-500 rounded-lg bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 text-sm font-medium cursor-pointer transition-all duration-300 hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:border-gray-300 dark:disabled:border-gray-600 disabled:text-gray-400 dark:disabled:text-gray-500"
                onClick={handleGenerateQuiz}
              >
                重试
              </button>
            </div>
          ) : !currentQuizData?.questions.length ? (
            <div className="flex justify-center items-center h-full">
              <button
                className="px-4 py-2 bg-green-500 dark:bg-green-600 text-white border-none rounded cursor-pointer transition-all duration-200 hover:bg-green-600 dark:hover:bg-green-700 hover:-translate-y-px disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                onClick={handleGenerateQuiz}
                disabled={!documentId || isLoading}
              >
                生成测验题
              </button>
            </div>
          ) : (
            <div className="h-full overflow-y-auto relative flex flex-col">
              <div className="sticky top-0 p-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 z-10 w-full flex justify-between items-center">
                <div className="flex items-center">
                  <div
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 mr-4 cursor-pointer transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-600 hover:scale-110"
                    onClick={() => setShowHistory(true)}
                  >
                    <ArrowLeft size={16} />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 m-0">第 {currentQuizData.page} 页测验</h2>
                </div>
                <button
                  className="px-4 py-2 border-2 border-blue-600 dark:border-blue-500 rounded-lg bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 text-sm font-medium cursor-pointer transition-all duration-300 hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:border-gray-300 dark:disabled:border-gray-600 disabled:text-gray-400 dark:disabled:text-gray-500"
                  onClick={handleRetry}
                  disabled={!Object.keys(showAnswers).length}
                >
                  重新作答
                </button>
              </div>
              <div className="flex flex-col gap-8 p-6 flex-1 mb-7">
                {currentQuizData.questions.map((question) => (
                  <div key={question.id} className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                    <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-5 leading-6">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex, rehypeRaw]}
                      >
                        {question.text}
                      </ReactMarkdown>
                    </h3>
                    <div className="flex flex-col gap-3">
                      {question.options.map((option) => (
                        <button
                          key={option.id}
                          className={getOptionClassName(currentQuizData.questions, question.id, option.id)}
                          onClick={() => handleOptionSelect(currentQuizData.questions, question.id, option.id)}
                          disabled={showAnswers[question.id]}
                        >
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center font-semibold flex-shrink-0 transition-all duration-300 ${
                            showAnswers[question.id] && option.id === currentQuizData.questions.find(q => q.id === question.id)?.correctOptionId
                              ? 'bg-green-500 text-white'
                              : showAnswers[question.id] && selectedAnswers[question.id] === option.id && option.id !== currentQuizData.questions.find(q => q.id === question.id)?.correctOptionId
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}>
                            {option.id.toUpperCase()}
                          </span>
                          <span className="flex-1">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkMath]}
                              rehypePlugins={[rehypeKatex, rehypeRaw]}
                            >
                              {option.text}
                            </ReactMarkdown>
                          </span>
                        </button>
                      ))}
                    </div>
                    {showAnswers[question.id] && (
                      <div className="mt-4 mb-4 p-4 bg-gray-200 dark:bg-gray-700 rounded-md text-gray-600 dark:text-gray-300">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex, rehypeRaw]}
                        >
                          {question.explanation}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                ))}
                {allCorrect && (
                  <div className="text-center text-2xl font-semibold text-green-500 dark:text-green-400 mt-5 pb-5">
                    🎉 恭喜你全部回答正确！
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-full p-5">
          <div className="w-full h-full flex items-center flex-col gap-6 bg-white dark:bg-gray-900">
            <div className="w-full flex justify-between items-center mb-5">
              <h2 className="m-0 text-xl font-semibold dark:text-gray-200">历史测验</h2>
              <button
                className="px-4 py-2 bg-green-500 dark:bg-green-600 text-white border-none rounded cursor-pointer transition-all duration-200 hover:bg-green-600 dark:hover:bg-green-700 hover:-translate-y-px disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                onClick={handleGenerateQuiz}
                disabled={isLoading}
              >
                生成新测验
              </button>
            </div>
            <div className="flex flex-col gap-1 p-1 w-full">
              {quizHistory.length === 0 ? (
                <div className="text-center p-5 text-gray-600 dark:text-gray-400 italic">
                  {isLoadingHistory ? (
                    <div className="p-5">
                      <div className="flex justify-center items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-gray-600 dark:bg-gray-400 rounded-full inline-block animate-bounce" style={{animationDelay: '0.1s'}}></span>
                        <span className="w-1.5 h-1.5 bg-gray-600 dark:bg-gray-400 rounded-full inline-block animate-bounce" style={{animationDelay: '0.2s'}}></span>
                        <span className="w-1.5 h-1.5 bg-gray-600 dark:bg-gray-400 rounded-full inline-block animate-bounce" style={{animationDelay: '0.3s'}}></span>
                      </div>
                    </div>
                  ) : (
                    <p>暂无历史测验记录</p>
                  )}
                </div>
              ) : (
                quizHistory
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .sort((a, b) => a.page - b.page)
                  .map((history, index) => (
                    <div key={index} className="mb-4 transition-transform duration-200 hover:-translate-y-0.5 p-4 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 flex justify-between items-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-400">
                      <div
                        className="flex flex-col w-full"
                        onClick={() => handleLoadHistoryQuiz(history)}
                      >
                        <div className="flex flex-col gap-2 h-full">
                          <span className="text-lg font-semibold flex-1 dark:text-gray-200">
                            {history.questions[0].text.length > 25
                              ? history.questions[0].text.slice(0, 25) + '...'
                              : history.questions[0].text}
                          </span>
                          <div className="mt-auto text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            <div>第 {history.page} 页</div>
                            <div>创建时间: {new Date(history.created_at).toLocaleString()}</div>
                            <div>题目数量: {history.questions.length}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              {isLoading && (
                <div className="p-5">
                  <div className="flex justify-center items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-600 rounded-full inline-block animate-bounce" style={{animationDelay: '0.1s'}}></span>
                    <span className="w-1.5 h-1.5 bg-gray-600 rounded-full inline-block animate-bounce" style={{animationDelay: '0.2s'}}></span>
                    <span className="w-1.5 h-1.5 bg-gray-600 rounded-full inline-block animate-bounce" style={{animationDelay: '0.3s'}}></span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizPanel;
