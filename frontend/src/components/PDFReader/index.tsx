import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { IoMdSend, IoMdChatboxes } from 'react-icons/io';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';

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

type TabType = 'notes' | 'summary' | 'chat' | 'flow' | 'quiz';

type KeywordType = 'disruptive' | 'innovative' | 'potential';

type ModelType = 'standard' | 'advanced';

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
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const noteEles: Map<number, HTMLElement> = new Map();
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [flowData, setFlowData] = useState<FlowData | null>(null);
  const [currentQuizData, setCurrentQuizData] = useState<QuizData | null>(null);
  const [quizHistory, setQuizHistory] = useState<QuizData[]>([]);
  const [currentModel, setCurrentModel] = useState<ModelType>('standard');
  const recordingNotes = useRef<Map<string, string>>(new Map());  // 记录笔记的关键词

  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatInputContainerRef = useRef<HTMLDivElement>(null);

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

  // 添加快捷键，Ctrl+Space呼出输入框
  useEffect(() => {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === ' ') {
        e.preventDefault();
        if (isInputVisible) {
          inputRef.current?.blur();
          setIsInputVisible(false);
        } else {
          inputRef.current?.focus();
          setIsInputVisible(true);
        }
      }
    });
  }, []);

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
    onPageChange?.(e.currentPage + 1);
  };

  // 高亮插件配置
  const renderHighlightTarget = (props: RenderHighlightTargetProps) => (
    <div
      className={styles.highlightTarget}
      onClick={() => {
        props.toggle();
        setTimeout(() => {
          const noteInput = document.getElementById('note-input');
          if (noteInput) {
            noteInput.focus();
          }
        }, 100);
      }}
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
            zIndex: 5,
        }}
      >
        <textarea
          id="note-input"
          placeholder="添加批注..."
          value={currentNote}
          onChange={(e) => setCurrentNote(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter') {
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
                                    // background: 'yellow',
                                    // opacity: 0.4,
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
                              jumpToNote(note);
                              console.log(note);
                            }}
                            ref={(ref): void => {
                              noteEles.set(Number(note.id), ref as HTMLElement);
                            }}  // 设置笔记元素的引用
                        >
                          <div className={styles.highlightAreaText} style={{
                            opacity: 1,
                            zIndex: 6,
                          }}>{<ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex, rehypeRaw]}
                          >
                            {note.content}
                          </ReactMarkdown>}</div>
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
        currentModel as ModelType // 传递当前选择的模型
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
          {/* <button
            className={`${styles.tab} ${activeTab === 'summary' ? styles.activeTab : ''}`}
            onClick={() => {
              recordingNotes.current = new Map([
                ["unsigned", "没有关键词"],
              ]);
              highlight(['unsigned']);
            }}
          >
            搜索 unsigned
          </button> */}
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
            <>
              <div className={styles.notesHeader}>
                <div className={styles.notesFilter}>
                  <span>显示全部笔记</span>
                  <label className={styles.toggleSwitch}>
                    <input
                      type="checkbox"
                      checked={showAllNotes}
                      onChange={(e) => setShowAllNotes(e.target.checked)}
                    />
                    <span className={styles.toggleSlider}></span>
                  </label>
                </div>
              </div>
              <div className={styles.notesList}>
                {notes
                  .sort((a, b) => a.highlightAreas[0].pageIndex - b.highlightAreas[0].pageIndex)
                  .filter(note => showAllNotes || note.highlightAreas.some(area => area.pageIndex === currentPage))
                  .map((note) => (
                    <div
                      key={note.id}
                      className={styles.noteItem}
                      onClick={() => jumpToHighlightArea(note.highlightAreas[0])}
                    >
                      <div className={styles.noteHeader}>
                        <span className={styles.pageInfo}>第 {note.highlightAreas[0].pageIndex + 1} 页</span>
                        <div className={styles.noteActions}>
                          {editingNoteId === note.id ? (
                            <>
                              <button
                                className={styles.saveNote}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await documentApi.updateNote(documentId, note.id, {
                                      content: editingContent,
                                      quote: note.quote,
                                      highlight_areas: note.highlightAreas,
                                    });
                                    setNotes(notes.map((n) =>
                                      n.id === note.id ? { ...n, content: editingContent } : n
                                    ));
                                    setEditingNoteId(null);
                                    setEditingContent('');
                                  } catch (error) {
                                    console.error('更新笔记失败:', error);
                                  }
                                }}
                              >
                                保存
                              </button>
                              <button
                                className={styles.cancelEdit}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingNoteId(null);
                                  setEditingContent('');
                                }}
                              >
                                取消
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className={styles.editNote}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingNoteId(note.id);
                                  setEditingContent(note.content);
                                }}
                              >
                                编辑
                              </button>
                              <button
                                className={styles.deleteNote}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await documentApi.deleteNote(documentId, note.id);
                                    setNotes(notes.filter((n) => n.id !== note.id));
                                  } catch (error) {
                                    console.error('删除笔记失败:', error);
                                  }
                                }}
                              >
                                删除
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className={styles.noteQuote}>{note.quote}</div>
                      {editingNoteId === note.id ? (
                        <textarea
                          className={styles.noteEditInput}
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <div className={styles.noteContent}>{note.content}</div>
                      )}
                    </div>
                  ))}
                {!showAllNotes && notes.filter(note => note.highlightAreas.some(area => area.pageIndex === currentPage)).length === 0 && (
                  <div className={styles.emptyNotes}>
                    当前页面暂无笔记
                  </div>
                )}
                {showAllNotes && notes.length === 0 && (
                  <div className={styles.emptyNotes}>
                    暂无笔记
                  </div>
                )}
              </div>
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
          <button
            type="button"
            className={styles.modelToggle}
            onClick={() => setCurrentModel(prev => prev === 'standard' ? 'advanced' : 'standard')}
            title={currentModel === 'standard' ? '标准模型' : '高级模型'}
          >
            {currentModel === 'standard' ? '🤖' : '🧠'}
          </button>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            // onBlur={() => {
            //   if (!inputValue.trim()) {
            //     setIsInputVisible(false);
            //   }
            // }}
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
