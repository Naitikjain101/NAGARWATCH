import React, { useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { MapPin, Navigation, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { LocationData, isValidCoordinates } from '../lib/locationUtils';

// Restrained signal vermilion pin icon for Warm Paper theme
const pinIcon = new L.DivIcon({
  className: 'nagarwatch-pin',
  html: `<div style="background-color: #D9381E; width: 22px; height: 22px; border-radius: 50%; border: 2.5px solid #FBF9F4; box-shadow: 0 2px 8px rgba(28,25,23,0.35); display: flex; align-items: center; justify-content: center;"><div style="background-color: #FBF9F4; width: 6px; height: 6px; border-radius: 50%;"></div></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

interface LocationPickerProps {
  location: LocationData | null;
  onChange: (loc: LocationData | null) => void;
  hasExif: boolean;
}

// Inner helper component to handle map clicks
function MapClickHandler({ onSelect }: { onSelect: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function LocationPicker({ location, onChange, hasExif }: LocationPickerProps) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);

  // Default initial map center (Jaipur Metro or location if selected)
  const defaultCenter: [number, number] = location
    ? [location.lat, location.lon]
    : [26.8634, 75.8145];

  const handleBrowserGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser. Please pin location on map.');
      setShowMap(true);
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        if (isValidCoordinates(lat, lon)) {
          onChange({ lat, lon, source: 'browser' });
        } else {
          setGpsError('Received invalid coordinates from device GPS.');
        }
      },
      (err) => {
        setGpsLoading(false);
        let msg = 'Failed to acquire device location. Please pin manually on map.';
        if (err.code === 1) msg = 'Location access was denied. Please allow GPS or select on map.';
        else if (err.code === 2) msg = 'Location unavailable. Please select on map.';
        else if (err.code === 3) msg = 'Location request timed out. Please try again or select on map.';
        setGpsError(msg);
        setShowMap(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleMapSelect = (lat: number, lon: number) => {
    if (isValidCoordinates(lat, lon)) {
      onChange({ lat, lon, source: 'map' });
    }
  };

  return (
    <div className="space-y-3 font-sans">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-mono uppercase tracking-wider text-[#78716C] font-semibold">
          Incident Location
        </label>
        {location && (
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-xs font-medium inline-flex items-center gap-1 bg-[#F4F1EA] text-[#1C1917] border border-[#E5E0D4]">
            <CheckCircle2 className="w-3 h-3 text-[#D9381E]" />
            {location.source === 'exif' && 'From Photo EXIF'}
            {location.source === 'browser' && 'From Device GPS'}
            {location.source === 'map' && 'Selected on Map'}
          </span>
        )}
      </div>

      {/* Location Status Card */}
      {location ? (
        <div className="bg-[#FBF9F4] border border-[#E5E0D4] rounded-sm p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-[#D9381E]/10 text-[#D9381E] border border-[#D9381E]/20 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#78716C]">
                Coordinates
              </p>
              <p className="text-xs sm:text-sm font-mono font-semibold text-[#1C1917] tracking-tight">
                {location.lat.toFixed(5)}°, {location.lon.toFixed(5)}°
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowMap(!showMap)}
            className="text-xs text-[#D9381E] hover:text-[#B92B15] font-mono font-medium underline underline-offset-2 transition-colors"
          >
            {showMap ? 'Hide Map' : 'Adjust on Map'}
          </button>
        </div>
      ) : (
        <div className="bg-[#FBF9F4] border border-[#E5E0D4] rounded-sm p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-[#D9381E] shrink-0 mt-0.5" />
            <div className="text-xs text-[#57534E]">
              <p className="font-semibold text-[#1C1917] mb-0.5">
                {hasExif ? 'Extracting photo location...' : 'Location required for municipal routing'}
              </p>
              <p className="text-[11px] leading-relaxed">
                Incidents require geographic coordinates to route to the correct municipal ward and prevent duplicates.
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={gpsLoading}
              onClick={handleBrowserGps}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F4F1EA] hover:bg-[#EAE5D9] text-[#1C1917] border border-[#E5E0D4] rounded-sm text-xs font-mono font-medium transition-colors disabled:opacity-50"
            >
              {gpsLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D9381E]" />
              ) : (
                <Navigation className="w-3.5 h-3.5 text-[#D9381E]" />
              )}
              <span>Use Device Location</span>
            </button>
            <button
              type="button"
              onClick={() => setShowMap(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#D9381E] hover:bg-[#B92B15] text-white rounded-sm text-xs font-mono font-medium transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Pin on Map</span>
            </button>
          </div>
        </div>
      )}

      {gpsError && (
        <p className="text-xs text-[#991B1B] font-mono flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {gpsError}
        </p>
      )}

      {/* Interactive Map for manual pin selection / adjustment */}
      {showMap && (
        <div className="border border-[#E5E0D4] rounded-sm overflow-hidden bg-[#FBF9F4]">
          <div className="bg-[#F4F1EA] px-3 py-1.5 text-[11px] font-mono text-[#57534E] flex justify-between items-center border-b border-[#E5E0D4]">
            <span>Click map or drag the pin to set incident location</span>
            <button
              type="button"
              onClick={() => setShowMap(false)}
              className="text-[#1C1917] hover:text-[#D9381E] font-mono font-semibold text-xs"
            >
              Done [✕]
            </button>
          </div>
          <MapContainer
            center={defaultCenter}
            zoom={location ? 15 : 12}
            style={{ height: '240px', width: '100%' }}
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              maxZoom={16}
            />
            <MapClickHandler onSelect={handleMapSelect} />
            {location && (
              <Marker
                position={[location.lat, location.lon]}
                icon={pinIcon}
                draggable={true}
                eventHandlers={{
                  dragend(e) {
                    const marker = e.target;
                    const pos = marker.getLatLng();
                    handleMapSelect(pos.lat, pos.lng);
                  },
                }}
              />
            )}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
