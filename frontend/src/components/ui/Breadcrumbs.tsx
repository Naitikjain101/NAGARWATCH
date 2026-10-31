import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrent?: boolean;
}

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
  showHome?: boolean;
  homeHref?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  showHome = true,
  homeHref = '/',
  className,
  ...props
}) => {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center text-xs sm:text-sm font-sans text-[#687386]', className)}
      {...props}
    >
      <ol className="flex items-center gap-1.5 flex-wrap">
        {showHome && (
          <li className="flex items-center gap-1.5">
            <Link
              to={homeHref}
              className="flex items-center text-[#687386] hover:text-[#172033] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#356AE6] rounded p-0.5"
              aria-label="Home"
            >
              <Home className="w-3.5 h-3.5" />
            </Link>
            {items.length > 0 && (
              <ChevronRight className="w-3.5 h-3.5 text-[#A5B1C4] shrink-0" aria-hidden="true" />
            )}
          </li>
        )}

        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isCurrent = item.isCurrent || isLast;

          return (
            <li key={index} className="flex items-center gap-1.5 max-w-[200px] sm:max-w-xs truncate">
              {item.href && !isCurrent ? (
                <Link
                  to={item.href}
                  className="text-[#687386] hover:text-[#172033] hover:underline transition-colors truncate focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#356AE6] rounded"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    'truncate',
                    isCurrent ? 'font-semibold text-[#172033]' : 'text-[#687386]'
                  )}
                  aria-current={isCurrent ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}

              {!isLast && (
                <ChevronRight className="w-3.5 h-3.5 text-[#A5B1C4] shrink-0" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

Breadcrumbs.displayName = 'Breadcrumbs';

