from flask import Blueprint, request, jsonify, g
from app.core.config import config
from app.middleware.auth import require_role, require_auth
from app.repositories.user_repo import UserRepository
from app.services.storage_service import compress_image_bytes, upload_image_to_supabase

users_bp = Blueprint("users", __name__)

@users_bp.route("/admin/users", methods=["GET"])
@require_role(["super_admin"])
def list_users_for_admin():
    """
    Lists users for administrative governance and ward privilege assignment.
    
    SECURITY GUARANTEE:
    - Restricted strictly to Super Administrators.
    - Eliminates SEC-02 (Mass Exposure of Sensitive User PII).
    - Returns sanitized profiles without internal auth password hashes or tokens.
    - Enforces pagination.
    """
    limit = min(int(request.args.get("limit", config.DEFAULT_PAGE_SIZE)), config.MAX_PAGE_SIZE)
    offset = max(int(request.args.get("offset", 0)), 0)

    users = UserRepository.list_users(limit=limit, offset=offset)

    sanitized_users = []
    for u in users:
        raw_phone = u.get("phone_number") or ""
        # Mask middle digits for privacy protection
        masked_phone = raw_phone
        if len(raw_phone) >= 10:
            masked_phone = f"{raw_phone[:3]}****{raw_phone[-4:]}"

        sanitized_users.append({
            "id": str(u["id"]),
            "role": u.get("role", "citizen"),
            "full_name": u.get("full_name") or "Citizen",
            "phone": masked_phone,
            "wards_allocated": u.get("wards_allocated", [])
        })

    return jsonify({
        "status": "Success",
        "count": len(sanitized_users),
        "limit": limit,
        "offset": offset,
        "data": sanitized_users
    }), 200


@users_bp.route("/users/me", methods=["GET"])
@require_auth
def get_current_user_profile():
    """Returns the profile of the currently authenticated citizen or administrator."""
    user_id = g.current_user["id"]
    profile = UserRepository.get_profile_by_id(user_id)
    if not profile:
        profile = UserRepository.ensure_profile_exists(
            user_id=user_id,
            email=g.current_user.get("email"),
            phone_number=g.current_user.get("phone"),
            full_name="Citizen"
        )

    created_at = profile.get("created_at")
    if hasattr(created_at, "isoformat"):
        created_at = created_at.isoformat() + "Z"

    return jsonify({
        "status": "Success",
        "data": {
            "id": str(profile.get("id", user_id)),
            "role": profile.get("role", g.current_user.get("role", "citizen")),
            "full_name": profile.get("full_name") or "Citizen",
            "email": profile.get("email") or g.current_user.get("email"),
            "phone_number": profile.get("phone_number") or g.current_user.get("phone"),
            "avatar_url": profile.get("avatar_url"),
            "reputation_score": profile.get("reputation_score", 0),
            "is_verified": profile.get("is_verified", False),
            "primary_ward_id": profile.get("primary_ward_id"),
            "primary_ward_name": profile.get("primary_ward_name"),
            "created_at": created_at,
            "wards_allocated": g.current_user.get("wards", [])
        }
    }), 200


@users_bp.route("/users/me", methods=["PATCH"])
@require_auth
def update_current_user_profile():
    """
    Updates the authenticated citizen's personal profile information.
    
    SECURITY:
    - Enforces that citizens can ONLY modify permitted fields: full_name, phone_number, avatar_url.
    - Strictly forbids modification of role, reputation_score, is_verified, or user id.
    - Rejects unauthorized escalation attempts with 403 Forbidden.
    """
    user_id = g.current_user["id"]
    payload = request.get_json(silent=True)
    if payload is None or not isinstance(payload, dict):
        return jsonify({"error": "Invalid request", "message": "Expected JSON payload"}), 400

    # Role escalation check
    if "role" in payload:
        target_role = str(payload["role"]).lower().strip()
        current_role = g.current_user.get("role", "citizen")
        if target_role != current_role:
            return jsonify({
                "error": "Forbidden",
                "message": "Role modifications cannot be performed through citizen profile."
            }), 403

    # Verification / reputation tampering check
    if "reputation_score" in payload or "is_verified" in payload or "id" in payload:
        return jsonify({
            "error": "Forbidden",
            "message": "Administrative fields cannot be modified by citizen."
        }), 403

    full_name = payload.get("full_name")
    phone_number = payload.get("phone_number")
    avatar_url = payload.get("avatar_url")
    primary_ward_id = payload.get("primary_ward_id")

    # Validation
    if full_name is not None:
        full_name = str(full_name).strip()
        if len(full_name) < 2 or len(full_name) > 100:
            return jsonify({
                "error": "Validation Error",
                "message": "Full name must be between 2 and 100 characters."
            }), 400

    if phone_number is not None:
        phone_number = str(phone_number).strip()
        if phone_number != "":
            import re
            cleaned_phone = re.sub(r'[\s\-()]', '', phone_number)
            if not re.match(r'^\+?[0-9]{7,15}$', cleaned_phone):
                return jsonify({
                    "error": "Validation Error",
                    "message": "Please enter a valid phone number (7 to 15 digits)."
                }), 400

    if avatar_url is not None:
        avatar_url = str(avatar_url).strip()
        if avatar_url and not (avatar_url.startswith("http://") or avatar_url.startswith("https://") or avatar_url.startswith("/uploads/")):
            return jsonify({
                "error": "Validation Error",
                "message": "Avatar must be a valid HTTP/HTTPS URL or uploads path."
            }), 400

    if primary_ward_id is not None:
        try:
            primary_ward_id = int(primary_ward_id)
        except (ValueError, TypeError):
            return jsonify({
                "error": "Validation Error",
                "message": "Primary ward ID must be an integer."
            }), 400

    updated_profile = UserRepository.update_citizen_profile(
        user_id=user_id,
        full_name=full_name,
        phone_number=phone_number,
        avatar_url=avatar_url,
        primary_ward_id=primary_ward_id
    )

    if not updated_profile:
        # If profile row didn't exist yet, auto-provision then update
        UserRepository.ensure_profile_exists(
            user_id=user_id,
            email=g.current_user.get("email"),
            phone_number=phone_number or g.current_user.get("phone"),
            full_name=full_name or "Citizen"
        )
        updated_profile = UserRepository.update_citizen_profile(
            user_id=user_id,
            full_name=full_name,
            phone_number=phone_number,
            avatar_url=avatar_url,
            primary_ward_id=primary_ward_id
        )

    res_data = updated_profile or {}
    return jsonify({
        "status": "Success",
        "message": "Profile updated successfully",
        "data": {
            "id": str(res_data.get("id", user_id)),
            "role": res_data.get("role", g.current_user.get("role", "citizen")),
            "full_name": res_data.get("full_name") or full_name or "Citizen",
            "email": res_data.get("email") or g.current_user.get("email"),
            "phone_number": res_data.get("phone_number") or phone_number,
            "avatar_url": res_data.get("avatar_url") or avatar_url,
            "reputation_score": res_data.get("reputation_score", 0),
            "is_verified": res_data.get("is_verified", False),
            "primary_ward_id": res_data.get("primary_ward_id"),
            "wards_allocated": g.current_user.get("wards", [])
        }
    }), 200


@users_bp.route("/users/me/avatar", methods=["POST"])
@require_auth
def upload_avatar():
    """Uploads and updates a profile picture for the authenticated citizen."""
    if "avatar" not in request.files:
        return jsonify({"error": "No file uploaded", "message": "Expected 'avatar' file field."}), 400

    file = request.files["avatar"]
    if not file or not file.filename:
        return jsonify({"error": "Empty file", "message": "Avatar file cannot be empty."}), 400

    from werkzeug.utils import secure_filename
    import os
    filename = secure_filename(file.filename) or "avatar.jpg"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        return jsonify({"error": "Invalid format", "message": "Only JPEG, PNG, and WebP images are allowed."}), 400

    image_bytes = file.read()
    if len(image_bytes) == 0:
        return jsonify({"error": "Empty file", "message": "Uploaded avatar file is empty."}), 400
    if len(image_bytes) > 5 * 1024 * 1024:
        return jsonify({"error": "File too large", "message": "Avatar photo cannot exceed 5MB."}), 413

    compressed_bytes, content_type = compress_image_bytes(image_bytes, quality=85)
    avatar_url = upload_image_to_supabase(compressed_bytes, f"avatar_{g.current_user['id']}{ext}", content_type)

    UserRepository.update_citizen_profile(
        user_id=g.current_user["id"],
        avatar_url=avatar_url
    )

    return jsonify({
        "status": "Success",
        "avatar_url": avatar_url,
        "message": "Avatar uploaded successfully"
    }), 200


