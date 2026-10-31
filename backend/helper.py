import psycopg2
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
from dotenv import load_dotenv
import os

# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------
load_dotenv()
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

# ---------------------------------------------------------
# HELPER 1: CONNECT TO DATABASE
# ---------------------------------------------------------
def get_db_connection():
    conn = psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        port=DB_PORT
    )
    return conn

# ---------------------------------------------------------
# HELPER 2: EXTRACT GPS FROM IMAGE (Forensic Logic)
# ---------------------------------------------------------
def get_decimal_from_dms(dms, ref):
    degrees = dms[0]
    minutes = dms[1]
    seconds = dms[2]
    decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)
    if ref in ['S', 'W']:
        decimal = -decimal
    return decimal

def extract_gps(image_path):
    try:
        image = Image.open(image_path)
        exif_data = image._getexif()
        
        if not exif_data:
            return None # Reject: No Metadata

        gps_info = {}
        for tag, value in exif_data.items():
            tag_name = TAGS.get(tag, tag)
            if tag_name == "GPSInfo":
                for t, v in value.items():
                    sub_tag = GPSTAGS.get(t, t)
                    gps_info[sub_tag] = v
        
        # Convert to Decimal Lat/Lon
        if 'GPSLatitude' in gps_info and 'GPSLongitude' in gps_info:
            lat = get_decimal_from_dms(gps_info['GPSLatitude'], gps_info['GPSLatitudeRef'])
            lon = get_decimal_from_dms(gps_info['GPSLongitude'], gps_info['GPSLongitudeRef'])
            return lat, lon
        return None 

    except Exception as e:
        print(f"Forensic Error: {e}")
        return None

# ---------------------------------------------------------
# HELPER3: COMPRESS IMAGE
# ---------------------------------------------------------
def compress_image(image_path, quality=80):
    """
    Reads an image from disk, compresses it, and overwrites 
    the original file.
    """
    try:
        # Get the original file size for comparison
        original_size = os.path.getsize(image_path)
        
        img = Image.open(image_path)
        
        # Convert transparent images to RGB (JPEG requirement)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        
        # Determine format based on file extension
        # If normalizing everything to JPEG is desired, set format='JPEG' below.
        filename = os.path.basename(image_path)
        _, ext = os.path.splitext(filename)
        
        # PIL format names are uppercase (e.g., 'JPEG', 'PNG')
        img_format = ext.strip('.').upper()
        if img_format == 'JPG': img_format = 'JPEG'
        
        # --- KEY COMPRESSION STEP ---
        # Save back to the same path with reduced quality
        img.save(image_path, format=img_format, quality=quality, optimize=True)
        
        # Verify compression was successful
        new_size = os.path.getsize(image_path)
        
        # Print compression statistics to console
        reduction = original_size - new_size
        print(f"Compression Complete: Original: {original_size} bytes, Compressed: {new_size} bytes. Reduced by {reduction} bytes ({reduction/original_size*100:.2f}%)")

        return True
    
    except Exception as e:
        print(f"Compression Error: {e}")
        # Log error but return False so the app can continue if required
        return False
