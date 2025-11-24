'use client';

import { Clover, Film, Home, Search, Tv } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface MobileBottomNavProps {
  /**
   * 主動指定當前啟用的路徑。當未提供時，自動使用 usePathname() 獲取的路徑。
   */
  activePath?: string;
}

const MobileBottomNav = ({ activePath }: MobileBottomNavProps) => {
  const pathname = usePathname();

  // 目前啟用路徑：優先使用傳入的 activePath，否則回退到瀏覽器地址
  const currentActive = activePath ?? pathname;

  const navItems = [
    { icon: Home, label: '首頁', href: '/' },
    { icon: Search, label: '搜索', href: '/search' },
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

  const isActive = (href: string) => {
    const typeMatch = href.match(/type=([^&]+)/)?.[1];

    // 解碼URL以進行正確的比較
    const decodedActive = decodeURIComponent(currentActive);
    const decodedItemHref = decodeURIComponent(href);

    return (
      decodedActive === decodedItemHref ||
      (decodedActive.startsWith('/douban') &&
        decodedActive.includes(`type=${typeMatch}`))
    );
  };

  return (
    <nav
      className='md:hidden fixed left-0 right-0 z-[600] bg-white/90 backdrop-blur-xl border-t border-purple-200/50 overflow-hidden dark:bg-gray-900/80 dark:border-purple-700/50 shadow-lg'
      style={{
        /* 緊貼視口底部，同時在內部留出安全區高度 */
        bottom: 0,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* 頂部裝飾線 */}
      <div className='absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent'></div>

      <ul className='flex items-center'>
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href} className='flex-shrink-0 w-1/5'>
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center w-full h-14 gap-1 text-xs transition-all duration-200 relative ${
                  active
                    ? 'transform -translate-y-1'
                    : 'hover:transform hover:-translate-y-0.5'
                }`}
              >
                {/* 啟用狀態的背景光暈 */}
                {active && (
                  <div className='absolute inset-0 bg-purple-500/10 rounded-lg mx-2 my-1 border border-purple-300/20'></div>
                )}

                <item.icon
                  className={`h-6 w-6 transition-all duration-200 ${
                    active
                      ? 'text-purple-600 dark:text-purple-400 scale-110'
                      : 'text-gray-500 dark:text-gray-400 hover:text-purple-500 dark:hover:text-purple-300'
                  }`}
                />
                <span
                  className={`transition-all duration-200 font-medium ${
                    active
                      ? 'text-purple-600 dark:text-purple-400'
                      : 'text-gray-600 dark:text-gray-300 hover:text-purple-500 dark:hover:text-purple-300'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileBottomNav;
