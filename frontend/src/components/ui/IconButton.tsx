import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ButtonVariant, ButtonSize } from './Button';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  'aria-label': string; // Mandatory for accessibility
  shape?: 'circle' | 'square';
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[#356AE6] hover:bg-[#2857C5] text-white shadow-xs border border-transparent focus-visible:ring-[#356AE6]',
  secondary:
    'bg-[#F0F3F8] hover:bg-[#E3E7EE] text-[#172033] border border-transparent focus-visible:ring-slate-400',
  outline:
    'bg-white hover:bg-[#F7F8FA] text-[#172033] border border-[#E3E7EE] shadow-xs focus-visible:ring-slate-400',
  ghost:
    'bg-transparent hover:bg-[#F0F3F8] text-[#687386] hover:text-[#172033] border border-transparent focus-visible:ring-slate-400',
  destructive:
    'bg-red-600 hover:bg-red-700 text-white shadow-xs border border-transparent focus-visible:ring-red-500',
  command:
    'bg-[#141F33] hover:bg-[#1B2940] text-[#F3F6FC] border border-[#293750] shadow-xs focus-visible:ring-[#5688F5]',
  'command-accent':
    'bg-[#5688F5] hover:bg-[#356AE6] text-white shadow-xs border border-transparent focus-visible:ring-[#5688F5]',
};

const sizeStyles: Record<ButtonSize, { button: string; icon: string }> = {
  sm: { button: 'w-8 h-8 p-1.5 min-h-[36px] min-w-[36px] sm:min-h-[32px] sm:min-w-[32px]', icon: 'w-4 h-4' },
  md: { button: 'w-10 h-10 p-2 min-h-[44px] min-w-[44px]', icon: 'w-5 h-5' },
  lg: { button: 'w-12 h-12 p-2.5 min-h-[48px] min-w-[48px]', icon: 'w-6 h-6' },
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      variant = 'ghost',
      size = 'md',
      isLoading = false,
      shape = 'square',
      disabled,
      children,
      type = 'button',
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;
    const shapeStyle = shape === 'circle' ? 'rounded-full' : 'rounded-lg';

    return (
      <button
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center transition-all duration-150 select-none cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.95]',
          shapeStyle,
          variantStyles[variant],
          sizeStyles[size].button,
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className={cn('animate-spin', sizeStyles[size].icon)} aria-hidden="true" />
        ) : (
          children
        )}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
