import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  Breadcrumbs,
  SeverityIndicator,
  SearchField,
  FilterControls,
  IncidentCard,
  DataTable,
  MetricCard,
  ConfirmDialog,
  Pagination,
  MapControls,
  ToastProvider,
  useToast,
  Skeleton,
  IncidentCardSkeleton,
  MetricCardSkeleton,
} from '../components/ui';

describe('Phase 6A.1: Premium Design System & Shared Architecture', () => {
  describe('Breadcrumbs Component', () => {
    it('renders breadcrumb items and supports navigation hierarchy', () => {
      render(
        <MemoryRouter>
          <Breadcrumbs
            items={[
              { label: 'Explore', href: '/explore' },
              { label: 'Pothole Report', isCurrent: true },
            ]}
          />
        </MemoryRouter>
      );

      expect(screen.getByText('Explore')).toBeInTheDocument();
      expect(screen.getByText('Pothole Report')).toBeInTheDocument();
      expect(screen.getByText('Pothole Report')).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('SeverityIndicator Component', () => {
    it('renders all severity levels accurately', () => {
      const levels = ['low', 'medium', 'high', 'critical'] as const;
      for (const level of levels) {
        const { unmount } = render(<SeverityIndicator severity={level} />);
        expect(screen.getByText(new RegExp(level, 'i'))).toBeInTheDocument();
        unmount();
      }
    });

    it('renders dot variant correctly', () => {
      render(<SeverityIndicator severity="critical" variant="dot" />);
      expect(screen.getByText(/critical/i)).toBeInTheDocument();
    });
  });

  describe('SearchField Component', () => {
    it('renders search input with clear action and placeholder', () => {
      const handleClear = vi.fn();
      const handleChange = vi.fn();

      const { rerender } = render(
        <SearchField
          value=""
          onChange={handleChange}
          onClear={handleClear}
          placeholder="Search test..."
        />
      );

      const input = screen.getByPlaceholderText('Search test...');
      expect(input).toBeInTheDocument();

      // Typing simulation
      rerender(
        <SearchField
          value="drainage issue"
          onChange={handleChange}
          onClear={handleClear}
          placeholder="Search test..."
        />
      );

      const clearBtn = screen.getByLabelText(/clear search/i);
      expect(clearBtn).toBeInTheDocument();
      fireEvent.click(clearBtn);
      expect(handleClear).toHaveBeenCalledTimes(1);
    });
  });

  describe('FilterControls Component', () => {
    it('renders filter pills and handles selection', () => {
      const handleSelect = vi.fn();
      const options = [
        { label: 'All', value: 'all', count: 12 },
        { label: 'Reported', value: 'reported', count: 5 },
        { label: 'Resolved', value: 'resolved', count: 7 },
      ];

      render(
        <FilterControls
          options={options}
          selectedValue="all"
          onSelect={handleSelect}
          label="Filter Status"
        />
      );

      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Reported')).toBeInTheDocument();
      expect(screen.getByText('Resolved')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Reported'));
      expect(handleSelect).toHaveBeenCalledWith('reported');
    });
  });

  describe('IncidentCard Component', () => {
    it('renders incident card with status, category, location, and confirmations', () => {
      const mockIncident = {
        id: 'inc-test-1',
        category: 'Pothole',
        description: 'Deep road hazard near Main Market junction',
        status: 'reported',
        severity: 'high',
        ward_name: 'Ward 1 - Central Zone',
        confirmations_count: 8,
        disputes_count: 0,
        created_at: new Date().toISOString(),
      };

      render(<IncidentCard incident={mockIncident} />);

      expect(screen.getByText('Pothole')).toBeInTheDocument();
      expect(screen.getByText(/Deep road hazard/i)).toBeInTheDocument();
      expect(screen.getByText('Ward 1 - Central Zone')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
    });
  });

  describe('DataTable Component', () => {
    interface TestData {
      id: string;
      name: string;
      role: string;
    }

    const testColumns = [
      { key: 'name', header: 'Full Name', sortable: true },
      { key: 'role', header: 'Role' },
    ];

    const testRows: TestData[] = [
      { id: '1', name: 'Aarav Sharma', role: 'Citizen' },
      { id: '2', name: 'Rajesh Verma', role: 'Ward Admin' },
    ];

    it('renders structured data table and responds to sorting', () => {
      const handleSort = vi.fn();

      render(
        <DataTable
          columns={testColumns}
          data={testRows}
          keyExtractor={(row) => row.id}
          onSort={handleSort}
          sortColumn="name"
          sortDirection="asc"
        />
      );

      expect(screen.getByText('Aarav Sharma')).toBeInTheDocument();
      expect(screen.getByText('Rajesh Verma')).toBeInTheDocument();

      const sortBtn = screen.getByRole('button', { name: /Full Name/i });
      fireEvent.click(sortBtn);
      expect(handleSort).toHaveBeenCalledWith('name');
    });

    it('renders empty state when no data provided', () => {
      render(
        <DataTable
          columns={testColumns}
          data={[]}
          keyExtractor={(row) => row.id}
          emptyTitle="No Administrators"
        />
      );

      expect(screen.getByText('No Administrators')).toBeInTheDocument();
    });
  });

  describe('MetricCard Component', () => {
    it('renders label, numerical metric, and trend', () => {
      render(
        <MetricCard
          label="Active Incidents"
          value="42"
          change="+8%"
          changeDirection="up"
          changeLabel="vs last week"
        />
      );

      expect(screen.getByText('Active Incidents')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('+8%')).toBeInTheDocument();
    });
  });

  describe('ConfirmDialog Component', () => {
    it('renders confirmation modal and fires confirm callback', () => {
      const handleConfirm = vi.fn();
      const handleCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Reject Incident"
          description="Are you sure you want to reject this civic report?"
          confirmLabel="Yes, Reject"
          variant="destructive"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      );

      expect(screen.getByText('Reject Incident')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to reject/i)).toBeInTheDocument();

      const confirmBtn = screen.getByRole('button', { name: /Yes, Reject/i });
      fireEvent.click(confirmBtn);
      expect(handleConfirm).toHaveBeenCalledTimes(1);

      const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelBtn);
      expect(handleCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Pagination Component', () => {
    it('renders pagination controls and triggers page change', () => {
      const handlePageChange = vi.fn();

      render(
        <Pagination
          currentPage={2}
          totalPages={5}
          totalItems={50}
          pageSize={10}
          onPageChange={handlePageChange}
        />
      );

      expect(screen.getByText(/Showing/i)).toBeInTheDocument();
      const nextBtn = screen.getByRole('button', { name: /next page/i });
      fireEvent.click(nextBtn);
      expect(handlePageChange).toHaveBeenCalledWith(3);
    });
  });

  describe('MapControls Component', () => {
    it('renders floating controls and triggers locate / zoom callbacks', () => {
      const handleZoomIn = vi.fn();
      const handleLocate = vi.fn();

      render(
        <MapControls
          incidentCount={15}
          onZoomIn={handleZoomIn}
          onLocateMe={handleLocate}
        />
      );

      expect(screen.getByText(/15/)).toBeInTheDocument();
      const locateBtn = screen.getByRole('button', { name: /find my location/i });
      fireEvent.click(locateBtn);
      expect(handleLocate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Toast Notification System', () => {
    const TestToastComponent: React.FC = () => {
      const { showToast } = useToast();
      return (
        <button
          onClick={() =>
            showToast({
              type: 'success',
              title: 'Incident Verified',
              message: 'Your report was confirmed on-site.',
            })
          }
        >
          Trigger Toast
        </button>
      );
    };

    it('displays toast on trigger', () => {
      render(
        <ToastProvider>
          <TestToastComponent />
        </ToastProvider>
      );

      const triggerBtn = screen.getByRole('button', { name: /trigger toast/i });
      fireEvent.click(triggerBtn);

      expect(screen.getByText('Incident Verified')).toBeInTheDocument();
      expect(screen.getByText('Your report was confirmed on-site.')).toBeInTheDocument();
    });
  });

  describe('LoadingSkeleton Component', () => {
    it('renders skeleton placeholders without crash', () => {
      const { container } = render(
        <div>
          <Skeleton className="w-20 h-4" />
          <IncidentCardSkeleton count={2} />
          <MetricCardSkeleton count={2} />
        </div>
      );

      expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    });
  });
});

