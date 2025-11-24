import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getStorage } from '@/lib/db';
import { EpisodeSkipConfig } from '@/lib/types';

// 配置 Edge Runtime - Cloudflare Pages 要求
export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, key, config, username } = body;

    // 驗證請求參數
    if (!action) {
      return NextResponse.json({ error: '缺少操作型別' }, { status: 400 });
    }

    // 獲取認證資訊
    const authInfo = getAuthInfoFromCookie(request);
    
    // 如果是直接傳入的認證資訊（客戶端模式），使用傳入的資訊
    const finalUsername = username || authInfo?.username;
    
    if (!finalUsername) {
      return NextResponse.json({ error: '使用者未登錄' }, { status: 401 });
    }

    // 建立儲存實例
    const storage = getStorage();

    switch (action) {
      case 'get': {
        if (!key) {
          return NextResponse.json({ error: '缺少配置鍵' }, { status: 400 });
        }

        const skipConfig = await storage.getSkipConfig(finalUsername, key);
        return NextResponse.json({ config: skipConfig });
      }

      case 'set': {
        if (!key || !config) {
          return NextResponse.json({ error: '缺少配置鍵或配置數據' }, { status: 400 });
        }

        // 驗證配置數據結構
        if (!config.source || !config.id || !config.title || !Array.isArray(config.segments)) {
          return NextResponse.json({ error: '配置數據格式錯誤' }, { status: 400 });
        }

        // 驗證片段數據
        for (const segment of config.segments) {
          if (
            typeof segment.start !== 'number' ||
            typeof segment.end !== 'number' ||
            segment.start >= segment.end ||
            !['opening', 'ending'].includes(segment.type)
          ) {
            return NextResponse.json({ error: '片段數據格式錯誤' }, { status: 400 });
          }
        }

        await storage.setSkipConfig(finalUsername, key, config as EpisodeSkipConfig);
        return NextResponse.json({ success: true });
      }

      case 'getAll': {
        const allConfigs = await storage.getAllSkipConfigs(finalUsername);
        return NextResponse.json({ configs: allConfigs });
      }

      case 'delete': {
        if (!key) {
          return NextResponse.json({ error: '缺少配置鍵' }, { status: 400 });
        }

        await storage.deleteSkipConfig(finalUsername, key);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: '不支援的操作型別' }, { status: 400 });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('跳過配置 API 錯誤:', error);
    return NextResponse.json(
      { error: '伺服器內部錯誤' },
      { status: 500 }
    );
  }
}
