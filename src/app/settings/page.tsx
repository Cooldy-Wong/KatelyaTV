'use client';

import { ArrowLeft, Settings, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import AdultContentFilter from '@/components/AdultContentFilter';

export default function UserSettingsPage() {
  const router = useRouter();
  const [authInfo, setAuthInfo] = useState<{ userName: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const auth = getAuthInfoFromBrowserCookie();
    if (!auth || !auth.username) {
      // 如果使用者未登錄，重定向到登錄頁面
      router.push('/login');
      return;
    }
    setAuthInfo({ userName: auth.username });
    setIsLoading(false);
  }, [router]);

  const handleFilterUpdate = (_enabled: boolean) => {
    // 可以在這裡新增一些全域性狀態更新或通知邏輯
    // console.log('成人內容過濾狀態已更新:', enabled);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!authInfo) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        {/* 頁面頭部 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
                <Settings className="w-8 h-8 mr-3 text-blue-600" />
                使用者設定
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                管理您的個人偏好設定和隱私選項
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {authInfo.userName}
            </span>
          </div>
        </div>

        {/* 設定區域 */}
        <div className="space-y-6">
          {/* 內容過濾設定 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              內容過濾
            </h2>
            <AdultContentFilter 
              userName={authInfo.userName} 
              onUpdate={handleFilterUpdate}
            />
          </div>

          {/* 其他設定部分預留 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              其他設定
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                更多設定選項即將推出...
              </p>
            </div>
          </div>
        </div>

        {/* 底部資訊 */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>設定會自動儲存並在所有裝置間同步</p>
        </div>
      </div>
    </div>
  );
}
