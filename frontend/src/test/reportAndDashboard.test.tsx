import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReportPage from '../pages/Report';
import DashboardPage from '../pages/Dashboard';
import apiClient from '../lib/apiClient';
import * as AuthContextModule from '../context/AuthContext';

describe('Phase 3E: Report an Issue & My Reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'test-citizen-id', phone: '+919876543210' } as any,
      session: { access_token: 'test-token' } as any,
      userRole: 'citizen',
      accessToken: 'test-token',
      sessionLoading: false,
      roleLoading: false,
      loading: false,
      roleError: null,
      retryRoleFetch: vi.fn(),
      signOut: vi.fn(),
    });
  });

  describe('Report Page Validation & Submission', () => {
    it('blocks submission and shows field validation errors when required fields are missing', async () => {
      render(
        <MemoryRouter>
          <ReportPage />
        </MemoryRouter>
      );

      const submitBtn = screen.getByRole('button', { name: /Submit Incident Report/i });
      fireEvent.click(submitBtn);

      // Validation errors should appear
      expect(screen.getByText('An evidence photo is required.')).toBeInTheDocument();
      expect(screen.getByText('Please provide a short description of the issue.')).toBeInTheDocument();
      expect(screen.getByText(/Incident location is required/i)).toBeInTheDocument();
    });

    it('submits valid report and renders success card', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: {
          status: 'Success',
          incident_id: 'incident-uuid-999',
          routed_to_ward: 'Central Ward',
          image_url: 'https://storage.supabase.co/image.jpg',
        },
      } as any);

      // Mock URL.createObjectURL for jsdom
      window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-image');

      render(
        <MemoryRouter>
          <ReportPage />
        </MemoryRouter>
      );

      // 1. Select a valid image file
      const file = new File(['mock content'], 'pothole.jpg', { type: 'image/jpeg' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [file] } });

      // 2. Enter description
      const descInput = screen.getByLabelText(/Description/i);
      fireEvent.change(descInput, { target: { value: 'Dangerous pothole in left traffic lane' } });

      // 3. Manually trigger location via device GPS mock or click handler
      // Simulate geolocation callback via mock navigator.geolocation
      const mockGeolocation = {
        getCurrentPosition: vi.fn().mockImplementationOnce((success) =>
          success({
            coords: {
              latitude: 9.591234,
              longitude: 76.524567,
            },
          })
        ),
      };
      (globalThis.navigator as any).geolocation = mockGeolocation;

      const deviceLocBtn = screen.getByRole('button', { name: /Use Device Location/i });
      fireEvent.click(deviceLocBtn);

      await waitFor(() => {
        expect(screen.getByText(/From Device GPS/i)).toBeInTheDocument();
      });

      // 4. Submit form
      const submitBtn = screen.getByRole('button', { name: /Submit Incident Report/i });
      fireEvent.click(submitBtn);

      // Success screen should be rendered
      await waitFor(() => {
        expect(screen.getByText('Report Submitted Successfully')).toBeInTheDocument();
        expect(screen.getByText('incident-uuid-999')).toBeInTheDocument();
        expect(screen.getByText('Central Ward')).toBeInTheDocument();
      });
    });

    it('handles duplicate detection HTTP 409 and presents duplicate modal with options', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            status: 'Duplicate',
            message: 'This issue has already been reported nearby.',
            existing_issue: {
              id: 'existing-dup-123',
              category: 'Pothole',
              description: 'Existing reported crater',
              status: 'pending',
              image_url: 'https://storage.supabase.co/dup.jpg',
              latitude: 9.59,
              longitude: 76.52,
              ward_id: 1,
            },
          },
        },
      });

      window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-image');

      render(
        <MemoryRouter>
          <ReportPage />
        </MemoryRouter>
      );

      // Fill valid fields
      const file = new File(['mock content'], 'test.jpg', { type: 'image/jpeg' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [file] } });

      const descInput = screen.getByLabelText(/Description/i);
      fireEvent.change(descInput, { target: { value: 'Another pothole report nearby' } });

      (globalThis.navigator as any).geolocation = {
        getCurrentPosition: vi.fn().mockImplementationOnce((success) =>
          success({ coords: { latitude: 9.59, longitude: 76.52 } })
        ),
      };
      fireEvent.click(screen.getByRole('button', { name: /Use Device Location/i }));

      await waitFor(() => {
        expect(screen.getByText(/From Device GPS/i)).toBeInTheDocument();
      });

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /Submit Incident Report/i }));

      // Duplicate modal appears
      await waitFor(() => {
        expect(screen.getByText('Similar Issue Nearby')).toBeInTheDocument();
        expect(screen.getByText('Existing reported crater')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Yes, it's the same/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /No, report as new/i })).toBeInTheDocument();
      });
    });

    it('rejects oversized files exceeding 15MB limit', () => {
      render(
        <MemoryRouter>
          <ReportPage />
        </MemoryRouter>
      );

      // Create a dummy file with size 16MB
      const bigFile = new File(['a'], 'giant_image.jpg', { type: 'image/jpeg' });
      Object.defineProperty(bigFile, 'size', { value: 16 * 1024 * 1024 });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [bigFile] } });

      expect(screen.getByText(/exceeds 15MB limit/i)).toBeInTheDocument();
    });
  });

  describe('My Reports Page (Dashboard)', () => {
    const mockReports = [
      {
        id: 'rep-uuid-1',
        category: 'Streetlight',
        description: 'Dark alleyway pole out of order',
        status: 'in_progress',
        image_url: 'https://example.com/pole.jpg',
        created_at: '2026-10-29T10:00:00Z',
        latitude: 9.591,
        longitude: 76.521,
        upvotes: 3,
      },
      {
        id: 'rep-uuid-2',
        category: 'Garbage',
        description: 'Uncollected bins near community hall',
        status: 'resolved',
        image_url: 'https://example.com/bins.jpg',
        created_at: '2026-10-28T09:00:00Z',
        latitude: 9.592,
        longitude: 76.522,
        upvotes: 0,
      },
    ];

    it('renders user complaints list and status badges', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: {
          data: mockReports,
        },
      } as any);

      render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Dark alleyway pole out of order')).toBeInTheDocument();
        expect(screen.getByText('Uncollected bins near community hall')).toBeInTheDocument();
        expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Resolved').length).toBeGreaterThan(0);
        expect(screen.getAllByText(/#rep-uuid/i).length).toBeGreaterThan(0);
      });
    });

    it('filters personal reports by search input', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: { data: mockReports },
      } as any);

      render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Dark alleyway pole out of order')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search your reports by keyword/i);
      fireEvent.change(searchInput, { target: { value: 'garbage' } });

      expect(screen.getByText('Uncollected bins near community hall')).toBeInTheDocument();
      expect(screen.queryByText('Dark alleyway pole out of order')).not.toBeInTheDocument();
    });

    it('renders empty state when user has no reports', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: { data: [] },
      } as any);

      render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No reports submitted yet')).toBeInTheDocument();
      });
    });

    it('opens issue details modal when clicking an incident card', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: { data: mockReports },
      } as any);

      render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Dark alleyway pole out of order')).toBeInTheDocument();
      });

      // Click card
      fireEvent.click(screen.getByText('Dark alleyway pole out of order'));

      // Modal appears
      await waitFor(() => {
        expect(screen.getByText('Complaint #rep-uuid')).toBeInTheDocument();
      });
    });
  });
});
