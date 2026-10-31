import React, { useEffect, useState } from 'react';
import apiClient from '../lib/apiClient';
import { Loader2, AlertCircle, MapPin, ExternalLink, CheckCircle, ThumbsUp } from 'lucide-react';
import IssueDetailsModal from '../components/IssueDetailsModal';

export interface AdminIssue {
  id: string;
  category: string;
  description: string;
  status: string;
  image_url: string;
  created_at: string;
  ward_id: string;
  latitude: number;
  longitude: number;
  upvotes: number;
  severity?: string;
}

const VALID_STATUSES = ['pending', 'reported', 'verified', 'assigned', 'in_progress', 'resolved', 'rejected', 'closed'];

export default function AdminIssues() {
  const [issues, setIssues] = useState<AdminIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<AdminIssue | null>(null);

  useEffect(() => {
    fetchIssues();
  }, []);

  const fetchIssues = async () => {
    setLoading(true);
    setError(null);
    try {
      // Bearer token is attached automatically by apiClient interceptor.
      // Do NOT pass user_id — identity is derived from the verified token server-side.
      const response = await apiClient.get('/api/v1/admin/incidents');
      const data = response.data?.data;
      setIssues(Array.isArray(data) ? data : []);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401) {
        setError('Your session has expired. Please log in again.');
      } else if (status === 403) {
        setError('Access denied. You do not have admin permissions to view this dashboard.');
      } else if (err.code === 'ERR_NETWORK') {
        setError('Cannot connect to the server. Please check your network.');
      } else {
        setError('Failed to load admin dashboard. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (issueId: string, newStatus: string) => {
    if (!VALID_STATUSES.includes(newStatus)) return;
    setUpdatingId(issueId);
    try {
      // Auth header attached automatically; no frontend-supplied user_id
      await apiClient.patch(`/api/v1/admin/incidents/${issueId}/status`, { status: newStatus });
      setIssues((prev) =>
        prev.map((issue) =>
          issue.id === issueId ? { ...issue, status: newStatus } : issue
        )
      );
      if (selectedIssue?.id === issueId) {
        setSelectedIssue({ ...selectedIssue, status: newStatus });
      }
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 403) {
        alert('You do not have jurisdiction over this incident\'s ward.');
      } else if (status === 400) {
        alert('Invalid status value. Please try again.');
      } else {
        alert('Failed to update status. Please try again.');
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-amber-100 text-amber-800';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="mt-4 text-slate-500 font-medium">Loading admin dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Access Error</h2>
        <p className="text-slate-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Control Panel</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage, review, and update the status of reported civic issues in your ward.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 bg-white border border-slate-200 rounded-lg px-4 py-2 flex items-center gap-2 shadow-sm">
          <CheckCircle className="text-green-500 w-5 h-5" />
          <span className="font-semibold text-slate-700">{issues.length} Total Reports</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative z-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Photo</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Details</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Location</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Update Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {issues.map((issue) => (
                <tr key={issue.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => setSelectedIssue(issue)}
                      className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg block"
                      title="Click to view full details"
                    >
                      <img
                        src={issue.image_url}
                        alt="Issue"
                        className="h-16 w-16 rounded-lg object-cover border border-slate-200 hover:opacity-80 transition-opacity cursor-pointer"
                      />
                    </button>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-900">{issue.category}</div>
                    <div className="text-sm text-slate-500 max-w-xs truncate" title={issue.description}>
                      {issue.description}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        <ThumbsUp size={12} />
                        {issue.upvotes ?? 0} {issue.upvotes === 1 ? 'Vote' : 'Votes'}
                      </span>
                      <span className="text-xs text-slate-400">ID: #{issue.id}</span>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-blue-600 hover:text-blue-800 mb-1">
                      <MapPin size={14} className="mr-1" />
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${issue.latitude},${issue.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium flex items-center gap-1"
                      >
                        View Map <ExternalLink size={12} />
                      </a>
                    </div>
                    <div className="text-sm text-slate-500">Ward: {issue.ward_id || 'N/A'}</div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-900">
                      {new Date(issue.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(issue.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <select
                        disabled={updatingId === issue.id}
                        value={issue.status}
                        onChange={(e) => handleStatusChange(issue.id, e.target.value)}
                        className={`text-sm font-medium rounded-lg px-3 py-2 border outline-none cursor-pointer focus:ring-2 focus:ring-blue-500 ${getStatusColor(issue.status)} ${updatingId === issue.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {VALID_STATUSES.map((s) => (
                          <option key={s} value={s}>{s.replace('_', ' ')}</option>
                        ))}
                      </select>
                      {updatingId === issue.id && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {issues.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              No reports found in your assigned ward.
            </div>
          )}
        </div>
      </div>

      {selectedIssue && (
        <IssueDetailsModal
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
        />
      )}
    </div>
  );
}
