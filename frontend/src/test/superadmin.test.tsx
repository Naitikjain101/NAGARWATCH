import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import App from '../App';
import { SuperAdminLayout } from '../components/layout/SuperAdminLayout';
import { SuperAdminOverviewPage } from '../pages/superadmin/SuperAdminOverviewPage';
import { SuperAdminWardsPage } from '../pages/superadmin/SuperAdminWardsPage';
import { SuperAdminAdminsPage } from '../pages/superadmin/SuperAdminAdminsPage';
import { SuperAdminUsersPage } from '../pages/superadmin/SuperAdminUsersPage';
import { SuperAdminAuditPage } from '../pages/superadmin/SuperAdminAuditPage';
import apiClient from '../lib/apiClient';
import * as AuthContextModule from '../context/AuthContext';

// Mock Leaflet react-leaflet to prevent JSDOM canvas/leaflet issues
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div data-testid="leaflet-map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Polygon: () => <div data-testid="polygon" />,
  useMap: () => ({
    invalidateSize: vi.fn(),
    fitBounds: vi.fn(),
    setView: vi.fn(),
  }),
}));

const mockOverviewData = {
  status: 'Success',
  data: {
    users: {
      total_citizens: 120,
      total_admins: 5,
      total_superadmins: 2,
      total_users: 127,
    },
    incidents: {
      total_incidents: 45,
      reported: 10,
      verified: 8,
      in_progress: 12,
      resolved: 15,
      rejected: 0,
    },
    total_wards: 3,
    recent_incidents: [
      {
        id: 'inc-999',
        category: 'Road Hazard',
        status: 'reported',
        created_at: '2026-10-30T12:00:00Z',
        ward_id: 1,
      },
    ],
    recent_users: [
      {
        id: 'u-1',
        full_name: 'Aditi Sharma',
        email: 'aditi@example.com',
        phone: '987****1234',
        role: 'citizen',
        created_at: '2026-10-29T10:00:00Z',
      },
    ],
  },
};

const mockWardsData = {
  status: 'Success',
  count: 2,
  data: [
    {
      id: 1,
      name: 'Ward 1 - Central Market',
      assigned_admins_count: 2,
      assigned_admins: ['Officer Ramesh', 'Officer Priya'],
      total_incidents: 25,
      active_incidents: 10,
      resolved_incidents: 15,
      geom: {
        type: 'Polygon',
        coordinates: [
          [
            [76.5, 9.5],
            [76.55, 9.5],
            [76.55, 9.55],
            [76.5, 9.55],
            [76.5, 9.5],
          ],
        ],
      },
    },
    {
      id: 2,
      name: 'Ward 2 - South Harbor',
      assigned_admins_count: 0,
      assigned_admins: [],
      total_incidents: 8,
      active_incidents: 3,
      resolved_incidents: 5,
      geom: null,
    },
  ],
};

const mockAdminsData = {
  status: 'Success',
  count: 2,
  data: [
    {
      id: 'admin-1',
      full_name: 'Officer Ramesh',
      email: 'ramesh@nagarwatch.gov',
      role: 'admin',
      is_verified: true,
      wards_allocated: [1],
      created_at: '2026-10-01T00:00:00Z',
    },
    {
      id: 'super-1',
      full_name: 'Chief Commissioner',
      email: 'commissioner@nagarwatch.gov',
      role: 'super_admin',
      is_verified: true,
      wards_allocated: [],
      created_at: '2026-09-01T00:00:00Z',
    },
  ],
};

const mockUsersData = {
  status: 'Success',
  count: 2,
  data: [
    {
      id: 'u-1',
      full_name: 'Citizen Ananya',
      email: 'ananya@citizen.in',
      phone: '984****5678',
      role: 'citizen',
      is_verified: true,
      created_at: '2026-10-15T00:00:00Z',
      wards_allocated: [],
    },
    {
      id: 'u-2',
      full_name: 'Citizen Vikram',
      email: 'vikram@citizen.in',
      phone: '912****3456',
      role: 'citizen',
      is_verified: false,
      created_at: '2026-10-20T00:00:00Z',
      wards_allocated: [],
    },
  ],
};

const mockAuditData = {
  status: 'Success',
  count: 2,
  data: [
    {
      id: 101,
      incident_id: 'inc-001-abcdef',
      user_id: 'admin-1',
      old_status: 'reported',
      new_status: 'verified',
      notes: 'Road inspector confirmed pothole dimension and safety priority.',
      proof_media_url: '',
      created_at: '2026-10-30T14:30:00Z',
      incident_category: 'Pothole',
      incident_ward_id: 1,
      actor_name: 'Officer Ramesh',
      actor_role: 'admin',
    },
    {
      id: 102,
      incident_id: 'inc-002-ghijkl',
      user_id: 'admin-1',
      old_status: 'in_progress',
      new_status: 'resolved',
      notes: 'Asphalt patching complete. Water runoff diverted.',
      proof_media_url: 'https://storage.supabase.co/proof1.jpg',
      created_at: '2026-10-30T16:00:00Z',
      incident_category: 'Pothole',
      incident_ward_id: 1,
      actor_name: 'Officer Ramesh',
      actor_role: 'admin',
    },
  ],
};

describe('Phase 3G: Super Administrator Platform', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock as Super Admin
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'super-user-1',
        email: 'superadmin@nagarwatch.gov',
        user_metadata: { full_name: 'Municipal Commissioner' },
      } as any,
      session: { access_token: 'valid-token' } as any,
      userRole: 'super_admin',
      isLoading: false,
      isRoleLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      signOut: vi.fn(),
      refreshToken: vi.fn(),
      getValidToken: vi.fn().mockResolvedValue('valid-token'),
    });

    // Default API Mocks
    vi.spyOn(apiClient, 'get').mockImplementation((url: string) => {
      if (url.includes('/api/v1/superadmin/overview')) {
        return Promise.resolve({ data: mockOverviewData });
      }
      if (url.includes('/api/v1/superadmin/wards')) {
        return Promise.resolve({ data: mockWardsData });
      }
      if (url.includes('/api/v1/superadmin/admins')) {
        return Promise.resolve({ data: mockAdminsData });
      }
      if (url.includes('/api/v1/superadmin/users')) {
        return Promise.resolve({ data: mockUsersData });
      }
      if (url.includes('/api/v1/superadmin/audit')) {
        return Promise.resolve({ data: mockAuditData });
      }
      if (url.includes('/api/v1/wards')) {
        return Promise.resolve({ data: mockWardsData });
      }
      return Promise.resolve({ data: {} });
    });

    vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { status: 'Success' } });
    vi.spyOn(apiClient, 'patch').mockResolvedValue({ data: { status: 'Success' } });
    vi.spyOn(apiClient, 'delete').mockResolvedValue({ data: { status: 'Success' } });
  });

  /* ─────────────────────────────────────────────────────────────────────────────
   * 1. Route Access & Authorization Safeguards
   * ───────────────────────────────────────────────────────────────────────────── */
  it('blocks unauthenticated access to /superadmin and redirects to /login', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      session: null,
      userRole: null,
      isLoading: false,
      isRoleLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      signOut: vi.fn(),
      refreshToken: vi.fn(),
      getValidToken: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/superadmin']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText(/sign in to continue reporting/i)).toBeInTheDocument();
  });

  it('blocks citizen role from accessing /superadmin and redirects to home', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'citizen-1', email: 'citizen@example.com' } as any,
      session: { access_token: 'token' } as any,
      userRole: 'citizen',
      isLoading: false,
      isRoleLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      signOut: vi.fn(),
      refreshToken: vi.fn(),
      getValidToken: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/superadmin']}>
        <App />
      </MemoryRouter>
    );

    // Citizen should be redirected to home
    expect(screen.queryByText(/Governance Platform/i)).not.toBeInTheDocument();
  });

  it('blocks ward admin from accessing /superadmin and redirects to home', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'admin-1', email: 'admin@example.com' } as any,
      session: { access_token: 'token' } as any,
      userRole: 'admin',
      isLoading: false,
      isRoleLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      signOut: vi.fn(),
      refreshToken: vi.fn(),
      getValidToken: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/superadmin']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.queryByText(/Governance Platform/i)).not.toBeInTheDocument();
  });

  /* ─────────────────────────────────────────────────────────────────────────────
   * 2. SuperAdminLayout UI & Sidebar Navigation
   * ───────────────────────────────────────────────────────────────────────────── */
  it('renders SuperAdminLayout with navy sidebar, navigation items, and governance badge', () => {
    render(
      <MemoryRouter initialEntries={['/superadmin']}>
        <SuperAdminLayout />
      </MemoryRouter>
    );

    expect(screen.getByText('Governance Platform')).toBeInTheDocument();
    expect(screen.getAllByText('NagarWatch').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Overview').length).toBeGreaterThan(0);
    expect(screen.getByText('Wards')).toBeInTheDocument();
    expect(screen.getByText('Administrators')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Audit Logs')).toBeInTheDocument();
  });

  /* ─────────────────────────────────────────────────────────────────────────────
   * 3. SuperAdminOverviewPage
   * ───────────────────────────────────────────────────────────────────────────── */
  it('loads real governance statistics on SuperAdminOverviewPage', async () => {
    render(
      <MemoryRouter>
        <SuperAdminOverviewPage />
      </MemoryRouter>
    );

    // Verification of metrics loaded from API
    await waitFor(() => {
      expect(screen.getByText('127')).toBeInTheDocument(); // Total Users
      expect(screen.getByText('120')).toBeInTheDocument(); // Citizens
      expect(screen.getByText('5')).toBeInTheDocument(); // Ward Admins
      expect(screen.getByText('3')).toBeInTheDocument(); // Total Wards
      expect(screen.getByText('45')).toBeInTheDocument(); // Total Incidents
      expect(screen.getByText('Aditi Sharma')).toBeInTheDocument(); // Recent user
      expect(screen.getByText('Road Hazard')).toBeInTheDocument(); // Recent incident
    });
  });

  /* ─────────────────────────────────────────────────────────────────────────────
   * 4. SuperAdminWardsPage (CRUD & PostGIS Inspector)
   * ───────────────────────────────────────────────────────────────────────────── */
  it('renders ward directory, search filtering, and opens create modal', async () => {
    render(
      <MemoryRouter>
        <SuperAdminWardsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Ward 1 - Central Market')).toBeInTheDocument();
      expect(screen.getByText('Ward 2 - South Harbor')).toBeInTheDocument();
      expect(screen.getByText('Officer Ramesh, Officer Priya')).toBeInTheDocument();
    });

    // Test Search filter
    const searchInput = screen.getByPlaceholderText(/Search by ward name, ID, or administrator/i);
    fireEvent.change(searchInput, { target: { value: 'Central' } });

    expect(screen.getByText('Ward 1 - Central Market')).toBeInTheDocument();
    expect(screen.queryByText('Ward 2 - South Harbor')).not.toBeInTheDocument();

    // Open Create Modal
    const createBtn = screen.getByText('Create New Ward');
    fireEvent.click(createBtn);

    expect(screen.getByText('Create Municipal Ward')).toBeInTheDocument();
    expect(screen.getByText('PostGIS Geometry (WKT)')).toBeInTheDocument();
  });

  it('submits a new ward with WKT geometry', async () => {
    render(
      <MemoryRouter>
        <SuperAdminWardsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Ward 1 - Central Market')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Create New Ward'));

    const nameInput = screen.getByPlaceholderText(/e.g. Ward 14 - Kaloor Central/i);
    fireEvent.change(nameInput, { target: { value: 'Ward 3 - North Hill' } });

    // Click Load Sample WKT
    fireEvent.click(screen.getByText('Load Sample WKT'));

    const submitBtn = screen.getByText('Save Municipal Ward');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/superadmin/wards',
        expect.objectContaining({
          name: 'Ward 3 - North Hill',
          geom_wkt: expect.stringContaining('POLYGON'),
        })
      );
    });
  });

  /* ─────────────────────────────────────────────────────────────────────────────
   * 5. SuperAdminAdminsPage (Directory & Ward Allocation)
   * ───────────────────────────────────────────────────────────────────────────── */
  it('displays administrator registry and allows opening assign ward modal', async () => {
    render(
      <MemoryRouter>
        <SuperAdminAdminsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Officer Ramesh')).toBeInTheDocument();
      expect(screen.getByText('Chief Commissioner')).toBeInTheDocument();
      expect(screen.getByText('Universal Municipal Access (All Wards)')).toBeInTheDocument();
    });

    // Click Assign Ward for Officer Ramesh
    const assignButtons = screen.getAllByText('Assign Ward');
    fireEvent.click(assignButtons[0]);

    expect(screen.getByText('Assign Ward Jurisdiction')).toBeInTheDocument();
  });

  /* ─────────────────────────────────────────────────────────────────────────────
   * 6. SuperAdminUsersPage (Privacy-Preserving PII Directory)
   * ───────────────────────────────────────────────────────────────────────────── */
  it('displays user directory with masked phone numbers and opens profile modal', async () => {
    render(
      <MemoryRouter>
        <SuperAdminUsersPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Citizen Ananya')).toBeInTheDocument();
      expect(screen.getByText('984****5678')).toBeInTheDocument(); // Masked phone
      expect(screen.getByText('Citizen Vikram')).toBeInTheDocument();
      expect(screen.getByText('912****3456')).toBeInTheDocument(); // Masked phone
    });

    // Click Details button
    const detailsButtons = screen.getAllByText('Details');
    fireEvent.click(detailsButtons[0]);

    expect(screen.getByText('User Account Profile')).toBeInTheDocument();
    expect(screen.getByText(/Personally identifiable information \(PII\) is masked/i)).toBeInTheDocument();
  });

  /* ─────────────────────────────────────────────────────────────────────────────
   * 7. SuperAdminAuditPage (Immutable Trigger Ledger)
   * ───────────────────────────────────────────────────────────────────────────── */
  it('displays immutable status transitions and resolution notes', async () => {
    render(
      <MemoryRouter>
        <SuperAdminAuditPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Cryptographically Verified Incident Lifecycle Ledger')).toBeInTheDocument();
      expect(screen.getByText('Road inspector confirmed pothole dimension and safety priority.')).toBeInTheDocument();
      expect(screen.getByText('Asphalt patching complete. Water runoff diverted.')).toBeInTheDocument();
      expect(screen.getAllByText('Officer Ramesh').length).toBeGreaterThan(0);
    });
  });
});
