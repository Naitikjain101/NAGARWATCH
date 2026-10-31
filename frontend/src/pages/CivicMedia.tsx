import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import { SharedIncidentMap, SharedMapIncident, SharedMapWard } from '../components/map/SharedIncidentMap';
import { StatusBadge } from '../components/ui/StatusBadge';
import { SeverityIndicator } from '../components/ui/SeverityIndicator';
import { Button } from '../components/ui/Button';
import {
  Search,
  Filter,
  X,
  Compass,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Layers,
  MapPin,
  Map as MapIcon,
  List as ListIcon,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

interface StatusHistoryItem {
  old_status?: string | null;
  new_status: string;
  notes?: string | null;
  proof_media_url?: string | null;
  created_at: string;
}

const CATEGORY_OPTIONS = [
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

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'reported', label: 'Reported / Open' },
  { value: 'verified', label: 'Verified' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All Severities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export default function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  // URL-driven and local state
  const [searchQuery, setSearchQuery] = useState<string>(
    () => searchParams.get('q') || searchParams.get('search') || ''
  );
  const [selectedCategory, setSelectedCategory] = useState<string>(
    () => searchParams.get('category') || 'all'
  );
  const [selectedStatus, setSelectedStatus] = useState<string>(
    () => searchParams.get('status') || 'all'
  );
  const [selectedSeverity, setSelectedSeverity] = useState<string>(
    () => searchParams.get('severity') || 'all'
  );
  const [selectedWard, setSelectedWard] = useState<string>(
    () => searchParams.get('ward_id') || 'all'
  );

  // User location state
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(() => {
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    if (lat && lon && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
      return { lat: Number(lat), lon: Number(lon) };
    }
    return null;
  });

  // Synchronize location whenever URL search params change (e.g. navigation from report receipt or header)
  useEffect(() => {
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    if (lat && lon && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
      setUserLocation({ lat: Number(lat), lon: Number(lon) });
    }
  }, [searchParams]);

  // Data states
  const [incidents, setIncidents] = useState<SharedMapIncident[]>([]);
  const [wards, setWards] = useState<SharedMapWard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Inspector & selection states
  const [selectedIncident, setSelectedIncident] = useState<SharedMapIncident | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [feedDrawerOpen, setFeedDrawerOpen] = useState(true);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Mobile layout switch (Map vs List)
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');

  // Load municipal wards on mount
  useEffect(() => {
    const fetchWards = async () => {
      try {
        const res = await apiClient.get('/api/v1/wards');
        const data = res.data?.data;
        if (Array.isArray(data)) {
          setWards(data);
        }
      } catch {
        // Non-blocking fallback
      }
    };
    fetchWards();
  }, []);

  // Sync state to URL params
  const updateUrlParams = useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(updates).forEach(([key, val]) => {
          if (val === null || val === 'all' || val === '') {
            next.delete(key);
          } else {
            next.set(key, val);
          }
        });
        return next;
      });
    },
    [setSearchParams]
  );

  // Request browser geolocation
  const handleDetectLocation = () => {
    setIsLocating(true);
    setError(null);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setUserLocation(loc);
        updateUrlParams({
          lat: loc.lat.toFixed(6),
          lon: loc.lon.toFixed(6),
        });
      },
      () => {
        setIsLocating(false);
        setError('Location permission denied. Please select a ward or adjust filters manually.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Fetch real incidents
  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let endpoint = '/api/v1/incidents';
      const params = new URLSearchParams();

      if (selectedWard !== 'all') {
        params.append('ward_id', selectedWard);
      }

      if (userLocation) {
        params.append('lat', userLocation.lat.toString());
        params.append('lon', userLocation.lon.toString());
        params.append('radius', '25000');
      }

      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedSeverity !== 'all') params.append('severity', selectedSeverity);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const url = `${endpoint}?${params.toString()}`;
      const res = await apiClient.get(url);
      const data = res.data?.data;

      if (Array.isArray(data)) {
        setIncidents(data);
      } else {
        setIncidents([]);
      }
    } catch {
      setError('Unable to refresh incident feed. Please check connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedWard, userLocation, selectedCategory, selectedStatus, selectedSeverity, searchQuery]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Client-side text & dropdown filtering over loaded records
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      // Keyword filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          (inc.category || '').toLowerCase().includes(q) ||
          (inc.description || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Severity filter
      if (selectedSeverity !== 'all') {
        if ((inc.severity || '').toLowerCase() !== selectedSeverity.toLowerCase()) {
          return false;
        }
      }

      // Status filter (reported and pending are both treated as open newly filed reports)
      if (selectedStatus !== 'all') {
        const normStatus = (inc.status || '').toLowerCase();
        if (
          (selectedStatus === 'reported' || selectedStatus === 'pending') &&
          (normStatus === 'pending' || normStatus === 'reported')
        ) {
          // Treated as open / active newly filed reports
        } else if (normStatus !== selectedStatus.toLowerCase()) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'all') {
        if ((inc.category || '').toLowerCase() !== selectedCategory.toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [incidents, searchQuery, selectedSeverity, selectedStatus, selectedCategory]);

  // Handle marker/card selection
  const handleSelectIncident = (incident: SharedMapIncident) => {
    setSelectedIncident(incident);
    setDrawerOpen(true);
    setStatusHistory([]);
    setLoadingHistory(true);

    apiClient
      .get(`/api/v1/incidents/${incident.id}`)
      .then((res) => {
        const detail = res.data?.data;
        if (detail && Array.isArray(detail.status_history)) {
          setStatusHistory(detail.status_history);
        }
      })
      .catch(() => {
        // Safe fallback
      })
      .finally(() => {
        setLoadingHistory(false);
      });
  };

  // Upvote / Confirm incident action
  const handleVerifyIncident = async (type: 'confirm' | 'dispute') => {
    if (!selectedIncident || verifying) return;
    setVerifying(true);

    try {
      await apiClient.post(`/api/v1/incidents/${selectedIncident.id}/verifications`, { type });
      setIncidents((prev) =>
        prev.map((i) => {
          if (i.id === selectedIncident.id) {
            const upvotes = (i.upvotes || i.confirmations_count || 0) + (type === 'confirm' ? 1 : 0);
            const disputes = (i.disputes_count || 0) + (type === 'dispute' ? 1 : 0);
            return { ...i, upvotes, confirmations_count: upvotes, disputes_count: disputes };
          }
          return i;
        })
      );
      if (selectedIncident) {
        setSelectedIncident((prev) =>
          prev
            ? {
                ...prev,
                upvotes: (prev.upvotes || prev.confirmations_count || 0) + (type === 'confirm' ? 1 : 0),
                confirmations_count: (prev.confirmations_count || 0) + (type === 'confirm' ? 1 : 0),
                disputes_count: (prev.disputes_count || 0) + (type === 'dispute' ? 1 : 0),
              }
            : null
        );
      }
    } catch {
      // Ignored
    } finally {
      setVerifying(false);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSelectedSeverity('all');
    setSelectedWard('all');
    updateUrlParams({
      q: null,
      search: null,
      category: null,
      status: null,
      severity: null,
      ward_id: null,
    });
  };

  const handleCopyId = () => {
    if (!selectedIncident || !navigator?.clipboard) return;
    navigator.clipboard.writeText(selectedIncident.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-4rem)] flex flex-col overflow-hidden font-sans bg-[#F4F1EA] dark:bg-[#18181B]">
      {/* ─── Floating Tactical Filter Bar (Top overlay, glass-free paper) ── */}
      <div className="absolute top-3 left-3 right-3 sm:left-4 sm:right-auto z-30 max-w-4xl flex flex-col gap-2 pointer-events-none">
        <div className="bg-[#FBF9F4]/95 dark:bg-[#222226]/95 backdrop-blur-sm border border-[#E5E0D4] dark:border-[#333338] p-2.5 rounded-sm shadow-xs flex flex-wrap items-center gap-2 pointer-events-auto">
          {/* Search Input (No geocoding: client substring filtering) */}
          <div className="relative flex-1 min-w-[200px] sm:min-w-[260px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#57534E] dark:text-[#A1A1AA]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                updateUrlParams({ q: e.target.value || null });
              }}
              placeholder="Search by category or description..."
              className="w-full bg-[#EFECE4]/60 dark:bg-[#18181B]/60 border border-[#E5E0D4] dark:border-[#333338] rounded-xs pl-8 pr-7 py-1.5 text-xs text-[#1C1917] dark:text-[#F4F4F5] placeholder:text-[#57534E] dark:placeholder:text-[#A1A1AA] focus:outline-none focus:border-[#D9381E] dark:focus:border-[#F05030] focus:ring-1 focus:ring-[#D9381E]"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  updateUrlParams({ q: null });
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              updateUrlParams({ category: e.target.value });
            }}
            className="bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] text-xs text-[#1C1917] dark:text-[#F4F4F5] py-1.5 px-2 rounded-xs focus:outline-none focus:border-[#D9381E] dark:focus:border-[#F05030]"
            aria-label="Filter by category"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Status Dropdown */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              updateUrlParams({ status: e.target.value });
            }}
            className="bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] text-xs text-[#1C1917] dark:text-[#F4F4F5] py-1.5 px-2 rounded-xs focus:outline-none focus:border-[#D9381E] dark:focus:border-[#F05030]"
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Severity Dropdown */}
          <select
            value={selectedSeverity}
            onChange={(e) => {
              setSelectedSeverity(e.target.value);
              updateUrlParams({ severity: e.target.value });
            }}
            className="bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] text-xs text-[#1C1917] dark:text-[#F4F4F5] py-1.5 px-2 rounded-xs focus:outline-none focus:border-[#D9381E] dark:focus:border-[#F05030]"
            aria-label="Filter by severity"
          >
            {SEVERITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Ward Select */}
          {wards.length > 0 && (
            <select
              value={selectedWard}
              onChange={(e) => {
                setSelectedWard(e.target.value);
                updateUrlParams({ ward_id: e.target.value });
              }}
              className="hidden lg:inline-block bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] text-xs text-[#1C1917] dark:text-[#F4F4F5] py-1.5 px-2 rounded-xs focus:outline-none focus:border-[#D9381E] dark:focus:border-[#F05030]"
              aria-label="Filter by ward"
            >
              <option value="all">All Wards</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id.toString()}>
                  {w.name}
                </option>
              ))}
            </select>
          )}

          {/* Locate Me Action Button */}
          <button
            onClick={handleDetectLocation}
            disabled={isLocating}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xs border border-[#E5E0D4] dark:border-[#333338] bg-[#EFECE4]/50 dark:bg-[#2B2B30]/60 hover:bg-[#EFECE4] dark:hover:bg-[#2B2B30] text-xs font-medium text-[#1C1917] dark:text-[#F4F4F5] transition-colors cursor-pointer"
            title="Locate via device GPS"
            aria-label="Locate me"
          >
            <Compass className={`w-3.5 h-3.5 text-[#D9381E] dark:text-[#F05030] ${isLocating ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Locate</span>
          </button>

          {/* Clear Filters Button */}
          {(searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all' || selectedSeverity !== 'all' || selectedWard !== 'all') && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 text-xs text-[#D9381E] dark:text-[#F05030] hover:underline px-1 py-1 font-medium cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Clear Filters</span>
            </button>
          )}

          {/* Results Count Pill */}
          <span className="ml-auto text-[11px] font-mono-id text-[#57534E] dark:text-[#A1A1AA] px-2 py-0.5 rounded-xs bg-[#EFECE4] dark:bg-[#2B2B30]">
            {filteredIncidents.length} {filteredIncidents.length === 1 ? 'incident' : 'incidents'}
          </span>

          {/* Refresh Feed Button */}
          <button
            onClick={() => fetchIncidents()}
            disabled={loading}
            className="p-1.5 text-[#57534E] dark:text-[#A1A1AA] hover:text-[#1C1917] dark:hover:text-[#F4F4F5] rounded-xs cursor-pointer transition-colors disabled:opacity-50"
            title="Refresh nearby incidents"
            aria-label="Refresh nearby incidents"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Desktop Feed Drawer Toggle */}
          <button
            onClick={() => setFeedDrawerOpen(!feedDrawerOpen)}
            className="hidden md:inline-flex items-center p-1.5 text-[#57534E] dark:text-[#A1A1AA] hover:text-[#1C1917] dark:hover:text-[#F4F4F5] rounded-xs cursor-pointer"
            title={feedDrawerOpen ? 'Collapse incident feed' : 'Open incident feed'}
          >
            {feedDrawerOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>

          {/* Mobile Mode Switcher (Map vs List) */}
          <div className="flex md:hidden items-center border border-[#E5E0D4] dark:border-[#333338] rounded-xs overflow-hidden ml-1">
            <button
              onClick={() => setMobileView('map')}
              aria-label="Map view"
              className={`p-1.5 cursor-pointer ${mobileView === 'map' ? 'bg-[#D9381E] dark:bg-[#F05030] text-white' : 'bg-[#FBF9F4] dark:bg-[#222226] text-[#57534E] dark:text-[#A1A1AA]'}`}
            >
              <MapIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setMobileView('list')}
              aria-label="List view"
              className={`p-1.5 cursor-pointer ${mobileView === 'list' ? 'bg-[#D9381E] dark:bg-[#F05030] text-white' : 'bg-[#FBF9F4] dark:bg-[#222226] text-[#57534E] dark:text-[#A1A1AA]'}`}
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Error notification banner */}
        {error && (
          <div className="bg-red-50/95 dark:bg-red-950/90 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 text-xs px-3 py-2 rounded-xs flex items-center justify-between shadow-xs pointer-events-auto">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => fetchIncidents()} className="text-red-700 dark:text-red-400 font-semibold hover:underline text-[11px] cursor-pointer">
              Retry
            </button>
          </div>
        )}
      </div>

      {/* ─── Main Content Canvas: Full-Bleed Map ─────────────────────────── */}
      <div className="relative flex-1 w-full h-full min-h-[500px]">
        {/* Full-Bleed Map Canvas */}
        <div className={`w-full h-full absolute inset-0 ${mobileView === 'list' ? 'hidden md:block' : 'block'}`}>
          <SharedIncidentMap
            incidents={filteredIncidents}
            wards={wards}
            selectedIncident={selectedIncident}
            onSelectIncident={handleSelectIncident}
            userLocation={userLocation}
            interactive={true}
            className="w-full h-full"
          />

          {/* Loading Indicator */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4 z-20">
              <div className="bg-[#FBF9F4]/95 dark:bg-[#222226]/95 border border-[#E5E0D4] dark:border-[#333338] px-4 py-3 rounded-sm shadow-md text-center max-w-sm pointer-events-auto flex items-center gap-3">
                <RefreshCw className="w-4 h-4 animate-spin text-[#D9381E] dark:text-[#F05030]" />
                <span className="text-xs font-medium text-[#1C1917] dark:text-[#F4F4F5]">Finding local issues...</span>
              </div>
            </div>
          )}

          {/* Empty Overlay */}
          {!loading && filteredIncidents.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4 z-10">
              <div className="bg-[#FBF9F4]/95 border border-[#E5E0D4] p-5 rounded-sm shadow-md text-center max-w-sm pointer-events-auto">
                <p className="font-serif text-lg text-[#1C1917] mb-1">No Active Incidents Found</p>
                <p className="text-xs text-[#57534E] mb-3">
                  No hazards match the active filter criteria in this sector.
                </p>
                <Button size="sm" variant="outline" onClick={handleClearFilters} className="text-xs">
                  Clear Filters
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Floating Incident Dispatch Queue (Overlaid on desktop, feed on mobile) ─ */}
        <div
          className={`
            ${mobileView === 'list' ? 'block md:hidden w-full h-full pt-20 p-4 overflow-y-auto' : ''}
            ${feedDrawerOpen ? 'hidden md:flex flex-col' : 'hidden'}
            md:absolute md:top-18 md:left-4 md:bottom-4 md:z-20 md:w-[360px]
            bg-[#FBF9F4]/95 dark:bg-[#222226]/95 md:backdrop-blur-sm border border-[#E5E0D4] dark:border-[#333338] rounded-sm shadow-md overflow-hidden font-sans
          `}
        >
          {/* Drawer Header */}
          <div className="p-3 border-b border-[#E5E0D4] dark:border-[#333338] bg-[#EFECE4]/60 dark:bg-[#18181B]/60 flex items-center justify-between">
            <span className="font-serif text-sm text-[#1C1917] dark:text-[#F4F4F5] font-semibold">
              Dispatches in Sector ({filteredIncidents.length})
            </span>
            <button
              onClick={() => setFeedDrawerOpen(false)}
              className="hidden md:inline-block text-[#57534E] dark:text-[#A1A1AA] hover:text-[#1C1917] dark:hover:text-[#F4F4F5] cursor-pointer"
              title="Collapse"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Cards List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2 dark-scrollbar">
            {filteredIncidents.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#57534E] dark:text-[#A1A1AA]">
                No incidents match current filter.
              </div>
            ) : (
              filteredIncidents.map((inc) => {
                const isSelected = selectedIncident?.id === inc.id;
                return (
                  <div
                    key={inc.id}
                    onClick={() => handleSelectIncident(inc)}
                    className={`
                      p-3 rounded-xs border transition-all cursor-pointer text-left
                      ${
                        isSelected
                          ? 'bg-[#EFECE4] dark:bg-[#2B2B30] border-[#D9381E] dark:border-[#F05030] shadow-xs'
                          : 'bg-[#FBF9F4] dark:bg-[#222226] border-[#E5E0D4] dark:border-[#333338] hover:bg-[#EFECE4]/50 dark:hover:bg-[#2B2B30]/50'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1.5">
                      <span className="text-[11px] font-mono-id uppercase tracking-wider text-[#D9381E] dark:text-[#F05030] font-bold">
                        {inc.category}
                      </span>
                      <div className="flex items-center gap-1">
                        {inc.severity && (
                          <span className="text-[10px] font-mono-id uppercase text-[#57534E] dark:text-[#A1A1AA] px-1 rounded-xs bg-[#EFECE4] dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338]">
                            {inc.severity}
                          </span>
                        )}
                        <StatusBadge status={inc.status} size="sm" />
                      </div>
                    </div>

                    <p className="text-xs text-[#1C1917] dark:text-[#F4F4F5] line-clamp-2 leading-relaxed mb-2">
                      {inc.description}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-[#57534E] dark:text-[#A1A1AA] font-mono-id pt-1.5 border-t border-[#E5E0D4]/70 dark:border-[#333338]/70">
                      <span>{inc.ward_name || `Ward #${inc.ward_id || 1}`}</span>
                      {inc.distance_meters !== undefined && (
                        <span className="text-emerald-800 dark:text-emerald-400 font-semibold">
                          {inc.distance_meters >= 1000
                            ? `${(inc.distance_meters / 1000).toFixed(1)}km away`
                            : `${Math.round(inc.distance_meters)}m away`}
                        </span>
                      )}
                      <div className="flex items-center gap-1 text-[#1C1917] dark:text-[#F4F4F5] font-semibold">
                        <ThumbsUp className="w-3 h-3 text-[#57534E] dark:text-[#A1A1AA]" />
                        <span>{inc.upvotes ?? inc.confirmations_count ?? 0}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ─── Retractable Incident Side Inspector (Slide-over drawer) ───────── */}
      {drawerOpen && selectedIncident && (
        <div className="absolute top-0 right-0 bottom-0 z-40 w-full sm:w-[380px] bg-[#FBF9F4] dark:bg-[#18181B] border-l border-[#E5E0D4] dark:border-[#333338] shadow-2xl flex flex-col font-sans animate-in slide-in-from-right duration-150">
          {/* Header */}
          <div className="p-3.5 border-b border-[#E5E0D4] dark:border-[#333338] flex items-center justify-between bg-[#EFECE4]/60 dark:bg-[#222226]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono-id font-bold text-[#D9381E] dark:text-[#F05030]">
                {selectedIncident.id.slice(0, 14)}
              </span>
              <button
                onClick={handleCopyId}
                className="text-[#57534E] dark:text-[#A1A1AA] hover:text-[#1C1917] dark:hover:text-[#F4F4F5] p-1 rounded-xs cursor-pointer"
                title="Copy Incident ID"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              onClick={() => {
                setDrawerOpen(false);
                setSelectedIncident(null);
              }}
              className="text-[#57534E] dark:text-[#A1A1AA] hover:text-[#1C1917] dark:hover:text-[#F4F4F5] p-1 rounded-xs focus-ring cursor-pointer"
              aria-label="Close details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 pb-24 sm:pb-4 space-y-4 dark-scrollbar">
            {/* Status & Severity */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#1C1917] dark:text-[#F4F4F5] uppercase tracking-wide">
                {selectedIncident.category}
              </span>
              <div className="flex items-center gap-1.5">
                {selectedIncident.severity && (
                  <span className="text-[10px] font-mono-id uppercase text-[#57534E] dark:text-[#A1A1AA] px-1.5 py-0.5 rounded-xs bg-[#EFECE4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338]">
                    {selectedIncident.severity}
                  </span>
                )}
                <StatusBadge status={selectedIncident.status} size="sm" />
              </div>
            </div>

            {/* Evidence Photograph */}
            {selectedIncident.image_url ? (
              <div className="relative rounded-xs overflow-hidden border border-[#E5E0D4] dark:border-[#333338] bg-[#EFECE4] dark:bg-[#222226] aspect-video">
                <img
                  src={selectedIncident.image_url}
                  alt={`Evidence photo of ${selectedIncident.category}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="rounded-xs border border-dashed border-[#E5E0D4] dark:border-[#333338] p-4 text-center text-xs text-[#57534E] dark:text-[#A1A1AA] bg-[#EFECE4]/30 dark:bg-[#222226]/30">
                No photograph submitted
              </div>
            )}

            {/* Incident Description */}
            <div>
              <p className="text-[11px] font-mono-id uppercase tracking-wider text-[#57534E] dark:text-[#A1A1AA] mb-1">
                Description of Hazard
              </p>
              <p className="text-xs text-[#1C1917] dark:text-[#F4F4F5] leading-relaxed whitespace-pre-wrap">
                {selectedIncident.description}
              </p>
            </div>

            {/* Spatial & Municipal Metadata (Strictly NO PII) */}
            <div className="p-3 bg-[#EFECE4]/50 dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] rounded-xs space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#57534E] dark:text-[#A1A1AA]">Ward Jurisdiction:</span>
                <span className="font-medium text-[#1C1917] dark:text-[#F4F4F5]">
                  {selectedIncident.ward_name || `Ward #${selectedIncident.ward_id || 1}`}
                </span>
              </div>
              {selectedIncident.latitude !== undefined && selectedIncident.longitude !== undefined && (
                <div className="flex items-center justify-between text-[11px] font-mono-id">
                  <span className="text-[#57534E] dark:text-[#A1A1AA]">Coordinates:</span>
                  <span className="text-[#1C1917] dark:text-[#F4F4F5]">
                    {selectedIncident.latitude.toFixed(5)}°, {selectedIncident.longitude.toFixed(5)}°
                  </span>
                </div>
              )}
              {selectedIncident.distance_meters !== undefined && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#57534E] dark:text-[#A1A1AA]">Proximity:</span>
                  <span className="font-mono-id text-emerald-800 dark:text-emerald-400 font-semibold">
                    {selectedIncident.distance_meters >= 1000
                      ? `${(selectedIncident.distance_meters / 1000).toFixed(1)}km away`
                      : `${Math.round(selectedIncident.distance_meters)}m away`}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-[11px] text-[#57534E] dark:text-[#A1A1AA]">
                <span>Reported:</span>
                <span className="font-mono-id">
                  {new Date(selectedIncident.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* Community Verification */}
            <div className="pt-2 border-t border-[#E5E0D4] dark:border-[#333338] space-y-2">
              <p className="text-[11px] font-mono-id uppercase tracking-wider text-[#57534E] dark:text-[#A1A1AA]">
                Community Verification
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleVerifyIncident('confirm')}
                  isLoading={verifying}
                  leftIcon={<ThumbsUp className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />}
                  className="text-xs border-[#E5E0D4] dark:border-[#333338] bg-[#FBF9F4] dark:bg-[#222226] text-[#1C1917] dark:text-[#F4F4F5] hover:bg-[#EFECE4] dark:hover:bg-[#2B2B30]"
                >
                  Confirm ({selectedIncident.upvotes ?? selectedIncident.confirmations_count ?? 0})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleVerifyIncident('dispute')}
                  isLoading={verifying}
                  leftIcon={<ThumbsDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />}
                  className="text-xs border-[#E5E0D4] dark:border-[#333338] bg-[#FBF9F4] dark:bg-[#222226] text-[#1C1917] dark:text-[#F4F4F5] hover:bg-[#EFECE4] dark:hover:bg-[#2B2B30]"
                >
                  Dispute ({selectedIncident.disputes_count ?? 0})
                </Button>
              </div>
            </div>

            {/* Real Lifecycle Timeline */}
            <div className="pt-2 border-t border-[#E5E0D4] dark:border-[#333338] space-y-2">
              <p className="text-[11px] font-mono-id uppercase tracking-wider text-[#57534E] dark:text-[#A1A1AA]">
                Official Lifecycle History
              </p>
              {loadingHistory ? (
                <div className="text-xs text-[#57534E] dark:text-[#A1A1AA] py-2 flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Loading audit trail...</span>
                </div>
              ) : statusHistory.length === 0 ? (
                <div className="text-xs text-[#57534E] dark:text-[#A1A1AA] py-1">
                  Report logged in municipal intake. Awaiting field triage.
                </div>
              ) : (
                <div className="space-y-2 relative border-l border-[#E5E0D4] dark:border-[#333338] ml-2 pl-3">
                  {statusHistory.map((h, idx) => (
                    <div key={idx} className="relative text-xs space-y-0.5">
                      <span className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-[#D9381E] dark:bg-[#F05030]" />
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#1C1917] dark:text-[#F4F4F5] capitalize">{h.new_status}</span>
                        <span className="text-[10px] font-mono-id text-[#57534E] dark:text-[#A1A1AA]">
                          {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {h.notes && <p className="text-[11px] text-[#57534E] dark:text-[#A1A1AA] italic">{h.notes}</p>}
                      {h.proof_media_url && (
                        <a
                          href={h.proof_media_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[#D9381E] dark:text-[#F05030] hover:underline pt-0.5"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>View Resolution Proof</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
