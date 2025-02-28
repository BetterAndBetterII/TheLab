import React, { useState } from 'react';
import styles from './Search.module.css';
import { FiSearch } from 'react-icons/fi';

export default function Search() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      // TODO: 实现实际的搜索逻辑，连接后端API
      const mockResults = [
        { id: 1, title: '示例文档1', excerpt: '这是一个示例搜索结果...' },
        { id: 2, title: '示例文档2', excerpt: '这是另一个示例搜索结果...' },
      ];
      setSearchResults(mockResults);
    } catch (error) {
      console.error('搜索出错:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.searchContainer}>
      <div className={styles.searchHeader}>
        <h1>全局搜索</h1>
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <div className={styles.searchInputWrapper}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="输入关键词进行搜索..."
              className={styles.searchInput}
            />
            <button type="submit" className={styles.searchButton}>
              <FiSearch size={20} />
              搜索
            </button>
          </div>
        </form>
      </div>

      <div className={styles.searchResults}>
        {isLoading ? (
          <div className={styles.loading}>搜索中...</div>
        ) : (
          <>
            {searchResults.length > 0 ? (
              <div className={styles.resultsList}>
                {searchResults.map((result) => (
                  <div key={result.id} className={styles.resultItem}>
                    <h3>{result.title}</h3>
                    <p>{result.excerpt}</p>
                  </div>
                ))}
              </div>
            ) : searchQuery && (
              <div className={styles.noResults}>
                未找到相关结果
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
