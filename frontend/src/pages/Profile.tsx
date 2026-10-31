import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../lib/apiClient';
import {
  Phone,
  Mail,
  Shield,
  FileText,
  Compass,
  LogOut,
  ShieldCheck,
  Hash,
  Calendar,
  MapPin,
  Award,
  Edit2,
  Camera,
  CheckCircle,
  AlertCircle,
  X,
  Lock,
  Loader2,
  ArrowRight,
  UserCheck
} from 'lucide-react';

export interface UserProfileData {
  id: string;
  role: string;
  full_name: string;
  email: string;
  phone_number: string;
  avatar_url?: string | null;
  reputation_score: number;
  is_verified: boolean;
  primary_ward_id?: number | null;
  primary_ward_name?: string | null;
  created_at?: string | null;
  wards_allocated?: number[];
}

export default function ProfilePage() {
  const { user, userRole, signOut } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile data states
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Edit mode states
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Feedback states
  const [formErrors, setFormErrors] = useState<{
    fullName?: string;
    phoneNumber?: string;
    general?: string;
  }>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch live profile from backend /api/v1/users/me
  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      if (!user) return;
      setIsLoading(true);
      setFetchError(null);

      try {
        const res = await apiClient.get('/api/v1/users/me');
        if (isMounted && res.data?.data) {
          const data: UserProfileData = res.data.data;
          setProfile(data);
          setEditFullName(data.full_name || '');
          setEditPhoneNumber(data.phone_number || user.phone || '');
        }
      } catch (err: any) {
        if (isMounted) {
          const fallbackData: UserProfileData = {
            id: user.id,
            role: userRole || 'citizen',
            full_name: (user.user_metadata?.full_name as string) || 'Citizen',
            email: user.email || '',
            phone_number: user.phone || '',
            reputation_score: 0,
            is_verified: false,
          };
          setProfile(fallbackData);
          setEditFullName(fallbackData.full_name);
          setEditPhoneNumber(fallbackData.phone_number);
          if (err.response?.status !== 401) {
            setFetchError('Could not sync latest profile from server. Showing cached information.');
          }
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [user, userRole]);

  if (!user) return null;

  const currentRole = profile?.role || userRole || 'citizen';
  const roleLabel =
    currentRole === 'super_admin'
      ? 'Super Administrator'
      : currentRole === 'admin'
      ? 'Ward Administrator'
      : 'Citizen';

  const displayPhone = profile?.phone_number || user.phone || 'No phone registered';
  const displayEmail = profile?.email || user.email || 'No email registered';
  const displayName = profile?.full_name || 'Citizen';
  const displayAvatar = avatarPreview || profile?.avatar_url || undefined;

  let memberSince = 'NAGARWATCH Member';
  if (profile?.created_at) {
    try {
      const date = new Date(profile.created_at);
      memberSince = `Member since ${date.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })}`;
    } catch {
      // fallback
    }
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleStartEdit = () => {
    setEditFullName(profile?.full_name || '');
    setEditPhoneNumber(profile?.phone_number || user.phone || '');
    setFormErrors({});
    setSuccessMessage(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditFullName(profile?.full_name || '');
    setEditPhoneNumber(profile?.phone_number || user.phone || '');
    setAvatarPreview(null);
    setFormErrors({});
    setIsEditing(false);
  };

  // Avatar file upload handler
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setFormErrors((prev) => ({
        ...prev,
        general: 'Please select a JPEG, PNG, or WebP image for your profile avatar.',
      }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFormErrors((prev) => ({
        ...prev,
        general: 'Avatar image cannot exceed 5MB. Please choose a smaller photo.',
      }));
      return;
    }

    const localPreviewUrl = URL.createObjectURL(file);
    setAvatarPreview(localPreviewUrl);
    setIsUploadingAvatar(true);
    setFormErrors({});

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await apiClient.post('/api/v1/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.avatar_url) {
        setProfile((prev) => (prev ? { ...prev, avatar_url: res.data.avatar_url } : null));
        setSuccessMessage('Profile photo updated successfully!');
      }
    } catch (err: any) {
      setFormErrors((prev) => ({
        ...prev,
        general: err.response?.data?.message || 'Failed to upload profile photo.',
      }));
      setAvatarPreview(null);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Validate edit form fields
  const validateEditForm = (): boolean => {
    const errors: typeof formErrors = {};

    if (!editFullName.trim()) {
      errors.fullName = 'Full name is required.';
    } else if (editFullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters.';
    } else if (editFullName.trim().length > 100) {
      errors.fullName = 'Full name cannot exceed 100 characters.';
    }

    if (editPhoneNumber.trim()) {
      const cleanedPhone = editPhoneNumber.replace(/[\s\-()]/g, '');
      if (!/^\+?[0-9]{7,15}$/.test(cleanedPhone)) {
        errors.phoneNumber = 'Enter a valid phone number with 7 to 15 digits (e.g. +919876543210).';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save profile changes to backend
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEditForm()) return;

    setIsSaving(true);
    setFormErrors({});
    setSuccessMessage(null);

    try {
      const payload = {
        full_name: editFullName.trim(),
        phone_number: editPhoneNumber.trim(),
      };

      const res = await apiClient.patch('/api/v1/users/me', payload);

      if (res.data?.data) {
        setProfile(res.data.data);
        setIsEditing(false);
        setSuccessMessage('Profile updated successfully!');
      }
    } catch (err: any) {
      const status = err.response?.status;
      const data = err.response?.data;

      if (status === 403) {
        setFormErrors({
          general: data?.message || 'You do not have permission to modify these administrative fields.',
        });
      } else if (status === 400) {
        setFormErrors({
          general: data?.message || 'Please verify the accuracy of your profile fields.',
        });
      } else {
        setFormErrors({
          general: 'Could not save profile changes. Please try again.',
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-[88vh] bg-[#F4F1EA] dark:bg-[#18181B] py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Page Masthead */}
        <div className="border-b border-[#E5E0D4] dark:border-[#333338] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#78716C] dark:text-[#A1A1AA] mb-1">
              <UserCheck className="w-3.5 h-3.5 text-[#D9381E] dark:text-[#F05030]" />
              <span>Civic Identity Dossier</span>
            </div>
            <h1 className="text-3xl font-serif text-[#1C1917] dark:text-[#F4F4F5] tracking-tight">My Profile</h1>
            <p className="text-xs text-[#78716C] dark:text-[#A1A1AA] mt-1 font-sans">
              View and manage your verified account identity, contact details, and municipal jurisdiction.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                type="button"
                onClick={handleStartEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-[#1C1917] dark:border-[#333338] bg-[#1C1917] dark:bg-[#F4F4F5] hover:bg-[#D9381E] dark:hover:bg-[#EAE5D9] text-white dark:text-[#18181B] text-xs font-semibold uppercase tracking-wider transition-colors min-h-[36px] cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-[#E5E0D4] dark:border-[#333338] bg-[#FBF9F4] dark:bg-[#222226] hover:bg-[#FDF0EE] dark:hover:bg-[#2B2B30] text-[#D9381E] dark:text-[#F05030] hover:border-[#FACDC6] dark:hover:border-[#F05030]/40 text-xs font-semibold uppercase tracking-wider transition-colors min-h-[36px] cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Notifications */}
        {successMessage && (
          <div
            role="status"
            className="p-3.5 rounded-sm bg-[#F4F1EA] dark:bg-[#222226] border border-[#1C1917] dark:border-[#333338] text-[#1C1917] dark:text-[#F4F4F5] text-xs flex items-center justify-between shadow-2xs"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle className="w-4 h-4 text-[#10B981] shrink-0" />
              <p className="font-medium">{successMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-[#78716C] dark:text-[#A1A1AA] hover:text-[#1C1917] dark:hover:text-[#F4F4F5] p-1 cursor-pointer"
              aria-label="Dismiss message"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {fetchError && (
          <div
            role="alert"
            className="p-3.5 rounded-sm bg-[#FDF0EE] dark:bg-red-950/40 border border-[#FACDC6] dark:border-red-900 text-[#D9381E] dark:text-red-400 text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-[#D9381E] dark:text-red-400 shrink-0" />
            <p>{fetchError}</p>
          </div>
        )}

        {/* Main Dossier Card */}
        <div className="bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] rounded-sm shadow-2xs overflow-hidden">
          
          {/* Identity Header Strip */}
          <div className="p-6 border-b border-[#E5E0D4] dark:border-[#333338] flex flex-col sm:flex-row sm:items-center justify-between gap-5 bg-white dark:bg-[#1C1C20]">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-xs bg-[#F4F1EA] dark:bg-[#2B2B30] border border-[#E5E0D4] dark:border-[#333338] text-[#1C1917] dark:text-[#F4F4F5] flex items-center justify-center font-serif text-2xl font-bold overflow-hidden shadow-2xs">
                  {displayAvatar ? (
                    <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{displayName.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    aria-label="Change profile picture"
                    className="absolute -bottom-1 -right-1 p-1.5 rounded-xs bg-[#1C1917] dark:bg-[#F4F4F5] text-white dark:text-[#18181B] hover:bg-[#D9381E] dark:hover:bg-[#EAE5D9] shadow-xs transition-colors cursor-pointer"
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl font-serif font-bold text-[#1C1917] dark:text-[#F4F4F5]">{displayName}</h2>
                  {profile?.is_verified && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-xs bg-[#F4F1EA] dark:bg-[#2B2B30] text-[#1C1917] dark:text-[#F4F4F5] border border-[#D5CEBF] dark:border-[#333338]">
                      <ShieldCheck className="w-3 h-3 text-[#1C1917] dark:text-[#F4F4F5]" />
                      Verified
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs text-[#78716C] dark:text-[#A1A1AA]">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-[#D9381E] dark:text-[#F05030] font-semibold">
                    {roleLabel}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <Calendar className="w-3 h-3 text-[#A8A29E] dark:text-[#78716C]" />
                    {memberSince}
                  </span>
                </div>
              </div>
            </div>

            {/* Reputation Badge Pill */}
            <div className="p-3 bg-[#FBF9F4] dark:bg-[#2B2B30] border border-[#E5E0D4] dark:border-[#333338] rounded-sm flex items-center gap-3 shrink-0">
              <div className="w-8 h-8 rounded-xs bg-[#F4F1EA] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] text-[#D9381E] dark:text-[#F05030] flex items-center justify-center">
                <Award className="w-4 h-4 text-[#D9381E] dark:text-[#F05030]" />
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA]">Trust Tier</p>
                <p className="text-sm font-bold font-mono text-[#1C1917] dark:text-[#F4F4F5]">
                  Level {Math.floor((profile?.reputation_score ?? 0) / 10) + 1}
                </p>
              </div>
            </div>
          </div>

          {/* Hidden file input for avatar photo upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarFileChange}
            className="hidden"
            id="avatar-upload-input"
          />

          {/* Dossier Body */}
          <div className="p-6">
            {isEditing ? (
              <form onSubmit={handleSaveProfile} noValidate className="space-y-5">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label htmlFor="edit-fullname" className="block text-[11px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA] mb-1.5">
                      Full Name *
                    </label>
                    <input
                      id="edit-fullname"
                      type="text"
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full px-3 py-2 bg-white dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] rounded-sm text-xs text-[#1C1917] dark:text-[#F4F4F5] focus:outline-none focus:border-[#1C1917] dark:focus:border-[#F05030] focus:ring-1 focus:ring-[#1C1917] dark:focus:ring-[#F05030] font-sans"
                    />
                    {formErrors.fullName && (
                      <p className="text-xs text-[#D9381E] dark:text-[#F05030] mt-1 font-mono">{formErrors.fullName}</p>
                    )}
                    <p className="text-[11px] text-[#A8A29E] dark:text-[#78716C] mt-1">Your name will be visible on your submitted civic contributions.</p>
                  </div>

                  <div>
                    <label htmlFor="edit-phone" className="block text-[11px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA] mb-1.5">
                      Phone Number
                    </label>
                    <input
                      id="edit-phone"
                      type="tel"
                      value={editPhoneNumber}
                      onChange={(e) => setEditPhoneNumber(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-2 bg-white dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] rounded-sm text-xs text-[#1C1917] dark:text-[#F4F4F5] focus:outline-none focus:border-[#1C1917] dark:focus:border-[#F05030] focus:ring-1 focus:ring-[#1C1917] dark:focus:ring-[#F05030] font-mono"
                    />
                    {formErrors.phoneNumber && (
                      <p className="text-xs text-[#D9381E] dark:text-[#F05030] mt-1 font-mono">{formErrors.phoneNumber}</p>
                    )}
                    <p className="text-[11px] text-[#A8A29E] dark:text-[#78716C] mt-1">Format: 7 to 15 digits with optional country code.</p>
                  </div>

                  <div className="p-3 rounded-xs bg-[#F4F1EA] dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA] flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-[#A8A29E] dark:text-[#78716C]" />
                        Email Address
                      </span>
                      <span className="text-[10px] font-mono text-[#78716C] dark:text-[#A1A1AA] flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Read-only
                      </span>
                    </div>
                    <p className="text-xs font-mono font-medium text-[#1C1917] dark:text-[#F4F4F5]">{displayEmail}</p>
                    <p className="text-[11px] text-[#78716C] dark:text-[#A1A1AA] mt-1">
                      Email address is tied to your Supabase authentication account and cannot be modified here.
                    </p>
                  </div>
                </div>

                {formErrors.general && (
                  <div role="alert" className="p-3 rounded-xs bg-[#FDF0EE] dark:bg-red-950/40 text-[#D9381E] dark:text-red-400 border border-[#FACDC6] dark:border-red-900 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>{formErrors.general}</p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#E5E0D4] dark:border-[#333338]">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-sm border border-[#E5E0D4] dark:border-[#333338] bg-white dark:bg-[#18181B] hover:bg-[#F4F1EA] dark:hover:bg-[#2B2B30] text-[#1C1917] dark:text-[#F4F4F5] text-xs font-semibold uppercase tracking-wider transition-colors min-h-[38px] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 rounded-sm bg-[#1C1917] dark:bg-[#F4F4F5] hover:bg-[#D9381E] dark:hover:bg-[#EAE5D9] text-white dark:text-[#18181B] text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-2 min-h-[38px] disabled:opacity-60 cursor-pointer"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* View Mode Profile Fields */
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Phone */}
                  <div className="p-3.5 rounded-sm bg-white dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] flex items-start gap-3">
                    <Phone className="w-4 h-4 text-[#A8A29E] dark:text-[#78716C] mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA]">Phone</p>
                      <p className="text-xs font-mono font-medium text-[#1C1917] dark:text-[#F4F4F5] mt-0.5 truncate">{displayPhone}</p>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="p-3.5 rounded-sm bg-white dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] flex items-start gap-3">
                    <Mail className="w-4 h-4 text-[#A8A29E] dark:text-[#78716C] mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA]">Email Address</p>
                      <p className="text-xs font-mono font-medium text-[#1C1917] dark:text-[#F4F4F5] mt-0.5 truncate">{displayEmail}</p>
                    </div>
                  </div>

                  {/* Verified Role */}
                  <div className="p-3.5 rounded-sm bg-white dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] flex items-start gap-3">
                    <Shield className="w-4 h-4 text-[#A8A29E] dark:text-[#78716C] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA]">Verified Role</p>
                      <p className="text-xs font-semibold text-[#1C1917] dark:text-[#F4F4F5] mt-0.5">{roleLabel}</p>
                    </div>
                  </div>

                  {/* Reputation */}
                  <div className="p-3.5 rounded-sm bg-white dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] flex items-start gap-3">
                    <Award className="w-4 h-4 text-[#D9381E] dark:text-[#F05030] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA]">Civic Reputation</p>
                      <p className="text-xs font-mono font-bold text-[#1C1917] dark:text-[#F4F4F5] mt-0.5">
                        {profile?.reputation_score ?? 0} Points
                      </p>
                    </div>
                  </div>
                </div>

                {/* Primary Ward (if available) */}
                {profile?.primary_ward_name ? (
                  <div className="p-3.5 rounded-sm bg-[#F4F1EA] dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-[#D9381E] dark:text-[#F05030] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA]">Primary Ward Jurisdiction</p>
                      <p className="text-xs font-bold text-[#1C1917] dark:text-[#F4F4F5] mt-0.5">
                        {profile.primary_ward_name} {profile.primary_ward_id ? `(Ward #${profile.primary_ward_id})` : ''}
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* User Identifier */}
                <div className="p-3.5 rounded-sm bg-white dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] flex items-start gap-3">
                  <Hash className="w-4 h-4 text-[#A8A29E] dark:text-[#78716C] mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-[#78716C] dark:text-[#A1A1AA]">User Identifier</p>
                    <p className="text-[11px] font-mono text-[#57534E] dark:text-[#A1A1AA] mt-0.5 truncate select-all">
                      {user.id}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Dossier Footer Ribbon */}
          <div className="px-6 py-3 border-t border-[#E5E0D4] dark:border-[#333338] bg-[#F4F1EA] dark:bg-[#18181B] flex items-center justify-between text-[10px] font-mono text-[#78716C] dark:text-[#A1A1AA]">
            <span>Role verified via NagarWatch authentication API</span>
            <span className="text-[#1C1917] dark:text-[#F4F4F5] font-semibold">SEC-AUTH OK</span>
          </div>
        </div>

        {/* Quick Actions Navigation Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/my-reports"
            className="p-4 rounded-sm bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] hover:border-[#1C1917] dark:hover:border-[#F05030] transition-all group flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xs bg-[#F4F1EA] dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] group-hover:border-[#1C1917] dark:group-hover:border-[#F05030] text-[#1C1917] dark:text-[#F4F4F5] flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#1C1917] dark:text-[#F4F4F5] group-hover:text-[#D9381E] dark:group-hover:text-[#F05030] transition-colors">
                  My Reports
                </p>
                <p className="text-[11px] text-[#78716C] dark:text-[#A1A1AA]">Track status of your submitted incidents</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#A8A29E] dark:text-[#78716C] group-hover:text-[#1C1917] dark:group-hover:text-[#F4F4F5] group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            to="/explore"
            className="p-4 rounded-sm bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] hover:border-[#1C1917] dark:hover:border-[#F05030] transition-all group flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xs bg-[#F4F1EA] dark:bg-[#18181B] border border-[#E5E0D4] dark:border-[#333338] group-hover:border-[#1C1917] dark:group-hover:border-[#F05030] text-[#1C1917] dark:text-[#F4F4F5] flex items-center justify-center">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#1C1917] dark:text-[#F4F4F5] group-hover:text-[#D9381E] dark:group-hover:text-[#F05030] transition-colors">
                  Explore Neighbourhood
                </p>
                <p className="text-[11px] text-[#78716C] dark:text-[#A1A1AA]">Discover active issues near your current location</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#A8A29E] dark:text-[#78716C] group-hover:text-[#1C1917] dark:group-hover:text-[#F4F4F5] group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

      </div>
    </div>
  );
}
