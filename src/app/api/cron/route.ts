/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { fetchVideoDetail } from '@/lib/fetchVideoDetail';
import { SearchResult } from '@/lib/types';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  console.log(request.url);
  try {
    console.log('Cron job triggered:', new Date().toISOString());

    refreshRecordAndFavorites();

    return NextResponse.json({
      success: true,
      message: 'Cron job executed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron job failed:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Cron job failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

async function refreshRecordAndFavorites() {
  if (
    (process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage') === 'localstorage'
  ) {
    console.log('跳過重新整理：目前使用 localstorage 儲存模式');
    return;
  }

  try {
    const users = await db.getAllUsers();
    if (process.env.USERNAME && !users.includes(process.env.USERNAME)) {
      users.push(process.env.USERNAME);
    }
    // 函式級快取：key 為 `${source}+${id}`，值為 Promise<VideoDetail | null>
    const detailCache = new Map<string, Promise<SearchResult | null>>();

    // 獲取詳情 Promise（帶快取和錯誤處理）
    const getDetail = async (
      source: string,
      id: string,
      fallbackTitle: string
    ): Promise<SearchResult | null> => {
      const key = `${source}+${id}`;
      let promise = detailCache.get(key);
      if (!promise) {
        promise = fetchVideoDetail({
          source,
          id,
          fallbackTitle: fallbackTitle.trim(),
        })
          .then((detail) => {
            // 成功時才快取結果
            const successPromise = Promise.resolve(detail);
            detailCache.set(key, successPromise);
            return detail;
          })
          .catch((err) => {
            console.error(`獲取視訊詳情失敗 (${source}+${id}):`, err);
            return null;
          });
      }
      return promise;
    };

    for (const user of users) {
      console.log(`開始處理使用者: ${user}`);

      // 播放記錄
      try {
        const playRecords = await db.getAllPlayRecords(user);
        const totalRecords = Object.keys(playRecords).length;
        let processedRecords = 0;

        for (const [key, record] of Object.entries(playRecords)) {
          try {
            const [source, id] = key.split('+');
            if (!source || !id) {
              console.warn(`跳過無效的播放記錄鍵: ${key}`);
              continue;
            }

            const detail = await getDetail(source, id, record.title);
            if (!detail) {
              console.warn(`跳過無法獲取詳情的播放記錄: ${key}`);
              continue;
            }

            const episodeCount = detail.episodes?.length || 0;
            if (episodeCount > 0 && episodeCount !== record.total_episodes) {
              await db.savePlayRecord(user, source, id, {
                title: detail.title || record.title,
                source_name: record.source_name,
                cover: detail.poster || record.cover,
                index: record.index,
                total_episodes: episodeCount,
                play_time: record.play_time,
                year: detail.year || record.year,
                total_time: record.total_time,
                save_time: record.save_time,
                search_title: record.search_title,
              });
              console.log(
                `更新播放記錄: ${record.title} (${record.total_episodes} -> ${episodeCount})`
              );
            }

            processedRecords++;
          } catch (err) {
            console.error(`處理播放記錄失敗 (${key}):`, err);
            // 繼續處理下一個記錄
          }
        }

        console.log(`播放記錄處理完成: ${processedRecords}/${totalRecords}`);
      } catch (err) {
        console.error(`獲取使用者播放記錄失敗 (${user}):`, err);
      }

      // 收藏
      try {
        const favorites = await db.getAllFavorites(user);
        const totalFavorites = Object.keys(favorites).length;
        let processedFavorites = 0;

        for (const [key, fav] of Object.entries(favorites)) {
          try {
            const [source, id] = key.split('+');
            if (!source || !id) {
              console.warn(`跳過無效的收藏鍵: ${key}`);
              continue;
            }

            const favDetail = await getDetail(source, id, fav.title);
            if (!favDetail) {
              console.warn(`跳過無法獲取詳情的收藏: ${key}`);
              continue;
            }

            const favEpisodeCount = favDetail.episodes?.length || 0;
            if (favEpisodeCount > 0 && favEpisodeCount !== fav.total_episodes) {
              await db.saveFavorite(user, source, id, {
                title: favDetail.title || fav.title,
                source_name: fav.source_name,
                cover: favDetail.poster || fav.cover,
                year: favDetail.year || fav.year,
                total_episodes: favEpisodeCount,
                save_time: fav.save_time,
                search_title: fav.search_title,
              });
              console.log(
                `更新收藏: ${fav.title} (${fav.total_episodes} -> ${favEpisodeCount})`
              );
            }

            processedFavorites++;
          } catch (err) {
            console.error(`處理收藏失敗 (${key}):`, err);
            // 繼續處理下一個收藏
          }
        }

        console.log(`收藏處理完成: ${processedFavorites}/${totalFavorites}`);
      } catch (err) {
        console.error(`獲取使用者收藏失敗 (${user}):`, err);
      }
    }

    console.log('重新整理播放記錄/收藏任務完成');
  } catch (err) {
    console.error('重新整理播放記錄/收藏任務啟動失敗', err);
  }
}
