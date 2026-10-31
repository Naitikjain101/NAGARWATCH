import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  ShieldCheck,
  Landmark,
  Layers,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  History,
  AlertCircle,
  Sliders,
  Compass,
  MapPin,
  Activity,
  ShieldAlert,
  Server,
  RefreshCw,
} from 'lucide-react';
import apiClient from '../../lib/apiClient';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorState } from '../../components/ui/ErrorState';
import { MapContainer, TileLayer, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface OverviewData {
  users: {
    total_users: number;
    total_citizens: number;
    total_admins: number;
    total_superadmins: number;
  };
  incidents: {
    total_incidents: number;
    reported: number;
    verified: number;
    in_progress: number;
    resolved: number;
    rejected: number;
  };
  total_wards: number;
  recent_incidents: any[];
  recent_users: any[];
}

export const SuperAdminOverviewPage: React.FC = () => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOverview = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/v1/superadmin/overview');
      setData(res.data?.data || null);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 403) {
        setError('Access denied. Super Administrator authorization required.');
      } else {
        setError('Failed to load SuperAdmin platform overview.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <LoadingSpinner size="lg" />
        <p className="text-xs font-mono text-[#A1A1AA]">INITIALIZING METROPOLITAN TELEMETRY...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        title="SuperAdmin Overview Unavailable"
        description={error || 'No overview data returned.'}
        onRetry={() => fetchOverview(true)}
        className="my-8"
      />
    );
  }

  const { users, incidents, total_wards, recent_incidents, recent_users } = data;
  const totalInc = incidents.total_incidents || 0;
  const resolvedPct = totalInc > 0 ? Math.round(((incidents.resolved || 0) / totalInc) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* ─── Governance Masthead ─────────────────────────────────────────────── */}
      <div className="bg-[#222226] border border-[#333338] p-5 sm:p-7 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#F05030]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider bg-[#F05030]/20 text-[#F05030] border border-[#F05030]/30 px-2 py-0.5">
                MUNICIPAL ROOT AUTHORITY
              </span>
              <span className="text-xs text-[#333338]">•</span>
              <span className="text-[11px] font-mono text-[#A1A1AA] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                CITY-WIDE LIVE MONITORING
              </span>
            </div>

            <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-normal tracking-tight text-[#F4F4F5]">
              NagarWatch Governance Platform
            </h2>
            <p className="text-xs sm:text-sm text-[#A1A1AA] mt-1 max-w-3xl leading-relaxed">
              Full administrative authority across municipal boundaries, administrator jurisdictional allocations, user verification records, and immutable system audit logs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => fetchOverview(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#2B2B30] hover:bg-[#333338] text-[#F4F4F5] text-xs font-medium border border-[#333338] transition-colors cursor-pointer"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>
            <Link to="/superadmin/wards">
              <button className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#F05030] hover:bg-[#D9381E] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer">
                <Landmark className="w-3.5 h-3.5" />
                <span>Manage Wards</span>
              </button>
            </Link>
            <Link to="/superadmin/admins">
              <button className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#2B2B30] hover:bg-[#333338] text-[#F4F4F5] text-xs font-medium border border-[#333338] transition-colors cursor-pointer">
                <ShieldCheck className="w-3.5 h-3.5 text-[#F05030]" />
                <span>Admins Directory</span>
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Metric Ribbon ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
        {/* Total Users */}
        <div className="bg-[#222226] border border-[#333338] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#A1A1AA] mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">Total Users</span>
            <Users className="w-3.5 h-3.5 text-[#F05030]" />
          </div>
          <p className="font-heading text-2xl lg:text-3xl font-normal text-[#F4F4F5]">{users.total_users}</p>
          <p className="text-[10px] text-[#A1A1AA] font-mono mt-0.5 truncate">Registered Accounts</p>
        </div>

        {/* Citizens */}
        <div className="bg-[#222226] border border-[#333338] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#A1A1AA] mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">Citizens</span>
            <Users className="w-3.5 h-3.5 text-[#A1A1AA]" />
          </div>
          <p className="font-heading text-2xl lg:text-3xl font-normal text-[#F4F4F5]">{users.total_citizens}</p>
          <p className="text-[10px] text-[#A1A1AA] font-mono mt-0.5 truncate">Community Members</p>
        </div>

        {/* Ward Admins */}
        <div className="bg-[#222226] border border-[#333338] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#A1A1AA] mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">Ward Admins</span>
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="font-heading text-2xl lg:text-3xl font-normal text-[#F4F4F5]">{users.total_admins}</p>
          <p className="text-[10px] text-[#A1A1AA] font-mono mt-0.5 truncate">Assigned Officers</p>
        </div>

        {/* Wards */}
        <div className="bg-[#222226] border border-[#333338] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#A1A1AA] mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">Wards</span>
            <Landmark className="w-3.5 h-3.5 text-[#A1A1AA]" />
          </div>
          <p className="font-heading text-2xl lg:text-3xl font-normal text-[#F4F4F5]">{total_wards}</p>
          <p className="text-[10px] text-[#A1A1AA] font-mono mt-0.5 truncate">Active Boundaries</p>
        </div>

        {/* Total Incidents */}
        <div className="bg-[#222226] border border-[#333338] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#A1A1AA] mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">Total Incidents</span>
            <Layers className="w-3.5 h-3.5 text-[#F05030]" />
          </div>
          <p className="font-heading text-2xl lg:text-3xl font-normal text-[#F4F4F5]">{totalInc}</p>
          <p className="text-[10px] text-[#A1A1AA] font-mono mt-0.5 truncate">Platform-Wide</p>
        </div>

        {/* Reported */}
        <div className="bg-[#222226] border border-[#333338] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#A1A1AA] mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">Reported</span>
            <Clock className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <p className="font-heading text-2xl lg:text-3xl font-normal text-sky-400">{incidents.reported || 0}</p>
          <p className="text-[10px] text-[#A1A1AA] font-mono mt-0.5 truncate">Awaiting Review</p>
        </div>

        {/* Resolved */}
        <div className="bg-[#222226] border border-[#333338] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#A1A1AA] mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">Resolved</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="font-heading text-2xl lg:text-3xl font-normal text-emerald-400">{incidents.resolved || 0}</p>
          <p className="text-[10px] text-[#A1A1AA] font-mono mt-0.5 truncate">Fixed & Verified</p>
        </div>
      </div>

      {/* ─── City-Wide Incident Status Breakdown ────────────────────────────── */}
      {totalInc > 0 && (
        <div className="bg-[#222226] border border-[#333338] p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#F05030]" />
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#F4F4F5]">
                City-Wide Incident Status Breakdown
              </span>
            </div>
            <span className="text-xs font-mono text-[#A1A1AA]">
              {incidents.resolved} of {totalInc} resolved ({resolvedPct}%) • Target (frontend heuristic): 85%
            </span>
          </div>

          {/* Segmented Distribution Bar */}
          <div className="h-2 w-full bg-[#18181B] rounded-none overflow-hidden flex border border-[#333338]">
            {incidents.reported > 0 && (
              <div
                style={{ width: `${(incidents.reported / totalInc) * 100}%` }}
                className="bg-sky-500 h-full"
                title={`Reported: ${incidents.reported}`}
              />
            )}
            {incidents.verified > 0 && (
              <div
                style={{ width: `${(incidents.verified / totalInc) * 100}%` }}
                className="bg-teal-500 h-full"
                title={`Verified: ${incidents.verified}`}
              />
            )}
            {incidents.in_progress > 0 && (
              <div
                style={{ width: `${(incidents.in_progress / totalInc) * 100}%` }}
                className="bg-amber-500 h-full"
                title={`In Progress: ${incidents.in_progress}`}
              />
            )}
            {incidents.resolved > 0 && (
              <div
                style={{ width: `${(incidents.resolved / totalInc) * 100}%` }}
                className="bg-emerald-500 h-full"
                title={`Resolved: ${incidents.resolved}`}
              />
            )}
            {incidents.rejected > 0 && (
              <div
                style={{ width: `${(incidents.rejected / totalInc) * 100}%` }}
                className="bg-rose-500 h-full"
                title={`Rejected: ${incidents.rejected}`}
              />
            )}
          </div>

          {/* Multi-Modal Status Legend */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-mono text-[#A1A1AA]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 bg-sky-500 inline-block" /> Reported ({incidents.reported})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 bg-teal-500 inline-block" /> Verified ({incidents.verified})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 bg-amber-500 inline-block" /> In Progress ({incidents.in_progress})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 inline-block" /> Resolved ({incidents.resolved})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 bg-rose-500 inline-block" /> Rejected ({incidents.rejected})
            </span>
          </div>
        </div>
      )}

      {/* ─── Two-Column Operational Feeds ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Recent Platform Incidents */}
        <div className="bg-[#222226] border border-[#333338] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#333338]">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#F05030]" />
                <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-[#F4F4F5]">
                  Recent Platform Incidents
                </h3>
              </div>
              <Link
                to="/admin/incidents"
                className="text-xs font-mono text-[#F05030] hover:text-[#D9381E] flex items-center gap-1 transition-colors"
              >
                Inspect all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {recent_incidents.length === 0 ? (
              <p className="py-8 text-center text-xs font-mono text-[#A1A1AA]">NO RECENT INCIDENTS IN BUFFER</p>
            ) : (
              <div className="divide-y divide-[#333338]">
                {recent_incidents.map((incident: any) => (
                  <div key={incident.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#F4F4F5] truncate">
                        {incident.category}
                      </p>
                      <p className="text-xs text-[#A1A1AA] truncate">{incident.description || 'Municipal dispatch defect'}</p>
                      <p className="text-[10px] font-mono text-[#A1A1AA] mt-0.5">
                        Ward {incident.ward_id || 'N/A'} •{' '}
                        {new Date(incident.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusBadge status={incident.status} size="sm" showIcon={false} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Recently Registered Users */}
        <div className="bg-[#222226] border border-[#333338] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#333338]">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-[#F4F4F5]">
                  Recently Registered Users
                </h3>
              </div>
              <Link
                to="/superadmin/users"
                className="text-xs font-mono text-[#F05030] hover:text-[#D9381E] flex items-center gap-1 transition-colors"
              >
                Directory <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {recent_users.length === 0 ? (
              <p className="py-8 text-center text-xs font-mono text-[#A1A1AA]">NO USER RECORDS AVAILABLE</p>
            ) : (
              <div className="divide-y divide-[#333338]">
                {recent_users.map((u: any) => (
                  <div key={u.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-[#F4F4F5] truncate">{u.full_name}</p>
                        <span
                          className={`text-[9px] font-mono uppercase px-1.5 py-0.2 border ${
                            u.role === 'super_admin'
                              ? 'bg-[#F05030]/20 text-[#F05030] border-[#F05030]/30'
                              : u.role === 'admin'
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              : 'bg-[#2B2B30] text-[#A1A1AA] border-[#333338]'
                          }`}
                        >
                          {u.role}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-[#A1A1AA] truncate">{u.email || u.phone || 'No contact'}</p>
                    </div>
                    <span className="text-[10px] font-mono text-[#A1A1AA] shrink-0">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Governance Navigation Terminals ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link to="/superadmin/wards">
          <div className="bg-[#222226] border border-[#333338] p-4 hover:border-[#F05030]/50 transition-colors group cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#2B2B30] text-[#F05030] flex items-center justify-center border border-[#333338] group-hover:border-[#F05030]/40 transition-colors">
                <Landmark className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-[#F4F4F5]">Ward Boundaries</h4>
                <p className="text-xs text-[#A1A1AA] truncate mt-0.5">PostGIS polygons, sectors & GIS bounds</p>
              </div>
            </div>
          </div>
        </Link>

        <Link to="/superadmin/admins">
          <div className="bg-[#222226] border border-[#333338] p-4 hover:border-[#F05030]/50 transition-colors group cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#2B2B30] text-amber-400 flex items-center justify-center border border-[#333338] group-hover:border-amber-400/40 transition-colors">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-[#F4F4F5]">Administrator Roster</h4>
                <p className="text-xs text-[#A1A1AA] truncate mt-0.5">Allocate ward jurisdictions to staff</p>
              </div>
            </div>
          </div>
        </Link>

        <Link to="/superadmin/audit">
          <div className="bg-[#222226] border border-[#333338] p-4 hover:border-[#F05030]/50 transition-colors group cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#2B2B30] text-emerald-400 flex items-center justify-center border border-[#333338] group-hover:border-emerald-400/40 transition-colors">
                <History className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-[#F4F4F5]">Audit & Lifecycle Logs</h4>
                <p className="text-xs text-[#A1A1AA] truncate mt-0.5">Cryptographic state changes & history</p>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};

SuperAdminOverviewPage.displayName = 'SuperAdminOverviewPage';
