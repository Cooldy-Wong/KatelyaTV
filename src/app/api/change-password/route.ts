/* eslint-disable no-console*/

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getStorage } from '@/lib/db';
import { IStorage } from '@/lib/types';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  // 不支援 localstorage 模式
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支援本地儲存模式修改密碼',
      },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { newPassword } = body;

    // 獲取認證資訊
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 驗證新密碼
    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json({ error: '新密碼不得為空' }, { status: 400 });
    }

    const username = authInfo.username;

    // 不允許站長修改密碼（站長使用者名稱等於 process.env.USERNAME）
    if (username === process.env.USERNAME) {
      return NextResponse.json(
        { error: '站長不能通過此介面修改密碼' },
        { status: 403 }
      );
    }

    // 獲取儲存實例
    const storage: IStorage | null = getStorage();
    if (!storage || typeof storage.changePassword !== 'function') {
      return NextResponse.json(
        { error: '儲存服務不支援修改密碼' },
        { status: 500 }
      );
    }

    // 修改密碼
    await storage.changePassword(username, newPassword);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('修改密碼失敗:', error);
    return NextResponse.json(
      {
        error: '修改密碼失敗',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
