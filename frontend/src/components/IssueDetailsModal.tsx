import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Hash,
  MapPin,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  PlusCircle,
  AlertTriangle,
  Check,
  ShieldCheck,
  CheckCircle2,
  Image as ImageIcon,
  Compass,
  Clock,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Modal } from './ui/Modal';
import { StatusBadge } from './ui/StatusBadge';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useAuth } from '../context/AuthContext';
import apiClient from '../lib/apiClient';

export interface IssueMediaItem {
  id?: string;
  media_type: string;
  media_url: string;
  has_exif_gps?: boolean;
  is_resolution_proof?: boolean;
}

export interface StatusHistoryItem {
  old_status?: string | null;
  new_status: string;
  notes?: string | null;
  proof_media_url?: string | null;
  created_at: string;
}

export interface IssueDetailsModalProps {
  issue: {
    id: string;
    category: string;
    description: string;
    status: string;
    image_url: string;
    created_at: string;
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
    media?: IssueMediaItem[];
    status_history?: StatusHistoryItem[];
  } | null;
  onClose: () => void;
  duplicateMode?: boolean;
  onConfirmSame?: () => void;
  onConfirmDifferent?: () => void;
  onLocateOnMap?: (lat: number, lon: number) => void;
  isVoting?: boolean;
}

export default function IssueDetailsModal({
  issue,
  onClose,
  duplicateMode = false,
  onConfirmSame,
  onConfirmDifferent,
  onLocateOnMap,
  isVoting = false,
}: IssueDetailsModalProps) {
  const { user } = useAuth();
  const [copiedId, setCopiedId] = useState(false);
  const [upvotesCount, setUpvotesCount] = useState<number>(0);
  const [disputesCount, setDisputesCount] = useState<number>(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [hasDisputed, setHasDisputed] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  // Enriched detail state from backend
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [mediaGallery, setMediaGallery] = useState<IssueMediaItem[]>([]);
  const [severityLevel, setSeverityLevel] = useState<string>('medium');
  const [wardLabel, setWardLabel] = useState<string>('');

  useEffect(() => {
    if (!issue) return;

    setUpvotesCount(issue.upvotes ?? issue.confirmations_count ?? 0);
    setDisputesCount(issue.disputes_count ?? 0);
    setSeverityLevel(issue.severity || 'medium');
    setWardLabel(issue.ward_name || (issue.ward_id ? `Ward #${issue.ward_id}` : 'Unassigned Ward'));
    setHasVoted(false);
    setHasDisputed(false);
    setVoteError(null);

    if (issue.status_history) {
      setStatusHistory(issue.status_history);
    }
    if (issue.media) {
      setMediaGallery(issue.media);
    }

    // If detail history isn't loaded yet, fetch from canonical /api/v1/incidents/:id or /api/v1/incidents/me/:id
    if (!duplicateMode && (!issue.status_history || !issue.media)) {
      apiClient
        .get(`/api/v1/incidents/${issue.id}`)
        .then((res) => {
          const d = res.data?.data;
          if (d) {
            if (Array.isArray(d.status_history)) setStatusHistory(d.status_history);
            if (Array.isArray(d.media)) setMediaGallery(d.media);
            if (d.ward_name) setWardLabel(d.ward_name);
            if (d.severity) setSeverityLevel(d.severity);
            if (d.disputes_count !== undefined) setDisputesCount(d.disputes_count);
            if (d.confirmations_count !== undefined) setUpvotesCount(d.confirmations_count);
          }
        })
        .catch(() => {
          // If rejected or personal private report, try authenticated /api/v1/incidents/me/:id
          apiClient
            .get(`/api/v1/incidents/me/${issue.id}`)
            .then((res) => {
              const d = res.data?.data;
              if (d) {
                if (Array.isArray(d.status_history)) setStatusHistory(d.status_history);
                if (Array.isArray(d.media)) setMediaGallery(d.media);
                if (d.ward_name) setWardLabel(d.ward_name);
                if (d.severity) setSeverityLevel(d.severity);
                if (d.disputes_count !== undefined) setDisputesCount(d.disputes_count);
                if (d.confirmations_count !== undefined) setUpvotesCount(d.confirmations_count);
              }
            })
            .catch(() => {
              // Non-blocking fallback
            });
        });
    }
  }, [issue, duplicateMode]);

  if (!issue) return null;

  const handleCopyId = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(issue.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleVerification = async (type: 'confirm' | 'dispute') => {
    if (!user) {
      setVoteError('Please sign in to verify or dispute this incident.');
      return;
    }
    if (hasVoted || hasDisputed) return;

    setIsVerifying(true);
    setVoteError(null);
    try {
      await apiClient.post(`/api/v1/incidents/${issue.id}/verifications`, { type });
      if (type === 'confirm') {
        setUpvotesCount((prev) => prev + 1);
        setHasVoted(true);
      } else {
        setDisputesCount((prev) => prev + 1);
        setHasDisputed(true);
      }
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 409) {
        setHasVoted(true);
        setVoteError('You have already submitted verification for this incident.');
      } else if (status === 401) {
        setVoteError('Your session expired. Please log in again.');
      } else {
        setVoteError('Failed to record verification. Please try again.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const formattedDate = issue.created_at
    ? new Date(issue.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Unknown date';

  const modalTitle = duplicateMode ? 'Similar Issue Nearby' : issue.category;
  const modalDescription = duplicateMode
    ? 'A matching incident was recently reported near your selected location.'
    : `Reported on ${formattedDate}`;

  return (
    <Modal
      isOpen={Boolean(issue)}
      onClose={onClose}
      title={modalTitle}
      description={modalDescription}
      size="lg"
      footer={
        duplicateMode && onConfirmSame && onConfirmDifferent ? (
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Button
              variant="primary"
              isLoading={isVoting}
              leftIcon={<ThumbsUp className="w-4 h-4" />}
              onClick={onConfirmSame}
              fullWidth
            >
              Yes, it's the same
            </Button>
            <Button
              variant="outline"
              leftIcon={<PlusCircle className="w-4 h-4" />}
              onClick={onConfirmDifferent}
              fullWidth
            >
              No, report as new
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-slate-400 font-mono">
              Complaint #{issue.id.slice(0, 8)}
            </span>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-5">
        {/* Duplicate Prompt Banner */}
        {duplicateMode && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
            <div className="text-sm leading-relaxed">
              <p className="font-semibold text-amber-950">
                Someone recently reported a {issue.category} here.
              </p>
              <p className="mt-1 text-amber-800">
                Confirming helps municipal crews prioritize this location and avoids duplicate dispatches.
              </p>
            </div>
          </div>
        )}

        {/* Primary Evidence Photo */}
        {issue.image_url ? (
          <div className="relative w-full aspect-video sm:aspect-2/1 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-2xs">
            <img
              src={issue.image_url}
              alt={issue.category}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <StatusBadge status={issue.status} size="sm" />
              {severityLevel && (
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    severityLevel === 'critical'
                      ? 'bg-red-600 text-white'
                      : severityLevel === 'high'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-white'
                  }`}
                >
                  {severityLevel}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2">
              <StatusBadge status={issue.status} size="sm" />
              <Badge variant="neutral" size="sm">
                {issue.category}
              </Badge>
            </div>
            {severityLevel && (
              <span className="text-xs font-semibold text-slate-500 uppercase">
                Severity: {severityLevel}
              </span>
            )}
          </div>
        )}

        {/* Additional Media Gallery if multiple photos uploaded */}
        {mediaGallery.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-slate-500 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              All Evidence Photos ({mediaGallery.length})
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {mediaGallery.map((m, idx) => (
                <a
                  key={idx}
                  href={m.media_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block relative aspect-square rounded-lg overflow-hidden border border-slate-200 hover:opacity-90 transition-opacity bg-slate-100"
                >
                  <img src={m.media_url} alt="Evidence" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Issue Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Description
          </label>
          <p className="text-sm text-slate-800 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            {issue.description || 'No detailed description provided.'}
          </p>
        </div>

        {/* Community Verification & Dispute Bar */}
        {!duplicateMode && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1.5 text-blue-700 font-semibold">
                <ThumbsUp className="w-4 h-4 text-blue-600" />
                {upvotesCount} {upvotesCount === 1 ? 'neighbour has verified this' : 'neighbours have verified this'}
              </span>
              {disputesCount > 0 && (
                <span className="flex items-center gap-1.5 text-rose-700">
                  <ThumbsDown className="w-4 h-4 text-rose-600" />
                  {disputesCount} {disputesCount === 1 ? 'Dispute' : 'Disputes'}
                </span>
              )}
            </div>

            {issue.status.toLowerCase() !== 'resolved' && issue.status.toLowerCase() !== 'closed' && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={hasVoted || isVerifying}
                  onClick={() => handleVerification('confirm')}
                  leftIcon={<ThumbsUp className="w-3.5 h-3.5" />}
                  className={hasVoted ? 'bg-blue-50 text-blue-800 border-blue-200' : 'hover:bg-blue-50 text-blue-700'}
                >
                  {hasVoted ? 'Verified' : 'Verify Issue'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={hasDisputed || isVerifying}
                  onClick={() => handleVerification('dispute')}
                  leftIcon={<ThumbsDown className="w-3.5 h-3.5" />}
                  className={hasDisputed ? 'bg-rose-50 text-rose-800 border-rose-200' : 'hover:bg-rose-50 text-rose-700'}
                >
                  {hasDisputed ? 'Disputed' : 'Dispute'}
                </Button>
              </div>
            )}
          </div>
        )}

        {voteError && (
          <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
            {voteError}
          </p>
        )}

        {/* Official Resolution Details (if resolved or resolution notes exist) */}
        {!duplicateMode &&
          (issue.status.toLowerCase() === 'resolved' ||
            issue.status.toLowerCase() === 'closed' ||
            issue.resolution_notes ||
            issue.proof_media_url) && (
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="font-bold text-sm">Official Municipal Resolution</span>
                </div>
                {issue.resolved_at && (
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Resolved on {new Date(issue.resolved_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              {issue.resolution_notes ? (
                <div className="bg-white/80 p-3 rounded-lg border border-emerald-100 text-xs text-slate-700 leading-relaxed">
                  <p className="font-semibold text-emerald-950 mb-0.5">Municipal Notes:</p>
                  <p>{issue.resolution_notes}</p>
                </div>
              ) : (
                <p className="text-xs text-emerald-700">
                  This civic issue has been officially marked as resolved by municipal administration.
                </p>
              )}

              {issue.proof_media_url && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-semibold text-emerald-900 uppercase tracking-wider flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                    Resolution Evidence
                  </p>
                  <div className="relative aspect-video max-h-48 rounded-lg overflow-hidden border border-emerald-200 bg-slate-100">
                    <img
                      src={issue.proof_media_url}
                      alt="Resolution Evidence"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

        {/* Incident Lifecycle & Status History Timeline */}
        {!duplicateMode && (
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <p className="text-xs font-semibold uppercase text-slate-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Verified Status History
            </p>
            <div className="space-y-3 pl-2 border-l-2 border-blue-200 ml-1.5">
              {/* Initial Submission Event */}
              <div className="relative pl-3 text-xs text-slate-700 space-y-0.5">
                <div className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">
                    Report Submitted
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(issue.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-slate-500 text-[11px]">Initial civic hazard logged with GPS coordinates.</p>
              </div>

              {/* Recorded Status History from incident_updates */}
              {statusHistory.map((item, idx) => (
                <div key={idx} className="relative pl-3 text-xs text-slate-700 space-y-0.5">
                  <div className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-[#1E60D5] border-2 border-white" />
                  <div className="flex items-center gap-2">
                    <span className="font-semibold capitalize text-slate-900">
                      {item.old_status ? `${item.old_status} → ${item.new_status}` : item.new_status}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(item.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {item.notes && <p className="text-slate-600 italic">{item.notes}</p>}
                  {item.proof_media_url && (
                    <div className="mt-1 max-w-[200px] rounded-lg overflow-hidden border border-emerald-200">
                      <img src={item.proof_media_url} alt="Status evidence" className="w-full h-24 object-cover" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata Details Grid */}
        {!duplicateMode && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
            {/* Incident ID */}
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50/70 border border-slate-100">
              <Hash className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                  Incident ID
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-xs font-mono font-mono-id text-slate-800 truncate select-all">
                    {issue.id}
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    aria-label="Copy incident ID"
                    className="text-[10px] text-[#1E60D5] hover:text-blue-800 font-medium shrink-0 ml-1"
                  >
                    {copiedId ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            {/* Ward */}
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50/70 border border-slate-100">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                  Jurisdiction
                </p>
                <p className="text-xs font-medium text-slate-800 mt-0.5">{wardLabel}</p>
              </div>
            </div>

            {/* Location & External Map Actions */}
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50/70 border border-slate-100 sm:col-span-2">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    Geographic Location
                  </p>
                  {issue.latitude && issue.longitude ? (
                    <p className="text-xs font-mono font-mono-id text-slate-700 mt-0.5">
                      {issue.latitude}, {issue.longitude}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic mt-0.5">
                      No coordinates recorded
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-1 sm:mt-0 flex-wrap">
                  {onLocateOnMap && issue.latitude && issue.longitude && (
                    <button
                      type="button"
                      onClick={() => {
                        onLocateOnMap(Number(issue.latitude), Number(issue.longitude));
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-medium transition-colors"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>View on Live Map</span>
                    </button>
                  )}

                  {issue.latitude && issue.longitude && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${issue.latitude},${issue.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#1E60D5] hover:underline"
                    >
                      <span>View in Google Maps</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
