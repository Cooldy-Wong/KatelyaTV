'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

interface PaginatedRowProps {
  children: React.ReactNode[];
  itemsPerPage?: number;
  className?: string;
  onLoadMore?: () => Promise<void>; // 新增：載入更多數據的回撥函式
  hasMoreData?: boolean; // 新增：是否還有更多數據可載入
  isLoading?: boolean; // 新增：是否正在載入中
}

export default function PaginatedRow({
  children,
  itemsPerPage = 10,
  className = '',
  onLoadMore,
  hasMoreData = true,
  isLoading = false,
}: PaginatedRowProps) {
  const [startIndex, setStartIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const uniqueId = useId(); // 為每個實例產生唯一ID

  // 獲取目前顯示的專案 - 支援無限向前瀏覽
  const currentItems = useMemo(() => {
    const endIndex = startIndex + itemsPerPage;
    // 如果超出範圍，循環顯示
    if (endIndex <= children.length) {
      return children.slice(startIndex, endIndex);
    } else {
      // 當超出範圍時，從頭開始循環
      const firstPart = children.slice(startIndex);
      const secondPart = children.slice(0, endIndex - children.length);
      return [...firstPart, ...secondPart];
    }
  }, [children, startIndex, itemsPerPage]);

  // 向前翻頁 - 禁止超出第一頁
  const handlePrevPage = () => {
    setStartIndex((prev) => {
      const newIndex = prev - itemsPerPage;
      return newIndex < 0 ? 0 : newIndex; // 不允許小於0
    });
  };

  // 向後翻頁 - 支援動態載入更多數據
  const handleNextPage = async () => {
    const newIndex = startIndex + itemsPerPage;
    
    // 如果即將超出目前數據範圍，且有更多數據可載入，且有載入回撥函式
    if (newIndex >= children.length && hasMoreData && onLoadMore && !isLoading) {
      try {
        await onLoadMore(); // 載入更多數據
        // 載入完成後，直接設定到下一頁
        setStartIndex(newIndex);
      } catch (error) {
        // 靜默處理載入錯誤，保持使用者體驗
      }
    } else if (newIndex < children.length) {
      // 如果還在目前數據範圍內，直接翻頁
      setStartIndex(newIndex);
    } else {
      // 如果沒有更多數據可載入，循環回到第一頁
      setStartIndex(0);
    }
  };

  // 檢查是否可以向前翻頁
  const canGoPrev = startIndex > 0;
  // 檢查是否可以向後翻頁：有更多數據或者目前不在最後一頁
  const canGoNext = children.length > itemsPerPage && (startIndex + itemsPerPage < children.length || hasMoreData || startIndex + itemsPerPage >= children.length);

  // 如果沒有足夠的內容需要分頁，就不顯示按鈕
  const needsPagination = children.length > itemsPerPage;

  return (
    <div
      className={`relative ${className}`}
      data-paginated-row={uniqueId}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 內容區域 - 移除group類以避免懸停效果衝突 */}
      <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 relative'>
        {currentItems}

        {/* 改進的導航按鈕 - 僅在容器懸停時顯示 */}
        {needsPagination && (
          <>
            {/* 左箭頭按鈕 - 只有不在第一頁時才顯示 */}
            {canGoPrev && (
              <button
                onClick={handlePrevPage}
                className={`absolute -left-12 z-20 w-10 h-10 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                  isHovered ? 'opacity-100' : 'opacity-0'
                }`}
                style={{
                  // 確保按鈕在兩行中間
                  top: 'calc(50% - 20px)',
                }}
                aria-label='上一頁'
              >
                <ChevronLeft className='w-5 h-5 text-white' />
              </button>
            )}

            {/* 右箭頭按鈕 - 總是顯示，支援動態載入 */}
            {canGoNext && (
              <button
                onClick={handleNextPage}
                disabled={isLoading}
                className={`absolute -right-12 z-20 w-10 h-10 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isHovered ? 'opacity-100' : 'opacity-0'
                }`}
                style={{
                  // 確保按鈕在兩行中間
                  top: 'calc(50% - 20px)',
                }}
                aria-label={isLoading ? '載入中...' : '下一頁'}
              >
                {isLoading ? (
                  <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin' />
                ) : (
                  <ChevronRight className='w-5 h-5 text-white' />
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* 移除頁碼指示器 - 不再需要 */}
    </div>
  );
}
