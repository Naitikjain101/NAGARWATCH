import React, { useState, useEffect, useMemo } from 'react';
import {
  Landmark,
  Search,
  Plus,
  Trash2,
  Edit2,
  Eye,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  MapPin,
  Users,
  AlertCircle,
  FileText,
  Compass,
  Layers,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { MapContainer, TileLayer, Polygon, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import apiClient from '../../lib/apiClient';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorState } from '../../components/ui/ErrorState';

interface SuperAdminWard {
  id: number;
  name: string;
  geom?: any;
  assigned_admins_count: number;
  assigned_admins: string[];
  total_incidents: number;
  active_incidents: number;
  resolved_incidents: number;
}

// Leaflet map auto-fitter for GIS polygon inspection
function MapAutoFitter({ rings }: { rings: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || rings.length === 0) return;
    setTimeout(() => {
      map.invalidateSize();
      const bounds = rings.map((r) => [r[0], r[1]] as [number, number]);
      map.fitBounds(bounds, { padding: [24, 24] });
    }, 100);
  }, [map, rings]);
  return null;
}

export const SuperAdminWardsPage: React.FC = () => {
  const [wards, setWards] = useState<SuperAdminWard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWardId, setSelectedWardId] = useState<number | null>(null);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalWard, setEditModalWard] = useState<SuperAdminWard | null>(null);
  const [deleteModalWard, setDeleteModalWard] = useState<SuperAdminWard | null>(null);
  const [inspectModalWard, setInspectModalWard] = useState<SuperAdminWard | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formWkt, setFormWkt] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);

  const fetchWards = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/v1/superadmin/wards');
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setWards(list);
      if (list.length > 0 && selectedWardId === null) {
        setSelectedWardId(list[0].id);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to retrieve municipal wards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWards();
  }, []);

  const filteredWards = useMemo(() => {
    if (!searchTerm.trim()) return wards;
    const term = searchTerm.toLowerCase();
    return wards.filter(
      (w) =>
        w.name.toLowerCase().includes(term) ||
        String(w.id).includes(term) ||
        w.assigned_admins.some((a) => a.toLowerCase().includes(term))
    );
  }, [wards, searchTerm]);

  // Selected ward for GIS inspector
  const activeWard = useMemo(() => {
    return wards.find((w) => w.id === selectedWardId) || wards[0] || null;
  }, [wards, selectedWardId]);

  // Parse active ward polygon coordinates
  const activeRings = useMemo(() => {
    if (!activeWard?.geom?.coordinates) return [];
    try {
      return activeWard.geom.coordinates[0].map((coord: number[]) => [coord[1], coord[0]]) as [
        number,
        number
      ][];
    } catch {
      return [];
    }
  }, [activeWard]);

  // Aggregate stats
  const aggregateStats = useMemo(() => {
    const totalWards = wards.length;
    const wardsWithAdmins = wards.filter((w) => w.assigned_admins_count > 0).length;
    const totalIncidents = wards.reduce((acc, w) => acc + (w.total_incidents || 0), 0);
    const resolvedIncidents = wards.reduce((acc, w) => acc + (w.resolved_incidents || 0), 0);
    return { totalWards, wardsWithAdmins, totalIncidents, resolvedIncidents };
  }, [wards]);

  // Sample WKT Polygon Generator
  const loadSampleWkt = () => {
    setFormWkt('POLYGON((76.50 9.50, 76.55 9.50, 76.55 9.55, 76.50 9.55, 76.50 9.50))');
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormName('');
    setFormCode('');
    setFormWkt('');
    setFormError(null);
    setConflicts([]);
    setCreateModalOpen(true);
  };

  // Submit Create Ward
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formWkt.trim()) {
      setFormError('Please enter a ward name and WKT geometry.');
      return;
    }
    setFormSubmitting(true);
    setFormError(null);
    setConflicts([]);

    try {
      await apiClient.post('/api/v1/superadmin/wards', {
        name: formName.trim(),
        code: formCode.trim() || undefined,
        geom_wkt: formWkt.trim(),
      });
      setCreateModalOpen(false);
      await fetchWards();
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setFormError(err.response.data?.error || 'Ward boundary overlaps with existing wards.');
        setConflicts(err.response.data?.conflicts || []);
      } else {
        setFormError(err?.response?.data?.error || 'Failed to create ward');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (ward: SuperAdminWard) => {
    setEditModalWard(ward);
    setFormName(ward.name);
    setFormCode('');
    setFormWkt('');
    setFormError(null);
    setConflicts([]);
  };

  // Submit Edit Ward
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalWard) return;
    if (!formName.trim()) {
      setFormError('Ward name cannot be empty.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);
    setConflicts([]);

    try {
      const payload: { name: string; code?: string; geom_wkt?: string } = {
        name: formName.trim(),
      };
      if (formCode.trim()) payload.code = formCode.trim();
      if (formWkt.trim()) payload.geom_wkt = formWkt.trim();

      await apiClient.patch(`/api/v1/superadmin/wards/${editModalWard.id}`, payload);
      setEditModalWard(null);
      await fetchWards();
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setFormError(err.response.data?.error || 'Boundary conflicts with other wards.');
        setConflicts(err.response.data?.conflicts || []);
      } else {
        setFormError(err?.response?.data?.error || 'Failed to update ward');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  // Submit Delete Ward
  const handleDeleteSubmit = async () => {
    if (!deleteModalWard) return;
    setFormSubmitting(true);
    try {
      await apiClient.delete(`/api/v1/superadmin/wards/${deleteModalWard.id}`);
      setDeleteModalWard(null);
      await fetchWards();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete ward');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Parse inspect polygon coordinates for modal
  const inspectRings = useMemo(() => {
    if (!inspectModalWard?.geom?.coordinates) return [];
    try {
      return inspectModalWard.geom.coordinates[0].map((coord: number[]) => [coord[1], coord[0]]) as [
        number,
        number
      ][];
    } catch {
      return [];
    }
  }, [inspectModalWard]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* ─── Header & Primary Controls ─────────────────────────────────────── */}
      <div className="bg-[#222226] border border-[#333338] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider bg-[#F05030]/20 text-[#F05030] border border-[#F05030]/30 px-2 py-0.5">
              GIS SECTOR MANAGEMENT
            </span>
            <span className="text-xs text-[#333338]">•</span>
            <span className="text-[11px] font-mono text-[#A1A1AA]">PostGIS Spatial Boundaries</span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-normal text-[#F4F4F5] tracking-tight">
            Administrative Wards
          </h1>
          <p className="text-xs sm:text-sm text-[#A1A1AA] mt-1 max-w-2xl leading-relaxed">
            Configure municipal ward jurisdictions, view incident volumes, and supervise administrative coverage.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={fetchWards}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#2B2B30] hover:bg-[#333338] text-[#F4F4F5] text-xs font-medium border border-[#333338] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#F05030] hover:bg-[#D9381E] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Ward</span>
          </button>
        </div>
      </div>

      {/* ─── Metric Chips ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#222226] border border-[#333338] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#A1A1AA]">
            <span className="text-[11px] font-mono uppercase tracking-wider">Total Wards</span>
            <Landmark className="w-3.5 h-3.5 text-[#F05030]" />
          </div>
          <div className="font-heading text-2xl font-normal text-[#F4F4F5] mt-1">{aggregateStats.totalWards}</div>
          <p className="text-[10px] font-mono text-[#A1A1AA] mt-0.5">Municipal zones defined</p>
        </div>

        <div className="bg-[#222226] border border-[#333338] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#A1A1AA]">
            <span className="text-[11px] font-mono uppercase tracking-wider">Supervised Wards</span>
            <Users className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="font-heading text-2xl font-normal text-amber-400 mt-1">{aggregateStats.wardsWithAdmins}</div>
          <p className="text-[10px] font-mono text-[#A1A1AA] mt-0.5">With active assigned admin</p>
        </div>

        <div className="bg-[#222226] border border-[#333338] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#A1A1AA]">
            <span className="text-[11px] font-mono uppercase tracking-wider">Total Incidents</span>
            <FileText className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="font-heading text-2xl font-normal text-[#F4F4F5] mt-1">{aggregateStats.totalIncidents}</div>
          <p className="text-[10px] font-mono text-[#A1A1AA] mt-0.5">Logged across all wards</p>
        </div>

        <div className="bg-[#222226] border border-[#333338] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#A1A1AA]">
            <span className="text-[11px] font-mono uppercase tracking-wider">Resolved Incidents</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="font-heading text-2xl font-normal text-emerald-400 mt-1">{aggregateStats.resolvedIncidents}</div>
          <p className="text-[10px] font-mono text-[#A1A1AA] mt-0.5">Closed civic issues</p>
        </div>
      </div>

      {/* ─── Main Two-Pane GIS Console ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Searchable Ward Roster (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#222226] border border-[#333338] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
              <input
                type="text"
                placeholder="Search by ward name, ID, or administrator..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-[#18181B] border border-[#333338] text-[#F4F4F5] placeholder-[#A1A1AA] focus:outline-none focus:border-[#F05030]"
              />
            </div>
            <div className="text-xs font-mono text-[#A1A1AA] shrink-0">
              Showing <span className="text-[#F4F4F5] font-semibold">{filteredWards.length}</span> of {wards.length} wards
            </div>
          </div>

          {loading && (
            <div className="p-12 bg-[#222226] border border-[#333338] flex flex-col items-center justify-center gap-3">
              <LoadingSpinner size="lg" />
              <p className="text-xs font-mono text-[#A1A1AA]">LOADING MUNICIPAL WARD BOUNDARIES...</p>
            </div>
          )}

          {error && !loading && (
            <div className="p-6 bg-[#222226] border border-[#333338]">
              <ErrorState title="Failed to load wards" description={error} onRetry={fetchWards} />
            </div>
          )}

          {!loading && !error && filteredWards.length === 0 && (
            <div className="p-10 bg-[#222226] border border-[#333338] text-center">
              <p className="text-xs font-mono text-[#A1A1AA]">NO MATCHING MUNICIPAL WARDS FOUND</p>
            </div>
          )}

          {!loading && !error && filteredWards.length > 0 && (
            <div className="space-y-2.5">
              {filteredWards.map((w) => {
                const isSelected = selectedWardId === w.id;
                return (
                  <div
                    key={w.id}
                    onClick={() => setSelectedWardId(w.id)}
                    className={`bg-[#222226] border transition-all cursor-pointer p-4 ${
                      isSelected
                        ? 'border-[#F05030] bg-[#2B2B30]/60 shadow-xs'
                        : 'border-[#333338] hover:border-[#333338]/80 hover:bg-[#222226]/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-semibold text-[#F05030] bg-[#F05030]/10 border border-[#F05030]/30 px-1.5 py-0.2">
                            #{w.id}
                          </span>
                          <h3 className="font-semibold text-sm text-[#F4F4F5] truncate flex items-center gap-1.5">
                            <Landmark className="w-3.5 h-3.5 text-[#F05030] shrink-0" />
                            {w.name}
                          </h3>
                          {w.geom ? (
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2">
                              PostGIS Polygon
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-[#A1A1AA] bg-[#18181B] border border-[#333338] px-1.5 py-0.2">
                              No Polygon
                            </span>
                          )}
                        </div>

                        {/* Administrator allocations */}
                        <div className="mt-2 text-xs">
                          {w.assigned_admins_count > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2">
                                {w.assigned_admins_count} Admin{w.assigned_admins_count > 1 ? 's' : ''}
                              </span>
                              <span className="text-xs text-[#A1A1AA] truncate">
                                {w.assigned_admins.join(', ')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.2">
                              Unassigned Jurisdiction
                            </span>
                          )}
                        </div>

                        {/* Incident Telemetry Counts */}
                        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-mono text-[#A1A1AA] pt-2 border-t border-[#333338]">
                          <span>Active: <strong className="text-amber-400">{w.active_incidents || 0}</strong></span>
                          <span>Resolved: <strong className="text-emerald-400">{w.resolved_incidents || 0}</strong></span>
                          <span>Total: <strong className="text-[#F4F4F5]">{w.total_incidents || 0}</strong></span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {w.geom && (
                          <button
                            onClick={() => setInspectModalWard(w)}
                            className="p-1.5 bg-[#2B2B30] hover:bg-[#333338] text-[#A1A1AA] hover:text-[#F4F4F5] border border-[#333338] transition-colors cursor-pointer"
                            title="Inspect PostGIS Boundary"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEdit(w)}
                          className="p-1.5 bg-[#2B2B30] hover:bg-[#333338] text-[#A1A1AA] hover:text-amber-400 border border-[#333338] transition-colors cursor-pointer"
                          title="Edit Ward Configuration"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteModalWard(w)}
                          className="p-1.5 bg-[#2B2B30] hover:bg-[#333338] text-[#A1A1AA] hover:text-rose-400 border border-[#333338] transition-colors cursor-pointer"
                          title="Delete Ward"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Interactive PostGIS Boundary Inspector (5 cols) */}
        <div className="lg:col-span-5 hidden lg:block sticky top-24 space-y-4">
          <div className="bg-[#222226] border border-[#333338] p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#333338]">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#F05030]" />
                <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-[#F4F4F5]">
                  PostGIS Boundary Viewer
                </h3>
              </div>
              {activeWard && (
                <span className="text-xs font-mono text-[#F05030] font-semibold">
                  Ward #{activeWard.id}
                </span>
              )}
            </div>

            {activeWard ? (
              <div className="space-y-3">
                <div className="h-64 bg-[#18181B] border border-[#333338] overflow-hidden relative">
                  {activeRings.length > 0 ? (
                    <MapContainer
                      center={activeRings[0] || [9.5, 76.5]}
                      zoom={13}
                      className="h-full w-full"
                      zoomControl={false}
                    >
                      <TileLayer
                        attribution="&copy; Esri"
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                      />
                      <Polygon
                        positions={activeRings}
                        pathOptions={{
                          color: '#F05030',
                          fillColor: '#F05030',
                          fillOpacity: 0.25,
                          weight: 2,
                        }}
                      />
                      <MapAutoFitter rings={activeRings} />
                    </MapContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center text-xs font-mono text-[#A1A1AA]">
                      <MapPin className="w-8 h-8 text-[#333338] mb-2" />
                      <p>NO POSTGIS POLYGON REGISTERED</p>
                      <p className="text-[10px] text-[#A1A1AA] mt-1">Assign WKT geometry to inspect boundary</p>
                    </div>
                  )}
                </div>

                <div className="bg-[#18181B] border border-[#333338] p-3 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-[#A1A1AA]">Sector Jurisdiction:</span>
                    <span className="text-[#F4F4F5] font-semibold">{activeWard.name} (Active GIS)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#A1A1AA]">Jurisdiction Staff:</span>
                    <span className="text-amber-400">Assigned: {activeWard.assigned_admins.join(', ') || 'None'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#A1A1AA]">Boundary Vertices:</span>
                    <span className="text-[#F4F4F5]">{activeRings.length} vertices</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#A1A1AA]">Spatial SRID:</span>
                    <span className="text-emerald-400">EPSG:4326 (WGS84)</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="py-12 text-center text-xs font-mono text-[#A1A1AA]">SELECT A WARD TO INSPECT</p>
            )}
          </div>
        </div>
      </div>

      {/* ─── CREATE WARD MODAL ────────────────────────────────────────────── */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#222226] border border-[#333338] w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-[#333338] flex items-center justify-between bg-[#18181B]">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-[#F05030]" />
                <h3 className="font-semibold text-[#F4F4F5] text-sm font-mono uppercase tracking-wider">
                  Create Municipal Ward
                </h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-[#A1A1AA] hover:text-[#F4F4F5] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{formError}</p>
                    {conflicts.length > 0 && (
                      <p className="text-[10px] mt-1">
                        Overlapping with: {conflicts.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] mb-1.5">
                  Ward Name <span className="text-[#F05030]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ward 14 - Kaloor Central"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#18181B] border border-[#333338] text-[#F4F4F5] placeholder-[#A1A1AA] focus:outline-none focus:border-[#F05030]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] mb-1.5">
                  Ward Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. W14"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#18181B] border border-[#333338] text-[#F4F4F5] placeholder-[#A1A1AA] focus:outline-none focus:border-[#F05030]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA]">
                    PostGIS Geometry (WKT) <span className="text-[#F05030]">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={loadSampleWkt}
                    className="text-xs font-mono text-[#F05030] hover:underline cursor-pointer"
                  >
                    Load Sample WKT
                  </button>
                </div>
                <textarea
                  required
                  rows={4}
                  placeholder="POLYGON((lon1 lat1, lon2 lat2, lon3 lat3, lon1 lat1))"
                  value={formWkt}
                  onChange={(e) => setFormWkt(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-[#18181B] border border-[#333338] text-[#F4F4F5] placeholder-[#A1A1AA] focus:outline-none focus:border-[#F05030]"
                />
                <p className="text-[10px] font-mono text-[#A1A1AA] mt-1">
                  Standard WGS84 coordinates formatted as Well-Known Text (WKT).
                </p>
              </div>

              <div className="pt-4 border-t border-[#333338] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={formSubmitting}
                  className="px-3 py-2 text-xs font-medium text-[#A1A1AA] hover:text-[#F4F4F5] bg-[#18181B] border border-[#333338] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#F05030] hover:bg-[#D9381E] disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {formSubmitting ? 'Validating & Saving...' : 'Save Municipal Ward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT WARD MODAL ──────────────────────────────────────────────── */}
      {editModalWard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#222226] border border-[#333338] w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-[#333338] flex items-center justify-between bg-[#18181B]">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-[#F4F4F5] text-sm font-mono uppercase tracking-wider">
                  Edit Ward #{editModalWard.id}
                </h3>
              </div>
              <button
                onClick={() => setEditModalWard(null)}
                className="text-[#A1A1AA] hover:text-[#F4F4F5] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{formError}</p>
                    {conflicts.length > 0 && (
                      <p className="text-[10px] mt-1">
                        Overlapping with: {conflicts.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA] mb-1.5">
                  Ward Name <span className="text-[#F05030]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#18181B] border border-[#333338] text-[#F4F4F5] focus:outline-none focus:border-[#F05030]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#A1A1AA]">
                    Update PostGIS Geometry (WKT)
                  </label>
                  <button
                    type="button"
                    onClick={loadSampleWkt}
                    className="text-xs font-mono text-[#F05030] hover:underline cursor-pointer"
                  >
                    Load Sample WKT
                  </button>
                </div>
                <textarea
                  rows={4}
                  placeholder="Leave blank to retain current geometry..."
                  value={formWkt}
                  onChange={(e) => setFormWkt(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-[#18181B] border border-[#333338] text-[#F4F4F5] placeholder-[#A1A1AA] focus:outline-none focus:border-[#F05030]"
                />
              </div>

              <div className="pt-4 border-t border-[#333338] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditModalWard(null)}
                  disabled={formSubmitting}
                  className="px-3 py-2 text-xs font-medium text-[#A1A1AA] hover:text-[#F4F4F5] bg-[#18181B] border border-[#333338] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {formSubmitting ? 'Updating...' : 'Update Municipal Ward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE WARD CONFIRMATION MODAL ────────────────────────────────── */}
      {deleteModalWard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#222226] border border-rose-500/40 w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-[#333338] flex items-center justify-between bg-[#18181B]">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-4 h-4" />
                <h3 className="font-semibold text-sm font-mono uppercase tracking-wider">
                  Confirm Ward Deletion
                </h3>
              </div>
              <button
                onClick={() => setDeleteModalWard(null)}
                className="text-[#A1A1AA] hover:text-[#F4F4F5] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Are you sure you want to delete <strong className="text-[#F4F4F5]">{deleteModalWard.name}</strong> (Ward #{deleteModalWard.id})?
                This action is irreversible and unlinks associated boundaries.
              </p>

              {deleteModalWard.total_incidents > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
                  <p className="font-semibold">Active Sector Data Warning</p>
                  <p className="text-[11px] mt-0.5">
                    This ward currently contains {deleteModalWard.total_incidents} logged civic defects.
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-[#333338] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteModalWard(null)}
                  disabled={formSubmitting}
                  className="px-3 py-2 text-xs font-medium text-[#A1A1AA] hover:text-[#F4F4F5] bg-[#18181B] border border-[#333338] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSubmit}
                  disabled={formSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {formSubmitting ? 'Deleting...' : 'Delete Ward'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── POSTGIS BOUNDARY INSPECTOR MODAL ──────────────────────────────── */}
      {inspectModalWard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#222226] border border-[#333338] w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-[#333338] flex items-center justify-between bg-[#18181B]">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#F05030]" />
                <h3 className="font-semibold text-[#F4F4F5] text-sm font-mono uppercase tracking-wider">
                  PostGIS Boundary Inspector: {inspectModalWard.name}
                </h3>
              </div>
              <button
                onClick={() => setInspectModalWard(null)}
                className="text-[#A1A1AA] hover:text-[#F4F4F5] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="h-72 w-full bg-[#18181B] border border-[#333338] overflow-hidden">
                {inspectRings.length > 0 ? (
                  <MapContainer
                    center={inspectRings[0] || [9.5, 76.5]}
                    zoom={13}
                    className="h-full w-full"
                  >
                    <TileLayer
                      attribution="&copy; Esri"
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                    />
                    <Polygon
                      positions={inspectRings}
                      pathOptions={{
                        color: '#F05030',
                        fillColor: '#F05030',
                        fillOpacity: 0.3,
                        weight: 2,
                      }}
                    />
                    <MapAutoFitter rings={inspectRings} />
                  </MapContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs font-mono text-[#A1A1AA]">
                    NO POLYGON GEOMETRY DATA
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div className="p-2.5 bg-[#18181B] border border-[#333338]">
                  <span className="text-[#A1A1AA] block text-[10px]">TOTAL INCIDENTS</span>
                  <span className="text-[#F4F4F5] font-semibold">{inspectModalWard.total_incidents}</span>
                </div>
                <div className="p-2.5 bg-[#18181B] border border-[#333338]">
                  <span className="text-[#A1A1AA] block text-[10px]">ACTIVE TRIAGE</span>
                  <span className="text-amber-400 font-semibold">{inspectModalWard.active_incidents}</span>
                </div>
                <div className="p-2.5 bg-[#18181B] border border-[#333338]">
                  <span className="text-[#A1A1AA] block text-[10px]">ASSIGNED ADMINS</span>
                  <span className="text-emerald-400 font-semibold">{inspectModalWard.assigned_admins_count}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#333338] flex justify-end">
                <button
                  type="button"
                  onClick={() => setInspectModalWard(null)}
                  className="px-4 py-2 text-xs font-medium text-[#F4F4F5] bg-[#2B2B30] hover:bg-[#333338] border border-[#333338] cursor-pointer"
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

SuperAdminWardsPage.displayName = 'SuperAdminWardsPage';
