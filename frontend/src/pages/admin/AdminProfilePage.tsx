import React, { useEffect, useState } from 'react';
import {
  User,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  Landmark,
  LogOut,
  Calendar,
  Lock,
  AlertTriangle,
  RefreshCw,
  KeyRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';

interface ProfileData {
  id: string;
  role: string;
  full_name?: string;
  email?: string;
  phone_number?: string;
  reputation_score?: number;
  is_verified?: boolean;
  wards_allocated?: number[];
}

export const AdminProfilePage: React.FC = () => {
  const { user, userRole, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await apiClient.get('/api/v1/users/me');
        setProfile(res.data?.data || null);
      } catch {
        // Fallback to auth context metadata
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const displayName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string) ||
    user?.email?.split('@')[0] ||
    'Administrator';

  const displayEmail = profile?.email || user?.email || 'N/A';
  const displayPhone = profile?.phone_number || (user?.phone as string) || 'Not registered';
  const wards = profile?.wards_allocated || [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-6 h-6 text-[#F05030] animate-spin" />
        <p className="text-xs font-mono uppercase tracking-wider text-[#A1A1AA]">
          Loading administrator profile...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-[#222226] border border-[#333338] rounded-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-widest bg-[#F05030]/20 text-[#F05030] border border-[#F05030]/30 px-1.5 py-0.5 rounded-xs">
              Governance Profile
            </span>
            <span className="text-[11px] text-[#A1A1AA] font-mono">•</span>
            <span className="text-[11px] text-[#A1A1AA] font-mono">Verified Session</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif text-[#F4F4F5] tracking-tight">
            Administrator Account Profile
          </h1>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Verified credentials, role boundaries, and security allocations.
          </p>
        </div>

        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2B2B30] hover:bg-rose-950/40 text-[#A1A1AA] hover:text-rose-400 border border-[#333338] hover:border-rose-800/50 rounded-xs text-xs font-mono transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* ─── Profile Overview Card ─────────────────────────────────────────── */}
      <div className="p-6 bg-[#222226] border border-[#333338] rounded-sm shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#333338]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xs bg-[#18181B] border border-[#333338] text-[#F05030] flex items-center justify-center font-serif text-2xl font-bold shadow-xs">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-serif text-[#F4F4F5] font-semibold">{displayName}</h2>
                <span className="text-xs font-mono uppercase bg-[#F05030]/20 text-[#F05030] border border-[#F05030]/30 px-2 py-0.5 rounded-xs font-bold">
                  {userRole === 'super_admin' ? 'Super Administrator' : 'Ward Administrator'}
                </span>
              </div>
              <p className="text-xs font-mono text-[#A1A1AA] mt-1">ID: {user?.id || profile?.id}</p>
            </div>
          </div>
        </div>

        {/* Credentials Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-4 bg-[#18181B] border border-[#333338] rounded-xs space-y-1">
            <div className="flex items-center gap-2 text-[#A1A1AA]">
              <Mail className="w-3.5 h-3.5 text-[#A1A1AA]" />
              <span className="uppercase text-[10px]">Email Address</span>
            </div>
            <p className="text-sm font-sans font-medium text-[#F4F4F5]">{displayEmail}</p>
            <span className="text-[11px] text-emerald-400 flex items-center gap-1 pt-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified Supabase Auth
            </span>
          </div>

          <div className="p-4 bg-[#18181B] border border-[#333338] rounded-xs space-y-1">
            <div className="flex items-center gap-2 text-[#A1A1AA]">
              <Phone className="w-3.5 h-3.5 text-[#A1A1AA]" />
              <span className="uppercase text-[10px]">Phone Number</span>
            </div>
            <p className="text-sm font-sans font-medium text-[#F4F4F5]">{displayPhone}</p>
            <span className="text-[11px] text-[#A1A1AA] pt-1 block">Municipal SMS alert channel</span>
          </div>

          <div className="p-4 bg-[#18181B] border border-[#333338] rounded-xs space-y-1 sm:col-span-2">
            <div className="flex items-center gap-2 text-[#A1A1AA]">
              <Landmark className="w-3.5 h-3.5 text-[#A1A1AA]" />
              <span className="uppercase text-[10px]">Assigned Ward Jurisdiction</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1.5">
              {userRole === 'super_admin' ? (
                <span className="px-2.5 py-1 bg-[#2B2B30] text-[#F4F4F5] border border-[#333338] rounded-xs text-xs">
                  All Wards (City-Wide Authority)
                </span>
              ) : wards.length > 0 ? (
                wards.map((wId) => (
                  <span
                    key={wId}
                    className="px-2.5 py-1 bg-[#2B2B30] text-[#F4F4F5] border border-[#333338] rounded-xs text-xs"
                  >
                    Ward #{wId}
                  </span>
                ))
              ) : (
                <span className="px-2.5 py-1 bg-[#2B2B30] text-[#F4F4F5] border border-[#333338] rounded-xs text-xs">
                  Ward #1
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Strict RBAC Governance Notice Box */}
        <div className="p-4 bg-[#18181B] border border-[#333338] rounded-xs space-y-2">
          <div className="flex items-center gap-2 text-[#F05030] text-xs font-mono font-bold">
            <Lock className="w-4 h-4" />
            <span>Role Escalation & RBAC Protection</span>
          </div>
          <p className="text-xs text-[#A1A1AA] leading-relaxed">
            Administrative permissions and ward assignments are governed by cryptographic database row-level security (RLS) triggers. Any modification to your jurisdictional boundary or privileges requires Super Administrator authorization.
          </p>
        </div>
      </div>
    </div>
  );
};
