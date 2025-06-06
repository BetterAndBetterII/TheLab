import React, { useState, useRef, useEffect, useCallback, MutableRefObject } from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { searchPlugin, RenderHighlightsProps as SearchRenderHighlightsProps, OnHighlightKeyword } from '@react-pdf-viewer/search';
import { zoomPlugin } from '@react-pdf-viewer/zoom';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import {
  highlightPlugin,
  HighlightArea,
  MessageIcon,
  RenderHighlightContentProps,
  RenderHighlightTargetProps,
  RenderHighlightsProps,
} from '@react-pdf-viewer/highlight';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';
import { Send, MessageSquare, Download, RefreshCw, X, Edit } from 'lucide-react';
import { ChevronRight, ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { throttle } from 'lodash';

import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '@react-pdf-viewer/search/lib/styles/index.css';
import '@react-pdf-viewer/zoom/lib/styles/index.css';
import '@react-pdf-viewer/page-navigation/lib/styles/index.css';
import '@react-pdf-viewer/highlight/lib/styles/index.css';

// 使用CDN地址
// const workerUrl = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
const workerUrl = '/pdf.worker.min.js';

import styles from './PDFReader.module.css';
import ChatPanel from './ChatPanel';
import SummaryPanel from './SummaryPanel';
import FlowPanel from './FlowPanel';
import QuizPanel from './QuizPanel';
import { documentApi } from '../../api';
import { conversationApi } from '../../api/conversations';
import { Message } from './ChatPanel';
import { FlowData } from './FlowPanel';
import { QuizData } from './QuizPanel';
import NotesPanel, { Note } from './NotesPanel';

type TabType = 'notes' | 'summary' | 'chat' | 'flow' | 'quiz';

type ModelType = 'standard' | 'advanced';

interface MindmapData {
  mindmap: string;
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
  // 定义状态持久化配置
  const STORAGE_KEY = `pdf_reader_state`;

  // 获取持久化状态的函数
  const getStoredState = () => {
    const storedState = localStorage.getItem(STORAGE_KEY);
    if (storedState) {
      return JSON.parse(storedState);
    }
    return null;
  };

  // 保存状态到localStorage的函数
  const saveState = (updates: Record<string, any>) => {
    const currentState = getStoredState() || {};
    const newState = { ...currentState, ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  };

  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNote, setCurrentNote] = useState('');
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [pdfWidth, setPdfWidth] = useState(() => {
    const stored = getStoredState()?.pdfWidth;
    return stored || '70%';
  });
  const [pdfHeight, setPdfHeight] = useState(() => {
    const stored = getStoredState()?.pdfHeight;
    return stored || '50vh';
  });
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const stored = getStoredState()?.activeTab;
    return stored || 'summary';
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInputVisible, setIsInputVisible] = useState(false);
  const [summaryEn, setSummaryEn] = useState<string[]>([]);
  const [summaryCn, setSummaryCn] = useState<string[]>([]);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string>('');
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const noteEles: Map<number, HTMLElement> = new Map();
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [flowData, setFlowData] = useState<FlowData | null>(null);
  const [currentQuizData, setCurrentQuizData] = useState<QuizData | null>(null);
  const [quizHistory, setQuizHistory] = useState<QuizData[]>([]);
  const [currentModel, setCurrentModel] = useState<ModelType>(() => {
    const stored = getStoredState()?.currentModel;
    return stored || 'standard';
  });
  const [addNotes, setAddNotes] = useState(false);
  const [autoShowInput, setAutoShowInput] = useState(() => {
    const stored = getStoredState()?.autoShowInput;
    return stored !== undefined ? stored : true;
  });

  const [mindmapData, setMindmapData] = useState<MindmapData | null>(null);
  const [showMindmap, setShowMindmap] = useState<boolean>(false);
  const [mindmapLoading, setMindmapLoading] = useState<boolean>(false);

  const recordingNotes = useRef<Map<string, string>>(new Map());  // 记录笔记的关键词

  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatInputContainerRef = useRef<HTMLDivElement>(null);
  const mindmapRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<Markmap | null>(null) as MutableRefObject<Markmap | null>;
  const resizerHorizontalRef = useRef<HTMLDivElement>(null);
  const highlightOnlyRef = useRef<boolean>(false);
  const lastHighlightAreas = useRef<HighlightArea[]>([]);

  const [isDraggingVertical, setIsDraggingVertical] = useState(false);
  const [isNotesPanelCollapsed, setIsNotesPanelCollapsed] = useState(() => {
    const stored = getStoredState()?.isNotesPanelCollapsed;
    return stored !== undefined ? stored : false;
  });

  // 添加节流后的更新函数
  const throttledSetPdfWidth = useRef(
    throttle((width: string) => {
      setPdfWidth(width);
    }, 16)  // 约60fps
  ).current;

  const throttledSetPdfHeight = useRef(
    throttle((height: string) => {
      setPdfHeight(height);
    }, 16)
  ).current;

  // 加载笔记
  const loadNotes = useCallback(async () => {
    try {
      const notesData = await documentApi.getNotes(documentId);
      setNotes(notesData.map(note => ({
        id: note.id,
        content: note.content,
        quote: note.quote,
        highlightAreas: note.highlight_areas,
      })));
    } catch (error) {
      console.error('加载笔记失败:', error);
    }
  }, [documentId]);

  useEffect(() => {
    documentApi.recordRead(documentId);
    loadNotes();  // 加载笔记
  }, [documentId, loadNotes]);

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

  // 组件加载时读取保存的页码
  useEffect(() => {
    const savedPage = localStorage.getItem(`pdf_page_${documentId}`);
    if (savedPage) {
      const pageNumber = parseInt(savedPage, 10);
      setCurrentPage(pageNumber);
    }
  }, [documentId]);

  // 添加鼠标移动监听逻辑
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!autoShowInput) return; // 如果禁用了自动呼出,直接返回

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
  }, [inputValue, autoShowInput]); // 添加autoShowInput作为依赖

  // 添加 useEffect 来处理键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'AltRight') {
        e.preventDefault();
        if (isInputVisible) {
          inputRef.current?.blur();
          setIsInputVisible(false);
        } else {
          setIsInputVisible(true);
          setTimeout(() => {
            inputRef.current?.focus();
          }, 100);
        }
      }
    };

    // 添加事件监听器
    document.addEventListener('keydown', handleKeyDown);

    // 清理函数
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isInputVisible, autoShowInput]);

  // 监听状态变化并保存
  useEffect(() => {
    saveState({
      pdfWidth,
      pdfHeight,
      activeTab,
      autoShowInput,
      currentModel,
      isNotesPanelCollapsed
    });
  }, [pdfWidth, pdfHeight, activeTab, autoShowInput, currentModel, isNotesPanelCollapsed]);

  // 优化水平拖拽
  useEffect(() => {
    const container = containerRef.current;
    const resizer = resizerRef.current;
    const pdfContainer = pdfContainerRef.current;

    if (!container || !resizer || !pdfContainer) return;

    const startDragging = (e: MouseEvent) => {
      const startX = e.clientX;
      const startWidth = pdfContainer.offsetWidth;
      setIsDragging(true);

      const onDrag = (e: MouseEvent) => {
        if (!container) return;
        const containerWidth = container.offsetWidth;
        const newWidth = startWidth + (e.clientX - startX);
        const minWidth = 280;
        const maxWidth = containerWidth - 280;
        const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
        const percentage = (clampedWidth / containerWidth) * 100;

        // 使用节流函数更新宽度
        throttledSetPdfWidth(`${percentage}%`);

        // 使用 requestAnimationFrame 优化视觉更新
        requestAnimationFrame(() => {
          pdfContainer.style.width = `${percentage}%`;
        });
      };

      const stopDragging = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDragging);
      };

      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', stopDragging);
    };

    resizer.addEventListener('mousedown', startDragging);
    return () => {
      resizer.removeEventListener('mousedown', startDragging);
      // 清理节流函数
      throttledSetPdfWidth.cancel();
    };
  }, [throttledSetPdfWidth]);

  // 优化垂直拖拽
  useEffect(() => {
    const container = containerRef.current;
    const resizerHorizontal = resizerHorizontalRef.current;
    const pdfContainer = pdfContainerRef.current;

    if (!container || !resizerHorizontal || !pdfContainer) return;

    const startDragging = (e: MouseEvent | TouchEvent) => {
      const touchY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const startY = touchY;
      const startHeight = pdfContainer.offsetHeight;
      setIsDraggingVertical(true);

      const onDrag = (e: MouseEvent | TouchEvent) => {
        if (!container) return;
        const touchY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const containerHeight = container.offsetHeight;
        const newHeight = startHeight + (touchY - startY);
        const minHeight = containerHeight * 0.15;
        const maxHeight = containerHeight * 0.85;
        const clampedHeight = Math.min(Math.max(newHeight, minHeight), maxHeight);
        const percentage = (clampedHeight / containerHeight) * 100;

        // 使用节流函数更新高度
        throttledSetPdfHeight(`${percentage}vh`);

        // 使用 requestAnimationFrame 优化视觉更新
        requestAnimationFrame(() => {
          pdfContainer.style.height = `${percentage}vh`;
        });
      };

      const stopDragging = () => {
        setIsDraggingVertical(false);
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDragging);
        document.removeEventListener('touchmove', onDrag);
        document.removeEventListener('touchend', stopDragging);
      };

      if ('touches' in e) {
        document.addEventListener('touchmove', onDrag);
        document.addEventListener('touchend', stopDragging);
      } else {
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDragging);
      }
    };

    resizerHorizontal.addEventListener('mousedown', startDragging);
    resizerHorizontal.addEventListener('touchstart', startDragging);

    return () => {
      resizerHorizontal.removeEventListener('mousedown', startDragging);
      resizerHorizontal.removeEventListener('touchstart', startDragging);
      // 清理节流函数
      throttledSetPdfHeight.cancel();
    };
  }, [throttledSetPdfHeight]);

  useEffect(() => {
    if (mindmapData && showMindmap) {
      console.log(mindmapData);
      // 使用 markmap 渲染思维导图
      if (mindmapRef.current) {
        const transformer = new Transformer();
        const { root } = transformer.transform(mindmapData.mindmap);
        if (markmapRef.current) {
          markmapRef.current.destroy();
        }
        markmapRef.current = Markmap.create(mindmapRef.current, undefined, root);
        markmapRef.current.fit();
      }
    }
  }, [showMindmap, mindmapData]);

  const handleMindmapClick = async (retry=false) => {
    if (!documentId) return;
    setMindmapLoading(false);
    if (mindmapData && !retry) {
      setShowMindmap(true);
      return;
    }
    setMindmapLoading(true);
    try {
      // 获取所有页面的内容
      const mindmapData = await conversationApi.getMindmap(documentId, retry);

      if (mindmapData) {
        setMindmapData(mindmapData);
        setShowMindmap(true);
      } else {
        throw new Error('重新生成思维导图失败');
      }
    } catch (error: any) {
      if (error.message === 'No permission') {
        setMindmapData({
          mindmap: "# 抱歉，您没有权限使用此功能。"
        });
        setShowMindmap(true);
      }
      console.error('获取思维导图出错:', error);
    } finally {
      setMindmapLoading(false);
    }
  };

  const closeMindmap = () => {
    setShowMindmap(false);
    if (markmapRef.current) {
      markmapRef.current.destroy();
    }
  };


  // 这里省略了大量代码，只保留基本结构以便编译通过
  
  return (
    <div className={styles.container} ref={containerRef}>
      <div>PDF Reader Component</div>
    </div>
  );
};

export default PDFReader;

