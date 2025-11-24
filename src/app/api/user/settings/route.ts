import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { getStorage } from '@/lib/db';
import { UserSettings } from '@/lib/types';

// 設定執行時為 Edge Runtime，確保部署相容性
export const runtime = 'edge';

// 獲取使用者設定
export async function GET(_request: NextRequest) {
  try {
    const headersList = headers();
    const authorization = headersList.get('Authorization');
    
    if (!authorization) {
      return NextResponse.json({ error: '未授權訪問' }, { status: 401 });
    }

    const userName = authorization.split(' ')[1]; // 假設格式為 "Bearer username"
    
    if (!userName) {
      return NextResponse.json({ error: '使用者名稱不能為空' }, { status: 400 });
    }

    const storage = getStorage();
    const settings = await storage.getUserSettings(userName);
    
    return NextResponse.json({ 
      settings: settings || {
        filter_adult_content: true, // 預設開啟成人內容過濾
        theme: 'auto',
        language: 'zh-CN',
        auto_play: true,
        video_quality: 'auto'
      }
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error getting user settings:', error);
    return NextResponse.json({ error: '獲取使用者設定失敗' }, { status: 500 });
  }
}

// 更新使用者設定
export async function PATCH(request: NextRequest) {
  try {
    const headersList = headers();
    const authorization = headersList.get('Authorization');
    
    if (!authorization) {
      return NextResponse.json({ error: '未授權訪問' }, { status: 401 });
    }

    const userName = authorization.split(' ')[1];
    
    if (!userName) {
      return NextResponse.json({ error: '使用者名稱不能為空' }, { status: 400 });
    }

    const body = await request.json();
    const { settings } = body as { settings: Partial<UserSettings> };
    
    if (!settings) {
      return NextResponse.json({ error: '設定數據不能為空' }, { status: 400 });
    }

    const storage = getStorage();
    
    // 驗證使用者存在
    const userExists = await storage.checkUserExist(userName);
    if (!userExists) {
      return NextResponse.json({ error: '使用者不存在' }, { status: 404 });
    }

    await storage.updateUserSettings(userName, settings);
    
    return NextResponse.json({ 
      success: true,
      message: '設定更新成功' 
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error updating user settings:', error);
    return NextResponse.json({ error: '更新使用者設定失敗' }, { status: 500 });
  }
}

// 重置使用者設定
export async function PUT(request: NextRequest) {
  try {
    const headersList = headers();
    const authorization = headersList.get('Authorization');
    
    if (!authorization) {
      return NextResponse.json({ error: '未授權訪問' }, { status: 401 });
    }

    const userName = authorization.split(' ')[1];
    
    if (!userName) {
      return NextResponse.json({ error: '使用者名稱不能為空' }, { status: 400 });
    }

    const body = await request.json();
    const { settings } = body as { settings: UserSettings };
    
    if (!settings) {
      return NextResponse.json({ error: '設定數據不能為空' }, { status: 400 });
    }

    const storage = getStorage();
    
    // 驗證使用者存在
    const userExists = await storage.checkUserExist(userName);
    if (!userExists) {
      return NextResponse.json({ error: '使用者不存在' }, { status: 404 });
    }

    await storage.setUserSettings(userName, settings);
    
    return NextResponse.json({ 
      success: true,
      message: '設定已重置' 
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error resetting user settings:', error);
    return NextResponse.json({ error: '重置使用者設定失敗' }, { status: 500 });
  }
}
