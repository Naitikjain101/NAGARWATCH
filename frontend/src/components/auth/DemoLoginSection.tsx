import React, { useState } from 'react';
import {
  User,
  Shield,
  KeyRound,
  Loader2,
  Copy,
  Check,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export interface DemoAccount {
  role: 'citizen' | 'admin' | 'super_admin';
  roleLabel: string;
  badgeLabel: string;
  badgeColor: string;
  email: string;
  password: string;
  description: string;
  targetPortal: string;
  icon: React.ElementType;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: 'citizen',
    roleLabel: 'Citizen',
    badgeLabel: 'Citizen Portal',
    badgeColor: 'bg-[#F4F1EA] text-[#1C1917] border-[#D5CEBF] dark:bg-[#2B2B30] dark:text-[#F4F4F5] dark:border-[#3F3F46]',
    email: 'citizen@nagarwatch.org',
    password: 'NagarWatch@2026',
    description: 'Report civic issues, verify neighbourhood reports, track personal timeline & notifications.',
    targetPortal: '/',
    icon: User,
  },
  {
    role: 'admin',
    roleLabel: 'Ward Administrator',
    badgeLabel: 'Ward 1 Console',
    badgeColor: 'bg-[#FEF7EC] text-[#9A6700] border-[#F8E3BE] dark:bg-[#38260D] dark:text-[#FBBF24] dark:border-[#78350F]',
    email: 'admin@nagarwatch.org',
    password: 'NagarWatch@2026',
    description: 'Triage reported incidents, assign municipal crews, manage ward map, and upload resolution proof.',
    targetPortal: '/admin',
    icon: Shield,
  },
  {
    role: 'super_admin',
    roleLabel: 'Super Administrator',
    badgeLabel: 'Governance Platform',
    badgeColor: 'bg-[#FDF2F0] text-[#D9381E] border-[#FACDC6] dark:bg-[#3D1A16] dark:text-[#F87171] dark:border-[#7F1D1D]',
    email: 'superadmin@nagarwatch.org',
    password: 'NagarWatch@2026',
    description: 'City-wide governance, ward boundaries, administrator assignments, system settings & audit logs.',
    targetPortal: '/superadmin',
    icon: KeyRound,
  },
];

interface DemoLoginSectionProps {
  onSelectDemo: (account: DemoAccount) => void;
  isLoading?: boolean;
  activeRoleLoading?: string | null;
  compact?: boolean;
}

export const DemoLoginSection: React.FC<DemoLoginSectionProps> = ({
  onSelectDemo,
  isLoading = false,
  activeRoleLoading = null,
  compact = false,
}) => {
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const handleCopy = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedEmail(text);
      setTimeout(() => setCopiedEmail(null), 2000);
    }
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA]">
          <Sparkles className="w-3 h-3 text-[#D9381E]" />
          <span>Quick Evaluation Portals</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {DEMO_ACCOUNTS.map((acc) => {
            const Icon = acc.icon;
            const isThisLoading = isLoading && activeRoleLoading === acc.role;
            return (
              <button
                key={acc.role}
                type="button"
                disabled={isLoading}
                onClick={() => onSelectDemo(acc)}
                className="p-2.5 rounded-sm border border-[#E5E0D4] dark:border-[#333338] bg-[#FBF9F4] dark:bg-[#18181B] hover:bg-[#F4F1EA] dark:hover:bg-[#27272A] hover:border-[#1C1917] dark:hover:border-[#71717A] text-left transition-all flex items-center justify-between group disabled:opacity-50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-xs bg-[#F4F1EA] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] flex items-center justify-center shrink-0 text-[#1C1917] dark:text-[#F4F4F5] group-hover:border-[#1C1917] dark:group-hover:border-[#71717A]">
                    <Icon className="w-3 h-3" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-semibold text-[#1C1917] dark:text-[#F4F4F5] truncate">
                      {acc.roleLabel}
                    </p>
                    <p className="text-[10px] font-mono text-[#78716C] dark:text-[#A1A1AA] truncate">{acc.email}</p>
                  </div>
                </div>
                {isThisLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin text-[#D9381E] shrink-0" />
                ) : (
                  <ArrowRight className="w-3 h-3 text-[#A8A29E] dark:text-[#71717A] group-hover:text-[#1C1917] dark:group-hover:text-[#F4F4F5] group-hover:translate-x-0.5 transition-all shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-sm bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] space-y-3">
      {/* Header ribbon */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-[#E5E0D4] dark:border-[#333338]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-xs bg-[#1C1917] dark:bg-[#F4F4F5] text-[#FBF9F4] dark:text-[#18181B] flex items-center justify-center">
            <KeyRound className="w-3 h-3" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#1C1917] dark:text-[#F4F4F5] tracking-wider uppercase font-sans">
              Instant Demo Credentials
            </h3>
            <p className="text-[11px] text-[#78716C] dark:text-[#A1A1AA]">
              One-click evaluation access to experience all three municipal authority tiers
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono bg-[#F4F1EA] dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] px-2 py-0.5 rounded-xs text-[#1C1917] dark:text-[#F4F4F5] font-medium tracking-tight">
          pwd: NagarWatch@2026
        </span>
      </div>

      {/* Account items */}
      <div className="space-y-2">
        {DEMO_ACCOUNTS.map((acc) => {
          const Icon = acc.icon;
          const isThisLoading = isLoading && activeRoleLoading === acc.role;

          return (
            <div
              key={acc.role}
              onClick={() => !isLoading && onSelectDemo(acc)}
              className="p-3 rounded-sm bg-white dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] hover:border-[#1C1917] dark:hover:border-[#71717A] transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xs bg-[#F4F1EA] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] group-hover:border-[#1C1917] dark:group-hover:border-[#71717A] text-[#1C1917] dark:text-[#F4F4F5] flex items-center justify-center shrink-0 transition-colors mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#1C1917] dark:text-[#F4F4F5]">
                      {acc.roleLabel}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-xs border font-medium ${acc.badgeColor}`}
                    >
                      {acc.badgeLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#78716C] dark:text-[#A1A1AA] leading-snug line-clamp-1">
                    {acc.description}
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[11px] font-mono text-[#57534E] dark:text-[#A1A1AA] font-medium">{acc.email}</span>
                    <button
                      type="button"
                      onClick={(e) => handleCopy(acc.email, e)}
                      className="p-1 text-[#A8A29E] dark:text-[#71717A] hover:text-[#1C1917] dark:hover:text-[#F4F4F5] rounded-xs transition-colors"
                      title="Copy demo email"
                      aria-label="Copy demo email"
                    >
                      {copiedEmail === acc.email ? (
                        <Check className="w-3 h-3 text-[#1C1917] dark:text-[#F4F4F5]" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={isLoading}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDemo(acc);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#1C1917] hover:bg-[#D9381E] text-white text-xs font-semibold rounded-xs transition-colors shrink-0 self-end sm:self-center disabled:opacity-50 min-h-[32px] dark:bg-[#F4F4F5] dark:text-[#18181B] dark:hover:bg-[#D9381E] dark:hover:text-white"
              >
                {isThisLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
