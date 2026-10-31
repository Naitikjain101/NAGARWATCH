import React, { useEffect, useState } from 'react';
import {
  Landmark,
  Layers,
  MapPin,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Shield,
  ExternalLink,
  Compass,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import apiClient from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SharedIncidentMap, SharedMapWard } from '../../components/map/SharedIncidentMap';

interface WardDetail {
  id: number;
  name: string;
  geom?: any;
}

interface UserProfileData {
  id: string;
  role: string;
  full_name?: string;
  email?: string;
  phone_number?: string;
  wards_allocated?: number[];
}

export const AdminWardPage: React.FC = () => {
  const { userRole } = useAuth();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [allWards, setAllWards] = useState<WardDetail[]>([]);
  const [wardIncidents, setWardIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [userRes, wardsRes, incidentsRes] = await Promise.all([
        apiClient.get('/api/v1/users/me'),
        apiClient.get('/api/v1/wards'),
        apiClient.get('/api/v1/admin/incidents'),
      ]);

      setProfile(userRes.data?.data || null);
      setAllWards(Array.isArray(wardsRes.data?.data) ? wardsRes.data.data : []);
      setWardIncidents(Array.isArray(incidentsRes.data?.data) ? incidentsRes.data.data : []);
    } catch {
      setError('Unable to load ward information. Please check connection and permissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWardData();
  }, []);

  const assignedWardIds = profile?.wards_allocated || [];
  const isSuper = userRole === 'super_admin';

  // Wards matching assigned IDs or all if super_admin
  const relevantWards = isSuper
    ? allWards
    : allWards.filter((w) => assignedWardIds.includes(w.id));

  // Fallback to ward 1 if relevantWards empty but wards exist
  const displayWards = relevantWards.length > 0 ? relevantWards : allWards.slice(0, 1);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-6 h-6 text-[#F05030] animate-spin" />
        <p className="text-xs font-mono uppercase tracking-wider text-[#A1A1AA]">
          Loading administrative ward data...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-[#222226] border border-[#333338] rounded-sm max-w-xl mx-auto my-12 text-center">
        <AlertTriangle className="w-8 h-8 text-[#F05030] mx-auto mb-3" />
        <h3 className="text-base font-mono font-bold text-[#F4F4F5] mb-1">Ward Data Unavailable</h3>
        <p className="text-xs text-[#A1A1AA] mb-4">{error}</p>
        <button
          onClick={fetchWardData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium bg-[#2B2B30] text-[#F4F4F5] hover:bg-[#333338] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-[#222226] border border-[#333338] rounded-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-widest bg-[#F05030]/20 text-[#F05030] border border-[#F05030]/30 px-1.5 py-0.5 rounded-xs">
              Jurisdiction Registry
            </span>
            <span className="text-[11px] text-[#A1A1AA] font-mono">•</span>
            <span className="text-[11px] text-[#A1A1AA] font-mono">
              {isSuper ? 'City-Wide Authority' : `${assignedWardIds.length} Assigned Wards`}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-mono font-bold text-[#F4F4F5] tracking-tight">
            Assigned Ward Information
          </h1>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Verified boundary authorities and administrative jurisdiction details.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/admin/map">
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F05030] hover:bg-[#D9381E] text-white text-xs font-medium rounded-xs shadow-xs transition-colors">
              <MapPin className="w-3.5 h-3.5" />
              <span>Spatial Boundaries</span>
            </button>
          </Link>
          <button
            onClick={fetchWardData}
            title="Refresh"
            className="p-1.5 bg-[#2B2B30] hover:bg-[#333338] text-[#F4F4F5] rounded-xs border border-[#333338] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ─── Assigned Wards Detail Cards ──────────────────────────────────── */}
      <div className="space-y-4">
        {displayWards.map((ward) => {
          const wardSpecificIncidents = wardIncidents.filter((i) => Number(i.ward_id) === ward.id);
          const geomType = ward.geom?.type || 'Polygon';

          return (
            <div
              key={ward.id}
              className="p-5 bg-[#222226] border border-[#333338] rounded-sm space-y-4 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#333338] pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xs bg-[#18181B] border border-[#333338] text-[#F05030] flex items-center justify-center font-mono font-bold text-base">
                    {ward.id}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-mono text-[#F4F4F5] font-bold">
                        {ward.name}
                      </h2>
                      <span className="text-[11px] font-mono text-[#F05030] bg-[#F05030]/10 border border-[#F05030]/30 px-1.5 py-0.2 rounded-xs">
                        Ward #{ward.id}
                      </span>
                    </div>
                    <span className="text-xs text-[#A1A1AA] font-mono">
                      Official Municipal Boundary Identifier
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-[#A1A1AA]">
                  <span className="bg-[#18181B] px-2.5 py-1 rounded-xs border border-[#333338]">
                    Format: <strong className="text-[#F4F4F5]">PostGIS Layer</strong>
                  </span>
                  <span className="bg-[#18181B] px-2.5 py-1 rounded-xs border border-[#333338]">
                    Incidents: <strong className="text-[#F4F4F5]">{wardSpecificIncidents.length}</strong>
                  </span>
                </div>
              </div>

              {/* Geographic Spatial Telemetry */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-3 bg-[#18181B] border border-[#333338] rounded-xs space-y-1">
                  <span className="text-[#71717A] text-[10px] uppercase block">
                    Spatial Classification
                  </span>
                  <p className="text-sm font-mono font-bold text-[#F4F4F5]">{geomType}</p>
                  <p className="text-[11px] text-[#A1A1AA]">EPSG:4326 PostGIS Polygon</p>
                </div>

                <div className="p-3 bg-[#18181B] border border-[#333338] rounded-xs space-y-1">
                  <span className="text-[#71717A] text-[10px] uppercase block">
                    Jurisdiction Authority
                  </span>
                  <p className="text-sm font-mono font-bold text-[#F4F4F5]">Municipal Corporation</p>
                  <p className="text-[11px] text-[#A1A1AA]">Triage & Field Maintenance</p>
                </div>

                <div className="p-3 bg-[#18181B] border border-[#333338] rounded-xs space-y-1">
                  <span className="text-[#71717A] text-[10px] uppercase block">
                    Active Telemetry
                  </span>
                  <p className="text-sm font-mono font-bold text-[#F4F4F5]">
                    {wardSpecificIncidents.filter((i) => i.status !== 'resolved').length} Unresolved
                  </p>
                  <p className="text-[11px] text-[#A1A1AA]">
                    {wardSpecificIncidents.filter((i) => i.status === 'resolved').length} Resolved
                  </p>
                </div>
              </div>

              {/* Mini Spatial Polygon Map Preview */}
              <div className="h-64 bg-[#18181B] border border-[#333338] rounded-xs overflow-hidden relative">
                <SharedIncidentMap
                  wards={[ward as SharedMapWard]}
                  theme="graphite"
                  interactive={true}
                  showWardBoundaries={true}
                  className="w-full h-full"
                />
                <div className="absolute top-2 left-2 bg-[#222226]/90 border border-[#333338] px-2 py-1 rounded-xs text-[10px] font-mono text-[#A1A1AA] z-10 pointer-events-none">
                  Ward #{ward.id} PostGIS Boundary
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
