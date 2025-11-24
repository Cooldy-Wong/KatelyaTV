import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import './globals.css';
import 'sweetalert2/dist/sweetalert2.min.css';

import { getConfig } from '@/lib/config';

import { SiteProvider } from '../components/SiteProvider';
import { ThemeProvider } from '../components/ThemeProvider';

const inter = Inter({ subsets: ['latin'] });

// 動態產生 metadata，支援配置更新后的標題變化
export async function generateMetadata(): Promise<Metadata> {
  let siteName = process.env.SITE_NAME || 'KatelyaTV';
  
  try {
    // 只有在非 d1 和 upstash 儲存型別時才嘗試獲取配置
    if (
      process.env.NEXT_PUBLIC_STORAGE_TYPE !== 'd1' &&
      process.env.NEXT_PUBLIC_STORAGE_TYPE !== 'upstash'
    ) {
      const config = await getConfig();
      siteName = config.SiteConfig.SiteName;
    }
  } catch (error) {
    // 如果配置獲取失敗，使用預設站點名稱
    // siteName 已經有預設值，不需要額外處理
  }

  return {
    title: siteName,
    description: '影視聚合',
    manifest: '/manifest.json',
  };
}

export const viewport: Viewport = {
  themeColor: '#000000',
};

// 浮動幾何形狀元件
const FloatingShapes = () => {
  return (
    <div className='floating-shapes'>
      <div className='shape'></div>
      <div className='shape'></div>
      <div className='shape'></div>
      <div className='shape'></div>
    </div>
  );
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let siteName = process.env.SITE_NAME || 'KatelyaTV';
  let announcement =
    process.env.ANNOUNCEMENT ||
    '本網站僅提供影視資訊搜索服務，所有內容均來自第三方網站。本站不儲存任何視訊資源，不對任何內容的準確性、合法性、完整性負責。Link Me TG：@katelya77';
  let enableRegister = process.env.NEXT_PUBLIC_ENABLE_REGISTER === 'true';
  let imageProxy = process.env.NEXT_PUBLIC_IMAGE_PROXY || '';
  let doubanProxy = process.env.NEXT_PUBLIC_DOUBAN_PROXY || '';
  if (
    process.env.NEXT_PUBLIC_STORAGE_TYPE !== 'd1' &&
    process.env.NEXT_PUBLIC_STORAGE_TYPE !== 'upstash'
  ) {
    const config = await getConfig();
    siteName = config.SiteConfig.SiteName;
    announcement = config.SiteConfig.Announcement;
    enableRegister = config.UserConfig.AllowRegister;
    imageProxy = config.SiteConfig.ImageProxy;
    doubanProxy = config.SiteConfig.DoubanProxy;
  }

  // 將執行時配置注入到全域性 window 對象，供客戶端在執行時讀取
  const runtimeConfig = {
    STORAGE_TYPE: process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage',
    ENABLE_REGISTER: enableRegister,
    IMAGE_PROXY: imageProxy,
    DOUBAN_PROXY: doubanProxy,
  };

  return (
    <html lang='zh-CN' suppressHydrationWarning>
      <head>
        {/* 將配置序列化后直接寫入指令碼，瀏覽器端可通過 window.RUNTIME_CONFIG 獲取 */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.RUNTIME_CONFIG = ${JSON.stringify(runtimeConfig)};`,
          }}
        />
      </head>
      <body
        className={`${inter.className} min-h-screen bg-white text-gray-900 dark:bg-black dark:text-gray-200`}
      >
        {/* 浮動幾何形狀裝飾 */}
        <FloatingShapes />

        <ThemeProvider
          attribute='class'
          defaultTheme='system'
          enableSystem
          disableTransitionOnChange
        >
          <SiteProvider siteName={siteName} announcement={announcement}>
            {children}
          </SiteProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
