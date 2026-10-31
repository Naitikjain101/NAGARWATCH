import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  theme?: 'light' | 'dark';
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There is currently no data matching your criteria.',
  onRowClick,
  sortColumn,
  sortDirection,
  onSort,
  theme = 'light',
  className,
}: DataTableProps<T>) {
  const isDark = theme === 'dark';

  if (isLoading) {
    return (
      <div
        className={cn(
          'p-12 flex flex-col items-center justify-center rounded-lg border gap-3',
          isDark ? 'bg-[#141F33] border-[#293750]' : 'bg-white border-[#E3E7EE]'
        )}
      >
        <LoadingSpinner size="lg" />
        <span className={cn('text-xs font-medium', isDark ? 'text-[#A5B1C4]' : 'text-[#687386]')}>
          Loading records...
        </span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={cn(
          'rounded-lg border',
          isDark ? 'bg-[#141F33] border-[#293750]' : 'bg-white border-[#E3E7EE]'
        )}
      >
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border overflow-hidden font-sans transition-all duration-150',
        isDark ? 'bg-[#141F33] border-[#293750]' : 'bg-white border-[#E3E7EE] shadow-xs',
        className
      )}
    >
      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr
              className={cn(
                'border-b text-xs font-heading font-semibold uppercase tracking-wider',
                isDark
                  ? 'bg-[#1B2940] border-[#293750] text-[#A5B1C4]'
                  : 'bg-[#F7F8FA] border-[#E3E7EE] text-[#687386]'
              )}
            >
              {columns.map((col) => {
                const isSorted = sortColumn === col.key;
                const alignClass =
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                    ? 'text-center'
                    : 'text-left';

                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn('px-4 py-3 font-semibold select-none', alignClass, col.className)}
                  >
                    {col.sortable && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        className="inline-flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
                      >
                        <span>{col.header}</span>
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-[#5688F5]" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-[#5688F5]" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                        )}
                      </button>
                    ) : (
                      <span>{col.header}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className={cn('divide-y text-xs sm:text-sm', isDark ? 'divide-[#293750]' : 'divide-[#E3E7EE]')}>
            {data.map((row, index) => {
              const rowKey = keyExtractor(row, index);
              return (
                <tr
                  key={rowKey}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={cn(
                    'transition-colors duration-100',
                    onRowClick && 'cursor-pointer',
                    isDark
                      ? 'text-[#F3F6FC] hover:bg-[#1B2940]/70'
                      : 'text-[#172033] hover:bg-[#F0F3F8]/60'
                  )}
                >
                  {columns.map((col) => {
                    const alignClass =
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left';

                    return (
                      <td key={col.key} className={cn('px-4 py-3.5', alignClass, col.className)}>
                        {col.render
                          ? col.render(row, index)
                          : String((row as Record<string, unknown>)[col.key] ?? '—')}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

DataTable.displayName = 'DataTable';

