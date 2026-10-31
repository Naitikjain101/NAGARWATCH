import React from 'react';
import { cn } from '../../lib/utils';
import { AlertCircle } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  theme?: 'light' | 'dark';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      id,
      disabled,
      required,
      theme = 'light',
      ...props
    },
    ref
  ) => {
    const inputId = id || React.useId();
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;
    const isDark = theme === 'dark';

    return (
      <div className="w-full space-y-1.5 text-left font-sans">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'block text-xs sm:text-sm font-medium',
              isDark ? 'text-[#F4F4F5]' : 'text-[#1C1917] dark:text-[#F4F4F5]'
            )}
          >
            {label}
            {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}

        <div className="relative rounded-sm shadow-2xs">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400 dark:text-stone-500">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={type}
            disabled={disabled}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={errorId || helperId}
            className={cn(
              'block w-full rounded-sm border px-3.5 py-2.5 text-xs sm:text-sm transition-colors min-h-[44px]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
              'disabled:bg-stone-100 disabled:text-stone-400 disabled:cursor-not-allowed dark:disabled:bg-stone-800 dark:disabled:text-stone-600',
              isDark
                ? 'bg-[#18181B] text-[#F4F4F5] placeholder:text-[#A1A1AA] border-[#333338] focus-visible:border-[#F05030] focus-visible:ring-[#F05030]/30'
                : 'bg-[#FBF9F4] dark:bg-[#18181B] text-[#1C1917] dark:text-[#F4F4F5] placeholder:text-stone-400 dark:placeholder:text-stone-500 border-[#E5E0D4] dark:border-[#333338] focus-visible:border-[#D9381E] dark:focus-visible:border-[#F05030] focus-visible:ring-[#D9381E]/20',
              error
                ? 'border-red-500 text-red-900 dark:text-red-300 focus-visible:border-red-500 focus-visible:ring-red-500/20'
                : '',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            {...props}
          />

          {rightIcon && !error && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-stone-400 dark:text-stone-500">
              {rightIcon}
            </div>
          )}

          {error && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-red-500">
              <AlertCircle className="w-4 h-4" aria-hidden="true" />
            </div>
          )}
        </div>

        {error && (
          <p id={errorId} className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 font-medium">
            <span>{error}</span>
          </p>
        )}

        {helperText && !error && (
          <p id={helperId} className="text-xs text-[#57534E] dark:text-[#A1A1AA]">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
