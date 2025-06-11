import React, { useState, useEffect } from 'react';
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
        return 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800';
      case 'innovative':
        return 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800';
      case 'potential':
        return 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800';
      default:
        return '';
    }
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
    let reading = true;
    while (reading) {
      const { done, value } = await reader.read();
      if (done) {
        reading = false;
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
    setIsLoading(false);
    // 去除```json```
    const strippedContent = content.replace('```json', '').replace('```', '');
    console.log(strippedContent);
    const data = JSON.parse(strippedContent);
    setFlowData(data);
  };

  useEffect(() => {
    if (!flowData && !isLoading && documentId) {
      onGenerate();
    }
  }, [documentId, flowData, isLoading]);

  if (!flowData && !documentId) {
    return null;
  }

  if (isLoading || (streamContent && !flowData)) {
    return (
      <>
        {isLoading && (
          <div className="flex justify-center items-center gap-1 py-12 px-16 rounded-xl">
            <span className="w-1.5 h-1.5 bg-gray-600 dark:bg-gray-400 rounded-full inline-block animate-bounce" style={{ animationDelay: '0.1s' }}></span>
            <span className="w-1.5 h-1.5 bg-gray-600 dark:bg-gray-400 rounded-full inline-block animate-bounce" style={{ animationDelay: '0.2s' }}></span>
            <span className="w-1.5 h-1.5 bg-gray-600 dark:bg-gray-400 rounded-full inline-block animate-bounce" style={{ animationDelay: '0.3s' }}></span>
          </div>
        )}
        {streamContent && (
          <div className="p-5">
            <div className="whitespace-pre-wrap font-mono leading-6 text-gray-800 dark:text-gray-200">
              {streamContent}
            </div>
          </div>
        )}
      </>
    );
  }

  if (!flowData) {
    return null;
  }

  return (
    <div className="p-5 gap-5 flex flex-col items-center justify-center mb-8">
      <div className="text-center pb-5 border-b-2 border-gray-100 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-3 leading-snug">{flowData.title}</h1>
        <div className="text-gray-600 dark:text-gray-400 text-sm">
          {flowData.authors.map((author, index) => (
            <span key={index} className="inline-block py-0.5 px-2 bg-gray-100 dark:bg-gray-700 rounded-xl mx-1">
              {author}
              {index < flowData.authors.length - 1 && ', '}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">核心贡献</h2>
        <div className="flex flex-col gap-3">
          {flowData.coreContributions.map((contribution, index) => (
            <div key={index} className="flex items-start gap-3 bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
              <span className="w-6 h-6 bg-blue-700 dark:bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0">
                {index + 1}
              </span>
              <p className="flex-1 dark:text-gray-200">{contribution}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">质疑点</h2>
        <div className="flex flex-col gap-3">
          {flowData.questions.map((question, index) => (
            <div key={index} className="flex items-start gap-3 bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
              <span className="w-6 h-6 bg-pink-500 dark:bg-pink-600 text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0">
                ?
              </span>
              <p className="flex-1 dark:text-gray-200">{question}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">应用场景</h2>
        <div className="flex items-start gap-4 bg-white dark:bg-gray-700 p-5 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="text-2xl flex-shrink-0">🎯</div>
          <p className="flex-1 dark:text-gray-200">{flowData.application}</p>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">关键词</h2>
        <div className="flex flex-wrap gap-2">
          {flowData.keywords.map((keyword, index) => (
            <span
              key={index}
              className={`py-1.5 px-3 rounded-2xl text-sm font-medium cursor-default transition-all duration-200 hover:scale-105 ${getKeywordColor(keyword.type)}`}
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
