/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any */
'use client';

import { ChevronUp, Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import {
  addSearchHistory,
  clearSearchHistory,
  deleteSearchHistory,
  getSearchHistory,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { SearchResult } from '@/lib/types';

import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

function SearchPageClient() {
  // 搜索歷史
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  // 返回頂部按鈕顯示狀態
  const [showBackToTop, setShowBackToTop] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  
  // 分組結果狀態
  const [groupedResults, setGroupedResults] = useState<{
    regular: SearchResult[];
    adult: SearchResult[];
  } | null>(null);
  
  // 分組標籤頁狀態
  const [activeTab, setActiveTab] = useState<'regular' | 'adult'>('regular');

  // 獲取預設聚合設定：只讀取使用者本地設定，預設為 true
  const getDefaultAggregate = () => {
    if (typeof window !== 'undefined') {
      const userSetting = localStorage.getItem('defaultAggregateSearch');
      if (userSetting !== null) {
        return JSON.parse(userSetting);
      }
    }
    return true; // 預設啟用聚合
  };

  const [viewMode, setViewMode] = useState<'agg' | 'all'>(() => {
    return getDefaultAggregate() ? 'agg' : 'all';
  });

  // 聚合函式
  const aggregateResults = (results: SearchResult[]) => {
    const map = new Map<string, SearchResult[]>();
    results.forEach((item) => {
      // 使用 title + year + type 作為鍵
      const key = `${item.title.replaceAll(' ', '')}-${
        item.year || 'unknown'
      }-${item.episodes.length === 1 ? 'movie' : 'tv'}`;
      const arr = map.get(key) || [];
      arr.push(item);
      map.set(key, arr);
    });
    return Array.from(map.entries()).sort((a, b) => {
      // 優先排序：標題與搜索詞完全一致的排在前面
      const aExactMatch = a[1][0].title
        .replaceAll(' ', '')
        .includes(searchQuery.trim().replaceAll(' ', ''));
      const bExactMatch = b[1][0].title
        .replaceAll(' ', '')
        .includes(searchQuery.trim().replaceAll(' ', ''));

      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;

      // 年份排序
      if (a[1][0].year === b[1][0].year) {
        return a[0].localeCompare(b[0]);
      } else {
        const aYear = a[1][0].year;
        const bYear = b[1][0].year;

        if (aYear === 'unknown' && bYear === 'unknown') {
          return 0;
        } else if (aYear === 'unknown') {
          return 1;
        } else if (bYear === 'unknown') {
          return -1;
        } else {
          return aYear > bYear ? -1 : 1;
        }
      }
    });
  };

  useEffect(() => {
    // 無搜索參數時聚焦搜索框
    !searchParams.get('q') && document.getElementById('searchInput')?.focus();

    // 初始載入搜索歷史
    getSearchHistory().then(setSearchHistory);

    // 監聽搜索歷史更新事件
    const unsubscribe = subscribeToDataUpdates(
      'searchHistoryUpdated',
      (newHistory: string[]) => {
        setSearchHistory(newHistory);
      }
    );

    // 獲取滾動位置的函式 - 專門針對 body 滾動
    const getScrollTop = () => {
      return document.body.scrollTop || 0;
    };

    // 使用 requestAnimationFrame 持續檢測滾動位置
    let isRunning = false;
    const checkScrollPosition = () => {
      if (!isRunning) return;

      const scrollTop = getScrollTop();
      const shouldShow = scrollTop > 300;
      setShowBackToTop(shouldShow);

      requestAnimationFrame(checkScrollPosition);
    };

    // 啟動持續檢測
    isRunning = true;
    checkScrollPosition();

    // 監聽 body 元素的滾動事件
    const handleScroll = () => {
      const scrollTop = getScrollTop();
      setShowBackToTop(scrollTop > 300);
    };

    document.body.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      unsubscribe();
      isRunning = false; // 停止 requestAnimationFrame 循環

      // 移除 body 滾動事件監聽器
      document.body.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    // 當搜索參數變化時更新搜索狀態
    const query = searchParams.get('q');
    if (query) {
      setSearchQuery(query);
      fetchSearchResults(query);

      // 儲存到搜索歷史 (事件監聽會自動更新界面)
      addSearchHistory(query);
    } else {
      setShowResults(false);
    }
  }, [searchParams]);

  const fetchSearchResults = async (query: string) => {
    try {
      setIsLoading(true);
      
      // 獲取使用者認證資訊
      const authInfo = getAuthInfoFromBrowserCookie();
      
      // 構建請求頭
      const headers: HeadersInit = {};
      if (authInfo?.username) {
        headers['Authorization'] = `Bearer ${authInfo.username}`;
      }
      
      // 簡化的搜索請求 - 成人內容過濾現在在API層面自動處理
      // 新增時間戳參數避免快取問題
      const timestamp = Date.now();
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query.trim())}&t=${timestamp}`, 
        { 
          headers: {
            ...headers,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      );
      const data = await response.json();
      
      // 處理新的搜索結果格式
      if (data.regular_results || data.adult_results) {
        // 處理分組結果
        setGroupedResults({
          regular: data.regular_results || [],
          adult: data.adult_results || []
        });
        setSearchResults([...(data.regular_results || []), ...(data.adult_results || [])]);
      } else if (data.grouped) {
        // 相容舊的分組格式
        setGroupedResults({
          regular: data.regular || [],
          adult: data.adult || []
        });
        setSearchResults([...(data.regular || []), ...(data.adult || [])]);
      } else {
        // 相容舊的普通結果格式
        setGroupedResults(null);
        setSearchResults(data.results || []);
      }
      
      setShowResults(true);
    } catch (error) {
      setGroupedResults(null);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim().replace(/\s+/g, ' ');
    if (!trimmed) return;

    // 回顯搜索框
    setSearchQuery(trimmed);
    setIsLoading(true);
    setShowResults(true);

    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    // 直接發請求
    fetchSearchResults(trimmed);

    // 儲存到搜索歷史 (事件監聽會自動更新界面)
    addSearchHistory(trimmed);
  };

  // 返回頂部功能
  const scrollToTop = () => {
    try {
      // 根據除錯結果，真正的滾動容器是 document.body
      document.body.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } catch (error) {
      // 如果平滑滾動完全失敗，使用立即滾動
      document.body.scrollTop = 0;
    }
  };

  return (
    <PageLayout activePath='/search'>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible mb-10'>
        {/* 搜索框 */}
        <div className='mb-8'>
          <form onSubmit={handleSearch} className='max-w-2xl mx-auto'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500' />
              <input
                id='searchInput'
                type='text'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='搜索電影、電視劇...'
                className='w-full h-12 rounded-lg bg-gray-50/80 py-3 pl-10 pr-4 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white border border-gray-200/50 shadow-sm dark:bg-gray-800 dark:text-gray-300 dark:placeholder-gray-500 dark:focus:bg-gray-700 dark:border-gray-700'
              />
            </div>
          </form>
        </div>

        {/* 搜索結果或搜索歷史 */}
        <div className='max-w-[95%] mx-auto mt-12 overflow-visible'>
          {isLoading ? (
            <div className='flex justify-center items-center h-40'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-green-500'></div>
            </div>
          ) : showResults ? (
            <section className='mb-12'>
              {/* 標題 + 聚合開關 */}
              <div className='mb-8 flex items-center justify-between'>
                <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                  搜索結果
                </h2>
                {/* 聚合開關 */}
                <label className='flex items-center gap-2 cursor-pointer select-none'>
                  <span className='text-sm text-gray-700 dark:text-gray-300'>
                    聚合
                  </span>
                  <div className='relative'>
                    <input
                      type='checkbox'
                      className='sr-only peer'
                      checked={viewMode === 'agg'}
                      onChange={() =>
                        setViewMode(viewMode === 'agg' ? 'all' : 'agg')
                      }
                    />
                    <div className='w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                    <div className='absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4'></div>
                  </div>
                </label>
              </div>
              
              {/* 如果有分組結果且有成人內容，顯示分組標籤 */}
              {groupedResults && groupedResults.adult.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-center mb-4">
                    <div className="inline-flex p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <button
                        onClick={() => setActiveTab('regular')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          activeTab === 'regular'
                            ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                      >
                        常規結果 ({groupedResults.regular.length})
                      </button>
                      <button
                        onClick={() => setActiveTab('adult')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          activeTab === 'adult'
                            ? 'bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                      >
                        成人內容 ({groupedResults.adult.length})
                      </button>
                    </div>
                  </div>
                  {activeTab === 'adult' && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                      <p className="text-sm text-red-600 dark:text-red-400 text-center">
                        ⚠️ 以下內容可能包含成人資源，請確保您已年滿18週歲
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div
                key={`search-results-${viewMode}-${activeTab}`}
                className='justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8'
              >
                {(() => {
                  // 確定要顯示的結果
                  let displayResults = searchResults;
                  if (groupedResults && groupedResults.adult.length > 0) {
                    displayResults = activeTab === 'adult' 
                      ? groupedResults.adult 
                      : groupedResults.regular;
                  }

                  // 聚合顯示模式
                  if (viewMode === 'agg') {
                    const aggregated = aggregateResults(displayResults);
                    return aggregated.map(([mapKey, group]: [string, SearchResult[]]) => (
                      <div key={`agg-${mapKey}`} className='w-full'>
                        <VideoCard
                          from='search'
                          items={group}
                          query={
                            searchQuery.trim() !== group[0].title
                              ? searchQuery.trim()
                              : ''
                          }
                        />
                      </div>
                    ));
                  }

                  // 列表顯示模式
                  return displayResults.map((item) => (
                    <div
                      key={`all-${item.source}-${item.id}`}
                      className='w-full'
                    >
                      <VideoCard
                        id={item.id}
                        title={item.title}
                        poster={item.poster}
                        episodes={item.episodes.length}
                        source={item.source}
                        source_name={item.source_name}
                        douban_id={item.douban_id?.toString()}
                        query={
                          searchQuery.trim() !== item.title
                            ? searchQuery.trim()
                            : ''
                        }
                        year={item.year}
                        from='search'
                        type={item.episodes.length > 1 ? 'tv' : 'movie'}
                      />
                    </div>
                  ));
                })()}
                {searchResults.length === 0 && (
                  <div className='col-span-full text-center text-gray-500 py-8 dark:text-gray-400'>
                    未找到相關結果
                  </div>
                )}
              </div>
            </section>
          ) : searchHistory.length > 0 ? (
            // 搜索歷史
            <section className='mb-12'>
              <h2 className='mb-4 text-xl font-bold text-gray-800 text-left dark:text-gray-200'>
                搜索歷史
                {searchHistory.length > 0 && (
                  <button
                    onClick={() => {
                      clearSearchHistory(); // 事件監聽會自動更新界面
                    }}
                    className='ml-3 text-sm text-gray-500 hover:text-red-500 transition-colors dark:text-gray-400 dark:hover:text-red-500'
                  >
                    清空
                  </button>
                )}
              </h2>
              <div className='flex flex-wrap gap-2'>
                {searchHistory.map((item) => (
                  <div key={item} className='relative group'>
                    <button
                      onClick={() => {
                        setSearchQuery(item);
                        router.push(
                          `/search?q=${encodeURIComponent(item.trim())}`
                        );
                      }}
                      className='px-4 py-2 bg-gray-500/10 hover:bg-gray-300 rounded-full text-sm text-gray-700 transition-colors duration-200 dark:bg-gray-700/50 dark:hover:bg-gray-600 dark:text-gray-300'
                    >
                      {item}
                    </button>
                    {/* 刪除按鈕 */}
                    <button
                      aria-label='刪除搜索歷史'
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        deleteSearchHistory(item); // 事件監聽會自動更新界面
                      }}
                      className='absolute -top-1 -right-1 w-4 h-4 opacity-0 group-hover:opacity-100 bg-gray-400 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] transition-colors'
                    >
                      <X className='w-3 h-3' />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {/* 返回頂部懸浮按鈕 */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-20 md:bottom-6 right-6 z-[500] w-12 h-12 bg-green-500/90 hover:bg-green-500 text-white rounded-full shadow-lg backdrop-blur-sm transition-all duration-300 ease-in-out flex items-center justify-center group ${
          showBackToTop
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-label='返回頂部'
      >
        <ChevronUp className='w-6 h-6 transition-transform group-hover:scale-110' />
      </button>
    </PageLayout>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageClient />
    </Suspense>
  );
}
