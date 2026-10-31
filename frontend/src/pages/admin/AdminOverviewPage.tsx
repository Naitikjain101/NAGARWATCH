import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  Layers,
  Map as MapIcon,
  Landmark,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  UserCheck,
  ArrowUpRight,
  RefreshCw,
  ExternalLink,
  Shield,
  Activity,
} from 'lucide-react';
import apiClient from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SharedIncidentMap, SharedMapIncident } from '../../components/map/SharedIncidentMap';
import IssueDetailsModal from '../../components/IssueDetailsModal';

export interface IncidentItem {
  id: string;
  category: string;
  description: string;
  status: string;
  image_url: string;
  created_at: string;
  ward_id: string | number;
  latitude?: number;
  longitude?: number;
  upvotes?: number;
  severity?: string;
  user_id?: string;
  has_exif_gps?: boolean;
}

export const AdminOverviewPage: React.FC = () => {
  const { userRole } = useAuth();
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<IncidentItem | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/api/v1/admin/incidents');
      const data = response.data?.data;
      setIncidents(Array.isArray(data) ? data : []);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401) {
        setError('Your session has expired. Please log in again.');
      } else if (status === 403) {
        setError('Access denied. Administrator privileges are required.');
      } else if (err.code === 'ERR_NETWORK') {
        setError('Cannot connect to NagarWatch server. Please check your network.');
      } else {
        setError('Failed to load ward incidents. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Compute actual counts from loaded data
  const totalCount = incidents.length;
  const reportedCount = incidents.filter(
    (i) => i.status === 'reported' || i.status === 'pending'
  ).length;
  const verifiedCount = incidents.filter((i) => i.status === 'verified').length;
  const inProgressCount = incidents.filter(
    (i) => i.status === 'in_progress' || i.status === 'assigned'
  ).length;
  const resolvedCount = incidents.filter((i) => i.status === 'resolved').length;
  const rejectedCount = incidents.filter((i) => i.status === 'rejected').length;

  // Priority Incidents: High/Critical severity, or newest unresolved
  const priorityIncidents = incidents
    .filter((i) => i.status !== 'resolved' && i.status !== 'rejected')
    .sort((a, b) => {
      const aHigh = a.severity === 'critical' ? 2 : a.severity === 'high' ? 1 : 0;
      const bHigh = b.severity === 'critical' ? 2 : b.severity === 'high' ? 1 : 0;
      if (bHigh !== aHigh) return bHigh - aHigh;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, 5);

  // Recent 5 incidents
  const recentIncidents = [...incidents]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  // Map incidents
  const mapIncidents: SharedMapIncident[] = incidents
    .filter((i) => typeof i.latitude === 'number' && typeof i.longitude === 'number')
    .map((i) => ({
      id: i.id,
      category: i.category,
      description: i.description,
      status: i.status,
      image_url: i.image_url,
      created_at: i.created_at,
      latitude: i.latitude,
      longitude: i.longitude,
      upvotes: i.upvotes,
      severity: i.severity,
      ward_id: i.ward_id,
    }));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-6 h-6 text-[#F05030] animate-spin" />
        <p className="text-xs font-mono uppercase tracking-wider text-[#A1A1AA]">
          Syncing ward telemetry...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-[#222226] border border-[#333338] rounded-sm max-w-xl mx-auto my-12 text-center">
        <AlertTriangle className="w-8 h-8 text-[#F05030] mx-auto mb-3" />
        <h3 className="text-base font-serif text-[#F4F4F5] mb-1">Operational Telemetry Offline</h3>
        <p className="text-xs text-[#A1A1AA] mb-4">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium bg-[#2B2B30] text-[#F4F4F5] hover:bg-[#333338] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Command Center Masthead ───────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 bg-[#222226] border border-[#333338] rounded-sm">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-widest bg-[#F05030]/20 text-[#F05030] border border-[#F05030]/30 px-1.5 py-0.5 rounded-xs">
              Ward Intelligence
            </span>
            <span className="text-[11px] text-[#A1A1AA] font-mono">•</span>
            <span className="text-[11px] text-[#A1A1AA] font-mono">
              {userRole === 'super_admin' ? 'City-Wide Jurisdiction' : 'Assigned Jurisdiction'}
            </span>
            <span className="text-[11px] text-[#A1A1AA] font-mono">•</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Feed
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif text-[#F4F4F5] tracking-tight">
            Operational Overview
          </h1>
          <p className="text-xs text-[#A1A1AA] mt-1 max-w-xl">
            Real-time status of civic issues reported across your administrative area. Live telemetry synced with ward GIS boundaries.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link to="/admin/incidents">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm text-xs font-medium bg-[#F05030] hover:bg-[#D9381E] text-white transition-colors shadow-xs"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Manage Incidents</span>
            </button>
          </Link>
          <Link to="/admin/map">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm text-xs font-medium bg-[#2B2B30] hover:bg-[#333338] text-[#F4F4F5] border border-[#333338] transition-colors"
            >
              <MapIcon className="w-3.5 h-3.5 text-[#A1A1AA]" />
              <span>Live Map</span>
            </button>
          </Link>
          <button
            type="button"
            onClick={fetchDashboardData}
            title="Refresh telemetry"
            className="p-2 rounded-sm text-[#A1A1AA] hover:text-[#F4F4F5] bg-[#2B2B30] border border-[#333338] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ─── Metric Telemetry Strip ────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-[#F05030]" />
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#A1A1AA]">
              Incident Metrics
            </span>
          </div>
          <span className="text-[11px] font-mono text-[#A1A1AA]">
            (Calculated from currently loaded {totalCount} records)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total */}
          <div className="p-4 bg-[#222226] border border-[#333338] rounded-sm">
            <div className="flex items-center justify-between text-[#A1A1AA] mb-1">
              <span className="text-[11px] font-mono uppercase tracking-wider">Total</span>
              <Layers className="w-3.5 h-3.5 text-[#A1A1AA]" />
            </div>
            <p className="text-3xl font-serif text-[#F4F4F5] font-semibold">{totalCount}</p>
            <p className="text-[11px] text-[#A1A1AA] mt-1 font-sans">Accessible Reports</p>
          </div>

          {/* Reported / Pending */}
          <div className="p-4 bg-[#222226] border border-[#333338] rounded-sm border-l-2 border-l-amber-500">
            <div className="flex items-center justify-between text-amber-400 mb-1">
              <span className="text-[11px] font-mono uppercase tracking-wider">Reported</span>
              <Clock className="w-3.5 h-3.5" />
            </div>
            <p className="text-3xl font-serif text-amber-400 font-semibold">{reportedCount}</p>
            <p className="text-[11px] text-[#A1A1AA] mt-1 font-sans">Awaiting Review</p>
          </div>

          {/* Verified */}
          <div className="p-4 bg-[#222226] border border-[#333338] rounded-sm border-l-2 border-l-teal-500">
            <div className="flex items-center justify-between text-teal-400 mb-1">
              <span className="text-[11px] font-mono uppercase tracking-wider">Verified</span>
              <UserCheck className="w-3.5 h-3.5" />
            </div>
            <p className="text-3xl font-serif text-teal-400 font-semibold">{verifiedCount}</p>
            <p className="text-[11px] text-[#A1A1AA] mt-1 font-sans">Community Upvoted</p>
          </div>

          {/* In Progress */}
          <div className="p-4 bg-[#222226] border border-[#333338] rounded-sm border-l-2 border-l-amber-400">
            <div className="flex items-center justify-between text-amber-300 mb-1">
              <span className="text-[11px] font-mono uppercase tracking-wider">In Progress</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
            <p className="text-3xl font-serif text-amber-300 font-semibold">{inProgressCount}</p>
            <p className="text-[11px] text-[#A1A1AA] mt-1 font-sans">Active Operations</p>
          </div>

          {/* Resolved */}
          <div className="p-4 bg-[#222226] border border-[#333338] rounded-sm border-l-2 border-l-emerald-500">
            <div className="flex items-center justify-between text-emerald-400 mb-1">
              <span className="text-[11px] font-mono uppercase tracking-wider">Resolved</span>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <p className="text-3xl font-serif text-emerald-400 font-semibold">{resolvedCount}</p>
            <p className="text-[11px] text-[#A1A1AA] mt-1 font-sans">Verified Fixed</p>
          </div>

          {/* Rejected */}
          <div className="p-4 bg-[#222226] border border-[#333338] rounded-sm border-l-2 border-l-[#71717A]">
            <div className="flex items-center justify-between text-[#A1A1AA] mb-1">
              <span className="text-[11px] font-mono uppercase tracking-wider">Rejected</span>
              <XCircle className="w-3.5 h-3.5" />
            </div>
            <p className="text-3xl font-serif text-[#A1A1AA] font-semibold">{rejectedCount}</p>
            <p className="text-[11px] text-[#A1A1AA] mt-1 font-sans">Out of Scope</p>
          </div>
        </div>
      </div>

      {/* ─── Status Distribution Linear Meter ──────────────────────────────── */}
      {totalCount > 0 && (
        <div className="p-4 bg-[#222226] border border-[#333338] rounded-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#A1A1AA]">
              Status Distribution
            </span>
            <span className="text-xs font-mono text-[#F4F4F5]">
              {resolvedCount} of {totalCount} resolved ({Math.round((resolvedCount / totalCount) * 100)}%)
            </span>
          </div>
          <div className="h-2 w-full bg-[#18181B] rounded-xs overflow-hidden flex">
            {reportedCount > 0 && (
              <div
                style={{ width: `${(reportedCount / totalCount) * 100}%` }}
                className="bg-amber-500 h-full"
                title={`Reported: ${reportedCount}`}
              />
            )}
            {verifiedCount > 0 && (
              <div
                style={{ width: `${(verifiedCount / totalCount) * 100}%` }}
                className="bg-teal-500 h-full"
                title={`Verified: ${verifiedCount}`}
              />
            )}
            {inProgressCount > 0 && (
              <div
                style={{ width: `${(inProgressCount / totalCount) * 100}%` }}
                className="bg-amber-400 h-full"
                title={`In Progress: ${inProgressCount}`}
              />
            )}
            {resolvedCount > 0 && (
              <div
                style={{ width: `${(resolvedCount / totalCount) * 100}%` }}
                className="bg-emerald-500 h-full"
                title={`Resolved: ${resolvedCount}`}
              />
            )}
            {rejectedCount > 0 && (
              <div
                style={{ width: `${(rejectedCount / totalCount) * 100}%` }}
                className="bg-[#71717A] h-full"
                title={`Rejected: ${rejectedCount}`}
              />
            )}
          </div>
        </div>
      )}

      {/* ─── Dual Panes: Priority Queue (60%) + Spatial GIS Mini-Map (40%) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Priority Incidents Section */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#F05030]" />
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#F4F4F5]">
                Priority Incidents Requiring Action
              </h2>
            </div>
            <Link
              to="/admin/incidents"
              className="text-xs font-mono text-[#F05030] hover:underline flex items-center gap-1"
            >
              <span>Full Queue</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {priorityIncidents.length === 0 ? (
            <div className="p-8 bg-[#222226] border border-[#333338] rounded-sm text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-serif text-[#F4F4F5]">No High-Priority Incidents</p>
              <p className="text-xs text-[#A1A1AA] mt-1">
                All critical civic issues in this sector have been triaged or addressed.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {priorityIncidents.map((incident) => (
                <div
                  key={incident.id}
                  onClick={() => setSelectedIncident(incident)}
                  className="p-3.5 bg-[#222226] hover:bg-[#2B2B30] border border-[#333338] hover:border-[#4B4B52] rounded-sm cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[11px] font-mono-id text-[#A1A1AA] font-bold">
                          #{incident.id}
                        </span>
                        <span className="text-xs font-semibold text-[#F4F4F5] bg-[#2B2B30] px-2 py-0.5 rounded-xs border border-[#333338]">
                          {incident.category}
                        </span>
                        <StatusBadge status={incident.status} size="sm" />
                        {incident.severity && (
                          <span
                            className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded-xs border ${
                              incident.severity === 'critical'
                                ? 'bg-red-950/40 text-red-400 border-red-800/50 font-bold'
                                : incident.severity === 'high'
                                ? 'bg-amber-950/40 text-amber-400 border-amber-800/50'
                                : 'bg-[#2B2B30] text-[#A1A1AA] border-[#333338]'
                            }`}
                          >
                            {incident.severity}
                          </span>
                        )}
                        {/* SLA target heuristic strictly labeled */}
                        <span className="text-[10px] font-mono text-[#A1A1AA] bg-[#18181B] px-1.5 py-0.5 rounded-xs border border-[#333338]">
                          Target (frontend heuristic): 24h
                        </span>
                      </div>

                      <p className="text-xs text-[#F4F4F5] line-clamp-2 leading-relaxed">
                        {incident.description}
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-[#A1A1AA]">
                        <span>Ward #{incident.ward_id}</span>
                        {typeof incident.latitude === 'number' && typeof incident.longitude === 'number' && (
                          <span>
                            {incident.latitude.toFixed(4)}°, {incident.longitude.toFixed(4)}°
                          </span>
                        )}
                        <span>{new Date(incident.created_at).toLocaleDateString()}</span>
                        {incident.upvotes ? <span>★ {incident.upvotes} upvotes</span> : null}
                      </div>
                    </div>

                    {incident.image_url && (
                      <img
                        src={incident.image_url}
                        alt=""
                        className="w-14 h-14 rounded-xs object-cover border border-[#333338] shrink-0"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live GIS Map Panel (40%) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <MapIcon className="w-4 h-4 text-[#F05030]" />
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#F4F4F5]">
                Ward GIS Sector Map
              </h2>
            </div>
            <Link
              to="/admin/map"
              className="text-xs font-mono text-[#F05030] hover:underline flex items-center gap-1"
            >
              <span>Full Screen</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <div className="h-[420px] bg-[#222226] border border-[#333338] rounded-sm overflow-hidden relative">
            <SharedIncidentMap
              incidents={mapIncidents}
              theme="graphite"
              interactive={true}
              selectedIncident={
                selectedIncident
                  ? {
                      id: selectedIncident.id,
                      category: selectedIncident.category,
                      description: selectedIncident.description,
                      status: selectedIncident.status,
                      image_url: selectedIncident.image_url,
                      created_at: selectedIncident.created_at,
                      latitude: selectedIncident.latitude,
                      longitude: selectedIncident.longitude,
                    }
                  : null
              }
              onSelectIncident={(inc) => {
                const found = incidents.find((i) => i.id === inc.id);
                if (found) setSelectedIncident(found);
              }}
              className="w-full h-full"
            />
            <div className="absolute bottom-2 left-2 right-2 bg-[#18181B]/90 backdrop-blur-xs border border-[#333338] px-3 py-1.5 rounded-xs flex items-center justify-between text-[10px] font-mono text-[#A1A1AA] z-10 pointer-events-none">
              <span>{mapIncidents.length} geolocated incidents mapped</span>
              <span className="text-[#F05030]">Click marker to inspect</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Recent Telemetry Activity Stream ──────────────────────────────── */}
      <div className="p-4 bg-[#222226] border border-[#333338] rounded-sm space-y-3">
        <div className="flex items-center justify-between border-b border-[#333338] pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#A1A1AA]" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#F4F4F5]">
              Live Ingestion & Update Log
            </h3>
          </div>
          <span className="text-[11px] font-mono text-[#A1A1AA]">Latest 6 incidents</span>
        </div>

        <div className="divide-y divide-[#333338]">
          {recentIncidents.map((incident) => (
            <div
              key={incident.id}
              onClick={() => setSelectedIncident(incident)}
              className="py-2.5 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#2B2B30]/50 px-2 rounded-xs transition-colors"
            >
              <div className="min-w-0 flex items-center gap-3">
                <span className="text-xs font-mono-id text-[#A1A1AA] font-bold shrink-0">
                  #{incident.id}
                </span>
                <span className="text-xs text-[#F4F4F5] truncate max-w-md">
                  {incident.description}
                </span>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="text-xs text-[#A1A1AA] font-mono hidden sm:inline">
                  {incident.category}
                </span>
                <StatusBadge status={incident.status} size="sm" />
                <span className="text-[11px] font-mono text-[#A1A1AA] hidden md:inline">
                  {new Date(incident.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Incident Inspector Modal ──────────────────────────────────────── */}
      {selectedIncident && (
        <IssueDetailsModal
          issue={{
            id: selectedIncident.id,
            category: selectedIncident.category,
            description: selectedIncident.description,
            status: selectedIncident.status,
            image_url: selectedIncident.image_url,
            created_at: selectedIncident.created_at,
            latitude: selectedIncident.latitude,
            longitude: selectedIncident.longitude,
            upvotes: selectedIncident.upvotes,
          }}
          onClose={() => setSelectedIncident(null)}
        />
      )}
    </div>
  );
};
