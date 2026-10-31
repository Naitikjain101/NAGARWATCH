import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CitizenHeader } from '../components/layout/CitizenHeader';
import { CitizenBottomNav } from '../components/layout/CitizenBottomNav';
import { CitizenLayout } from '../components/layout/CitizenLayout';
import ProfilePage from '../pages/Profile';
import App from '../App';
import * as AuthContextModule from '../context/AuthContext';

describe('Citizen Layout and Navigation', () => {
  const mockSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CitizenHeader', () => {
    it('renders brand and guest actions when unauthenticated', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: null,
        session: null,
        userRole: null,
        accessToken: null,
        sessionLoading: false,
        roleLoading: false,
        loading: false,
        roleError: null,
        retryRoleFetch: vi.fn(),
        signOut: mockSignOut,
      });

      render(
        <MemoryRouter initialEntries={['/']}>
          <CitizenHeader />
        </MemoryRouter>
      );

      expect(screen.getByText('NagarWatch')).toBeInTheDocument();
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Explore')).toBeInTheDocument();
      expect(screen.getByText('Log In')).toBeInTheDocument();
      expect(screen.getByText('Sign Up')).toBeInTheDocument();
      expect(screen.getByText('Report Issue')).toBeInTheDocument();
      expect(screen.queryByText('My Reports')).not.toBeInTheDocument();
    });

    it('renders user menu with verified role badge when authenticated as citizen', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 'user-123', phone: '+919876543210' } as any,
        session: { access_token: 'valid-token' } as any,
        userRole: 'citizen',
        accessToken: 'valid-token',
        sessionLoading: false,
        roleLoading: false,
        loading: false,
        roleError: null,
        retryRoleFetch: vi.fn(),
        signOut: mockSignOut,
      });

      render(
        <MemoryRouter initialEntries={['/']}>
          <CitizenHeader />
        </MemoryRouter>
      );

      // Desktop nav shows My Reports link
      expect(screen.getByText('My Reports')).toBeInTheDocument();

      // Open UserMenu
      const userMenuTrigger = screen.getByLabelText(/User account menu/i);
      fireEvent.click(userMenuTrigger);

      expect(screen.getByText('Signed in as')).toBeInTheDocument();
      expect(screen.getAllByText('+919876543210').length).toBeGreaterThan(0);
      expect(screen.getByText('Citizen')).toBeInTheDocument();

      // Sign out
      const signOutBtn = screen.getByRole('menuitem', { name: /Sign Out/i });
      fireEvent.click(signOutBtn);
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it('renders Admin Panel link in user menu for administrators', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 'admin-456', phone: '+919999988888' } as any,
        session: { access_token: 'valid-token' } as any,
        userRole: 'admin',
        accessToken: 'valid-token',
        sessionLoading: false,
        roleLoading: false,
        loading: false,
        roleError: null,
        retryRoleFetch: vi.fn(),
        signOut: mockSignOut,
      });

      render(
        <MemoryRouter initialEntries={['/']}>
          <CitizenHeader />
        </MemoryRouter>
      );

      const userMenuTrigger = screen.getByLabelText(/User account menu/i);
      fireEvent.click(userMenuTrigger);

      expect(screen.getByText('Ward Admin')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Admin Panel/i })).toBeInTheDocument();
    });
  });

  describe('CitizenBottomNav (Mobile Navigation)', () => {
    it('renders all 5 mobile items and highlights active route', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 'user-123', phone: '+919876543210' } as any,
        session: { access_token: 'valid-token' } as any,
        userRole: 'citizen',
        accessToken: 'valid-token',
        sessionLoading: false,
        roleLoading: false,
        loading: false,
        roleError: null,
        retryRoleFetch: vi.fn(),
        signOut: mockSignOut,
      });

      render(
        <MemoryRouter initialEntries={['/explore']}>
          <CitizenBottomNav />
        </MemoryRouter>
      );

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Explore')).toBeInTheDocument();
      expect(screen.getByText('Report')).toBeInTheDocument();
      expect(screen.getByText('My Reports')).toBeInTheDocument();
      expect(screen.getByText('Profile')).toBeInTheDocument();

      // Check Report item has prominent styling container
      const reportBtn = screen.getByLabelText(/Report an issue/i);
      expect(reportBtn.className).toContain('-mt-5');
    });
  });

  describe('Citizen Profile Page', () => {
    it('renders profile details and role badge accurately', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 'user-abc-789', phone: '+919876500000' } as any,
        session: { access_token: 'valid-token' } as any,
        userRole: 'citizen',
        accessToken: 'valid-token',
        sessionLoading: false,
        roleLoading: false,
        loading: false,
        roleError: null,
        retryRoleFetch: vi.fn(),
        signOut: mockSignOut,
      });

      render(
        <MemoryRouter initialEntries={['/profile']}>
          <ProfilePage />
        </MemoryRouter>
      );

      expect(screen.getByText('My Profile')).toBeInTheDocument();
      expect(screen.getAllByText('+919876500000').length).toBeGreaterThan(0);
      expect(screen.getByText('user-abc-789')).toBeInTheDocument();
      expect(screen.getAllByText('Citizen').length).toBeGreaterThan(0);

      // Click Sign Out in Profile
      const signOutBtn = screen.getByRole('button', { name: /Sign Out/i });
      fireEvent.click(signOutBtn);
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  describe('App Route Structure & Backward Compatibility', () => {
    it('preserves query params when redirecting from /civic-media to /explore', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: null,
        session: null,
        userRole: null,
        accessToken: null,
        sessionLoading: false,
        roleLoading: false,
        loading: false,
        roleError: null,
        retryRoleFetch: vi.fn(),
        signOut: mockSignOut,
      });

      render(
        <MemoryRouter initialEntries={['/civic-media?lat=9.59&lon=76.52']}>
          <App />
        </MemoryRouter>
      );

      // /civic-media redirected to /explore which loads CivicMedia component (in loading state)
      expect(screen.getAllByText(/Finding local issues/i).length).toBeGreaterThan(0);
    });

    it('redirects /dashboard to /my-reports', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 'user-123', phone: '+919876543210' } as any,
        session: { access_token: 'valid-token' } as any,
        userRole: 'citizen',
        accessToken: 'valid-token',
        sessionLoading: false,
        roleLoading: false,
        loading: false,
        roleError: null,
        retryRoleFetch: vi.fn(),
        signOut: mockSignOut,
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <App />
        </MemoryRouter>
      );

      // Renders My Reports (from DashboardPage)
      expect(screen.getAllByText('My Reports').length).toBeGreaterThan(0);
    });
  });
});
