import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import App from '../App';
import { AdminLayout } from '../components/layout/AdminLayout';
import { AdminOverviewPage } from '../pages/admin/AdminOverviewPage';
import { AdminIncidentsPage } from '../pages/admin/AdminIncidentsPage';
import { AdminWardPage } from '../pages/admin/AdminWardPage';
import { AdminProfilePage } from '../pages/admin/AdminProfilePage';
import apiClient from '../lib/apiClient';
import * as AuthContextModule from '../context/AuthContext';

const mockIncidents = [
  {
    id: 'inc-001',
    category: 'Pothole',
    description: 'Deep pothole on Main Street near junction',
    status: 'reported',
    image_url: 'https://storage.supabase.co/pothole.jpg',
    created_at: '2026-10-30T10:00:00Z',
    ward_id: 1,
    latitude: 9.5123,
    longitude: 76.5123,
    upvotes: 4,
    severity: 'high',
  },
  {
    id: 'inc-002',
    category: 'Streetlight',
    description: 'Broken streetlight outside clinic',
    status: 'verified',
    image_url: 'https://storage.supabase.co/light.jpg',
    created_at: '2026-10-29T15:00:00Z',
    ward_id: 1,
    latitude: 9.5145,
    longitude: 76.5145,
    upvotes: 2,
    severity: 'medium',
  },
  {
    id: 'inc-003',
    category: 'Garbage',
    description: 'Overflowing dumpster in park',
    status: 'resolved',
    image_url: '',
    created_at: '2026-10-28T12:00:00Z',
    ward_id: 1,
    latitude: 9.518,
    longitude: 76.518,
    upvotes: 1,
    severity: 'low',
  },
];

const mockWards = [
  {
    id: 1,
    name: 'Ward 1 - Central Market',
    geom: {
      type: 'Polygon',
      coordinates: [
        [
          [76.51, 9.51],
          [76.52, 9.51],
          [76.52, 9.52],
          [76.51, 9.52],
          [76.51, 9.51],
        ],
      ],
    },
  },
];

describe('Phase 3F: Ward Administrator Application', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock as Ward Admin
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'admin-uuid-1',
        email: 'wardadmin@nagarwatch.org',
        user_metadata: { full_name: 'Ward Admin Officer' },
      } as any,
      session: { access_token: 'admin-token' } as any,
      userRole: 'admin',
      accessToken: 'admin-token',
      sessionLoading: false,
      roleLoading: false,
      loading: false,
      roleError: null,
      retryRoleFetch: vi.fn(),
      signOut: vi.fn(),
    });
  });

  describe('1. Admin Route Protection & RBAC', () => {
    it('redirects non-admin citizens away from /admin routes', () => {
      // Switch user to citizen
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: { id: 'citizen-uuid-9', email: 'citizen@example.com' } as any,
        session: { access_token: 'citizen-token' } as any,
        userRole: 'citizen',
        accessToken: 'citizen-token',
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

      // Should be redirected to citizen home
      expect(screen.queryByText('Operational Overview')).not.toBeInTheDocument();
      expect(screen.getByText('Report an Issue')).toBeInTheDocument();
    });

    it('permits access to /admin when authenticated with verified admin role', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: { status: 'Success', data: mockIncidents },
      } as any);

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Operational Overview')).toBeInTheDocument();
      });
    });

    it('redirects /admin/issues to /admin/incidents for backward compatibility', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: { status: 'Success', data: mockIncidents },
      } as any);

      render(
        <MemoryRouter initialEntries={['/admin/issues']}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Incident Management')).toBeInTheDocument();
      });
    });
  });

  describe('2. Admin Layout & Navigation', () => {
    it('renders all sidebar navigation links on desktop', () => {
      render(
        <MemoryRouter initialEntries={['/admin']}>
          <AdminLayout />
        </MemoryRouter>
      );

      expect(screen.getAllByText('Overview').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Incidents').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Ward Map').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Ward Info').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Profile').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Public Portal').length).toBeGreaterThan(0);
    });

    it('toggles mobile navigation drawer on hamburger button click', () => {
      render(
        <MemoryRouter initialEntries={['/admin']}>
          <AdminLayout />
        </MemoryRouter>
      );

      const menuBtn = screen.getByLabelText(/Open mobile menu/i);
      expect(menuBtn).toBeInTheDocument();

      fireEvent.click(menuBtn);

      // Mobile drawer should open and display close button
      const closeBtn = screen.getByLabelText(/Close menu/i);
      expect(closeBtn).toBeInTheDocument();

      fireEvent.click(closeBtn);
      expect(screen.queryByLabelText(/Close menu/i)).not.toBeInTheDocument();
    });
  });

  describe('3. Admin Overview Dashboard', () => {
    it('calculates and renders real statistics from loaded incidents', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: { status: 'Success', data: mockIncidents },
      } as any);

      render(
        <MemoryRouter>
          <AdminOverviewPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Operational Overview')).toBeInTheDocument();
      });

      // Metric labels
      expect(screen.getByText('Accessible Reports')).toBeInTheDocument();
      expect(screen.getByText('Awaiting Review')).toBeInTheDocument();
      expect(screen.getByText('Community Upvoted')).toBeInTheDocument();
      // Priority incidents section should render high-severity item
      expect(screen.getByText('Priority Incidents Requiring Action')).toBeInTheDocument();
      expect(screen.getAllByText('Deep pothole on Main Street near junction').length).toBeGreaterThan(0);
    });
  });

  describe('4. Incident Management & Filtering', () => {
    it('filters incidents by search query in real time', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: { status: 'Success', data: mockIncidents },
      } as any);

      render(
        <MemoryRouter>
          <AdminIncidentsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Deep pothole on Main Street near junction')).toBeInTheDocument();
        expect(screen.getByText('Broken streetlight outside clinic')).toBeInTheDocument();
      });

      // Search for "streetlight"
      const searchInput = screen.getByPlaceholderText(/Search category, description, ID/i);
      fireEvent.change(searchInput, { target: { value: 'streetlight' } });

      expect(screen.getByText('Broken streetlight outside clinic')).toBeInTheDocument();
      expect(screen.queryByText('Deep pothole on Main Street near junction')).not.toBeInTheDocument();
    });

    it('filters incidents by status', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: { status: 'Success', data: mockIncidents },
      } as any);

      render(
        <MemoryRouter>
          <AdminIncidentsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Deep pothole on Main Street near junction')).toBeInTheDocument();
      });

      // Select status "resolved"
      const statusSelects = screen.getAllByRole('combobox');
      const statusSelect = statusSelects[1]; // Second select is Status
      fireEvent.change(statusSelect, { target: { value: 'resolved' } });

      expect(screen.getByText('Overflowing dumpster in park')).toBeInTheDocument();
      expect(screen.queryByText('Deep pothole on Main Street near junction')).not.toBeInTheDocument();
    });

    it('opens status change modal and submits PATCH request with confirmation', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: { status: 'Success', data: mockIncidents },
      } as any);

      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        data: { status: 'Success', incident_id: 'inc-001', new_status: 'resolved' },
      } as any);

      render(
        <MemoryRouter>
          <AdminIncidentsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Deep pothole on Main Street near junction')).toBeInTheDocument();
      });

      // Click "Update Status" on first incident
      const updateBtns = screen.getAllByRole('button', { name: /Update Status/i });
      fireEvent.click(updateBtns[0]);

      expect(screen.getByText(/Update Incident #inc-001/i)).toBeInTheDocument();

      // Change status to "resolved"
      const modalSelect = screen.getByLabelText(/Select New Status/i);
      fireEvent.change(modalSelect, { target: { value: 'resolved' } });

      // First click asks for confirmation because 'resolved' is high impact
      const submitBtn = screen.getByRole('button', { name: /Apply Status Change/i });
      fireEvent.click(submitBtn);

      expect(screen.getByText(/Please Confirm Status Transition/i)).toBeInTheDocument();

      // Click Confirm & Apply
      const confirmBtn = screen.getByRole('button', { name: /Confirm & Apply/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(patchSpy).toHaveBeenCalledWith(
          '/api/v1/admin/incidents/inc-001/status',
          expect.objectContaining({ status: 'resolved' })
        );
      });
    });

    it('handles 403 Out of Jurisdiction error when updating unassigned ward', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: { status: 'Success', data: mockIncidents },
      } as any);

      vi.spyOn(apiClient, 'patch').mockRejectedValueOnce({
        response: {
          status: 403,
          data: {
            error: 'Forbidden',
            code: 'OUT_OF_JURISDICTION',
            message: 'Incident belongs to ward 2, which is not in your assigned wards.',
          },
        },
      } as any);

      render(
        <MemoryRouter>
          <AdminIncidentsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Deep pothole on Main Street near junction')).toBeInTheDocument();
      });

      const updateBtns = screen.getAllByRole('button', { name: /Update Status/i });
      fireEvent.click(updateBtns[0]);

      const submitBtn = screen.getByRole('button', { name: /Apply Status Change/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/Out of Jurisdiction: You are not authorized to modify incidents outside your assigned ward/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('5. Ward Information Page', () => {
    it('displays assigned ward boundary details without fabricating population or scores', async () => {
      vi.spyOn(apiClient, 'get').mockImplementation((url: string) => {
        if (url === '/api/v1/users/me') {
          return Promise.resolve({
            data: {
              status: 'Success',
              data: { id: 'admin-uuid-1', role: 'admin', wards_allocated: [1] },
            },
          } as any);
        }
        if (url === '/api/v1/wards') {
          return Promise.resolve({
            data: { status: 'Success', data: mockWards },
          } as any);
        }
        if (url === '/api/v1/admin/incidents') {
          return Promise.resolve({
            data: { status: 'Success', data: mockIncidents },
          } as any);
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(
        <MemoryRouter>
          <AdminWardPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Assigned Ward Information')).toBeInTheDocument();
      });

      expect(screen.getByText('Ward 1 - Central Market')).toBeInTheDocument();
      expect(screen.getByText('Ward #1')).toBeInTheDocument();
      expect(screen.getByText('Polygon')).toBeInTheDocument();
    });
  });

  describe('6. Admin Profile Page', () => {
    it('displays administrator credentials, role badge, and RBAC governance notice', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: {
          status: 'Success',
          data: {
            id: 'admin-uuid-1',
            role: 'admin',
            full_name: 'Ward Officer Sharma',
            email: 'sharma@nagarwatch.org',
            phone_number: '+919876543210',
            wards_allocated: [1],
          },
        },
      } as any);

      render(
        <MemoryRouter>
          <AdminProfilePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Ward Officer Sharma')).toBeInTheDocument();
      });

      expect(screen.getByText('Ward Administrator')).toBeInTheDocument();
      expect(screen.getByText('sharma@nagarwatch.org')).toBeInTheDocument();
      expect(screen.getByText('+919876543210')).toBeInTheDocument();
      expect(screen.getByText('Ward #1')).toBeInTheDocument();
      expect(screen.getByText(/Role Escalation & RBAC Protection/i)).toBeInTheDocument();
    });
  });
});
