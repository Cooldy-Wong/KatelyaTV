import { NextResponse } from 'next/server';

import { getAvailableApiSites,getCacheTime } from '@/lib/config';
import { addCorsHeaders, handleOptionsRequest } from '@/lib/cors';
import { getStorage } from '@/lib/db';
import { searchFromApi } from '@/lib/downstream';

export const runtime = 'edge';

// 處理OPTIONS預檢請求（OrionTV客戶端需要）
export async function OPTIONS() {
  return handleOptionsRequest();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  
  // 從 Authorization header 或 query parameter 獲取使用者名稱
  let userName: string | undefined = searchParams.get('user') || undefined;
  if (!userName) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      userName = authHeader.substring(7);
    }
  }

  if (!query) {
    const cacheTime = await getCacheTime();
    const response = NextResponse.json(
      { 
        regular_results: [],
        adult_results: []
      },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        },
      }
    );
    return addCorsHeaders(response);
  }

  try {
    // 檢查是否明確要求包含成人內容（用於關閉過濾時的明確請求）
    const includeAdult = searchParams.get('include_adult') === 'true';
    
    // 獲取使用者的成人內容過濾設定
    let shouldFilterAdult = true; // 預設過濾
    if (userName) {
      try {
        const storage = getStorage();
        const userSettings = await storage.getUserSettings(userName);
        // 如果使用者設定存在且明確設為false，則不過濾；否則預設過濾
        shouldFilterAdult = userSettings?.filter_adult_content !== false;
      } catch (error) {
        // 出錯時預設過濾成人內容
        shouldFilterAdult = true;
      }
    }

    // 根據使用者設定和明確請求決定最終的過濾策略
    const finalShouldFilter = shouldFilterAdult || !includeAdult;
    
    // 使用動態過濾方法，但不依賴快取，實時獲取設定
    const availableSites = finalShouldFilter 
      ? await getAvailableApiSites(true) // 過濾成人內容
      : await getAvailableApiSites(false); // 不過濾成人內容
    
    if (!availableSites || availableSites.length === 0) {
      const cacheTime = await getCacheTime();
      const response = NextResponse.json({ 
        regular_results: [], 
        adult_results: [] 
      }, {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        },
      });
      return addCorsHeaders(response);
    }

    // 搜索所有可用的資源站（已根據使用者設定動態過濾）
    const searchPromises = availableSites.map((site) => searchFromApi(site, query));
    const searchResults = (await Promise.all(searchPromises)).flat();

    // 所有結果都作為常規結果返回，因為成人內容源已經在源頭被過濾掉了
    const cacheTime = await getCacheTime();
    const response = NextResponse.json(
      { 
        regular_results: searchResults,
        adult_results: [] // 始終為空，因為成人內容在源頭就被過濾了
      },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        },
      }
    );
    return addCorsHeaders(response);
  } catch (error) {
    const response = NextResponse.json(
      { 
        regular_results: [],
        adult_results: [],
        error: '搜索失敗' 
      }, 
      { status: 500 }
    );
    return addCorsHeaders(response);
  }
}
