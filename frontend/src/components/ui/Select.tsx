import React from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown, AlertCircle } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
  theme?: 'light' | 'dark';
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      options,
      children,
      id,
      disabled,
      required,
      theme = 'light',
      ...props
    },
    ref
  ) => {
    const selectId = id || React.useId();
    const errorId = error ? `${selectId}-error` : undefined;
    const helperId = helperText ? `${selectId}-helper` : undefined;
    const isDark = theme === 'dark';

    return (
      <div className="w-full space-y-1.5 text-left font-sans">
        {label && (
          <label
            htmlFor={selectId}
            className={cn(
              'block text-xs sm:text-sm font-medium',
              isDark ? 'text-[#F3F6FC]' : 'text-[#172033]'
            )}
          >
            {label}
            {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={errorId || helperId}
            className={cn(
              'block w-full appearance-none rounded-lg border px-3.5 py-2.5 pr-10 text-xs sm:text-sm transition-colors min-h-[44px] cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
              'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
              isDark
                ? 'bg-[#141F33] text-[#F3F6FC] border-[#293750] focus-visible:border-[#5688F5] focus-visible:ring-[#5688F5]/30'
                : 'bg-white text-[#172033] border-[#E3E7EE] focus-visible:border-[#356AE6] focus-visible:ring-[#356AE6]/20',
              error
                ? 'border-red-500 text-red-900 focus-visible:border-red-500 focus-visible:ring-red-500/20'
                : '',
              className
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
            {error ? (
              <AlertCircle className="w-4 h-4 text-red-500" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            )}
          </div>
        </div>

        {error && (
          <p id={errorId} className="text-xs text-red-600 font-medium">
            {error}
          </p>
        )}

        {helperText && !error && (
          <p id={helperId} className="text-xs text-[#687386]">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
