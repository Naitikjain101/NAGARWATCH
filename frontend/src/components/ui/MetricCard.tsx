import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  change?: string | number;
  changeDirection?: 'up' | 'down' | 'neutral';
  changeLabel?: string;
  icon?: React.ReactNode;
  theme?: 'light' | 'dark';
  accent?: 'blue' | 'indigo' | 'amber' | 'emerald' | 'red';
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  change,
  changeDirection = 'neutral',
  changeLabel,
  icon,
  theme = 'light',
  accent = 'blue',
  onClick,
  className,
  ...props
}) => {
  const isDark = theme === 'dark';

  const accentPills: Record<typeof accent, string> = {
    blue: isDark ? 'bg-blue-900/30 text-blue-400 border-blue-800/40' : 'bg-blue-50 text-blue-600 border-blue-100',
    indigo: isDark ? 'bg-indigo-900/30 text-indigo-400 border-indigo-800/40' : 'bg-indigo-50 text-indigo-600 border-indigo-100',
    amber: isDark ? 'bg-amber-900/30 text-amber-400 border-amber-800/40' : 'bg-amber-50 text-amber-600 border-amber-100',
    emerald: isDark ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40' : 'bg-emerald-50 text-emerald-600 border-emerald-100',
    red: isDark ? 'bg-red-900/30 text-red-400 border-red-800/40' : 'bg-red-50 text-red-600 border-red-100',
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-4 sm:p-5 rounded-lg border transition-all duration-150 font-sans',
        onClick && 'cursor-pointer active:scale-[0.99]',
        isDark
          ? 'bg-[#141F33] border-[#293750] text-[#F3F6FC] hover:border-[#3E5275]'
          : 'bg-white border-[#E3E7EE] text-[#172033] shadow-xs hover:border-[#CBD5E1]',
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <span
          className={cn(
            'text-xs font-heading font-semibold uppercase tracking-wider',
            isDark ? 'text-[#A5B1C4]' : 'text-[#687386]'
          )}
        >
          {label}
        </span>
        {icon && (
          <div className={cn('p-2 rounded-lg border shrink-0', accentPills[accent])}>
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <span className="text-2xl sm:text-3xl font-heading font-bold tracking-tight font-mono-id">
          {value}
        </span>

        {change !== undefined && (
          <div
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium font-sans px-1.5 py-0.5 rounded border',
              changeDirection === 'up' && 'text-emerald-700 bg-emerald-50 border-emerald-200',
              changeDirection === 'down' && 'text-red-700 bg-red-50 border-red-200',
              changeDirection === 'neutral' && (isDark ? 'text-[#A5B1C4] bg-[#1B2940] border-[#293750]' : 'text-[#687386] bg-[#F0F3F8] border-[#E3E7EE]')
            )}
          >
            {changeDirection === 'up' && <TrendingUp className="w-3 h-3" />}
            {changeDirection === 'down' && <TrendingDown className="w-3 h-3" />}
            {changeDirection === 'neutral' && <Minus className="w-3 h-3" />}
            <span>{change}</span>
            {changeLabel && <span className="opacity-75">{changeLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

MetricCard.displayName = 'MetricCard';

