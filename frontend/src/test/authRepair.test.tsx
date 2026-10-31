import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SignupPage from '../pages/Signup';
import LoginPage from '../pages/Login';
import ResetPasswordPage from '../pages/ResetPassword';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { supabase } from '../lib/supabase';

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      resend: vi.fn(),
    },
  },
}));

describe('NAGARWATCH — Authentication Repair Test Suite (Scenarios 1-15)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── 1. Successful Signup (Immediate Session) ────────────────────────────
  it('1. Successful signup with immediate session redirects to home', async () => {
    (supabase.auth.signUp as any).mockResolvedValueOnce({
      data: {
        user: { id: 'user-123', email: 'citizen@example.com' },
        session: { access_token: 'valid-jwt-token' },
      },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/signup']}>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/" element={<div>Home Page Destination</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Naitik Jain' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'citizen@example.com' } });
    fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '+919876543210' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password123!' } });

    fireEvent.click(screen.getByRole('button', { name: /register as citizen/i }));

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'citizen@example.com',
        password: 'Password123!',
        options: {
          data: {
            full_name: 'Naitik Jain',
            phone: '+919876543210',
            role: 'citizen',
          },
          emailRedirectTo: expect.stringContaining('/login'),
        },
      });
      expect(screen.getByText('Home Page Destination')).toBeInTheDocument();
    });
  });

  // ─── 2. Invalid Email Format ──────────────────────────────────────────────
  it('2. Invalid email format blocks signup and shows inline error', async () => {
    render(
      <MemoryRouter initialEntries={['/signup']}>
        <SignupPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Naitik Jain' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '+919876543210' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password123!' } });

    fireEvent.click(screen.getByRole('button', { name: /register as citizen/i }));

    expect(await screen.findByText(/please provide a valid email address/i)).toBeInTheDocument();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  // ─── 3. Weak Password ─────────────────────────────────────────────────────
  it('3. Weak password (< 8 chars) blocks signup and shows error', async () => {
    render(
      <MemoryRouter initialEntries={['/signup']}>
        <SignupPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Naitik Jain' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'citizen@example.com' } });
    fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '+919876543210' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: '123' } });

    fireEvent.click(screen.getByRole('button', { name: /register as citizen/i }));

    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  // ─── 4. Password Mismatch ─────────────────────────────────────────────────
  it('4. Password mismatch blocks signup and displays warning', async () => {
    render(
      <MemoryRouter initialEntries={['/signup']}>
        <SignupPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Naitik Jain' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'citizen@example.com' } });
    fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '+919876543210' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'DifferentPassword123!' } });

    fireEvent.click(screen.getByRole('button', { name: /register as citizen/i }));

    expect(await screen.findByText(/passwords do not match\. please re-enter your password/i)).toBeInTheDocument();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  // ─── 5. Existing Account Handling ─────────────────────────────────────────
  it('5. Existing account error from Supabase shows helpful sign-in link', async () => {
    (supabase.auth.signUp as any).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    });

    render(
      <MemoryRouter initialEntries={['/signup']}>
        <SignupPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Naitik Jain' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'existing@example.com' } });
    fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '+919876543210' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password123!' } });

    fireEvent.click(screen.getByRole('button', { name: /register as citizen/i }));

    expect(await screen.findByText(/an account with this email already exists/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to sign in/i })).toBeInTheDocument();
  });

  // ─── 6. Email Confirmation Required ───────────────────────────────────────
  it('6. When email confirmation is required, shows verification screen and allows resend', async () => {
    (supabase.auth.signUp as any).mockResolvedValueOnce({
      data: {
        user: { id: 'unconfirmed-uuid', email: 'citizen@example.com' },
        session: null, // No session until verified!
      },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/signup']}>
        <SignupPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Naitik Jain' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'citizen@example.com' } });
    fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '+919876543210' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password123!' } });

    fireEvent.click(screen.getByRole('button', { name: /register as citizen/i }));

    expect(await screen.findByText('Check Your Email')).toBeInTheDocument();
    expect(screen.getByText('citizen@example.com')).toBeInTheDocument();

    // Test Resend Email
    (supabase.auth.resend as any).mockResolvedValueOnce({ error: null });
    const resendBtn = screen.getByRole('button', { name: /resend verification email/i });
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(supabase.auth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'citizen@example.com',
        options: { emailRedirectTo: expect.stringContaining('/login') },
      });
      expect(screen.getByText(/verification email has been resent/i)).toBeInTheDocument();
    });
  });

  // ─── 7. Successful Sign In & Role Redirection ─────────────────────────────
  it('7. Successful sign in fetches authoritative role and redirects correctly', async () => {
    (supabase.auth.signInWithPassword as any).mockResolvedValueOnce({
      data: {
        user: { id: 'admin-123', email: 'admin@nagarwatch.org' },
        session: { access_token: 'admin-jwt-token' },
      },
      error: null,
    });

    // Mock backend /api/v1/users/me returning 'admin'
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'Success',
        data: { role: 'admin', full_name: 'Ward Admin' },
      }),
    });
    global.fetch = mockFetch;

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin" element={<div>Ward Admin Portal Destination</div>} />
            <Route path="/" element={<div>Home Destination</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'admin@nagarwatch.org' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'AdminPassword123!' } });

    fireEvent.click(screen.getByRole('button', { name: /sign in to nagarwatch/i }));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'admin@nagarwatch.org',
        password: 'AdminPassword123!',
      });
      expect(screen.getByText('Ward Admin Portal Destination')).toBeInTheDocument();
    });
  });

  // ─── 8. Invalid Credentials ───────────────────────────────────────────────
  it('8. Invalid credentials show helpful error message', async () => {
    (supabase.auth.signInWithPassword as any).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'wrong@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'WrongPassword' } });

    fireEvent.click(screen.getByRole('button', { name: /sign in to nagarwatch/i }));

    expect(await screen.findByText(/incorrect email or password/i)).toBeInTheDocument();
  });

  // ─── 9. Session Persistence After Refresh ─────────────────────────────────
  it('9. Session is hydrated from persisted Supabase session on initialization', async () => {
    (supabase.auth.getSession as any).mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'persisted-token',
          user: { id: 'citizen-persisted', email: 'persisted@example.com' },
        },
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'Success',
        data: { role: 'citizen', full_name: 'Persisted Citizen' },
      }),
    });

    function TestComponent() {
      const { user, userRole, sessionLoading } = useAuth();
      if (sessionLoading) return <div>Hydrating Session...</div>;
      return (
        <div>
          <div>Active User: {user?.email}</div>
          <div>Active Role: {userRole}</div>
        </div>
      );
    }

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByText('Hydrating Session...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Active User: persisted@example.com')).toBeInTheDocument();
      expect(screen.getByText('Active Role: citizen')).toBeInTheDocument();
    });
  });

  // ─── 10. Logout Clears State ──────────────────────────────────────────────
  it('10. Logout clears session, user, and tokens', async () => {
    (supabase.auth.getSession as any).mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'token-active',
          user: { id: 'active-user', email: 'logout@example.com' },
        },
      },
    });

    (supabase.auth.signOut as any).mockResolvedValueOnce({ error: null });

    function TestLogoutComponent() {
      const { user, signOut } = useAuth();
      return (
        <div>
          <div>Status: {user ? user.email : 'Logged Out'}</div>
          <button onClick={() => signOut()}>Trigger Sign Out</button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <TestLogoutComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Status: logout@example.com')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Trigger Sign Out'));

    await waitFor(() => {
      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(screen.getByText('Status: Logged Out')).toBeInTheDocument();
    });
  });

  // ─── 11. Password Recovery Flow ───────────────────────────────────────────
  it('11. Password recovery sends reset link and ResetPasswordPage updates password', async () => {
    (supabase.auth.resetPasswordForEmail as any).mockResolvedValueOnce({ error: null });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    );

    // Open Forgot Password
    fireEvent.click(screen.getByRole('button', { name: /forgot password\?/i }));
    expect(screen.getByRole('heading', { name: /reset password/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'citizen@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send recovery link/i }));

    await waitFor(() => {
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('citizen@example.com', {
        redirectTo: expect.stringContaining('/reset-password'),
      });
      expect(screen.getByText(/we have sent instructions to reset your password/i)).toBeInTheDocument();
    });

    // Test ResetPasswordPage
    (supabase.auth.updateUser as any).mockResolvedValueOnce({ error: null });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/reset-password']}>
          <ResetPasswordPage />
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'BrandNewPassword123!' } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'BrandNewPassword123!' } });
    fireEvent.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => {
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'BrandNewPassword123!' });
      expect(screen.getByText(/password changed!/i)).toBeInTheDocument();
    });
  });

  // ─── 12. Citizen Role Enforcement ─────────────────────────────────────────
  it('12. Citizen role is directed to citizen portal and blocked from administrative areas', async () => {
    (supabase.auth.getSession as any).mockResolvedValueOnce({
      data: {
        session: { access_token: 'citizen-jwt', user: { id: 'citizen-1', email: 'citizen@gov.in' } },
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'Success', data: { role: 'citizen' } }),
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <div>Admin Guarded Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<div>Citizen Portal Home</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Citizen Portal Home')).toBeInTheDocument();
      expect(screen.queryByText('Admin Guarded Content')).not.toBeInTheDocument();
    });
  });

  // ─── 13. Admin Role Resolution ────────────────────────────────────────────
  it('13. Authenticated admin is granted access to /admin', async () => {
    (supabase.auth.getSession as any).mockResolvedValueOnce({
      data: {
        session: { access_token: 'admin-jwt', user: { id: 'admin-1', email: 'admin@gov.in' } },
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'Success', data: { role: 'admin' } }),
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin']}>
          <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
            <div>Admin Dashboard Authorized</div>
          </ProtectedRoute>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard Authorized')).toBeInTheDocument();
    });
  });

  // ─── 14. SuperAdmin Role Resolution ───────────────────────────────────────
  it('14. Authenticated super_admin is granted access to /superadmin', async () => {
    (supabase.auth.getSession as any).mockResolvedValueOnce({
      data: {
        session: { access_token: 'sa-jwt', user: { id: 'sa-1', email: 'super@gov.in' } },
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'Success', data: { role: 'super_admin' } }),
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/superadmin']}>
          <ProtectedRoute requiredRoles={['super_admin']}>
            <div>SuperAdmin Control Center Authorized</div>
          </ProtectedRoute>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('SuperAdmin Control Center Authorized')).toBeInTheDocument();
    });
  });

  // ─── 15. Protected Route Loading Spinner ──────────────────────────────────
  it('15. Protected route displays loader while hydrating without early redirect bounce', () => {
    (supabase.auth.getSession as any).mockReturnValue(new Promise(() => {})); // Never resolves during this test

    const { container } = render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/my-reports']}>
          <ProtectedRoute>
            <div>My Personal Reports</div>
          </ProtectedRoute>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.queryByText('My Personal Reports')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});
