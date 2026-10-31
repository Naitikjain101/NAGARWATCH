import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet';
import { isValidCoordinates } from '../../lib/locationUtils';
import { DESIGN_TOKENS, normalizeStatus } from '../../lib/designSystem';
import { useTheme } from '../../context/ThemeContext';

export interface SharedMapIncident {
  id: string;
  category: string;
  description: string;
  status: string;
  image_url?: string;
  created_at: string;
  latitude?: number;
  longitude?: number;
  upvotes?: number;
  confirmations_count?: number;
  disputes_count?: number;
  severity?: string;
  ward_id?: string | number;
  ward_name?: string;
  distance_meters?: number;
}

export interface SharedMapWard {
  id: number;
  name: string;
  code?: string;
  geom?: any;
  active_incidents?: number;
  total_incidents?: number;
}

export interface SharedIncidentMapProps {
  incidents?: SharedMapIncident[];
  wards?: SharedMapWard[];
  selectedIncident?: SharedMapIncident | null;
  onSelectIncident?: (incident: SharedMapIncident) => void;
  userLocation?: { lat: number; lon: number } | null;
  center?: [number, number];
  zoom?: number;
  theme?: 'paper' | 'graphite';
  interactive?: boolean;
  clusterRadiusPixels?: number;
  showWardBoundaries?: boolean;
  className?: string;
}

// ─── Status Marker Icon Generator ─────────────────────────────────────────────
function getCategorySymbol(category?: string): string {
  if (!category) return '•';
  const c = category.toLowerCase();
  if (c.includes('pothole') || c.includes('road')) return 'P';
  if (c.includes('street') || c.includes('light')) return 'L';
  if (c.includes('garbage') || c.includes('sanitation')) return 'G';
  if (c.includes('water') || c.includes('drain')) return 'W';
  if (c.includes('graffiti')) return 'V';
  if (c.includes('sign')) return 'S';
  if (c.includes('hazard') || c.includes('safety')) return '!';
  if (c.includes('encroach')) return 'E';
  return '•';
}

function createStatusPin(
  status: string,
  category: string,
  isSelected: boolean,
  theme: 'paper' | 'graphite'
): L.DivIcon {
  const normKey = normalizeStatus(status);
  const statusConfig = DESIGN_TOKENS.colors.status[normKey] || DESIGN_TOKENS.colors.status.reported;
  const letter = getCategorySymbol(category);

  const bgColor = theme === 'graphite' ? statusConfig.darkText : statusConfig.text;
  const textColor = '#FFFFFF';
  const borderColor = isSelected
    ? theme === 'graphite' ? '#F4F4F5' : '#1C1917'
    : '#FFFFFF';
  const size = isSelected ? 34 : 26;
  const borderWidth = isSelected ? 3 : 2;

  return new L.DivIcon({
    className: 'nagarwatch-status-pin',
    html: `
      <div style="
        background-color: ${bgColor};
        width: ${size}px;
        height: ${size}px;
        border-radius: ${normKey === 'verified' ? '4px' : '50%'};
        border: ${borderWidth}px solid ${borderColor};
        box-shadow: 0 ${isSelected ? '6px 14px rgba(0,0,0,0.45)' : '2px 6px rgba(0,0,0,0.25)'};
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: ${textColor};
        font-family: var(--font-primary), monospace;
        font-size: ${isSelected ? '12px' : '10px'};
        font-weight: 700;
        line-height: 1;
        transition: transform 140ms ease, box-shadow 140ms ease;
      ">
        ${letter}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function createClusterPin(count: number, theme: 'paper' | 'graphite'): L.DivIcon {
  const isLarge = count >= 20;
  const size = isLarge ? 38 : 30;
  const bgColor = theme === 'graphite' ? '#222226' : '#FBF9F4';
  const textColor = theme === 'graphite' ? '#F4F4F5' : '#1C1917';
  const borderColor = '#D9381E'; // Signal vermilion accent ring

  return new L.DivIcon({
    className: 'nagarwatch-cluster-pin',
    html: `
      <div style="
        background-color: ${bgColor};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: 2px solid ${borderColor};
        box-shadow: 0 3px 10px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: ${textColor};
        font-family: var(--font-primary), monospace;
        font-size: ${isLarge ? '12px' : '11px'};
        font-weight: 700;
        letter-spacing: -0.02em;
      ">
        ${count}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

const userLocationPin = new L.DivIcon({
  className: 'nagarwatch-user-pin',
  html: `
    <div style="position: relative; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;">
      <div style="
        position: absolute; width: 14px; height: 14px; border-radius: 50%;
        background-color: #D9381E; border: 2.5px solid white;
        box-shadow: 0 0 10px rgba(217, 56, 30, 0.8);
        z-index: 2;
      "></div>
      <div style="
        position: absolute; width: 30px; height: 30px;
        border-radius: 50%; background-color: rgba(217, 56, 30, 0.25);
        border: 1px solid rgba(217, 56, 30, 0.5);
        z-index: 1;
      "></div>
    </div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

// ─── Map Controller (FlyTo / FitBounds) ────────────────────────────────────────
function MapController({
  validCoords,
  selectedCoord,
  userLocation,
}: {
  validCoords: [number, number][];
  selectedCoord: [number, number] | null;
  userLocation?: { lat: number; lon: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    if (selectedCoord) {
      map.flyTo(selectedCoord, Math.max(map.getZoom(), 15), { duration: 0.8 });
      return;
    }

    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords.map(([lat, lon]) => L.latLng(lat, lon)));
      if (userLocation) {
        bounds.extend(L.latLng(userLocation.lat, userLocation.lon));
      }
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [map, selectedCoord, validCoords.length]);

  return null;
}

// ─── Clustering Logic (Lightweight Grid Clustering) ───────────────────────────
interface ClusterGroup {
  id: string;
  lat: number;
  lon: number;
  incidents: SharedMapIncident[];
}

export function SharedIncidentMap({
  incidents = [],
  wards = [],
  selectedIncident = null,
  onSelectIncident,
  userLocation = null,
  center = [26.8634, 75.8145], // Default Jaipur Metro coords
  zoom = 13,
  theme: explicitTheme,
  interactive = true,
  clusterRadiusPixels = 40,
  showWardBoundaries = true,
  className = 'w-full h-full min-h-[300px]',
}: SharedIncidentMapProps) {
  const { resolvedTheme } = useTheme();
  const theme = explicitTheme || (resolvedTheme === 'dark' ? 'graphite' : 'paper');
  const [currentZoom, setCurrentZoom] = useState(zoom);

  // Filter valid incidents with real coordinates
  const validIncidents = useMemo(() => {
    return incidents
      .map((inc) => ({
        ...inc,
        latitude: inc.latitude !== undefined && inc.latitude !== null ? Number(inc.latitude) : undefined,
        longitude: inc.longitude !== undefined && inc.longitude !== null ? Number(inc.longitude) : undefined,
      }))
      .filter(
        (inc) =>
          inc.latitude !== undefined &&
          inc.longitude !== undefined &&
          isValidCoordinates(inc.latitude, inc.longitude)
      );
  }, [incidents]);

  const validCoords = useMemo<[number, number][]>(() => {
    return validIncidents.map((i) => [i.latitude!, i.longitude!] as [number, number]);
  }, [validIncidents]);

  const selectedCoord = useMemo<[number, number] | null>(() => {
    if (
      selectedIncident &&
      selectedIncident.latitude !== undefined &&
      selectedIncident.longitude !== undefined &&
      isValidCoordinates(selectedIncident.latitude, selectedIncident.longitude)
    ) {
      return [selectedIncident.latitude, selectedIncident.longitude];
    }
    return null;
  }, [selectedIncident]);

  // Lightweight grid clustering
  const clustersAndSingles = useMemo(() => {
    // If zoomed in close (>= 15), don't cluster so individual markers can be targeted
    if (currentZoom >= 15 || validIncidents.length <= 1) {
      return { clusters: [] as ClusterGroup[], singles: validIncidents };
    }

    // Grid size based on zoom level
    const gridSize = 360 / Math.pow(2, currentZoom) * (clusterRadiusPixels / 256);
    const gridMap = new Map<string, SharedMapIncident[]>();

    validIncidents.forEach((inc) => {
      const gx = Math.floor(inc.longitude! / gridSize);
      const gy = Math.floor(inc.latitude! / gridSize);
      const key = `${gx}:${gy}`;
      const existing = gridMap.get(key) || [];
      existing.push(inc);
      gridMap.set(key, existing);
    });

    const clusters: ClusterGroup[] = [];
    const singles: SharedMapIncident[] = [];

    gridMap.forEach((group, key) => {
      if (group.length === 1) {
        singles.push(group[0]);
      } else {
        // Compute centroid
        const avgLat = group.reduce((sum, g) => sum + g.latitude!, 0) / group.length;
        const avgLon = group.reduce((sum, g) => sum + g.longitude!, 0) / group.length;
        clusters.push({
          id: `cluster-${key}`,
          lat: avgLat,
          lon: avgLon,
          incidents: group,
        });
      }
    });

    return { clusters, singles };
  }, [validIncidents, currentZoom, clusterRadiusPixels]);

  // Basemap tile layer URL (ESRI Canvas tiles - clean cartography with zero watermarks)
  const tileUrl =
    theme === 'graphite'
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive}
        attributionControl={false}
        className="w-full h-full z-0"
      >
        <TileLayer url={tileUrl} maxZoom={16} />

        <MapController
          validCoords={validCoords}
          selectedCoord={selectedCoord}
          userLocation={userLocation}
        />

        {/* Ward Polygons Overlay */}
        {showWardBoundaries &&
          wards.map((ward) => {
            if (!ward.geom) return null;
            return (
              <GeoJSON
                key={`ward-geom-${ward.id}`}
                data={ward.geom}
                style={{
                  color: theme === 'graphite' ? '#F05030' : '#D9381E',
                  weight: 1.5,
                  dashArray: '4, 4',
                  fillColor: theme === 'graphite' ? '#F05030' : '#D9381E',
                  fillOpacity: ward.active_incidents ? Math.min(0.2, ward.active_incidents * 0.03) : 0.05,
                }}
              />
            );
          })}

        {/* User Geolocation Target Pin */}
        {userLocation && isValidCoordinates(userLocation.lat, userLocation.lon) && (
          <Marker position={[userLocation.lat, userLocation.lon]} icon={userLocationPin}>
            <Popup>
              <div className="text-xs font-sans font-medium text-stone-900">
                Current Location
              </div>
            </Popup>
          </Marker>
        )}

        {/* Clustered Marker Count Pills */}
        {clustersAndSingles.clusters.map((cluster) => (
          <Marker
            key={cluster.id}
            position={[cluster.lat, cluster.lon]}
            icon={createClusterPin(cluster.incidents.length, theme)}
            eventHandlers={{
              click: () => {
                if (onSelectIncident) {
                  onSelectIncident(cluster.incidents[0]);
                }
              },
            }}
          />
        ))}

        {/* Individual Status-Aware Markers */}
        {clustersAndSingles.singles.map((inc) => {
          const isSelected = selectedIncident?.id === inc.id;
          return (
            <Marker
              key={inc.id}
              position={[inc.latitude!, inc.longitude!]}
              icon={createStatusPin(inc.status, inc.category, isSelected, theme)}
              eventHandlers={{
                click: () => {
                  if (onSelectIncident) {
                    onSelectIncident(inc);
                  }
                },
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}

export default SharedIncidentMap;

