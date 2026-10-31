import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  MapPin,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Edit,
  RefreshCw,
  Eye,
  Shield,
  ShieldAlert,
  Camera,
  Upload,
  Command,
  Maximize2,
  SlidersHorizontal,
} from 'lucide-react';
import apiClient from '../../lib/apiClient';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SharedIncidentMap, SharedMapIncident } from '../../components/map/SharedIncidentMap';
import IssueDetailsModal from '../../components/IssueDetailsModal';

export interface AdminIncident {
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
  resolution_notes?: string;
  resolved_at?: string;
  proof_media_url?: string;
  has_exif_gps?: boolean;
}

const CATEGORIES = [
  'All',
  'Pothole',
  'Streetlight',
  'Garbage',
  'Graffiti',
  'Water Leak',
  'Signage',
  'Safety Hazard',
  'Encroachment',
  'Other',
];

const STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'reported', label: 'Reported' },
  { value: 'verified', label: 'Verified' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'closed', label: 'Closed' },
];

const SEVERITIES = [
  { value: 'all', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export const AdminIncidentsPage: React.FC = () => {
  const [incidents, setIncidents] = useState<AdminIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'severity' | 'upvotes'>('newest');

  // Synchronized Selection
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'queue' | 'map'>('queue');

  // Modals & Actions
  const [inspectIncident, setInspectIncident] = useState<AdminIncident | null>(null);
  const [statusModalIncident, setStatusModalIncident] = useState<AdminIncident | null>(null);
  const [newStatusValue, setNewStatusValue] = useState<string>('in_progress');
  const [statusNotes, setStatusNotes] = useState<string>('');
  const [proofMediaUrl, setProofMediaUrl] = useState<string>('');
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [statusActionError, setStatusActionError] = useState<string | null>(null);
  const [requireConfirmation, setRequireConfirmation] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchIncidents = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/api/v1/admin/incidents');
      const data = response.data?.data;
      const list = Array.isArray(data) ? data : [];
      setIncidents(list);
      if (list.length > 0 && !selectedIncidentId) {
        setSelectedIncidentId(list[0].id);
      }
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401) {
        setError('Your session has expired. Please log in again.');
      } else if (status === 403) {
        setError('Access denied. Administrator privileges are required.');
      } else if (err.code === 'ERR_NETWORK') {
        setError('Network error. Unable to connect to NagarWatch backend.');
      } else {
        setError('Failed to fetch incidents. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  // Filter & sort logic
  const filteredIncidents = useMemo(() => {
    return incidents
      .filter((item) => {
        if (selectedCategory !== 'All' && item.category !== selectedCategory) {
          return false;
        }
        if (selectedStatus !== 'all' && item.status !== selectedStatus) {
          return false;
        }
        if (selectedSeverity !== 'all' && item.severity !== selectedSeverity) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchId = (item.id || '').toLowerCase().includes(q);
          const matchCat = (item.category || '').toLowerCase().includes(q);
          const matchDesc = (item.description || '').toLowerCase().includes(q);
          if (!matchId && !matchCat && !matchDesc) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (sortBy === 'severity') {
          const rank = { critical: 4, high: 3, medium: 2, low: 1 };
          const ra = rank[(a.severity as keyof typeof rank) || 'medium'] || 0;
          const rb = rank[(b.severity as keyof typeof rank) || 'medium'] || 0;
          return rb - ra;
        }
        if (sortBy === 'upvotes') {
          return (b.upvotes || 0) - (a.upvotes || 0);
        }
        return 0;
      });
  }, [incidents, searchQuery, selectedCategory, selectedStatus, selectedSeverity, sortBy]);

  // Currently focused incident in dual pane
  const focusedIncident = useMemo(() => {
    if (!selectedIncidentId) return filteredIncidents[0] || null;
    return incidents.find((i) => i.id === selectedIncidentId) || filteredIncidents[0] || null;
  }, [incidents, filteredIncidents, selectedIncidentId]);

  // Shared map incidents
  const mapIncidents: SharedMapIncident[] = useMemo(() => {
    return filteredIncidents
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
        severity: i.severity,
        upvotes: i.upvotes,
        ward_id: i.ward_id,
      }));
  }, [filteredIncidents]);

  // Open status modal
  const handleOpenStatusModal = (incident: AdminIncident) => {
    setStatusModalIncident(incident);
    setNewStatusValue(incident.status);
    setStatusNotes(incident.resolution_notes || '');
    setProofMediaUrl(incident.proof_media_url || '');
    setStatusActionError(null);
    setRequireConfirmation(false);
  };

  // Upload resolution proof photo
  const handleProofPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !statusModalIncident) return;

    setIsUploadingProof(true);
    setStatusActionError(null);

    const formData = new FormData();
    formData.append('proof_image', file);

    try {
      const res = await apiClient.post(
        `/api/v1/admin/incidents/${statusModalIncident.id}/proof`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );
      if (res.data?.proof_url) {
        setProofMediaUrl(res.data.proof_url);
      }
    } catch {
      setStatusActionError('Failed to upload proof photograph. You may proceed without photo.');
    } finally {
      setIsUploadingProof(false);
    }
  };

  // Submit status update
  const handleApplyStatusChange = async () => {
    if (!statusModalIncident) return;

    // High impact confirmation check
    if (
      (newStatusValue === 'resolved' || newStatusValue === 'rejected') &&
      !requireConfirmation
    ) {
      setRequireConfirmation(true);
      return;
    }

    setIsSubmittingStatus(true);
    setStatusActionError(null);

    try {
      await apiClient.patch(
        `/api/v1/admin/incidents/${statusModalIncident.id}/status`,
        {
          status: newStatusValue,
          resolution_notes: statusNotes.trim(),
          proof_media_url: proofMediaUrl.trim() || undefined,
        }
      );

      // Optimistic update
      setIncidents((prev) =>
        prev.map((item) =>
          item.id === statusModalIncident.id
            ? {
                ...item,
                status: newStatusValue,
                proof_media_url: proofMediaUrl.trim() || item.proof_media_url,
                resolution_notes: statusNotes.trim() || item.resolution_notes,
              }
            : item
        )
      );

      setStatusModalIncident(null);
      setRequireConfirmation(false);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 403) {
        setStatusActionError(
          'Out of Jurisdiction: You are not authorized to modify incidents outside your assigned ward.'
        );
      } else if (status === 400) {
        setStatusActionError(
          err.response?.data?.message || 'Invalid status transition requested.'
        );
      } else {
        setStatusActionError('Failed to update incident status. Please try again.');
      }
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-6 h-6 text-[#F05030] animate-spin" />
        <p className="text-xs font-mono uppercase tracking-wider text-[#A1A1AA]">
          Loading incident queue...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-[#222226] border border-[#333338] rounded-sm max-w-xl mx-auto my-12 text-center">
        <AlertTriangle className="w-8 h-8 text-[#F05030] mx-auto mb-3" />
        <h3 className="text-base font-mono font-bold text-[#F4F4F5] mb-1">Queue Connection Error</h3>
        <p className="text-xs text-[#A1A1AA] mb-4">{error}</p>
        <button
          onClick={fetchIncidents}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium bg-[#2B2B30] text-[#F4F4F5] hover:bg-[#333338] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reload Registry</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── Header & Tactical Bar ─────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-[#222226] border border-[#333338] rounded-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-widest bg-[#F05030]/20 text-[#F05030] border border-[#F05030]/30 px-1.5 py-0.5 rounded-xs">
              Live Queue
            </span>
            <span className="text-[11px] text-[#A1A1AA] font-mono">•</span>
            <span className="text-[11px] text-[#A1A1AA] font-mono">
              {filteredIncidents.length} of {incidents.length} records active
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-mono font-bold text-[#F4F4F5] tracking-tight">
            Incident Management
          </h1>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Filter, review, verify, and advance civic incident lifecycles across assigned wards.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Tab Toggle */}
          <div className="lg:hidden flex items-center bg-[#18181B] p-0.5 border border-[#333338] rounded-sm">
            <button
              onClick={() => setMobileTab('queue')}
              className={`px-3 py-1 rounded-xs text-xs font-mono ${
                mobileTab === 'queue'
                  ? 'bg-[#2B2B30] text-[#F4F4F5]'
                  : 'text-[#A1A1AA]'
              }`}
            >
              Queue ({filteredIncidents.length})
            </button>
            <button
              onClick={() => setMobileTab('map')}
              className={`px-3 py-1 rounded-xs text-xs font-mono ${
                mobileTab === 'map'
                  ? 'bg-[#2B2B30] text-[#F4F4F5]'
                  : 'text-[#A1A1AA]'
              }`}
            >
              GIS Map
            </button>
          </div>

          <button
            type="button"
            onClick={fetchIncidents}
            title="Refresh incidents"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium bg-[#2B2B30] hover:bg-[#333338] text-[#F4F4F5] border border-[#333338] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ─── Tactical Filtering HUD ────────────────────────────────────────── */}
      <div className="p-3 bg-[#222226] border border-[#333338] rounded-sm space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search Field */}
          <div className="lg:col-span-2 relative">
            <Search className="w-3.5 h-3.5 text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search category, description, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#18181B] text-[#F4F4F5] placeholder-[#71717A] text-xs pl-8 pr-3 py-2 rounded-xs border border-[#333338] focus:border-[#F05030] focus:outline-none transition-colors"
            />
          </div>

          {/* 1st Combobox: Category Select */}
          <div>
            <select
              aria-label="Category filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-[#18181B] text-[#F4F4F5] text-xs px-2.5 py-2 rounded-xs border border-[#333338] focus:border-[#F05030] focus:outline-none"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>

          {/* 2nd Combobox: Status Select (Required by tests: statusSelects[1]) */}
          <div>
            <select
              aria-label="Status filter"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-[#18181B] text-[#F4F4F5] text-xs px-2.5 py-2 rounded-xs border border-[#333338] focus:border-[#F05030] focus:outline-none"
            >
              {STATUSES.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          {/* 3rd Combobox: Severity Select */}
          <div>
            <select
              aria-label="Severity filter"
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-full bg-[#18181B] text-[#F4F4F5] text-xs px-2.5 py-2 rounded-xs border border-[#333338] focus:border-[#F05030] focus:outline-none"
            >
              {SEVERITIES.map((sev) => (
                <option key={sev.value} value={sev.value}>
                  {sev.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sort & Count Sub-strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#333338] text-[11px] font-mono text-[#A1A1AA]">
          <div>
            Showing <strong className="text-[#F4F4F5]">{filteredIncidents.length}</strong> of{' '}
            <strong className="text-[#F4F4F5]">{incidents.length}</strong> loaded incidents
          </div>

          <div className="flex items-center gap-2">
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-[#18181B] text-[#F4F4F5] border border-[#333338] rounded-xs px-2 py-0.5 text-[11px] font-mono outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="severity">Severity (High to Low)</option>
              <option value="upvotes">Most Confirmations</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── Dual Panes: Queue (Left) + GIS Map (Right) ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Pane: Incident Queue (7 cols on desktop) */}
        <div
          className={`lg:col-span-7 space-y-2.5 ${
            mobileTab === 'map' ? 'hidden lg:block' : 'block'
          }`}
        >
          {filteredIncidents.length === 0 ? (
            <div className="p-12 bg-[#222226] border border-[#333338] rounded-sm text-center">
              <Search className="w-8 h-8 text-[#A1A1AA] mx-auto mb-2" />
              <p className="text-sm font-mono font-bold text-[#F4F4F5]">No Matching Incidents Found</p>
              <p className="text-xs text-[#A1A1AA] mt-1 mb-4">
                Try adjusting your filter criteria or search keyword to view records.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                  setSelectedStatus('all');
                  setSelectedSeverity('all');
                }}
                className="px-3 py-1.5 bg-[#2B2B30] text-[#F4F4F5] text-xs font-mono rounded-xs border border-[#333338]"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {filteredIncidents.map((incident) => {
                const isFocused = focusedIncident?.id === incident.id;
                return (
                  <div
                    key={incident.id}
                    onClick={() => setSelectedIncidentId(incident.id)}
                    className={`p-3.5 bg-[#222226] rounded-sm border transition-all cursor-pointer ${
                      isFocused
                        ? 'border-[#F05030] shadow-sm bg-[#2B2B30]'
                        : 'border-[#333338] hover:border-[#4B4B52]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Thumbnail or placeholder */}
                      {incident.image_url ? (
                        <img
                          src={incident.image_url}
                          alt={incident.category}
                          className="w-14 h-14 rounded-xs object-cover bg-[#18181B] shrink-0 border border-[#333338]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xs bg-[#18181B] flex items-center justify-center shrink-0 text-[#A1A1AA] font-mono font-bold border border-[#333338] text-xs">
                          {incident.category.slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      {/* Content details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="text-[11px] font-mono-id text-[#A1A1AA] font-bold">
                            #{incident.id}
                          </span>
                          <span className="text-xs font-semibold text-[#F4F4F5]">
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
                                  : 'bg-[#18181B] text-[#A1A1AA] border-[#333338]'
                              }`}
                            >
                              {incident.severity}
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-[#A1A1AA] bg-[#18181B] px-1 py-0.2 rounded-xs border border-[#333338]">
                            Ward {incident.ward_id || 'N/A'}
                          </span>
                        </div>

                        <p className="text-xs text-[#F4F4F5] line-clamp-2 leading-relaxed mb-1.5">
                          {incident.description}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#333338]/60 text-[10px] font-mono text-[#A1A1AA]">
                          <div className="flex items-center gap-2">
                            <span>{new Date(incident.created_at).toLocaleDateString()}</span>
                            <span>•</span>
                            <span className="text-amber-400/90">
                              Target (frontend heuristic): 24h
                            </span>
                            {incident.upvotes ? (
                              <>
                                <span>•</span>
                                <span>★ {incident.upvotes}</span>
                              </>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectIncident(incident);
                              }}
                              className="text-xs text-[#A1A1AA] hover:text-[#F4F4F5] font-sans hover:underline flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Inspect</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenStatusModal(incident);
                              }}
                              className="px-2.5 py-1 bg-[#F05030] hover:bg-[#D9381E] text-white text-xs font-medium rounded-xs shadow-xs transition-colors flex items-center gap-1"
                            >
                              <Edit className="w-3 h-3" />
                              <span>Update Status</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Pane: Synchronized GIS Map & Inspector (5 cols on desktop) */}
        <div
          className={`lg:col-span-5 space-y-3 ${
            mobileTab === 'queue' ? 'hidden lg:block' : 'block'
          }`}
        >
          {/* Synchronized GIS Map */}
          <div className="h-[380px] bg-[#222226] border border-[#333338] rounded-sm overflow-hidden relative">
            <SharedIncidentMap
              incidents={mapIncidents}
              theme="graphite"
              interactive={true}
              selectedIncident={
                focusedIncident
                  ? {
                      id: focusedIncident.id,
                      category: focusedIncident.category,
                      description: focusedIncident.description,
                      status: focusedIncident.status,
                      image_url: focusedIncident.image_url,
                      created_at: focusedIncident.created_at,
                      latitude: focusedIncident.latitude,
                      longitude: focusedIncident.longitude,
                    }
                  : null
              }
              onSelectIncident={(inc) => {
                setSelectedIncidentId(inc.id);
              }}
              className="w-full h-full"
            />
            <div className="absolute top-2 right-2 bg-[#18181B]/90 backdrop-blur-xs border border-[#333338] px-2.5 py-1 rounded-xs text-[10px] font-mono text-[#A1A1AA] z-10">
              {mapIncidents.length} geolocated on GIS
            </div>
          </div>

          {/* Focused Incident Inspector Sheet */}
          {focusedIncident && (
            <div className="p-4 bg-[#222226] border border-[#333338] rounded-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[#333338] pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono-id text-[#F05030] font-bold">
                    #{focusedIncident.id}
                  </span>
                  <span className="text-xs font-semibold text-[#F4F4F5]">
                    {focusedIncident.category}
                  </span>
                </div>
                <StatusBadge status={focusedIncident.status} size="sm" />
              </div>

              <div className="text-xs text-[#F4F4F5] leading-relaxed">
                <span className="text-[#71717A] text-[10px] font-mono uppercase block mb-0.5">
                  Reported Issue Detail
                </span>
                «{focusedIncident.description}»
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[#A1A1AA] bg-[#18181B] p-2.5 rounded-xs border border-[#333338]">
                <div>
                  <span className="text-[#71717A] block text-[10px] uppercase">Ward</span>
                  <span className="text-[#F4F4F5]">#{focusedIncident.ward_id}</span>
                </div>
                <div>
                  <span className="text-[#71717A] block text-[10px] uppercase">Severity</span>
                  <span className="text-[#F4F4F5] uppercase">
                    {focusedIncident.severity || 'medium'}
                  </span>
                </div>
                <div>
                  <span className="text-[#71717A] block text-[10px] uppercase">GPS Coordinates</span>
                  <span className="text-[#F4F4F5]">
                    {focusedIncident.latitude && focusedIncident.longitude
                      ? `${focusedIncident.latitude.toFixed(4)}°, ${focusedIncident.longitude.toFixed(4)}°`
                      : 'Not Geolocated'}
                  </span>
                </div>
                <div>
                  <span className="text-[#71717A] block text-[10px] uppercase">Reported At</span>
                  <span className="text-[#F4F4F5]">
                    {new Date(focusedIncident.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {focusedIncident.image_url && (
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#A1A1AA] block mb-1">
                    Submitted Photographic Proof
                  </span>
                  <img
                    src={focusedIncident.image_url}
                    alt="Evidence"
                    className="w-full h-36 rounded-xs object-cover border border-[#333338]"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setInspectIncident(focusedIncident)}
                  className="px-3 py-1.5 bg-[#2B2B30] hover:bg-[#333338] text-[#F4F4F5] text-xs font-mono rounded-xs border border-[#333338] transition-colors"
                >
                  Full Audit History
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenStatusModal(focusedIncident)}
                  className="px-3 py-1.5 bg-[#F05030] hover:bg-[#D9381E] text-white text-xs font-medium rounded-xs shadow-xs transition-colors flex items-center gap-1"
                >
                  <Edit className="w-3 h-3" />
                  <span>Update Status</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Status Transition Modal ────────────────────────────────────────── */}
      {statusModalIncident && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#222226] border border-[#333338] rounded-sm max-w-lg w-full p-5 space-y-4 shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#333338] pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#F05030]">
                  Official Lifecycle Transition
                </span>
                <h3 className="text-base font-mono font-bold text-[#F4F4F5]">
                  Update Incident #{statusModalIncident.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalIncident(null)}
                className="text-[#A1A1AA] hover:text-[#F4F4F5] p-1 rounded-xs"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Error Display */}
            {statusActionError && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xs text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{statusActionError}</span>
              </div>
            )}

            {/* High Impact Confirmation Dialog */}
            {requireConfirmation ? (
              <div className="p-4 bg-amber-950/30 border border-amber-800/50 rounded-xs space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                  <AlertCircle className="w-4 h-4" />
                  <span>Please Confirm Status Transition</span>
                </div>
                <p className="text-xs text-[#F4F4F5] leading-relaxed">
                  You are setting status to <strong className="uppercase text-amber-400">{newStatusValue}</strong>.
                  This modifies municipal governance records and updates citizen notifications.
                </p>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRequireConfirmation(false)}
                    className="px-3 py-1.5 bg-[#2B2B30] text-[#A1A1AA] hover:text-[#F4F4F5] text-xs font-mono rounded-xs border border-[#333338]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingStatus}
                    onClick={handleApplyStatusChange}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-xs shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    {isSubmittingStatus ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Confirm & Apply</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                {/* Status Selector */}
                <div>
                  <label
                    htmlFor="status-select-input"
                    className="block text-xs font-mono uppercase text-[#A1A1AA] mb-1.5"
                  >
                    Select New Status
                  </label>
                  <select
                    id="status-select-input"
                    value={newStatusValue}
                    onChange={(e) => setNewStatusValue(e.target.value)}
                    className="w-full bg-[#18181B] text-[#F4F4F5] text-xs p-2 rounded-xs border border-[#333338] focus:border-[#F05030] focus:outline-none"
                  >
                    <option value="reported">Reported (Pending Review)</option>
                    <option value="verified">Community Verified</option>
                    <option value="assigned">Assigned to Field Team</option>
                    <option value="in_progress">In Progress (Active Maintenance)</option>
                    <option value="resolved">Resolved (Work Completed)</option>
                    <option value="rejected">Rejected (Out of Municipal Scope)</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                {/* Audit / Resolution Notes */}
                <div>
                  <label className="block text-xs font-mono uppercase text-[#A1A1AA] mb-1.5">
                    Official Triage / Resolution Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Document maintenance work, crew assignments, or reason for status update..."
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    className="w-full bg-[#18181B] text-[#F4F4F5] placeholder-[#71717A] text-xs p-2.5 rounded-xs border border-[#333338] focus:border-[#F05030] focus:outline-none resize-none"
                  />
                </div>

                {/* Proof Photo Upload */}
                <div>
                  <label className="block text-xs font-mono uppercase text-[#A1A1AA] mb-1.5">
                    Resolution Proof Photo (Optional)
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleProofPhotoSelect}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isUploadingProof}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2B2B30] hover:bg-[#333338] text-[#F4F4F5] text-xs font-mono rounded-xs border border-[#333338] transition-colors"
                    >
                      {isUploadingProof ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#F05030]" />
                      ) : (
                        <Camera className="w-3.5 h-3.5 text-[#F05030]" />
                      )}
                      <span>{proofMediaUrl ? 'Replace Photo' : 'Upload Proof Photo'}</span>
                    </button>
                    {proofMediaUrl && (
                      <span className="text-[11px] font-mono text-emerald-400">
                        ✓ Photo attached
                      </span>
                    )}
                  </div>
                  {proofMediaUrl && (
                    <div className="mt-2 relative inline-block">
                      <img
                        src={proofMediaUrl}
                        alt="Proof Preview"
                        className="w-24 h-24 rounded-xs object-cover border border-[#333338]"
                      />
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#333338]">
                  <button
                    type="button"
                    onClick={() => setStatusModalIncident(null)}
                    className="px-3 py-1.5 bg-[#2B2B30] text-[#A1A1AA] hover:text-[#F4F4F5] text-xs font-mono rounded-xs border border-[#333338]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingStatus}
                    onClick={handleApplyStatusChange}
                    className="px-4 py-1.5 bg-[#F05030] hover:bg-[#D9381E] text-white text-xs font-medium rounded-xs shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    {isSubmittingStatus ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Apply Status Change</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Incident Audit Trail Modal ────────────────────────────────────── */}
      {inspectIncident && (
        <IssueDetailsModal
          issue={{
            id: inspectIncident.id,
            category: inspectIncident.category,
            description: inspectIncident.description,
            status: inspectIncident.status,
            image_url: inspectIncident.image_url,
            created_at: inspectIncident.created_at,
            latitude: inspectIncident.latitude,
            longitude: inspectIncident.longitude,
            upvotes: inspectIncident.upvotes,
          }}
          onClose={() => setInspectIncident(null)}
        />
      )}
    </div>
  );
};
