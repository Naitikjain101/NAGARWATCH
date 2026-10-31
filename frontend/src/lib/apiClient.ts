/**
 * NagarWatch Centralized API Client
 *
 * All backend requests should go through this Axios instance so that:
 *  - Bearer tokens are attached automatically from the live Supabase session.
 *  - 401 responses (expired / invalid tokens) trigger a single session refresh,
 *    then retry the original request once. A second 401 signals the user must
 *    re-login.
 *  - Tokens and secrets are never logged.
 *  - Public requests (no auth header needed) work transparently.
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios';
import { supabase } from './supabase';
import { normalizeApiBaseUrl } from './urlUtils';

// ─── Normalized API Base URL ──────────────────────────────────────────────────
/**
 * Resolves the API Base URL.
 * If running on a network device (e.g. phone/tablet at http://172.20.11.40:3000),
 * automatically rewrites 'localhost' or '127.0.0.1' in the configured API URL to match
 * the browser's current host (window.location.hostname), ensuring requests
 * reach the Flask backend over the LAN without requiring hardcoded IP changes.
 */
export function resolveApiBaseUrl(rawUrl?: string): string {
  const normalized = normalizeApiBaseUrl(rawUrl);
  if (!normalized) return '';

  if (
    typeof window !== 'undefined' &&
    window.location.hostname &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    try {
      const parsed = new URL(normalized);
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        parsed.hostname = window.location.hostname;
        return parsed.origin;
      }
    } catch {
      // Fallback to normalized
    }
  }

  return normalized;
}

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_URL);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safely obtains the latest access token without logging it. */
async function getAccessToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

/** Attempts a single token refresh via Supabase. Returns new token or null. */
async function refreshAccessToken(): Promise<string | null> {
  try {
    const { data: { session }, error } = await supabase.auth.refreshSession();
    if (error || !session) return null;
    return session.access_token;
  } catch {
    return null;
  }
}

// ─── Instance ─────────────────────────────────────────────────────────────────

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request Interceptor: Attach Bearer token ─────────────────────────────────

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    // Skip attaching token if the caller has already set an Authorization header
    // (allows explicit overrides, e.g. for public-only requests).
    if (config.headers?.Authorization) return config;

    const token = await getAccessToken();
    if (token) {
      // AxiosHeaders is always present on InternalAxiosRequestConfig
      config.headers.Authorization = `Bearer ${token}`;
    }
    // No-op if unauthenticated – public endpoints work without the header.
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor: Handle 401 with a single refresh attempt ───────────

// Internal flag to prevent infinite retry loops.
let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

function onTokenRefreshed(token: string | null) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (!originalRequest) return Promise.reject(error);

    const status = error.response?.status;

    // ── 401: Attempt one silent token refresh ─────────────────────────────────
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Prevent infinite retry

      if (isRefreshing) {
        // Queue requests that arrive while a refresh is in flight
        return new Promise((resolve, reject) => {
          refreshSubscribers.push((newToken) => {
            if (!newToken) return reject(error);
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            resolve(apiClient(originalRequest));
          });
        });
      }

      isRefreshing = true;
      const newToken = await refreshAccessToken();
      isRefreshing = false;

      if (newToken) {
        onTokenRefreshed(newToken);
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      }

      // Refresh failed – notify queued requests and let them fail
      onTokenRefreshed(null);
      // Caller will receive a 401 and should redirect to login.
      return Promise.reject(error);
    }

    // Re-raise all other errors as-is
    return Promise.reject(error);
  }
);

export default apiClient;
export { apiClient };
