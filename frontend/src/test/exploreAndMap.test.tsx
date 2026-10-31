import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExplorePage from '../pages/CivicMedia';
import apiClient from '../lib/apiClient';
import * as AuthContextModule from '../context/AuthContext';

describe('Phase 5B: Explore, Live Incident Map & Incident Discovery', () => {
  const mockIncidents = [
    {
      id: 'inc-pothole-101',
      category: 'Pothole',
      description: 'Major asphalt depression causing traffic swerves',
      status: 'in_progress',
      severity: 'critical',
      image_url: 'https://example.com/pothole.jpg',
      created_at: '2026-10-30T10:00:00Z',
      latitude: 9.591234,
      longitude: 76.521234,
      ward_id: 1,
      ward_name: 'Central Ward',
      upvotes: 6,
      disputes_count: 0,
      distance_meters: 250.0,
      reporter_phone: '+919999911111', // Sensitive PII
      reporter_email: 'reporter@example.com',
      user_id: 'secret-uuid-reporter',
    },
    {
      id: 'inc-light-102',
      category: 'Streetlight',
      description: 'Dark junction with dead sodium lamp pole #14',
      status: 'reported',
      severity: 'medium',
      image_url: '',
      created_at: '2026-10-30T11:00:00Z',
      latitude: 9.593456,
      longitude: 76.523456,
      ward_id: 2,
      ward_name: 'East Ward',
      upvotes: 2,
      disputes_count: 1,
      distance_meters: 800.0,
    },
    {
      id: 'inc-garbage-103',
      category: 'Garbage',
      description: 'Overflowing commercial bins near shopping arcade',
      status: 'resolved',
      severity: 'low',
      image_url: 'https://example.com/garbage.jpg',
      created_at: '2026-10-29T15:00:00Z',
      latitude: 9.595678,
      longitude: 76.525678,
      ward_id: 1,
      ward_name: 'Central Ward',
      upvotes: 9,
      disputes_count: 0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'test-citizen-user', email: 'citizen@nagarwatch.org' } as any,
      session: { access_token: 'token-abc' } as any,
      userRole: 'citizen',
      accessToken: 'token-abc',
      sessionLoading: false,
      roleLoading: false,
      loading: false,
      roleError: null,
      retryRoleFetch: vi.fn(),
      signOut: vi.fn(),
    });
  });

  it('renders live incident cards with severity, distance, and confirmations', async () => {
    vi.spyOn(apiClient, 'get')
      .mockResolvedValueOnce({
        data: { data: [{ id: 1, name: 'Central Ward' }, { id: 2, name: 'East Ward' }] },
      } as any)
      .mockResolvedValueOnce({
        data: { status: 'Success', data: mockIncidents, total: 3 },
      } as any);

    render(
      <MemoryRouter initialEntries={['/explore']}>
        <ExplorePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Major asphalt depression causing traffic swerves')).toBeInTheDocument();
      expect(screen.getByText('Dark junction with dead sodium lamp pole #14')).toBeInTheDocument();
      expect(screen.getByText('Overflowing commercial bins near shopping arcade')).toBeInTheDocument();
    });

    // Check severity badges
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();

    // Check distance badge
    expect(screen.getByText('250m away')).toBeInTheDocument();
    expect(screen.getByText('800m away')).toBeInTheDocument();

    // Check upvotes / confirmations
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('strictly protects citizen privacy: reporter phone, email, and user UUID are never rendered', async () => {
    vi.spyOn(apiClient, 'get')
      .mockResolvedValueOnce({ data: { data: [] } } as any)
      .mockResolvedValueOnce({ data: { status: 'Success', data: mockIncidents } } as any);

    render(
      <MemoryRouter initialEntries={['/explore']}>
        <ExplorePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Major asphalt depression causing traffic swerves')).toBeInTheDocument();
    });

    // Strict PII assertions
    expect(screen.queryByText('+919999911111')).not.toBeInTheDocument();
    expect(screen.queryByText('reporter@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('secret-uuid-reporter')).not.toBeInTheDocument();
  });

  it('supports multi-criteria search by keyword and severity filtering', async () => {
    vi.spyOn(apiClient, 'get')
      .mockResolvedValueOnce({ data: { data: [] } } as any)
      .mockResolvedValueOnce({ data: { status: 'Success', data: mockIncidents } } as any);

    render(
      <MemoryRouter initialEntries={['/explore']}>
        <ExplorePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Major asphalt depression causing traffic swerves')).toBeInTheDocument();
    });

    // Filter by keyword search
    const searchInput = screen.getByPlaceholderText(/Search by category or description/i);
    fireEvent.change(searchInput, { target: { value: 'traffic' } });

    expect(screen.getByText('Major asphalt depression causing traffic swerves')).toBeInTheDocument();
    expect(screen.queryByText('Dark junction with dead sodium lamp pole #14')).not.toBeInTheDocument();

    // Filter by Severity dropdown
    const severitySelect = screen.getByDisplayValue('All Severities');
    fireEvent.change(severitySelect, { target: { value: 'critical' } });

    expect(screen.getByText('Major asphalt depression causing traffic swerves')).toBeInTheDocument();

    // Clear filters restores all incidents
    const clearBtn = screen.getByRole('button', { name: /Clear Filters/i });
    fireEvent.click(clearBtn);

    expect(screen.getByText('Dark junction with dead sodium lamp pole #14')).toBeInTheDocument();
  });

  it('supports mobile view mode toggle between map and list', async () => {
    vi.spyOn(apiClient, 'get')
      .mockResolvedValueOnce({ data: { data: [] } } as any)
      .mockResolvedValueOnce({ data: { status: 'Success', data: mockIncidents } } as any);

    render(
      <MemoryRouter initialEntries={['/explore']}>
        <ExplorePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Major asphalt depression causing traffic swerves')).toBeInTheDocument();
    });

    const listBtn = screen.getByLabelText('List view');
    fireEvent.click(listBtn);

    const mapBtn = screen.getByLabelText('Map view');
    fireEvent.click(mapBtn);
  });
});

