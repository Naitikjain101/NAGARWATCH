import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Camera,
  Upload,
  CheckCircle,
  AlertCircle,
  X,
  MapPin,
  FileText,
  AlertTriangle,
  RotateCw,
  Layers,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  Send,
  Sparkles,
  Info,
  Compass,
  Image as ImageIcon,
  FolderOpen,
} from 'lucide-react';
import apiClient from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import IssueDetailsModal from '../components/IssueDetailsModal';
import { LocationPicker } from '../components/LocationPicker';
import { extractGpsFromExif, LocationData, isValidCoordinates } from '../lib/locationUtils';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { normalizeStatus, DESIGN_TOKENS } from '../lib/designSystem';

export const CIVIC_CATEGORY_OPTIONS = [
  { value: 'Pothole', label: 'Road Damage & Potholes' },
  { value: 'Garbage', label: 'Garbage & Sanitation' },
  { value: 'Water Leak', label: 'Water Supply & Drainage' },
  { value: 'Streetlight', label: 'Street Lighting & Electricity' },
  { value: 'Safety Hazard', label: 'Public Safety & Hazards' },
  { value: 'Signage', label: 'Traffic & Direction Signs' },
  { value: 'Graffiti', label: 'Graffiti & Vandalism' },
  { value: 'Encroachment', label: 'Encroachment & Obstructions' },
  { value: 'Other', label: 'Other Civic Issues' },
];

const CATEGORIES = CIVIC_CATEGORY_OPTIONS.map((c) => c.value);

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low — Minor inconvenience', badge: '○ Low Priority' },
  { value: 'medium', label: 'Medium — Normal maintenance issue', badge: '◐ Standard' },
  { value: 'high', label: 'High — Hazardous or disruptive', badge: '▲ High Hazard' },
  { value: 'critical', label: 'Critical — Immediate public safety risk', badge: '! Urgent Safety' },
];

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/jpg',
];

const DRAFT_STORAGE_KEY = 'nagarwatch_report_draft_text';

export default function ReportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form states
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [severity, setSeverity] = useState<string>('medium');
  const [description, setDescription] = useState<string>('');

  // Location state
  const [location, setLocation] = useState<LocationData | null>(null);
  const [extractingExif, setExtractingExif] = useState(false);

  // Status & error states
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<{
    file?: string;
    description?: string;
    location?: string;
    general?: string;
  }>({});
  const [submissionSuccess, setSubmissionSuccess] = useState<{
    incidentId: string;
    wardName?: string;
    category?: string;
    coordinates?: string;
    imageUrl?: string;
    rawLat?: number;
    rawLon?: number;
  } | null>(null);

  // Duplicate modal state
  const [duplicateIssue, setDuplicateIssue] = useState<any | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  // Draft Preservation: Load text fields from sessionStorage
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.category && CATEGORIES.includes(data.category)) setCategory(data.category);
        if (data.severity) setSeverity(data.severity);
        if (typeof data.description === 'string') setDescription(data.description);
      }
    } catch {
      // sessionStorage unavailable or corrupted
    }
  }, []);

  // Draft Preservation: Persist text fields only (never store photo in storage)
  useEffect(() => {
    try {
      if (category || severity || description) {
        sessionStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({ category, severity, description })
        );
      }
    } catch {
      // Ignored
    }
  }, [category, severity, description]);

  // Core file validation & processing for camera, gallery, or drop
  const processSelectedFile = async (selectedFile?: File | null) => {
    if (!selectedFile) return;

    // Reset previous file error
    setFormErrors((prev) => ({ ...prev, file: undefined, general: undefined }));

    // File type validation (JPEG, PNG, WebP, HEIC)
    if (
      !ALLOWED_MIME_TYPES.includes(selectedFile.type.toLowerCase()) &&
      !selectedFile.name.match(/\.(jpe?g|png|webp|heic)$/i)
    ) {
      setFormErrors((prev) => ({
        ...prev,
        file: 'Unsupported file type. Please upload a JPEG, PNG, or WebP photo.',
      }));
      return;
    }

    // File size validation (15MB limit)
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setFormErrors((prev) => ({
        ...prev,
        file: `File size exceeds 15MB limit (${(selectedFile.size / (1024 * 1024)).toFixed(1)}MB). Please choose a smaller image.`,
      }));
      return;
    }

    setPreview(URL.createObjectURL(selectedFile));
    setFile(selectedFile);

    // Attempt to extract GPS from photo EXIF metadata (Priority 1)
    setExtractingExif(true);
    try {
      const exifGps = await extractGpsFromExif(selectedFile);
      if (exifGps && isValidCoordinates(exifGps.lat, exifGps.lon)) {
        setLocation({
          lat: exifGps.lat,
          lon: exifGps.lon,
          source: 'exif',
        });
      } else {
        // Reset location only if it was tied to the previous photo's EXIF
        if (location?.source === 'exif') {
          setLocation(null);
        }
      }
    } finally {
      setExtractingExif(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await processSelectedFile(e.target.files?.[0]);
  };

  const handleClearFile = () => {
    setFile(null);
    setPreview(null);
    if (location?.source === 'exif') {
      setLocation(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  // Validate form fields prior to submission
  const validateForm = (): boolean => {
    const errors: typeof formErrors = {};

    if (!file) {
      errors.file = 'An evidence photo is required.';
    }

    if (!description.trim()) {
      errors.description = 'Please provide a short description of the issue.';
    } else if (description.trim().length < 5) {
      errors.description = 'Description must be at least 5 characters.';
    }

    if (!location || !isValidCoordinates(location.lat, location.lon)) {
      errors.location =
        'Incident location is required. Extract from photo, use device GPS, or pin on map.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submission handler
  const submitReport = async (forceNew: boolean = false) => {
    if (!validateForm()) return;
    if (!file || !location) return;

    setLoading(true);
    setFormErrors({});

    const formData = new FormData();
    formData.append('image', file);
    formData.append('category', category);
    formData.append('description', description.trim());
    formData.append('severity', severity);
    formData.append('force_new', forceNew ? 'true' : 'false');
    formData.append('latitude', location.lat.toString());
    formData.append('longitude', location.lon.toString());

    try {
      const response = await apiClient.post('/api/v1/report', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Handle duplicate detection returned with HTTP 200/status: "Duplicate"
      if (response.data?.status === 'Duplicate' && response.data?.existing_issue) {
        setDuplicateIssue(response.data.existing_issue);
        setLoading(false);
        return;
      }

      // Clear draft on successful filing
      try {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {}

      setSubmissionSuccess({
        incidentId: response.data?.incident_id || response.data?.complaint_id || 'Submitted',
        wardName: response.data?.routed_to_ward,
        category: response.data?.category || category,
        coordinates: location
          ? `${location.lat.toFixed(4)}°, ${location.lon.toFixed(4)}°`
          : undefined,
        imageUrl: response.data?.image_url || preview || undefined,
        rawLat: location?.lat,
        rawLon: location?.lon,
      });
    } catch (err: any) {
      const status = err.response?.status;
      const responseData = err.response?.data;

      // Duplicate detected by PostGIS 20m spatial check (HTTP 409)
      if (status === 409 && responseData?.existing_issue) {
        setDuplicateIssue(responseData.existing_issue);
        setLoading(false);
        return;
      }

      if (err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout')) {
        setFormErrors({
          general:
            'Request timed out. If the backend is waking up from sleep on Render, please wait a moment and submit again.',
        });
      } else if (status === 401) {
        setFormErrors({
          general: 'Your session has expired. Please log in again before submitting a report.',
        });
      } else if (status === 413) {
        setFormErrors({
          file: 'Uploaded image file exceeds the maximum allowed upload size (15MB).',
        });
      } else if (status === 400) {
        setFormErrors({
          general:
            responseData?.reason ||
            responseData?.message ||
            responseData?.error ||
            'Invalid report payload. Please verify your fields.',
        });
      } else if (err.code === 'ERR_NETWORK') {
        setFormErrors({
          general:
            'Cannot connect to NagarWatch server. Please check your network connection.',
        });
      } else {
        setFormErrors({
          general: responseData?.message || 'Failed to submit report. Please try again.',
        });
      }
    } finally {
      if (!duplicateIssue) setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitReport(false);
  };

  // Duplicate handler: confirm same issue (votes/verifies the existing issue)
  const handleConfirmSame = async () => {
    if (!duplicateIssue) return;
    setIsVoting(true);
    try {
      await apiClient.post(`/api/v1/incidents/${duplicateIssue.id}/verifications`, {
        type: 'confirm',
      });
      setDuplicateIssue(null);
      try {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {}
      setSubmissionSuccess({
        incidentId: duplicateIssue.id,
        wardName: duplicateIssue.ward_id ? `Ward #${duplicateIssue.ward_id}` : undefined,
        category: duplicateIssue.category || category,
        coordinates:
          duplicateIssue.latitude && duplicateIssue.longitude
            ? `${Number(duplicateIssue.latitude).toFixed(4)}°, ${Number(duplicateIssue.longitude).toFixed(4)}°`
            : location
            ? `${location.lat.toFixed(4)}°, ${location.lon.toFixed(4)}°`
            : undefined,
        imageUrl: duplicateIssue.image_url,
      });
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 409) {
        // User already voted on this issue
        setDuplicateIssue(null);
        setSubmissionSuccess({
          incidentId: duplicateIssue.id,
          wardName: duplicateIssue.ward_id ? `Ward #${duplicateIssue.ward_id}` : undefined,
          category: duplicateIssue.category || category,
          coordinates:
            duplicateIssue.latitude && duplicateIssue.longitude
              ? `${Number(duplicateIssue.latitude).toFixed(4)}°, ${Number(duplicateIssue.longitude).toFixed(4)}°`
              : location
              ? `${location.lat.toFixed(4)}°, ${location.lon.toFixed(4)}°`
              : undefined,
        });
      } else if (status === 401) {
        alert('Your session has expired. Please log in again to verify this report.');
      } else {
        alert('Failed to register verification. Please try again.');
      }
    } finally {
      setIsVoting(false);
    }
  };

  // Duplicate handler: confirm different issue (forces new report creation)
  const handleConfirmDifferent = () => {
    setDuplicateIssue(null);
    submitReport(true);
  };

  const handleResetForm = () => {
    setSubmissionSuccess(null);
    setFile(null);
    setPreview(null);
    setLocation(null);
    setDescription('');
    setCategory(CATEGORIES[0]);
    setSeverity('medium');
    setFormErrors({});
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {}
  };

  // ─── Considered Success State (Official Filing Receipt) ─────────────────────
  if (submissionSuccess) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 font-sans antialiased">
        <div className="bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] rounded-sm p-6 sm:p-10 shadow-xs space-y-6">
          {/* Official Seal / Icon */}
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle className="w-9 h-9" />
          </div>

          {/* Heading */}
          <div className="space-y-1.5 text-center">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#D9381E] dark:text-[#F05030] font-semibold bg-[#D9381E]/10 dark:bg-[#F05030]/20 border border-[#D9381E]/20 dark:border-[#F05030]/30 px-2 py-0.5 rounded-xs inline-block">
              Authoritative Municipal Filing
            </span>
            <h1 className="text-2xl sm:text-3xl font-mono font-bold text-[#1C1917] dark:text-[#F4F4F5] tracking-tight">
              Report Submitted Successfully
            </h1>
            <p className="text-xs sm:text-sm text-[#78716C] dark:text-[#A1A1AA] max-w-md mx-auto leading-relaxed">
              Your civic hazard has been routed to the local ward operations console and logged in public municipal records.
            </p>
          </div>

          {/* Dossier Receipt Card */}
          <div className="p-5 rounded-sm bg-[#F4F1EA] dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E0D4] dark:border-[#333338]">
              <span className="text-[#78716C] dark:text-[#A1A1AA] uppercase text-[11px] tracking-wider">Complaint ID</span>
              <span className="font-bold text-[#1C1917] dark:text-[#F4F4F5] tracking-tight select-all">
                {submissionSuccess.incidentId}
              </span>
            </div>

            {submissionSuccess.wardName && (
              <div className="flex items-center justify-between pb-2 border-b border-[#E5E0D4] dark:border-[#333338]">
                <span className="text-[#78716C] dark:text-[#A1A1AA] uppercase text-[11px] tracking-wider">Routed Jurisdiction</span>
                <span className="font-semibold text-[#1C1917] dark:text-[#F4F4F5]">
                  {submissionSuccess.wardName}
                </span>
              </div>
            )}

            {submissionSuccess.category && (
              <div className="flex items-center justify-between pb-2 border-b border-[#E5E0D4] dark:border-[#333338]">
                <span className="text-[#78716C] dark:text-[#A1A1AA] uppercase text-[11px] tracking-wider">Classification</span>
                <span className="font-medium text-[#1C1917] dark:text-[#F4F4F5]">
                  {submissionSuccess.category}
                </span>
              </div>
            )}

            {submissionSuccess.coordinates && (
              <div className="flex items-center justify-between pb-2 border-b border-[#E5E0D4] dark:border-[#333338]">
                <span className="text-[#78716C] dark:text-[#A1A1AA] uppercase text-[11px] tracking-wider">Coordinates</span>
                <span className="font-medium text-[#1C1917] dark:text-[#F4F4F5]">
                  {submissionSuccess.coordinates}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-[#78716C] dark:text-[#A1A1AA] uppercase text-[11px] tracking-wider">Lifecycle Status</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[11px] font-semibold bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-600 dark:bg-sky-400" />
                Reported
              </span>
            </div>
          </div>

          {/* Photo Evidence Thumbnail if Present */}
          {submissionSuccess.imageUrl && (
            <div className="rounded-sm overflow-hidden border border-[#E5E0D4] dark:border-[#333338] max-h-48 bg-[#F4F1EA] dark:bg-[#18181B]">
              <img
                src={submissionSuccess.imageUrl}
                alt="Filing evidence"
                className="w-full h-44 object-cover"
              />
            </div>
          )}

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link to="/my-reports" className="w-full sm:w-auto">
              <button
                type="button"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-sm bg-[#D9381E] hover:bg-[#B92B15] dark:bg-[#F05030] dark:hover:bg-[#D9381E] text-white text-xs font-mono font-medium transition-colors shadow-xs cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>View in My Reports</span>
              </button>
            </Link>

            <Link
              to={
                submissionSuccess.rawLat && submissionSuccess.rawLon
                  ? `/explore?lat=${submissionSuccess.rawLat.toFixed(6)}&lon=${submissionSuccess.rawLon.toFixed(6)}`
                  : '/explore'
              }
              className="w-full sm:w-auto"
            >
              <button
                type="button"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-sm bg-[#1C1917] hover:bg-[#33302B] dark:bg-[#F4F4F5] dark:text-[#18181B] dark:hover:bg-[#E4E4E7] text-white text-xs font-mono font-medium transition-colors shadow-xs cursor-pointer"
              >
                <Compass className="w-4 h-4 text-[#D9381E] dark:text-[#F05030]" />
                <span>Explore Nearby Incidents</span>
              </button>
            </Link>

            <button
              type="button"
              onClick={handleResetForm}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-sm bg-[#F4F1EA] dark:bg-[#18181B] hover:bg-[#EAE5D9] dark:hover:bg-[#2B2B30] text-[#1C1917] dark:text-[#F4F4F5] border border-[#E5E0D4] dark:border-[#333338] text-xs font-mono font-medium transition-colors cursor-pointer"
            >
              Report Another Issue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Immersive Multi-Step Intake Flow ──────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 font-sans text-[#1C1917] dark:text-[#F4F4F5] antialiased">
      {/* ─── Masthead ──────────────────────────────────────────────────────── */}
      <div className="pb-6 mb-8 border-b border-[#E5E0D4] dark:border-[#333338] flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#D9381E] dark:text-[#F05030] font-semibold bg-[#D9381E]/10 dark:bg-[#F05030]/20 border border-[#D9381E]/20 dark:border-[#F05030]/30 px-1.5 py-0.5 rounded-xs">
              Municipal Intake
            </span>
            <span className="text-[11px] font-mono text-[#78716C] dark:text-[#A1A1AA]">•</span>
            <span className="text-[11px] font-mono text-[#78716C] dark:text-[#A1A1AA]">
              Ward-Routed Dispatch
            </span>
            <span className="text-[11px] font-mono text-[#78716C] dark:text-[#A1A1AA]">•</span>
            <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
              Draft Auto-Saved
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-mono font-bold text-[#1C1917] dark:text-[#F4F4F5] tracking-tight">
            Report a Civic Hazard
          </h1>
          <p className="text-xs sm:text-sm text-[#78716C] dark:text-[#A1A1AA] mt-1 max-w-2xl leading-relaxed">
            Submit local infrastructure defects or public hazards directly to municipal authorities. Every submission is geocoded, checked for duplicates, and dispatched to ward crews.
          </p>
        </div>

        {/* Multi-Step Indicator */}
        <div className="flex items-center gap-2 text-[11px] font-mono text-[#78716C] dark:text-[#A1A1AA] shrink-0">
          <span className="px-2 py-0.5 rounded-xs bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] text-[#D9381E] dark:text-[#F05030] font-bold">
            Step 1–4
          </span>
          <span>Unified Intake Dossier</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ─── Left Column: Guided Dossier Sections (7 cols) ──────────────── */}
          <div className="lg:col-span-7 space-y-8">
            {/* ── Section 1: Geographic Location ── */}
            <section className="bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] rounded-sm p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#E5E0D4] dark:border-[#333338]">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-xs bg-[#1C1917] dark:bg-[#F4F4F5] text-[#FBF9F4] dark:text-[#18181B] text-xs font-mono font-bold flex items-center justify-center">
                    01
                  </span>
                  <div>
                    <h2 className="text-base font-mono font-bold text-[#1C1917] dark:text-[#F4F4F5]">
                      Incident Location & Sector
                    </h2>
                    <p className="text-[11px] text-[#78716C] dark:text-[#A1A1AA]">
                      Coordinates detected from camera metadata, device GPS, or interactive map.
                    </p>
                  </div>
                </div>
                {location && (
                  <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-xs">
                    ✓ Verified
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <LocationPicker
                  location={location}
                  onChange={(newLoc) => {
                    setLocation(newLoc);
                    if (formErrors.location) {
                      setFormErrors((prev) => ({ ...prev, location: undefined }));
                    }
                  }}
                  hasExif={location?.source === 'exif'}
                />

                {extractingExif && (
                  <p className="text-xs font-mono text-[#D9381E] dark:text-[#F05030] flex items-center gap-1.5 animate-pulse">
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    Reading photo GPS metadata...
                  </p>
                )}

                {formErrors.location && (
                  <p className="text-xs text-[#991B1B] dark:text-red-400 font-mono flex items-center gap-1 pt-1" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {formErrors.location}
                  </p>
                )}
              </div>
            </section>

            {/* ── Section 2: Defect Classification & Urgency ── */}
            <section className="bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] rounded-sm p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E5E0D4] dark:border-[#333338]">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-xs bg-[#1C1917] dark:bg-[#F4F4F5] text-[#FBF9F4] dark:text-[#18181B] text-xs font-mono font-bold flex items-center justify-center">
                    02
                  </span>
                  <div>
                    <h2 className="text-base font-mono font-bold text-[#1C1917] dark:text-[#F4F4F5]">
                      Defect Classification & Urgency
                    </h2>
                    <p className="text-[11px] text-[#78716C] dark:text-[#A1A1AA]">
                      Classify the nature of the issue and provide specific municipal details.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                {/* Category Select */}
                <div>
                  <label
                    htmlFor="incident-category-select"
                    className="block text-xs font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA] font-semibold mb-1.5"
                  >
                    Incident Category <span className="text-[#D9381E] dark:text-[#F05030]">*</span>
                  </label>
                  <select
                    id="incident-category-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#F4F1EA] dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] rounded-sm px-3 py-2 text-xs font-sans text-[#1C1917] dark:text-[#F4F4F5] focus:outline-none focus:border-[#D9381E] dark:focus:border-[#F05030] transition-colors"
                  >
                    {CIVIC_CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label} ({cat.value})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-[#78716C] dark:text-[#A1A1AA] mt-1">
                    Choose the category that best matches the civic hazard or defect.
                  </p>
                </div>

                {/* Severity Level */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA] font-semibold mb-1.5">
                    Urgency / Severity Level
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SEVERITY_OPTIONS.map((opt) => {
                      const isSelected = severity === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setSeverity(opt.value)}
                          className={`p-2.5 rounded-sm border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#1C1917] dark:bg-[#F4F4F5] text-[#FBF9F4] dark:text-[#18181B] border-[#1C1917] dark:border-[#F4F4F5] shadow-xs'
                              : 'bg-[#F4F1EA] dark:bg-[#18181B] text-[#57534E] dark:text-[#A1A1AA] border-[#E5E0D4] dark:border-[#333338] hover:border-[#D9381E] dark:hover:border-[#F05030]'
                          }`}
                        >
                          <span className="block text-[10px] font-mono uppercase font-bold tracking-wider">
                            {opt.badge}
                          </span>
                          <span className="block text-[11px] truncate mt-0.5 opacity-90">
                            {opt.value.toUpperCase()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-[#78716C] dark:text-[#A1A1AA] mt-1">
                    Indicate urgency to calibrate municipal response prioritization.
                  </p>
                </div>

                {/* Description Textarea */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="incident-description"
                      className="block text-xs font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA] font-semibold"
                    >
                      Description <span className="text-[#D9381E] dark:text-[#F05030]">*</span>
                    </label>
                    <span className="text-[10px] font-mono text-[#78716C] dark:text-[#A1A1AA]">
                      {description.length} characters
                    </span>
                  </div>
                  <textarea
                    id="incident-description"
                    aria-label="Description"
                    rows={4}
                    required
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      if (formErrors.description) {
                        setFormErrors((prev) => ({ ...prev, description: undefined }));
                      }
                    }}
                    placeholder="Provide specific details about the issue (e.g. landmark, lane, or safety hazard)..."
                    className={`w-full bg-[#F4F1EA] dark:bg-[#18181B] border rounded-sm p-3 text-xs font-sans text-[#1C1917] dark:text-[#F4F4F5] placeholder:text-[#A8A29E] focus:outline-none transition-colors ${
                      formErrors.description
                        ? 'border-[#991B1B] bg-red-50/20'
                        : 'border-[#E5E0D4] dark:border-[#333338] focus:border-[#D9381E] dark:focus:border-[#F05030]'
                    }`}
                  />
                  {formErrors.description && (
                    <p className="text-xs text-[#991B1B] dark:text-red-400 font-mono flex items-center gap-1 mt-1" role="alert">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {formErrors.description}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* ── Section 3: Evidence Image Upload ── */}
            <section className="bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] rounded-sm p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#E5E0D4] dark:border-[#333338]">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-xs bg-[#1C1917] dark:bg-[#F4F4F5] text-[#FBF9F4] dark:text-[#18181B] text-xs font-mono font-bold flex items-center justify-center">
                    03
                  </span>
                  <div>
                    <h2 className="text-base font-mono font-bold text-[#1C1917] dark:text-[#F4F4F5]">
                      Photographic Evidence
                    </h2>
                    <p className="text-[11px] text-[#78716C] dark:text-[#A1A1AA]">
                      Upload a photo of the issue. Camera photos automatically embed GPS metadata.
                    </p>
                  </div>
                </div>
                {file && (
                  <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-xs">
                    ✓ Attached
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {/* Standard file input (preserved for tests and fallback) */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg,image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="evidence-file-input"
                />

                {/* Option 1: Mobile Camera (Direct Capture) */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                  id="evidence-camera-input"
                />

                {/* Option 2: Device Gallery / Library */}
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={handleFileChange}
                  className="hidden"
                  id="evidence-gallery-input"
                />

                {!preview ? (
                  <div className="space-y-3">
                    {/* Drag-and-drop zone for Desktop + Mobile Dual Selectors */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        const dropped = e.dataTransfer.files?.[0];
                        if (dropped) processSelectedFile(dropped);
                      }}
                      className={`border-2 border-dashed rounded-sm p-5 sm:p-7 text-center transition-all ${
                        isDragging
                          ? 'border-[#D9381E] dark:border-[#F05030] bg-[#D9381E]/5 dark:bg-[#F05030]/10'
                          : formErrors.file
                          ? 'border-[#991B1B] bg-red-50/20 dark:bg-red-950/20'
                          : 'border-[#E5E0D4] dark:border-[#333338] bg-[#F4F1EA]/60 dark:bg-[#18181B]/60 hover:border-[#D9381E]/50'
                      }`}
                    >
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="w-11 h-11 rounded-sm bg-[#D9381E]/10 dark:bg-[#F05030]/20 text-[#D9381E] dark:text-[#F05030] border border-[#D9381E]/20 dark:border-[#F05030]/30 flex items-center justify-center mx-auto mb-1">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-mono font-semibold uppercase tracking-wider text-[#1C1917] dark:text-[#F4F4F5]">
                            Attach Photographic Evidence
                          </p>
                          <p className="text-[11px] text-[#78716C] dark:text-[#A1A1AA] mt-0.5">
                            Take a new live photo or pick an existing image from your device gallery.
                          </p>
                        </div>

                        {/* Dual Action Buttons (Min 44px Touch Targets) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1.5">
                          {/* Option 1: Live Camera */}
                          <button
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-sm bg-[#D9381E] hover:bg-[#B82810] dark:bg-[#F05030] dark:hover:bg-[#D9381E] text-white text-xs font-mono font-semibold transition-all shadow-xs cursor-pointer min-h-[44px]"
                          >
                            <Camera className="w-4 h-4" />
                            <span>Take a Photo</span>
                          </button>

                          {/* Option 2: Gallery Selection */}
                          <button
                            type="button"
                            onClick={() => galleryInputRef.current?.click()}
                            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-sm bg-[#FBF9F4] dark:bg-[#222226] hover:bg-[#EAE5D9] dark:hover:bg-[#2B2B30] text-[#1C1917] dark:text-[#F4F4F5] border border-[#E5E0D4] dark:border-[#333338] text-xs font-mono font-semibold transition-all cursor-pointer min-h-[44px]"
                          >
                            <ImageIcon className="w-4 h-4 text-[#D9381E] dark:text-[#F05030]" />
                            <span>Choose from Gallery</span>
                          </button>
                        </div>

                        <p className="text-[10px] font-mono text-[#78716C] dark:text-[#A1A1AA] pt-1">
                          Supported formats: JPEG, PNG, WebP • Maximum 15MB
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative rounded-sm overflow-hidden border border-[#E5E0D4] dark:border-[#333338] bg-[#F4F1EA] dark:bg-[#18181B] aspect-video">
                    <img
                      src={preview}
                      alt="Evidence preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-3 flex items-center justify-between text-white text-xs font-mono">
                      <span className="truncate max-w-[220px]">
                        {file?.name || 'Evidence Image'}
                      </span>
                      <span className="shrink-0 bg-black/40 px-2 py-0.5 rounded-xs border border-white/20">
                        {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearFile}
                      aria-label="Remove photo"
                      className="absolute top-2.5 right-2.5 p-2 rounded-xs bg-[#1C1917]/85 hover:bg-[#1C1917] text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shadow-md"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {formErrors.file && (
                  <p className="text-xs text-[#991B1B] dark:text-red-400 font-mono flex items-center gap-1" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {formErrors.file}
                  </p>
                )}
              </div>
            </section>

            {/* ── Section 4: Review & Municipal Dispatch ── */}
            <section className="bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] rounded-sm p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E5E0D4] dark:border-[#333338]">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-xs bg-[#1C1917] dark:bg-[#F4F4F5] text-[#FBF9F4] dark:text-[#18181B] text-xs font-mono font-bold flex items-center justify-center">
                    04
                  </span>
                  <div>
                    <h2 className="text-base font-mono font-bold text-[#1C1917] dark:text-[#F4F4F5]">
                      Review & Municipal Dispatch
                    </h2>
                    <p className="text-[11px] text-[#78716C] dark:text-[#A1A1AA]">
                      Verify information before committing to municipal work orders.
                    </p>
                  </div>
                </div>
              </div>

              {/* General Form Error Message */}
              {formErrors.general && (
                <div className="p-3.5 rounded-sm bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-[#991B1B] dark:text-red-400 text-xs font-mono flex items-start gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 text-[#991B1B] dark:text-red-400 shrink-0 mt-0.5" />
                  <p>{formErrors.general}</p>
                </div>
              )}

              <div className="space-y-4">
                <div className="p-3.5 rounded-sm bg-[#F4F1EA] dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] flex items-center gap-3 text-xs text-[#57534E] dark:text-[#A1A1AA]">
                  <ShieldCheck className="w-5 h-5 text-[#D9381E] dark:text-[#F05030] shrink-0" />
                  <p className="text-[11px] leading-relaxed">
                    By submitting, this report is cryptographically logged and routed to the assigned ward console. Falsified or abusive filings violate civic terms.
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={loading}
                  fullWidth
                  leftIcon={<Camera className="w-4 h-4" />}
                >
                  Submit Incident Report
                </Button>
                <p className="text-center text-[11px] font-mono text-[#78716C] dark:text-[#A1A1AA]">
                  Transmitting authoritative report to municipal operations
                </p>
              </div>
            </section>
          </div>

          {/* ─── Right Column: Persistent Dossier & Live Sector Preview (5 cols) ── */}
          <div className="hidden lg:block lg:col-span-5 sticky top-20 space-y-4 font-sans">
            <div className="bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] rounded-sm p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E0D4] dark:border-[#333338]">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#78716C] dark:text-[#A1A1AA] font-semibold flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#D9381E] dark:text-[#F05030]" />
                  Filing Dossier Preview
                </span>
                <span className="text-[10px] font-mono text-[#D9381E] dark:text-[#F05030] bg-[#D9381E]/10 dark:bg-[#F05030]/20 border border-[#D9381E]/20 dark:border-[#F05030]/30 px-1.5 py-0.5 rounded-xs">
                  Live Intake
                </span>
              </div>

              {/* Live Preview Specs */}
              <div className="space-y-3 font-mono text-xs">
                {/* Category & Severity */}
                <div className="flex items-center justify-between">
                  <span className="text-[#78716C] dark:text-[#A1A1AA] uppercase text-[10px]">Classification:</span>
                  <span className="font-semibold text-[#1C1917] dark:text-[#F4F4F5]">{category}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#78716C] dark:text-[#A1A1AA] uppercase text-[10px]">Severity Level:</span>
                  <span className="font-semibold capitalize text-[#1C1917] dark:text-[#F4F4F5]">{severity}</span>
                </div>

                {/* Coordinates */}
                <div className="flex items-center justify-between">
                  <span className="text-[#78716C] dark:text-[#A1A1AA] uppercase text-[10px]">Target Coordinates:</span>
                  <span className="font-semibold text-[#1C1917] dark:text-[#F4F4F5]">
                    {location
                      ? `${location.lat.toFixed(4)}°, ${location.lon.toFixed(4)}°`
                      : 'Not Selected'}
                  </span>
                </div>

                {/* Evidence Photo Preview */}
                <div className="pt-2 border-t border-[#E5E0D4] dark:border-[#333338]">
                  <span className="block text-[#78716C] dark:text-[#A1A1AA] uppercase text-[10px] mb-1.5">
                    Evidence Attached:
                  </span>
                  {preview ? (
                    <div className="w-full h-32 rounded-sm overflow-hidden border border-[#E5E0D4] dark:border-[#333338] bg-[#F4F1EA] dark:bg-[#18181B]">
                      <img src={preview} alt="Attached" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full h-24 rounded-sm border border-dashed border-[#E5E0D4] dark:border-[#333338] bg-[#F4F1EA] dark:bg-[#18181B] flex flex-col items-center justify-center text-[#78716C] dark:text-[#A1A1AA] text-[11px]">
                      <Camera className="w-5 h-5 mb-1 text-[#A8A29E] dark:text-[#78716C]" />
                      <span>No photo selected</span>
                    </div>
                  )}
                </div>

                {/* Description Excerpt */}
                <div className="pt-2 border-t border-[#E5E0D4] dark:border-[#333338]">
                  <span className="block text-[#78716C] dark:text-[#A1A1AA] uppercase text-[10px] mb-1">
                    Description Excerpt:
                  </span>
                  <p className="text-[11px] font-sans text-[#57534E] dark:text-[#A1A1AA] italic line-clamp-3">
                    {description.trim() ? `«${description.trim()}»` : 'No description entered yet.'}
                  </p>
                </div>
              </div>

              {/* Informational Guidance */}
              <div className="pt-3 border-t border-[#E5E0D4] dark:border-[#333338] text-[11px] text-[#78716C] dark:text-[#A1A1AA] leading-relaxed">
                <p>
                  Municipal crews verify duplicate reports within a 20-meter radius automatically using PostGIS spatial indexing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Duplicate Incident Resolution Modal */}
      {duplicateIssue && (
        <IssueDetailsModal
          issue={duplicateIssue}
          onClose={() => setDuplicateIssue(null)}
          duplicateMode={true}
          onConfirmSame={handleConfirmSame}
          onConfirmDifferent={handleConfirmDifferent}
          isVoting={isVoting}
        />
      )}
    </div>
  );
}
