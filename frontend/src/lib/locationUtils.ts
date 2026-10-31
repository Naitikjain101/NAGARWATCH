import EXIF from 'exif-js';

export interface LocationData {
  lat: number;
  lon: number;
  source: 'exif' | 'browser' | 'map';
}

/**
 * Validates coordinate ranges:
 * - Latitude: [-90, 90]
 * - Longitude: [-180, 180]
 */
export function isValidCoordinates(lat: number | string, lon: number | string): boolean {
  if (lat === null || lat === undefined || lon === null || lon === undefined) return false;
  const numLat = typeof lat === 'number' ? lat : Number(lat);
  const numLon = typeof lon === 'number' ? lon : Number(lon);
  if (isNaN(numLat) || isNaN(numLon)) return false;
  return numLat >= -90 && numLat <= 90 && numLon >= -180 && numLon <= 180;
}

/**
 * Converts DMS (Degrees, Minutes, Seconds) format to Decimal Degrees.
 */
function convertDMSToDD(dms: [number, number, number] | number[], ref: string): number {
  const degrees = Number(dms[0]) || 0;
  const minutes = Number(dms[1]) || 0;
  const seconds = Number(dms[2]) || 0;
  let dd = degrees + minutes / 60 + seconds / 3600;
  if (ref === 'S' || ref === 'W') {
    dd = -dd;
  }
  return dd;
}

/**
 * Extracts GPS coordinates from an image file using EXIF metadata.
 * Returns null if the image has no EXIF GPS data or if parsing fails.
 */
export function extractGpsFromExif(file: File): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    try {
      EXIF.getData(file as any, function (this: any) {
        try {
          const latData = EXIF.getTag(this, 'GPSLatitude');
          const latRef = EXIF.getTag(this, 'GPSLatitudeRef');
          const lonData = EXIF.getTag(this, 'GPSLongitude');
          const lonRef = EXIF.getTag(this, 'GPSLongitudeRef');

          if (latData && latRef && lonData && lonRef) {
            const lat = convertDMSToDD(latData, latRef);
            const lon = convertDMSToDD(lonData, lonRef);
            if (isValidCoordinates(lat, lon)) {
              return resolve({ lat, lon });
            }
          }
          resolve(null);
        } catch {
          resolve(null);
        }
      });
    } catch {
      resolve(null);
    }
  });
}

