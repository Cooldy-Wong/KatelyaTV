'use client';

import { Shield, ShieldOff } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AdultContentFilterProps {
  userName: string;
  onUpdate?: (enabled: boolean) => void;
}

const AdultContentFilter: React.FC<AdultContentFilterProps> = ({ 
  userName, 
  onUpdate 
}) => {
  const [isEnabled, setIsEnabled] = useState(true); // 預設開啟過濾
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 獲取使用者設定
  useEffect(() => {
    const fetchUserSettings = async () => {
      if (!userName) return;
      
      try {
        const response = await fetch('/api/user/settings', {
          headers: {
            'Authorization': `Bearer ${userName}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setIsEnabled(data.settings.filter_adult_content);
        } else {
          setError('獲取使用者設定失敗');
        }
      } catch (err) {
        setError('網路連線失敗');
        // eslint-disable-next-line no-console
        console.error('Failed to fetch user settings:', err);
      }
    };

    fetchUserSettings();
  }, [userName]);

  // 更新使用者設定
  const handleToggle = async () => {
    if (!userName || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userName}`,
        },
        body: JSON.stringify({
          settings: {
            filter_adult_content: !isEnabled,
          },
        }),
      });

      if (response.ok) {
        const newState = !isEnabled;
        setIsEnabled(newState);
        
        // 強制重新整理使用者設定快取 - 向搜索API發送一個空請求來重新整理設定
        try {
          await fetch('/api/search?q=_cache_refresh_', {
            headers: {
              'Authorization': `Bearer ${userName}`,
            },
          });
        } catch {
          // 忽略重新整理快取的錯誤
        }
        
        onUpdate?.(newState);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '更新設定失敗');
      }
    } catch (err) {
      setError('網路連線失敗');
      // eslint-disable-next-line no-console
      console.error('Failed to update user settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900">
            {isEnabled ? (
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            ) : (
              <ShieldOff className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              成人內容過濾
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {isEnabled 
                ? '已開啟過濾，將自動隱藏所有標記為"成人"的資源站及其內容' 
                : '已關閉過濾，成人內容將在搜索結果中單獨分組顯示'
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={handleToggle}
            disabled={isLoading || !userName}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed
              ${isEnabled 
                ? 'bg-blue-600' 
                : 'bg-gray-200 dark:bg-gray-700'
              }
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${isEnabled ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
          
          {isLoading && (
            <div className="w-5 h-5">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="ml-3">
            <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
              安全提示
            </h4>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              爲了確保良好的使用體驗和遵守相關法規，建議保持成人內容過濾開啟。如需訪問相關內容，請確保您已年滿18週歲並承擔相應法律責任。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdultContentFilter;
