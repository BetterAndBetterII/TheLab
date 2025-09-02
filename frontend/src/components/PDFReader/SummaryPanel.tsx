import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { Clipboard, Languages, Copy, Check } from 'lucide-react';
import 'katex/dist/katex.min.css';

interface SummaryPanelProps {
  summaryEn: string;
  summaryCn: string;
  handleCopyAll: (lang: string) => void;
}

const SummaryPanel: React.FC<SummaryPanelProps> = ({
  summaryEn,
  summaryCn,
  handleCopyAll
}) => {
  const [isEnglish, setIsEnglish] = useState(false);
  const [isCopied, setIsCopied] = useState<'none' | 'current' | 'alternate'>('none');
  const [copyAllStatus, setCopyAllStatus] = useState<'none' | 'current' | 'alternate'>('none');
  const [buttonPositions, setButtonPositions] = useState<{ [key: string]: { top: number; left: number } }>({});
  const [isHoveringCopyGroup, setIsHoveringCopyGroup] = useState(false);
  const [isHoveringCopyAllGroup, setIsHoveringCopyAllGroup] = useState(false);

  const buttonRefs = {
    copyAll: React.useRef<HTMLButtonElement>(null),
    copy: React.useRef<HTMLButtonElement>(null),
  };

  const updateButtonPosition = () => {
    const positions: { [key: string]: { top: number; left: number } } = {};
    Object.entries(buttonRefs).forEach(([key, ref]) => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        positions[key] = {
          top: rect.top - 40,
          left: rect.left
        };
      }
    });
    setButtonPositions(positions);
  };

  React.useEffect(() => {
    updateButtonPosition();
    window.addEventListener('scroll', updateButtonPosition);
    window.addEventListener('resize', updateButtonPosition);
    return () => {
      window.removeEventListener('scroll', updateButtonPosition);
      window.removeEventListener('resize', updateButtonPosition);
    };
  }, []);

  const handleCopy = async (text: string, type: 'current' | 'alternate') => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(type);
      setTimeout(() => setIsCopied('none'), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const handleCopyAllWithStatus = (lang: string, type: 'current' | 'alternate') => {
    handleCopyAll(lang);
    setCopyAllStatus(type);
    setTimeout(() => setCopyAllStatus('none'), 2000);
  };

  return (
    <div className="flex flex-col h-full gap-4 p-5">
      <div className="flex justify-start items-center gap-3">
        <button
          className={`w-20 h-7 border-2 rounded-xl bg-transparent cursor-pointer text-base font-semibold flex items-center justify-center transition-all duration-300 ease-in-out hover:scale-105 ${
            isEnglish
              ? 'text-green-700 dark:text-green-400 border-green-700 dark:border-green-600 bg-green-50 dark:bg-green-900/20'
              : 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          }`}
          onClick={() => setIsEnglish(!isEnglish)}
        >
          {isEnglish ? 'EN' : '中'}
        </button>
      </div>
      <div className="max-h-[90%] relative flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 overflow-y-auto">
        <div className="flex flex-row gap-2">
          <div
            className="relative flex gap-2 pt-11 -mt-11"
            onMouseEnter={() => {
              setIsHoveringCopyAllGroup(true);
              updateButtonPosition();
            }}
            onMouseLeave={() => {
              setIsHoveringCopyAllGroup(false);
              updateButtonPosition();
            }}
          >
            <button
              ref={buttonRefs.copyAll}
              className={`flex items-center px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer transition-all duration-200 ease-in-out text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap select-none hover:bg-gray-50 dark:hover:bg-gray-600 hover:-translate-y-0.5 hover:shadow-md ${
                copyAllStatus === 'current' ? 'bg-green-500 dark:bg-green-600 border-green-500 dark:border-green-600 text-white hover:bg-green-600 dark:hover:bg-green-700' : ''
              }`}
              onClick={() => handleCopyAllWithStatus(isEnglish ? 'en' : 'cn', 'current')}
              title={`复制全部${isEnglish ? '英文' : '中文'}内容`}
            >
              <div className="flex items-center gap-1.5">
                {copyAllStatus === 'current' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span>复制全部{isEnglish ? '英文' : '中文'}</span>
              </div>
            </button>

            <button
              className={`fixed transition-all duration-300 ease-in-out bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 shadow-lg z-[1000] flex items-center px-4 py-2 rounded-lg cursor-pointer text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap select-none hover:bg-gray-50 dark:hover:bg-gray-600 hover:-translate-y-0.5 hover:shadow-xl ${
                isHoveringCopyAllGroup ? 'opacity-100 visible pointer-events-auto translate-y-0' : 'opacity-0 invisible pointer-events-none translate-y-2.5'
              } ${
                copyAllStatus === 'alternate' ? 'bg-green-500 dark:bg-green-600 border-green-500 dark:border-green-600 text-white hover:bg-green-600 dark:hover:bg-green-700' : ''
              }`}
              onClick={() => handleCopyAllWithStatus(isEnglish ? 'cn' : 'en', 'alternate')}
              title={`复制全部${isEnglish ? '中文' : '英文'}内容`}
              style={buttonPositions.copyAll}
            >
              <div className="flex items-center gap-1.5">
                {copyAllStatus === 'alternate' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Languages className="w-3.5 h-3.5 -ml-1" />
                )}
                <span>复制全部{isEnglish ? '中文' : '英文'}</span>
              </div>
            </button>
          </div>
          <div
            className="relative flex gap-2 pt-11 -mt-11 ml-auto w-min"
            onMouseEnter={() => {
              setIsHoveringCopyGroup(true);
              updateButtonPosition();
            }}
            onMouseLeave={() => {
              setIsHoveringCopyGroup(false);
              updateButtonPosition();
            }}
          >
            <button
              ref={buttonRefs.copy}
              className={`flex items-center px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer transition-all duration-200 ease-in-out text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap select-none hover:bg-gray-50 dark:hover:bg-gray-600 hover:-translate-y-0.5 hover:shadow-md ${
                isCopied === 'current' ? 'bg-green-500 dark:bg-green-600 border-green-500 dark:border-green-600 text-white hover:bg-green-600 dark:hover:bg-green-700' : ''
              }`}
              onClick={() => handleCopy(isEnglish ? summaryEn : summaryCn, 'current')}
              title={`复制${isEnglish ? '英文' : '中文'}内容`}
            >
              <div className="flex items-center gap-1.5">
                {isCopied === 'current' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Clipboard className="w-4 h-4" />
                )}
                <span>复制{isEnglish ? '英文' : '中文'}</span>
              </div>
            </button>

            <button
              className={`fixed transition-all duration-300 ease-in-out bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 shadow-lg z-[1000] flex items-center px-4 py-2 rounded-lg cursor-pointer text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap select-none hover:bg-gray-50 dark:hover:bg-gray-600 hover:-translate-y-0.5 hover:shadow-xl ${
                isHoveringCopyGroup ? 'opacity-100 visible pointer-events-auto translate-y-0' : 'opacity-0 invisible pointer-events-none translate-y-2.5'
              } ${
                isCopied === 'alternate' ? 'bg-green-500 dark:bg-green-600 border-green-500 dark:border-green-600 text-white hover:bg-green-600 dark:hover:bg-green-700' : ''
              }`}
              onClick={() => handleCopy(isEnglish ? summaryCn : summaryEn, 'alternate')}
              title={`复制${isEnglish ? '中文' : '英文'}内容`}
              style={buttonPositions.copy}
            >
              <div className="flex items-center gap-1.5">
                {isCopied === 'alternate' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Languages className="w-3.5 h-3.5 -ml-1" />
                )}
                <span>复制{isEnglish ? '中文' : '英文'}</span>
              </div>
            </button>
          </div>
        </div>
        <div className="prose prose-sm max-w-none dark:prose-invert [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:mt-4 [&_h3]:mb-2 [&_h4]:mt-4 [&_h4]:mb-2 [&_h5]:mt-4 [&_h5]:mb-2 [&_h6]:mt-4 [&_h6]:mb-2 [&_p]:my-2 [&_p]:leading-relaxed [&_ul]:pl-6 [&_ul]:my-2 [&_ol]:pl-6 [&_ol]:my-2 [&_code]:bg-gray-200 dark:[&_code]:bg-gray-700 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_pre]:bg-gray-100 dark:[&_pre]:bg-gray-800 [&_pre]:p-4 [&_pre]:rounded [&_pre]:overflow-x-auto [&_blockquote]:my-2 [&_blockquote]:pl-4 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 dark:[&_blockquote]:border-gray-600 [&_blockquote]:text-gray-600 dark:[&_blockquote]:text-gray-400 [&_table]:w-full [&_table]:border-separate [&_table]:border-spacing-0 [&_table]:my-4 [&_table]:text-sm [&_table]:rounded-lg [&_table]:overflow-hidden [&_table]:shadow-sm [&_th]:bg-gray-100 dark:[&_th]:bg-gray-800 [&_th]:text-gray-700 dark:[&_th]:text-gray-300 [&_th]:font-semibold [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:border-b-2 [&_th]:border-gray-200 dark:[&_th]:border-gray-700 [&_th]:whitespace-nowrap [&_td]:px-4 [&_td]:py-3 [&_td]:border-b [&_td]:border-gray-200 dark:[&_td]:border-gray-700 [&_td]:text-gray-600 dark:[&_td]:text-gray-400 [&_tr:last-child_td]:border-b-0 [&_tr:nth-child(even)]:bg-gray-50 dark:[&_tr:nth-child(even)]:bg-gray-800/50 [&_tr:hover]:bg-gray-100 dark:[&_tr:hover]:bg-gray-700 [&_td:first-child]:pl-5 [&_th:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th:last-child]:pr-5">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex, rehypeRaw]}
          >
            {isEnglish ? summaryEn : summaryCn}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default SummaryPanel;
