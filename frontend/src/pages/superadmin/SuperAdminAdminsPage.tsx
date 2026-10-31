import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Search,
  UserPlus,
  Landmark,
  X,
  AlertCircle,
  RefreshCw,
  Trash2,
  Sliders,
  Shield,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Users,
} from 'lucide-react';
import apiClient from '../../lib/apiClient';
import { Avatar } from '../../components/ui/Avatar';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorState } from '../../components/ui/ErrorState';

interface AdminUser {
  id: string;
  email?: string;
  full_name?: string;
  role: 'admin' | 'super_admin' | 'citizen';
  is_verified?: boolean;
  wards_allocated?: number[];
  created_at?: string;
}

interface WardItem {
  id: number;
  name: string;
}

export const SuperAdminAdminsPage: React.FC = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [wards, setWards] = useState<WardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'super_admin'>('all');

  // Modals state
  const [assignModalAdmin, setAssignModalAdmin] = useState<AdminUser | null>(null);
  const [selectedWardId, setSelectedWardId] = useState<string>('');
  const [roleModalUser, setRoleModalUser] = useState<AdminUser | null>(null);
  const [targetRole, setTargetRole] = useState<'citizen' | 'admin' | 'super_admin'>('admin');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [adminsRes, wardsRes] = await Promise.all([
        apiClient.get('/api/v1/superadmin/admins'),
        apiClient.get('/api/v1/wards').catch(() => ({ data: { data: [] } })),
      ]);

      setAdmins(Array.isArray(adminsRes.data?.data) ? adminsRes.data.data : []);
      setWards(Array.isArray(wardsRes.data?.data) ? wardsRes.data.data : []);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load administrator directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const wardMap = useMemo(() => {
    const map = new Map<number, string>();
    wards.forEach((w) => map.set(w.id, w.name));
    return map;
  }, [wards]);

  const filteredAdmins = useMemo(() => {
    return admins.filter((a) => {
      if (roleFilter !== 'all' && a.role !== roleFilter) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const name = (a.full_name || '').toLowerCase();
      const email = (a.email || '').toLowerCase();
      const hasMatchingWard = (a.wards_allocated || []).some((wId) => {
        const wName = wardMap.get(wId) || '';
        return wName.toLowerCase().includes(term) || String(wId).includes(term);
      });
      return name.includes(term) || email.includes(term) || hasMatchingWard;
    });
  }, [admins, roleFilter, searchTerm, wardMap]);

  // Handle Assign Ward
  const handleAssignWard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalAdmin || !selectedWardId) return;
    setSubmitting(true);
    setActionError(null);

    try {
      await apiClient.post('/api/v1/superadmin/admins/assign', {
        user_id: assignModalAdmin.id,
        ward_id: parseInt(selectedWardId, 10),
      });
      setAssignModalAdmin(null);
      setSelectedWardId('');
      await fetchData();
    } catch (err: any) {
      setActionError(err?.response?.data?.error || 'Failed to allocate ward to administrator');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Remove Ward
  const handleRemoveWard = async (userId: string, wardId: number) => {
    const wardName = wardMap.get(wardId) || `Ward #${wardId}`;
    if (!window.confirm(`Unassign this administrator from ${wardName}?`)) return;

    try {
      await apiClient.post('/api/v1/superadmin/admins/remove', {
        user_id: userId,
        ward_id: wardId,
      });
      await fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to remove ward allocation');
    }
  };

  // Handle Role Change
  const handleRoleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleModalUser) return;
    setSubmitting(true);
    setActionError(null);

    try {
      await apiClient.post('/api/v1/superadmin/admins/role', {
        user_id: roleModalUser.id,
        role: targetRole,
      });
      setRoleModalUser(null);
      await fetchData();
    } catch (err: any) {
      setActionError(err?.response?.data?.error || 'Failed to update administrative role');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* ─── Page Header ────────────────────────────────────────────────────── */}
      <div className="bg-[#222226] border border-[#333338] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5">
              JURISDICTIONAL CONTROL MATRIX
            </span>
            <span className="text-xs text-[#333338]">•</span>
            <span className="text-[11px] font-mono text-[#A1A1AA]">Role & Jurisdiction Control</span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-normal text-[#F4F4F5] tracking-tight">
            Administrator Governance
          </h1>
          <p className="text-xs sm:text-sm text-[#A1A1AA] mt-1 max-w-2xl leading-relaxed">
            Supervise Ward Administrators, allocate municipal boundaries, and manage governance permissions.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#2B2B30] hover:bg-[#333338] text-[#F4F4F5] text-xs font-medium border border-[#333338] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ─── Search & Role Filter HUD ───────────────────────────────────────── */}
      <div className="bg-[#222226] border border-[#333338] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
          <input
            type="text"
            placeholder="Search by name, email, or ward..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-[#18181B] border border-[#333338] text-[#F4F4F5] placeholder-[#A1A1AA] focus:outline-none focus:border-[#F05030]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#A1A1AA]">Filter Role:</span>
          <div className="inline-flex border border-[#333338] bg-[#18181B] p-0.5">
            {(['all', 'admin', 'super_admin'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${
                  roleFilter === r
                    ? 'bg-[#F05030] text-white font-semibold'
                    : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
                }`}
              >
                {r === 'all' ? 'All Roles' : r === 'super_admin' ? 'Super Admin' : 'Ward Admin'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="p-12 bg-[#222226] border border-[#333338] flex flex-col items-center justify-center gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-xs font-mono text-[#A1A1AA]">LOADING ADMINISTRATOR REGISTRY...</p>
        </div>
      )}

      {error && !loading && (
        <div className="p-6 bg-[#222226] border border-[#333338]">
          <ErrorState title="Failed to load administrators" description={error} onRetry={fetchData} />
        </div>
      )}

      {/* ─── High-Density Administrator Matrix ──────────────────────────────── */}
      {!loading && !error && filteredAdmins.length > 0 && (
        <div className="bg-[#222226] border border-[#333338] divide-y divide-[#333338]">
          {filteredAdmins.map((admin) => (
            <div
              key={admin.id}
              className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[#2B2B30]/40 transition-colors"
            >
              {/* Official Profile & Credentials */}
              <div className="flex items-center gap-3 min-w-[260px]">
                <Avatar
                  name={admin.full_name || admin.email || 'Admin'}
                  size="md"
                  className="bg-[#18181B] text-[#F4F4F5] border border-[#333338] font-semibold text-xs shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[#F4F4F5] truncate">
                      {admin.full_name || 'Unnamed Official'}
                    </span>
                    {admin.role === 'super_admin' ? (
                      <span className="text-[9px] font-mono uppercase bg-[#F05030]/20 text-[#F05030] border border-[#F05030]/30 px-1.5 py-0.2">
                        Super Admin
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.2">
                        Ward Admin
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#A1A1AA] font-mono truncate">{admin.email}</div>
                </div>
              </div>

              {/* Jurisdictional Allocations */}
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA] block mb-1">
                  Assigned Jurisdictions:
                </span>
                {admin.role === 'super_admin' ? (
                  <span className="text-xs font-mono text-[#F05030] italic flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-[#F05030]" />
                    Universal Municipal Access (All Wards)
                  </span>
                ) : (admin.wards_allocated || []).length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(admin.wards_allocated || []).map((wId) => {
                      const name = wardMap.get(wId) || `Ward #${wId}`;
                      return (
                        <span
                          key={wId}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono bg-[#18181B] text-[#F4F4F5] border border-[#333338]"
                        >
                          <Landmark className="w-3 h-3 text-amber-400" />
                          <span>{name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveWard(admin.id, wId)}
                            className="text-[#A1A1AA] hover:text-rose-400 transition-colors ml-0.5 cursor-pointer"
                            title={`Unassign from ${name}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-xs font-mono text-amber-400">
                    No Wards Assigned (Unallocated)
                  </span>
                )}
              </div>

              {/* Status & Control Triggers */}
              <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#333338]">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Active
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setAssignModalAdmin(admin);
                      setSelectedWardId('');
                      setActionError(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-[#2B2B30] hover:bg-[#333338] text-[#F4F4F5] border border-[#333338] hover:border-[#F05030]/50 transition-colors cursor-pointer"
                  >
                    <Landmark className="w-3.5 h-3.5 text-[#F05030]" />
                    <span>Assign Ward</span>
                  </button>

                  <button
                    onClick={() => {
                      setRoleModalUser(admin);
                      setTargetRole(admin.role);
                      setActionError(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-[#18181B] hover:bg-[#2B2B30] text-[#A1A1AA] hover:text-[#F4F4F5] border border-[#333338] transition-colors cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Role</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── ASSIGN WARD MODAL ────────────────────────────────────────────── */}
      {assignModalAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#222226] border border-[#333338] w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-[#333338] flex items-center justify-between bg-[#18181B]">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-[#F05030]" />
                <h3 className="font-semibold text-[#F4F4F5] text-sm font-mono uppercase tracking-wider">
                  Assign Ward Jurisdiction
                </h3>
              </div>
              <button
                onClick={() => setAssignModalAdmin(null)}
                className="text-[#A1A1AA] hover:text-[#F4F4F5] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignWard} className="p-6 space-y-4">
              {actionError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{actionError}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] mb-1">
                  Administrator
                </label>
                <p className="text-sm font-semibold text-[#F4F4F5]">
                  {assignModalAdmin.full_name || assignModalAdmin.email}
                </p>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] mb-1.5">
                  Select Municipal Ward <span className="text-[#F05030]">*</span>
                </label>
                <select
                  required
                  value={selectedWardId}
                  onChange={(e) => setSelectedWardId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#18181B] border border-[#333338] text-[#F4F4F5] focus:outline-none focus:border-[#F05030]"
                >
                  <option value="">-- Choose Ward Boundary --</option>
                  {wards.map((w) => (
                    <option key={w.id} value={w.id}>
                      #{w.id} - {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-[#333338] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModalAdmin(null)}
                  disabled={submitting}
                  className="px-3 py-2 text-xs font-medium text-[#A1A1AA] hover:text-[#F4F4F5] bg-[#18181B] border border-[#333338] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedWardId}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#F05030] hover:bg-[#D9381E] disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {submitting ? 'Allocating...' : 'Allocate Jurisdiction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── UPDATE ROLE MODAL ────────────────────────────────────────────── */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#222226] border border-[#333338] w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-[#333338] flex items-center justify-between bg-[#18181B]">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-[#F4F4F5] text-sm font-mono uppercase tracking-wider">
                  Update Administrative Role
                </h3>
              </div>
              <button
                onClick={() => setRoleModalUser(null)}
                className="text-[#A1A1AA] hover:text-[#F4F4F5] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRoleChange} className="p-6 space-y-4">
              {actionError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{actionError}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] mb-1">
                  User Account
                </label>
                <p className="text-sm font-semibold text-[#F4F4F5]">
                  {roleModalUser.full_name || roleModalUser.email}
                </p>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] mb-1.5">
                  Authority Level
                </label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-[#18181B] border border-[#333338] text-[#F4F4F5] focus:outline-none focus:border-[#F05030]"
                >
                  <option value="admin">Ward Administrator (Sector Level)</option>
                  <option value="super_admin">Super Administrator (Root Metropolitan)</option>
                  <option value="citizen">Citizen (Standard Reporting Access)</option>
                </select>
              </div>

              <div className="pt-4 border-t border-[#333338] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRoleModalUser(null)}
                  disabled={submitting}
                  className="px-3 py-2 text-xs font-medium text-[#A1A1AA] hover:text-[#F4F4F5] bg-[#18181B] border border-[#333338] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {submitting ? 'Applying Role...' : 'Save Role Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

SuperAdminAdminsPage.displayName = 'SuperAdminAdminsPage';
