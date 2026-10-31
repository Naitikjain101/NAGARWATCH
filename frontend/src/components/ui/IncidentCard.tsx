import React from 'react';
import { MapPin, ThumbsUp, AlertCircle, Clock, Calendar, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { StatusBadge } from './StatusBadge';
import { SeverityIndicator } from './SeverityIndicator';

export interface IncidentCardData {
  id: string;
  category: string;
  description: string;
  status: string;
  severity?: string;
  image_url?: string;
  primary_image_url?: string;
  ward_name?: string;
  ward_id?: number;
  latitude?: number;
  longitude?: number;
  created_at?: string;
  confirmations_count?: number;
  upvotes?: number;
  disputes_count?: number;
}

export interface IncidentCardProps {
  incident: IncidentCardData;
  onClick?: (incident: IncidentCardData) => void;
  theme?: 'light' | 'dark';
  compact?: boolean;
  className?: string;
}

export const IncidentCard: React.FC<IncidentCardProps> = ({
  incident,
  onClick,
  theme = 'light',
  compact = false,
  className,
}) => {
  const isDark = theme === 'dark';
  const imgUrl = incident.primary_image_url || incident.image_url;
  const confirmations = incident.confirmations_count ?? incident.upvotes ?? 0;
  const disputes = incident.disputes_count ?? 0;

  const formattedDate = incident.created_at
    ? new Date(incident.created_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <article
      onClick={() => onClick && onClick(incident)}
      className={cn(
        'group rounded-lg border overflow-hidden transition-all duration-150 font-sans',
        onClick && 'cursor-pointer active:scale-[0.99]',
        isDark
          ? 'bg-[#141F33] border-[#293750] text-[#F3F6FC] hover:border-[#3E5275] hover:bg-[#18263E]'
          : 'bg-white border-[#E3E7EE] text-[#172033] hover:border-[#CBD5E1] hover:shadow-sm',
        className
      )}
    >
      <div className={cn('flex flex-col', !compact && 'sm:flex-row')}>
        {/* Photo preview / Category badge header */}
        {imgUrl ? (
          <div
            className={cn(
              'relative shrink-0 overflow-hidden bg-slate-100',
              compact ? 'h-36 w-full' : 'h-40 sm:h-auto sm:w-48 w-full'
            )}
          >
            <img
              src={imgUrl}
              alt={incident.category}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            <div className="absolute top-2 left-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-xs text-white px-2 py-0.5 rounded">
                {incident.category}
              </span>
            </div>
          </div>
        ) : null}

        {/* Content Body */}
        <div className="p-4 flex-1 flex flex-col justify-between space-y-2.5">
          <div className="space-y-2">
            {/* Metadata Badges */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <StatusBadge status={incident.status} size="sm" />
                {incident.severity && (
                  <SeverityIndicator severity={incident.severity} size="sm" />
                )}
                {!imgUrl && (
                  <span
                    className={cn(
                      'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border',
                      isDark
                        ? 'bg-[#1B2940] text-[#A5B1C4] border-[#293750]'
                        : 'bg-[#F0F3F8] text-[#687386] border-[#E3E7EE]'
                    )}
                  >
                    {incident.category}
                  </span>
                )}
              </div>

              {formattedDate && (
                <div
                  className={cn(
                    'flex items-center gap-1 text-[11px]',
                    isDark ? 'text-[#A5B1C4]' : 'text-[#687386]'
                  )}
                >
                  <Calendar className="w-3 h-3" />
                  <span>{formattedDate}</span>
                </div>
              )}
            </div>

            {/* Description */}
            <p
              className={cn(
                'text-xs sm:text-sm line-clamp-2 leading-relaxed',
                isDark ? 'text-[#F3F6FC]' : 'text-[#172033]'
              )}
            >
              {incident.description || 'No description provided.'}
            </p>
          </div>

          {/* Card Footer: Location & Social Validation */}
          <div
            className={cn(
              'pt-2 flex items-center justify-between text-xs border-t',
              isDark ? 'border-[#293750] text-[#A5B1C4]' : 'border-[#E3E7EE] text-[#687386]'
            )}
          >
            <div className="flex items-center gap-1.5 truncate max-w-[200px]">
              <MapPin className="w-3.5 h-3.5 text-[#356AE6] shrink-0" />
              <span className="truncate font-medium">
                {incident.ward_name || `Ward ${incident.ward_id || 1}`}
              </span>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="flex items-center gap-1 font-mono-id" title="Community Confirmations">
                <ThumbsUp className="w-3 h-3 text-emerald-600" />
                <span>{confirmations}</span>
              </span>

              {disputes > 0 && (
                <span className="flex items-center gap-1 text-red-600 font-mono-id" title="Community Disputes">
                  <AlertCircle className="w-3 h-3" />
                  <span>{disputes}</span>
                </span>
              )}

              {onClick && (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

IncidentCard.displayName = 'IncidentCard';

