import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ButtonVariant = 
  | 'primary' 
  | 'secondary' 
  | 'outline' 
  | 'ghost' 
  | 'destructive'
  | 'command'
  | 'command-accent';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[#356AE6] hover:bg-[#2857C5] active:bg-[#1E4EB8] text-white shadow-xs border border-transparent focus-visible:ring-[#356AE6]',
  secondary:
    'bg-[#F0F3F8] hover:bg-[#E3E7EE] text-[#172033] border border-transparent focus-visible:ring-slate-400',
  outline:
    'bg-white hover:bg-[#F7F8FA] text-[#172033] border border-[#E3E7EE] shadow-xs focus-visible:ring-slate-400',
  ghost:
    'bg-transparent hover:bg-[#F0F3F8] text-[#687386] hover:text-[#172033] border border-transparent focus-visible:ring-slate-400',
  destructive:
    'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-xs border border-transparent focus-visible:ring-red-500',
  command:
    'bg-[#141F33] hover:bg-[#1B2940] text-[#F3F6FC] border border-[#293750] shadow-xs focus-visible:ring-[#5688F5]',
  'command-accent':
    'bg-[#5688F5] hover:bg-[#356AE6] text-white shadow-xs border border-transparent focus-visible:ring-[#5688F5]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs px-3 py-1.5 rounded-md gap-1.5 h-8 min-h-[36px] sm:min-h-[32px]',
  md: 'text-sm px-4 py-2 rounded-lg gap-2 h-10 min-h-[44px] sm:min-h-[40px]',
  lg: 'text-base px-6 py-3 rounded-lg gap-2.5 h-12 min-h-[48px]',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      fullWidth = false,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center font-medium font-sans transition-all duration-150 select-none cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
        ) : (
          leftIcon && <span className="shrink-0 flex items-center">{leftIcon}</span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon && <span className="shrink-0 flex items-center">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
