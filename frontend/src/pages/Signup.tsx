import React, { useState, useId } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Shield,
  ArrowRight,
  RefreshCw,
  Sparkles,
  FileCheck2,
  MapPin,
  Award
} from 'lucide-react';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+91');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const navigate = useNavigate();
  const fullNameId = useId();
  const emailId = useId();
  const phoneId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();

  // ─── Input Formatting & Handlers ──────────────────────────────────────────
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val.length < 3) {
      setPhone('+91');
      return;
    }
    if (!val.startsWith('+91')) {
      val = '+91' + val.replace(/^\+?91?/, '');
    }
    // Allow +91 followed by digits only, max 10 digits
    const cleaned = '+91' + val.slice(3).replace(/\D/g, '').slice(0, 10);
    setPhone(cleaned);
  };

  // ─── Validation Helpers ───────────────────────────────────────────────────
  const isEmailValid = (em: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.trim());

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-[#D9381E]' };
    if (score <= 3) return { score: 2, label: 'Moderate', color: 'bg-[#D97706]' };
    return { score: 3, label: 'Strong', color: 'bg-[#10B981]' };
  };

  const strength = getPasswordStrength(password);

  // ─── Signup Submission ────────────────────────────────────────────────────
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResendMessage(null);

    // Client-side validations
    if (fullName.trim().length < 2) {
      setError('Please enter your full name (minimum 2 characters).');
      return;
    }

    if (!isEmailValid(email)) {
      setError('Please provide a valid email address.');
      return;
    }

    if (phone.length < 13) {
      setError('Please enter a valid 10-digit mobile number with +91.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }

    setLoading(true);

    try {
      const trimmedEmail = email.trim().toLowerCase();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
            role: 'citizen',
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      // Check whether session was immediately granted or confirmation email was dispatched
      if (data.session) {
        navigate('/', { replace: true });
        return;
      }

      // Email confirmation required
      setIsEmailSent(true);
    } catch (err: any) {
      let rawMsg = err?.message || '';
      if (rawMsg.includes('User already registered') || rawMsg.includes('already exists') || err?.code === 'user_already_exists') {
        setError('An account with this email already exists. Please sign in instead.');
      } else if (rawMsg.includes('over_email_send_rate_limit') || err?.code === 429) {
        setError('Email delivery rate limit reached. Please wait a few minutes before trying again or contact system administrator.');
      } else if (rawMsg.includes('weak') || rawMsg.includes('Password should be')) {
        setError('Password is too weak. Please include at least 8 characters with numbers and letters.');
      } else {
        setError(rawMsg || 'Failed to complete registration. Please check your information and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Resend Verification Email ────────────────────────────────────────────
  const handleResendEmail = async () => {
    if (resendCooldown > 0 || !email) return;
    setLoading(true);
    setResendMessage(null);
    setError(null);

    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (resendErr) throw resendErr;

      setResendMessage('Verification email has been resent! Please check your inbox.');
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      let msg = err?.message || 'Failed to resend verification email.';
      if (msg.includes('over_email_send_rate_limit')) {
        msg = 'Rate limit reached. Please wait a few minutes before requesting another email.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ─── View: Email Verification Notice ──────────────────────────────────────
  if (isEmailSent) {
    return (
      <div className="min-h-[85vh] bg-[#F4F1EA] dark:bg-[#18181B] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] rounded-sm p-8 text-center shadow-xs">
          <div className="w-12 h-12 bg-[#F4F1EA] dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] text-[#1C1917] dark:text-[#F4F4F5] rounded-xs flex items-center justify-center mx-auto mb-5">
            <Mail className="w-6 h-6 text-[#D9381E]" />
          </div>

          <div className="border-b border-[#E5E0D4] dark:border-[#333338] pb-4 mb-5">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#78716C] dark:text-[#A1A1AA] mb-1">
              Dispatch Confirmation
            </div>
            <h1 className="text-2xl font-serif text-[#1C1917] dark:text-[#F4F4F5] tracking-tight">Check Your Email</h1>
          </div>

          <p className="text-xs text-[#57534E] dark:text-[#A1A1AA] mb-6 leading-relaxed">
            We have sent an activation link to <br />
            <strong className="text-[#1C1917] dark:text-[#F4F4F5] font-semibold font-mono">{email}</strong>.
            <br />
            Click the link in the message to activate your citizen account.
          </p>

          {resendMessage && (
            <div className="bg-[#F4F1EA] dark:bg-[#18181B] text-[#1C1917] dark:text-[#F4F4F5] border border-[#E5E0D4] dark:border-[#333338] p-3 rounded-xs text-xs mb-5 flex items-center gap-2 text-left">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#1C1917] dark:text-[#F4F4F5]" />
              <span>{resendMessage}</span>
            </div>
          )}

          {error && (
            <div className="bg-[#FDF0EE] dark:bg-[#3D1A16] text-[#D9381E] dark:text-[#F87171] border border-[#FACDC6] dark:border-[#7F1D1D] p-3 rounded-xs text-xs mb-5 flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleResendEmail}
              disabled={loading || resendCooldown > 0}
              className="w-full border border-[#E5E0D4] dark:border-[#333338] bg-white dark:bg-[#18181B] hover:bg-[#F4F1EA] dark:hover:bg-[#27272A] text-[#1C1917] dark:text-[#F4F4F5] font-medium py-2.5 rounded-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed text-xs uppercase tracking-wider min-h-[44px]"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#D9381E]" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {resendCooldown > 0 ? `Resend email in ${resendCooldown}s` : 'Resend Verification Email'}
            </button>

            <Link
              to="/login"
              className="w-full inline-flex items-center justify-center gap-2 bg-[#1C1917] hover:bg-[#D9381E] text-white dark:bg-[#F4F4F5] dark:text-[#18181B] dark:hover:bg-[#D9381E] dark:hover:text-white font-semibold py-2.5 rounded-sm transition-colors text-xs uppercase tracking-wider min-h-[44px]"
            >
              Return to Sign In <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── View: Main Signup Form ───────────────────────────────────────────────
  return (
    <div className="min-h-[88vh] bg-[#F4F1EA] dark:bg-[#18181B] py-8 sm:py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* Left Column: Registration Form (7 cols) */}
        <div className="lg:col-span-7 bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] rounded-sm p-6 sm:p-8 flex flex-col justify-between shadow-2xs">
          <div>
            {/* Header / Masthead */}
            <div className="border-b border-[#E5E0D4] dark:border-[#333338] pb-5 mb-6">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-[#F4F1EA] dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] text-[10px] font-mono uppercase tracking-widest text-[#78716C] dark:text-[#A1A1AA]">
                  <Shield className="w-3 h-3 text-[#D9381E]" />
                  <span>Citizen Registry</span>
                </div>
                <span className="text-[10px] font-mono text-[#78716C] dark:text-[#A1A1AA]">REGISTER v2.6</span>
              </div>
              <h1 className="text-3xl font-serif text-[#1C1917] dark:text-[#F4F4F5] tracking-tight">Create Account</h1>
              <p className="text-xs text-[#78716C] dark:text-[#A1A1AA] mt-1 font-sans">
                Join NAGARWATCH to report and resolve neighbourhood issues
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
                  {error.includes('already exists') && (
                    <div className="mt-2">
                      <Link to="/login" className="font-semibold text-[#1C1917] dark:text-[#F4F4F5] underline hover:text-[#D9381E]">
                        Go to Sign In
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Registration Form */}
            <form noValidate onSubmit={handleSignup} className="space-y-4">
              {/* Full Name */}
              <div>
                <label htmlFor={fullNameId} className="block text-[11px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA] mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E] dark:text-[#71717A] w-4 h-4 pointer-events-none" />
                  <input
                    id={fullNameId}
                    type="text"
                    placeholder="Naitik Jain"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                    required
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] rounded-sm text-xs text-[#1C1917] dark:text-[#F4F4F5] placeholder:text-[#A8A29E] dark:placeholder:text-[#71717A] focus:outline-none focus:border-[#1C1917] dark:focus:border-[#F4F4F5] focus:ring-1 focus:ring-[#1C1917] dark:focus:ring-[#F4F4F5] transition-all font-sans"
                  />
                </div>
              </div>

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

              {/* Mobile Number (+91) */}
              <div>
                <label htmlFor={phoneId} className="block text-[11px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA] mb-1.5">
                  Mobile Number (+91)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E] dark:text-[#71717A] w-4 h-4 pointer-events-none" />
                  <input
                    id={phoneId}
                    type="tel"
                    placeholder="+919876543210"
                    value={phone}
                    onChange={handlePhoneChange}
                    disabled={loading}
                    required
                    maxLength={13}
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] rounded-sm text-xs text-[#1C1917] dark:text-[#F4F4F5] placeholder:text-[#A8A29E] dark:placeholder:text-[#71717A] focus:outline-none focus:border-[#1C1917] dark:focus:border-[#F4F4F5] focus:ring-1 focus:ring-[#1C1917] dark:focus:ring-[#F4F4F5] transition-all font-mono"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor={passwordId} className="block text-[11px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA] mb-1.5">
                  Password
                </label>
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
                    autoComplete="new-password"
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

                {/* Password Strength Indicator */}
                {password.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1 flex-1 bg-[#E5E0D4] dark:bg-[#333338] rounded-xs overflow-hidden flex gap-1">
                      <div className={`h-full flex-1 transition-all ${strength.score >= 1 ? strength.color : 'bg-transparent'}`} />
                      <div className={`h-full flex-1 transition-all ${strength.score >= 2 ? strength.color : 'bg-transparent'}`} />
                      <div className={`h-full flex-1 transition-all ${strength.score >= 3 ? strength.color : 'bg-transparent'}`} />
                    </div>
                    <span className="text-[10px] font-mono font-medium text-[#78716C] dark:text-[#A1A1AA] uppercase">{strength.label}</span>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor={confirmPasswordId} className="block text-[11px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA] mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E] dark:text-[#71717A] w-4 h-4 pointer-events-none" />
                  <input
                    id={confirmPasswordId}
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    required
                    autoComplete="new-password"
                    className="w-full pl-9 pr-9 py-2 bg-white dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] rounded-sm text-xs text-[#1C1917] dark:text-[#F4F4F5] placeholder:text-[#A8A29E] dark:placeholder:text-[#71717A] focus:outline-none focus:border-[#1C1917] dark:focus:border-[#F4F4F5] focus:ring-1 focus:ring-[#1C1917] dark:focus:ring-[#F4F4F5] transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A8A29E] dark:text-[#71717A] hover:text-[#1C1917] dark:hover:text-[#F4F4F5] focus:outline-none p-1"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <p className="text-xs text-[#D9381E] mt-1 font-mono">Passwords do not match</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-[#1C1917] hover:bg-[#D9381E] text-white dark:bg-[#F4F4F5] dark:text-[#18181B] dark:hover:bg-[#D9381E] dark:hover:text-white font-semibold py-2.5 rounded-sm transition-colors flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Register as Citizen</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Access Prompt */}
            <div className="mt-5 p-3 rounded-sm bg-[#F4F1EA] dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-[#D9381E] shrink-0" />
                <span className="text-[#57534E] dark:text-[#A1A1AA] truncate">Testing or reviewing? Skip signup with instant demo roles.</span>
              </div>
              <Link
                to="/login"
                className="font-bold text-[#1C1917] dark:text-[#F4F4F5] hover:text-[#D9381E] dark:hover:text-[#D9381E] whitespace-nowrap inline-flex items-center gap-1 shrink-0 font-mono text-[11px]"
              >
                <span>Demo Log In</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Footer Links */}
          <div className="mt-6 pt-4 border-t border-[#E5E0D4] dark:border-[#333338] text-center text-xs text-[#78716C] dark:text-[#A1A1AA]">
            Already registered on NAGARWATCH?{' '}
            <Link to="/login" className="text-[#1C1917] dark:text-[#F4F4F5] font-semibold hover:text-[#D9381E] underline ml-1">
              Sign In here
            </Link>
          </div>
        </div>

        {/* Right Column: Citizen Charter & Verification Integrity (5 cols) */}
        <div className="hidden lg:flex lg:col-span-5 bg-[#1C1917] dark:bg-[#121215] text-[#FBF9F4] rounded-sm p-8 flex-col justify-between border border-[#2E2B27] dark:border-[#27272A] relative overflow-hidden">
          <div className="space-y-6">
            <div className="border-b border-[#33302B] pb-4">
              <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#A8A29E] uppercase mb-1">
                <span>Citizen Charter</span>
                <span>•</span>
                <span className="text-[#D9381E]">Section 4(A)</span>
              </div>
              <h2 className="text-xl font-serif tracking-tight text-[#FBF9F4]">
                Citizen Participation & Governance Protocol
              </h2>
            </div>

            <p className="text-xs text-[#A8A29E] leading-relaxed">
              Registering establishes your verified citizen identity on the city municipal graph. Every reported issue empowers your local ward administration to allocate field resources efficiently and resolve civic failures.
            </p>

            <div className="space-y-3.5 pt-2">
              <div className="p-3 bg-[#24211D] border border-[#38332C] rounded-sm flex items-start gap-3">
                <div className="w-5 h-5 rounded-xs bg-[#2E2B27] text-[#FBF9F4] flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-3 h-3 text-[#D9381E]" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#FBF9F4]">Ward Sector Geotagging</p>
                  <p className="text-[11px] text-[#A8A29E] mt-0.5">
                    Reports are mapped directly to official ward polygons, eliminating inter-departmental jurisdiction disputes.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-[#24211D] border border-[#38332C] rounded-sm flex items-start gap-3">
                <div className="w-5 h-5 rounded-xs bg-[#2E2B27] text-[#FBF9F4] flex items-center justify-center shrink-0 mt-0.5">
                  <FileCheck2 className="w-3 h-3 text-[#D9381E]" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#FBF9F4]">Resolution Certification</p>
                  <p className="text-[11px] text-[#A8A29E] mt-0.5">
                    Issues cannot be closed without official photographic proof inspected by ward administrators.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-[#24211D] border border-[#38332C] rounded-sm flex items-start gap-3">
                <div className="w-5 h-5 rounded-xs bg-[#2E2B27] text-[#FBF9F4] flex items-center justify-center shrink-0 mt-0.5">
                  <Award className="w-3 h-3 text-[#D9381E]" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#FBF9F4]">Civic Reputation Score</p>
                  <p className="text-[11px] text-[#A8A29E] mt-0.5">
                    Earn verified civic trust points when your reported issues and confirmation votes improve your neighbourhood.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Security Assurance */}
          <div className="pt-6 border-t border-[#33302B]">
            <p className="text-[10px] font-mono text-[#78716C]">
              DATA PROTECTION: Personal credentials and phone numbers are encrypted and masked under municipal data privacy directives.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
