import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { API_BASE_URL } from '../lib/apiClient';

// ─── Role Type ────────────────────────────────────────────────────────────────
export type AppRole = 'citizen' | 'admin' | 'super_admin';

// ─── Context Contract ─────────────────────────────────────────────────────────
export interface AuthContextType {
  /** Raw Supabase session (contains access_token, refresh_token, expires_at) */
  session: Session | null;
  /** Authenticated Supabase user */
  user: User | null;
  /**
   * Role verified by the backend `/api/v1/users/me` endpoint.
   * Never trust a role stored only in Supabase JWT metadata for authorization –
   * the backend is the authoritative source.
   */
  userRole: AppRole | null;
  /** Current Bearer access token. Refreshed automatically by Supabase. */
  accessToken: string | null;
  /** True while initial Supabase session is being hydrated */
  sessionLoading: boolean;
  /** True while the backend role is being fetched from /api/v1/users/me */
  roleLoading: boolean;
  /** Composite loading state (sessionLoading || roleLoading) */
  loading: boolean;
  /** Error message if backend role verification failed */
  roleError: string | null;
  /** Indicates whether the current session was initiated by a password recovery link */
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  /** Safe manual retry function when backend role retrieval failed */
  retryRoleFetch: () => Promise<void>;
  /** Authoritative role resolution helper for a given token */
  fetchRoleForToken: (token: string) => Promise<AppRole | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  // Deduplication & race-condition prevention refs
  const inFlightPromiseRef = useRef<Promise<AppRole | null> | null>(null);
  const inFlightTokenRef = useRef<string | null>(null);
  const lastFetchedTokenRef = useRef<string | null>(null);

  /**
   * Fetches the authoritative user role from the backend /api/v1/users/me.
   * - Deduplicates concurrent calls for the same token.
   * - On success: caches token ref, updates userRole, clears roleError.
   * - On failure: leaves userRole as null, sets roleError, DOES NOT cache token ref.
   */
  const fetchRoleForToken = useCallback(async (token: string): Promise<AppRole | null> => {
    // If an identical request is already in-flight, return the existing promise
    if (token === inFlightTokenRef.current && inFlightPromiseRef.current) {
      return inFlightPromiseRef.current;
    }

    inFlightTokenRef.current = token;
    setRoleLoading(true);
    setRoleError(null);

    const promise = (async (): Promise<AppRole | null> => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const json = await res.json();
          const role = json?.data?.role as string | undefined;
          const resolvedRole: AppRole =
            role === 'super_admin' || role === 'admin' ? role : 'citizen';
          setUserRole(resolvedRole);
          lastFetchedTokenRef.current = token;
          setRoleError(null);
          return resolvedRole;
        }

        if (res.status === 401) {
          setUserRole(null);
          setRoleError('Session expired. Please log in again.');
          return null;
        }

        setUserRole(null);
        setRoleError(`Server returned status ${res.status}. Could not verify permissions.`);
        return null;
      } catch {
        // Authoritative Fallback: If backend is waking up or temporarily unreachable,
        // retrieve the verified role directly from the Supabase public.profiles database table via RLS
        try {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser?.id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', currentUser.id)
              .maybeSingle();

            if (profile?.role) {
              const role = profile.role as string;
              const resolvedRole: AppRole =
                role === 'super_admin' || role === 'admin' ? role : 'citizen';
              setUserRole(resolvedRole);
              lastFetchedTokenRef.current = token;
              setRoleError(null);
              return resolvedRole;
            }
          }
        } catch {
          // Both paths failed
        }

        setUserRole(null);
        setRoleError('Could not connect to authentication server. Please check your connection.');
        return null;
      } finally {
        setRoleLoading(false);
        inFlightPromiseRef.current = null;
        inFlightTokenRef.current = null;
      }
    })();

    inFlightPromiseRef.current = promise;
    return promise;
  }, []);

  const applySession = useCallback(async (newSession: Session | null) => {
    setSession(newSession);
    setUser(newSession?.user ?? null);
    const token = newSession?.access_token ?? null;
    setAccessToken(token);

    if (token) {
      if (token !== lastFetchedTokenRef.current) {
        await fetchRoleForToken(token);
      }
    } else {
      // Clear stale role data upon sign out or empty session
      lastFetchedTokenRef.current = null;
      setUserRole(null);
      setRoleError(null);
      setRoleLoading(false);
    }
  }, [fetchRoleForToken]);

  useEffect(() => {
    // ── 1. Hydrate from persisted session ─────────────────────────────────────
    const initAuth = async () => {
      try {
        const { data: { session: initial } } = await supabase.auth.getSession();
        await applySession(initial);
      } catch (err) {
        console.error('[AuthContext] Supabase session initialization failed:', err);
      } finally {
        setSessionLoading(false);
      }
    };

    initAuth();

    // ── 2. Subscribe to auth state transitions ────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        } else if (event === 'SIGNED_OUT') {
          setIsPasswordRecovery(false);
        }
        await applySession(newSession);
        setSessionLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [applySession]);

  const retryRoleFetch = useCallback(async () => {
    if (!accessToken) return;
    await fetchRoleForToken(accessToken);
  }, [accessToken, fetchRoleForToken]);

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error('[AuthContext] Sign-out error:', error);
    } finally {
      // Force-clear all state regardless of network response
      setSession(null);
      setUser(null);
      setUserRole(null);
      setAccessToken(null);
      setRoleError(null);
      setRoleLoading(false);
      setIsPasswordRecovery(false);
      lastFetchedTokenRef.current = null;
      inFlightPromiseRef.current = null;
      inFlightTokenRef.current = null;
    }
  };

  const loading = sessionLoading || roleLoading;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        userRole,
        accessToken,
        sessionLoading,
        roleLoading,
        loading,
        roleError,
        isPasswordRecovery,
        clearPasswordRecovery,
        retryRoleFetch,
        fetchRoleForToken,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
