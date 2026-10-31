import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { IconButton } from './IconButton';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  asBottomSheetOnMobile?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEsc?: boolean;
}

const sizeStyles: Record<string, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  full: 'sm:max-w-6xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  asBottomSheetOnMobile = true,
  closeOnBackdropClick = true,
  closeOnEsc = true,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descId = React.useId();

  useEffect(() => {
    if (!isOpen) return;

    // Handle ESC key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEsc && e.key === 'Escape') {
        onClose();
      }
    };

    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeOnEsc, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex overflow-y-auto animate-in fade-in duration-200 font-sans',
        asBottomSheetOnMobile
          ? 'items-end sm:items-center justify-center p-0 sm:p-6'
          : 'items-center justify-center p-4 sm:p-6'
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0A1128]/60 backdrop-blur-xs transition-opacity"
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal Surface / Bottom Sheet */}
      <div
        ref={modalRef}
        className={cn(
          'relative w-full bg-white dark:bg-[#222226] border border-[#E3E7EE] dark:border-[#333338] text-[#1C1917] dark:text-[#F4F4F5] shadow-2xl',
          'flex flex-col overflow-hidden z-10 transition-all duration-200',
          asBottomSheetOnMobile
            ? 'rounded-t-2xl sm:rounded-lg max-h-[88vh] sm:max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95'
            : 'rounded-lg max-h-[90vh] animate-in zoom-in-95',
          sizeStyles[size]
        )}
      >
        {/* Mobile Drag Indicator */}
        {asBottomSheetOnMobile && (
          <div className="sm:hidden flex justify-center pt-2.5 pb-1">
            <span className="w-10 h-1 bg-slate-300 dark:bg-stone-600 rounded-full" />
          </div>
        )}

        {/* Header */}
        {(title || onClose) && (
          <div className="flex items-start justify-between px-5 py-4 sm:px-6 sm:py-4.5 border-b border-[#E3E7EE] dark:border-[#333338] bg-white dark:bg-[#222226] sticky top-0 z-10">
            <div className="pr-4">
              {title && (
                <h2 id={titleId} className="text-base sm:text-lg font-heading font-bold text-[#172033] dark:text-[#F4F4F5] tracking-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="text-xs text-[#687386] dark:text-[#A1A1AA] mt-0.5 leading-relaxed">
                  {description}
                </p>
              )}
            </div>

            <IconButton
              variant="ghost"
              size="sm"
              shape="square"
              aria-label="Close dialog"
              onClick={onClose}
              className="shrink-0 -mr-2"
            >
              <X className="w-4 h-4 text-[#687386] dark:text-[#A1A1AA]" />
            </IconButton>
          </div>
        )}

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-t border-[#E3E7EE] dark:border-[#333338] bg-[#F7F8FA] dark:bg-[#18181B] flex items-center justify-end gap-2.5 sticky bottom-0 z-10">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

Modal.displayName = 'Modal';
