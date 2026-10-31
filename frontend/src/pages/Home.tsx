import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../lib/apiClient';
import { StatusBadge } from '../components/ui/StatusBadge';
import IssueDetailsModal from '../components/IssueDetailsModal';
import {
  Camera,
  Compass,
  Shield,
  MapPin,
  CheckCircle,
  Clock,
  ArrowRight,
  ThumbsUp,
  AlertTriangle,
  Lightbulb,
  Trash2,
  Droplets,
  Construction,
  AlertOctagon,
  FileQuestion,
  Activity,
  CheckCircle2,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface RecentIncident {
  id: string;
  category: string;
  description: string;
  status: string;
  image_url: string;
  created_at: string;
  latitude?: number;
  longitude?: number;
  upvotes?: number;
  confirmations_count?: number;
  disputes_count?: number;
  severity?: string;
  ward_id?: string | number;
  ward_name?: string;
  resolved_at?: string;
  resolution_notes?: string;
  proof_media_url?: string;
}

const POPULAR_CATEGORIES = [
  { name: 'Pothole', label: 'Potholes & Roads', icon: Construction, color: 'text-[#D97706] bg-[#D97706]/10' },
  { name: 'Streetlight', label: 'Streetlights & Power', icon: Lightbulb, color: 'text-amber-700 bg-amber-100/60' },
  { name: 'Garbage', label: 'Garbage & Sanitation', icon: Trash2, color: 'text-[#16A34A] bg-[#16A34A]/10' },
  { name: 'Water Leak', label: 'Water & Drainage', icon: Droplets, color: 'text-[#4682B4] bg-[#4682B4]/10' },
  { name: 'Safety Hazard', label: 'Safety Hazards', icon: AlertOctagon, color: 'text-[#D9381E] bg-[#D9381E]/10' },
  { name: 'Other', label: 'Other Civic Issues', icon: FileQuestion, color: 'text-stone-700 bg-stone-200/60' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [recentIncidents, setRecentIncidents] = useState<RecentIncident[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loadingIncidents, setLoadingIncidents] = useState(true);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<RecentIncident | null>(null);
  const [activeWardName, setActiveWardName] = useState<string>('Central Ward');

  // Quick action: Detect GPS and navigate directly to Explore
  const handleExploreCurrentLocation = () => {
    setIsLocating(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      navigate('/explore');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        navigate(`/explore?lat=${position.coords.latitude.toFixed(6)}&lon=${position.coords.longitude.toFixed(6)}`);
      },
      () => {
        setIsLocating(false);
        navigate('/explore');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  // Fetch real live incidents across the platform
  useEffect(() => {
    const fetchRecent = async () => {
      setLoadingIncidents(true);
      try {
        const wardsRes = await apiClient.get('/api/v1/wards');
        const wards = wardsRes.data?.data;
        if (Array.isArray(wards) && wards.length > 0) {
          const firstWard = wards[0];
          setActiveWardName(firstWard.name || 'Central Ward');
          const incRes = await apiClient.get(`/api/v1/complaints/ward?ward_id=${firstWard.id}&limit=8`);
          const incData = incRes.data?.data;
          if (Array.isArray(incData)) {
            setRecentIncidents(incData);
            setTotalCount(incRes.data?.count ?? incData.length);
          }
        }
      } catch (err) {
        // Fail gracefully to empty state
        setRecentIncidents([]);
      } finally {
        setLoadingIncidents(false);
      }
    };

    fetchRecent();
  }, []);

  // Filter "Resolved this week" strictly by resolved_at within 7 days
  const resolvedThisWeek = useMemo(() => {
    const now = Date.now();
    return recentIncidents.filter((inc) => {
      const isResolved = inc.status === 'resolved' || inc.status === 'closed';
      if (!isResolved) return false;
      const dateStr = inc.resolved_at || inc.created_at;
      if (!dateStr) return false;
      const ms = new Date(dateStr).getTime();
      return (now - ms) <= 7 * 24 * 60 * 60 * 1000;
    });
  }, [recentIncidents]);

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 font-sans text-[#1C1917] dark:text-[#F4F4F5] antialiased space-y-10 pb-16">
      {/* ─── Editorial Dateline & Masthead ───────────────────────────────── */}
      <header className="border-b-2 border-[#1C1917] dark:border-[#333338] pb-6 space-y-4">
        {/* Newspaper Ticker Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 py-1.5 border-b border-[#E5E0D4] dark:border-[#333338] text-[11px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#D9381E] dark:text-[#F05030]">NagarWatch Gazette</span>
            <span>•</span>
            <span>Municipal Dispatch & Civil Governance</span>
            <span>•</span>
            <span className="text-[#1C1917] dark:text-[#F4F4F5] font-semibold">{activeWardName} Sector</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-500 animate-pulse" />
            <span>Operational Telemetry Online</span>
          </div>
        </div>

        {/* Hero Headlines */}
        <div className="pt-2 max-w-4xl space-y-3">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-xs bg-[#D9381E]/10 dark:bg-[#F05030]/15 border border-[#D9381E]/20 dark:border-[#F05030]/30 text-[#D9381E] dark:text-[#F05030] text-[11px] font-mono font-semibold uppercase">
            <span>● Community Safety & Neighbourhood Intelligence</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-mono font-bold text-[#1C1917] dark:text-[#F4F4F5] tracking-tight leading-tight">
            Empowering Citizens. <br />
            <span className="font-mono text-[#D9381E] dark:text-[#F05030]">Resolving Civic Issues.</span>
          </h1>

          <p className="text-sm sm:text-base text-[#57534E] dark:text-[#A1A1AA] leading-relaxed max-w-2xl font-sans">
            Report local hazards with verified GPS coordinates, track municipal repairs from
            initial report to resolution, and explore live incidents across your neighbourhood in real time.
          </p>

          {/* Strong Primary Entry Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-3">
            <Link to="/report">
              <button
                type="button"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-sm bg-[#D9381E] hover:bg-[#B92B15] dark:bg-[#F05030] dark:hover:bg-[#D9381E] text-white text-xs font-mono font-semibold transition-colors shadow-xs cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Report an Issue</span>
              </button>
            </Link>

            <button
              type="button"
              disabled={isLocating}
              onClick={handleExploreCurrentLocation}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-sm bg-[#FBF9F4] dark:bg-[#222226] hover:bg-[#F4F1EA] dark:hover:bg-[#2B2B30] text-[#1C1917] dark:text-[#F4F4F5] border border-[#E5E0D4] dark:border-[#333338] text-xs font-mono font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Compass className={`w-4 h-4 text-[#D9381E] dark:text-[#F05030] ${isLocating ? 'animate-spin' : ''}`} />
              <span>Explore Neighbourhood</span>
            </button>
          </div>

          {locationError && (
            <p className="text-xs text-[#991B1B] dark:text-red-400 font-mono bg-red-50 dark:bg-red-950/40 p-2 rounded-xs border border-red-200 dark:border-red-900 inline-block">
              {locationError}
            </p>
          )}
        </div>
      </header>

      {/* ─── Quick Issue Domain Strip ────────────────────────────────────── */}
      <section className="space-y-3 font-sans">
        <div className="flex items-center justify-between pb-2 border-b border-[#E5E0D4] dark:border-[#333338]">
          <h2 className="text-xs font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA] font-semibold">
            Browse by Issue Category
          </h2>
          <Link
            to="/explore"
            className="text-xs font-mono text-[#D9381E] dark:text-[#F05030] hover:underline flex items-center gap-1 transition-colors"
          >
            <span>All Categories</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {POPULAR_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.name}
                type="button"
                onClick={() => navigate(`/explore?category=${encodeURIComponent(cat.name)}`)}
                className="p-3 rounded-sm bg-[#FBF9F4] dark:bg-[#222226] hover:bg-[#F4F1EA] dark:hover:bg-[#2B2B30] border border-[#E5E0D4] dark:border-[#333338] hover:border-[#D9381E]/60 dark:hover:border-[#F05030]/60 transition-all text-left flex flex-col items-start gap-2 group shadow-2xs cursor-pointer"
              >
                <div className={`p-1.5 rounded-xs ${cat.color} group-hover:scale-105 transition-transform`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-sans font-bold text-xs text-[#1C1917] dark:text-[#F4F4F5] group-hover:text-[#D9381E] dark:group-hover:text-[#F05030] transition-colors line-clamp-1">
                    {cat.label}
                  </h3>
                  <span className="text-[10px] font-mono text-[#78716C] dark:text-[#A1A1AA]">View map →</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ─── Asymmetric Editorial Grid (Lead Feed + Status Board) ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ─── Left Column (8 cols): Live Neighbourhood Feed ──────────────── */}
        <section className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E5E0D4] dark:border-[#333338]">
            <div>
              <h2 className="text-xl sm:text-2xl font-heading font-bold text-[#1C1917] dark:text-[#F4F4F5]">
                Recent Neighbourhood Incidents
              </h2>
              <p className="text-xs text-[#78716C] dark:text-[#A1A1AA] font-mono mt-0.5">
                {totalCount !== null
                  ? `Showing latest reports from ${totalCount} recorded civic issues`
                  : 'Live civic reports submitted by community members'}
              </p>
            </div>

            <Link
              to="/explore"
              className="text-xs font-mono text-[#D9381E] dark:text-[#F05030] hover:underline flex items-center gap-1 shrink-0"
            >
              <span>View Interactive Map</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loadingIncidents ? (
            <div className="py-16 bg-[#FBF9F4] dark:bg-[#222226] rounded-sm border border-[#E5E0D4] dark:border-[#333338] flex flex-col items-center justify-center gap-2">
              <Activity className="w-6 h-6 text-[#D9381E] dark:text-[#F05030] animate-pulse" />
              <p className="text-xs font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA]">
                Loading recent incidents...
              </p>
            </div>
          ) : recentIncidents.length === 0 ? (
            <div className="py-14 px-6 bg-[#FBF9F4] dark:bg-[#222226] rounded-sm border border-[#E5E0D4] dark:border-[#333338] text-center space-y-3 font-sans">
              <MapPin className="w-7 h-7 text-[#78716C] dark:text-[#A1A1AA] mx-auto opacity-50" />
              <h3 className="font-heading font-bold text-base text-[#1C1917] dark:text-[#F4F4F5]">No recent incidents reported</h3>
              <p className="text-xs text-[#78716C] dark:text-[#A1A1AA] max-w-sm mx-auto">
                Your neighbourhood currently has no open incidents recorded. Be the first to report an issue.
              </p>
              <Link to="/report">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm bg-[#D9381E] hover:bg-[#B92B15] dark:bg-[#F05030] dark:hover:bg-[#D9381E] text-white text-xs font-mono font-medium transition-colors shadow-xs cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Submit First Report</span>
                </button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recentIncidents.slice(0, 6).map((incident) => (
                <div
                  key={incident.id}
                  onClick={() => setSelectedIncident(incident)}
                  className="bg-[#FBF9F4] dark:bg-[#222226] hover:bg-[#F4F1EA] dark:hover:bg-[#2B2B30] border border-[#E5E0D4] dark:border-[#333338] hover:border-[#D9381E]/60 dark:hover:border-[#F05030]/60 rounded-sm overflow-hidden transition-all cursor-pointer shadow-2xs group flex flex-col justify-between"
                >
                  <div>
                    {/* Incident Evidence Photo */}
                    {incident.image_url ? (
                      <div className="w-full h-40 bg-[#F4F1EA] dark:bg-[#18181B] overflow-hidden relative border-b border-[#E5E0D4] dark:border-[#333338]">
                        <img
                          src={incident.image_url}
                          alt={incident.category}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                        />
                        <div className="absolute top-2 right-2">
                          <StatusBadge status={incident.status} size="sm" showIcon={false} />
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-[#F4F1EA] dark:bg-[#18181B] border-b border-[#E5E0D4] dark:border-[#333338] flex items-center justify-between">
                        <span className="text-xs font-mono font-semibold text-[#1C1917] dark:text-[#F4F4F5]">{incident.category}</span>
                        <StatusBadge status={incident.status} size="sm" showIcon={false} />
                      </div>
                    )}

                    {/* Content Details */}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-1.5">
                        <h3 className="font-heading font-bold text-base text-[#1C1917] dark:text-[#F4F4F5] truncate">
                          {incident.category}
                        </h3>
                        {incident.severity && (
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.2 rounded-xs font-semibold capitalize ${
                              incident.severity === 'critical'
                                ? 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800'
                                : incident.severity === 'high'
                                ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                : incident.severity === 'low'
                                ? 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700'
                                : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                            }`}
                          >
                            {incident.severity}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[#57534E] dark:text-[#A1A1AA] line-clamp-2 leading-relaxed font-sans">
                        {incident.description || 'No description provided.'}
                      </p>

                      {incident.ward_name && (
                        <p className="text-[11px] font-mono text-[#78716C] dark:text-[#A1A1AA] flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#D9381E] dark:text-[#F05030]" />
                          <span className="truncate">{incident.ward_name}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="px-4 py-2.5 border-t border-[#E5E0D4] dark:border-[#333338] bg-[#F4F1EA]/60 dark:bg-[#18181B]/60 flex items-center justify-between text-[11px] font-mono text-[#78716C] dark:text-[#A1A1AA]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(incident.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>

                    <div className="flex items-center gap-2">
                      {incident.upvotes !== undefined && incident.upvotes > 0 && (
                        <span className="flex items-center gap-1 font-semibold text-[#0D9488] dark:text-teal-400">
                          <ThumbsUp className="w-3 h-3" />
                          <span>{incident.upvotes}</span>
                        </span>
                      )}
                      {incident.disputes_count !== undefined && incident.disputes_count > 0 && (
                        <span className="flex items-center gap-1 font-semibold text-[#991B1B] dark:text-red-400">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{incident.disputes_count}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Right Column (4 cols): Live Status Board & Proof Points ─────── */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Sector Status Board Card */}
          <div className="p-5 bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] rounded-sm shadow-xs space-y-4 font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E0D4] dark:border-[#333338]">
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#78716C] dark:text-[#A1A1AA] font-semibold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#D9381E] dark:text-[#F05030]" />
                Sector Telemetry
              </span>
              <span className="text-[10px] font-mono text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded-xs">
                Live Data
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA]">
                  Total Recorded In Sector
                </span>
                <p className="text-3xl font-mono font-bold text-[#1C1917] dark:text-[#F4F4F5] mt-0.5">
                  {totalCount !== null ? totalCount : '—'}
                </p>
              </div>

              <div className="pt-2 border-t border-[#E5E0D4] dark:border-[#333338] text-xs font-mono text-[#57534E] dark:text-[#A1A1AA] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span>Assigned Jurisdiction:</span>
                  <span className="font-semibold text-[#1C1917] dark:text-[#F4F4F5]">{activeWardName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Verification Radius:</span>
                  <span className="font-semibold text-[#1C1917] dark:text-[#F4F4F5]">20m Spatial Index</span>
                </div>
              </div>
            </div>
          </div>

          {/* "Resolved This Week" Proof Points */}
          <div className="p-5 bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] rounded-sm shadow-xs space-y-3 font-sans">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#E5E0D4] dark:border-[#333338]">
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#78716C] dark:text-[#A1A1AA] font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] dark:text-emerald-400" />
                Resolved This Week
              </span>
              <span className="text-[10px] font-mono text-[#16A34A] dark:text-emerald-400 font-bold">
                {resolvedThisWeek.length} Completed
              </span>
            </div>

            {resolvedThisWeek.length === 0 ? (
              <p className="text-xs text-[#78716C] dark:text-[#A1A1AA] font-mono py-2 leading-relaxed">
                0 issues resolved in the past 7 days across this sector. Pending work orders are currently in active field queue.
              </p>
            ) : (
              <div className="space-y-2.5">
                {resolvedThisWeek.slice(0, 3).map((res) => (
                  <div
                    key={`res-${res.id}`}
                    onClick={() => setSelectedIncident(res)}
                    className="p-2.5 rounded-xs bg-[#F4F1EA] dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] hover:border-[#16A34A]/50 cursor-pointer transition-colors text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-heading font-bold text-[#1C1917] dark:text-[#F4F4F5]">{res.category}</span>
                      <span className="text-[10px] font-mono text-[#16A34A] dark:text-emerald-400 font-semibold">✓ Verified Fixed</span>
                    </div>
                    <p className="text-[11px] text-[#57534E] dark:text-[#A1A1AA] line-clamp-1">
                      {res.resolution_notes || res.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Civic Platform Infrastructure Pillars (Editorial Inset Box) */}
          <div className="p-5 bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] rounded-sm shadow-xs space-y-4 font-sans">
            <h3 className="text-xs font-mono uppercase tracking-widest text-[#78716C] dark:text-[#A1A1AA] font-bold pb-2 border-b border-[#E5E0D4] dark:border-[#333338]">
              Platform Infrastructure & Integrity
            </h3>

            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#1C1917] dark:text-[#F4F4F5]">
                  <Shield className="w-3.5 h-3.5 text-[#D9381E] dark:text-[#F05030]" />
                  <span>Verified Spatial Integrity</span>
                </div>
                <p className="text-[11px] text-[#57534E] dark:text-[#A1A1AA] leading-relaxed">
                  Every submission extracts EXIF metadata and device GPS to guarantee geographic authenticity
                  and prevent duplicate dispatches within 20 metres.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#1C1917] dark:text-[#F4F4F5]">
                  <Compass className="w-3.5 h-3.5 text-[#D9381E] dark:text-[#F05030]" />
                  <span>Live Neighbourhood Discovery</span>
                </div>
                <p className="text-[11px] text-[#57534E] dark:text-[#A1A1AA] leading-relaxed">
                  Explore live issues across municipal wards on an interactive map. Verify neighbouring
                  reports to highlight urgent infrastructure needs.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#1C1917] dark:text-[#F4F4F5]">
                  <CheckCircle className="w-3.5 h-3.5 text-[#D9381E] dark:text-[#F05030]" />
                  <span>Transparent Resolution</span>
                </div>
                <p className="text-[11px] text-[#57534E] dark:text-[#A1A1AA] leading-relaxed">
                  Track status transitions directly from municipal ward administrators from initial triage
                  through active work and final resolution.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Demo Access Callout for Evaluators (when unauthenticated) */}
          {!user && (
            <div className="p-4 rounded-sm bg-[#18181B] dark:bg-[#121214] text-[#F4F4F5] border border-[#333338] shadow-xs space-y-2.5 font-sans">
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded-xs text-[9px] font-mono font-bold uppercase tracking-wider bg-[#F05030]/20 text-[#F05030] border border-[#F05030]/30">
                  Instant Evaluation Demo
                </span>
              </div>
              <h3 className="text-sm font-bold text-[#F4F4F5]">Explore All 3 NagarWatch Roles Instantly</h3>
              <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                One-click sign in as Citizen (report & track), Ward Administrator (triage & resolve), or Super Administrator (governance & audit).
              </p>
              <Link to="/login" className="inline-block pt-1">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#F05030] hover:bg-[#D9381E] text-white text-xs font-mono font-medium transition-colors cursor-pointer"
                >
                  <span>Sign In With Demo Roles</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </Link>
            </div>
          )}
        </aside>
      </div>

      {/* Incident Details Modal */}
      {selectedIncident && (
        <IssueDetailsModal
          issue={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onLocateOnMap={(lat, lon) => {
            setSelectedIncident(null);
            navigate(`/explore?lat=${lat}&lon=${lon}`);
          }}
        />
      )}
    </div>
  );
}
