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
 * - On local dev network devices (e.g. phone/tablet on LAN like 172.20.11.40:3000),
 *   rewrites 'localhost' to match the LAN IP so requests reach the local Flask backend.
 * - On production web deployments (e.g. Vercel *.vercel.app or custom domains),
 *   avoids rewriting localhost to public domains (which caused mixed-content/ERR_NETWORK).
 *   Falls back cleanly to relative '' or the configured remote URL.
 */
export function resolveApiBaseUrl(rawUrl?: string): string {
  const normalized = normalizeApiBaseUrl(rawUrl);
  if (!normalized) return '';

  if (typeof window !== 'undefined' && window.location.hostname) {
    const host = window.location.hostname;
    // Check if current device is on private LAN IPv4 space (RFC 1918)
    const isLanIp = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(host);

    try {
      const parsed = new URL(normalized);
      // Only rewrite localhost/127.0.0.1 if user is accessing on local LAN device
      if ((parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') && isLanIp) {
        parsed.hostname = host;
        return parsed.origin;
      }

      // If running on public HTTPS deployment (e.g. Vercel) and rawUrl points to localhost,
      // fallback to empty relative base so requests go through proxy/rewrites rather than failing mixed-content
      if (
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
        window.location.protocol === 'https:' &&
        !isLanIp
      ) {
        return '';
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
  timeout: 60_000, // 60s timeout accommodates Render backend cold-start spin-up
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
