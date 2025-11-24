/* eslint-disable no-console,@typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'edge';

// 讀取儲存型別環境變數，預設 localstorage
const STORAGE_TYPE =
  (process.env.NEXT_PUBLIC_STORAGE_TYPE as
    | 'localstorage'
    | 'redis'
    | 'd1'
    | 'upstash'
    | undefined) || 'localstorage';

// 產生簽名
async function generateSignature(
  data: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  // 匯入金鑰
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // 產生簽名
  const signature = await crypto.subtle.sign('HMAC', key, messageData);

  // 轉換為十六進制字串
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// 產生認證Cookie（帶簽名）
async function generateAuthCookie(
  username?: string,
  password?: string,
  role?: 'owner' | 'admin' | 'user',
  includePassword = false
): Promise<string> {
  const authData: any = { role: role || 'user' };

  // 只在需要時包含 password
  if (includePassword && password) {
    authData.password = password;
  }

  if (username && process.env.AUTH_PASSWORD) {
    authData.username = username;
    // 使用密碼作為金鑰對使用者名稱進行簽名
    const signature = await generateSignature(username, process.env.AUTH_PASSWORD);
    authData.signature = signature;
    authData.timestamp = Date.now(); // 新增時間戳防重放攻擊
  }

  return encodeURIComponent(JSON.stringify(authData));
}

export async function POST(req: NextRequest) {
  try {
    // 本地 / localStorage 模式——僅校驗固定密碼
    if (STORAGE_TYPE === 'localstorage') {
      const envPassword = process.env.AUTH_PASSWORD;

      // 未配置 AUTH_PASSWORD 時直接放行
      if (!envPassword) {
        const response = NextResponse.json({ ok: true });

        // 清除可能存在的認證cookie
        response.cookies.set('auth', '', {
          path: '/',
          expires: new Date(0),
          sameSite: 'lax', // 改為 lax 以支援 PWA
          httpOnly: false, // PWA 需要客戶端可訪問
          secure: false, // 根據協議自動設定
        });

        return response;
      }

      const { password } = await req.json();
      if (typeof password !== 'string') {
        return NextResponse.json({ error: '密碼不能為空' }, { status: 400 });
      }

      if (password !== envPassword) {
        return NextResponse.json(
          { ok: false, error: '密碼錯誤' },
          { status: 401 }
        );
      }

      // 驗證成功，設定認證cookie
      const response = NextResponse.json({ ok: true });
      const cookieValue = await generateAuthCookie(
        undefined,
        password,
        'user',
        true
      ); // localstorage 模式包含 password
      const expires = new Date();
      expires.setDate(expires.getDate() + 7); // 7天過期

      response.cookies.set('auth', cookieValue, {
        path: '/',
        expires,
        sameSite: 'lax', // 改為 lax 以支援 PWA
        httpOnly: false, // PWA 需要客戶端可訪問
        secure: false, // 根據協議自動設定
      });

      return response;
    }

    // 數據庫 / redis 模式——校驗使用者名稱並嘗試連線數據庫
    const { username, password } = await req.json();

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: '使用者名稱不能為空' }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: '密碼不能為空' }, { status: 400 });
    }

    // 可能是站長，直接讀環境變數
    if (
      username === process.env.USERNAME &&
      password === process.env.AUTH_PASSWORD
    ) {
      // 驗證成功，設定認證cookie
      const response = NextResponse.json({ ok: true });
      const cookieValue = await generateAuthCookie(
        username,
        password,
        'owner',
        false
      ); // 數據庫模式不包含 password
      const expires = new Date();
      expires.setDate(expires.getDate() + 7); // 7天過期

      response.cookies.set('auth', cookieValue, {
        path: '/',
        expires,
        sameSite: 'lax', // 改為 lax 以支援 PWA
        httpOnly: false, // PWA 需要客戶端可訪問
        secure: false, // 根據協議自動設定
      });

      return response;
    } else if (username === process.env.USERNAME) {
      return NextResponse.json({ error: '使用者名稱或密碼錯誤' }, { status: 401 });
    }

    const config = await getConfig();
    const user = config.UserConfig.Users.find((u) => u.username === username);
    if (user && user.banned) {
      return NextResponse.json({ error: '使用者被封禁' }, { status: 401 });
    }

    // 校驗使用者密碼
    try {
      const pass = await db.verifyUser(username, password);
      if (!pass) {
        return NextResponse.json(
          { error: '使用者名稱或密碼錯誤' },
          { status: 401 }
        );
      }

      // 驗證成功，設定認證cookie
      const response = NextResponse.json({ ok: true });
      const cookieValue = await generateAuthCookie(
        username,
        password,
        user?.role || 'user',
        false
      ); // 數據庫模式不包含 password
      const expires = new Date();
      expires.setDate(expires.getDate() + 7); // 7天過期

      response.cookies.set('auth', cookieValue, {
        path: '/',
        expires,
        sameSite: 'lax', // 改為 lax 以支援 PWA
        httpOnly: false, // PWA 需要客戶端可訪問
        secure: false, // 根據協議自動設定
      });

      return response;
    } catch (err) {
      console.error('數據庫驗證失敗', err);
      return NextResponse.json({ error: '數據庫錯誤' }, { status: 500 });
    }
  } catch (error) {
    console.error('登錄介面異常', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
