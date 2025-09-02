import React, { useState } from 'react';
import { Search as SearchIcon, FileText, ExternalLink, Percent, Settings } from 'lucide-react';
import { searchApi, type SearchResult } from '../../api/search';

export default function Search() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // 搜索选项
  const [searchMode, setSearchMode] = useState<'hybrid' | 'text_search' | 'sparse'>('hybrid');
  const [topK, setTopK] = useState(10);
  const [useRerank, setUseRerank] = useState(true);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const response = await searchApi.search({
        query: searchQuery,
        top_k: topK,
        rerank: useRerank,
        mode: searchMode,
      });
      setSearchResults(response.results);
      setHasSearched(true);
    } catch (error) {
      console.error('搜索出错:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const truncateText = (text: string, maxLength: number = 300) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 min-h-screen">
        <div className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
            智能文档搜索
          </h1>
          <form onSubmit={handleSearch} className="max-w-3xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-2 bg-white dark:bg-gray-800 p-2 rounded-xl shadow-sm">
              <div className="flex-1 flex items-center gap-2 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!e.target.value.trim()) {
                      setHasSearched(false);
                      setSearchResults([]);
                    }
                  }}
                  placeholder="输入关键词搜索文档内容..."
                  className="w-full p-3 sm:p-4 text-base sm:text-lg bg-transparent dark:text-gray-100 outline-none"
                />
                <button
                  type="button"
                  className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => setShowOptions(!showOptions)}
                  title="搜索选项"
                >
                  <Settings
                    size={20}
                    className={`transition-transform duration-300 ${
                      showOptions ? 'rotate-90' : ''
                    }`}
                  />
                </button>
              </div>
              <button
                type="submit"
                className="flex items-center justify-center gap-2 px-6 py-3 text-base font-medium text-white bg-blue-600 rounded-lg cursor-pointer hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
                disabled={isLoading}
              >
                <SearchIcon size={20} />
                {isLoading ? '搜索中...' : '搜索'}
              </button>
            </div>

            {showOptions && (
              <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md transition-all duration-300 animate-fadeInUp">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-4">
                    <label className="min-w-[100px] text-gray-600 dark:text-gray-300 text-sm">
                      搜索模式:
                    </label>
                    <select
                      value={searchMode}
                      onChange={(e) =>
                        setSearchMode(e.target.value as typeof searchMode)
                      }
                      className="flex-1 p-2 border border-gray-200 dark:border-gray-700 rounded-md outline-none text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800/50 cursor-pointer transition-colors hover:border-blue-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="hybrid">混合搜索</option>
                      <option value="text_search">文本搜索</option>
                      <option value="sparse">稀疏搜索</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="min-w-[100px] text-gray-600 dark:text-gray-300 text-sm">
                      返回结果数:
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={topK}
                      onChange={(e) => setTopK(Number(e.target.value))}
                      className="w-20 p-2 border border-gray-200 dark:border-gray-700 rounded-md outline-none text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800/50 transition-colors hover:border-blue-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <input
                    id="rerank-checkbox"
                    type="checkbox"
                    checked={useRerank}
                    onChange={(e) => setUseRerank(e.target.checked)}
                    className="w-4 h-4 rounded cursor-pointer accent-blue-600"
                  />
                  <label
                    htmlFor="rerank-checkbox"
                    className="text-gray-600 dark:text-gray-300 text-sm cursor-pointer"
                  >
                    启用重排序
                  </label>
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="mt-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-16 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
              <div className="w-10 h-10 mb-4 border-4 border-gray-200 dark:border-gray-600 border-t-blue-600 rounded-full animate-spin" />
              <p className="dark:text-gray-300">正在搜索相关内容...</p>
            </div>
          ) : (
            <>
              {searchResults.length > 0 ? (
                <div className="grid gap-6">
                  {searchResults.map((result, index) => (
                    <div
                      key={index}
                      className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <div className="flex justify-between items-start mb-3">
                        {result.metadata.title && (
                          <h3 className="flex items-center gap-2 m-0 text-lg font-semibold text-gray-900 dark:text-gray-100">
                            <FileText
                              className="text-gray-500 dark:text-gray-400"
                              size={18}
                            />
                            {result.metadata.title}
                          </h3>
                        )}
                        <div className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-600 dark:text-gray-300">
                          <Percent
                            className="text-gray-500 dark:text-gray-400"
                            size={16}
                          />
                          {(result.score * 100).toFixed(1)}% 相关
                        </div>
                      </div>

                      <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-base mb-4">
                        {truncateText(result.text)}
                      </p>

                      <div className="flex flex-col sm:flex-row justify-between items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-2 sm:mb-0">
                          {result.metadata.source && (
                            <span className="inline-flex items-center gap-1">
                              来源: {result.metadata.source}
                            </span>
                          )}
                        </div>
                        <a
                          href={`/chat/${result.doc_id}`}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 no-underline transition-colors hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          查看完整文档
                          <ExternalLink size={16} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                hasSearched && (
                  <div className="flex flex-col items-center gap-4 p-16 text-center">
                    <SearchIcon
                      size={32}
                      className="text-gray-400 dark:text-gray-500 mb-2"
                    />
                    <p className="text-xl font-medium m-0 text-gray-800 dark:text-gray-200">
                      未找到相关结果
                    </p>
                    <span className="text-gray-500 dark:text-gray-400">
                      请尝试使用其他关键词搜索
                    </span>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
