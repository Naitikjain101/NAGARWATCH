import React, { useState, useEffect, useId } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { DemoLoginSection, DemoAccount } from '../components/auth/DemoLoginSection';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Shield,
  ArrowRight,
  KeyRound,
  RefreshCw,
  FileCheck2,
  Compass,
  Check
} from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [activeDemoRole, setActiveDemoRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  // Forgot Password Mode
  const [mode, setMode] = useState<'signin' | 'forgot_password'>('signin');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  const { user, userRole, fetchRoleForToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const emailId = useId();
  const passwordId = useId();
  const forgotEmailId = useId();

  // ─── If already authenticated, redirect to appropriate portal ─────────────
  useEffect(() => {
    if (user && userRole) {
      const fromPath = (location.state as any)?.from?.pathname;
      if (fromPath && fromPath !== '/login' && fromPath !== '/signup') {
        navigate(fromPath, { replace: true });
      } else if (userRole === 'super_admin') {
        navigate('/superadmin', { replace: true });
      } else if (userRole === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [user, userRole, navigate, location.state]);

  // ─── Instant Demo Login Handler ───────────────────────────────────────────
  const handleQuickDemoLogin = async (demoAccount: DemoAccount) => {
    setEmail(demoAccount.email);
    setPassword(demoAccount.password);
    setError(null);
    setUnconfirmedEmail(null);
    setResendStatus(null);
    setLoading(true);
    setActiveDemoRole(demoAccount.role);

    try {
      let authRes = await supabase.auth.signInWithPassword({
        email: demoAccount.email,
        password: demoAccount.password,
      });

      if (authRes.error && authRes.error.message?.includes('Invalid login credentials')) {
        const altPassword = demoAccount.password.includes('NagarWatch')
          ? demoAccount.password.replace('NagarWatch', 'Nagarwatch')
          : demoAccount.password.replace('Nagarwatch', 'NagarWatch');
        const altRes = await supabase.auth.signInWithPassword({
          email: demoAccount.email,
          password: altPassword,
        });
        if (!altRes.error) {
          authRes = altRes;
          setPassword(altPassword);
        }
      }

      if (authRes.error) {
        throw authRes.error;
      }

      if (!authRes.data.session) {
        throw new Error('No active session was established. Please verify your credentials.');
      }

      // Fetch the verified backend role authoritatively
      const authoritativeRole = await fetchRoleForToken(authRes.data.session.access_token);

      const targetPath = (location.state as any)?.from?.pathname;
      if (targetPath && targetPath !== '/login' && targetPath !== '/signup') {
        navigate(targetPath, { replace: true });
      } else if (authoritativeRole === 'super_admin') {
        navigate('/superadmin', { replace: true });
      } else if (authoritativeRole === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      const rawMsg = err?.message || '';
      if (rawMsg.includes('Invalid login credentials')) {
        setError('Incorrect demo credentials. Please run migration 003_demo_credentials.sql in your Supabase SQL Editor.');
      } else if (rawMsg.includes('Email not confirmed')) {
        setError('Demo email is not confirmed in Supabase. Please execute migration 003_demo_credentials.sql to auto-confirm.');
      } else {
        setError(rawMsg || 'Failed to sign in with demo credentials.');
      }
    } finally {
      setLoading(false);
      setActiveDemoRole(null);
    }
  };

  // ─── Sign In Submission ───────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUnconfirmedEmail(null);
    setResendStatus(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      let authRes = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: password,
      });

      if (authRes.error && authRes.error.message?.includes('Invalid login credentials')) {
        const altPassword = password.includes('NagarWatch')
          ? password.replace('NagarWatch', 'Nagarwatch')
          : password.includes('Nagarwatch')
          ? password.replace('Nagarwatch', 'NagarWatch')
          : null;
        if (altPassword) {
          const altRes = await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password: altPassword,
          });
          if (!altRes.error) {
            authRes = altRes;
          }
        }
      }

      if (authRes.error) {
        throw authRes.error;
      }

      if (!authRes.data.session) {
        throw new Error('No active session was established. Please verify your credentials.');
      }

      // Fetch the verified backend role authoritatively
      const authoritativeRole = await fetchRoleForToken(authRes.data.session.access_token);

      const targetPath = (location.state as any)?.from?.pathname;
      if (targetPath && targetPath !== '/login' && targetPath !== '/signup') {
        navigate(targetPath, { replace: true });
      } else if (authoritativeRole === 'super_admin') {
        navigate('/superadmin', { replace: true });
      } else if (authoritativeRole === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      const rawMsg = err?.message || '';
      if (rawMsg.includes('Invalid login credentials')) {
        setError('Incorrect email or password. Please verify your details.');
      } else if (rawMsg.includes('Email not confirmed') || err?.code === 'email_not_confirmed') {
        setUnconfirmedEmail(trimmedEmail);
        setError('Your email address has not been confirmed yet. Please verify your inbox.');
      } else if (rawMsg.includes('over_email_send_rate_limit')) {
        setError('Too many login attempts. Please wait a few moments before trying again.');
      } else {
        setError(rawMsg || 'Failed to sign in. Please check your credentials and connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Resend Confirmation Email ────────────────────────────────────────────
  const handleResendConfirmation = async () => {
    if (!unconfirmedEmail) return;
    setLoading(true);
    setResendStatus(null);
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: unconfirmedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (resendErr) throw resendErr;
      setResendStatus(`Verification link resent to ${unconfirmedEmail}. Please check your inbox.`);
    } catch (err: any) {
      setError(err?.message || 'Could not resend verification email.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Forgot Password Submission ───────────────────────────────────────────
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const targetEmail = forgotEmail.trim().toLowerCase();
    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      setError('Please provide a valid email address.');
      return;
    }

    setLoading(true);

    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetErr) throw resetErr;
      setForgotSubmitted(true);
    } catch (err: any) {
      let msg = err?.message || 'Failed to send reset link.';
      if (msg.includes('over_email_send_rate_limit')) {
        msg = 'Rate limit exceeded. Please wait a few minutes before trying again.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ─── View: Forgot Password Mode ───────────────────────────────────────────
  if (mode === 'forgot_password') {
    return (
      <div className="min-h-[85vh] bg-[#F4F1EA] dark:bg-[#18181B] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] rounded-sm p-8 shadow-xs">
          <div className="border-b border-[#E5E0D4] dark:border-[#333338] pb-5 mb-6 text-left">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#78716C] dark:text-[#A1A1AA] mb-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#D9381E]" />
              <span>Security Protocol • Identity Recovery</span>
            </div>
            <h1 className="text-2xl font-serif text-[#1C1917] dark:text-[#F4F4F5] tracking-tight">Reset Password</h1>
            <p className="text-xs text-[#78716C] dark:text-[#A1A1AA] mt-1 font-sans">
              Enter your email to receive a password recovery link
            </p>
          </div>

          {forgotSubmitted ? (
            <div className="space-y-4">
              <div className="p-4 rounded-sm bg-[#F4F1EA] dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#1C1917] dark:text-[#F4F4F5]">
                  <CheckCircle2 className="w-4 h-4 text-[#1C1917] dark:text-[#F4F4F5]" />
                  <span>Recovery Dispatch Transmitted</span>
                </div>
                <p className="text-xs text-[#57534E] dark:text-[#A1A1AA] leading-relaxed">
                  If an account exists for <strong className="font-semibold text-[#1C1917] dark:text-[#F4F4F5]">{forgotEmail}</strong>,
                  we have sent instructions to reset your password.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setForgotSubmitted(false);
                  setError(null);
                }}
                className="w-full bg-[#1C1917] hover:bg-[#D9381E] text-white dark:bg-[#F4F4F5] dark:text-[#18181B] dark:hover:bg-[#D9381E] dark:hover:text-white font-semibold py-2.5 rounded-sm transition-colors text-xs uppercase tracking-wider min-h-[44px]"
              >
                Return to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              {error && (
                <div role="alert" className="p-3 rounded-sm bg-[#FDF0EE] dark:bg-[#3D1A16] text-[#D9381E] dark:text-[#F87171] border border-[#FACDC6] dark:border-[#7F1D1D] text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#D9381E] dark:text-[#F87171]" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor={forgotEmailId} className="block text-[11px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA] mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E] dark:text-[#71717A] w-4 h-4 pointer-events-none" />
                  <input
                    id={forgotEmailId}
                    type="email"
                    placeholder="citizen@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    disabled={loading}
                    required
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] rounded-sm text-xs text-[#1C1917] dark:text-[#F4F4F5] placeholder:text-[#A8A29E] dark:placeholder:text-[#71717A] focus:outline-none focus:border-[#1C1917] dark:focus:border-[#F4F4F5] focus:ring-1 focus:ring-[#1C1917] dark:focus:ring-[#F4F4F5] transition-all font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1C1917] hover:bg-[#D9381E] text-white dark:bg-[#F4F4F5] dark:text-[#18181B] dark:hover:bg-[#D9381E] dark:hover:text-white font-semibold py-2.5 rounded-sm transition-colors flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-60 min-h-[44px]"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Recovery Link'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
                className="w-full text-[#78716C] dark:text-[#A1A1AA] hover:text-[#1C1917] dark:hover:text-[#F4F4F5] text-xs text-center font-mono transition-colors pt-2 block"
              >
                ← Back to Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ─── View: Main Sign In Form ──────────────────────────────────────────────
  return (
    <div className="min-h-[88vh] bg-[#F4F1EA] dark:bg-[#18181B] py-8 sm:py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* Left Column: Access Authentication Form (7 cols) */}
        <div className="lg:col-span-7 bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] rounded-sm p-6 sm:p-8 flex flex-col justify-between shadow-2xs">
          <div>
            {/* Header / Masthead */}
            <div className="border-b border-[#E5E0D4] dark:border-[#333338] pb-5 mb-6">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-[#F4F1EA] dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] text-[10px] font-mono uppercase tracking-widest text-[#78716C] dark:text-[#A1A1AA]">
                  <Shield className="w-3 h-3 text-[#D9381E]" />
                  <span>Municipal Access Registry</span>
                </div>
                <span className="text-[10px] font-mono text-[#78716C] dark:text-[#A1A1AA]">AUTH-PORTAL v2.6</span>
              </div>
              <h1 className="text-3xl font-serif text-[#1C1917] dark:text-[#F4F4F5] tracking-tight">Sign In</h1>
              <p className="text-xs text-[#78716C] dark:text-[#A1A1AA] mt-1 font-sans">
                Sign in to continue reporting and access your NAGARWATCH portal
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div
                role="alert"
                className="p-3 rounded-sm bg-[#FDF0EE] dark:bg-[#3D1A16] text-[#D9381E] dark:text-[#F87171] border border-[#FACDC6] dark:border-[#7F1D1D] text-xs mb-5 flex items-start gap-2.5 animate-fadeIn"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#D9381E] dark:text-[#F87171]" />
                <div className="flex-1 min-w-0">
                  <span className="leading-snug">{error}</span>
                  {unconfirmedEmail && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={handleResendConfirmation}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1C1917] dark:text-[#F4F4F5] hover:underline"
                      >
                        <RefreshCw className="w-3 h-3 text-[#D9381E]" /> Resend verification link
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Resend Status Notification */}
            {resendStatus && (
              <div className="p-3 rounded-sm bg-[#F4F1EA] dark:bg-[#18181B] text-[#1C1917] dark:text-[#F4F4F5] border border-[#E5E0D4] dark:border-[#333338] text-xs mb-5 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#1C1917] dark:text-[#F4F4F5]" />
                <span>{resendStatus}</span>
              </div>
            )}

            {/* Credential Form */}
            <form noValidate onSubmit={handleLogin} className="space-y-4">
              {/* Email Address */}
              <div>
                <label htmlFor={emailId} className="block text-[11px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA] mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E] dark:text-[#71717A] w-4 h-4 pointer-events-none" />
                  <input
                    id={emailId}
                    type="email"
                    placeholder="citizen@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                    autoComplete="email"
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] rounded-sm text-xs text-[#1C1917] dark:text-[#F4F4F5] placeholder:text-[#A8A29E] dark:placeholder:text-[#71717A] focus:outline-none focus:border-[#1C1917] dark:focus:border-[#F4F4F5] focus:ring-1 focus:ring-[#1C1917] dark:focus:ring-[#F4F4F5] transition-all font-mono"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor={passwordId} className="block text-[11px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot_password');
                      setForgotEmail(email);
                      setError(null);
                    }}
                    className="text-xs font-medium text-[#78716C] dark:text-[#A1A1AA] hover:text-[#1C1917] dark:hover:text-[#F4F4F5] hover:underline font-mono"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E] dark:text-[#71717A] w-4 h-4 pointer-events-none" />
                  <input
                    id={passwordId}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    autoComplete="current-password"
                    className="w-full pl-9 pr-9 py-2 bg-white dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] rounded-sm text-xs text-[#1C1917] dark:text-[#F4F4F5] placeholder:text-[#A8A29E] dark:placeholder:text-[#71717A] focus:outline-none focus:border-[#1C1917] dark:focus:border-[#F4F4F5] focus:ring-1 focus:ring-[#1C1917] dark:focus:ring-[#F4F4F5] transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A8A29E] dark:text-[#71717A] hover:text-[#1C1917] dark:hover:text-[#F4F4F5] focus:outline-none p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-[#1C1917] hover:bg-[#D9381E] text-white dark:bg-[#F4F4F5] dark:text-[#18181B] dark:hover:bg-[#D9381E] dark:hover:text-white font-semibold py-2.5 rounded-sm transition-colors flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
              >
                {loading && !activeDemoRole ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to NAGARWATCH</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Credentials Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E5E0D4] dark:border-[#333338]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#FBF9F4] dark:bg-[#222226] px-3 text-[#78716C] dark:text-[#A1A1AA] font-mono text-[10px] tracking-wider">
                  Or Use Demo Credentials
                </span>
              </div>
            </div>

            {/* Instant Demo Login Component */}
            <DemoLoginSection
              onSelectDemo={handleQuickDemoLogin}
              isLoading={loading}
              activeRoleLoading={activeDemoRole}
            />
          </div>

          {/* Footer Link */}
          <div className="mt-6 pt-4 border-t border-[#E5E0D4] dark:border-[#333338] text-center text-xs text-[#78716C] dark:text-[#A1A1AA]">
            New to the neighbourhood?{' '}
            <Link to="/signup" className="text-[#1C1917] dark:text-[#F4F4F5] font-semibold hover:text-[#D9381E] underline ml-1">
              Create an Account
            </Link>
          </div>
        </div>

        {/* Right Column: Municipal Intelligence Charter & Trust Briefing (5 cols) */}
        <div className="hidden lg:flex lg:col-span-5 bg-[#1C1917] dark:bg-[#121215] text-[#FBF9F4] rounded-sm p-8 flex-col justify-between border border-[#2E2B27] dark:border-[#27272A] relative overflow-hidden">
          {/* Subtle civic watermark / graphic border */}
          <div className="space-y-6">
            <div className="border-b border-[#33302B] pb-4">
              <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#A8A29E] uppercase mb-1">
                <span>Charter Protocol</span>
                <span>•</span>
                <span className="text-[#D9381E]">Live System</span>
              </div>
              <h2 className="text-xl font-serif tracking-tight text-[#FBF9F4]">
                Municipal Intelligence & Incident Dispatch Network
              </h2>
            </div>

            <p className="text-xs text-[#A8A29E] leading-relaxed">
              NAGARWATCH serves as the verified civic operating system for metropolitan areas. Every complaint, status transition, and resolution certificate is recorded against ward boundaries with cryptographic precision.
            </p>

            <div className="space-y-3.5 pt-2">
              <div className="p-3 bg-[#24211D] border border-[#38332C] rounded-sm flex items-start gap-3">
                <div className="w-5 h-5 rounded-xs bg-[#2E2B27] text-[#FBF9F4] flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-[#D9381E]" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#FBF9F4]">Citizen Reporting Tier</p>
                  <p className="text-[11px] text-[#A8A29E] mt-0.5">
                    Automated GPS verification, camera-first evidence, and real-time neighbourhood status feeds.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-[#24211D] border border-[#38332C] rounded-sm flex items-start gap-3">
                <div className="w-5 h-5 rounded-xs bg-[#2E2B27] text-[#FBF9F4] flex items-center justify-center shrink-0 mt-0.5">
                  <Compass className="w-3 h-3 text-[#D9381E]" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#FBF9F4]">Ward Dispatch Console</p>
                  <p className="text-[11px] text-[#A8A29E] mt-0.5">
                    PostGIS sector boundary routing, crew allocation matrix, and target SLA tracking.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-[#24211D] border border-[#38332C] rounded-sm flex items-start gap-3">
                <div className="w-5 h-5 rounded-xs bg-[#2E2B27] text-[#FBF9F4] flex items-center justify-center shrink-0 mt-0.5">
                  <FileCheck2 className="w-3 h-3 text-[#D9381E]" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#FBF9F4]">Governance Ledger</p>
                  <p className="text-[11px] text-[#A8A29E] mt-0.5">
                    City-wide resolution telemetry, immutable audit trails, and inter-ward accountability metrics.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Operational Status Footer */}
          <div className="pt-6 border-t border-[#33302B]">
            <div className="flex items-center justify-between text-[10px] font-mono text-[#A8A29E]">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                <span>ALL WARD DISPATCH HUBS ONLINE</span>
              </div>
              <span className="text-[#78716C]">SEC-L3 VERIFIED</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
