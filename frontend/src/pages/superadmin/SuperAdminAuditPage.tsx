import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Search,
  Shield,
  ArrowRight,
  Clock,
  User,
  FileText,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Tag,
  Landmark,
  Image as ImageIcon,
  X,
  Lock,
} from 'lucide-react';
import apiClient from '../../lib/apiClient';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorState } from '../../components/ui/ErrorState';

interface AuditLogEntry {
  id: number;
  incident_id: string;
  user_id?: string;
  old_status?: string;
  new_status: string;
  notes?: string;
  proof_media_url?: string;
  created_at: string;
  incident_category?: string;
  incident_ward_id?: number;
  actor_name?: string;
  actor_role?: string;
}

export const SuperAdminAuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [hasMore, setHasMore] = useState(false);

  // Proof Image Preview Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('limit', String(pageSize));
      params.append('offset', String((page - 1) * pageSize));

      const res = await apiClient.get(`/api/v1/superadmin/audit?${params.toString()}`);
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setLogs(data);
      setHasMore(data.length === pageSize);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to retrieve governance audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (statusFilter !== 'all' && log.new_status !== statusFilter) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const incId = (log.incident_id || '').toLowerCase();
      const actor = (log.actor_name || '').toLowerCase();
      const notes = (log.notes || '').toLowerCase();
      const cat = (log.incident_category || '').toLowerCase();
      return incId.includes(term) || actor.includes(term) || notes.includes(term) || cat.includes(term);
    });
  }, [logs, statusFilter, searchTerm]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* ─── Page Header ────────────────────────────────────────────────────── */}
      <div className="bg-[#222226] border border-[#333338] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider bg-[#F05030]/20 text-[#F05030] border border-[#F05030]/30 px-2 py-0.5">
              SECURITY AUDIT TRAIL
            </span>
            <span className="text-xs text-[#333338]">•</span>
            <span className="text-[11px] font-mono text-[#A1A1AA]">Immutable public.incident_updates</span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-normal text-[#F4F4F5] tracking-tight">
            Audit Trail & Governance Logs
          </h1>
          <p className="text-xs sm:text-sm text-[#A1A1AA] mt-1 max-w-2xl leading-relaxed">
            Tamper-evident lifecycle transitions, verification records, and administrative status changes.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#2B2B30] hover:bg-[#333338] text-[#F4F4F5] text-xs font-medium border border-[#333338] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ─── Explanatory Ledger Banner ──────────────────────────────────────── */}
      <div className="p-5 bg-[#222226] border border-[#333338] flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#F4F4F5] font-semibold">
            <Shield className="w-4 h-4 text-[#F05030]" />
            <span>Cryptographically Verified Incident Lifecycle Ledger</span>
          </div>
          <p className="text-xs text-[#A1A1AA] max-w-2xl leading-relaxed">
            Every status change from initial citizen report to municipal resolution is recorded in the immutable database update table. Neither administrators nor users can delete or alter past status transition entries.
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-3 relative z-10">
          <div className="px-4 py-2.5 bg-[#18181B] border border-[#333338] text-center">
            <span className="text-[9px] uppercase tracking-wider text-[#A1A1AA] block font-mono">Ledger Entries</span>
            <span className="font-mono text-base font-semibold text-[#F4F4F5]">{logs.length} loaded</span>
          </div>
        </div>
      </div>

      {/* ─── Search & Status Filter HUD ──────────────────────────────────────── */}
      <div className="bg-[#222226] border border-[#333338] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
          <input
            type="text"
            placeholder="Search by incident ID, actor, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-[#18181B] border border-[#333338] text-[#F4F4F5] placeholder-[#A1A1AA] focus:outline-none focus:border-[#F05030]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#A1A1AA]">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-mono bg-[#18181B] border border-[#333338] text-[#F4F4F5] focus:outline-none focus:border-[#F05030]"
          >
            <option value="all">All Statuses</option>
            <option value="reported">Reported</option>
            <option value="verified">Verified</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="p-12 bg-[#222226] border border-[#333338] flex flex-col items-center justify-center gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-xs font-mono text-[#A1A1AA]">QUERYING PLATFORM AUDIT LEDGER...</p>
        </div>
      )}

      {error && !loading && (
        <div className="p-6 bg-[#222226] border border-[#333338]">
          <ErrorState title="Failed to load audit logs" description={error} onRetry={fetchLogs} />
        </div>
      )}

      {/* ─── Audit Log Table ────────────────────────────────────────────────── */}
      {!loading && !error && filteredLogs.length > 0 && (
        <div className="bg-[#222226] border border-[#333338] overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#18181B] border-b border-[#333338] font-mono text-[10px] uppercase tracking-wider text-[#A1A1AA]">
                <th className="py-3 px-4">Audit ID</th>
                <th className="py-3 px-4">Incident Reference</th>
                <th className="py-3 px-4">Lifecycle Transition</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Resolution Notes</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333338]">
              {filteredLogs.map((entry) => (
                <tr key={entry.id} className="hover:bg-[#2B2B30]/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-xs font-semibold text-[#A1A1AA]">
                    #{entry.id}
                  </td>

                  <td className="py-3.5 px-4">
                    <div>
                      <span className="font-mono text-xs font-bold text-[#F4F4F5] block">
                        {entry.incident_id ? entry.incident_id.substring(0, 8) : 'Unknown'}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {entry.incident_category && (
                          <span className="text-[11px] text-[#A1A1AA]">
                            {entry.incident_category}
                          </span>
                        )}
                        {entry.incident_ward_id && (
                          <span className="text-[10px] font-mono text-[#F05030] bg-[#F05030]/10 border border-[#F05030]/30 px-1 py-0.2">
                            Ward #{entry.incident_ward_id}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5">
                      {entry.old_status ? (
                        <span className="text-xs font-mono px-1.5 py-0.5 bg-[#18181B] text-[#A1A1AA] border border-[#333338] uppercase">
                          {entry.old_status}
                        </span>
                      ) : (
                        <span className="text-xs text-[#A1A1AA] italic font-mono">initial</span>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 text-[#A1A1AA] shrink-0" />
                      <StatusBadge status={entry.new_status} size="sm" />
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-[#18181B] border border-[#333338] flex items-center justify-center text-[#A1A1AA] text-xs shrink-0">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#F4F4F5]">
                          {entry.actor_name || 'System / Official'}
                        </div>
                        {entry.actor_role && (
                          <div className="text-[9px] font-mono uppercase tracking-wider text-amber-400">
                            {entry.actor_role}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 max-w-xs">
                    {entry.notes ? (
                      <p className="text-xs text-[#F4F4F5] truncate" title={entry.notes}>
                        {entry.notes}
                      </p>
                    ) : (
                      <span className="text-xs text-[#A1A1AA] italic">No notes attached</span>
                    )}
                    {entry.proof_media_url && (
                      <button
                        type="button"
                        onClick={() => setPreviewImage(entry.proof_media_url || null)}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-mono text-[#F05030] hover:underline cursor-pointer"
                      >
                        <ImageIcon className="w-3 h-3" />
                        View Proof Media
                      </button>
                    )}
                  </td>

                  <td className="py-3.5 px-4 font-mono text-xs text-[#A1A1AA] whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-[#A1A1AA]" />
                      <span>{new Date(entry.created_at).toLocaleString()}</span>
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
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 bg-[#222226] border border-[#333338] text-[#F4F4F5] disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5 inline mr-1" />
                Previous
              </button>
              <button
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 bg-[#222226] border border-[#333338] text-[#F4F4F5] disabled:opacity-40 cursor-pointer"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Media Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#222226] border border-[#333338] max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-[#333338] flex items-center justify-between bg-[#18181B]">
              <span className="font-mono text-xs uppercase tracking-wider text-[#F4F4F5] font-semibold">
                Resolution Proof Media
              </span>
              <button
                onClick={() => setPreviewImage(null)}
                className="text-[#A1A1AA] hover:text-[#F4F4F5] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-[#18181B]">
              <img
                src={previewImage}
                alt="Proof"
                className="max-h-[60vh] max-w-full object-contain border border-[#333338]"
              />
            </div>
            <div className="p-3 bg-[#18181B] border-t border-[#333338] flex justify-end">
              <button
                onClick={() => setPreviewImage(null)}
                className="px-3.5 py-1.5 text-xs font-mono bg-[#2B2B30] hover:bg-[#333338] text-[#F4F4F5] border border-[#333338] cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

SuperAdminAuditPage.displayName = 'SuperAdminAuditPage';
