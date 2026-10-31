import React, { useRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SearchFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
  shortcut?: string;
  theme?: 'light' | 'dark';
}

export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  (
    {
      value,
      onChange,
      onClear,
      placeholder = 'Search incidents, categories, or wards...',
      shortcut,
      theme = 'light',
      className,
      ...props
    },
    ref
  ) => {
    const isDark = theme === 'dark';
    const innerRef = useRef<HTMLInputElement | null>(null);

    const handleClear = () => {
      if (onClear) {
        onClear();
      }
      if (innerRef.current) {
        innerRef.current.value = '';
        innerRef.current.focus();
      }
    };

    const hasValue = Boolean(value);

    return (
      <div className={cn('relative flex items-center w-full font-sans', className)}>
        <Search
          className={cn(
            'absolute left-3 w-4 h-4 pointer-events-none shrink-0 transition-colors',
            isDark ? 'text-[#687386]' : 'text-[#94A3B8]'
          )}
          aria-hidden="true"
        />

        <input
          ref={(node) => {
            innerRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          type="search"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={cn(
            'w-full pl-9 pr-9 py-2 text-xs sm:text-sm rounded-lg border transition-all duration-150',
            'focus:outline-none focus:ring-2 placeholder:text-slate-400',
            isDark
              ? 'bg-[#141F33] border-[#293750] text-[#F3F6FC] focus:border-[#5688F5] focus:ring-[#5688F5]/30'
              : 'bg-white border-[#E3E7EE] text-[#172033] focus:border-[#356AE6] focus:ring-[#356AE6]/20 shadow-xs'
          )}
          {...props}
        />

        {hasValue ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className={cn(
              'absolute right-2.5 p-1 rounded-md transition-colors',
              isDark ? 'text-[#A5B1C4] hover:text-white hover:bg-[#1B2940]' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            )}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : shortcut ? (
          <kbd
            className={cn(
              'hidden sm:inline-flex absolute right-2.5 items-center px-1.5 py-0.5 text-[10px] font-mono border rounded',
              isDark ? 'bg-[#1B2940] border-[#293750] text-[#A5B1C4]' : 'bg-slate-50 border-slate-200 text-slate-500'
            )}
          >
            {shortcut}
          </kbd>
        ) : null}
      </div>
    );
  }
);

SearchField.displayName = 'SearchField';

