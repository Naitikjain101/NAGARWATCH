import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';

export interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className,
  showLabel = false,
  size = 'sm',
}) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'relative inline-flex items-center justify-center font-mono rounded-xs border transition-colors cursor-pointer select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9381E] focus-visible:ring-offset-1',
        // Light theme styling
        'bg-[#FBF9F4] text-[#1C1917] border-[#E5E0D4] hover:bg-[#EFECE4] hover:border-[#D8D2C5]',
        // Dark theme styling
        'dark:bg-[#222226] dark:text-[#F4F4F5] dark:border-[#333338] dark:hover:bg-[#2B2B30] dark:hover:border-[#44444C]',
        size === 'sm' ? 'h-9 px-2.5 text-xs gap-1.5' : 'h-10 px-3 text-sm gap-2',
        className
      )}
    >
      {isDark ? (
        <Sun className={cn('text-amber-400 stroke-[2] transition-transform duration-200 rotate-0 hover:rotate-45', size === 'sm' ? 'w-4 h-4' : 'w-4.5 h-4.5')} />
      ) : (
        <Moon className={cn('text-[#57534E] stroke-[2] transition-transform duration-200 rotate-0 hover:-rotate-12', size === 'sm' ? 'w-4 h-4' : 'w-4.5 h-4.5')} />
      )}
      {showLabel && (
        <span className="font-sans font-medium text-xs text-[#57534E] dark:text-[#A1A1AA]">
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </span>
      )}
    </button>
  );
};

ThemeToggle.displayName = 'ThemeToggle';

