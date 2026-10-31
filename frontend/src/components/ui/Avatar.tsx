import React, { useState } from 'react';
import { User } from 'lucide-react';
import { cn } from '../../lib/utils';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  status?: 'online' | 'busy' | 'offline';
}

const sizeStyles: Record<AvatarSize, { container: string; text: string; icon: string; dot: string }> = {
  sm: { container: 'w-7 h-7', text: 'text-xs', icon: 'w-3.5 h-3.5', dot: 'w-2 h-2' },
  md: { container: 'w-9 h-9', text: 'text-sm', icon: 'w-4 h-4', dot: 'w-2.5 h-2.5' },
  lg: { container: 'w-12 h-12', text: 'text-base', icon: 'w-6 h-6', dot: 'w-3 h-3' },
  xl: { container: 'w-16 h-16', text: 'text-lg', icon: 'w-8 h-8', dot: 'w-3.5 h-3.5' },
};

const statusStyles: Record<string, string> = {
  online: 'bg-green-500',
  busy: 'bg-amber-500',
  offline: 'bg-slate-400',
};

function getInitials(name?: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  name,
  size = 'md',
  status,
  className,
  ...props
}) => {
  const [imageError, setImageError] = useState(false);
  const initials = getInitials(name);
  const sizeConfig = sizeStyles[size];

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-full shrink-0 select-none overflow-hidden bg-slate-100 border border-slate-200 font-semibold text-slate-700',
        sizeConfig.container,
        className
      )}
      {...props}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt={alt}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
        />
      ) : initials ? (
        <span className={sizeConfig.text}>{initials}</span>
      ) : (
        <User className={cn('text-slate-400', sizeConfig.icon)} aria-hidden="true" />
      )}

      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-white',
            sizeConfig.dot,
            statusStyles[status]
          )}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

Avatar.displayName = 'Avatar';

