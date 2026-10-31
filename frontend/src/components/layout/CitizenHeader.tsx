import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserMenu } from './UserMenu';
import { Button } from '../ui/Button';
import { ThemeToggle } from '../ui/ThemeToggle';
import { PlusCircle, LogIn, Compass, Home, FileText, Sparkles } from 'lucide-react';

export const CitizenHeader: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="bg-[#FBF9F4] dark:bg-[#18181B] border-b border-[#E5E0D4] dark:border-[#333338] sticky top-0 z-40 font-sans shadow-xs transition-colors duration-150">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand / Masthead Logo */}
        <Link
          to="/"
          className="flex items-center gap-2.5 hover:opacity-95 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9381E] rounded-sm p-1 shrink-0"
        >
          <img
            src="/logo.png"
            alt="NagarWatch Logo"
            className="w-8 h-8 sm:w-8.5 sm:h-8.5 object-contain rounded-xs shadow-2xs"
          />
          <div className="flex flex-col">
            <span className="font-mono font-bold text-xl sm:text-2xl tracking-tight text-[#1C1917] dark:text-[#F4F4F5] leading-none">
              NagarWatch
            </span>
            <span className="hidden sm:inline-block text-[10px] uppercase font-mono tracking-widest text-[#57534E] dark:text-[#A1A1AA] mt-0.5">
              Civic Dispatch &amp; Intelligence
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1.5" aria-label="Main Navigation">
          <Link
            to="/"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs lg:text-sm font-medium transition-colors ${
              isActive('/')
                ? 'text-[#D9381E] bg-[#D9381E]/10 dark:text-[#F05030] dark:bg-[#F05030]/15 font-semibold'
                : 'text-[#57534E] dark:text-[#A1A1AA] hover:text-[#1C1917] dark:hover:text-[#F4F4F5] hover:bg-[#EFECE4] dark:hover:bg-[#2B2B30]'
            }`}
          >
            <Home className="w-4 h-4 stroke-[1.8]" />
            <span>Home</span>
          </Link>

          <Link
            to="/explore"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs lg:text-sm font-medium transition-colors ${
              isActive('/explore') || isActive('/civic-media')
                ? 'text-[#D9381E] bg-[#D9381E]/10 dark:text-[#F05030] dark:bg-[#F05030]/15 font-semibold'
                : 'text-[#57534E] dark:text-[#A1A1AA] hover:text-[#1C1917] dark:hover:text-[#F4F4F5] hover:bg-[#EFECE4] dark:hover:bg-[#2B2B30]'
            }`}
          >
            <Compass className="w-4 h-4 stroke-[1.8]" />
            <span>Explore</span>
          </Link>

          {user && (
            <Link
              to="/my-reports"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs lg:text-sm font-medium transition-colors ${
                isActive('/my-reports') || isActive('/dashboard')
                  ? 'text-[#D9381E] bg-[#D9381E]/10 dark:text-[#F05030] dark:bg-[#F05030]/15 font-semibold'
                  : 'text-[#57534E] dark:text-[#A1A1AA] hover:text-[#1C1917] dark:hover:text-[#F4F4F5] hover:bg-[#EFECE4] dark:hover:bg-[#2B2B30]'
              }`}
            >
              <FileText className="w-4 h-4 stroke-[1.8]" />
              <span>My Reports</span>
            </Link>
          )}
        </nav>

        {/* Right Actions & Account */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Theme Toggle (Light / Dark) */}
          <ThemeToggle />

          {/* Primary Action Button */}
          <Link to="/report" className="hidden sm:inline-flex">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<PlusCircle className="w-4 h-4" />}
              className="bg-[#D9381E] hover:bg-[#B82810] dark:bg-[#F05030] dark:hover:bg-[#D9381E] text-white border-transparent shadow-xs"
            >
              Report Issue
            </Button>
          </Link>

          {/* User Account / Auth Actions */}
          {user ? (
            <UserMenu />
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Sparkles className="w-3.5 h-3.5 text-[#D9381E] dark:text-[#F05030]" />}
                  className="hidden md:inline-flex border-[#E5E0D4] dark:border-[#333338] text-[#1C1917] dark:text-[#F4F4F5] bg-[#FBF9F4] dark:bg-[#222226] hover:bg-[#EFECE4] dark:hover:bg-[#2B2B30] font-medium"
                >
                  Demo Log In
                </Button>
              </Link>
              <Link to="/login">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<LogIn className="w-3.5 h-3.5" />}
                  className="border-[#E5E0D4] dark:border-[#333338] text-[#1C1917] dark:text-[#F4F4F5] bg-[#FBF9F4] dark:bg-[#222226] hover:bg-[#EFECE4] dark:hover:bg-[#2B2B30]"
                >
                  Log In
                </Button>
              </Link>
              <Link to="/signup" className="hidden sm:inline-block">
                <Button variant="primary" size="sm" className="bg-[#1C1917] hover:bg-stone-800 dark:bg-[#F4F4F5] dark:hover:bg-stone-200 text-[#FBF9F4] dark:text-[#18181B]">
                  Sign Up
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

CitizenHeader.displayName = 'CitizenHeader';
