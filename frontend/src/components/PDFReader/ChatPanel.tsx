import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Clock, X, Trash } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { conversationApi } from '../../api/conversations';

export interface Message {
  id: string;
  content: string;
  type: 'user' | 'assistant';
  timestamp: number;
}

interface ConversationMessage {
  role: string;
  content: string;
  timestamp: string;
  finish_reason?: string;
}

interface ChatHistory {
  id: number;
  title: string;
  messages: ConversationMessage[];
  documents: Array<{
    id: number;
    filename: string;
  }>;
  created_at: string;
  updated_at: string;
  user_id: number;
}

interface ChatPanelProps {
  messages: Message[];
  isLoading: boolean;
  onSelectChat: (id: number) => void;
  onClearChat?: () => void;
  documentId: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isLoading,
  onSelectChat,
  onClearChat,
  documentId
}) => {
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);
  const historyPanelRef = useRef<HTMLDivElement>(null);

  // 缓存正则表达式
  const THINK_START_END_REGEX = /<think>([\s\S]*?)<\/think>/;
  const THINK_START_REGEX = /<think>([\s\S]*)/;

  const parseContent = useCallback((content: string) => {
    let notes: Array<{keyword: string, content: string}> = [];
    // 替换\( \)，\[ \]为$$ $$
    content = content.replace(/\\\((.*?)\\\)/g, '$$$$1$$').replace(/\\\[(.*?)\\\]/g, '$$$$1$$');

    // 提取笔记，去掉标签
    const noteRegex = /(?<=<note>).*?(?=<\/note>)/g;
    const _notes = content.match(noteRegex);
    content = content.replace(noteRegex, '');
    if (_notes) {
      const notes_ = _notes.map(
        note => note.split(':').length > 2 ? [note.split(':')[0], note.split(':').slice(1).join(':')] : note.split(':')
      );
      notes = notes_.map(note => ({keyword: note[0], content: note[1]}));
    }
    // 快速检查是否包含think标签，如果不包含直接返回
    if (!content.includes("<think>")) {
        return {thinkProcess: null, response: content, isThinking: false, notes: notes};
    }

    let thinkProcess = null;
    let response = content;
    let isThinking = false;

    // 使用缓存的正则表达式
    if (content.includes("</think>")) {
        isThinking = false;
        const match = content.match(THINK_START_END_REGEX);
        if (match) {
            thinkProcess = match[1];
            if (thinkProcess) {
                thinkProcess = thinkProcess.trim();
                thinkProcess = thinkProcess.split("\n")
                    .reduce((acc, line) => {
                        const trimmed = line.trim();
                        return trimmed ? acc + (acc ? "\n" : "") + trimmed : acc;
                    }, "");
            }
            response = content.replace(`<think>${match[1]}</think>`, "").trim();
        }
    } else {
        isThinking = true;
        const match = content.match(THINK_START_REGEX);
        if (match) {
            thinkProcess = match[1];
            if (thinkProcess) {
                thinkProcess = thinkProcess.trim();
                thinkProcess = thinkProcess.split("\n")
                    .reduce((acc, line) => {
                        const trimmed = line.trim();
                        return trimmed ? acc + (acc ? "\n" : "") + trimmed : acc;
                    }, "");
            }
            response = content.replace(`<think>${match[1]}`, "").trim();
        }
    }


    return {thinkProcess, response, isThinking, notes};
  }, []);


  // 加载聊天历史
  const loadChatHistory = async () => {
    try {
      setIsHistoryLoading(true);
      const history = await conversationApi.list(documentId);
      setChatHistory(history);
    } catch (error) {
      console.error('加载聊天历史失败:', error);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // 当打开历史面板时加载聊天历史
  useEffect(() => {
    if (isHistoryVisible) {
      loadChatHistory();
    }
  }, [isHistoryVisible]);

  // 自动滚动到底部
  useEffect(() => {
    if (messageListRef.current) {
      const scrollHeight = messageListRef.current.scrollHeight;
      messageListRef.current.scrollTo({
        top: scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading]);

  // 添加点击外部关闭侧边栏的处理函数
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        historyPanelRef.current &&
        !historyPanelRef.current.contains(event.target as Node) &&
        isHistoryVisible
      ) {
        setIsHistoryVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isHistoryVisible]);

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 获取最后一条消息
  const getMessageLength = (messages: ConversationMessage[]) => {
    return messages.length > 0 ? `${messages.length}条消息` : '无消息';
  };

  const assistantMessage = (message: Message) => {
    const { thinkProcess, response, isThinking, notes } = parseContent(message.content);
    return (
      <>
        {(thinkProcess || isThinking) &&
          (<div className="p-3 rounded-xl text-xs leading-relaxed bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 mb-3">
            {thinkProcess}
          </div>)
        }
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex, rehypeRaw]}
        >
          {response}
        </ReactMarkdown>
        {notes && notes.length > 0 && (
          <div className="text-xs mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border-l-4 border-gray-500 dark:border-gray-400">
            {notes.map((note, index) => (
              <div key={index} className="mb-3 last:mb-0">
                <strong className="text-gray-600 dark:text-gray-400 mr-2">{note.keyword}:</strong>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex, rehypeRaw]}
                >
                  {note.content}
                </ReactMarkdown>
              </div>
            ))}
          </div>
        )}
      </>
    )
  }

  return (
    <div className="flex flex-col h-full relative overflow-hidden p-5">
      <button
        className="absolute left-0 top-0 w-12 h-12 bg-transparent border-none p-0 cursor-pointer text-gray-600 dark:text-gray-400 rounded-full transition-all duration-200 flex items-center justify-center z-[2] opacity-60 hover:opacity-100 hover:scale-110 hover:text-blue-600 dark:hover:text-blue-400"
        onClick={() => setIsHistoryVisible(!isHistoryVisible)}
        title="聊天历史"
      >
        <Clock size={24} />
      </button>

      <button
        className="absolute left-0 top-[42px] w-12 h-12 bg-transparent border-none p-0 cursor-pointer text-gray-600 dark:text-gray-400 rounded-full transition-all duration-200 flex items-center justify-center z-[2] opacity-60 hover:opacity-100 hover:scale-110 hover:text-red-600 dark:hover:text-red-400"
        onClick={() => onClearChat?.()}
        title="清空对话"
      >
        <Trash size={24} />
      </button>

      {/* 历史记录侧边栏 */}
      <div
        ref={historyPanelRef}
        className={`fixed -left-80 top-0 w-80 h-screen bg-white dark:bg-gray-900 shadow-lg transition-transform duration-300 ease-out z-[1000] flex flex-col ${
          isHistoryVisible ? 'translate-x-80' : ''
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="m-0 text-base font-medium text-gray-800 dark:text-gray-200">聊天历史</h3>
          <button
            className="bg-transparent border-none w-8 h-8 text-gray-600 dark:text-gray-400 cursor-pointer p-1 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200"
            onClick={() => setIsHistoryVisible(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isHistoryLoading ? (
            <div className="flex flex-col items-center justify-center text-gray-600 dark:text-gray-400">加载中...</div>
          ) : chatHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-gray-600 dark:text-gray-400">暂无聊天记录</div>
          ) : (
            chatHistory
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((chat, index) => (
              <div key={index} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl mb-3 cursor-pointer transition-all duration-200 border border-transparent hover:bg-white dark:hover:bg-gray-700 hover:border-blue-600 dark:hover:border-blue-400 hover:-translate-y-0.5 hover:shadow-lg" onClick={() => {
                onSelectChat(chat.id);
              }}>
                <h4 className="m-0 mb-2 text-sm text-gray-800 dark:text-gray-200 font-medium">{chat.title.length > 35 ? chat.title.slice(0, 20) + '...' : chat.title}</h4>
                <p className="m-0 mb-2 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">{getMessageLength(chat.messages)}</p>
                <span className="text-xs text-gray-400 dark:text-gray-500 block">{formatDate(chat.created_at)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col" ref={messageListRef}>
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-600 dark:text-gray-400">
            <div className="text-5xl mb-4 animate-bounce">💭</div>
            <div className="text-base text-gray-600 dark:text-gray-400">我可以帮到你吗？</div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`mb-4 ${
                message.type === 'user' ? 'max-w-4/5 ml-auto' : 'w-full leading-relaxed mx-auto'
              }`}
              style={{
                animation: 'slideInUp 0.3s ease-out',
              }}
            >
              {message.type === 'assistant' ? (
                assistantMessage(message)
              ) : (
                <div className="p-3 rounded-xl text-sm leading-relaxed break-all bg-blue-600 dark:bg-blue-500 text-white">
                  {message.content}
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="py-12 px-16 rounded-xl flex gap-1">
            <span
              className="w-1.5 h-1.5 bg-gray-600 dark:bg-gray-400 rounded-full inline-block animate-bounce"
              style={{ animationDelay: '0.1s' }}
            ></span>
            <span
              className="w-1.5 h-1.5 bg-gray-600 dark:bg-gray-400 rounded-full inline-block animate-bounce"
              style={{ animationDelay: '0.2s' }}
            ></span>
            <span
              className="w-1.5 h-1.5 bg-gray-600 dark:bg-gray-400 rounded-full inline-block animate-bounce"
              style={{ animationDelay: '0.3s' }}
            ></span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        pre {
          background: rgb(var(--gray-100)) !important;
          color: rgb(var(--gray-800)) !important;
          padding: 2px 4px !important;
          border-radius: 4px !important;
        }

        .dark pre {
          background: rgb(var(--gray-700)) !important;
          color: rgb(var(--gray-200)) !important;
        }

        code {
          background: rgb(var(--gray-100)) !important;
          color: rgb(var(--gray-800)) !important;
          padding: 2px 4px !important;
          border-radius: 4px !important;
        }

        .dark code {
          background: rgb(var(--gray-700)) !important;
          color: rgb(var(--gray-200)) !important;
        }
      `}</style>
    </div>
  );
};

export default ChatPanel;
