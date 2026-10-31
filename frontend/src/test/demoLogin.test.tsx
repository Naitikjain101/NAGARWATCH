import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from '../pages/Login';
import SignupPage from '../pages/Signup';
import { CitizenHeader } from '../components/layout/CitizenHeader';
import { supabase } from '../lib/supabase';
import * as AuthContextModule from '../context/AuthContext';

// Mock Supabase Auth
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

describe('Demo Credentials & Quick Login Feature', () => {
  const mockFetchRoleForToken = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      session: null,
      userRole: null,
      accessToken: null,
      sessionLoading: false,
      roleLoading: false,
      loading: false,
      roleError: null,
      fetchRoleForToken: mockFetchRoleForToken,
      retryRoleFetch: vi.fn(),
      signOut: vi.fn(),
    });
  });

  it('renders all 3 demo credentials cards on the Login page', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Instant Demo Credentials')).toBeInTheDocument();
    expect(screen.getByText('citizen@nagarwatch.org')).toBeInTheDocument();
    expect(screen.getByText('admin@nagarwatch.org')).toBeInTheDocument();
    expect(screen.getByText('superadmin@nagarwatch.org')).toBeInTheDocument();

    expect(screen.getByText('pwd: NagarWatch@2026')).toBeInTheDocument();
  });

  it('logs in as Citizen via Demo button and redirects to home', async () => {
    (supabase.auth.signInWithPassword as any).mockResolvedValueOnce({
      data: {
        session: { access_token: 'citizen-demo-token' },
        user: { id: 'c1111111-1111-1111-1111-111111111111', email: 'citizen@nagarwatch.org' },
      },
      error: null,
    });
    mockFetchRoleForToken.mockResolvedValueOnce('citizen');

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Citizen Portal Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Find the Citizen Demo card button
    const citizenCard = screen.getByText('citizen@nagarwatch.org').closest('div');
    expect(citizenCard).toBeInTheDocument();

    const signInBtns = screen.getAllByRole('button', { name: /Sign In/i });
    // First button in the demo list is Citizen Sign In
    fireEvent.click(signInBtns[1]);

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'citizen@nagarwatch.org',
        password: 'NagarWatch@2026',
      });
      expect(mockFetchRoleForToken).toHaveBeenCalledWith('citizen-demo-token');
      expect(screen.getByText('Citizen Portal Home')).toBeInTheDocument();
    });
  });

  it('logs in as Ward Administrator via Demo button and redirects to /admin', async () => {
    (supabase.auth.signInWithPassword as any).mockResolvedValueOnce({
      data: {
        session: { access_token: 'admin-demo-token' },
        user: { id: 'a2222222-2222-2222-2222-222222222222', email: 'admin@nagarwatch.org' },
      },
      error: null,
    });
    mockFetchRoleForToken.mockResolvedValueOnce('admin');

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<div>Ward Administrator Console</div>} />
        </Routes>
      </MemoryRouter>
    );

    const signInBtns = screen.getAllByRole('button', { name: /Sign In/i });
    // Second button in demo list is Ward Admin
    fireEvent.click(signInBtns[2]);

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'admin@nagarwatch.org',
        password: 'NagarWatch@2026',
      });
      expect(mockFetchRoleForToken).toHaveBeenCalledWith('admin-demo-token');
      expect(screen.getByText('Ward Administrator Console')).toBeInTheDocument();
    });
  });

  it('logs in as Super Administrator via Demo button and redirects to /superadmin', async () => {
    (supabase.auth.signInWithPassword as any).mockResolvedValueOnce({
      data: {
        session: { access_token: 'superadmin-demo-token' },
        user: { id: '33333333-3333-3333-3333-333333333333', email: 'superadmin@nagarwatch.org' },
      },
      error: null,
    });
    mockFetchRoleForToken.mockResolvedValueOnce('super_admin');

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/superadmin" element={<div>Super Administrator Platform</div>} />
        </Routes>
      </MemoryRouter>
    );

    const signInBtns = screen.getAllByRole('button', { name: /Sign In/i });
    // Third button in demo list is Super Admin
    fireEvent.click(signInBtns[3]);

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'superadmin@nagarwatch.org',
        password: 'NagarWatch@2026',
      });
      expect(mockFetchRoleForToken).toHaveBeenCalledWith('superadmin-demo-token');
      expect(screen.getByText('Super Administrator Platform')).toBeInTheDocument();
    });
  });

  it('displays Demo Log In link on Signup page', () => {
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/Testing or reviewing\? Skip signup with instant demo roles/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Demo Log In/i })).toBeInTheDocument();
  });

  it('displays Demo Log In button in CitizenHeader for unauthenticated users', () => {
    render(
      <MemoryRouter>
        <CitizenHeader />
      </MemoryRouter>
    );

    const demoLoginBtn = screen.getByRole('button', { name: /Demo Log In/i });
    expect(demoLoginBtn).toBeInTheDocument();
  });
});

