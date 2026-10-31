/**
 * URL normalization utilities for NagarWatch API integration.
 */

/**
 * Normalizes the configured backend API base URL.
 *
 * Guarantees:
 * - Trims whitespace.
 * - Strips trailing slashes (e.g. 'http://localhost:5000/' -> 'http://localhost:5000').
 * - Strips trailing '/api/v1' or '/api/v1/' if present (case-insensitive).
 * - Prevents duplicate path prefixing like '/api/v1/api/v1/...'.
 * - Handles empty or undefined inputs safely.
 *
 * Examples:
 * - normalizeApiBaseUrl('http://localhost:5000') -> 'http://localhost:5000'
 * - normalizeApiBaseUrl('http://localhost:5000/') -> 'http://localhost:5000'
 * - normalizeApiBaseUrl('http://localhost:5000/api/v1') -> 'http://localhost:5000'
 * - normalizeApiBaseUrl('http://localhost:5000/api/v1/') -> 'http://localhost:5000'
 * - normalizeApiBaseUrl('') -> ''
 */
export function normalizeApiBaseUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();
  // Strip trailing slashes
  url = url.replace(/\/+$/, '');
  // Strip trailing /api/v1 (case-insensitive) if present
  url = url.replace(/\/api\/v1\/?$/i, '');
  // Strip trailing slashes again
  url = url.replace(/\/+$/, '');
  return url;
}

