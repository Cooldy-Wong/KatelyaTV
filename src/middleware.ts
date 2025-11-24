/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 跳過不需要認證的路徑
  if (shouldSkipAuth(pathname)) {
    return NextResponse.next();
  }

  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  if (!process.env.AUTH_PASSWORD) {
    // 如果沒有設定密碼，重定向到警告頁面
    const warningUrl = new URL('/warning', request.url);
    return NextResponse.redirect(warningUrl);
  }

  // 從cookie獲取認證資訊
  const authInfo = getAuthInfoFromCookie(request);

  if (!authInfo) {
    return handleAuthFailure(request, pathname);
  }

  // localstorage模式：在middleware中完成驗證
  if (storageType === 'localstorage') {
    if (!authInfo.password || authInfo.password !== process.env.AUTH_PASSWORD) {
      return handleAuthFailure(request, pathname);
    }
    return NextResponse.next();
  }

  // 其他模式：只驗證簽名
  // 檢查是否有使用者名稱（非localStorage模式下密碼不儲存在cookie中）
  if (!authInfo.username || !authInfo.signature) {
    return handleAuthFailure(request, pathname);
  }

  // 驗證簽名（如果存在）
  if (authInfo.signature) {
    const isValidSignature = await verifySignature(
      authInfo.username,
      authInfo.signature,
      process.env.AUTH_PASSWORD || ''
    );

    // 簽名驗證通過即可
    if (isValidSignature) {
      return NextResponse.next();
    }
  }

  // 簽名驗證失敗或不存在簽名
  return handleAuthFailure(request, pathname);
}

// 驗證簽名
async function verifySignature(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  try {
    // 匯入金鑰
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // 將十六進制字串轉換為Uint8Array
    const signatureBuffer = new Uint8Array(
      signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );

    // 驗證簽名
    return await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBuffer,
      messageData
    );
  } catch (error) {
    console.error('簽名驗證失敗:', error);
    return false;
  }
}

// 處理認證失敗的情況
function handleAuthFailure(
  request: NextRequest,
  pathname: string
): NextResponse {
  // 如果是 API 路由，返回 401 狀態碼
  if (pathname.startsWith('/api')) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 否則重定向到登錄頁面
  const loginUrl = new URL('/login', request.url);
  // 保留完整的URL，包括查詢參數
  const fullUrl = `${pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set('redirect', fullUrl);
  return NextResponse.redirect(loginUrl);
}

// 判斷是否需要跳過認證的路徑
function shouldSkipAuth(pathname: string): boolean {
  const skipPaths = [
    '/_next',
    '/favicon.ico',
    '/robots.txt',
    '/manifest.json',
    '/icons/',
    '/logo.png',
    '/screenshot.png',
  ];

  return skipPaths.some((path) => pathname.startsWith(path));
}

// 配置middleware匹配規則
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|warning|api/login|api/register|api/logout|api/cron|api/server-config|api/search|api/detail|api/image-proxy|api/tvbox).*)',
  ],
};
