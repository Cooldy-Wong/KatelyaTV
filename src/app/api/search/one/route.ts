import { NextResponse } from 'next/server';

import { getAvailableApiSites, getCacheTime } from '@/lib/config';
import { addCorsHeaders, handleOptionsRequest } from '@/lib/cors';
import { searchFromApi } from '@/lib/downstream';

export const runtime = 'edge';

// 處理OPTIONS預檢請求（OrionTV客戶端需要）
export async function OPTIONS() {
  return handleOptionsRequest();
}

// OrionTV 相容介面
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const resourceId = searchParams.get('resourceId');

  if (!query || !resourceId) {
    const cacheTime = await getCacheTime();
    const response = NextResponse.json(
      { result: null, error: '缺少必要參數: q 或 resourceId' },
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

  const apiSites = await getAvailableApiSites();

  try {
    // 根據 resourceId 查詢對應的 API 站點
    const targetSite = apiSites.find((site) => site.key === resourceId);
    if (!targetSite) {
      const response = NextResponse.json(
        {
          error: `未找到指定的視訊源: ${resourceId}`,
          result: null,
        },
        { status: 404 }
      );
      return addCorsHeaders(response);
    }

    const results = await searchFromApi(targetSite, query);
    const result = results.filter((r) => r.title === query);
    const cacheTime = await getCacheTime();

    if (result.length === 0) {
      const response = NextResponse.json(
        {
          error: '未找到結果',
          result: null,
        },
        { status: 404 }
      );
      return addCorsHeaders(response);
    } else {
      const response = NextResponse.json(
        { results: result },
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
  } catch (error) {
    const response = NextResponse.json(
      {
        error: '搜索失敗',
        result: null,
      },
      { status: 500 }
    );
    return addCorsHeaders(response);
  }
}
