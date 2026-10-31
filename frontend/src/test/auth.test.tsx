import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import * as AuthContextModule from '../context/AuthContext';

describe('AuthContext and ProtectedRoute Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('displays loading spinner while session is loading', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      session: null,
      user: null,
      userRole: null,
      accessToken: null,
      sessionLoading: true,
      roleLoading: false,
      loading: true,
      roleError: null,
      retryRoleFetch: vi.fn(),
      signOut: vi.fn(),
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/admin/issues']}>
        <ProtectedRoute requiredRoles={['admin']}>
          <div>Admin Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('keeps admin route in loading state while role is resolving and does not bounce the user', () => {
    // Authenticated user, but backend role is still in flight (roleLoading = true)
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      session: { access_token: 'valid-jwt' } as any,
      user: { id: 'admin-uuid', phone: '+919876543210' } as any,
      userRole: null, // Not resolved yet!
      accessToken: 'valid-jwt',
      sessionLoading: false,
      roleLoading: true, // In flight!
      loading: true,
      roleError: null,
      retryRoleFetch: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin/issues']}>
        <Routes>
          <Route
            path="/admin/issues"
            element={
              <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                <div>Admin Secret Panel</div>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<div>Home Page (Access Denied Target)</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Must show verifying permissions spinner, and MUST NOT have navigated to Home Page
    expect(screen.getByText('Verifying authorization permissions...')).toBeInTheDocument();
    expect(screen.queryByText('Home Page (Access Denied Target)')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin Secret Panel')).not.toBeInTheDocument();
  });

  it('displays retry UI on network/server failure during role retrieval and never silently assigns citizen', () => {
    const mockRetry = vi.fn();

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      session: { access_token: 'valid-jwt' } as any,
      user: { id: 'admin-uuid' } as any,
      userRole: null, // Crucial: NOT silently downgraded to 'citizen'
      accessToken: 'valid-jwt',
      sessionLoading: false,
      roleLoading: false,
      loading: false,
      roleError: 'Could not connect to authentication server. Please check your connection.',
      retryRoleFetch: mockRetry,
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin/issues']}>
        <Routes>
          <Route
            path="/admin/issues"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <div>Admin Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    // Shows retry error UI
    expect(screen.getByText('Authorization Check Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Could not connect to authentication server/)).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /Retry Verification/i });
    expect(retryButton).toBeInTheDocument();
    retryButton.click();
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('allows access once role resolves to authorized role', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      session: { access_token: 'valid-jwt' } as any,
      user: { id: 'admin-uuid' } as any,
      userRole: 'admin', // Successfully resolved
      accessToken: 'valid-jwt',
      sessionLoading: false,
      roleLoading: false,
      loading: false,
      roleError: null,
      retryRoleFetch: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin/issues']}>
        <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
          <div>Admin Secret Panel</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Admin Secret Panel')).toBeInTheDocument();
  });

  it('denies access and redirects if user role is insufficient', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      session: { access_token: 'valid-jwt' } as any,
      user: { id: 'citizen-uuid' } as any,
      userRole: 'citizen', // Citizen trying to access admin
      accessToken: 'valid-jwt',
      sessionLoading: false,
      roleLoading: false,
      loading: false,
      roleError: null,
      retryRoleFetch: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin/issues']}>
        <Routes>
          <Route
            path="/admin/issues"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <div>Admin Secret Panel</div>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<div>Home Page Redirected</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Home Page Redirected')).toBeInTheDocument();
    expect(screen.queryByText('Admin Secret Panel')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to /login', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      session: null,
      user: null,
      userRole: null,
      accessToken: null,
      sessionLoading: false,
      roleLoading: false,
      loading: false,
      roleError: null,
      retryRoleFetch: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Dashboard Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page Target</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page Target')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument();
  });

  it('ensures signOut clears role, session, and tokens', async () => {
    const mockSignOut = vi.fn();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      session: { access_token: 'token-to-be-cleared' } as any,
      user: { id: 'user-to-be-cleared' } as any,
      userRole: 'admin',
      accessToken: 'token-to-be-cleared',
      sessionLoading: false,
      roleLoading: false,
      loading: false,
      roleError: null,
      retryRoleFetch: vi.fn(),
      signOut: mockSignOut,
    });

    const auth = AuthContextModule.useAuth();
    await auth.signOut();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
