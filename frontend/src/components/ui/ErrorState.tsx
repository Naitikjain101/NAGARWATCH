import React from 'react';
import { cn } from '../../lib/utils';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  isRetrying?: boolean;
  theme?: 'light' | 'dark';
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try Again',
  isRetrying = false,
  theme = 'light',
  className,
}) => {
  const isDark = theme === 'dark';

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-lg border font-sans',
        isDark ? 'bg-red-950/20 border-red-900/40 text-[#F3F6FC]' : 'bg-red-50/50 border-red-200 text-[#172033]',
        className
      )}
    >
      <div className="w-12 h-12 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center text-red-600 mb-3.5">
        <AlertCircle className="w-6 h-6" aria-hidden="true" />
      </div>
      <h3 className="text-base sm:text-lg font-heading font-semibold tracking-tight text-[#172033] mb-1">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-[#687386] max-w-sm mb-5 leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          isLoading={isRetrying}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          onClick={onRetry}
          className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
};

ErrorState.displayName = 'ErrorState';
