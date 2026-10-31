import os
import io
import uuid
import logging
from typing import Optional, Tuple
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
from app.core.config import config

logger = logging.getLogger(__name__)

def get_decimal_from_dms(dms, ref) -> float:
    """Converts degrees, minutes, seconds tuple to decimal coordinates."""
    degrees = float(dms[0])
    minutes = float(dms[1])
    seconds = float(dms[2])
    decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)
    if ref in ['S', 'W']:
        decimal = -decimal
    return decimal


def extract_gps_from_image(image_bytes: bytes) -> Optional[Tuple[float, float]]:
    """
    Extracts latitude and longitude from raw image bytes.
    Returns (latitude, longitude) as floats, or None if metadata is missing.
    """
    try:
        image = Image.open(io.BytesIO(image_bytes))
        exif_data = image._getexif()
        if not exif_data:
            return None

        gps_info = {}
        for tag, value in exif_data.items():
            tag_name = TAGS.get(tag, tag)
            if tag_name == "GPSInfo":
                for t, v in value.items():
                    sub_tag = GPSTAGS.get(t, t)
                    gps_info[sub_tag] = v

        if 'GPSLatitude' in gps_info and 'GPSLongitude' in gps_info:
            lat = get_decimal_from_dms(gps_info['GPSLatitude'], gps_info['GPSLatitudeRef'])
            lon = get_decimal_from_dms(gps_info['GPSLongitude'], gps_info['GPSLongitudeRef'])
            return float(lat), float(lon)
        return None
    except Exception as e:
        logger.warning(f"EXIF GPS extraction failed: {e}")
        return None


def compress_image_bytes(image_bytes: bytes, quality: int = 80) -> Tuple[bytes, str]:
    """
    Compresses image bytes in memory without touching disk.
    Converts RGBA/P to RGB and normalizes format to JPEG.
    Returns (compressed_bytes, mimetype).
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
            
        output_buffer = io.BytesIO()
        img.save(output_buffer, format='JPEG', quality=quality, optimize=True)
        return output_buffer.getvalue(), 'image/jpeg'
    except Exception as e:
        logger.warning(f"In-memory image compression failed, using original bytes: {e}")
        return image_bytes, 'image/jpeg'


def upload_image_to_supabase(image_bytes: bytes, filename: str, content_type: str = 'image/jpeg') -> str:
    """
    Uploads compressed image bytes directly to Supabase Storage bucket.
    Generates a secure UUID-prefixed path to prevent collisions.
    Returns public URL.
    """
    ext = os.path.splitext(filename)[1] or ".jpg"
    unique_filename = f"{uuid.uuid4()}{ext}"
    
    if config.SUPABASE_URL and config.SUPABASE_KEY:
        try:
            from supabase import create_client
            client = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)
            client.storage.from_(config.SUPABASE_BUCKET).upload(
                path=unique_filename,
                file=image_bytes,
                file_options={"content-type": content_type}
            )
            return client.storage.from_(config.SUPABASE_BUCKET).get_public_url(unique_filename)
        except Exception as e:
            logger.error(f"Failed to upload to Supabase Storage: {e}")
            
    # Fallback storage for local/offline testing
    os.makedirs(config.UPLOAD_FOLDER, exist_ok=True)
    local_path = os.path.join(config.UPLOAD_FOLDER, unique_filename)
    with open(local_path, "wb") as f:
        f.write(image_bytes)
    return f"/uploads/{unique_filename}"

