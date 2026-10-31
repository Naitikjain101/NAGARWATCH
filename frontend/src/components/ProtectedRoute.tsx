import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, AppRole } from '../context/AuthContext';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** When set, only users with one of these backend-verified roles can access the route. */
  requiredRoles?: AppRole[];
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, userRole, sessionLoading, roleLoading, roleError, retryRoleFetch } = useAuth();
  const location = useLocation();

  // 1. Wait for Supabase local session to hydrate
  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  // 2. Not authenticated at all → redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. For role-restricted routes:
  if (requiredRoles && requiredRoles.length > 0) {
    // If backend role is still loading, wait with a status indicator!
    // Never prematurely bounce an admin/super_admin before their role is resolved.
    if (roleLoading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Verifying authorization permissions...</p>
        </div>
      );
    }

    // If fetching the role from the backend failed (e.g. network or server error),
    // show a temporary error screen with a retry button instead of failing open or silently downgrading.
    if (roleError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 max-w-md w-full shadow-sm">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Authorization Check Unavailable</h2>
            <p className="text-sm text-slate-600 mb-4">{roleError}</p>
            <button
              onClick={() => retryRoleFetch()}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-xl transition-all shadow-sm"
            >
              <RefreshCw className="w-4 h-4" /> Retry Verification
            </button>
          </div>
        </div>
      );
    }

    // Role resolved successfully from backend: check authorization
    if (!userRole || !requiredRoles.includes(userRole)) {
      return <Navigate to="/" state={{ accessDenied: true }} replace />;
    }
  }

  return <>{children}</>;
}
