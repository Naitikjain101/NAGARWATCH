import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CitizenLayout } from './components/layout/CitizenLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { SuperAdminLayout } from './components/layout/SuperAdminLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { ToastProvider } from './components/ui/Toast';

// ─── Citizen Core Pages (Static to guarantee instant hydration & SEO) ────────
import HomePage from './pages/Home';
import LoginPage from './pages/Login';
import SignupPage from './pages/Signup';
import ResetPasswordPage from './pages/ResetPassword';
import ReportPage from './pages/Report';
import DashboardPage from './pages/Dashboard';
import CivicMedia from './pages/CivicMedia';
import ProfilePage from './pages/Profile';
import NotFoundPage from './pages/NotFound';

// ─── Ward Administrator Pages ────────────────────────────────────────────────
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { AdminIncidentsPage } from './pages/admin/AdminIncidentsPage';
import { AdminMapPage } from './pages/admin/AdminMapPage';
import { AdminWardPage } from './pages/admin/AdminWardPage';
import { AdminProfilePage } from './pages/admin/AdminProfilePage';

// ─── Super Administrator Governance Platform ────────────────────────────────
import { SuperAdminOverviewPage } from './pages/superadmin/SuperAdminOverviewPage';
import { SuperAdminWardsPage } from './pages/superadmin/SuperAdminWardsPage';
import { SuperAdminAdminsPage } from './pages/superadmin/SuperAdminAdminsPage';
import { SuperAdminUsersPage } from './pages/superadmin/SuperAdminUsersPage';
import { SuperAdminAuditPage } from './pages/superadmin/SuperAdminAuditPage';

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
      <LoadingSpinner size="lg" />
      <span className="text-xs font-medium text-slate-400">Loading module...</span>
    </div>
  );
}

/**
 * Preserves query parameters (e.g. ?lat=...&lon=...) when redirecting from /civic-media to /explore
 */
function CivicMediaRedirect() {
  const location = useLocation();
  return <Navigate to={`/explore${location.search}`} replace />;
}

export default function App() {
  return (
    <ToastProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
        {/* ─── Dedicated Super Administrator Platform ─────────────────────────── */}
        <Route
          path="/superadmin"
          element={
            <ProtectedRoute requiredRoles={['super_admin']}>
              <SuperAdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<SuperAdminOverviewPage />} />
          <Route path="wards" element={<SuperAdminWardsPage />} />
          <Route path="admins" element={<SuperAdminAdminsPage />} />
          <Route path="users" element={<SuperAdminUsersPage />} />
          <Route path="audit" element={<SuperAdminAuditPage />} />
          <Route path="*" element={<Navigate to="/superadmin" replace />} />
        </Route>

        {/* ─── Dedicated Ward Administrator Experience ────────────────────────── */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminOverviewPage />} />
          <Route path="incidents" element={<AdminIncidentsPage />} />
          <Route path="issues" element={<Navigate to="/admin/incidents" replace />} />
          <Route path="map" element={<AdminMapPage />} />
          <Route path="ward" element={<AdminWardPage />} />
          <Route path="profile" element={<AdminProfilePage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>

        {/* ─── Citizen Application Shell ───────────────────────────────────────── */}
        <Route path="/" element={<CitizenLayout />}>
          {/* Public Citizen Routes */}
          <Route index element={<HomePage />} />
          <Route path="explore" element={<CivicMedia />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="auth" element={<Navigate to="/login" replace />} />

          {/* Backward-Compatibility Redirects */}
          <Route path="civic-media" element={<CivicMediaRedirect />} />

          {/* Authenticated Citizen Routes */}
          <Route
            path="report"
            element={
              <ProtectedRoute>
                <ReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="my-reports"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Authoritative Application-Level 404 Handler */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  </ToastProvider>
);
}
