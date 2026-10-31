import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { CitizenHeader } from './CitizenHeader';
import { CitizenBottomNav } from './CitizenBottomNav';
import { cn } from '../../lib/utils';

export const CitizenLayout: React.FC = () => {
  const location = useLocation();
  const isExplore =
    location.pathname.startsWith('/explore') || location.pathname.startsWith('/civic-media');

  return (
    <div className="min-h-screen bg-[#F4F1EA] dark:bg-[#18181B] flex flex-col font-sans text-[#1C1917] dark:text-[#F4F4F5] antialiased overflow-x-hidden selection:bg-[#D9381E]/15 selection:text-[#1C1917] dark:selection:text-[#F4F4F5] transition-colors duration-150">
      {/* Top Header */}
      <CitizenHeader />

      {/* Main Content Area: Edge-to-edge for Explore, Centered Container for Other Views */}
      <main
        className={cn(
          'flex-1 w-full',
          isExplore
            ? 'p-0 pb-16 md:pb-0 h-[calc(100vh-4rem)] relative overflow-hidden'
            : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-10'
        )}
      >
        <Outlet />
      </main>

      {/* Mobile Fixed Bottom Navigation */}
      <CitizenBottomNav />
    </div>
  );
};

CitizenLayout.displayName = 'CitizenLayout';
