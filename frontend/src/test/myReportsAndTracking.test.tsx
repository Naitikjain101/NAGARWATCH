import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from '../pages/Dashboard';
import apiClient from '../lib/apiClient';
import * as AuthContextModule from '../context/AuthContext';

describe('Phase 5C: My Reports, Incident Tracking & Personal Civic Activity', () => {
  const mockCitizenReports = [
    {
      id: 'rep-001-crater',
      category: 'Pothole',
      description: 'Massive crater near market entrance damaging scooters',
      status: 'in_progress',
      severity: 'critical',
      image_url: 'https://example.com/pothole.jpg',
      created_at: '2026-10-28T09:00:00Z',
      updated_at: '2026-10-29T14:00:00Z',
      ward_id: 1,
      ward_name: 'Ward 1 - Central Zone',
      latitude: 9.5912,
      longitude: 76.5212,
      upvotes: 8,
      confirmations_count: 8,
      disputes_count: 1,
    },
    {
      id: 'rep-002-streetlight',
      category: 'Streetlight',
      description: 'Streetlight pole #42 dark for 5 consecutive nights',
      status: 'verified',
      severity: 'medium',
      image_url: 'https://example.com/light.jpg',
      created_at: '2026-10-25T11:30:00Z',
      updated_at: '2026-10-26T16:00:00Z',
      ward_id: 2,
      ward_name: 'Ward 2 - East Zone',
      latitude: 9.5934,
      longitude: 76.5234,
      upvotes: 4,
      confirmations_count: 4,
      disputes_count: 0,
    },
    {
      id: 'rep-003-garbage',
      category: 'Garbage',
      description: 'Solid waste overflowing from municipal container',
      status: 'resolved',
      severity: 'low',
      image_url: 'https://example.com/garbage.jpg',
      created_at: '2026-10-15T08:00:00Z',
      updated_at: '2026-10-16T12:00:00Z',
      ward_id: 1,
      ward_name: 'Ward 1 - Central Zone',
      latitude: 9.5956,
      longitude: 76.5256,
      upvotes: 12,
      confirmations_count: 12,
      disputes_count: 0,
      resolution_notes: 'Sanitation team cleaned bin and sanitized perimeter',
      proof_media_url: 'https://example.com/proof-cleaned.jpg',
    },
    {
      id: 'rep-004-rejected',
      category: 'Encroachment',
      description: 'Disputed compound boundary extension',
      status: 'rejected',
      severity: 'low',
      image_url: 'https://example.com/boundary.jpg',
      created_at: '2026-10-10T10:00:00Z',
      updated_at: '2026-10-11T11:00:00Z',
      ward_id: 3,
      ward_name: 'Ward 3 - West Zone',
      latitude: 9.598,
      longitude: 76.528,
      upvotes: 0,
      confirmations_count: 0,
      disputes_count: 2,
    },
  ];

  const mockNotifications = [
    {
      id: 'notif-1',
      incident_id: 'rep-001-crater',
      title: 'Incident Status Updated to In Progress',
      body: 'Your reported Pothole has been assigned to Ward Works Crew #3.',
      type: 'status_update',
      is_read: false,
      created_at: '2026-10-29T14:00:00Z',
    },
    {
      id: 'notif-2',
      incident_id: 'rep-003-garbage',
      title: 'Incident Resolved',
      body: 'Your reported Garbage has been cleaned by Municipal Sanitation.',
      type: 'status_update',
      is_read: true,
      created_at: '2026-10-16T12:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'citizen-user-123', email: 'citizen@nagarwatch.org' } as any,
      session: { access_token: 'mock-jwt-token' } as any,
      userRole: 'citizen',
      accessToken: 'mock-jwt-token',
      sessionLoading: false,
      roleLoading: false,
      loading: false,
      roleError: null,
      retryRoleFetch: vi.fn(),
      signOut: vi.fn(),
    });

    vi.spyOn(apiClient, 'get').mockImplementation((url: string) => {
      if (url === '/api/v1/incidents/me') {
        return Promise.resolve({
          data: {
            status: 'Success',
            data: mockCitizenReports,
            count: mockCitizenReports.length,
            total: mockCitizenReports.length,
          },
        } as any);
      }
      if (url === '/api/v1/notifications/me') {
        return Promise.resolve({
          data: {
            status: 'Success',
            data: mockNotifications,
            count: mockNotifications.length,
          },
        } as any);
      }
      if (url.startsWith('/api/v1/incidents/rep-001-crater') || url.startsWith('/api/v1/incidents/me/rep-001-crater')) {
        return Promise.resolve({
          data: {
            status: 'Success',
            data: {
              ...mockCitizenReports[0],
              status_history: [
                {
                  old_status: 'reported',
                  new_status: 'verified',
                  notes: 'Verified by Field Inspector #4',
                  created_at: '2026-10-28T12:00:00Z',
                },
                {
                  old_status: 'verified',
                  new_status: 'in_progress',
                  notes: 'Road crew dispatched with bitumen patcher',
                  created_at: '2026-10-29T14:00:00Z',
                },
              ],
              media: [
                {
                  id: 'media-1',
                  media_type: 'image/jpeg',
                  media_url: 'https://example.com/pothole.jpg',
                  has_exif_gps: true,
                },
              ],
            },
          },
        } as any);
      }
      return Promise.reject(new Error(`Unhandled GET url: ${url}`));
    });

    vi.spyOn(apiClient, 'patch').mockImplementation((url: string) => {
      if (url.includes('/read')) {
        return Promise.resolve({
          data: {
            status: 'Success',
            message: 'Notification marked as read',
          },
        } as any);
      }
      return Promise.reject(new Error(`Unhandled PATCH url: ${url}`));
    });
  });

  it('renders My Reports dashboard with KPI summary metrics from authentic data', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    // Verify Title and Subtitle
    expect(screen.getByText('My Reports')).toBeInTheDocument();
    expect(
      screen.getByText(/Track the status, municipal triage, and resolution progress/i)
    ).toBeInTheDocument();

    // Verify KPI summary metrics
    await waitFor(() => {
      expect(screen.getByText('Total Reports')).toBeInTheDocument();
      expect(screen.getByText('Active Triage')).toBeInTheDocument();
      expect(screen.getByText('Endorsements')).toBeInTheDocument();
      expect(screen.getAllByText('Resolved').length).toBeGreaterThanOrEqual(1);
    });

    // Total: 4, Active: 2 (in_progress, verified), Resolved: 1 (resolved), Endorsements: 8 + 4 + 12 = 24
    expect(screen.getAllByText('4').length).toBeGreaterThanOrEqual(1); // Total Reports
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1); // Active Triage
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1); // Resolved
    expect(screen.getByText('24')).toBeInTheDocument(); // Endorsements
  });

  it('renders all personal incident cards with reference ID, badges, GPS, and community confirmations', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Massive crater near market entrance damaging scooters')).toBeInTheDocument();
    });

    // Reference ID display
    expect(screen.getByText('#rep-001-')).toBeInTheDocument();
    expect(screen.getByText('#rep-002-')).toBeInTheDocument();
    expect(screen.getByText('#rep-003-')).toBeInTheDocument();
    expect(screen.getByText('#rep-004-')).toBeInTheDocument();

    // Severity badges
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();

    // Ward associations
    expect(screen.getAllByText('Ward 1 - Central Zone').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Ward 2 - East Zone')).toBeInTheDocument();

    // Coordinates
    expect(screen.getByText('9.5912, 76.5212')).toBeInTheDocument();

    // Endorsements (8 for rep-1, 4 for rep-2, 12 for rep-3)
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getAllByText('4').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('filters personal reports by status', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Massive crater near market entrance damaging scooters')).toBeInTheDocument();
    });

    // Change status filter to 'resolved'
    const statusSelect = screen.getByDisplayValue('All Statuses');
    fireEvent.change(statusSelect, { target: { value: 'resolved' } });

    await waitFor(() => {
      expect(screen.getByText('Solid waste overflowing from municipal container')).toBeInTheDocument();
      expect(
        screen.queryByText('Massive crater near market entrance damaging scooters')
      ).not.toBeInTheDocument();
    });

    // Filter by 'rejected'
    fireEvent.change(statusSelect, { target: { value: 'rejected' } });

    await waitFor(() => {
      expect(screen.getByText('Disputed compound boundary extension')).toBeInTheDocument();
      expect(
        screen.queryByText('Solid waste overflowing from municipal container')
      ).not.toBeInTheDocument();
    });
  });

  it('filters personal reports by category and keyword search', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Massive crater near market entrance damaging scooters')).toBeInTheDocument();
    });

    // Category filter to 'Streetlight'
    const categorySelect = screen.getByDisplayValue('All Categories');
    fireEvent.change(categorySelect, { target: { value: 'Streetlight' } });

    await waitFor(() => {
      expect(screen.getByText('Streetlight pole #42 dark for 5 consecutive nights')).toBeInTheDocument();
      expect(screen.queryByText('Massive crater near market entrance damaging scooters')).not.toBeInTheDocument();
    });

    // Reset category filter
    fireEvent.change(categorySelect, { target: { value: 'all' } });

    // Keyword search
    const searchInput = screen.getByPlaceholderText(/Search your reports by keyword or ID/i);
    fireEvent.change(searchInput, { target: { value: 'crater' } });

    await waitFor(() => {
      expect(screen.getByText('Massive crater near market entrance damaging scooters')).toBeInTheDocument();
      expect(screen.queryByText('Streetlight pole #42 dark for 5 consecutive nights')).not.toBeInTheDocument();
    });

    // Clear filters button resets everything
    const clearBtn = screen.getByRole('button', { name: /Clear Filters/i });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(screen.getByText('Massive crater near market entrance damaging scooters')).toBeInTheDocument();
      expect(screen.getByText('Streetlight pole #42 dark for 5 consecutive nights')).toBeInTheDocument();
    });
  });

  it('sorts personal reports by oldest and recently updated', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Massive crater near market entrance damaging scooters')).toBeInTheDocument();
    });

    // Default is newest first (rep-001: Oct 28 > rep-002: Oct 25 > rep-003: Oct 15 > rep-004: Oct 10)
    const sortSelect = screen.getByDisplayValue('Newest First');
    fireEvent.change(sortSelect, { target: { value: 'oldest' } });

    // In oldest first, rep-004 (Oct 10) appears at the top
    const cards = screen.getAllByRole('heading', { level: 3 });
    expect(cards[0]).toHaveTextContent('Encroachment'); // rep-004
  });

  it('manages personal in-app notifications and marks as read', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    // Notification updates button with 1 unread badge
    await waitFor(() => {
      const updatesBtn = screen.getByRole('button', { name: /Updates/i });
      expect(updatesBtn).toBeInTheDocument();
      expect(within(updatesBtn).getByText('1')).toBeInTheDocument();
    });

    // Open notifications panel
    fireEvent.click(screen.getByRole('button', { name: /Updates/i }));

    await waitFor(() => {
      expect(screen.getByText('Personal Incident Notifications')).toBeInTheDocument();
      expect(screen.getByText('Incident Status Updated to In Progress')).toBeInTheDocument();
      expect(screen.getByText('Incident Resolved')).toBeInTheDocument();
    });

    // Click "Mark read"
    const markReadBtn = screen.getByRole('button', { name: /Mark read/i });
    fireEvent.click(markReadBtn);

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/notifications/notif-1/read');
    });
  });

  it('copies reference ID to clipboard on click', async () => {
    // Mock navigator.clipboard
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('#rep-001-')).toBeInTheDocument();
    });

    const copyBtn = screen.getByText('#rep-001-').closest('button');
    expect(copyBtn).toBeInTheDocument();
    fireEvent.click(copyBtn!);

    expect(mockClipboard.writeText).toHaveBeenCalledWith('rep-001-crater');
  });

  it('opens tracking modal with lifecycle history and transitions when card is clicked', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Massive crater near market entrance damaging scooters')).toBeInTheDocument();
    });

    // Click card to open IssueDetailsModal
    fireEvent.click(screen.getByText('Massive crater near market entrance damaging scooters'));

    // Modal opens and loads lifecycle timeline
    await waitFor(() => {
      expect(screen.getByText('Verified Status History')).toBeInTheDocument();
      expect(screen.getByText('Report Submitted')).toBeInTheDocument();
      expect(screen.getByText('Verified by Field Inspector #4')).toBeInTheDocument();
      expect(screen.getByText('Road crew dispatched with bitumen patcher')).toBeInTheDocument();
    });
  });

  it('displays empty state when citizen has no submitted reports', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation((url: string) => {
      if (url === '/api/v1/incidents/me') {
        return Promise.resolve({
          data: {
            status: 'Success',
            data: [],
            count: 0,
            total: 0,
          },
        } as any);
      }
      return Promise.resolve({ data: { data: [] } } as any);
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No reports submitted yet')).toBeInTheDocument();
      expect(
        screen.getByText(/You haven't reported any civic incidents/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Report an Issue/i })).toBeInTheDocument();
    });
  });

  it('displays error state on network failure and allows retry', async () => {
    vi.spyOn(apiClient, 'get').mockImplementationOnce(() =>
      Promise.reject({
        code: 'ERR_NETWORK',
        response: undefined,
      })
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Could Not Load Reports')).toBeInTheDocument();
      expect(
        screen.getByText('Cannot connect to NagarWatch server. Please check your network.')
      ).toBeInTheDocument();
    });

    // Click Try Again
    const retryBtn = screen.getByRole('button', { name: /Try Again/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/incidents/me');
    });
  });
});
