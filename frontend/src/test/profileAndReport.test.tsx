import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from '../pages/Profile';
import ReportPage, { CIVIC_CATEGORY_OPTIONS } from '../pages/Report';
import * as AuthContextModule from '../context/AuthContext';
import apiClient from '../lib/apiClient';
import * as locationUtils from '../lib/locationUtils';

// Mock Leaflet
vi.mock('leaflet', () => ({
  default: {
    DivIcon: vi.fn(),
  },
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: () => <div data-testid="marker" />,
  useMapEvents: () => null,
}));

describe('Phase 5A: Citizen Profile & Incident Reporting Frontend', () => {
  const mockUser = {
    id: 'user-citizen-456',
    email: 'citizen@nagarwatch.in',
    phone: '+919876543210',
    user_metadata: { full_name: 'Anita Sharma' },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: mockUser,
      session: { access_token: 'fake-jwt' } as any,
      userRole: 'citizen',
      accessToken: 'fake-jwt',
      sessionLoading: false,
      roleLoading: false,
      loading: false,
      roleError: null,
      isPasswordRecovery: false,
      clearPasswordRecovery: vi.fn(),
      retryRoleFetch: vi.fn(),
      fetchRoleForToken: vi.fn(),
      signOut: vi.fn(),
    });
  });

  // ─── 1. Citizen Profile Rendering ─────────────────────────────────────────
  it('1. Renders citizen profile information accurately from backend API', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: {
        status: 'Success',
        data: {
          id: 'user-citizen-456',
          role: 'citizen',
          full_name: 'Anita Sharma',
          email: 'citizen@nagarwatch.in',
          phone_number: '+919876543210',
          avatar_url: 'https://storage.supabase.co/avatar.jpg',
          reputation_score: 25,
          is_verified: true,
          primary_ward_id: 3,
          primary_ward_name: 'Koramangala',
          created_at: '2026-08-10T12:00:00Z',
        },
      },
    });

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByText('My Profile')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Anita Sharma')).toBeInTheDocument();
      expect(screen.getByText('citizen@nagarwatch.in')).toBeInTheDocument();
      expect(screen.getByText('+919876543210')).toBeInTheDocument();
      expect(screen.getByText(/25 Points/i)).toBeInTheDocument();
      expect(screen.getByText(/Koramangala/i)).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });
  });

  // ─── 2. Edit Profile & Save Updates ────────────────────────────────────────
  it('2. Allows editing permitted profile fields and submits PATCH /users/me', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: {
        status: 'Success',
        data: {
          id: 'user-citizen-456',
          role: 'citizen',
          full_name: 'Anita Sharma',
          email: 'citizen@nagarwatch.in',
          phone_number: '+919876543210',
          reputation_score: 25,
          is_verified: true,
        },
      },
    });

    const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
      data: {
        status: 'Success',
        data: {
          id: 'user-citizen-456',
          role: 'citizen',
          full_name: 'Anita Sharma Updated',
          email: 'citizen@nagarwatch.in',
          phone_number: '+919876543299',
          reputation_score: 25,
          is_verified: true,
        },
      },
    });

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Anita Sharma')).toBeInTheDocument();
    });

    // Enter edit mode
    fireEvent.click(screen.getByRole('button', { name: /Edit Profile/i }));

    const nameInput = screen.getByLabelText(/Full Name/i);
    const phoneInput = screen.getByLabelText(/Phone Number/i);

    fireEvent.change(nameInput, { target: { value: 'Anita Sharma Updated' } });
    fireEvent.change(phoneInput, { target: { value: '+919876543299' } });

    // Save changes
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith('/api/v1/users/me', {
        full_name: 'Anita Sharma Updated',
        phone_number: '+919876543299',
      });
      expect(screen.getByText(/Profile updated successfully!/i)).toBeInTheDocument();
      expect(screen.getByText('Anita Sharma Updated')).toBeInTheDocument();
    });
  });

  // ─── 3. Phone Number Validation Error in Profile ───────────────────────────
  it('3. Displays client validation error when phone number format is invalid', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: {
        status: 'Success',
        data: {
          id: 'user-citizen-456',
          role: 'citizen',
          full_name: 'Anita Sharma',
          email: 'citizen@nagarwatch.in',
          phone_number: '+919876543210',
        },
      },
    });

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Anita Sharma')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Edit Profile/i }));

    const phoneInput = screen.getByLabelText(/Phone Number/i);
    fireEvent.change(phoneInput, { target: { value: 'invalid-number' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/Enter a valid phone number with 7 to 15 digits/i)).toBeInTheDocument();
    });
  });

  // ─── 4. Category Options Conformity ────────────────────────────────────────
  it('4. Report form provides categories conforming strictly to database constraints', () => {
    const validDBCategories = [
      'Pothole',
      'Streetlight',
      'Garbage',
      'Graffiti',
      'Water Leak',
      'Signage',
      'Safety Hazard',
      'Encroachment',
      'Other',
    ];

    CIVIC_CATEGORY_OPTIONS.forEach((opt) => {
      expect(validDBCategories).toContain(opt.value);
    });
    expect(CIVIC_CATEGORY_OPTIONS.length).toBe(9);
  });

  // ─── 5. Form Validation on Empty Submission ────────────────────────────────
  it('5. Report form blocks submission and displays validation errors when required fields are missing', async () => {
    render(
      <MemoryRouter initialEntries={['/report']}>
        <ReportPage />
      </MemoryRouter>
    );

    const submitBtn = screen.getByRole('button', { name: /Submit Incident Report/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/An evidence photo is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Please provide a short description/i)).toBeInTheDocument();
      expect(screen.getByText(/Incident location is required/i)).toBeInTheDocument();
    });
  });

  // ─── 6. EXIF GPS Extraction from Photo ─────────────────────────────────────
  it('6. Automatically populates location coordinates when photo contains EXIF GPS', async () => {
    vi.spyOn(locationUtils, 'extractGpsFromExif').mockResolvedValueOnce({
      lat: 12.9352,
      lon: 77.6245,
    });

    render(
      <MemoryRouter initialEntries={['/report']}>
        <ReportPage />
      </MemoryRouter>
    );

    const file = new File(['fake-image-bytes'], 'exif-photo.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/From Photo EXIF/i)).toBeInTheDocument();
      expect(screen.getByText(/12.93520°, 77.62450°/i)).toBeInTheDocument();
    });
  });

  // ─── 7. Successful Incident Report Submission ──────────────────────────────
  it('7. Submits valid report via multipart form data and displays success confirmation', async () => {
    vi.spyOn(locationUtils, 'extractGpsFromExif').mockResolvedValueOnce({
      lat: 12.9716,
      lon: 77.5946,
    });

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        status: 'Success',
        incident_id: 'inc-rec-9876',
        routed_to_ward: 'Ward #5 Central',
        category: 'Pothole',
      },
    });

    render(
      <MemoryRouter initialEntries={['/report']}>
        <ReportPage />
      </MemoryRouter>
    );

    // 1. Attach photo
    const file = new File(['valid-img'], 'road.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/From Photo EXIF/i)).toBeInTheDocument();
    });

    // 2. Enter description
    const descInput = screen.getByLabelText(/Description/i);
    fireEvent.change(descInput, { target: { value: 'Severe asphalt crater obstructing traffic' } });

    // 3. Submit
    const submitBtn = screen.getByRole('button', { name: /Submit Incident Report/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        '/api/v1/report',
        expect.any(FormData),
        expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } })
      );
      expect(screen.getByText(/Report Submitted Successfully/i)).toBeInTheDocument();
      expect(screen.getByText('inc-rec-9876')).toBeInTheDocument();
      expect(screen.getByText('Ward #5 Central')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /View in My Reports/i })).toBeInTheDocument();
    });
  });

  // ─── 8. Duplicate Report Modal & Resolution ────────────────────────────────
  it('8. Opens duplicate modal on HTTP 409 and allows confirming the existing issue', async () => {
    vi.spyOn(locationUtils, 'extractGpsFromExif').mockResolvedValueOnce({
      lat: 12.9716,
      lon: 77.5946,
    });

    // Mock initial submission returning 409 Conflict duplicate
    vi.spyOn(apiClient, 'post')
      .mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            status: 'Duplicate',
            message: 'This issue has already been reported nearby.',
            existing_issue: {
              id: 'dup-inc-111',
              category: 'Pothole',
              description: 'Existing reported pothole',
              status: 'reported',
              latitude: 12.9716,
              longitude: 77.5946,
              ward_id: 5,
            },
          },
        },
      })
      // Mock subsequent verification confirm vote
      .mockResolvedValueOnce({
        data: { status: 'Success' },
      });

    render(
      <MemoryRouter initialEntries={['/report']}>
        <ReportPage />
      </MemoryRouter>
    );

    const file = new File(['valid-img'], 'road.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/From Photo EXIF/i)).toBeInTheDocument();
    });

    const descInput = screen.getByLabelText(/Description/i);
    fireEvent.change(descInput, { target: { value: 'Pothole at intersection' } });

    fireEvent.click(screen.getByRole('button', { name: /Submit Incident Report/i }));

    // Duplicate modal appears
    await waitFor(() => {
      expect(screen.getByText(/Existing reported pothole/i)).toBeInTheDocument();
    });

    // Click "Yes, it's the same" button in duplicate modal
    const confirmSameBtn = screen.getByRole('button', { name: /Yes, it's the same/i });
    fireEvent.click(confirmSameBtn);

    await waitFor(() => {
      expect(screen.getByText(/Report Submitted Successfully/i)).toBeInTheDocument();
      expect(screen.getByText('dup-inc-111')).toBeInTheDocument();
    });
  });
});
