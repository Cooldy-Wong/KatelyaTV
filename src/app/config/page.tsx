'use client';

import { useCallback, useState } from 'react';

export const dynamic = 'force-dynamic';

export default function ConfigPage() {
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<'json' | 'base64'>('json');

  const getConfigUrl = useCallback(() => {
    if (typeof window === 'undefined') return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/tvbox?format=${format}`;
  }, [format]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getConfigUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Copy failed silently
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          TVBox 配置
        </h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            配置鏈接
          </h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              格式型別
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'json' | 'base64')}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="json">JSON 格式</option>
              <option value="base64">Base64 格式</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={getConfigUrl()}
              className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
            />
            <button
              onClick={handleCopy}
              className={`px-4 py-3 rounded-md font-medium transition-colors ${
                copied
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {copied ? '已複製' : '複製'}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            使用說明
          </h2>
          
          <div className="space-y-4 text-gray-700 dark:text-gray-300">
            <div>
              <h3 className="font-semibold text-lg mb-2">1. 獲取配置鏈接</h3>
              <p>複製上方的配置鏈接，支援 JSON 和 Base64 兩種格式。</p>
            </div>
            
            <div>
              <h3 className="font-semibold text-lg mb-2">2. 匯入 TVBox</h3>
              <p>打開 TVBox 應用，在配置管理中新增新的介面配置，貼上複製的鏈接。</p>
            </div>
            
            <div>
              <h3 className="font-semibold text-lg mb-2">3. 開始使用</h3>
              <p>配置匯入成功后，即可在 TVBox 中瀏覽和觀看本站的視訊內容。</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            支援功能
          </h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">視訊解析</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• 支援多種視訊源</li>
                <li>• 自動解析視訊鏈接</li>
                <li>• 高清視訊播放</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">相容性</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• 完全相容 TVBox</li>
                <li>• 支援自定義配置</li>
                <li>• 實時更新內容</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
