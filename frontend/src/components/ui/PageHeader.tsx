import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { IconButton } from './IconButton';
import { Breadcrumbs, BreadcrumbItem } from './Breadcrumbs';

export interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  breadcrumbs?: BreadcrumbItem[];
  theme?: 'light' | 'dark';
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  badge,
  onBack,
  backLabel = 'Go back',
  breadcrumbs,
  theme = 'light',
  className,
}) => {
  const isDark = theme === 'dark';

  return (
    <div className={cn('py-4 sm:py-6 space-y-2.5', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="mb-2">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {onBack && (
            <IconButton
              variant={isDark ? 'command' : 'outline'}
              size="sm"
              shape="square"
              aria-label={backLabel}
              onClick={onBack}
              className="mt-1 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </IconButton>
          )}

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1
                className={cn(
                  'text-xl sm:text-2xl lg:text-3xl font-heading font-bold tracking-tight truncate',
                  isDark ? 'text-[#F3F6FC]' : 'text-[#172033]'
                )}
              >
                {title}
              </h1>
              {badge && <div className="shrink-0">{badge}</div>}
            </div>

            {description && (
              <div
                className={cn(
                  'text-xs sm:text-sm font-sans leading-relaxed',
                  isDark ? 'text-[#A5B1C4]' : 'text-[#687386]'
                )}
              >
                {description}
              </div>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center flex-wrap">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

PageHeader.displayName = 'PageHeader';
