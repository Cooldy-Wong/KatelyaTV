import { Clover, Film, Home, Search, Tv } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { BackButton } from './BackButton';
import MobileBottomNav from './MobileBottomNav';
import MobileHeader from './MobileHeader';
import { useSite } from './SiteProvider';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

interface PageLayoutProps {
  children: React.ReactNode;
  activePath?: string;
}

// 內聯頂部導航欄元件
const TopNavbar = ({ activePath = '/' }: { activePath?: string }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { siteName } = useSite();

  const [active, setActive] = useState(activePath);

  useEffect(() => {
    // 優先使用傳入的 activePath
    if (activePath) {
      setActive(activePath);
    } else {
      // 否則使用目前路徑
      const getCurrentFullPath = () => {
        const queryString = searchParams.toString();
        return queryString ? `${pathname}?${queryString}` : pathname;
      };
      const fullPath = getCurrentFullPath();
      setActive(fullPath);
    }
  }, [activePath, pathname, searchParams]);

  const handleSearchClick = useCallback(() => {
    router.push('/search');
  }, [router]);

  const menuItems = [
    {
      icon: Home,
      label: '首頁',
      href: '/',
    },
    {
      icon: Search,
      label: '搜索',
      href: '/search',
    },
    {
      icon: Film,
      label: '電影',
      href: '/douban?type=movie',
    },
    {
      icon: Tv,
      label: '劇集',
      href: '/douban?type=tv',
    },
    {
      icon: Clover,
      label: '綜藝',
      href: '/douban?type=show',
    },
  ];

  // 桌面端：頂部固定導航（fixed）
  // 移動端：不顯示此元件，改由底部導航 + 輕量頂部條（非固定）
  return (
    <nav className='w-full bg-white/40 backdrop-blur-xl border-b border-purple-200/50 shadow-lg dark:bg-gray-900/70 dark:border-purple-700/50 fixed top-0 left-0 right-0 z-40 hidden md:block'>
      <div className='w-full px-8 lg:px-12 xl:px-16'>
        <div className='flex items-center justify-between h-16'>
          {/* Logo區域 - 調整為更靠左 */}
          <div className='flex-shrink-0 -ml-2'>
            <Link
              href='/'
              className='flex items-center select-none hover:opacity-80 transition-opacity duration-200'
            >
              <span className='text-2xl font-bold katelya-logo tracking-tight'>
                {siteName}
              </span>
            </Link>
          </div>

          {/* 導航菜單 */}
          <div className='hidden md:block'>
            <div className='ml-10 flex items-baseline space-x-4'>
              {menuItems.map((item) => {
                // 檢查目前路徑是否匹配這個菜單項
                const typeMatch = item.href.match(/type=([^&]+)/)?.[1];
                const tagMatch = item.href.match(/tag=([^&]+)/)?.[1];

                // 解碼URL以進行正確的比較
                const decodedActive = decodeURIComponent(active);
                const decodedItemHref = decodeURIComponent(item.href);

                const isActive =
                  decodedActive === decodedItemHref ||
                  (decodedActive.startsWith('/douban') &&
                    decodedActive.includes(`type=${typeMatch}`) &&
                    tagMatch &&
                    decodedActive.includes(`tag=${tagMatch}`));

                const Icon = item.icon;

                if (item.href === '/search') {
                  return (
                    <button
                      key={item.label}
                      onClick={(e) => {
                        e.preventDefault();
                        handleSearchClick();
                        setActive('/search');
                      }}
                      data-active={isActive}
                      className={`group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                        isActive
                          ? 'bg-purple-500/20 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400'
                          : 'text-gray-700 hover:bg-purple-100/30 hover:text-purple-600 dark:text-gray-300 dark:hover:text-purple-400 dark:hover:bg-purple-500/10'
                      }`}
                    >
                      <Icon className='h-4 w-4 mr-2' />
                      {item.label}
                    </button>
                  );
                }

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setActive(item.href)}
                    data-active={isActive}
                    className={`group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? 'bg-purple-500/20 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400'
                        : 'text-gray-700 hover:bg-purple-100/30 hover:text-purple-600 dark:text-gray-300 dark:hover:text-purple-400 dark:hover:bg-purple-500/10'
                    }`}
                  >
                    <Icon className='h-4 w-4 mr-2' />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* 右側按鈕 - 調整為更靠右，增加間距實現對稱效果 */}
          <div className='flex items-center gap-3 -mr-2'>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </div>
    </nav>
  );
};

const PageLayout = ({ children, activePath = '/' }: PageLayoutProps) => {
  return (
    <div className='w-full min-h-screen'>
      {/* 移動端頭部 (fixed) */}
      <MobileHeader showBackButton={['/play'].includes(activePath)} />

      {/* 桌面端頂部導航欄 (fixed) */}
      <TopNavbar activePath={activePath} />

  {/* 主內容區域 - 預留桌面端頂部導航高度 64px */}
  <div className='relative min-w-0 transition-all duration-300 md:pt-16'>
        {/* 桌面端左上角返回按鈕 */}
        {['/play'].includes(activePath) && (
          <div className='absolute top-3 left-1 z-20 hidden md:flex'>
            <BackButton />
          </div>
        )}

        {/* 主內容容器 - 為播放頁面使用特殊佈局（83.33%寬度），其他頁面使用預設佈局（66.67%寬度） */}
        <main className='mb-14 md:mb-0 md:p-6 lg:p-8'>
          {/* 使用flex佈局實現寬度控制 */}
          <div className='flex w-full min-h-[calc(100vh-4rem)]'>
            {/* 左側留白區域 - 播放頁面占8.33%，其他頁面占16.67% */}
            <div
              className='hidden md:block flex-shrink-0'
              style={{ 
                width: ['/play'].includes(activePath) ? '8.33%' : '16.67%' 
              }}
            ></div>

            {/* 主內容區 - 播放頁面占83.33%，其他頁面占66.67% */}
            <div
              className='flex-1 md:flex-none rounded-container w-full'
              style={{ 
                width: ['/play'].includes(activePath) ? '83.33%' : '66.67%' 
              }}
            >
              <div
                className='p-4 md:p-8 lg:p-10'
                style={{
                  paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom))',
                }}
              >
                {children}
              </div>
            </div>

            {/* 右側留白區域 - 播放頁面占8.33%，其他頁面占16.67% */}
            <div
              className='hidden md:block flex-shrink-0'
              style={{ 
                width: ['/play'].includes(activePath) ? '8.33%' : '16.67%' 
              }}
            ></div>
          </div>
        </main>
      </div>

      {/* 移動端底部導航 */}
      <div className='md:hidden'>
        <MobileBottomNav activePath={activePath} />
      </div>
    </div>
  );
};

export default PageLayout;
