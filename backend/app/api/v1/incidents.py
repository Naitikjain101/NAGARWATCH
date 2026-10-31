from flask import Blueprint, request, jsonify, g
from werkzeug.utils import secure_filename
from app.core.config import config
from app.core.security import extract_bearer_token, verify_jwt_token
from app.middleware.auth import require_auth
from app.services.storage_service import (
    extract_gps_from_image,
    compress_image_bytes,
    upload_image_to_supabase
)
from app.repositories.incident_repo import IncidentRepository
import logging
import os
import io
from PIL import Image

logger = logging.getLogger(__name__)

incidents_bp = Blueprint("incidents", __name__)

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic"}

VALID_DB_CATEGORIES = {
    'Pothole', 'Streetlight', 'Garbage', 'Graffiti', 
    'Water Leak', 'Signage', 'Safety Hazard', 'Encroachment', 'Other'
}

CATEGORY_SYNONYMS = {
    "road damage": "Pothole",
    "potholes": "Pothole",
    "pothole": "Pothole",
    "garbage": "Garbage",
    "garbage and sanitation": "Garbage",
    "sanitation": "Garbage",
    "water supply": "Water Leak",
    "water supply & drainage": "Water Leak",
    "water leak": "Water Leak",
    "drainage": "Water Leak",
    "electricity": "Streetlight",
    "street lighting": "Streetlight",
    "streetlight": "Streetlight",
    "public safety": "Safety Hazard",
    "public safety & hazards": "Safety Hazard",
    "safety hazard": "Safety Hazard",
    "stray animals": "Safety Hazard",
    "signage": "Signage",
    "traffic signs": "Signage",
    "traffic & direction signs": "Signage",
    "graffiti": "Graffiti",
    "graffiti & vandalism": "Graffiti",
    "encroachment": "Encroachment",
    "encroachment & obstructions": "Encroachment",
    "other": "Other",
    "other civic issues": "Other"
}

@incidents_bp.route("/report", methods=["POST"])
def report_issue():
    """
    Submits a new civic incident report.
    - Validates image file format, size, and presence.
    - Extracts GPS metadata (with form fallback for manual/browser coordinates).
    - Validates coordinate bounds.
    - Checks for nearby active duplicates within 20m.
    - Compresses image in-memory and uploads to storage.
    - Associates incident with authenticated citizen if token is present.
    """
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded", "message": "An evidence photograph is required."}), 400

    file = request.files["image"]
    if not file or not file.filename:
        return jsonify({"error": "Empty or missing file", "message": "An evidence photograph is required."}), 400

    filename = secure_filename(file.filename) or "upload.jpg"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return jsonify({
            "error": "Invalid file format",
            "message": "Only JPEG, PNG, WEBP, and HEIC image files are accepted."
        }), 400

    image_bytes = file.read()
    if len(image_bytes) == 0:
        return jsonify({"error": "Uploaded image file is empty", "message": "Uploaded image file is empty."}), 400

    if len(image_bytes) > config.MAX_CONTENT_LENGTH:
        return jsonify({"error": f"File exceeds maximum allowed size of {config.MAX_CONTENT_LENGTH // (1024*1024)}MB"}), 413

    # Resolve reporter identity if token provided
    user_id = None
    token = extract_bearer_token(request.headers.get("Authorization"))
    if token:
        try:
            payload = verify_jwt_token(token)
            user_id = payload.get("sub")
        except Exception:
            pass

    # Category validation and mapping
    raw_category = request.form.get("category")
    if not raw_category or not raw_category.strip():
        return jsonify({"error": "Validation Error", "message": "Incident category is required."}), 400

    cat_key = raw_category.strip().lower()
    category = CATEGORY_SYNONYMS.get(cat_key)
    if not category:
        for valid_c in VALID_DB_CATEGORIES:
            if cat_key == valid_c.lower():
                category = valid_c
                break
    if not category:
        category = "Other"

    # Description validation
    raw_desc = request.form.get("description")
    if not raw_desc or len(raw_desc.strip()) < 3:
        return jsonify({"error": "Validation Error", "message": "Description must be at least 3 characters."}), 400
    desc = raw_desc.strip()

    force_new = request.form.get("force_new", "false").lower() == "true"
    severity_raw = request.form.get("severity", "medium").lower().strip()
    severity = severity_raw if severity_raw in {"low", "medium", "high", "critical"} else "medium"

    # Location Resolution: Extract EXIF GPS, or fallback to client-supplied coordinates
    gps_data = extract_gps_from_image(image_bytes)
    has_exif_gps = False
    
    if gps_data:
        lat, lon = gps_data
        has_exif_gps = True
    else:
        req_lat = request.form.get("latitude")
        req_lon = request.form.get("longitude")
        if req_lat is None or req_lon is None or str(req_lat).strip() == "" or str(req_lon).strip() == "":
            return jsonify({
                "status": "Rejected",
                "error": "Missing location",
                "reason": "Image lacks GPS metadata and no coordinates provided. Please enable location or pin on map."
            }), 400
        try:
            lat, lon = float(req_lat), float(req_lon)
        except (ValueError, TypeError):
            return jsonify({"status": "Rejected", "error": "Invalid GPS coordinates provided", "reason": "Invalid GPS coordinates provided"}), 400

    # Bounds check
    if lat < -90.0 or lat > 90.0 or lon < -180.0 or lon > 180.0:
        return jsonify({
            "status": "Rejected",
            "error": "Invalid coordinates",
            "reason": "Latitude must be between -90 and 90 and longitude between -180 and 180."
        }), 400

    # 1. Duplicate Detection Check (unless overridden via force_new)
    if not force_new:
        duplicate = IncidentRepository.check_duplicate(lon, lat, category, radius_meters=20.0)
        if duplicate:
            return jsonify({
                "status": "Duplicate",
                "duplicate": True,
                "message": "This issue has already been reported nearby.",
                "existing_issue": {
                    "id": str(duplicate.get("id")),
                    "category": duplicate.get("category"),
                    "description": duplicate.get("description"),
                    "status": str(duplicate.get("status", "pending")).lower(),
                    "image_url": duplicate.get("primary_image_url"),
                    "created_at": duplicate.get("created_at").isoformat() + "Z" if hasattr(duplicate.get("created_at"), "isoformat") else None,
                    "latitude": duplicate.get("latitude"),
                    "longitude": duplicate.get("longitude"),
                    "ward_id": duplicate.get("ward_id")
                }
            }), 409

    # 2. Spatial Routing to Ward
    ward_info = IncidentRepository.find_ward_by_coordinates(lon, lat)
    ward_id = ward_info[0] if ward_info else None
    ward_name = ward_info[1] if ward_info else "Unknown Area"

    # 3. Image Compression and Storage Upload
    try:
        compressed_bytes, content_type = compress_image_bytes(image_bytes, quality=80)
        public_url = upload_image_to_supabase(compressed_bytes, filename, content_type)
        if not public_url:
            raise RuntimeError("Empty image URL returned from storage service")
    except Exception as upload_err:
        logger.error(f"Image upload failed during reporting: {upload_err}")
        return jsonify({
            "error": "Upload Error",
            "message": "Failed to upload evidence photograph to storage. Please try again."
        }), 502

    # 4. Save to Database
    phone = request.form.get("phone")
    try:
        new_incident = IncidentRepository.create_incident(
            user_id=user_id,
            ward_id=ward_id,
            category=category,
            description=desc,
            lon=lon,
            lat=lat,
            image_url=public_url,
            severity=severity,
            has_exif_gps=has_exif_gps,
            source="mobile" if has_exif_gps else "web",
            phone=phone
        )
    except Exception as save_err:
        logger.error(f"Failed to record incident in database: {save_err}", exc_info=True)
        return jsonify({
            "error": "Database Error",
            "message": "Failed to record incident report. Please try again."
        }), 500

    return jsonify({
        "status": "Success",
        "complaint_id": new_incident["id"],
        "incident_id": new_incident["id"],
        "routed_to_ward": ward_name,
        "image_url": public_url,
        "category": category,
        "latitude": lat,
        "longitude": lon
    }), 201


@incidents_bp.route("/incidents/me", methods=["GET"])
@require_auth
def get_my_incidents():
    """
    Canonical authenticated endpoint: Retrieves incidents reported by the logged-in citizen.
    Uses verified user identity from JWT token.
    Supports multi-criteria filtering by category, status, keyword search, date, and sorting.
    """
    user_id = g.current_user["id"]
    category = request.args.get("category")
    status = request.args.get("status")
    search = request.args.get("search") or request.args.get("q")
    date_filter = request.args.get("date") or request.args.get("date_filter")
    sort_by = request.args.get("sort", "newest").lower()

    limit = min(int(request.args.get("limit", config.DEFAULT_PAGE_SIZE)), config.MAX_PAGE_SIZE)
    offset = max(int(request.args.get("offset", 0)), 0)

    res = IncidentRepository.get_user_incidents(
        user_id=user_id,
        status=status,
        category=category,
        search=search,
        date_filter=date_filter,
        sort_by=sort_by,
        limit=limit,
        offset=offset
    )

    if isinstance(res, tuple):
        reports, total = res
    else:
        reports = res
        total = len(reports)

    return jsonify({
        "status": "Success",
        "count": len(reports),
        "total": total,
        "limit": limit,
        "offset": offset,
        "data": reports
    }), 200


@incidents_bp.route("/incidents/me/<string:incident_id>", methods=["GET"])
@require_auth
def get_my_incident_detail(incident_id: str):
    """
    Authenticated personal incident detail endpoint.
    Strictly verifies ownership:
    - If user does not own incident -> 403 Forbidden
    - If incident does not exist -> 404 Not Found
    Returns media gallery and verified status audit history.
    """
    user_id = g.current_user["id"]
    incident, err_code = IncidentRepository.get_user_incident_detail(incident_id, user_id)
    if err_code == "FORBIDDEN":
        return jsonify({
            "error": "Forbidden",
            "message": "You are not authorized to view reports submitted by other citizens."
        }), 403
    if not incident or err_code == "NOT_FOUND":
        return jsonify({
            "error": "Not Found",
            "message": "Incident not found in your reports."
        }), 404

    return jsonify({
        "status": "Success",
        "data": incident
    }), 200


@incidents_bp.route("/notifications/me", methods=["GET"])
@require_auth
def get_my_notifications():
    """
    Retrieves authentic in-app notifications for the authenticated citizen.
    Uses real database notification records with strict user isolation.
    """
    user_id = g.current_user["id"]
    limit = min(int(request.args.get("limit", 20)), 100)
    offset = max(int(request.args.get("offset", 0)), 0)

    from app.repositories.notification_repo import NotificationRepository
    notifications, total = NotificationRepository.get_user_notifications(user_id, limit=limit, offset=offset)

    return jsonify({
        "status": "Success",
        "count": len(notifications),
        "total": total,
        "limit": limit,
        "offset": offset,
        "data": notifications
    }), 200


@incidents_bp.route("/notifications/<string:notification_id>/read", methods=["PATCH", "POST"])
@require_auth
def mark_my_notification_read(notification_id: str):
    """
    Marks a citizen notification as read, validating ownership.
    """
    user_id = g.current_user["id"]
    from app.repositories.notification_repo import NotificationRepository
    success = NotificationRepository.mark_notification_as_read(notification_id, user_id)
    if not success:
        return jsonify({"error": "Not Found", "message": "Notification not found or access denied."}), 404

    return jsonify({
        "status": "Success",
        "message": "Notification marked as read."
    }), 200


@incidents_bp.route("/complaints/user/<string:phone_number>", methods=["GET"])
@require_auth
def get_user_complaints_legacy(phone_number: str):
    """
    Legacy compatibility endpoint secured with JWT authentication.
    Prevents unauthorized enumeration of other users' reports.
    """
    current_user = g.current_user
    # Ensure citizen only queries their own verified phone or returns their user reports
    user_phone = current_user.get("phone")
    if user_phone and user_phone.strip("+").replace(" ", "") != phone_number.strip("+").replace(" ", ""):
        # If user is not admin, deny access to other phone numbers
        if current_user.get("role") not in ("admin", "super_admin"):
            return jsonify({
                "error": "Forbidden",
                "message": "You are not authorized to view reports for this phone number."
            }), 403

    limit = min(int(request.args.get("limit", config.DEFAULT_PAGE_SIZE)), config.MAX_PAGE_SIZE)
    offset = max(int(request.args.get("offset", 0)), 0)
    reports = IncidentRepository.get_user_incidents(current_user["id"], limit=limit, offset=offset)
    
    # Return array directly for legacy frontend compatibility
    return jsonify(reports), 200


@incidents_bp.route("/incidents", methods=["GET"])
@incidents_bp.route("/incidents/nearby", methods=["GET"])
def list_public_incidents():
    """
    Retrieves public civic incidents for exploration and live map display.
    Supports filtering by category, status, severity, ward, search keywords,
    and PostGIS spatial nearby radius queries.
    Strictly sanitizes responses to guarantee privacy.
    """
    category = request.args.get("category")
    status = request.args.get("status")
    severity = request.args.get("severity")
    search = request.args.get("search") or request.args.get("q")
    ward_id_param = request.args.get("ward_id")
    lat_param = request.args.get("lat")
    lon_param = request.args.get("lon")
    radius_param = request.args.get("radius")

    limit = min(int(request.args.get("limit", config.DEFAULT_PAGE_SIZE)), config.MAX_PAGE_SIZE)
    offset = max(int(request.args.get("offset", 0)), 0)

    ward_id = None
    if ward_id_param:
        try:
            ward_id = int(ward_id_param)
        except ValueError:
            return jsonify({"error": "Validation Error", "message": "Invalid ward_id parameter"}), 400

    lat = None
    lon = None
    if lat_param and lon_param:
        try:
            lat = float(lat_param)
            lon = float(lon_param)
            if lat < -90.0 or lat > 90.0 or lon < -180.0 or lon > 180.0:
                return jsonify({"error": "Validation Error", "message": "Coordinates out of bounds (-90 to 90, -180 to 180)"}), 400
        except ValueError:
            return jsonify({"error": "Validation Error", "message": "Invalid latitude/longitude numbers"}), 400

    radius_meters = None
    if radius_param:
        try:
            radius_meters = max(float(radius_param), 10.0)
        except ValueError:
            return jsonify({"error": "Validation Error", "message": "Invalid radius number"}), 400
    elif lat is not None and lon is not None:
        radius_meters = 25000.0  # Default 25km radius for nearby search if coordinates passed

    incidents, total = IncidentRepository.get_public_incidents(
        category=category,
        status=status,
        severity=severity,
        ward_id=ward_id,
        search=search,
        lat=lat,
        lon=lon,
        radius_meters=radius_meters,
        limit=limit,
        offset=offset
    )

    return jsonify({
        "status": "Success",
        "count": len(incidents),
        "total": total,
        "limit": limit,
        "offset": offset,
        "data": incidents
    }), 200


@incidents_bp.route("/incidents/<string:incident_id>", methods=["GET"])
def get_public_incident_detail(incident_id: str):
    """
    Retrieves full public incident details including legitimate media gallery
    and verified status audit history.
    """
    incident = IncidentRepository.get_public_incident_detail(incident_id)
    if not incident:
        # Fallback: check get_incident_by_id
        raw_inc = IncidentRepository.get_incident_by_id(incident_id)
        if not raw_inc or str(raw_inc.get("status", "")).lower() == "rejected":
            return jsonify({"error": "Not Found", "message": "Incident not found"}), 404
        # Sanitize sensitive fields
        raw_inc.pop("user_id", None)
        raw_inc.pop("phone_number", None)
        incident = raw_inc

    return jsonify({
        "status": "Success",
        "data": incident
    }), 200


@incidents_bp.route("/complaints/ward", methods=["GET"])
def get_complaints_by_ward():
    """
    Fetches complaints/incidents around a location or by ward ID.
    Gracefully handles coordinates outside registered wards with nearby discovery.
    """
    lat = request.args.get("lat")
    lon = request.args.get("lon")
    ward_id = request.args.get("ward_id")

    limit = min(int(request.args.get("limit", config.DEFAULT_PAGE_SIZE)), config.MAX_PAGE_SIZE)
    offset = max(int(request.args.get("offset", 0)), 0)

    if ward_id:
        try:
            w_id = int(ward_id)
            reports = IncidentRepository.get_incidents_by_ward(w_id, limit=limit, offset=offset)
            return jsonify({
                "status": "Success",
                "ward_id": w_id,
                "count": len(reports),
                "data": reports
            }), 200
        except ValueError:
            return jsonify({"error": "Invalid ward_id provided"}), 400

    if not lat or not lon:
        return jsonify({"error": "Coordinates (lat, lon) or ward_id required"}), 400

    try:
        f_lat = float(lat)
        f_lon = float(lon)
    except ValueError:
        return jsonify({"error": "Invalid coordinate numbers"}), 400

    ward_info = IncidentRepository.find_ward_by_coordinates(f_lon, f_lat)
    target_ward_id = ward_info[0] if ward_info else None
    target_ward_name = ward_info[1] if ward_info else "Nearby Neighbourhood"

    radius_meters = 25000.0
    radius_param = request.args.get("radius")
    if radius_param:
        try:
            radius_meters = max(float(radius_param), 10.0)
        except ValueError:
            pass

    category = request.args.get("category")
    status = request.args.get("status")
    severity = request.args.get("severity")
    search = request.args.get("search") or request.args.get("q")

    # Discover nearby incidents around coordinates across sector
    nearby_incidents, _ = IncidentRepository.get_public_incidents(
        category=category,
        status=status,
        severity=severity,
        search=search,
        lat=f_lat,
        lon=f_lon,
        radius_meters=radius_meters,
        limit=limit,
        offset=offset
    )

    return jsonify({
        "status": "Success",
        "ward_id": target_ward_id,
        "ward_name": target_ward_name,
        "count": len(nearby_incidents),
        "data": nearby_incidents
    }), 200


@incidents_bp.route("/complaints/<string:issue_id>/vote", methods=["POST"])
@incidents_bp.route("/incidents/<string:issue_id>/verifications", methods=["POST"])
@require_auth
def vote_or_verify_issue(issue_id: str):
    """
    Registers an authenticated community verification/upvote.
    Enforces that each user can only vote once per incident using database constraints.
    """
    user_id = g.current_user["id"]
    verification_type = "confirm"
    notes = None
    if request.is_json:
        verification_type = request.json.get("type", "confirm").lower()
        notes = request.json.get("notes")

    success, code = IncidentRepository.add_verification(
        incident_id=issue_id,
        user_id=user_id,
        verification_type=verification_type,
        notes=notes
    )

    if not success:
        if code == "NOT_FOUND":
            return jsonify({"error": "Incident not found"}), 404
        if code == "ALREADY_VERIFIED":
            return jsonify({
                "status": "Conflict",
                "message": "You have already verified this incident. Duplicate voting is prevented.",
                "code": "DUPLICATE_VOTE"
            }), 409
        return jsonify({"error": "Failed to register verification"}), 500

    return jsonify({
        "status": "Success",
        "message": f"Verification '{verification_type}' registered successfully."
    }), 200

