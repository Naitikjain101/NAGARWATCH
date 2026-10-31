import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Compass, PlusCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8 font-sans antialiased text-[#1C1917] dark:text-[#F4F4F5]">
      <div className="max-w-md w-full text-center space-y-6 bg-[#FBF9F4] dark:bg-[#222226] border border-[#E5E0D4] dark:border-[#333338] p-8 sm:p-10 rounded-sm shadow-xs">
        {/* Status Chip */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xs bg-[#D9381E]/10 dark:bg-[#F05030]/20 border border-[#D9381E]/20 dark:border-[#F05030]/30 text-[#D9381E] dark:text-[#F05030] text-xs font-mono font-bold uppercase tracking-wider">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Error 404 • Resource Missing</span>
        </div>

        {/* Large 404 Masthead */}
        <div className="space-y-2">
          <h1 className="text-6xl sm:text-7xl font-mono font-bold tracking-tight text-[#1C1917] dark:text-[#F4F4F5] leading-none">
            404
          </h1>
          <h2 className="text-xl sm:text-2xl font-mono font-bold text-[#1C1917] dark:text-[#F4F4F5]">
            Sector Not Found
          </h2>
          <p className="text-xs sm:text-sm text-[#78716C] dark:text-[#A1A1AA] leading-relaxed max-w-sm mx-auto">
            The civic intelligence route or dispatch view you requested does not exist or has been relocated.
          </p>
        </div>

        {/* Action Controls */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/" className="w-full sm:w-auto">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Home className="w-4 h-4" />}
              className="w-full sm:w-auto bg-[#D9381E] hover:bg-[#B82810] dark:bg-[#F05030] dark:hover:bg-[#D9381E] text-white"
            >
              Return Home
            </Button>
          </Link>
          <Link to="/explore" className="w-full sm:w-auto">
            <Button
              variant="outline"
              size="md"
              leftIcon={<Compass className="w-4 h-4" />}
              className="w-full sm:w-auto border-[#E5E0D4] dark:border-[#333338] text-[#1C1917] dark:text-[#F4F4F5] hover:bg-[#EFECE4] dark:hover:bg-[#2B2B30]"
            >
              Explore Map
            </Button>
          </Link>
        </div>

        {/* Breadcrumb Assistance */}
        <div className="pt-4 border-t border-[#E5E0D4] dark:border-[#333338] flex items-center justify-center gap-4 text-xs font-mono text-[#78716C] dark:text-[#A1A1AA]">
          <Link to="/report" className="hover:text-[#D9381E] dark:hover:text-[#F05030] flex items-center gap-1 transition-colors">
            <PlusCircle className="w-3.5 h-3.5" />
            <span>File an Incident</span>
          </Link>
          <span>•</span>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="hover:text-[#1C1917] dark:hover:text-[#F4F4F5] flex items-center gap-1 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    </div>
  );
}

