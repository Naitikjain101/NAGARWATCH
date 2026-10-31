from flask import Blueprint, request, jsonify, g
from app.core.config import config
from app.middleware.auth import require_role
from app.repositories.incident_repo import IncidentRepository
import logging

logger = logging.getLogger(__name__)

admin_bp = Blueprint("admin", __name__)

VALID_STATUSES = ["pending", "reported", "verified", "assigned", "in_progress", "resolved", "rejected", "closed"]

@admin_bp.route("/admin/complaints", methods=["GET"])
@admin_bp.route("/admin/incidents", methods=["GET"])
@require_role(["admin", "super_admin"])
def get_admin_complaints():
    """
    Fetches complaints/incidents strictly filtered by the authenticated administrator's
    assigned wards, or across all wards if caller is a super-admin.
    
    SECURITY GUARANTEE: Does NOT trust any 'user_id' parameter supplied by the client.
    Derives admin identity and ward assignments strictly from the verified JWT session.
    """
    current_user = g.current_user
    is_super = current_user.get("role") == "super_admin"
    assigned_wards = current_user.get("wards", [])

    # Super admins can optionally filter by a specific ward via query string.
    # Ward admins are strictly scoped to their assigned wards (client query string ignored).
    req_ward_id = request.args.get("ward_id")
    filter_wards = assigned_wards
    if is_super and req_ward_id:
        try:
            filter_wards = [int(req_ward_id)]
        except ValueError:
            return jsonify({"error": "Invalid ward_id provided"}), 400

    limit = min(int(request.args.get("limit", config.DEFAULT_PAGE_SIZE)), config.MAX_PAGE_SIZE)
    offset = max(int(request.args.get("offset", 0)), 0)

    incidents = IncidentRepository.get_admin_incidents(
        ward_ids=filter_wards,
        is_super_admin=is_super,
        limit=limit,
        offset=offset
    )

    return jsonify({
        "status": "Success",
        "wards_allocated": assigned_wards if not is_super else "ALL_WARDS",
        "count": len(incidents),
        "limit": limit,
        "offset": offset,
        "data": incidents
    }), 200


@admin_bp.route("/admin/complaints/<string:issue_id>/status", methods=["PATCH"])
@admin_bp.route("/admin/incidents/<string:issue_id>/status", methods=["PATCH"])
@require_role(["admin", "super_admin"])
def update_complaint_status(issue_id: str):
    """
    Updates the status of an incident.
    
    SECURITY GUARANTEE:
    - Verifies that the caller has admin or super-admin role.
    - If caller is an admin, checks that the incident's ward is within their assigned jurisdiction.
    - Rejects unauthorized updates with 403 Forbidden.
    """
    if not request.is_json:
        return jsonify({"error": "JSON payload required"}), 400

    new_status = request.json.get("status", "").lower().strip()
    notes = request.json.get("notes")
    proof_media_url = request.json.get("proof_media_url")

    if new_status not in VALID_STATUSES:
        return jsonify({
            "error": "Invalid status",
            "message": f"Status must be one of: {', '.join(VALID_STATUSES)}"
        }), 400

    # Harmonize legacy "pending" to canonical "reported"
    if new_status == "pending":
        new_status = "reported"

    # 1. Fetch target incident to verify existence and ward jurisdiction
    incident = IncidentRepository.get_incident_by_id(issue_id)
    if not incident:
        return jsonify({"error": "Incident not found"}), 404

    current_user = g.current_user
    is_super = current_user.get("role") == "super_admin"
    incident_ward = incident.get("ward_id")

    # 2. Jurisdiction Check: Admins cannot modify incidents outside assigned wards
    if not is_super:
        assigned_wards = current_user.get("wards", [])
        if incident_ward not in assigned_wards:
            return jsonify({
                "error": "Forbidden",
                "message": f"Unauthorized jurisdiction. Incident belongs to ward {incident_ward}, which is not in your assigned wards.",
                "code": "OUT_OF_JURISDICTION"
            }), 403

    # 3. Apply update
    update_kwargs = {
        "incident_id": issue_id,
        "new_status": new_status,
        "user_id": current_user["id"],
        "notes": notes
    }
    if proof_media_url:
        update_kwargs["proof_media_url"] = proof_media_url

    success = IncidentRepository.update_status(**update_kwargs)

    if not success:
        return jsonify({"error": "Failed to update incident status"}), 500

    return jsonify({
        "status": "Success",
        "message": f"Issue {issue_id} updated to {new_status}"
    }), 200


@admin_bp.route("/admin/incidents/<string:issue_id>/proof", methods=["POST"])
@require_role(["admin", "super_admin"])
def upload_resolution_proof(issue_id: str):
    """
    Uploads an official resolution proof photograph for an incident.
    Verifies ward administrator jurisdiction before accepting the evidence.
    """
    incident = IncidentRepository.get_incident_by_id(issue_id)
    if not incident:
        return jsonify({"error": "Incident not found"}), 404

    current_user = g.current_user
    is_super = current_user.get("role") == "super_admin"
    incident_ward = incident.get("ward_id")

    if not is_super:
        assigned_wards = current_user.get("wards", [])
        if incident_ward not in assigned_wards:
            return jsonify({
                "error": "Forbidden",
                "message": f"Unauthorized jurisdiction. Incident belongs to ward {incident_ward}.",
                "code": "OUT_OF_JURISDICTION"
            }), 403

    if "image" not in request.files:
        return jsonify({"error": "No proof image file uploaded"}), 400

    file = request.files["image"]
    if not file or not file.filename:
        return jsonify({"error": "Missing or empty file"}), 400

    from werkzeug.utils import secure_filename
    from PIL import Image
    import io
    import os
    from app.services.storage_service import compress_image_bytes, upload_image_to_supabase

    filename = secure_filename(file.filename) or "proof.jpg"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".heic"}:
        return jsonify({
            "error": "Invalid format",
            "message": "Only JPEG, PNG, WEBP, and HEIC image files are accepted."
        }), 400

    image_bytes = file.read()
    if len(image_bytes) == 0:
        return jsonify({"error": "File is empty"}), 400

    if len(image_bytes) > config.MAX_CONTENT_LENGTH:
        return jsonify({"error": f"File exceeds maximum allowed size of {config.MAX_CONTENT_LENGTH // (1024*1024)}MB"}), 413

    try:
        test_img = Image.open(io.BytesIO(image_bytes))
        test_img.verify()
    except Exception:
        return jsonify({
            "error": "Invalid image content",
            "message": "The uploaded file is not a valid decodable image."
        }), 400

    compressed_bytes, content_type = compress_image_bytes(image_bytes, quality=85)
    public_url = upload_image_to_supabase(compressed_bytes, filename, content_type)

    return jsonify({
        "status": "Success",
        "proof_media_url": public_url
    }), 201

