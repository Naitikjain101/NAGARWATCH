import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Button,
  IconButton,
  StatusBadge,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Select,
  Modal,
  EmptyState,
  ErrorState,
  Avatar,
} from '../components/ui';

describe('NagarWatch UI Design System Components', () => {
  describe('Button', () => {
    it('renders with label and fires onClick', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Submit Report</Button>);

      const btn = screen.getByRole('button', { name: /Submit Report/i });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders in loading state with spinner and is disabled', () => {
      const handleClick = vi.fn();
      render(
        <Button isLoading onClick={handleClick}>
          Processing
        </Button>
      );

      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('renders destructive variant with appropriate styling', () => {
      render(<Button variant="destructive">Delete Ward</Button>);
      const btn = screen.getByRole('button', { name: /Delete Ward/i });
      expect(btn.className).toContain('bg-red-600');
    });
  });

  describe('IconButton', () => {
    it('renders with mandatory aria-label and handles click', () => {
      const handleClick = vi.fn();
      render(
        <IconButton aria-label="Close dialog" onClick={handleClick}>
          <span>✕</span>
        </IconButton>
      );

      const btn = screen.getByRole('button', { name: /Close dialog/i });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('StatusBadge', () => {
    it('renders all backend-supported statuses accurately', () => {
      const backendStatuses = [
        { status: 'pending', expected: 'Pending Review' },
        { status: 'reported', expected: 'Reported' },
        { status: 'verified', expected: 'Community Verified' },
        { status: 'assigned', expected: 'Assigned' },
        { status: 'in_progress', expected: 'In Progress' },
        { status: 'resolved', expected: 'Resolved' },
        { status: 'closed', expected: 'Closed' },
        { status: 'rejected', expected: 'Rejected' },
      ];

      for (const item of backendStatuses) {
        const { unmount } = render(<StatusBadge status={item.status} />);
        expect(screen.getByText(item.expected)).toBeInTheDocument();
        unmount();
      }
    });

    it('handles uppercase and underscored statuses gracefully', () => {
      render(<StatusBadge status="IN_PROGRESS" />);
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });
  });

  describe('Badge', () => {
    it('renders with dot indicator and variant styling', () => {
      render(<Badge variant="success" dot>Active</Badge>);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  describe('Card', () => {
    it('renders Card hierarchy correctly', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Ward 14 Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <p>12 active issues</p>
          </CardContent>
        </Card>
      );

      expect(screen.getByText('Ward 14 Overview')).toBeInTheDocument();
      expect(screen.getByText('12 active issues')).toBeInTheDocument();
    });
  });

  describe('Input', () => {
    it('renders label and handles typing', () => {
      const handleChange = vi.fn();
      render(<Input label="Ward Name" placeholder="Enter ward" onChange={handleChange} />);

      const input = screen.getByLabelText(/Ward Name/i);
      expect(input).toBeInTheDocument();
      fireEvent.change(input, { target: { value: 'Central Ward' } });
      expect(handleChange).toHaveBeenCalled();
    });

    it('renders error message and marks aria-invalid', () => {
      render(<Input label="Phone" error="Invalid phone format" />);
      const input = screen.getByLabelText(/Phone/i);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText('Invalid phone format')).toBeInTheDocument();
    });
  });

  describe('Select', () => {
    it('renders options and handles selection change', () => {
      const handleChange = vi.fn();
      render(
        <Select
          label="Category"
          options={[
            { value: 'pothole', label: 'Pothole' },
            { value: 'streetlight', label: 'Streetlight' },
          ]}
          onChange={handleChange}
        />
      );

      const select = screen.getByLabelText(/Category/i);
      fireEvent.change(select, { target: { value: 'streetlight' } });
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe('Modal', () => {
    it('renders modal when isOpen is true and fires onClose on ESC key', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Confirm Submission">
          <p>Are you sure?</p>
        </Modal>
      );

      expect(screen.getByText('Confirm Submission')).toBeInTheDocument();
      expect(screen.getByText('Are you sure?')).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does not render when isOpen is false', () => {
      render(
        <Modal isOpen={false} onClose={vi.fn()} title="Hidden Modal">
          <p>Hidden content</p>
        </Modal>
      );

      expect(screen.queryByText('Hidden Modal')).not.toBeInTheDocument();
    });
  });

  describe('EmptyState & ErrorState', () => {
    it('renders EmptyState with title and description', () => {
      render(
        <EmptyState
          title="No Reports Found"
          description="You have not submitted any incidents yet."
        />
      );

      expect(screen.getByText('No Reports Found')).toBeInTheDocument();
      expect(screen.getByText('You have not submitted any incidents yet.')).toBeInTheDocument();
    });

    it('renders ErrorState and triggers onRetry', () => {
      const handleRetry = vi.fn();
      render(
        <ErrorState
          title="Network Error"
          message="Failed to connect to API"
          onRetry={handleRetry}
        />
      );

      expect(screen.getByText('Network Error')).toBeInTheDocument();
      const retryBtn = screen.getByRole('button', { name: /Try Again/i });
      fireEvent.click(retryBtn);
      expect(handleRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('Avatar', () => {
    it('computes initials accurately from name', () => {
      render(<Avatar name="Nagar Watch" />);
      expect(screen.getByText('NW')).toBeInTheDocument();
    });
  });
});

