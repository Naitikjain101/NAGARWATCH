import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../lib/apiClient';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import IssueDetailsModal from '../components/IssueDetailsModal';
import {
  FileText,
  PlusCircle,
  RefreshCw,
  Search,
  MapPin,
  Clock,
  ThumbsUp,
  AlertTriangle,
  X,
  Bell,
  CheckCircle,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Activity,
  Compass,
  ArrowUpDown,
  Layers,
  Shield,
  ShieldCheck,
  CheckCircle2,
  Image as ImageIcon,
  CheckSquare,
  Sparkles,
} from 'lucide-react';

export interface IncidentReport {
  id: string;
  category: string;
  description: string;
  status: string;
  image_url: string;
  created_at: string;
  updated_at?: string;
  ward_id?: string | number;
  ward_name?: string;
  latitude?: number;
  longitude?: number;
  upvotes?: number;
  confirmations_count?: number;
  disputes_count?: number;
  severity?: string;
  resolution_notes?: string;
  resolved_at?: string;
  proof_media_url?: string;
}

export interface InAppNotification {
  id: string;
  incident_id?: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

const CATEGORY_FILTER_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'Pothole', label: 'Pothole' },
  { value: 'Streetlight', label: 'Streetlight' },
  { value: 'Garbage', label: 'Garbage' },
  { value: 'Water Leak', label: 'Water Leak' },
  { value: 'Graffiti', label: 'Graffiti' },
  { value: 'Signage', label: 'Signage' },
  { value: 'Safety Hazard', label: 'Safety Hazard' },
  { value: 'Encroachment', label: 'Encroachment' },
  { value: 'Other', label: 'Other' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'reported', label: 'Reported / Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'rejected', label: 'Rejected' },
];

const DATE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'week', label: 'Past 7 Days' },
  { value: 'month', label: 'Past 30 Days' },
  { value: 'six_months', label: 'Past 6 Months' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'updated', label: 'Recently Updated' },
];

const ITEMS_PER_PAGE = 10;

// Helper to calculate linear progress through municipal lifecycle
function getLifecycleStage(status?: string): { stage: number; isRejected: boolean } {
  if (!status) return { stage: 1, isRejected: false };
  const s = status.toLowerCase();
  if (s === 'rejected') return { stage: 2, isRejected: true };
  if (s === 'resolved' || s === 'closed') return { stage: 4, isRejected: false };
  if (s === 'in_progress' || s === 'assigned') return { stage: 3, isRejected: false };
  if (s === 'verified') return { stage: 2, isRejected: false };
  return { stage: 1, isRejected: false }; // reported / pending
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Data states
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter and sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);

  // Notifications state
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Fetch authenticated citizen's personal reports
  const fetchReports = async (isManualRefresh = false) => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get('/api/v1/incidents/me');
      const data = response.data?.data;
      setReports(Array.isArray(data) ? data : []);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401) {
        setError('Your session has expired. Please log in again to view your reports.');
      } else if (status === 403) {
        setError('You do not have permission to view personal reports.');
      } else if (err.code === 'ERR_NETWORK') {
        setError('Cannot connect to NagarWatch server. Please check your network.');
      } else {
        setError('Failed to load your reports. Please try again later.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch real in-app notifications
  const fetchNotifications = async () => {
    if (!user) return;
    setLoadingNotifications(true);
    try {
      const res = await apiClient.get('/api/v1/notifications/me');
      const notifs = res.data?.data;
      if (Array.isArray(notifs)) {
        setNotifications(notifs);
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    fetchReports();
    fetchNotifications();
  }, [user]);

  const handleMarkAsRead = async (notifId: string) => {
    try {
      await apiClient.patch(`/api/v1/notifications/${notifId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
      );
    } catch {
      // Ignored
    }
  };

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // KPI Metrics computed from actual reports
  const metrics = useMemo(() => {
    const total = reports.length;
    const active = reports.filter((r) =>
      ['reported', 'pending', 'verified', 'assigned', 'in_progress'].includes(
        (r.status || '').toLowerCase()
      )
    ).length;
    const resolved = reports.filter((r) =>
      ['resolved', 'closed'].includes((r.status || '').toLowerCase())
    ).length;
    const totalConfirmations = reports.reduce(
      (sum, r) => sum + (r.upvotes ?? r.confirmations_count ?? 0),
      0
    );

    return { total, active, resolved, totalConfirmations };
  }, [reports]);

  // Client-side filtering and sorting over authentic reports
  const filteredReports = useMemo(() => {
    const now = new Date().getTime();

    const filtered = reports.filter((rep) => {
      // Category filter
      if (
        categoryFilter !== 'all' &&
        rep.category.toLowerCase() !== categoryFilter.toLowerCase()
      ) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const normStatus = (rep.status || '').toLowerCase();
        if (
          statusFilter === 'reported' &&
          normStatus !== 'reported' &&
          normStatus !== 'pending'
        ) {
          return false;
        } else if (statusFilter !== 'reported' && normStatus !== statusFilter.toLowerCase()) {
          return false;
        }
      }

      // Date window filter
      if (dateFilter !== 'all') {
        const createdMs = new Date(rep.created_at).getTime();
        const diffDays = (now - createdMs) / (1000 * 60 * 60 * 24);
        if (dateFilter === 'week' && diffDays > 7) return false;
        if (dateFilter === 'month' && diffDays > 30) return false;
        if (dateFilter === 'six_months' && diffDays > 180) return false;
      }

      // Search query filter (matches category, description, or reference ID)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesCategory = rep.category.toLowerCase().includes(query);
        const matchesDescription = (rep.description || '').toLowerCase().includes(query);
        const matchesId = rep.id.toLowerCase().includes(query);
        if (!matchesCategory && !matchesDescription && !matchesId) {
          return false;
        }
      }

      return true;
    });

    // Sorting
    filtered.sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'updated') {
        const timeA = new Date(a.updated_at || a.created_at).getTime();
        const timeB = new Date(b.updated_at || b.created_at).getTime();
        return timeB - timeA;
      }
      // default: newest
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return filtered;
  }, [reports, categoryFilter, statusFilter, dateFilter, searchQuery, sortBy]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredReports.length / ITEMS_PER_PAGE) || 1;
  const paginatedReports = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredReports.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredReports, currentPage]);

  const hasActiveFilters =
    categoryFilter !== 'all' ||
    statusFilter !== 'all' ||
    dateFilter !== 'all' ||
    searchQuery.trim().length > 0;

  const handleClearFilters = () => {
    setCategoryFilter('all');
    setStatusFilter('all');
    setDateFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const unreadNotifsCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 font-sans text-[#1C1917] dark:text-[#F4F4F5] antialiased space-y-6 pb-12">
      {/* ─── Editorial Header & Actions ──────────────────────────────────── */}
      <div className="pb-6 border-b border-[#E5E0D4] dark:border-[#333338] flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#D9381E] dark:text-[#F05030] font-semibold bg-[#D9381E]/10 dark:bg-[#F05030]/20 border border-[#D9381E]/20 dark:border-[#F05030]/30 px-1.5 py-0.5 rounded-xs">
              Citizen Registry
            </span>
            <span className="text-[11px] font-mono text-[#78716C] dark:text-[#A1A1AA]">•</span>
            <span className="text-[11px] font-mono text-[#78716C] dark:text-[#A1A1AA]">
              Municipal Lifecycle Tracking
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#1C1917] dark:text-[#F4F4F5] tracking-tight">
            My Reports
          </h1>
          <p className="text-xs sm:text-sm text-[#78716C] dark:text-[#A1A1AA] mt-1 max-w-2xl leading-relaxed">
            Track the status, municipal triage, and resolution progress of issues you've submitted.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#FBF9F4] dark:bg-[#222226] hover:bg-[#F4F1EA] dark:hover:bg-[#2B2B30] text-[#1C1917] dark:text-[#F4F4F5] border border-[#E5E0D4] dark:border-[#333338] text-xs font-mono font-medium transition-colors cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-[#D9381E] dark:text-[#F05030]" />
              <span>Updates</span>
              {unreadNotifsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-[#D9381E] dark:bg-[#F05030] text-white text-[10px] font-bold rounded-xs">
                  {unreadNotifsCount}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            disabled={refreshing}
            onClick={() => fetchReports(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#FBF9F4] dark:bg-[#222226] hover:bg-[#F4F1EA] dark:hover:bg-[#2B2B30] text-[#1C1917] dark:text-[#F4F4F5] border border-[#E5E0D4] dark:border-[#333338] text-xs font-mono font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#78716C] dark:text-[#A1A1AA] ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link to="/report">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm bg-[#D9381E] hover:bg-[#B92B15] dark:bg-[#F05030] dark:hover:bg-[#D9381E] text-white text-xs font-mono font-medium transition-colors shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Report Issue</span>
            </button>
          </Link>
        </div>
      </div>

      {/* ─── Notifications Drawer / Panel ─────────────────────────────────── */}
      {showNotifications && (
        <div className="p-4 sm:p-5 rounded-sm bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] shadow-xs space-y-3 font-sans">
          <div className="flex items-center justify-between pb-2 border-b border-[#E5E0D4] dark:border-[#333338]">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#D9381E] dark:text-[#F05030]" />
              <h3 className="font-serif font-bold text-base text-[#1C1917] dark:text-[#F4F4F5]">
                Personal Incident Notifications
              </h3>
              {unreadNotifsCount > 0 && (
                <span className="text-[10px] font-mono uppercase bg-[#D9381E]/10 dark:bg-[#F05030]/20 border border-[#D9381E]/20 dark:border-[#F05030]/30 text-[#D9381E] dark:text-[#F05030] px-1.5 py-0.5 rounded-xs font-semibold">
                  {unreadNotifsCount} unread
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowNotifications(false)}
              className="text-[#78716C] dark:text-[#A1A1AA] hover:text-[#1C1917] dark:hover:text-[#F4F4F5] p-1 font-mono text-xs cursor-pointer"
              aria-label="Close notifications"
            >
              [✕]
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <p className="text-xs text-[#78716C] dark:text-[#A1A1AA] py-3 text-center font-mono">
                No notifications recorded yet. You will receive updates here when municipal officials triage or resolve your reports.
              </p>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 rounded-sm border text-xs flex items-start justify-between gap-3 transition-colors ${
                    notif.is_read
                      ? 'bg-[#F4F1EA] dark:bg-[#18181B] border-[#E5E0D4] dark:border-[#333338] text-[#78716C] dark:text-[#A1A1AA]'
                      : 'bg-[#FBF9F4] dark:bg-[#2B2B30] border-[#D9381E]/40 dark:border-[#F05030]/40 text-[#1C1917] dark:text-[#F4F4F5]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {!notif.is_read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D9381E] dark:bg-[#F05030] shrink-0" />
                      )}
                      <p className="font-semibold text-xs text-[#1C1917] dark:text-[#F4F4F5]">{notif.title}</p>
                    </div>
                    <p className="text-[#57534E] dark:text-[#A1A1AA] text-[11px] leading-relaxed">{notif.body}</p>
                    <span className="text-[10px] font-mono text-[#78716C] dark:text-[#A1A1AA]">
                      {new Date(notif.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {!notif.is_read && (
                    <button
                      type="button"
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="text-[11px] font-mono text-[#D9381E] dark:text-[#F05030] hover:underline px-2 py-1 shrink-0 cursor-pointer"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── Summary KPI Telemetry Ribbon ─────────────────────────────────── */}
      {reports.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 sm:p-4 rounded-sm bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] shadow-xs space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA] flex items-center gap-1 font-semibold">
              <FileText className="w-3.5 h-3.5 text-[#4682B4]" />
              Total Reports
            </span>
            <p className="text-2xl font-serif font-bold text-[#1C1917] dark:text-[#F4F4F5]">{metrics.total}</p>
          </div>

          <div className="p-3.5 sm:p-4 rounded-sm bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] shadow-xs space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA] flex items-center gap-1 font-semibold">
              <Activity className="w-3.5 h-3.5 text-[#D97706]" />
              Active Triage
            </span>
            <p className="text-2xl font-serif font-bold text-[#D97706]">{metrics.active}</p>
          </div>

          <div className="p-3.5 sm:p-4 rounded-sm bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] shadow-xs space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA] flex items-center gap-1 font-semibold">
              <CheckCircle className="w-3.5 h-3.5 text-[#16A34A]" />
              Resolved
            </span>
            <p className="text-2xl font-serif font-bold text-[#16A34A]">{metrics.resolved}</p>
          </div>

          <div className="p-3.5 sm:p-4 rounded-sm bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] shadow-xs space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA] flex items-center gap-1 font-semibold">
              <ThumbsUp className="w-3.5 h-3.5 text-[#0D9488]" />
              Endorsements
            </span>
            <p className="text-2xl font-serif font-bold text-[#0D9488]">{metrics.totalConfirmations}</p>
          </div>
        </div>
      )}

      {/* ─── Search & Filter Control HUD ──────────────────────────────────── */}
      {reports.length > 0 && (
        <div className="p-4 rounded-sm bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] shadow-xs space-y-3 font-sans">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {/* Search input */}
            <div className="lg:col-span-2 relative">
              <Search className="w-3.5 h-3.5 text-[#78716C] dark:text-[#A1A1AA] absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search your reports by keyword or ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-[#F4F1EA] dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] rounded-sm pl-8 pr-3 py-2 text-xs font-sans text-[#1C1917] dark:text-[#F4F4F5] placeholder:text-[#A8A29E] dark:placeholder:text-[#78716C] focus:outline-none focus:border-[#D9381E] dark:focus:border-[#F05030] transition-colors"
              />
            </div>

            {/* Category Select */}
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-[#F4F1EA] dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] rounded-sm px-2.5 py-2 text-xs font-sans text-[#1C1917] dark:text-[#F4F4F5] focus:outline-none focus:border-[#D9381E] dark:focus:border-[#F05030] transition-colors"
              >
                {CATEGORY_FILTER_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Select */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-[#F4F1EA] dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] rounded-sm px-2.5 py-2 text-xs font-sans text-[#1C1917] dark:text-[#F4F4F5] focus:outline-none focus:border-[#D9381E] dark:focus:border-[#F05030] transition-colors"
              >
                {STATUS_FILTER_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Window */}
            <div>
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-[#F4F1EA] dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] rounded-sm px-2.5 py-2 text-xs font-sans text-[#1C1917] dark:text-[#F4F4F5] focus:outline-none focus:border-[#D9381E] dark:focus:border-[#F05030] transition-colors"
              >
                {DATE_FILTER_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Secondary Sorting and Active Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#E5E0D4] dark:border-[#333338] text-xs font-mono">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-[#78716C] dark:text-[#A1A1AA]">
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>Sort by:</span>
              </div>
              <div className="w-36">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full bg-[#F4F1EA] dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] rounded-sm px-2 py-1 text-xs font-sans text-[#1C1917] dark:text-[#F4F4F5] focus:outline-none focus:border-[#D9381E] dark:focus:border-[#F05030]"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[#78716C] dark:text-[#A1A1AA] hover:text-[#D9381E] dark:hover:text-[#F05030] transition-colors text-xs cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Clear Filters</span>
                </button>
              )}
            </div>

            <span className="text-[#78716C] dark:text-[#A1A1AA]">
              Showing {filteredReports.length} of {reports.length}{' '}
              {reports.length === 1 ? 'report' : 'reports'}
            </span>
          </div>
        </div>
      )}

      {/* ─── Content Presentation ─────────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 bg-[#FBF9F4] rounded-sm border border-[#E5E0D4] flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 text-[#D9381E] animate-spin" />
          <p className="text-xs font-mono uppercase tracking-wider text-[#78716C]">
            Loading your reports...
          </p>
        </div>
      ) : error ? (
        <div className="p-8 bg-[#FBF9F4] border border-[#E5E0D4] rounded-sm text-center max-w-md mx-auto space-y-3 font-sans">
          <AlertTriangle className="w-8 h-8 text-[#D9381E] mx-auto" />
          <h3 className="font-serif font-bold text-lg text-[#1C1917]">Could Not Load Reports</h3>
          <p className="text-xs text-[#78716C] leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={() => fetchReports()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm bg-[#D9381E] hover:bg-[#B92B15] text-white text-xs font-mono font-medium transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      ) : reports.length === 0 ? (
        <div className="py-16 px-6 bg-[#FBF9F4] rounded-sm border border-[#E5E0D4] text-center max-w-lg mx-auto space-y-4 font-sans">
          <div className="w-12 h-12 rounded-full bg-[#F4F1EA] border border-[#E5E0D4] flex items-center justify-center mx-auto text-[#78716C]">
            <FileText className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-serif font-bold text-xl text-[#1C1917]">No reports submitted yet</h3>
            <p className="text-xs text-[#78716C] leading-relaxed max-w-sm mx-auto">
              You haven't reported any civic incidents. When you snap and submit a photo, your reports and their live fix status will appear here.
            </p>
          </div>
          <Link to="/report">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm bg-[#D9381E] hover:bg-[#B92B15] text-white text-xs font-mono font-medium transition-colors shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Report an Issue</span>
            </button>
          </Link>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="py-14 px-6 bg-[#FBF9F4] rounded-sm border border-[#E5E0D4] text-center max-w-md mx-auto space-y-3 font-sans">
          <Search className="w-7 h-7 text-[#78716C] mx-auto" />
          <h3 className="font-serif font-bold text-base text-[#1C1917]">No reports match your filters</h3>
          <p className="text-xs text-[#78716C]">No incidents match the active search and filter criteria.</p>
          <button
            type="button"
            onClick={handleClearFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#F4F1EA] hover:bg-[#EAE5D9] text-[#1C1917] border border-[#E5E0D4] text-xs font-mono font-medium transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ─── Visual Tracking Incident Cards ─────────────────────────────── */}
          <div className="space-y-3">
            {paginatedReports.map((report) => {
              const { stage, isRejected } = getLifecycleStage(report.status);

              return (
                <div
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className="bg-[#FBF9F4] dark:bg-[#222226] hover:bg-[#F4F1EA] dark:hover:bg-[#2B2B30] border border-[#E5E0D4] dark:border-[#333338] hover:border-[#D9381E]/60 dark:hover:border-[#F05030]/60 rounded-sm p-4 sm:p-5 transition-all cursor-pointer shadow-xs group"
                >
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Primary Photograph with Evidence Badge */}
                    <div className="relative w-full sm:w-36 sm:h-32 aspect-video sm:aspect-square rounded-xs overflow-hidden bg-[#F4F1EA] dark:bg-[#18181B] shrink-0 border border-[#E5E0D4] dark:border-[#333338]">
                      {report.image_url ? (
                        <img
                          src={report.image_url}
                          alt={report.category}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#78716C] dark:text-[#A1A1AA]">
                          <MapPin className="w-8 h-8 opacity-40" />
                        </div>
                      )}

                      {/* Proof media overlay badge if resolution proof exists */}
                      {report.proof_media_url && (
                        <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-xs bg-emerald-900/90 text-white text-[9px] font-mono font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-300" />
                          <span>Proof Added</span>
                        </div>
                      )}
                    </div>

                    {/* Incident Information & Lifecycle Terminal */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between space-y-3">
                      <div>
                        {/* Header Line: Category, #id copy button, Severity, Status Badge */}
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-serif font-bold text-[#1C1917] dark:text-[#F4F4F5]">
                              {report.category}
                            </h3>

                            {/* Reference ID with click-to-copy */}
                            <button
                              type="button"
                              onClick={(e) => handleCopyId(report.id, e)}
                              className="inline-flex items-center gap-1 text-[11px] font-mono font-mono-id text-[#57534E] dark:text-[#A1A1AA] hover:text-[#D9381E] dark:hover:text-[#F05030] bg-[#F4F1EA] dark:bg-[#18181B] hover:bg-[#EAE5D9] dark:hover:bg-[#2B2B30] border border-[#E5E0D4] dark:border-[#333338] px-1.5 py-0.5 rounded-xs transition-colors cursor-pointer"
                              title="Click to copy full incident reference"
                            >
                              <span>#{report.id.slice(0, 8)}</span>
                              {copiedId === report.id ? (
                                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3 text-[#78716C] dark:text-[#A1A1AA]" />
                              )}
                            </button>

                            {/* Severity badge */}
                            {report.severity && (
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-xs font-semibold capitalize ${
                                  report.severity === 'critical'
                                    ? 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800'
                                    : report.severity === 'high'
                                    ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                    : report.severity === 'low'
                                    ? 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700'
                                    : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                }`}
                              >
                                {report.severity}
                              </span>
                            )}
                          </div>

                          <StatusBadge status={report.status} size="sm" />
                        </div>

                        {/* Description */}
                        <p className="text-xs text-[#57534E] dark:text-[#A1A1AA] line-clamp-2 leading-relaxed font-sans">
                          {report.description || 'No description provided.'}
                        </p>
                      </div>

                      {/* ── Visual Lifecycle Progress Indicator ── */}
                      <div className="py-2 px-3 bg-[#F4F1EA] dark:bg-[#18181B] rounded-xs border border-[#E5E0D4] dark:border-[#333338]">
                        <div className="flex items-center justify-between text-[10px] font-mono mb-1.5 text-[#78716C] dark:text-[#A1A1AA]">
                          <span className={stage >= 1 ? 'font-bold text-[#1C1917] dark:text-[#F4F4F5]' : ''}>
                            1. Reported
                          </span>
                          <span className={stage >= 2 && !isRejected ? 'font-bold text-[#0D9488] dark:text-teal-400' : isRejected ? 'text-[#991B1B] dark:text-red-400 font-bold' : ''}>
                            {isRejected ? '✕ Rejected' : '2. Verified'}
                          </span>
                          <span className={stage >= 3 && !isRejected ? 'font-bold text-[#D97706] dark:text-amber-400' : ''}>
                            3. In Progress
                          </span>
                          <span className={stage >= 4 && !isRejected ? 'font-bold text-[#16A34A] dark:text-emerald-400' : ''}>
                            4. Resolved
                          </span>
                        </div>

                        {/* Connected Step Bar */}
                        <div className="h-1.5 bg-[#E5E0D4] dark:bg-[#333338] rounded-full overflow-hidden flex">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isRejected
                                ? 'bg-[#991B1B] w-1/2'
                                : stage === 1
                                ? 'bg-[#4682B4] w-1/4'
                                : stage === 2
                                ? 'bg-[#0D9488] w-2/4'
                                : stage === 3
                                ? 'bg-[#D97706] w-3/4'
                                : 'bg-[#16A34A] w-full'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Metadata Footer */}
                      <div className="flex flex-wrap items-center justify-between gap-y-1 gap-x-4 text-xs font-mono text-[#78716C] dark:text-[#A1A1AA] pt-2 border-t border-[#E5E0D4] dark:border-[#333338]">
                        <div className="flex items-center gap-3 flex-wrap">
                          {/* Reported Date */}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-[#78716C] dark:text-[#A1A1AA]" />
                            Reported on{' '}
                            {new Date(report.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>

                          {/* Ward Jurisdiction */}
                          {report.ward_name ? (
                            <span className="flex items-center gap-1 text-[#1C1917] dark:text-[#F4F4F5] font-sans">
                              <MapPin className="w-3.5 h-3.5 text-[#D9381E] dark:text-[#F05030]" />
                              <span>{report.ward_name}</span>
                            </span>
                          ) : report.ward_id ? (
                            <span className="text-[#1C1917] dark:text-[#F4F4F5]">Ward #{report.ward_id}</span>
                          ) : null}

                          {/* Geocoordinates */}
                          {report.latitude && report.longitude && (
                            <span className="text-[#57534E] dark:text-[#A1A1AA]">
                              {Number(report.latitude).toFixed(4)}, {Number(report.longitude).toFixed(4)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Community Confirmations */}
                          {(report.upvotes !== undefined && report.upvotes > 0) ||
                          (report.confirmations_count !== undefined && report.confirmations_count > 0) ? (
                            <span className="flex items-center gap-1 font-semibold text-[#0D9488] dark:text-teal-400">
                              <ThumbsUp className="w-3.5 h-3.5" />
                              <span>{report.upvotes ?? report.confirmations_count}</span>
                            </span>
                          ) : null}

                          {/* Disputes */}
                          {report.disputes_count !== undefined && report.disputes_count > 0 && (
                            <span className="flex items-center gap-1 font-semibold text-[#991B1B] dark:text-red-400">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>{report.disputes_count}</span>
                            </span>
                          )}

                          {/* Locate on Map Action */}
                          {report.latitude && report.longitude && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/explore?lat=${report.latitude}&lon=${report.longitude}`);
                              }}
                              className="p-1 text-[#78716C] dark:text-[#A1A1AA] hover:text-[#D9381E] dark:hover:text-[#F05030] hover:bg-[#F4F1EA] dark:hover:bg-[#18181B] rounded-xs transition-colors cursor-pointer"
                              title="Locate report on live map"
                              aria-label="Locate on map"
                            >
                              <Compass className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ─── Pagination Controls ────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3.5 bg-[#FBF9F4] dark:bg-[#222226] rounded-sm border border-[#E5E0D4] dark:border-[#333338] shadow-xs text-xs font-mono">
              <span className="text-[#78716C] dark:text-[#A1A1AA]">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm bg-[#F4F1EA] dark:bg-[#18181B] hover:bg-[#EAE5D9] dark:hover:bg-[#2B2B30] text-[#1C1917] dark:text-[#F4F4F5] border border-[#E5E0D4] dark:border-[#333338] transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm bg-[#F4F1EA] dark:bg-[#18181B] hover:bg-[#EAE5D9] dark:hover:bg-[#2B2B30] text-[#1C1917] dark:text-[#F4F4F5] border border-[#E5E0D4] dark:border-[#333338] transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Incident Lifecycle Details Modal ─────────────────────────────── */}
      {selectedReport && (
        <IssueDetailsModal
          issue={selectedReport}
          onClose={() => setSelectedReport(null)}
          onLocateOnMap={(lat, lon) => {
            setSelectedReport(null);
            navigate(`/explore?lat=${lat}&lon=${lon}`);
          }}
        />
      )}
    </div>
  );
}
