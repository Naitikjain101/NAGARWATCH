import React from 'react';
import { cn } from '../../lib/utils';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  theme?: 'light' | 'dark';
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  theme = 'light',
  className,
}) => {
  const isDark = theme === 'dark';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-lg border font-sans',
        isDark ? 'bg-[#141F33] border-[#293750] text-[#F3F6FC]' : 'bg-white border-[#E3E7EE] text-[#172033] shadow-xs',
        className
      )}
    >
      <div
        className={cn(
          'w-12 h-12 rounded-lg border flex items-center justify-center mb-3.5',
          isDark ? 'bg-[#1B2940] border-[#293750] text-[#A5B1C4]' : 'bg-[#F0F3F8] border-[#E3E7EE] text-[#687386]'
        )}
      >
        {icon || <Inbox className="w-6 h-6" aria-hidden="true" />}
      </div>
      <h3 className={cn('text-base sm:text-lg font-heading font-semibold tracking-tight mb-1', isDark ? 'text-[#F3F6FC]' : 'text-[#172033]')}>
        {title}
      </h3>
      {description && (
        <p className={cn('text-xs sm:text-sm max-w-sm mb-5 leading-relaxed', isDark ? 'text-[#A5B1C4]' : 'text-[#687386]')}>
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};

EmptyState.displayName = 'EmptyState';
