import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { ThemeToggle } from '../ui/ThemeToggle';
import {
  User as UserIcon,
  FileText,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  ChevronDown,
} from 'lucide-react';

export const UserMenu: React.FC = () => {
  const { user, userRole, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!user) return null;

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
    navigate('/');
  };

  const displayIdentifier = user.phone || user.email || 'Citizen';
  const roleLabel =
    userRole === 'super_admin'
      ? 'Super Admin'
      : userRole === 'admin'
      ? 'Ward Admin'
      : 'Citizen';

  const roleVariant =
    userRole === 'super_admin'
      ? 'danger'
      : userRole === 'admin'
      ? 'primary'
      : 'neutral';

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User account menu"
        className="flex items-center gap-2 p-1.5 rounded-sm hover:bg-[#EFECE4] dark:hover:bg-[#2B2B30] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9381E]"
      >
        <Avatar name={displayIdentifier} size="sm" />
        <span className="hidden sm:inline-block text-xs font-medium text-[#1C1917] dark:text-[#F4F4F5] max-w-[120px] truncate">
          {displayIdentifier}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#57534E] dark:text-[#A1A1AA] transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-64 rounded-sm bg-[#FBF9F4] dark:bg-[#222226] shadow-lg border border-[#E5E0D4] dark:border-[#333338] py-1.5 z-50 font-sans"
        >
          {/* User Identity Header */}
          <div className="px-4 py-2.5 border-b border-[#E5E0D4] dark:border-[#333338] bg-[#EFECE4]/60 dark:bg-[#18181B]/60">
            <p className="text-[11px] text-[#57534E] dark:text-[#A1A1AA] font-medium uppercase tracking-wider">Signed in as</p>
            <p className="text-sm font-heading font-semibold text-[#1C1917] dark:text-[#F4F4F5] truncate mt-0.5">
              {displayIdentifier}
            </p>
            <div className="mt-1.5">
              <Badge variant={roleVariant} size="sm" dot>
                {roleLabel}
              </Badge>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="py-1">
            <Link
              to="/profile"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-[#EFECE4] dark:hover:bg-[#2B2B30] transition-colors"
            >
              <UserIcon className="w-4 h-4 text-stone-400" />
              <span>My Profile</span>
            </Link>

            <Link
              to="/my-reports"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-[#EFECE4] dark:hover:bg-[#2B2B30] transition-colors"
            >
              <FileText className="w-4 h-4 text-stone-400" />
              <span>My Reports</span>
            </Link>

            {/* Privileged Links */}
            {(userRole === 'admin' || userRole === 'super_admin') && (
              <Link
                to="/admin/issues"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#D9381E] dark:text-[#F05030] hover:bg-[#EFECE4] dark:hover:bg-[#2B2B30] transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-[#D9381E] dark:text-[#F05030]" />
                <span>Admin Panel</span>
              </Link>
            )}

            {userRole === 'super_admin' && (
              <Link
                to="/superadmin"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-[#EFECE4] dark:hover:bg-[#2B2B30] transition-colors"
              >
                <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>SuperAdmin Platform</span>
              </Link>
            )}
          </div>

          {/* Theme Quick Switcher Row */}
          <div className="px-4 py-2 flex items-center justify-between border-t border-[#E5E0D4] dark:border-[#333338]">
            <span className="text-xs font-medium text-[#57534E] dark:text-[#A1A1AA]">Theme</span>
            <ThemeToggle size="sm" />
          </div>

          {/* Sign Out Action */}
          <div className="pt-1 border-t border-[#E5E0D4] dark:border-[#333338]">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50/70 dark:hover:bg-red-950/30 transition-colors text-left cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-red-500 dark:text-red-400" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

UserMenu.displayName = 'UserMenu';
