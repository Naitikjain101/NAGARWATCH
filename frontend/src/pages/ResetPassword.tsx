import React, { useState, useId } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Shield,
  ArrowRight,
  KeyRound
} from 'lucide-react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { clearPasswordRecovery } = useAuth();
  const navigate = useNavigate();

  const passwordId = useId();
  const confirmPasswordId = useId();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      clearPasswordRecovery();
    } catch (err: any) {
      setError(err?.message || 'Failed to update password. Your recovery link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] bg-[#F4F1EA] dark:bg-[#18181B] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] rounded-sm p-6 sm:p-8 shadow-2xs">
        {/* Header / Masthead */}
        <div className="border-b border-[#E5E0D4] dark:border-[#333338] pb-5 mb-6 text-left">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#78716C] dark:text-[#A1A1AA] mb-1.5">
            <KeyRound className="w-3.5 h-3.5 text-[#D9381E]" />
            <span>Security Protocol • Credential Update</span>
          </div>
          <h1 className="text-2xl font-mono font-bold text-[#1C1917] dark:text-[#F4F4F5] tracking-tight">Set New Password</h1>
          <p className="text-xs text-[#78716C] dark:text-[#A1A1AA] mt-1 font-sans">
            Choose a secure new password for your NAGARWATCH account
          </p>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 bg-[#F4F1EA] dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] text-[#1C1917] dark:text-[#F4F4F5] rounded-xs flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-[#10B981]" />
            </div>
            <h2 className="text-lg font-mono font-bold text-[#1C1917] dark:text-[#F4F4F5]">Password Changed!</h2>
            <p className="text-xs text-[#57534E] dark:text-[#A1A1AA] leading-relaxed">
              Your password has been successfully updated. You can now use your new password to sign in.
            </p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#1C1917] hover:bg-[#D9381E] text-white dark:bg-[#F4F4F5] dark:text-[#18181B] dark:hover:bg-[#D9381E] dark:hover:text-white font-semibold py-2.5 rounded-sm transition-colors text-xs uppercase tracking-wider min-h-[44px] mt-2"
            >
              Sign In to NAGARWATCH <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            {error && (
              <div role="alert" className="p-3 rounded-sm bg-[#FDF0EE] dark:bg-[#3D1A16] text-[#D9381E] dark:text-[#F87171] border border-[#FACDC6] dark:border-[#7F1D1D] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#D9381E] dark:text-[#F87171]" />
                <span>{error}</span>
              </div>
            )}

            {/* New Password */}
            <div>
              <label htmlFor={passwordId} className="block text-[11px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA] mb-1.5">
                New Password
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
            </div>

            {/* Confirm New Password */}
            <div>
              <label htmlFor={confirmPasswordId} className="block text-[11px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA] mb-1.5">
                Confirm New Password
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

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-[#1C1917] hover:bg-[#D9381E] text-white dark:bg-[#F4F4F5] dark:text-[#18181B] dark:hover:bg-[#D9381E] dark:hover:text-white font-semibold py-2.5 rounded-sm transition-colors flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-60 min-h-[44px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                'Set New Password'
              )}
            </button>

            <div className="text-center pt-2">
              <Link to="/login" className="text-xs text-[#78716C] dark:text-[#A1A1AA] hover:text-[#1C1917] dark:hover:text-[#F4F4F5] font-mono">
                Cancel and return to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
