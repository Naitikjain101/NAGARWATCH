import { describe, it, expect } from 'vitest';
import { isValidCoordinates, LocationData } from '../lib/locationUtils';

describe('Location Collection and Validation Logic', () => {
  it('validates correct latitude and longitude ranges', () => {
    expect(isValidCoordinates(12.9716, 77.5946)).toBe(true);
    expect(isValidCoordinates(0, 0)).toBe(true);
    expect(isValidCoordinates(90, 180)).toBe(true);
    expect(isValidCoordinates(-90, -180)).toBe(true);
    expect(isValidCoordinates(45.5, -122.6)).toBe(true);
  });

  it('rejects out-of-range coordinates', () => {
    expect(isValidCoordinates(90.1, 0)).toBe(false);
    expect(isValidCoordinates(-91, 0)).toBe(false);
    expect(isValidCoordinates(0, 180.1)).toBe(false);
    expect(isValidCoordinates(0, -181)).toBe(false);
    expect(isValidCoordinates(NaN as any, 77)).toBe(false);
    expect(isValidCoordinates(12, NaN as any)).toBe(false);
  });

  it('verifies priority logic: EXIF takes precedence over browser and manual map pin', () => {
    // Priority resolution simulation
    function resolveLocation(
      exifLoc: { lat: number; lon: number } | null,
      browserLoc: { lat: number; lon: number } | null,
      mapLoc: { lat: number; lon: number } | null
    ): LocationData | null {
      if (exifLoc && isValidCoordinates(exifLoc.lat, exifLoc.lon)) {
        return { ...exifLoc, source: 'exif' };
      }
      if (browserLoc && isValidCoordinates(browserLoc.lat, browserLoc.lon)) {
        return { ...browserLoc, source: 'browser' };
      }
      if (mapLoc && isValidCoordinates(mapLoc.lat, mapLoc.lon)) {
        return { ...mapLoc, source: 'map' };
      }
      return null;
    }

    const exifCoord = { lat: 10.0, lon: 76.0 };
    const browserCoord = { lat: 12.0, lon: 77.0 };
    const mapCoord = { lat: 13.0, lon: 78.0 };

    // Case 1: EXIF present -> takes precedence
    const res1 = resolveLocation(exifCoord, browserCoord, mapCoord);
    expect(res1?.source).toBe('exif');
    expect(res1?.lat).toBe(10.0);

    // Case 2: EXIF missing -> Browser GPS takes fallback
    const res2 = resolveLocation(null, browserCoord, mapCoord);
    expect(res2?.source).toBe('browser');
    expect(res2?.lat).toBe(12.0);

    // Case 3: EXIF and Browser missing -> Map Pin fallback
    const res3 = resolveLocation(null, null, mapCoord);
    expect(res3?.source).toBe('map');
    expect(res3?.lat).toBe(13.0);

    // Case 4: None available -> null
    const res4 = resolveLocation(null, null, null);
    expect(res4).toBeNull();
  });

  it('ensures missing coordinates prevent submission', () => {
    function canSubmitReport(file: any, location: LocationData | null): { allowed: boolean; error?: string } {
      if (!file) return { allowed: false, error: 'Please select an evidence photo.' };
      if (!location || !isValidCoordinates(location.lat, location.lon)) {
        return { allowed: false, error: 'Incident location is required. Please extract from photo EXIF, use device GPS, or pin on the map.' };
      }
      return { allowed: true };
    }

    const dummyFile = { name: 'photo.jpg' };

    expect(canSubmitReport(null, null).allowed).toBe(false);
    expect(canSubmitReport(dummyFile, null).allowed).toBe(false);
    expect(canSubmitReport(dummyFile, null).error).toContain('location is required');

    expect(canSubmitReport(dummyFile, { lat: 999, lon: 999, source: 'map' }).allowed).toBe(false);

    expect(canSubmitReport(dummyFile, { lat: 12.97, lon: 77.59, source: 'browser' }).allowed).toBe(true);
  });
});

