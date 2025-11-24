import { NextResponse } from 'next/server';

import { getAvailableApiSites, getCacheTime } from '@/lib/config';
import { addCorsHeaders, handleOptionsRequest } from '@/lib/cors';

export const runtime = 'edge';

// 處理OPTIONS預檢請求（OrionTV客戶端需要）
export async function OPTIONS() {
  return handleOptionsRequest();
}

// OrionTV 相容介面
export async function GET() {
  try {
    const apiSites = await getAvailableApiSites();
    const cacheTime = await getCacheTime();

    const response = NextResponse.json(apiSites, {
      headers: {
        'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
      },
    });
    return addCorsHeaders(response);
  } catch (error) {
    const response = NextResponse.json({ error: '獲取資源失敗' }, { status: 500 });
    return addCorsHeaders(response);
  }
}
