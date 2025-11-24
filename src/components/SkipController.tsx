/* eslint-disable @typescript-eslint/no-explicit-any, no-console */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  deleteSkipConfig,
  EpisodeSkipConfig,
  getSkipConfig,
  saveSkipConfig,
  SkipSegment,
} from '@/lib/db.client';

interface SkipControllerProps {
  source: string;
  id: string;
  title: string;
  artPlayerRef: React.MutableRefObject<any>;
  currentTime?: number;
  duration?: number;
  isSettingMode?: boolean;
  onSettingModeChange?: (isOpen: boolean) => void;
  onNextEpisode?: () => void; // 新增：跳轉下一集的回撥
}

export default function SkipController({
  source,
  id,
  title,
  artPlayerRef,
  currentTime = 0,
  duration = 0,
  isSettingMode = false,
  onSettingModeChange,
  onNextEpisode,
}: SkipControllerProps) {
  const [skipConfig, setSkipConfig] = useState<EpisodeSkipConfig | null>(null);
  const [showSkipButton, setShowSkipButton] = useState(false);
  const [currentSkipSegment, setCurrentSkipSegment] = useState<SkipSegment | null>(null);
  const [newSegment, setNewSegment] = useState<Partial<SkipSegment>>({});
  
  // 新增狀態：批量設定模式 - 支援分:秒格式
  const [batchSettings, setBatchSettings] = useState({
    openingStart: '0:00',   // 片頭開始時間（分:秒格式）
    openingEnd: '1:30',     // 片頭結束時間（分:秒格式，90秒=1分30秒）
    endingMode: 'remaining', // 片尾模式：'remaining'(剩餘時間) 或 'absolute'(絕對時間)
    endingStart: '2:00',    // 片尾開始時間（剩餘時間模式：還剩多少時間開始倒計時；絕對時間模式：從視訊開始多長時間）
    endingEnd: '',          // 片尾結束時間（可選，空表示直接跳轉下一集）
    autoSkip: true,         // 自動跳過開關
    autoNextEpisode: true,  // 自動下一集開關
  });
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(0);

  const lastSkipTimeRef = useRef<number>(0);
  const skipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoSkipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 時間格式轉換函式
  const timeToSeconds = useCallback((timeStr: string): number => {
    if (!timeStr || timeStr.trim() === '') return 0;
    
    // 支援多種格式: "2:10", "2:10.5", "130", "130.5"
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      const minutes = parseInt(parts[0]) || 0;
      const seconds = parseFloat(parts[1]) || 0;
      return minutes * 60 + seconds;
    } else {
      return parseFloat(timeStr) || 0;
    }
  }, []);

  const secondsToTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const decimal = seconds % 1;
    if (decimal > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}.${Math.floor(decimal * 10)}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // 載入跳過配置
  const loadSkipConfig = useCallback(async () => {
    try {
      const config = await getSkipConfig(source, id);
      setSkipConfig(config);
    } catch (err) {
      console.error('載入跳過配置失敗:', err);
    }
  }, [source, id]);

  // 自動跳過邏輯
  const handleAutoSkip = useCallback((segment: SkipSegment) => {
    if (!artPlayerRef.current) return;

    const targetTime = segment.end + 1;
    artPlayerRef.current.currentTime = targetTime;
    lastSkipTimeRef.current = Date.now();

    // 顯示跳過提示
    if (artPlayerRef.current.notice) {
      const segmentName = segment.type === 'opening' ? '片頭' : '片尾';
      artPlayerRef.current.notice.show = `自動跳過${segmentName}`;
    }
    
    setCurrentSkipSegment(null);
  }, [artPlayerRef]);

  // 開始片尾倒計時
  const startEndingCountdown = useCallback((seconds: number) => {
    setShowCountdown(true);
    setCountdownSeconds(seconds);

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    countdownIntervalRef.current = setInterval(() => {
      setCountdownSeconds(prev => {
        if (prev <= 1) {
          // 倒計時結束，跳轉下一集
          if (onNextEpisode) {
            onNextEpisode();
          }
          setShowCountdown(false);
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [onNextEpisode]);

  // 檢查片尾倒計時
  const checkEndingCountdown = useCallback((time: number) => {
    if (!skipConfig?.segments?.length || !duration || !onNextEpisode) return;

    const endingSegments = skipConfig.segments.filter(s => s.type === 'ending' && s.autoNextEpisode !== false);
    if (!endingSegments.length) return;

    for (const segment of endingSegments) {
      const timeToEnd = duration - time;
      const timeToSegmentStart = duration - segment.start;
      
      // 當距離視訊結束的時間等於設定的片尾開始時間時，開始倒計時
      if (timeToEnd <= timeToSegmentStart && timeToEnd > 0 && !showCountdown) {
        startEndingCountdown(Math.ceil(timeToEnd));
        break;
      }
    }
  }, [skipConfig, duration, onNextEpisode, showCountdown, startEndingCountdown]);

  // 檢查目前播放時間是否在跳過區間內
  const checkSkipSegment = useCallback(
    (time: number) => {
      if (!skipConfig?.segments?.length) return;

      const currentSegment = skipConfig.segments.find(
        (segment) => time >= segment.start && time <= segment.end
      );

      if (currentSegment && currentSegment !== currentSkipSegment) {
        setCurrentSkipSegment(currentSegment);
        
        // 檢查是否開啟自動跳過
        const hasAutoSkipSetting = skipConfig.segments.some(s => s.autoSkip !== false);
        
        if (hasAutoSkipSetting) {
          // 自動跳過：延遲1秒執行跳過
          if (autoSkipTimeoutRef.current) {
            clearTimeout(autoSkipTimeoutRef.current);
          }
          autoSkipTimeoutRef.current = setTimeout(() => {
            handleAutoSkip(currentSegment);
          }, 1000);
          
          setShowSkipButton(false); // 自動跳過時不顯示按鈕
        } else {
          // 手動模式：顯示跳過按鈕
          setShowSkipButton(true);
          
          // 自動隱藏跳過按鈕
          if (skipTimeoutRef.current) {
            clearTimeout(skipTimeoutRef.current);
          }
          skipTimeoutRef.current = setTimeout(() => {
            setShowSkipButton(false);
            setCurrentSkipSegment(null);
          }, 8000);
        }
      } else if (!currentSegment && currentSkipSegment) {
        setCurrentSkipSegment(null);
        setShowSkipButton(false);
        if (skipTimeoutRef.current) {
          clearTimeout(skipTimeoutRef.current);
        }
        if (autoSkipTimeoutRef.current) {
          clearTimeout(autoSkipTimeoutRef.current);
        }
      }

      // 檢查片尾倒計時
      checkEndingCountdown(time);
    },
    [skipConfig, currentSkipSegment, handleAutoSkip, checkEndingCountdown]
  );

  // 執行跳過
  const handleSkip = useCallback(() => {
    if (!currentSkipSegment || !artPlayerRef.current) return;

    const targetTime = currentSkipSegment.end + 1; // 跳到片段結束后1秒
    artPlayerRef.current.currentTime = targetTime;
    lastSkipTimeRef.current = Date.now();

    setShowSkipButton(false);
    setCurrentSkipSegment(null);

    if (skipTimeoutRef.current) {
      clearTimeout(skipTimeoutRef.current);
    }

    // 顯示跳過提示
    if (artPlayerRef.current.notice) {
      const segmentName = currentSkipSegment.type === 'opening' ? '片頭' : '片尾';
      artPlayerRef.current.notice.show = `已跳過${segmentName}`;
    }
  }, [currentSkipSegment, artPlayerRef]);

  // 儲存新的跳過片段（單個片段模式）
  const handleSaveSegment = useCallback(async () => {
    if (!newSegment.start || !newSegment.end || !newSegment.type) {
      alert('請填寫完整的跳過片段資訊');
      return;
    }

    if (newSegment.start >= newSegment.end) {
      alert('開始時間必須小於結束時間');
      return;
    }

    try {
      const segment: SkipSegment = {
        start: newSegment.start,
        end: newSegment.end,
        type: newSegment.type as 'opening' | 'ending',
        title: newSegment.title || (newSegment.type === 'opening' ? '片頭' : '片尾'),
        autoSkip: true, // 預設開啟自動跳過
        autoNextEpisode: newSegment.type === 'ending', // 片尾預設開啟自動下一集
      };

      const updatedConfig: EpisodeSkipConfig = {
        source,
        id,
        title,
        segments: skipConfig?.segments ? [...skipConfig.segments, segment] : [segment],
        updated_time: Date.now(),
      };

      await saveSkipConfig(source, id, updatedConfig);
      setSkipConfig(updatedConfig);
      onSettingModeChange?.(false);
      setNewSegment({});

      alert('跳過片段已儲存');
    } catch (err) {
      console.error('儲存跳過片段失敗:', err);
      alert('儲存失敗，請重試');
    }
  }, [newSegment, skipConfig, source, id, title, onSettingModeChange]);

  // 儲存批量設定的跳過配置
  const handleSaveBatchSettings = useCallback(async () => {
    const segments: SkipSegment[] = [];

    // 新增片頭設定
    if (batchSettings.openingStart && batchSettings.openingEnd) {
      const start = timeToSeconds(batchSettings.openingStart);
      const end = timeToSeconds(batchSettings.openingEnd);
      
      if (start >= end) {
        alert('片頭開始時間必須小於結束時間');
        return;
      }
      
      segments.push({
        start,
        end,
        type: 'opening',
        title: '片頭',
        autoSkip: batchSettings.autoSkip,
      });
    }

    // 新增片尾設定
    if (batchSettings.endingStart) {
      const endingStartSeconds = timeToSeconds(batchSettings.endingStart);
      
      // 根據模式計算實際的開始時間
      let actualStartSeconds: number;
      if (batchSettings.endingMode === 'remaining') {
        // 剩餘時間模式：從視訊總長度減去剩餘時間
        actualStartSeconds = duration - endingStartSeconds;
      } else {
        // 絕對時間模式：使用輸入的時間
        actualStartSeconds = endingStartSeconds;
      }
      
      // 確保開始時間在有效範圍內
      if (actualStartSeconds < 0) {
        actualStartSeconds = 0;
      } else if (actualStartSeconds >= duration) {
        alert(`片尾開始時間超出視訊長度（總長：${secondsToTime(duration)}）`);
        return;
      }
      
      // 如果沒有設定結束時間，則直接跳轉到下一集
      if (!batchSettings.endingEnd || batchSettings.endingEnd.trim() === '') {
        // 直接從指定時間跳轉下一集
        segments.push({
          start: actualStartSeconds,
          end: duration, // 設定為視訊總長度
          type: 'ending',
          title: batchSettings.endingMode === 'remaining' 
            ? `剩餘${batchSettings.endingStart}時跳轉下一集` 
            : '片尾跳轉下一集',
          autoSkip: batchSettings.autoSkip,
          autoNextEpisode: batchSettings.autoNextEpisode,
        });
      } else {
        let actualEndSeconds: number;
        const endingEndSeconds = timeToSeconds(batchSettings.endingEnd);
        
        if (batchSettings.endingMode === 'remaining') {
          actualEndSeconds = duration - endingEndSeconds;
        } else {
          actualEndSeconds = endingEndSeconds;
        }
        
        if (actualStartSeconds >= actualEndSeconds) {
          alert('片尾開始時間必須小於結束時間');
          return;
        }
        
        segments.push({
          start: actualStartSeconds,
          end: actualEndSeconds,
          type: 'ending',
          title: batchSettings.endingMode === 'remaining' ? '片尾（剩餘時間模式）' : '片尾',
          autoSkip: batchSettings.autoSkip,
          autoNextEpisode: batchSettings.autoNextEpisode,
        });
      }
    }

    if (segments.length === 0) {
      alert('請至少設定片頭或片尾時間');
      return;
    }

    try {
      const updatedConfig: EpisodeSkipConfig = {
        source,
        id,
        title,
        segments,
        updated_time: Date.now(),
      };

      await saveSkipConfig(source, id, updatedConfig);
      setSkipConfig(updatedConfig);
      onSettingModeChange?.(false);
      
      // 重置批量設定
      setBatchSettings({
        openingStart: '0:00',
        openingEnd: '1:30',
        endingMode: 'remaining',
        endingStart: '2:00',
        endingEnd: '',
        autoSkip: true,
        autoNextEpisode: true,
      });

      alert('跳過配置已儲存');
    } catch (err) {
      console.error('儲存跳過配置失敗:', err);
      alert('儲存失敗，請重試');
    }
  }, [batchSettings, duration, source, id, title, onSettingModeChange, timeToSeconds, secondsToTime]);

  // 刪除跳過片段
  const handleDeleteSegment = useCallback(
    async (index: number) => {
      if (!skipConfig?.segments) return;

      try {
        const updatedSegments = skipConfig.segments.filter((_, i) => i !== index);
        
        if (updatedSegments.length === 0) {
          // 如果沒有片段了，刪除整個配置
          await deleteSkipConfig(source, id);
          setSkipConfig(null);
        } else {
          // 更新配置
          const updatedConfig: EpisodeSkipConfig = {
            ...skipConfig,
            segments: updatedSegments,
            updated_time: Date.now(),
          };
          await saveSkipConfig(source, id, updatedConfig);
          setSkipConfig(updatedConfig);
        }

        alert('跳過片段已刪除');
      } catch (err) {
        console.error('刪除跳過片段失敗:', err);
        alert('刪除失敗，請重試');
      }
    },
    [skipConfig, source, id]
  );

  // 格式化時間顯示
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 初始化載入配置
  useEffect(() => {
    loadSkipConfig();
  }, [loadSkipConfig]);

  // 監聽播放時間變化
  useEffect(() => {
    if (currentTime > 0) {
      checkSkipSegment(currentTime);
    }
  }, [currentTime, checkSkipSegment]);

  // 清理定時器
  useEffect(() => {
    return () => {
      if (skipTimeoutRef.current) {
        clearTimeout(skipTimeoutRef.current);
      }
      if (autoSkipTimeoutRef.current) {
        clearTimeout(autoSkipTimeoutRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="skip-controller">
      {/* 倒計時顯示 - 片尾自動跳轉下一集 */}
      {showCountdown && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[9999] bg-blue-600/90 text-white px-6 py-3 rounded-lg backdrop-blur-sm border border-white/20 shadow-lg animate-fade-in">
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">
              {countdownSeconds}秒后自動播放下一集
            </span>
            <button
              onClick={() => {
                setShowCountdown(false);
                if (countdownIntervalRef.current) {
                  clearInterval(countdownIntervalRef.current);
                }
              }}
              className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-xs transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 跳過按鈕 */}
      {showSkipButton && currentSkipSegment && (
        <div className="fixed top-20 right-4 z-[9999] bg-black/80 text-white px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20 shadow-lg animate-fade-in">
          <div className="flex items-center space-x-3">
            <span className="text-sm">
              {currentSkipSegment.type === 'opening' ? '檢測到片頭' : '檢測到片尾'}
            </span>
            <button
              onClick={handleSkip}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm font-medium transition-colors"
            >
              跳過
            </button>
          </div>
        </div>
      )}

      {/* 設定模式面板 - 增強版批量設定 */}
      {isSettingMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              智慧跳過設定
            </h3>
            
            {/* 全域性開關 */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={batchSettings.autoSkip}
                    onChange={(e) => setBatchSettings({...batchSettings, autoSkip: e.target.checked})}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    啟用自動跳過
                  </span>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={batchSettings.autoNextEpisode}
                    onChange={(e) => setBatchSettings({...batchSettings, autoNextEpisode: e.target.checked})}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    片尾自動播放下一集
                  </span>
                </label>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                開啟后將自動跳過設定的片頭片尾，無需手動點選
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 片頭設定 */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 border-b pb-2">
                  🎬 片頭設定
                </h4>
                
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    開始時間 (分:秒)
                  </label>
                  <input
                    type="text"
                    value={batchSettings.openingStart}
                    onChange={(e) => setBatchSettings({...batchSettings, openingStart: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="0:00"
                  />
                  <p className="text-xs text-gray-500 mt-1">格式: 分:秒 (如 0:00)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    結束時間 (分:秒)
                  </label>
                  <input
                    type="text"
                    value={batchSettings.openingEnd}
                    onChange={(e) => setBatchSettings({...batchSettings, openingEnd: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="1:30"
                  />
                  <p className="text-xs text-gray-500 mt-1">格式: 分:秒 (如 1:30)</p>
                </div>
              </div>

              {/* 片尾設定 */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 border-b pb-2">
                  🎭 片尾設定
                </h4>
                
                {/* 片尾模式選擇 */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    計時模式
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="endingMode"
                        value="remaining"
                        checked={batchSettings.endingMode === 'remaining'}
                        onChange={(e) => setBatchSettings({...batchSettings, endingMode: e.target.value})}
                        className="mr-2"
                      />
                      剩餘時間（推薦）
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="endingMode"
                        value="absolute"
                        checked={batchSettings.endingMode === 'absolute'}
                        onChange={(e) => setBatchSettings({...batchSettings, endingMode: e.target.value})}
                        className="mr-2"
                      />
                      絕對時間
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {batchSettings.endingMode === 'remaining' 
                      ? '基於剩餘時間倒計時（如：還剩2分鐘時開始）' 
                      : '基於播放時間（如：播放到第20分鐘時開始）'
                    }
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    {batchSettings.endingMode === 'remaining' ? '剩餘時間 (分:秒)' : '開始時間 (分:秒)'}
                  </label>
                  <input
                    type="text"
                    value={batchSettings.endingStart}
                    onChange={(e) => setBatchSettings({...batchSettings, endingStart: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder={batchSettings.endingMode === 'remaining' ? '2:00' : '20:00'}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {batchSettings.endingMode === 'remaining' 
                      ? '當剩餘時間達到此值時開始倒計時' 
                      : '從視訊開始播放此時間后開始檢測片尾'
                    }
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    結束時間 (分:秒) - 可選
                  </label>
                  <input
                    type="text"
                    value={batchSettings.endingEnd}
                    onChange={(e) => setBatchSettings({...batchSettings, endingEnd: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="留空直接跳下一集"
                  />
                  <p className="text-xs text-gray-500 mt-1">空白=直接跳下一集</p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <p><strong>目前播放時間:</strong> {secondsToTime(currentTime)}</p>
                {duration > 0 && (
                  <p><strong>視訊總長度:</strong> {secondsToTime(duration)}</p>
                )}
                <div className="text-xs mt-2 text-gray-500 space-y-1">
                  <p>💡 <strong>片頭示例:</strong> 從 0:00 自動跳到 1:30</p>
                  <p>💡 <strong>片尾示例:</strong> 從 20:00 開始倒計時，自動跳下一集</p>
                  <p>💡 支援格式: 1:30 (1分30秒) 或 90 (90秒)</p>
                </div>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleSaveBatchSettings}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
              >
                儲存智慧配置
              </button>
              <button
                onClick={() => {
                  onSettingModeChange?.(false);
                  setBatchSettings({
                    openingStart: '0:00',
                    openingEnd: '1:30',
                    endingMode: 'remaining',
                    endingStart: '2:00',
                    endingEnd: '',
                    autoSkip: true,
                    autoNextEpisode: true,
                  });
                }}
                className="flex-1 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded font-medium transition-colors"
              >
                取消
              </button>
            </div>

            {/* 分割線 */}
            <div className="my-6 border-t border-gray-200 dark:border-gray-600"></div>

            {/* 傳統單個設定模式 */}
            <details className="mb-4">
              <summary className="cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                高級設定：新增單個片段
              </summary>
              <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    型別
                  </label>
                  <select
                    value={newSegment.type || ''}
                    onChange={(e) => setNewSegment({ ...newSegment, type: e.target.value as 'opening' | 'ending' })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">選擇型別</option>
                    <option value="opening">片頭</option>
                    <option value="ending">片尾</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      開始時間 (秒)
                    </label>
                    <input
                      type="number"
                      value={newSegment.start || ''}
                      onChange={(e) => setNewSegment({ ...newSegment, start: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      結束時間 (秒)
                    </label>
                    <input
                      type="number"
                      value={newSegment.end || ''}
                      onChange={(e) => setNewSegment({ ...newSegment, end: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveSegment}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
                >
                  新增片段
                </button>
              </div>
            </details>
          </div>
        </div>
      )}

      {/* 管理已有片段 - 優化佈局避免重疊 */}
      {skipConfig && skipConfig.segments && skipConfig.segments.length > 0 && !isSettingMode && (
        <div className="fixed bottom-4 left-4 z-[9998] max-w-sm bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 animate-fade-in">
          <div className="p-3">
            <h4 className="font-medium mb-2 text-gray-900 dark:text-gray-100 text-sm flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
              跳過配置
            </h4>
            <div className="space-y-1">
              {skipConfig.segments.map((segment, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs"
                >
                  <span className="text-gray-800 dark:text-gray-200 flex-1 mr-2">
                    <span className="font-medium">
                      {segment.type === 'opening' ? '🎬片頭' : '🎭片尾'}
                    </span>
                    <br />
                    <span className="text-gray-600 dark:text-gray-400">
                      {formatTime(segment.start)} - {formatTime(segment.end)}
                    </span>
                    {segment.autoSkip && (
                      <span className="ml-1 px-1 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 rounded text-xs">
                        自動
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => handleDeleteSegment(index)}
                    className="px-1.5 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded text-xs transition-colors flex-shrink-0"
                    title="刪除"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={() => onSettingModeChange?.(true)}
                className="w-full px-2 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded text-xs transition-colors"
              >
                修改配置
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

// 導出跳過控制器的設定按鈕元件
export function SkipSettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 transition-colors"
      title="設定跳過片頭片尾"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
      </svg>
      <span>跳過設定</span>
    </button>
  );
}
