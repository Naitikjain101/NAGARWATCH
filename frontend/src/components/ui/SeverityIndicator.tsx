import React from 'react';
import { cn } from '../../lib/utils';
import { normalizeSeverity, DESIGN_TOKENS } from '../../lib/designSystem';

export interface SeverityIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  severity?: string;
  size?: 'sm' | 'md';
  variant?: 'badge' | 'dot' | 'pill';
  showLabel?: boolean;
}

export const SeverityIndicator: React.FC<SeverityIndicatorProps> = ({
  severity = 'medium',
  size = 'md',
  variant = 'badge',
  showLabel = true,
  className,
  ...props
}) => {
  const key = normalizeSeverity(severity);
  const config = DESIGN_TOKENS.colors.severity[key];

  if (variant === 'dot') {
    const dotColors: Record<typeof key, string> = {
      low: 'bg-emerald-500',
      medium: 'bg-amber-500',
      high: 'bg-orange-500',
      critical: 'bg-red-600 animate-pulse',
    };
    return (
      <span className={cn('inline-flex items-center gap-1.5 font-sans', className)} {...props}>
        <span
          className={cn(
            'rounded-full shrink-0',
            dotColors[key],
            size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'
          )}
          aria-hidden="true"
        />
        {showLabel && (
          <span className={cn('capitalize font-medium text-[#172033]', size === 'sm' ? 'text-xs' : 'text-sm')}>
            {key}
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center font-sans font-medium border rounded-md capitalize tracking-tight',
        config.badge,
        size === 'sm' ? 'text-[11px] px-2 py-0.5 gap-1.5' : 'text-xs px-2.5 py-1 gap-1.5',
        className
      )}
      {...props}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full shrink-0',
          key === 'low' && 'bg-emerald-600',
          key === 'medium' && 'bg-amber-600',
          key === 'high' && 'bg-orange-600',
          key === 'critical' && 'bg-red-600'
        )}
        aria-hidden="true"
      />
      {showLabel && <span>{key}</span>}
    </span>
  );
};

SeverityIndicator.displayName = 'SeverityIndicator';

