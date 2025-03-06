import React, { useState } from 'react';
import styles from './Search.module.css';
import { FiSearch, FiFileText, FiExternalLink, FiPercent, FiSettings } from 'react-icons/fi';
import { searchApi, type SearchResult } from '../../api/search';

export default function Search() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

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
        mode: searchMode
      });
      setSearchResults(response.results);
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
    <div className={styles.searchContainer}>
      <div className={styles.searchHeader}>
        <h1>智能文档搜索</h1>
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <div className={styles.searchInputWrapper}>
            <div className={styles.searchInputContainer}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="输入关键词搜索文档内容..."
                className={styles.searchInput}
              />
              <button
                type="button"
                className={styles.optionsButton}
                onClick={() => setShowOptions(!showOptions)}
                title="搜索选项"
              >
                <FiSettings size={20} className={showOptions ? styles.active : ''} />
              </button>
            </div>
            <button type="submit" className={styles.searchButton} disabled={isLoading}>
              <FiSearch size={20} />
              {isLoading ? '搜索中...' : '搜索'}
            </button>
          </div>

          {showOptions && (
            <div className={styles.searchOptions}>
              <div className={styles.optionGroup}>
                <label>搜索模式:</label>
                <select
                  value={searchMode}
                  onChange={(e) => setSearchMode(e.target.value as typeof searchMode)}
                  className={styles.select}
                >
                  <option value="hybrid">混合搜索</option>
                  <option value="text_search">文本搜索</option>
                  <option value="sparse">稀疏搜索</option>
                </select>
              </div>

              <div className={styles.optionGroup}>
                <label>返回结果数:</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className={styles.numberInput}
                />
              </div>

              <div className={styles.optionGroup}>
                <label>
                  <input
                    type="checkbox"
                    checked={useRerank}
                    onChange={(e) => setUseRerank(e.target.checked)}
                    className={styles.checkbox}
                  />
                  启用重排序
                </label>
              </div>
            </div>
          )}
        </form>
      </div>

      <div className={styles.searchResults}>
        {isLoading ? (
          <div className={styles.loading}>
            <div className={styles.loadingSpinner} />
            正在搜索相关内容...
          </div>
        ) : (
          <>
            {searchResults.length > 0 ? (
              <div className={styles.resultsList}>
                {searchResults.map((result, index) => (
                  <div key={index} className={styles.resultItem}>
                    <div className={styles.resultHeader}>
                      {result.metadata.title && (
                        <h3>
                          <FiFileText className={styles.icon} />
                          {result.metadata.title}
                        </h3>
                      )}
                      <div className={styles.score}>
                        <FiPercent className={styles.icon} />
                        {(result.score * 100).toFixed(1)}% 相关
                      </div>
                    </div>

                    <p>{truncateText(result.text)}</p>

                    <div className={styles.resultFooter}>
                      <div className={styles.resultMeta}>
                        {result.metadata.source && (
                          <span className={styles.source}>
                            来源: {result.metadata.source}
                          </span>
                        )}
                      </div>
                      <a
                        href={`/chat/${result.doc_id}`}
                        className={styles.sourceLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        查看完整文档
                        <FiExternalLink size={16} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : searchQuery && (
              <div className={styles.noResults}>
                <FiSearch size={24} />
                <p>未找到相关结果</p>
                <span>请尝试使用其他关键词搜索</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
