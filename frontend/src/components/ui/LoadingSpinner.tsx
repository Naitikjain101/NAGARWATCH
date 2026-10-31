import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerColor = 'primary' | 'white' | 'muted';

export interface LoadingSpinnerProps {
  size?: SpinnerSize;
  color?: SpinnerColor;
  className?: string;
  label?: string;
  center?: boolean;
}

const sizeStyles: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

const colorStyles: Record<SpinnerColor, string> = {
  primary: 'text-[#1E60D5]',
  white: 'text-white',
  muted: 'text-slate-400',
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className,
  label = 'Loading...',
  center = false,
}) => {
  const spinner = (
    <div
      role="status"
      className={cn('inline-flex items-center gap-2.5', center && 'flex-col justify-center min-h-[160px] w-full')}
    >
      <Loader2
        className={cn('animate-spin shrink-0', sizeStyles[size], colorStyles[color], className)}
        aria-hidden="true"
      />
      {label && (
        <span className={cn('text-sm font-medium', color === 'white' ? 'text-white' : 'text-slate-600')}>
          {label}
        </span>
      )}
      <span className="sr-only">{label}</span>
    </div>
  );

  return spinner;
};

LoadingSpinner.displayName = 'LoadingSpinner';

