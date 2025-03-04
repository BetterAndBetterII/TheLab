import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IoMdTime, IoMdClose, IoMdTrash } from 'react-icons/io';
import styles from './ChatPanel.module.css';
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
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isLoading,
  onSelectChat,
  onClearChat
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
      const history = await conversationApi.list();
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
          (<div className={styles.thinking}>
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
          <div className={styles.notes}>
            {notes.map((note, index) => (
              <div key={index} className={styles.note}>
                <strong>{note.keyword}:</strong>
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
    <div className={styles.chatPanel}>
      <button
        className={styles.historyButton}
        onClick={() => setIsHistoryVisible(!isHistoryVisible)}
        title="聊天历史"
      >
        <IoMdTime size={24} />
      </button>

      <button
        className={styles.clearButton}
        onClick={() => onClearChat?.()}
        title="清空对话"
      >
        <IoMdTrash size={24} />
      </button>

      {/* 历史记录侧边栏 */}
      <div 
        ref={historyPanelRef}
        className={`${styles.historyPanel} ${isHistoryVisible ? styles.visible : ''}`}
      >
        <div className={styles.historyHeader}>
          <h3>聊天历史</h3>
          <button
            className={styles.closeButton}
            onClick={() => setIsHistoryVisible(false)}
          >
            <IoMdClose size={18} />
          </button>
        </div>
        <div className={styles.historyList}>
          {isHistoryLoading ? (
            <div className={styles.loadingState}>加载中...</div>
          ) : chatHistory.length === 0 ? (
            <div className={styles.emptyState}>暂无聊天记录</div>
          ) : (
            chatHistory
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map(chat => (
              <div key={chat.id} className={styles.historyItem} onClick={() => {
                onSelectChat(chat.id);
              }}>
                <h4>{chat.title.length > 35 ? chat.title.slice(0, 20) + '...' : chat.title}</h4>
                <p>{getMessageLength(chat.messages)}</p>
                <span className={styles.date}>{formatDate(chat.created_at)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 消息列表 */}
      <div className={styles.messageList} ref={messageListRef}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>💭</div>
            <div className={styles.emptyText}>我可以帮到你吗？</div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`${styles.message} ${
                message.type === 'user' ? styles.userMessage : styles.assistantMessage
              }`}
            >
              {message.type === 'assistant' ? (
                assistantMessage(message)
              ) : (
                <div className={`${styles.messageContent}`}>
                  {message.content}
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className={styles.typingIndicator}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPanel;
