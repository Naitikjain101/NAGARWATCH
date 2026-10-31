import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  theme?: 'light' | 'dark';
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 10,
  onPageChange,
  theme = 'light',
  className,
}) => {
  if (totalPages <= 1) return null;

  const isDark = theme === 'dark';

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = totalItems ? Math.min(currentPage * pageSize, totalItems) : currentPage * pageSize;

  // Generate page numbers with window around current
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t font-sans',
        isDark ? 'border-[#293750] text-[#A5B1C4]' : 'border-[#E3E7EE] text-[#687386]',
        className
      )}
    >
      {/* Item Range Count */}
      <div className="text-xs">
        {totalItems ? (
          <span>
            Showing <strong className={isDark ? 'text-white' : 'text-[#172033]'}>{startItem}</strong> to{' '}
            <strong className={isDark ? 'text-white' : 'text-[#172033]'}>{endItem}</strong> of{' '}
            <strong className={isDark ? 'text-white' : 'text-[#172033]'}>{totalItems}</strong> records
          </span>
        ) : (
          <span>
            Page <strong className={isDark ? 'text-white' : 'text-[#172033]'}>{currentPage}</strong> of{' '}
            <strong className={isDark ? 'text-white' : 'text-[#172033]'}>{totalPages}</strong>
          </span>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-1.5">
        <Button
          variant={isDark ? 'command' : 'outline'}
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
          leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
        >
          <span className="hidden sm:inline">Prev</span>
        </Button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, idx) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs opacity-50 select-none">
                  ...
                </span>
              );
            }

            const pageNum = Number(page);
            const isCurrent = pageNum === currentPage;

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={cn(
                  'w-8 h-8 rounded-md text-xs font-medium font-mono-id transition-colors flex items-center justify-center cursor-pointer',
                  isCurrent
                    ? isDark
                      ? 'bg-[#5688F5] text-white font-bold'
                      : 'bg-[#356AE6] text-white font-bold'
                    : isDark
                    ? 'text-[#A5B1C4] hover:bg-[#1B2940] hover:text-white'
                    : 'text-[#172033] hover:bg-[#F0F3F8]'
                )}
                aria-current={isCurrent ? 'page' : undefined}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <Button
          variant={isDark ? 'command' : 'outline'}
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
          rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
        >
          <span className="hidden sm:inline">Next</span>
        </Button>
      </div>
    </div>
  );
};

Pagination.displayName = 'Pagination';

