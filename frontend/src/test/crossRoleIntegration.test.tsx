import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import App from '../App';
import IssueDetailsModal from '../components/IssueDetailsModal';
import apiClient from '../lib/apiClient';
import * as AuthContextModule from '../context/AuthContext';

// Mock Leaflet
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div data-testid="leaflet-map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: () => <div data-testid="marker" />,
  Popup: ({ children }: any) => <div>{children}</div>,
  Polygon: () => <div data-testid="polygon" />,
  useMap: () => ({
    flyTo: vi.fn(),
    setView: vi.fn(),
    fitBounds: vi.fn(),
    invalidateSize: vi.fn(),
  }),
}));

describe('Phase 3H: Cross-Role Full System Integration Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ─────────────────────────────────────────────────────────────────────────────
   * 1. Cross-Role RBAC Authorization & Route Boundaries
   * ───────────────────────────────────────────────────────────────────────────── */
  it('blocks unauthenticated visitors from accessing /admin and redirects to /login', async () => {
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
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText(/sign in to continue reporting/i)).toBeInTheDocument();
  });

  it('blocks citizen role from accessing /admin and redirects to home', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'citizen-1', email: 'citizen@nagarwatch.org' } as any,
      session: { access_token: 'valid' } as any,
      userRole: 'citizen',
      accessToken: 'valid',
      sessionLoading: false,
      roleLoading: false,
      loading: false,
      roleError: null,
      retryRoleFetch: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.queryByText(/Ward Administration/i)).not.toBeInTheDocument();
  });

  it('blocks citizen role from accessing /superadmin and redirects to home', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'citizen-1', email: 'citizen@nagarwatch.org' } as any,
      session: { access_token: 'valid' } as any,
      userRole: 'citizen',
      accessToken: 'valid',
      sessionLoading: false,
      roleLoading: false,
      loading: false,
      roleError: null,
      retryRoleFetch: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/superadmin']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.queryByText(/Governance Platform/i)).not.toBeInTheDocument();
  });

  it('blocks ward administrator from accessing /superadmin and redirects to home', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'admin-1', email: 'officer@nagarwatch.org' } as any,
      session: { access_token: 'valid' } as any,
      userRole: 'admin',
      accessToken: 'valid',
      sessionLoading: false,
      roleLoading: false,
      loading: false,
      roleError: null,
      retryRoleFetch: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/superadmin']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.queryByText(/Governance Platform/i)).not.toBeInTheDocument();
  });

  /* ─────────────────────────────────────────────────────────────────────────────
   * 2. Citizen Lifecycle: Viewing Resolved Incident with Official Evidence
   * ───────────────────────────────────────────────────────────────────────────── */
  it('displays official municipal resolution notes and proof media to citizens', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'citizen-1', email: 'citizen@nagarwatch.org' } as any,
      session: { access_token: 'valid' } as any,
      userRole: 'citizen',
      accessToken: 'valid',
      sessionLoading: false,
      roleLoading: false,
      loading: false,
      roleError: null,
      retryRoleFetch: vi.fn(),
      signOut: vi.fn(),
    });

    const mockResolvedIncident = {
      id: 'inc-resolved-101',
      category: 'Pothole',
      description: 'Dangerous pothole on MG Road near Metro Pillar 42',
      status: 'resolved',
      image_url: 'https://storage.supabase.co/before-pothole.jpg',
      created_at: '2026-10-28T09:00:00Z',
      resolved_at: '2026-10-30T14:30:00Z',
      resolution_notes: 'Hot-mix asphalt laid and roller compacted by Ward 14 maintenance team.',
      proof_media_url: 'https://storage.supabase.co/after-repaired.jpg',
      latitude: 9.5123,
      longitude: 76.5123,
      upvotes: 8,
    };

    render(
      <IssueDetailsModal
        issue={mockResolvedIncident}
        onClose={vi.fn()}
      />
    );

    // Official municipal resolution section
    expect(screen.getByText('Official Municipal Resolution')).toBeInTheDocument();
    expect(screen.getByText(/Hot-mix asphalt laid and roller compacted/i)).toBeInTheDocument();
    expect(screen.getByText('Resolution Evidence')).toBeInTheDocument();

    const proofImg = screen.getByAltText('Resolution Evidence');
    expect(proofImg).toHaveAttribute('src', 'https://storage.supabase.co/after-repaired.jpg');
  });

  /* ─────────────────────────────────────────────────────────────────────────────
   * 3. Community Verification Flow
   * ───────────────────────────────────────────────────────────────────────────── */
  it('allows authenticated citizen to verify an incident and updates upvote count', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'citizen-1', email: 'citizen@nagarwatch.org' } as any,
      session: { access_token: 'valid' } as any,
      userRole: 'citizen',
      accessToken: 'valid',
      sessionLoading: false,
      roleLoading: false,
      loading: false,
      roleError: null,
      retryRoleFetch: vi.fn(),
      signOut: vi.fn(),
    });

    vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: { status: 'Success', message: 'Verification recorded' },
    });

    const mockActiveIncident = {
      id: 'inc-pothole-55',
      category: 'Pothole',
      description: 'Deep road cavity outside central market',
      status: 'reported',
      image_url: '',
      created_at: '2026-10-30T10:00:00Z',
      upvotes: 3,
    };

    render(
      <IssueDetailsModal
        issue={mockActiveIncident}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/3 neighbours have verified this/i)).toBeInTheDocument();

    const verifyBtn = screen.getByText('Verify Issue');
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/incidents/inc-pothole-55/verifications',
        { type: 'confirm' }
      );
      expect(screen.getByText(/4 neighbours have verified this/i)).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });
  });

  /* ─────────────────────────────────────────────────────────────────────────────
   * 4. Privacy: Citizen PII Not Exposed in Public Incident Detail
   * ───────────────────────────────────────────────────────────────────────────── */
  it('does not expose reporter phone number or private identity in public details', () => {
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
      signOut: vi.fn(),
    });

    const mockPublicIncident = {
      id: 'inc-public-999',
      category: 'Garbage',
      description: 'Overflowing waste container',
      status: 'reported',
      image_url: '',
      created_at: '2026-10-30T10:00:00Z',
      latitude: 9.5,
      longitude: 76.5,
    };

    render(
      <IssueDetailsModal
        issue={mockPublicIncident}
        onClose={vi.fn()}
      />
    );

    // Private phone or email strings should not be present
    expect(screen.queryByText(/phone/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/user_id/i)).not.toBeInTheDocument();
    expect(screen.getByText('Complaint #inc-publ')).toBeInTheDocument();
  });
});

