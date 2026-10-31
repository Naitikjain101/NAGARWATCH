import React, { useEffect, useState, useMemo } from 'react';
import {
  Layers,
  MapPin,
  ExternalLink,
  Eye,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Landmark,
  Shield,
  Edit,
  X,
  Compass,
} from 'lucide-react';
import apiClient from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SharedIncidentMap, SharedMapIncident, SharedMapWard } from '../../components/map/SharedIncidentMap';
import IssueDetailsModal from '../../components/IssueDetailsModal';

export const AdminMapPage: React.FC = () => {
  const { userRole } = useAuth();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [wards, setWards] = useState<SharedMapWard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedWardId, setSelectedWardId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Selection & Inspector
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [detailModalIncident, setDetailModalIncident] = useState<any | null>(null);

  const fetchMapData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [incRes, wardsRes] = await Promise.all([
        apiClient.get('/api/v1/admin/incidents'),
        apiClient.get('/api/v1/wards'),
      ]);

      setIncidents(Array.isArray(incRes.data?.data) ? incRes.data.data : []);
      setWards(Array.isArray(wardsRes.data?.data) ? wardsRes.data.data : []);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401) {
        setError('Your session has expired. Please log in again.');
      } else if (status === 403) {
        setError('Access denied. Administrator privileges required.');
      } else {
        setError('Failed to load spatial map telemetry. Please check connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMapData();
  }, []);

  // Filtered incidents
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (selectedWardId !== 'all' && String(inc.ward_id) !== selectedWardId) {
        return false;
      }
      if (selectedStatus !== 'all' && inc.status !== selectedStatus) {
        return false;
      }
      if (selectedCategory !== 'all' && inc.category !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [incidents, selectedWardId, selectedStatus, selectedCategory]);

  // SharedMapIncident format
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

  const categories = useMemo(() => {
    const set = new Set<string>();
    incidents.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [incidents]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-6 h-6 text-[#F05030] animate-spin" />
        <p className="text-xs font-mono uppercase tracking-wider text-[#A1A1AA]">
          Initializing ward GIS environment...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-[#222226] border border-[#333338] rounded-sm max-w-xl mx-auto my-12 text-center">
        <AlertTriangle className="w-8 h-8 text-[#F05030] mx-auto mb-3" />
        <h3 className="text-base font-mono font-bold text-[#F4F4F5] mb-1">Spatial Engine Offline</h3>
        <p className="text-xs text-[#A1A1AA] mb-4">{error}</p>
        <button
          onClick={fetchMapData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium bg-[#2B2B30] text-[#F4F4F5] hover:bg-[#333338] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reload GIS Data</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── Top Tactical Filter Bar ────────────────────────────────────────── */}
      <div className="p-3 bg-[#222226] border border-[#333338] rounded-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Ward Selector */}
          <div className="flex items-center gap-1.5 bg-[#18181B] px-2.5 py-1.5 rounded-xs border border-[#333338]">
            <Landmark className="w-3.5 h-3.5 text-[#A1A1AA]" />
            <select
              value={selectedWardId}
              onChange={(e) => setSelectedWardId(e.target.value)}
              className="bg-transparent text-xs text-[#F4F4F5] outline-none font-mono"
            >
              <option value="all">All Wards Jurisdiction</option>
              {wards.map((w) => (
                <option key={w.id} value={String(w.id)}>
                  Ward #{w.id} — {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-[#18181B] px-2.5 py-1.5 rounded-xs border border-[#333338]">
            <Filter className="w-3.5 h-3.5 text-[#A1A1AA]" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent text-xs text-[#F4F4F5] outline-none font-mono"
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

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 bg-[#18181B] px-2.5 py-1.5 rounded-xs border border-[#333338]">
            <Layers className="w-3.5 h-3.5 text-[#A1A1AA]" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-xs text-[#F4F4F5] outline-none font-mono"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-3 text-xs font-mono text-[#A1A1AA]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#F05030] animate-pulse" />
            <strong className="text-[#F4F4F5]">{mapIncidents.length}</strong> geolocated on GIS
          </span>
          <button
            onClick={fetchMapData}
            title="Refresh GIS"
            className="p-1.5 bg-[#2B2B30] hover:bg-[#333338] text-[#F4F4F5] rounded-xs border border-[#333338] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ─── Main Full-Bleed GIS Map Surface with Slide-in Drawer ─────────── */}
      <div className="h-[calc(100vh-210px)] min-h-[500px] bg-[#222226] border border-[#333338] rounded-sm overflow-hidden relative">
        <SharedIncidentMap
          incidents={mapIncidents}
          wards={wards}
          theme="graphite"
          interactive={true}
          showWardBoundaries={true}
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
            const full = incidents.find((i) => i.id === inc.id);
            setSelectedIncident(full || inc);
          }}
          className="w-full h-full"
        />

        {/* Slide-in Incident Inspector Card */}
        {selectedIncident && (
          <div className="absolute top-3 right-3 bottom-3 w-80 sm:w-96 bg-[#222226]/95 backdrop-blur-md border border-[#333338] rounded-sm p-4 z-20 flex flex-col justify-between shadow-2xl overflow-y-auto">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#333338] pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono-id text-[#F05030] font-bold">
                    #{selectedIncident.id}
                  </span>
                  <span className="text-xs font-semibold text-[#F4F4F5]">
                    {selectedIncident.category}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedIncident(null)}
                  className="text-[#A1A1AA] hover:text-[#F4F4F5] p-1 rounded-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <StatusBadge status={selectedIncident.status} size="sm" />
                {selectedIncident.severity && (
                  <span className="text-[10px] font-mono uppercase bg-[#18181B] text-[#A1A1AA] border border-[#333338] px-1.5 py-0.2 rounded-xs">
                    {selectedIncident.severity}
                  </span>
                )}
                <span className="text-[10px] font-mono text-[#A1A1AA]">
                  Ward #{selectedIncident.ward_id}
                </span>
              </div>

              <div className="text-xs text-[#F4F4F5] leading-relaxed bg-[#18181B] p-2.5 rounded-xs border border-[#333338]">
                <span className="text-[10px] font-mono uppercase text-[#71717A] block mb-0.5">
                  Reported Issue Description
                </span>
                {selectedIncident.description}
              </div>

              {selectedIncident.image_url && (
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#A1A1AA] block mb-1">
                    Evidence Photo
                  </span>
                  <img
                    src={selectedIncident.image_url}
                    alt="Evidence"
                    className="w-full h-40 rounded-xs object-cover border border-[#333338]"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-[#A1A1AA] bg-[#18181B] p-2 rounded-xs border border-[#333338]">
                <div>
                  <span className="text-[#71717A] block">Coordinates</span>
                  <span className="text-[#F4F4F5]">
                    {selectedIncident.latitude && selectedIncident.longitude
                      ? `${selectedIncident.latitude.toFixed(4)}°, ${selectedIncident.longitude.toFixed(4)}°`
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[#71717A] block">Timestamp</span>
                  <span className="text-[#F4F4F5]">
                    {new Date(selectedIncident.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#333338] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDetailModalIncident(selectedIncident)}
                className="w-full py-2 bg-[#F05030] hover:bg-[#D9381E] text-white text-xs font-medium rounded-xs shadow-xs transition-colors text-center"
              >
                Inspect Lifecycle History
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Detail Audit Modal ────────────────────────────────────────────── */}
      {detailModalIncident && (
        <IssueDetailsModal
          issue={{
            id: detailModalIncident.id,
            category: detailModalIncident.category,
            description: detailModalIncident.description,
            status: detailModalIncident.status,
            image_url: detailModalIncident.image_url,
            created_at: detailModalIncident.created_at,
            latitude: detailModalIncident.latitude,
            longitude: detailModalIncident.longitude,
            upvotes: detailModalIncident.upvotes,
          }}
          onClose={() => setDetailModalIncident(null)}
        />
      )}
    </div>
  );
};
