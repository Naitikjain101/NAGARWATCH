import React from 'react';
import { Filter, X, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

export interface FilterControlsProps {
  options: FilterOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onReset?: () => void;
  label?: string;
  theme?: 'light' | 'dark';
  className?: string;
}

export const FilterControls: React.FC<FilterControlsProps> = ({
  options,
  selectedValue,
  onSelect,
  onReset,
  label,
  theme = 'light',
  className,
}) => {
  const isDark = theme === 'dark';
  const hasActiveFilter = selectedValue !== 'all' && selectedValue !== '';

  return (
    <div className={cn('flex items-center gap-2 overflow-x-auto pb-1 font-sans no-scrollbar', className)}>
      {label && (
        <span
          className={cn(
            'flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider shrink-0 mr-1',
            isDark ? 'text-[#A5B1C4]' : 'text-[#687386]'
          )}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>{label}</span>
        </span>
      )}

      <div className="flex items-center gap-1.5 shrink-0">
        {options.map((option) => {
          const isActive = selectedValue === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 shrink-0 cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                isActive
                  ? isDark
                    ? 'bg-[#5688F5] text-white shadow-xs font-semibold'
                    : 'bg-[#356AE6] text-white shadow-xs font-semibold'
                  : isDark
                  ? 'bg-[#141F33] text-[#A5B1C4] hover:text-[#F3F6FC] hover:bg-[#1B2940] border border-[#293750]'
                  : 'bg-white text-[#172033] hover:bg-[#F0F3F8] border border-[#E3E7EE] shadow-xs'
              )}
            >
              <span>{option.label}</span>
              {typeof option.count === 'number' && (
                <span
                  className={cn(
                    'px-1.5 py-0.2 rounded-full text-[10px] font-mono-id',
                    isActive
                      ? 'bg-white/20 text-white'
                      : isDark
                      ? 'bg-[#1B2940] text-[#A5B1C4]'
                      : 'bg-[#F0F3F8] text-[#687386]'
                  )}
                >
                  {option.count}
                </span>
              )}
            </button>
          );
        })}

        {hasActiveFilter && onReset && (
          <button
            type="button"
            onClick={onReset}
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors ml-1',
              isDark
                ? 'text-[#A5B1C4] hover:text-white hover:bg-[#1B2940]'
                : 'text-[#687386] hover:text-[#172033] hover:bg-[#F0F3F8]'
            )}
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
};

FilterControls.displayName = 'FilterControls';

