/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { getStorage } from '@/lib/db';
import { User } from '@/lib/types';

export const runtime = 'edge';

// 檢查是否為站長賬戶
function isOwnerAccount(username: string): boolean {
  const ownerUsername = process.env.USERNAME || 'admin';
  return username === ownerUsername;
}

export async function GET(request: NextRequest) {
  try {
    // 從Authorization頭獲取目前使用者
    const auth = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) {
      return NextResponse.json({ error: '需要認證' }, { status: 401 });
    }

    const currentUsername = decodeURIComponent(auth);
    
    // 檢查是否為站長賬戶
    if (!isOwnerAccount(currentUsername)) {
      return NextResponse.json({ error: '許可權不足' }, { status: 403 });
    }

    // 獲取所有使用者及其設定
    const storage = getStorage();
    const users: User[] = await storage.getAllUsers();
    const usersWithSettings = await Promise.all(
      users.map(async (user) => {
        const settings = await storage.getUserSettings(user.username);
        return {
          username: user.username,
          role: user.role || 'user',
          created_at: user.created_at,
          filter_adult_content: settings?.filter_adult_content ?? true,
          can_disable_filter: settings?.can_disable_filter ?? true,
          managed_by_admin: settings?.managed_by_admin ?? false,
          last_filter_change: settings?.last_filter_change
        };
      })
    );

    return NextResponse.json({ 
      users: usersWithSettings,
      total: usersWithSettings.length
    });

  } catch (error) {
    console.error('獲取使用者列表失敗:', error);
    return NextResponse.json({ error: '獲取使用者列表失敗' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 從Authorization頭獲取目前使用者
    const auth = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) {
      return NextResponse.json({ error: '需要認證' }, { status: 401 });
    }

    const currentUsername = decodeURIComponent(auth);
    
    // 檢查是否為站長賬戶
    if (!isOwnerAccount(currentUsername)) {
      return NextResponse.json({ error: '許可權不足' }, { status: 403 });
    }

    const storage = getStorage();
    const { action, username, settings } = await request.json();

    switch (action) {
      case 'update_settings': {
        // 更新使用者設定
        const currentSettings = await storage.getUserSettings(username);
        const newSettings = {
          ...currentSettings,
          ...settings,
          last_filter_change: new Date().toISOString()
        };
        
        await storage.setUserSettings(username, newSettings);
        
        return NextResponse.json({ 
          success: true,
          message: `已更新使用者 ${username} 的設定` 
        });
      }

      case 'force_filter': {
        // 強制開啟某使用者的成人內容過濾
        const currentSettings = await storage.getUserSettings(username) || {
          filter_adult_content: true,
          theme: 'auto' as const,
          language: 'zh-CN',
          auto_play: false,
          video_quality: 'auto'
        };
        
        await storage.setUserSettings(username, {
          ...currentSettings,
          filter_adult_content: true,
          can_disable_filter: false,
          managed_by_admin: true,
          last_filter_change: new Date().toISOString()
        });
        
        return NextResponse.json({ 
          success: true,
          message: `已強制開啟使用者 ${username} 的成人內容過濾` 
        });
      }

      case 'allow_disable': {
        // 允許使用者自己管理過濾設定
        const existingSettings = await storage.getUserSettings(username) || {
          filter_adult_content: true,
          theme: 'auto' as const,
          language: 'zh-CN',
          auto_play: false,
          video_quality: 'auto'
        };
        
        await storage.setUserSettings(username, {
          ...existingSettings,
          filter_adult_content: existingSettings.filter_adult_content ?? true,
          theme: existingSettings.theme || 'auto',
          language: existingSettings.language || 'zh-CN',
          auto_play: existingSettings.auto_play ?? false,
          video_quality: existingSettings.video_quality || 'auto',
          can_disable_filter: true,
          managed_by_admin: false,
          last_filter_change: new Date().toISOString()
        });
        
        return NextResponse.json({ 
          success: true,
          message: `已允許使用者 ${username} 自己管理過濾設定` 
        });
      }

      default:
        return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }

  } catch (error) {
    console.error('使用者管理操作失敗:', error);
    return NextResponse.json({ error: '操作失敗' }, { status: 500 });
  }
}
