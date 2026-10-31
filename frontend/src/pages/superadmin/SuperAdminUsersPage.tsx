import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Shield,
  ShieldCheck,
  User,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Phone,
  Mail,
  Calendar,
  Lock,
  ChevronLeft,
  ChevronRight,
  Eye,
  Sliders,
  X,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import apiClient from '../../lib/apiClient';
import { Avatar } from '../../components/ui/Avatar';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorState } from '../../components/ui/ErrorState';

interface SuperAdminUser {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  role: 'citizen' | 'admin' | 'super_admin';
  is_verified?: boolean;
  created_at?: string;
  wards_allocated?: number[];
}

export const SuperAdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'citizen' | 'admin' | 'super_admin'>('all');

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [hasMore, setHasMore] = useState(false);

  // Inspection Modal
  const [inspectUser, setInspectUser] = useState<SuperAdminUser | null>(null);

  // Role Change Modal
  const [roleModalUser, setRoleModalUser] = useState<SuperAdminUser | null>(null);
  const [targetRole, setTargetRole] = useState<'citizen' | 'admin' | 'super_admin'>('citizen');
  const [submittingRole, setSubmittingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (activeSearch.trim()) params.append('search', activeSearch.trim());
      if (roleFilter !== 'all') params.append('role', roleFilter);
      params.append('limit', String(pageSize));
      params.append('offset', String((page - 1) * pageSize));

      const res = await apiClient.get(`/api/v1/superadmin/users?${params.toString()}`);
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setUsers(data);
      setHasMore(data.length === pageSize);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to retrieve user registry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, activeSearch, roleFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
    setPage(1);
  };

  const handleRoleChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleModalUser) return;
    setSubmittingRole(true);
    setRoleError(null);

    try {
      await apiClient.post('/api/v1/superadmin/admins/role', {
        user_id: roleModalUser.id,
        role: targetRole,
      });
      setRoleModalUser(null);
      await fetchUsers();
    } catch (err: any) {
      setRoleError(err?.response?.data?.error || 'Failed to update user role');
    } finally {
      setSubmittingRole(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* ─── Page Header ────────────────────────────────────────────────────── */}
      <div className="bg-[#222226] border border-[#333338] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5">
              METROPOLITAN REGISTRY
            </span>
            <span className="text-xs text-[#333338]">•</span>
            <span className="text-[11px] font-mono text-[#A1A1AA] flex items-center gap-1">
              <Lock className="w-3 h-3 text-[#A1A1AA]" />
              Privacy-Preserving PII
            </span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-normal text-[#F4F4F5] tracking-tight">
            User Directory
          </h1>
          <p className="text-xs sm:text-sm text-[#A1A1AA] mt-1 max-w-2xl leading-relaxed">
            Supervise registered accounts, manage roles, and review community account statuses.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#2B2B30] hover:bg-[#333338] text-[#F4F4F5] text-xs font-medium border border-[#333338] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ─── Search & Role Filters HUD ──────────────────────────────────────── */}
      <div className="bg-[#222226] border border-[#333338] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-[#18181B] border border-[#333338] text-[#F4F4F5] placeholder-[#A1A1AA] focus:outline-none focus:border-[#F05030]"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#F4F4F5] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-3.5 py-2 text-xs font-mono uppercase tracking-wider bg-[#2B2B30] hover:bg-[#333338] text-[#F4F4F5] border border-[#333338] transition-colors cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#A1A1AA]">Role:</span>
          <div className="inline-flex border border-[#333338] bg-[#18181B] p-0.5">
            {(['all', 'citizen', 'admin', 'super_admin'] as const).map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRoleFilter(r);
                  setPage(1);
                }}
                className={`px-3 py-1 text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${
                  roleFilter === r
                    ? 'bg-[#F05030] text-white font-semibold'
                    : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
                }`}
              >
                {r === 'all'
                  ? 'All'
                  : r === 'super_admin'
                  ? 'Super Admin'
                  : r === 'admin'
                  ? 'Ward Admin'
                  : 'Citizen'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="p-12 bg-[#222226] border border-[#333338] flex flex-col items-center justify-center gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-xs font-mono text-[#A1A1AA]">QUERYING PLATFORM USER DIRECTORY...</p>
        </div>
      )}

      {error && !loading && (
        <div className="p-6 bg-[#222226] border border-[#333338]">
          <ErrorState title="Failed to load users" description={error} onRetry={fetchUsers} />
        </div>
      )}

      {/* ─── User Registry Table ────────────────────────────────────────────── */}
      {!loading && !error && users.length > 0 && (
        <div className="bg-[#222226] border border-[#333338] overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#18181B] border-b border-[#333338] font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA]">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Masked Phone</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4 text-center">Verification</th>
                <th className="py-3 px-4">Registered Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333338]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#2B2B30]/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={u.full_name || u.email || 'User'}
                        size="md"
                        className="bg-[#18181B] text-[#F4F4F5] border border-[#333338] font-semibold text-xs shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-[#F4F4F5] truncate">{u.full_name}</div>
                        <div className="text-xs text-[#A1A1AA] font-mono flex items-center gap-1">
                          <Mail className="w-3 h-3 text-[#A1A1AA]" />
                          {u.email || 'No email registered'}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4 font-mono text-xs text-[#A1A1AA]">
                    {u.phone ? (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-[#A1A1AA]" />
                        <span>{u.phone}</span>
                      </div>
                    ) : (
                      <span className="text-[#A1A1AA] italic">None</span>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    {u.role === 'super_admin' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase bg-[#F05030]/20 text-[#F05030] border border-[#F05030]/30 px-1.5 py-0.2">
                        <Shield className="w-3 h-3" />
                        Super Admin
                      </span>
                    ) : u.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.2">
                        <ShieldCheck className="w-3 h-3" />
                        Ward Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase bg-[#18181B] text-[#A1A1AA] border border-[#333338] px-1.5 py-0.2">
                        <User className="w-3 h-3 text-[#A1A1AA]" />
                        Citizen
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-center">
                    {u.is_verified ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[10px] font-mono text-[#A1A1AA] bg-[#18181B] border border-[#333338] px-2 py-0.5">
                        Unverified
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 font-mono text-xs text-[#A1A1AA]">
                    {u.created_at ? (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-[#A1A1AA]" />
                        <span>{new Date(u.created_at).toLocaleDateString()}</span>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setInspectUser(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-[#18181B] hover:bg-[#2B2B30] text-[#A1A1AA] hover:text-[#F4F4F5] border border-[#333338] transition-colors cursor-pointer"
                        title="View Profile Details"
                      >
                        <Eye className="w-3 h-3 text-[#F05030]" />
                        <span>Details</span>
                      </button>

                      <button
                        onClick={() => {
                          setRoleModalUser(u);
                          setTargetRole(u.role);
                          setRoleError(null);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-[#18181B] hover:bg-[#2B2B30] text-[#A1A1AA] hover:text-[#F4F4F5] border border-[#333338] transition-colors cursor-pointer"
                        title="Modify User Role"
                      >
                        <Sliders className="w-3 h-3 text-amber-400" />
                        <span>Role</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Toolbar */}
          <div className="p-3 bg-[#18181B] border-t border-[#333338] flex items-center justify-between text-xs font-mono text-[#A1A1AA]">
            <span>Page {page}</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1 bg-[#222226] border border-[#333338] text-[#F4F4F5] disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5 inline mr-1" />
                Prev
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore}
                className="px-2.5 py-1 bg-[#222226] border border-[#333338] text-[#F4F4F5] disabled:opacity-40 cursor-pointer"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PROFILE INSPECTION MODAL ─────────────────────────────────────── */}
      {inspectUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#222226] border border-[#333338] w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-[#333338] flex items-center justify-between bg-[#18181B]">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#F05030]" />
                <h3 className="font-semibold text-[#F4F4F5] text-sm font-mono uppercase tracking-wider">
                  User Account Profile
                </h3>
              </div>
              <button
                onClick={() => setInspectUser(null)}
                className="text-[#A1A1AA] hover:text-[#F4F4F5] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-[#333338]">
                <Avatar
                  name={inspectUser.full_name || inspectUser.email || 'User'}
                  size="lg"
                  className="bg-[#18181B] text-[#F4F4F5] border border-[#333338] font-bold text-base"
                />
                <div>
                  <h4 className="font-bold text-[#F4F4F5] text-base">{inspectUser.full_name}</h4>
                  <p className="text-xs text-[#A1A1AA] font-mono">{inspectUser.email}</p>
                </div>
              </div>

              <div className="border border-[#333338] bg-[#18181B] p-3 divide-y divide-[#333338] text-xs font-mono space-y-2">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-[#A1A1AA]">System ID</span>
                  <span className="text-[#F4F4F5] select-all">{inspectUser.id}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-[#A1A1AA]">Role</span>
                  <span className="font-semibold uppercase text-amber-400">{inspectUser.role}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-[#A1A1AA]">Masked Phone</span>
                  <span className="text-[#F4F4F5]">{inspectUser.phone || 'None'}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-[#A1A1AA]">Verified Citizen</span>
                  <span className={inspectUser.is_verified ? 'text-emerald-400' : 'text-[#A1A1AA]'}>
                    {inspectUser.is_verified ? 'Yes (Verified)' : 'No (Unverified)'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[#A1A1AA]">Registered</span>
                  <span className="text-[#F4F4F5]">
                    {inspectUser.created_at
                      ? new Date(inspectUser.created_at).toLocaleString()
                      : 'Unknown'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-[#18181B] border border-[#333338] text-xs font-mono text-[#A1A1AA] flex items-start gap-2">
                <Lock className="w-4 h-4 text-[#F05030] shrink-0 mt-0.5" />
                <span>
                  Personally identifiable information (PII) is masked at the API gateway layer to uphold citizen privacy standards.
                </span>
              </div>

              <div className="pt-3 border-t border-[#333338] flex justify-end">
                <button
                  type="button"
                  onClick={() => setInspectUser(null)}
                  className="px-4 py-2 text-xs font-medium text-[#F4F4F5] bg-[#18181B] hover:bg-[#2B2B30] border border-[#333338] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ROLE CHANGE MODAL ────────────────────────────────────────────── */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#222226] border border-[#333338] w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-[#333338] flex items-center justify-between bg-[#18181B]">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-[#F4F4F5] text-sm font-mono uppercase tracking-wider">
                  Update Account Role
                </h3>
              </div>
              <button
                onClick={() => setRoleModalUser(null)}
                className="text-[#A1A1AA] hover:text-[#F4F4F5] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRoleChangeSubmit} className="p-6 space-y-4">
              {roleError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{roleError}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] mb-1">
                  User Account
                </label>
                <p className="text-sm font-semibold text-[#F4F4F5]">{roleModalUser.full_name}</p>
                <p className="text-xs text-[#A1A1AA] font-mono">{roleModalUser.email}</p>
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
                  <option value="citizen">Citizen (Standard Civic Reporting)</option>
                  <option value="admin">Ward Administrator (Sector Triage Access)</option>
                  <option value="super_admin">Super Administrator (Root Metropolitan)</option>
                </select>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
                <p className="font-semibold">Security Role Guard</p>
                <p className="text-[11px] mt-0.5">
                  Elevating to Administrator allows access to municipal queue dispatch and resolution tools.
                </p>
              </div>

              <div className="pt-4 border-t border-[#333338] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRoleModalUser(null)}
                  disabled={submittingRole}
                  className="px-3 py-2 text-xs font-medium text-[#A1A1AA] hover:text-[#F4F4F5] bg-[#18181B] border border-[#333338] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRole}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {submittingRole ? 'Saving...' : 'Confirm Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

SuperAdminUsersPage.displayName = 'SuperAdminUsersPage';
