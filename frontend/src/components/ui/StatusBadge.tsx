import React from 'react';
import { cn } from '../../lib/utils';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  UserCheck,
  ShieldCheck,
  Circle,
  Lock,
} from 'lucide-react';

export type BackendStatus =
  | 'pending'
  | 'reported'
  | 'verified'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'rejected'
  | 'closed'
  | 'urgent';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  theme?: 'light' | 'command';
}

interface StatusConfig {
  label: string;
  lightClass: string;
  commandClass: string;
  dotColor: string;
  icon: React.ComponentType<{ className?: string }>;
}

const statusConfigs: Record<string, StatusConfig> = {
  pending: {
    label: 'Pending Review',
    lightClass: 'bg-[#EBF3FA] text-[#1E5A8A] border-[#BCD6ED]',
    commandClass: 'bg-[#162838] text-[#6BA3D6] border-[#234460]',
    dotColor: 'bg-[#1E5A8A]',
    icon: Circle,
  },
  reported: {
    label: 'Reported',
    lightClass: 'bg-[#EBF3FA] text-[#1E5A8A] border-[#BCD6ED]',
    commandClass: 'bg-[#162838] text-[#6BA3D6] border-[#234460]',
    dotColor: 'bg-[#1E5A8A]',
    icon: Circle,
  },
  verified: {
    label: 'Community Verified',
    lightClass: 'bg-[#E6F7F5] text-[#0E6F64] border-[#A7E3DC]',
    commandClass: 'bg-[#122D29] text-[#38B2AC] border-[#1A4D46]',
    dotColor: 'bg-[#0E6F64]',
    icon: ShieldCheck,
  },
  assigned: {
    label: 'Assigned',
    lightClass: 'bg-[#FEF7EA] text-[#8C5303] border-[#F7D7A3]',
    commandClass: 'bg-[#302210] text-[#E2A03F] border-[#503818]',
    dotColor: 'bg-[#8C5303]',
    icon: UserCheck,
  },
  in_progress: {
    label: 'In Progress',
    lightClass: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]',
    commandClass: 'bg-[#332008] text-[#F59E0B] border-[#593810]',
    dotColor: 'bg-[#92400E]',
    icon: Clock,
  },
  resolved: {
    label: 'Resolved',
    lightClass: 'bg-[#EDF7F0] text-[#166534] border-[#B7E4C7]',
    commandClass: 'bg-[#132A1C] text-[#4ADE80] border-[#1F472F]',
    dotColor: 'bg-[#166534]',
    icon: CheckCircle2,
  },
  closed: {
    label: 'Closed',
    lightClass: 'bg-[#F5F5F4] text-[#44403C] border-[#D6D3D1]',
    commandClass: 'bg-[#262422] text-[#A8A29E] border-[#3D3A37]',
    dotColor: 'bg-[#78716C]',
    icon: Lock,
  },
  rejected: {
    label: 'Rejected',
    lightClass: 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]',
    commandClass: 'bg-[#361515] text-[#F87171] border-[#5C2222]',
    dotColor: 'bg-[#991B1B]',
    icon: XCircle,
  },
  urgent: {
    label: 'Urgent Target',
    lightClass: 'bg-[#FEF2F2] text-[#B91C1C] border-[#F87171] font-semibold',
    commandClass: 'bg-[#361515] text-[#EF4444] border-[#6E2525] font-semibold',
    dotColor: 'bg-[#B91C1C]',
    icon: AlertTriangle,
  },
};

const defaultConfig: StatusConfig = {
  label: 'Unknown',
  lightClass: 'bg-stone-100 text-stone-700 border-stone-200',
  commandClass: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  dotColor: 'bg-stone-400',
  icon: AlertTriangle,
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
  theme = 'light',
  className,
  ...props
}) => {
  const normKey = (status || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  const config = statusConfigs[normKey] || defaultConfig;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-[11px] px-1.5 py-0.5 gap-1 font-mono-id',
    md: 'text-xs px-2 py-0.5 gap-1.5 font-medium',
  };

  const themeClass = theme === 'command' ? config.commandClass : config.lightClass;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-xs border transition-colors shrink-0 select-none tracking-tight',
        sizeClasses[size],
        themeClass,
        className
      )}
      {...props}
    >
      {showIcon && (
        <Icon className={cn(size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5', 'shrink-0')} />
      )}
      <span>{config.label}</span>
    </span>
  );
};
