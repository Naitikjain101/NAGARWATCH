import React from 'react';
import { cn } from '../../lib/utils';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'outline';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-700 border-slate-200',
  primary: 'bg-[#EFF6FF] text-[#1E40AF] border-[#93C5FD]',
  success: 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]',
  warning: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]',
  danger: 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]',
  neutral: 'bg-slate-100 text-slate-800 border-slate-200',
  outline: 'bg-white text-slate-700 border-slate-300',
};

const dotStyles: Record<BadgeVariant, string> = {
  default: 'bg-slate-400',
  primary: 'bg-[#1E60D5]',
  success: 'bg-[#16A34A]',
  warning: 'bg-[#D97706]',
  danger: 'bg-[#DC2626]',
  neutral: 'bg-slate-500',
  outline: 'bg-slate-400',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className,
  ...props
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium border rounded-full tracking-wide',
        variantStyles[variant],
        size === 'sm' ? 'text-[11px] px-2 py-0.5 gap-1.5' : 'text-xs px-2.5 py-0.5 gap-1.5',
        className
      )}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotStyles[variant])} />}
      <span>{children}</span>
    </span>
  );
};

Badge.displayName = 'Badge';

