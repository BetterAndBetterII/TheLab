import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { searchPlugin } from '@react-pdf-viewer/search';
import { zoomPlugin } from '@react-pdf-viewer/zoom';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import {
  highlightPlugin,
  HighlightArea,
  MessageIcon,
  RenderHighlightContentProps,
  RenderHighlightTargetProps,
} from '@react-pdf-viewer/highlight';
import { IoMdSend, IoMdChatboxes } from 'react-icons/io';

import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '@react-pdf-viewer/search/lib/styles/index.css';
import '@react-pdf-viewer/zoom/lib/styles/index.css';
import '@react-pdf-viewer/page-navigation/lib/styles/index.css';
import '@react-pdf-viewer/highlight/lib/styles/index.css';

// 使用CDN地址
const workerUrl = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

import styles from './PDFReader.module.css';
import ChatPanel from './ChatPanel';
import SummaryPanel from './SummaryPanel';
import FlowPanel from './FlowPanel';
import QuizPanel from './QuizPanel';
import { documentApi } from '../../api';

type TabType = 'notes' | 'summary' | 'chat' | 'flow' | 'quiz';

type KeywordType = 'disruptive' | 'innovative' | 'potential';

interface Keyword {
  text: string;
  type: KeywordType;
}

interface Note {
  id: string;
  content: string;
  highlightAreas: HighlightArea[];
  quote: string;
}

interface Message {
  id: string;
  content: string;
  type: 'user' | 'assistant';
  timestamp: number;
}

interface PDFReaderProps {
  pdfUrl: string;
  documentId: string;
  onPageChange?: (pageNumber: number) => void;
}

const PDFReader: React.FC<PDFReaderProps> = ({
  pdfUrl,
  documentId,
  onPageChange,
}) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNote, setCurrentNote] = useState('');
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [pdfWidth, setPdfWidth] = useState('70%');
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInputVisible, setIsInputVisible] = useState(false);
  const [summaryEn, setSummaryEn] = useState<string[]>([]);
  const [summaryCn, setSummaryCn] = useState<string[]>([]);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string>('');

  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatInputContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    documentApi.recordRead(documentId);
  }, []);

  const [flowData, setFlowData] = useState({
    title: '论文标题',
    authors: ['作者A', '作者B'],
    coreContributions: [
      '创新性地提出了一种新的方法',
      '实验结果显示性能提升显著',
      '在多个领域都有潜在应用价值'
    ],
    questions: [
      '方法在某些极端情况下的表现如何？',
      '计算复杂度是否会影响实际应用？'
    ],
    application: '该方法可以应用于自然语言处理、计算机视觉等多个领域，特别是在资源受限的场景下表现出色。',
    keywords: [
      { text: '深度学习', type: 'disruptive' as KeywordType },
      { text: '注意力机制', type: 'innovative' as KeywordType },
      { text: '迁移学习', type: 'potential' as KeywordType },
      { text: '模型压缩', type: 'innovative' as KeywordType },
      { text: '低资源场景', type: 'potential' as KeywordType }
    ] as Keyword[]
  });

  // 获取摘要数据
  const fetchSummaries = async (d: string) => {
    setIsSummaryLoading(true);
    setSummaryError('');
    
    try {
      const summaryData = await documentApi.getSummary(d);
      
      // 将所有页面的摘要合并成一个完整的摘要
      const EnSummary: string[] = [];
      const CnSummary: string[] = [];
      
      Object.entries(summaryData.summaries)
        .sort(([pageA], [pageB]) => parseInt(pageA) - parseInt(pageB))
        .forEach(([page, summary]) => {
            EnSummary.push(summary.en);
            CnSummary.push(summary.cn);
        });
      
      setSummaryEn(EnSummary);
      setSummaryCn(CnSummary);
    } catch (error) {
      console.error('获取摘要失败:', error);
      setSummaryError('获取摘要失败，请稍后重试');
    } finally {
      setIsSummaryLoading(false);
    }
  };

  // 组件加载时获取摘要
  useEffect(() => {
    fetchSummaries(documentId);
  }, []);

  // 处理拖拽调整
  useEffect(() => {
    const container = containerRef.current;
    const resizer = resizerRef.current;
    const pdfContainer = pdfContainerRef.current;

    if (!container || !resizer || !pdfContainer) return;

    let startX: number;
    let startWidth: number;

    const startDragging = (e: MouseEvent) => {
      startX = e.clientX;
      startWidth = pdfContainer.offsetWidth;
      setIsDragging(true);
    };

    const stopDragging = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', stopDragging);
    };

    const onDrag = (e: MouseEvent) => {
      if (!container) return;

      const containerWidth = container.offsetWidth;
      const newWidth = startWidth + (e.clientX - startX);

      // 限制最小和最大宽度
      const minWidth = 280;
      const maxWidth = containerWidth - 280; // 保留笔记面板最小宽度

      const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
      const percentage = (clampedWidth / containerWidth) * 100;

      setPdfWidth(`${percentage}%`);
    };

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      startDragging(e);
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', stopDragging);
    };

    resizer.addEventListener('mousedown', handleMouseDown);

    return () => {
      resizer.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // 添加鼠标移动监听逻辑
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const threshold = window.innerHeight - 150;

      const inputContainer = chatInputContainerRef.current;
      if (inputContainer) {
        const rect = inputContainer.getBoundingClientRect();
        const isOverInput = e.clientX >= rect.left &&
                          e.clientX <= rect.right &&
                          e.clientY >= rect.top &&
                          e.clientY <= rect.bottom;

        if (isOverInput) {
          setIsInputVisible(true);
          return;
        }
      }

      if (e.clientY > threshold) {
        setIsInputVisible(true);
      } else {
        if (!inputValue.trim() && document.activeElement !== inputRef.current) {
          setIsInputVisible(false);
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [inputValue]);

  const defaultLayoutPluginInstance = defaultLayoutPlugin();
  const searchPluginInstance = searchPlugin();
  const zoomPluginInstance = zoomPlugin();
  const pageNavigationPluginInstance = pageNavigationPlugin();

  // 处理页面变化
  const handlePageChange = (e: { currentPage: number }) => {
    setCurrentPage(e.currentPage);
    onPageChange?.(e.currentPage + 1);
  };

  // 高亮插件配置
  const renderHighlightTarget = (props: RenderHighlightTargetProps) => (
    <div
      className={styles.highlightTarget}
      onClick={props.toggle}
      title="添加批注"
      style={{
          left: `${props.selectionRegion.left}%`,
          top: `${props.selectionRegion.top + props.selectionRegion.height}%`,
      }}
    >
      <div className={styles.highlightTargetInner}>
        <MessageIcon />
        <span className={styles.highlightTargetText}>添加批注</span>
      </div>
    </div>
  );

  const renderHighlightContent = (props: RenderHighlightContentProps) => {
    return (
      <div
        className={styles.highlightContent}
        style={{
            position: 'absolute',
            left: `${props.selectionRegion.left}%`,
            top: `${props.selectionRegion.top + props.selectionRegion.height}%`,
            zIndex: 1,
        }}
      >
        <textarea
          placeholder="添加批注..."
          value={currentNote}
          onChange={(e) => setCurrentNote(e.target.value)}
        />
        <div className={styles.highlightButtons}>
          <button
            onClick={() => {
              const note: Note = {
                id: `note-${Date.now()}`,
                content: currentNote,
                highlightAreas: props.highlightAreas,
                quote: props.selectedText,
              };
              setNotes([...notes, note]);
              console.log(notes);
              setCurrentNote('');
              props.cancel();
            }}
          >
            保存
          </button>
          <button
            onClick={() => {
              setCurrentNote('');
              props.cancel();
            }}
          >
            取消
          </button>
        </div>
      </div>
    );
  };

  const jumpToHighlightArea = (note: Note) => {
    if (note.highlightAreas?.[0]) {
      const jumpToPage = note.highlightAreas[0].pageIndex;
      onPageChange?.(jumpToPage + 1);
    }
  };

  const highlightPluginInstance = highlightPlugin({
    renderHighlightTarget,
    renderHighlightContent,
    renderHighlights: (props) => (
      <div>
        {notes.map((note) => (
          <React.Fragment key={note.id}>
            {note.highlightAreas
              .filter((area) => area.pageIndex === props.pageIndex)
              .map((area, index) => (
                <div
                  key={index}
                  className={styles.highlightArea}
                  style={{
                    background: 'rgba(255, 255, 0, 0.3)',
                    position: 'absolute',
                    left: `${area.left}%`,
                    top: `${area.top}%`,
                    width: `${area.width}%`,
                    height: `${area.height}%`,
                    cursor: 'pointer',
                  }}
                  onClick={() => jumpToHighlightArea(note)}
                  title={note.content}
                />
              ))}
          </React.Fragment>
        ))}
      </div>
    ),
  });

  // 处理消息发送
  const handleMessageSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      content: inputValue,
      type: 'user',
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // 切换到聊天模式
    setActiveTab('chat');

    // 模拟AI响应
    setTimeout(() => {
      const aiResponse: Message = {
        id: `msg-${Date.now()}`,
        content: `这是对"${inputValue}"的回答。当前在第${currentPage + 1}页。`,
        type: 'assistant',
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <div
        className={styles.pdfContainer}
        ref={pdfContainerRef}
        style={{ width: pdfWidth }}
      >
        <Worker workerUrl={workerUrl}>
          <Viewer
            fileUrl={pdfUrl}
            plugins={[
              defaultLayoutPluginInstance,
              searchPluginInstance,
              zoomPluginInstance,
              pageNavigationPluginInstance,
              highlightPluginInstance,
            ]}
            onPageChange={handlePageChange}
          />
        </Worker>
      </div>

      <div
        ref={resizerRef}
        className={`${styles.resizer} ${isDragging ? styles.dragging : ''}`}
      />

      <div className={styles.notesPanel}>
        <div className={styles.tabsContainer}>
          <button
            className={`${styles.tab} ${activeTab === 'summary' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            总结
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'notes' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            笔记
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'chat' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            对话
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'flow' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('flow')}
          >
            心流
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'quiz' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('quiz')}
          >
            测验
          </button>
        </div>

        <div className={styles.tabContent}>
          {activeTab === 'summary' && (
            <>
              {isSummaryLoading ? (
                <div className={styles.loadingContainer}>
                  <span>加载摘要中...</span>
                </div>
              ) : summaryError ? (
                <div className={styles.errorContainer}>
                  <span>{summaryError}</span>
                  <button onClick={() => fetchSummaries(documentId)}>重试</button>
                </div>
              ) : (
                <SummaryPanel
                  summaryEn={summaryEn[currentPage]}
                  summaryCn={summaryCn[currentPage]}
                />
              )}
            </>
          )}

          {activeTab === 'notes' && (
            <div className={styles.notesList}>
              {notes
                .filter(note => note.highlightAreas.some(area => area.pageIndex === currentPage))
                .map((note) => (
                <div
                  key={note.id}
                  className={styles.noteItem}
                  onClick={() => jumpToHighlightArea(note)}
                >
                  <div className={styles.noteHeader}>
                    <span className={styles.pageInfo}>第 {note.highlightAreas[0].pageIndex + 1} 页</span>
                    <button
                      className={styles.deleteNote}
                      onClick={(e) => {
                        e.stopPropagation();
                        setNotes(notes.filter((n) => n.id !== note.id));
                      }}
                    >
                      删除
                    </button>
                  </div>
                  <div className={styles.noteQuote}>{note.quote}</div>
                  <div className={styles.noteContent}>{note.content}</div>
                </div>
              ))}
              {notes.filter(note => note.highlightAreas.some(area => area.pageIndex === currentPage)).length === 0 && (
                <div className={styles.emptyNotes}>
                  当前页面暂无笔记
                </div>
              )}
            </div>
          )}

          {activeTab === 'chat' && (
            <ChatPanel
              messages={messages}
              isLoading={isLoading}
            />
          )}

          {activeTab === 'flow' && (
            <FlowPanel {...flowData} />
          )}

          {activeTab === 'quiz' && (
            <QuizPanel currentPage={currentPage + 1} />
          )}
        </div>
      </div>

      <button
        className={styles.showInputButton}
        onClick={() => {
          setIsInputVisible(true);
          setTimeout(() => {
            inputRef.current?.focus();
          }, 100);
        }}
      >
        <IoMdChatboxes size={24} />
      </button>

      <div
        ref={chatInputContainerRef}
        className={`${styles.chatInputContainer} ${isInputVisible ? styles.visible : ''}`}
      >
        <form onSubmit={handleMessageSend} className={styles.chatForm}>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={() => {
              if (!inputValue.trim()) {
                setIsInputVisible(false);
              }
            }}
            placeholder="输入消息..."
            className={styles.chatInput}
          />
          <button type="submit" className={styles.sendButton}>
            <IoMdSend size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default PDFReader;
