import React from 'react';
import { cn } from '../../lib/utils';

export type CardVariant = 'default' | 'subtle' | 'command' | 'command-elevated';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  hoverable?: boolean;
}

const cardVariantStyles: Record<CardVariant, string> = {
  default: 'bg-[#FBF9F4] dark:bg-[#222226] border-[#E5E0D4] dark:border-[#333338] text-[#1C1917] dark:text-[#F4F4F5] shadow-xs',
  subtle: 'bg-[#EFECE4] dark:bg-[#2B2B30] border-[#E5E0D4] dark:border-[#333338] text-[#1C1917] dark:text-[#F4F4F5]',
  command: 'bg-[#18181B] border-[#333338] text-[#F4F4F5] shadow-sm',
  'command-elevated': 'bg-[#222226] border-[#333338] text-[#F4F4F5] shadow-md',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', hoverable = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-sm border overflow-hidden transition-all duration-150',
        cardVariantStyles[variant],
        hoverable && variant === 'default' && 'hover:border-[#D9381E]/50 dark:hover:border-[#F05030]/50 hover:shadow-sm cursor-pointer',
        hoverable && variant.startsWith('command') && 'hover:border-[#44444C] hover:bg-[#2B2B30] cursor-pointer',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-4 sm:p-5 flex flex-col space-y-1', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-base sm:text-lg font-heading font-semibold tracking-tight leading-snug', className)}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-xs sm:text-sm text-[#57534E] dark:text-[#A1A1AA] font-sans leading-relaxed', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-4 sm:p-5 pt-0 sm:pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'p-4 sm:p-5 pt-3 sm:pt-3 flex items-center justify-between border-t border-[#E5E0D4] dark:border-[#333338] bg-[#F4F1EA]/60 dark:bg-[#18181B]/60',
        className
      )}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';
