import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../pages/Home';
import ExplorePage from '../pages/CivicMedia';
import IssueDetailsModal from '../components/IssueDetailsModal';
import apiClient from '../lib/apiClient';
import * as AuthContextModule from '../context/AuthContext';

describe('Phase 3D: Citizen Home & Explore Experience', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'citizen-user-1', phone: '+919876543210' } as any,
      session: { access_token: 'valid-token' } as any,
      userRole: 'citizen',
      accessToken: 'valid-token',
      sessionLoading: false,
      roleLoading: false,
      loading: false,
      roleError: null,
      retryRoleFetch: vi.fn(),
      signOut: vi.fn(),
    });
  });

  describe('Home Page', () => {
    it('renders hero welcome section and civic platform pillars', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: {
          data: [{ id: 1, name: 'Central Ward' }],
        },
      } as any).mockResolvedValueOnce({
        data: {
          ward_name: 'Central Ward',
          data: [
            {
              id: 'inc-1',
              category: 'Pothole',
              description: 'Large crater on Main St.',
              status: 'in_progress',
              created_at: '2026-10-30T10:00:00Z',
              latitude: 9.59,
              longitude: 76.52,
              upvotes: 4,
            },
          ],
        },
      } as any);

      render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      );

      // Hero
      expect(screen.getByText(/Empowering Citizens/i)).toBeInTheDocument();
      expect(screen.getByText(/Resolving Civic Issues/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Report an Issue/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Explore Neighbourhood/i })).toBeInTheDocument();

      // Platform pillars
      expect(screen.getByText('Verified Spatial Integrity')).toBeInTheDocument();
      expect(screen.getByText('Live Neighbourhood Discovery')).toBeInTheDocument();
      expect(screen.getByText('Transparent Resolution')).toBeInTheDocument();

      // Recent incidents loaded from API
      await waitFor(() => {
        expect(screen.getAllByText('Pothole').length).toBeGreaterThan(0);
        expect(screen.getByText('Large crater on Main St.')).toBeInTheDocument();
      });
    });

    it('opens issue details modal when a recent incident card is clicked', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: { data: [{ id: 1, name: 'Ward 1' }] },
      } as any).mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'inc-click-1',
              category: 'Streetlight',
              description: 'Flickering street light pole #42',
              status: 'reported',
              created_at: '2026-10-30T10:00:00Z',
              latitude: 9.591,
              longitude: 76.521,
              upvotes: 2,
            },
          ],
        },
      } as any);

      render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Flickering street light pole #42')).toBeInTheDocument();
      });

      // Click card to open modal
      fireEvent.click(screen.getByText('Flickering street light pole #42'));

      // Modal should appear
      await waitFor(() => {
        expect(screen.getByText('Complaint #inc-clic')).toBeInTheDocument();
      });
    });
  });

  describe('Explore Page (CivicMedia)', () => {
    const mockExploreIncidents = [
      {
        id: 'inc-pothole',
        category: 'Pothole',
        description: 'Road damage near market',
        status: 'in_progress',
        created_at: '2026-10-30T10:00:00Z',
        latitude: 9.592,
        longitude: 76.522,
        upvotes: 5,
      },
      {
        id: 'inc-garbage',
        category: 'Garbage',
        description: 'Overflowing dumpster near park',
        status: 'reported',
        created_at: '2026-10-30T11:00:00Z',
        latitude: 9.593,
        longitude: 76.523,
        upvotes: 1,
      },
      {
        id: 'inc-water',
        category: 'Water Leak',
        description: 'Broken water pipe leaking clean water',
        status: 'resolved',
        created_at: '2026-10-30T09:00:00Z',
        latitude: 9.594,
        longitude: 76.524,
        upvotes: 8,
      },
    ];

    it('renders filtered results when category filter is selected', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: {
          data: [{ id: 1, name: 'North Ward' }],
        },
      } as any).mockResolvedValueOnce({
        data: {
          ward_name: 'North Ward',
          ward_id: 1,
          data: mockExploreIncidents,
        },
      } as any);

      render(
        <MemoryRouter initialEntries={['/explore?ward_id=1']}>
          <ExplorePage />
        </MemoryRouter>
      );

      // Wait for incidents to load
      await waitFor(() => {
        expect(screen.getByText('Road damage near market')).toBeInTheDocument();
        expect(screen.getByText('Overflowing dumpster near park')).toBeInTheDocument();
        expect(screen.getByText('Broken water pipe leaking clean water')).toBeInTheDocument();
      });

      // Filter by Category = 'Garbage'
      const categorySelect = screen.getByDisplayValue('All Categories');
      fireEvent.change(categorySelect, { target: { value: 'Garbage' } });

      // Only Garbage incident should be visible
      expect(screen.getByText('Overflowing dumpster near park')).toBeInTheDocument();
      expect(screen.queryByText('Road damage near market')).not.toBeInTheDocument();
      expect(screen.queryByText('Broken water pipe leaking clean water')).not.toBeInTheDocument();

      // Click Clear Filters
      const clearBtn = screen.getByRole('button', { name: /Clear/i });
      fireEvent.click(clearBtn);

      // All incidents restored
      expect(screen.getByText('Road damage near market')).toBeInTheDocument();
      expect(screen.getByText('Overflowing dumpster near park')).toBeInTheDocument();
      expect(screen.getByText('Broken water pipe leaking clean water')).toBeInTheDocument();
    });

    it('filters incidents by search input text', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: { data: [{ id: 1, name: 'North Ward' }] },
      } as any).mockResolvedValueOnce({
        data: {
          ward_name: 'North Ward',
          ward_id: 1,
          data: mockExploreIncidents,
        },
      } as any);

      render(
        <MemoryRouter initialEntries={['/explore?ward_id=1']}>
          <ExplorePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Road damage near market')).toBeInTheDocument();
      });

      // Type "water pipe" in search input
      const searchInput = screen.getByPlaceholderText(/Search by category or description/i);
      fireEvent.change(searchInput, { target: { value: 'water pipe' } });

      expect(screen.getByText('Broken water pipe leaking clean water')).toBeInTheDocument();
      expect(screen.queryByText('Road damage near market')).not.toBeInTheDocument();
    });
  });

  describe('IssueDetailsModal Privacy & Verification', () => {
    it('displays incident metadata while strictly protecting citizen privacy', () => {
      const mockIssue = {
        id: 'uuid-secret-12345678',
        category: 'Water Leak',
        description: 'Main pipe burst on 4th cross road.',
        status: 'in_progress',
        image_url: 'https://example.com/photo.jpg',
        created_at: '2026-10-30T08:00:00Z',
        latitude: 9.598765,
        longitude: 76.523456,
        upvotes: 7,
        phone_number: '+919999900000', // Private phone number!
      };

      render(
        <IssueDetailsModal
          issue={mockIssue as any}
          onClose={vi.fn()}
        />
      );

      // Category, description, status, coordinates
      expect(screen.getAllByText('Water Leak').length).toBeGreaterThan(0);
      expect(screen.getByText('Main pipe burst on 4th cross road.')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('uuid-secret-12345678')).toBeInTheDocument();
      expect(screen.getByText('7 neighbours have verified this')).toBeInTheDocument();
      expect(screen.getByText('9.598765, 76.523456')).toBeInTheDocument();
      expect(screen.getByText('View in Google Maps')).toBeInTheDocument();

      // PRIVACY CHECK: Reporter phone number MUST NOT be in the DOM
      expect(screen.queryByText('+919999900000')).not.toBeInTheDocument();
    });
  });
});
