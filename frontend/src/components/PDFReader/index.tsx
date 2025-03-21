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
import { IoMdSend, IoMdChatboxes, IoMdDownload, IoMdRefresh, IoMdClose, IoMdCreate } from 'react-icons/io';
import { FiChevronRight, FiChevronLeft, FiChevronDown, FiChevronUp } from 'react-icons/fi';
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

  const handleExportImage = () => {
    if (!mindmapRef.current) return;

    const svg = mindmapRef.current;
    if (!svg) return;

    // 克隆SVG并添加样式
    const svgClone = svg.cloneNode(true) as SVGElement;

    // 应用计算后的样式
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .markmap-node { color: ${getComputedStyle(document.documentElement).getPropertyValue('--text-color')}; font-size: 18px; font-weight: 400; }
        .markmap-node line { stroke: rgba(25, 118, 210, 0.4); }
        .markmap-fold circle { fill: rgba(25, 118, 210, 1); }
        .markmap-node circle { stroke: rgba(25, 118, 210, 1); }
        .markmap-node-line { stroke: rgba(25, 118, 210, 0.6); }
        .markmap-link { stroke: rgba(25, 118, 210, 0.4); }
    `;
    svgClone.insertBefore(styleElement, svgClone.firstChild);

    // 设置背景色
    svgClone.style.backgroundColor = 'white';

    // 设置合适的视图框和尺寸
    const bbox = (svg as SVGSVGElement).getBBox();
    const viewBox = `${bbox.x - 10} ${bbox.y - 10} ${bbox.width + 20} ${bbox.height + 20}`;
    svgClone.setAttribute('viewBox', viewBox);
    svgClone.setAttribute('width', String(bbox.width + 20));
    svgClone.setAttribute('height', String(bbox.height + 20));

    // 转换为图片
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 5; // 2倍清晰度
      canvas.width = (bbox.width + 20) * scale;
      canvas.height = (bbox.height + 20) * scale;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 绘制图片
      ctx.scale(scale, scale);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, bbox.width + 20, bbox.height + 20);

      // 导出为PNG
      const link = document.createElement('a');
      link.download = '思维导图.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleCopyAll = (lang: string) => {
    if (lang === 'en') {
      navigator.clipboard.writeText(
        "Slides: \n" + summaryEn.join('\n')
      );
    } else {
      navigator.clipboard.writeText(
        "课件内容: \n" + summaryCn.join('\n')
      );
    }
  }

  const saveNote = async (content: string, quote: string, highlightAreas: HighlightArea[]) => {
    const note = await documentApi.createNote(documentId, {
      content: content,
      quote: quote,
      highlight_areas: highlightAreas,
    });
    console.log("保存笔记", note);
    setNotes(prev => [...prev, {
      id: note.id,
      content: note.content,
      quote: note.quote,
      highlightAreas: note.highlight_areas,
    }]);
  }

  const searchRenderHighlights = (renderProps: SearchRenderHighlightsProps) => {
    if (recordingNotes.current.size > 0 && renderProps.highlightAreas.length > 0) {
      console.log("尝试搜索...", renderProps.highlightAreas);
      Array.from(recordingNotes.current.keys()).forEach((key: string) => {
        renderProps.highlightAreas.forEach((area) => {
          const note_ = {
            content: recordingNotes.current.get(key) || '',
            highlightAreas: [],
            quote: key,
          } as {
            content: string;
            highlightAreas: HighlightArea[];
            quote: string;
          };
          if (key === area.keywordStr) {
            console.log("找到笔记", key, recordingNotes.current.get(key));
            note_.highlightAreas.push(area);
          }
          if (note_.highlightAreas.length > 0 && note_.content.length > 0) {
            saveNote(note_.content, note_.quote, note_.highlightAreas);
          }
          // 清除找到的
          recordingNotes.current = new Map(
            Array.from(recordingNotes.current.entries()).filter(([key]) => key !== area.keywordStr)
          );
        });
      });
    }
    // 收集笔记

    return (
      <>
          {renderProps.highlightAreas.map((area, index) => (
              <div
                  key={`${area.pageIndex}-${index}`}
                  style={{
                      ...renderProps.getCssProperties(area),
                      position: 'absolute',
                  }}
              >
              </div>
          ))}
      </>
    )};

  const defaultLayoutPluginInstance = defaultLayoutPlugin();
  const searchPluginInstance = searchPlugin({
    renderHighlights: searchRenderHighlights,
    onHighlightKeyword: (props: OnHighlightKeyword) => {
      console.log("高亮关键词", props);
    }
  });
  const { highlight, clearHighlights } = searchPluginInstance;
  const zoomPluginInstance = zoomPlugin();
  const pageNavigationPluginInstance = pageNavigationPlugin();

  // 处理页面变化
  const handlePageChange = (e: { currentPage: number }) => {
    setCurrentPage(e.currentPage);
    // 保存当前页码到 localStorage
    localStorage.setItem(`pdf_page_${documentId}`, e.currentPage.toString());
    onPageChange?.(e.currentPage + 1);
  };

  // 高亮插件配置
  const renderHighlightTarget = (props: RenderHighlightTargetProps) => {
    // 判断高亮区域是否在页面下方
    // 如果高亮区域的顶部位置+高度超过页面高度的70%，将按钮显示在上方
    const isBottomHalf = (props.selectionRegion.top + props.selectionRegion.height) > 70;

    return (
      <div
        className={styles.highlightTarget}
        style={{
            left: `${props.selectionRegion.left}%`,
            // 根据高亮位置决定按钮显示在上方还是下方
            top: isBottomHalf
              ? `calc(${props.selectionRegion.top}% - 40px)` // 高亮在下方，按钮显示在上方
              : `${props.selectionRegion.top + props.selectionRegion.height}%`, // 高亮在上方，按钮显示在下方
        }}
      >
        <div className={styles.highlightTargetInner}>
          <div className={styles.highlightTargetOptions}>
            <div
              className={styles.highlightOption}
              onClick={async () => {
                try {
                  highlightOnlyRef.current = true;
                  props.toggle();
                } catch (error) {
                  console.error('保存高亮失败:', error);
                }
              }}
              title="高亮"
            >
              <span className={styles.highlightOptionIcon}><IoMdCreate /></span>
              <span className={styles.highlightOptionText}>高亮</span>
            </div>
            <div
              className={styles.highlightOption}
              onClick={() => {
                highlightOnlyRef.current = false;
                props.toggle();
                setTimeout(() => {
                  const noteInput = document.getElementById('note-input');
                  if (noteInput) {
                    noteInput.focus();
                  }
                }, 100);
              }}
              title="添加批注"
            >
              <span className={styles.highlightOptionIcon}><MessageIcon /></span>
              <span className={styles.highlightOptionText}>添加批注</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderHighlightContent = (props: RenderHighlightContentProps) => {
    if (highlightOnlyRef.current) {
      setTimeout(async () => {
        if (lastHighlightAreas.current.length > 0) {
          if (lastHighlightAreas.current.every((area) => props.highlightAreas.includes(area))) {
            return <></>;
          }
        }
        lastHighlightAreas.current = props.highlightAreas;
        const note = await documentApi.createNote(documentId, {
          content: "",
          quote: props.selectedText,
          highlight_areas: props.highlightAreas,
        });

        setNotes([...notes, {
          id: note.id,
          content: "",
          quote: note.quote,
          highlightAreas: note.highlight_areas,
        }]);
      }, 100);
      props.cancel();
      return <></>;
    }

    // 判断高亮区域是否在页面下方
    // 如果高亮区域的顶部位置+高度超过页面高度的70%，将输入框显示在上方
    const isBottomHalf = (props.selectionRegion.top + props.selectionRegion.height) > 70;

    return (
      <div
        className={styles.highlightContent}
        style={{
            position: 'absolute',
            left: `${props.selectionRegion.left}%`,
            // 根据高亮位置决定输入框显示在上方还是下方
            top: isBottomHalf
              ? `${props.selectionRegion.top - 20}%` // 高亮在下方，输入框显示在上方
              : `${props.selectionRegion.top + props.selectionRegion.height}%`, // 高亮在上方，输入框显示在下方
            zIndex: 5,
        }}
      >
        <textarea
          id="note-input"
          placeholder="添加批注... (按住Ctrl/Shift+Enter换行，Enter保存；支持Markdown语法)"
          value={currentNote}
          onChange={(e) => setCurrentNote(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
              e.preventDefault();
              try {
                const note = await documentApi.createNote(documentId, {
                  content: currentNote,
                  quote: props.selectedText,
                  highlight_areas: props.highlightAreas,
                });

                setNotes([...notes, {
                  id: note.id,
                  content: note.content,
                  quote: note.quote,
                  highlightAreas: note.highlight_areas,
                }]);

                setCurrentNote('');
                props.cancel();
              } catch (error) {
                console.error('保存笔记失败:', error);
              }
            }
          }}
        />
        <div className={styles.highlightButtons}>
          <button
            onClick={async () => {
              try {
                const note = await documentApi.createNote(documentId, {
                  content: currentNote,
                  quote: props.selectedText,
                  highlight_areas: props.highlightAreas,
                });

                setNotes([...notes, {
                  id: note.id,
                  content: note.content,
                  quote: note.quote,
                  highlightAreas: note.highlight_areas,
                }]);

                setCurrentNote('');
                props.cancel();
              } catch (error) {
                console.error('保存笔记失败:', error);
              }
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

  const jumpToNote = (note: Note) => {
    if (noteEles.has(Number(note.id))) {
        noteEles.get(Number(note.id))?.scrollIntoView();
    }
  };

  const renderHighlights = (props: RenderHighlightsProps) => (
    <div>
        {notes.map((note) => (
            <React.Fragment key={note.id}>
                {note.highlightAreas
                    .filter((area) => area.pageIndex === props.pageIndex)
                    .map((area, idx) => (
                        <div
                            key={idx}
                            className={styles.highlightArea}
                            style={Object.assign(
                                {},
                                props.getCssProperties(area, props.rotation),
                                {
                                    background: 'rgba(255, 255, 0, 0.3)',
                                    position: 'absolute',
                                    left: `${area.left}%`,
                                    top: `${area.top}%`,
                                    width: `${area.width}%`,
                                    height: `${area.height}%`,
                                    zIndex: 2,
                                }
                            )}
                            onClick={() => {
                              if (note.content) {
                                jumpToNote(note);
                                console.log(note);
                              }
                            }}
                            ref={(ref): void => {
                              if (note.content) {
                                noteEles.set(Number(note.id), ref as HTMLElement);
                              }
                            }}
                        >
                          {note.content && (
                            <div className={styles.highlightAreaText} style={{
                              opacity: 1,
                              zIndex: 6,
                            }}>
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex, rehypeRaw]}
                              >
                                {note.content}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                    ))}
            </React.Fragment>
        ))}
    </div>
  );

  const highlightPluginInstance = highlightPlugin({
    renderHighlightTarget,
    renderHighlightContent,
    renderHighlights: renderHighlights,
  });

  const { jumpToHighlightArea } = highlightPluginInstance;

  // 创建新对话
  const createNewConversation = useCallback(async (user_question: string): Promise<number | null> => {
    try {
      const conversation = await conversationApi.create(
        `${user_question}`,
        [documentId]
      );
      if (conversation.id) {
        setCurrentConversationId(conversation.id);
        return conversation.id;
      } else {
        console.error('创建对话失败:', conversation);
        return null;
      }
    } catch (error) {
      console.error('创建对话失败:', error);
      return null;
    }
  }, [documentId]);

  // 处理消息发送
  const handleMessageSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    // 清除高亮
    clearHighlights();
    recordingNotes.current.clear();

    // 切换到聊天模式
    setActiveTab('chat');
    setIsLoading(true);

    // 用户当前页面的信息
    const pageRange = 5;
    const pageStart = Math.max(0, currentPage - pageRange);
    const pageEnd = Math.min(summaryEn.length, currentPage + pageRange);
    const currentPageInfo = summaryEn.slice(pageStart, pageEnd).join('\n');

    // 发送消息
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      content: inputValue,
      type: 'user',
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    try {
      // 如果没有当前对话，创建新对话
      const conversationId = !currentConversationId ? await createNewConversation(userMessage.content) : currentConversationId;
      if (!conversationId) {
        console.error('创建对话失败');
        return;
      }
      // 调用聊天 API
      const response = await conversationApi.chat(
        conversationId,
        messages.concat({
            id: `msg-${Date.now()}`,
            type: 'user',
            content: `<|SYSTEM_PROMPT|>我正在浏览以下的内容：\n${currentPageInfo}\n\n<|SYSTEM_PROMPT|>${inputValue}`,
            timestamp: Date.now(),
          }).map(msg => ({
            role: msg.type,
            content: msg.content,
          })),
        true,
        currentModel as ModelType,
        addNotes
      );

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        const assistantMessage: Message = {
          id: `msg-${Date.now() + 1}`,
          content: '',
          type: 'assistant',
          timestamp: Date.now(),
        };

        console.log(assistantMessage);

        setMessages(prev => [...prev, assistantMessage]);

        try {
          let cum_content = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(5);
                if (data.indexOf('[DONE]') !== -1) continue;

                try {
                  const json = JSON.parse(data);
                  if (json.error) {
                    throw new Error(json.error.message);
                  }

                  const content = json.choices[0]?.delta?.content || '';
                  if (content) {
                    setIsLoading(false);
                    console.log(content);
                    cum_content += content;
                    setMessages(prev =>
                      prev.map(msg =>
                        msg.id === assistantMessage.id
                          ? { ...msg, content: msg.content + content }
                          : msg
                      )
                    );
                  }
                } catch (e) {
                  console.error('解析响应失败:', e);
                }
              }
            }
          }
          // 提取笔记，去掉标签
          const noteRegex = /(?<=<note>).*?(?=<\/note>)/g;
          const notes = cum_content.match(noteRegex);
          if (notes) {
            const notes_ = notes.map(
              note => note.split(':').length > 2 ? [note.split(':')[0], note.split(':').slice(1).join(':')] : note.split(':')
            );
            console.log("笔记", notes_);
            recordingNotes.current = new Map(notes_.map(note => [note[0], note[1]]));
            console.log("搜索", Array.from(recordingNotes.current.keys()), recordingNotes.current);

            highlight(Array.from(recordingNotes.current.keys()));
            setTimeout(() => {
              recordingNotes.current.clear();
            }, 2000);
          }
        } finally {
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <div
        className={`${styles.pdfContainer} ${isNotesPanelCollapsed && window.innerWidth <= 768 ? styles.pdfContainerExpanded : ''}`}
        ref={pdfContainerRef}
        style={{
          width: window.innerWidth <= 768 ? '100%' : (isNotesPanelCollapsed ? '100%' : pdfWidth),
          height: window.innerWidth <= 768 ? (isNotesPanelCollapsed ? '100vh' : pdfHeight) : '100%'
        }}
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
            initialPage={currentPage}
          />
        </Worker>
      </div>

      <div
        ref={resizerRef}
        className={`${styles.resizer} ${isDragging ? styles.dragging : ''}`}
        style={{ display: isNotesPanelCollapsed ? 'none' : undefined }}
      />

      <div
        ref={resizerHorizontalRef}
        className={`${styles.resizerHorizontal} ${isDraggingVertical ? styles.dragging : ''}`}
        style={{ display: isNotesPanelCollapsed ? 'none' : undefined }}
      />

      <button
        className={`${styles.collapseButton} ${window.innerWidth <= 768 ? styles.collapseButtonMobile : styles.collapseButtonDesktop}`}
        onClick={() => setIsNotesPanelCollapsed(!isNotesPanelCollapsed)}
        title={isNotesPanelCollapsed ? '展开笔记面板' : '收起笔记面板'}
      >
        {window.innerWidth <= 768 ?
          (isNotesPanelCollapsed ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />) :
          (isNotesPanelCollapsed ? <FiChevronLeft size={20} /> : <FiChevronRight size={20} />)
        }
      </button>

      <div
        className={`${styles.notesPanel} ${isNotesPanelCollapsed ? styles.notesPanelCollapsed : ''}`}
        style={{
          height: window.innerWidth <= 768 ? `calc(100vh - ${pdfHeight} - 4px)` : '100%',
          pointerEvents: isNotesPanelCollapsed ? 'none' : 'auto'
        }}
      >
        <div className={styles.notesPanelContent}>
          {!isNotesPanelCollapsed && (
            <>
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
                        handleCopyAll={handleCopyAll}
                      />
                    )}
                  </>
                )}

                {activeTab === 'notes' && (
                  <>
                    <NotesPanel
                      notes={notes}
                      setNotes={setNotes}
                      showAllNotes={showAllNotes}
                      setShowAllNotes={setShowAllNotes}
                      currentPage={currentPage}
                      jumpToHighlightArea={jumpToHighlightArea}
                      editingNoteId={editingNoteId}
                      setEditingNoteId={setEditingNoteId}
                      editingContent={editingContent}
                      setEditingContent={setEditingContent}
                      documentId={documentId}
                    />
                  </>
                )}

                {activeTab === 'chat' && (
                  <ChatPanel
                    messages={messages}
                    isLoading={isLoading}
                    onClearChat={() => {
                      setMessages([]);
                      setCurrentConversationId(null);
                      setIsLoading(false);
                    }}
                    onSelectChat={(id) => {
                      setCurrentConversationId(id);
                      conversationApi.get(id).then(res => {
                        setMessages(res.messages.map(msg => ({
                          id: `msg-${Date.now()}`,
                          content: msg.content,
                          type: msg.role as 'user' | 'assistant',
                          timestamp: Date.now(),
                        })));
                      });
                      setIsLoading(false);
                    }}
                    documentId={documentId}
                  />
                )}

                {activeTab === 'flow' && (
                  <FlowPanel
                    documentId={documentId}
                    flowData={flowData}
                    setFlowData={setFlowData}
                  />
                )}

                {activeTab === 'quiz' && (
                  <QuizPanel
                    currentPage={currentPage + 1}
                    documentId={documentId}
                    currentQuizData={currentQuizData}
                    setCurrentQuizData={setCurrentQuizData}
                    onSelectPage={pageNavigationPluginInstance.jumpToPage}
                    quizHistory={quizHistory}
                    setQuizHistory={setQuizHistory}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <button
        className={`${styles.showInputButton} ${styles.fixedButton}`}
        onClick={() => {
          if (autoShowInput) {
            setIsInputVisible(true);
            setTimeout(() => {
              inputRef.current?.focus();
            }, 100);
          } else {
            setIsInputVisible(prev => !prev);
          }
        }}
        title={autoShowInput ? '鼠标放在屏幕下方自动呼出输入框' : '点按呼出输入框'}
      >
        <IoMdChatboxes size={24} />
      </button>

      <button
        className={`${styles.showInputButton} ${styles.fixedButton}`}
        style={{ bottom: '140px' }}
        onClick={() => setAutoShowInput(!autoShowInput)}
        title={autoShowInput ? '自动呼出已开启' : '自动呼出已关闭'}
      >
        {autoShowInput ? <span className={styles.fixedButtonText}>🔔</span> : <span className={styles.fixedButtonText}>🔕</span>}
      </button>

      <button
        className={`${styles.showMindmapButton} ${styles.fixedButton}`}
        style={{ bottom: '80px' }}
        onClick={() => handleMindmapClick()}
        title="生成思维导图"
      >
        {mindmapLoading ? <span className={`${styles.fixedButtonText} ${styles.mindmapButtonTextLoading}`}>🔄</span> : <span className={styles.fixedButtonText}>🗺️</span>}
      </button>

      <div
        ref={chatInputContainerRef}
        className={`${styles.chatInputContainer} ${isInputVisible ? styles.visible : ''}`}
      >
        <form onSubmit={handleMessageSend} className={styles.chatForm}>
          <button
            type="button"
            className={styles.modelToggle}
            onClick={() => setCurrentModel(prev => prev === 'standard' ? 'advanced' : 'standard')}
            title={currentModel === 'standard' ? '标准模型' : '高级模型'}
          >
            {currentModel === 'standard' ? '🤖' : '🧠'}
          </button>
          <button
            type="button"
            className={styles.modelToggle}
            onClick={() => setAddNotes(prev => !prev)}
            title={addNotes ? '自动添加笔记' : '不自动添加笔记'}
          >
            {addNotes ? '🗒️' : '💭'}
          </button>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="输入消息..."
            className={styles.chatInput}
          />
          <button type="submit" className={styles.sendButton} title="发送消息">
            <IoMdSend size={20} />
          </button>
        </form>
      </div>

      {showMindmap && (
        <div className={styles.mindmapModal}>
          <div className={styles.mindmapModalContent}>
            <div className={styles.mindmapModalHeader}>
              <h2>思维导图</h2>
              <div className={styles.modalActions}>
                <button
                  className={styles.exportButton}
                  onClick={handleExportImage}
                >
                  <IoMdDownload />
                  <span className={styles.buttonText}>导出图片</span>
                </button>
                <button
                  className={styles.regenerateButton}
                  onClick={() => handleMindmapClick(true)}
                  disabled={mindmapLoading}
                >
                  <IoMdRefresh />
                  <span className={styles.buttonText}>{mindmapLoading ? '生成中...' : '重新生成'}</span>
                </button>
                <button className={styles.closeButton} onClick={closeMindmap}>
                  <IoMdClose />
                </button>
              </div>
            </div>
            <div className={styles.mindmapContainer}>
              <svg ref={mindmapRef} className={styles.mindmap}></svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFReader;
