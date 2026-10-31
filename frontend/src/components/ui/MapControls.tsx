import React from 'react';
import { Plus, Minus, Crosshair, Layers, MapPin } from 'lucide-react';
import { cn } from '../../lib/utils';
import { IconButton } from './IconButton';

export interface MapControlsProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onLocateMe?: () => void;
  onToggleLayer?: () => void;
  incidentCount?: number;
  isLocating?: boolean;
  className?: string;
}

export const MapControls: React.FC<MapControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onLocateMe,
  onToggleLayer,
  incidentCount,
  isLocating = false,
  className,
}) => {
  return (
    <div className={cn('flex flex-col gap-2 font-sans pointer-events-auto', className)}>
      {/* Incident Counter Pill */}
      {typeof incidentCount === 'number' && (
        <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#E3E7EE] shadow-sm flex items-center gap-2 text-xs font-medium text-[#172033]">
          <MapPin className="w-3.5 h-3.5 text-[#356AE6] shrink-0" />
          <span>
            <strong className="font-mono-id">{incidentCount}</strong> incidents mapped
          </span>
        </div>
      )}

      {/* Floating Action Controls */}
      <div className="bg-white rounded-lg border border-[#E3E7EE] shadow-md p-1 flex flex-col gap-1 w-fit">
        {onLocateMe && (
          <IconButton
            variant="ghost"
            size="sm"
            shape="square"
            aria-label="Find my location"
            isLoading={isLocating}
            onClick={onLocateMe}
            title="Locate my position"
          >
            <Crosshair className="w-4 h-4 text-[#356AE6]" />
          </IconButton>
        )}

        {onToggleLayer && (
          <IconButton
            variant="ghost"
            size="sm"
            shape="square"
            aria-label="Toggle map view mode"
            onClick={onToggleLayer}
            title="Toggle layers"
          >
            <Layers className="w-4 h-4 text-slate-600" />
          </IconButton>
        )}

        {(onZoomIn || onZoomOut) && (
          <div className="border-t border-[#E3E7EE] pt-1 flex flex-col gap-1">
            {onZoomIn && (
              <IconButton
                variant="ghost"
                size="sm"
                shape="square"
                aria-label="Zoom in"
                onClick={onZoomIn}
                title="Zoom in"
              >
                <Plus className="w-4 h-4 text-slate-700" />
              </IconButton>
            )}

            {onZoomOut && (
              <IconButton
                variant="ghost"
                size="sm"
                shape="square"
                aria-label="Zoom out"
                onClick={onZoomOut}
                title="Zoom out"
              >
                <Minus className="w-4 h-4 text-slate-700" />
              </IconButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

MapControls.displayName = 'MapControls';

