import React from 'react';
import { cn } from '../../lib/utils';
import { AlertCircle } from 'lucide-react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  theme?: 'light' | 'dark';
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, disabled, required, rows = 3, theme = 'light', ...props }, ref) => {
    const textareaId = id || React.useId();
    const errorId = error ? `${textareaId}-error` : undefined;
    const helperId = helperText ? `${textareaId}-helper` : undefined;
    const isDark = theme === 'dark';

    return (
      <div className="w-full space-y-1.5 text-left font-sans">
        {label && (
          <label
            htmlFor={textareaId}
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
          <textarea
            ref={ref}
            id={textareaId}
            rows={rows}
            disabled={disabled}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={errorId || helperId}
            className={cn(
              'block w-full rounded-lg border px-3.5 py-2.5 text-xs sm:text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
              'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
              isDark
                ? 'bg-[#141F33] text-[#F3F6FC] placeholder:text-[#687386] border-[#293750] focus-visible:border-[#5688F5] focus-visible:ring-[#5688F5]/30'
                : 'bg-white text-[#172033] placeholder:text-slate-400 border-[#E3E7EE] focus-visible:border-[#356AE6] focus-visible:ring-[#356AE6]/20',
              error
                ? 'border-red-500 text-red-900 focus-visible:border-red-500 focus-visible:ring-red-500/20'
                : '',
              className
            )}
            {...props}
          />

          {error && (
            <div className="absolute top-3 right-3 pointer-events-none text-red-500">
              <AlertCircle className="w-4 h-4" aria-hidden="true" />
            </div>
          )}
        </div>

        {error && (
          <p id={errorId} className="text-xs text-red-600 flex items-center gap-1 mt-1 font-medium" role="alert">
            {error}
          </p>
        )}

        {!error && helperText && (
          <p id={helperId} className="text-xs text-[#687386]">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
