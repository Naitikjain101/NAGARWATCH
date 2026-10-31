import React from 'react';
import { cn } from '../../lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  theme?: 'light' | 'dark';
}

export const Skeleton: React.FC<SkeletonProps> = ({ theme = 'light', className, ...props }) => {
  const isDark = theme === 'dark';
  return (
    <div
      className={cn(
        'animate-pulse rounded-md',
        isDark ? 'bg-[#1B2940]' : 'bg-[#E3E7EE]',
        className
      )}
      {...props}
    />
  );
};

export const IncidentCardSkeleton: React.FC<{ theme?: 'light' | 'dark'; count?: number }> = ({
  theme = 'light',
  count = 3,
}) => {
  const isDark = theme === 'dark';
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'p-4 rounded-lg border flex flex-col sm:flex-row gap-4',
            isDark ? 'bg-[#141F33] border-[#293750]' : 'bg-white border-[#E3E7EE]'
          )}
        >
          <Skeleton theme={theme} className="w-full sm:w-40 h-32 rounded-lg shrink-0" />
          <div className="flex-1 space-y-3 py-1">
            <div className="flex items-center gap-2">
              <Skeleton theme={theme} className="w-20 h-5" />
              <Skeleton theme={theme} className="w-16 h-5" />
            </div>
            <Skeleton theme={theme} className="w-3/4 h-5" />
            <Skeleton theme={theme} className="w-full h-4" />
            <div className="pt-2 flex items-center justify-between">
              <Skeleton theme={theme} className="w-28 h-4" />
              <Skeleton theme={theme} className="w-16 h-4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const MetricCardSkeleton: React.FC<{ count?: number; theme?: 'light' | 'dark' }> = ({
  count = 4,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'p-5 rounded-lg border space-y-3',
            isDark ? 'bg-[#141F33] border-[#293750]' : 'bg-white border-[#E3E7EE]'
          )}
        >
          <div className="flex justify-between items-center">
            <Skeleton theme={theme} className="w-20 h-4" />
            <Skeleton theme={theme} className="w-8 h-8 rounded-lg" />
          </div>
          <Skeleton theme={theme} className="w-16 h-8" />
        </div>
      ))}
    </div>
  );
};

