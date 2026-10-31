import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Home, Compass, Plus, FileText, User } from 'lucide-react';
import { cn } from '../../lib/utils';

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  isReport?: boolean;
  matchPrefixes?: string[];
}

export const CitizenBottomNav: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  const navItems: NavItem[] = [
    {
      label: 'Home',
      path: '/',
      icon: Home,
    },
    {
      label: 'Explore',
      path: '/explore',
      matchPrefixes: ['/explore', '/civic-media'],
      icon: Compass,
    },
    {
      label: 'Report',
      path: '/report',
      icon: Plus,
      isReport: true,
    },
    {
      label: 'My Reports',
      path: user ? '/my-reports' : '/login',
      matchPrefixes: ['/my-reports', '/dashboard'],
      icon: FileText,
    },
    {
      label: user ? 'Profile' : 'Log In',
      path: user ? '/profile' : '/login',
      matchPrefixes: ['/profile', '/login', '/signup'],
      icon: User,
    },
  ];

  const isItemActive = (item: NavItem) => {
    if (item.path === '/') return location.pathname === '/';
    if (item.matchPrefixes) {
      return item.matchPrefixes.some((prefix) => location.pathname.startsWith(prefix));
    }
    return location.pathname.startsWith(item.path);
  };

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 bg-[#FBF9F4] dark:bg-[#18181B] border-t border-[#E5E0D4] dark:border-[#333338] z-50 px-2 py-1 pb-[calc(env(safe-area-inset-bottom,0px)+6px)] font-sans shadow-xs transition-colors duration-150"
    >
      <div className="flex items-center justify-around max-w-md mx-auto relative">
        {navItems.map((item) => {
          const active = isItemActive(item);
          const IconComponent = item.icon;

          if (item.isReport) {
            return (
              <Link
                key={item.label}
                to={item.path}
                aria-label="Report an issue"
                className="flex flex-col items-center -mt-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9381E] rounded-full group"
              >
                <div
                  className={cn(
                    'w-13 h-13 rounded-full flex items-center justify-center text-white shadow-md transition-all active:scale-95',
                    active
                      ? 'bg-[#B82810] dark:bg-[#D9381E] ring-4 ring-[#EFECE4] dark:ring-[#2B2B30] shadow-[#D9381E]/30'
                      : 'bg-[#D9381E] dark:bg-[#F05030] hover:bg-[#B82810] ring-4 ring-[#FBF9F4] dark:ring-[#18181B] shadow-[#D9381E]/25'
                  )}
                >
                  <IconComponent className="w-6 h-6 stroke-[2.4]" />
                </div>
                <span
                  className={cn(
                    'text-[10px] font-semibold mt-1 tracking-tight',
                    active ? 'text-[#D9381E] dark:text-[#F05030]' : 'text-[#57534E] dark:text-[#A1A1AA]'
                  )}
                >
                  Report
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.label}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center py-1 px-3 rounded-sm transition-colors min-h-[44px] min-w-[48px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D9381E]',
                active
                  ? 'text-[#D9381E] dark:text-[#F05030] font-semibold'
                  : 'text-[#57534E] dark:text-[#A1A1AA] hover:text-[#1C1917] dark:hover:text-[#F4F4F5]'
              )}
            >
              <IconComponent className={cn('w-5 h-5', active ? 'stroke-[2.2]' : 'stroke-[1.8]')} />
              <span className="text-[10px] mt-1 tracking-tight truncate max-w-[64px] leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

CitizenBottomNav.displayName = 'CitizenBottomNav';
