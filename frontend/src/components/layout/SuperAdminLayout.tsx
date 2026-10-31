import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Landmark,
  ShieldCheck,
  Users,
  History,
  LogOut,
  Menu,
  X,
  ExternalLink,
  ChevronRight,
  Sliders,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ThemeToggle } from '../ui/ThemeToggle';

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Overview', path: '/superadmin', icon: LayoutDashboard, end: true },
  { label: 'Wards', path: '/superadmin/wards', icon: Landmark },
  { label: 'Administrators', path: '/superadmin/admins', icon: ShieldCheck },
  { label: 'Users', path: '/superadmin/users', icon: Users },
  { label: 'Audit Logs', path: '/superadmin/audit', icon: History },
];

export const SuperAdminLayout: React.FC = () => {
  const { user, userRole, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch {
      // Ignored
    }
  };

  const currentNav = navItems.find((item) =>
    item.end ? location.pathname === item.path : location.pathname.startsWith(item.path)
  );
  const pageTitle = currentNav?.label || 'SuperAdmin Governance';

  const userDisplayName =
    (user?.user_metadata?.full_name as string) ||
    (user?.user_metadata?.display_name as string) ||
    user?.email?.split('@')[0] ||
    'Super Administrator';

  return (
    <div className="min-h-screen bg-[#18181B] text-[#F4F4F5] flex font-sans antialiased overflow-x-hidden">
      {/* ─── Desktop Fixed Sidebar (Dark Graphite Governance Console) ──────── */}
      <aside className="hidden md:flex flex-col w-64 bg-[#18181B] text-white border-r border-[#333338] shrink-0 fixed inset-y-0 left-0 z-30 font-sans">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-5 border-b border-[#333338] gap-3">
          <img
            src="/logo.png"
            alt="NagarWatch Logo"
            className="w-8 h-8 rounded-xs object-contain"
          />
          <div className="flex flex-col min-w-0">
            <span className="font-heading font-bold text-sm tracking-tight text-white flex items-center gap-1.5 leading-none">
              NagarWatch
              <span className="text-[9px] font-black uppercase tracking-wider bg-[#F05030]/20 text-[#F05030] border border-[#F05030]/30 px-1 py-0.2 rounded-xs">
                SuperAdmin
              </span>
            </span>
            <span className="text-[11px] text-[#A1A1AA] truncate mt-0.5">Governance Platform</span>
          </div>
        </div>

        {/* Live Operational Status Indicator */}
        <div className="px-5 py-2.5 bg-[#222226] border-b border-[#333338] flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-[11px] text-[#A1A1AA]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Root Authority</span>
          </div>
          <span className="text-[10px] font-mono-id text-[#F05030] font-semibold">All Wards</span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto dark-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-sm text-xs sm:text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-[#2B2B30] text-[#F05030] border border-[#333338] shadow-xs font-semibold'
                      : 'text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#222226]'
                  )
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom User Profile Card */}
        <div className="p-4 border-t border-[#333338] bg-[#222226]">
          <div className="flex items-center gap-2.5 mb-3">
            <Avatar name={userDisplayName} size="sm" className="ring-1 ring-[#F05030]/40" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{userDisplayName}</p>
              <p className="text-[11px] text-[#A1A1AA] font-medium truncate">Root Administrator</p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[#333338] text-xs">
            <Link
              to="/"
              className="text-[#A1A1AA] hover:text-[#F05030] flex items-center gap-1 transition-colors"
              title="Return to Public Portal"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Public Portal</span>
            </Link>
            <button
              onClick={handleSignOut}
              className="text-[#A1A1AA] hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer"
              title="Sign out of administration"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Mobile Slide-out Drawer ───────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#18181B] text-white border-r border-[#333338] z-10 font-sans shadow-xl">
            <div className="h-16 flex items-center justify-between px-5 border-b border-[#333338]">
              <div className="flex items-center gap-2.5">
                <img
                  src="/logo.png"
                  alt="NagarWatch Logo"
                  className="w-7 h-7 rounded-xs object-contain"
                />
                <span className="font-heading font-bold text-sm tracking-tight text-white">
                  SuperAdmin
                </span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-[#A1A1AA] hover:text-white p-1 rounded-sm focus-ring-dark"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-all duration-150',
                        isActive
                          ? 'bg-[#2B2B30] text-[#F05030] border border-[#333338] font-semibold'
                          : 'text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#222226]'
                      )
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="p-4 border-t border-[#333338] bg-[#222226]">
              <div className="flex items-center justify-between text-xs">
                <Link
                  to="/"
                  className="text-[#A1A1AA] hover:text-[#F05030] flex items-center gap-1.5"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Public Portal</span>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="text-red-400 hover:text-red-300 flex items-center gap-1"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Main Content Canvas ───────────────────────────────────────────── */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0 min-h-screen">
        {/* Top Header Bar */}
        <header className="h-16 bg-[#222226] border-b border-[#333338] sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger Button on Mobile (44px touch target) */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-[#A1A1AA] hover:text-white w-11 h-11 flex items-center justify-center -ml-2 rounded-sm focus-ring-dark cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb Title */}
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="text-[#A1A1AA] hidden sm:inline">NagarWatch Governance</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#333338] hidden sm:inline" />
              <h1 className="font-heading font-semibold text-white tracking-tight truncate">
                {pageTitle}
              </h1>
            </div>
          </div>

          {/* Right Toolbar */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Theme Toggle */}
            <ThemeToggle size="sm" />

            {/* Direct Admin Console Link */}
            <Link to="/admin">
              <Button
                variant="outline"
                size="sm"
                className="text-[#F4F4F5] border-[#333338] hover:bg-[#2B2B30] text-xs py-1"
              >
                Ward Admin Console
              </Button>
            </Link>

            {/* User Profile Pill */}
            <div className="flex items-center gap-2 p-1 rounded-sm">
              <Avatar name={userDisplayName} size="sm" className="ring-1 ring-[#F05030]/40" />
              <span className="hidden sm:inline text-xs font-medium text-stone-300 truncate max-w-[130px]">
                {userDisplayName}
              </span>
            </div>
          </div>
        </header>

        {/* Dynamic Outlet Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

SuperAdminLayout.displayName = 'SuperAdminLayout';
