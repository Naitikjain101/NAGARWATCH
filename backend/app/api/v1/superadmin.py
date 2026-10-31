from flask import Blueprint, request, jsonify, g
from app.core.config import config
from app.middleware.auth import require_role
from app.repositories.user_repo import UserRepository
from app.repositories.ward_repo import WardRepository
from app.repositories.incident_repo import IncidentRepository
import logging

logger = logging.getLogger(__name__)

superadmin_bp = Blueprint("superadmin", __name__)

@superadmin_bp.route("/superadmin/overview", methods=["GET"])
@require_role(["super_admin"])
def get_superadmin_overview():
    """
    Returns platform-wide governance metrics:
    - User totals (citizens, admins, superadmins)
    - Ward totals
    - Incident totals by lifecycle status
    - Recent activity preview
    """
    try:
        user_stats = UserRepository.get_user_statistics()
        incident_stats = IncidentRepository.get_platform_incident_statistics()
        wards = WardRepository.list_wards()
        recent_incidents = IncidentRepository.get_admin_incidents(
            ward_ids=[], is_super_admin=True, limit=5, offset=0
        )
        recent_users = UserRepository.get_users_detailed(limit=5, offset=0)

        # Mask user phones for privacy
        sanitized_recent_users = []
        for u in recent_users:
            raw_phone = u.get("phone_number") or ""
            masked_phone = raw_phone
            if len(raw_phone) >= 10:
                masked_phone = f"{raw_phone[:3]}****{raw_phone[-4:]}"
            sanitized_recent_users.append({
                "id": u["id"],
                "full_name": u.get("full_name") or "User",
                "email": u.get("email"),
                "phone": masked_phone,
                "role": u.get("role", "citizen"),
                "created_at": u.get("created_at")
            })

        return jsonify({
            "status": "Success",
            "data": {
                "users": user_stats,
                "incidents": incident_stats,
                "total_wards": len(wards),
                "recent_incidents": recent_incidents,
                "recent_users": sanitized_recent_users
            }
        }), 200
    except Exception as e:
        logger.error(f"Error generating SuperAdmin overview: {e}")
        return jsonify({"error": f"Failed to generate overview: {str(e)}"}), 500


@superadmin_bp.route("/superadmin/wards", methods=["GET"])
@require_role(["super_admin"])
def list_superadmin_wards():
    """Lists all wards with incident counts and assigned administrators."""
    try:
        wards = WardRepository.list_wards()
        admins = UserRepository.list_admins()
        all_incidents = IncidentRepository.get_admin_incidents(
            ward_ids=[], is_super_admin=True, limit=1000, offset=0
        )

        enhanced_wards = []
        for w in wards:
            w_id = w["id"]
            assigned_admins = [
                a["full_name"] or a["email"] or a["id"]
                for a in admins
                if w_id in a.get("wards_allocated", [])
            ]
            w_incidents = [i for i in all_incidents if i.get("ward_id") == w_id]
            resolved_count = len([i for i in w_incidents if i.get("status") == "resolved"])
            active_count = len(w_incidents) - resolved_count

            enhanced_wards.append({
                "id": w_id,
                "name": w["name"],
                "geom": w.get("geom"),
                "assigned_admins_count": len(assigned_admins),
                "assigned_admins": assigned_admins,
                "total_incidents": len(w_incidents),
                "active_incidents": active_count,
                "resolved_incidents": resolved_count
            })

        return jsonify({
            "status": "Success",
            "count": len(enhanced_wards),
            "data": enhanced_wards
        }), 200
    except Exception as e:
        logger.error(f"Failed to list superadmin wards: {e}")
        return jsonify({"error": "Failed to fetch wards"}), 500


@superadmin_bp.route("/superadmin/wards", methods=["POST"])
@require_role(["super_admin"])
def create_superadmin_ward():
    """Creates a new ward boundary with collision detection."""
    if not request.is_json:
        return jsonify({"error": "JSON payload required"}), 400

    data = request.json
    name = data.get("name", "").strip()
    geom_wkt = data.get("geom_wkt", "").strip()
    code = data.get("code")

    if not name or not geom_wkt:
        return jsonify({"error": "Fields 'name' and 'geom_wkt' are required"}), 400

    conflicts = WardRepository.check_boundary_overlap(geom_wkt)
    if conflicts:
        return jsonify({
            "status": "Conflict",
            "error": "The specified boundary overlaps with existing wards.",
            "conflicts": conflicts
        }), 409

    try:
        new_id = WardRepository.create_ward(name, geom_wkt)
        if code:
            WardRepository.update_ward(new_id, code=code)
        return jsonify({
            "status": "Success",
            "ward_id": new_id,
            "name": name
        }), 201
    except Exception as e:
        logger.error(f"Failed to create ward: {e}")
        return jsonify({"error": f"Failed to create ward: {str(e)}"}), 500


@superadmin_bp.route("/superadmin/wards/<int:ward_id>", methods=["PATCH"])
@require_role(["super_admin"])
def update_superadmin_ward(ward_id: int):
    """Updates ward details (name, code, or geometry)."""
    if not request.is_json:
        return jsonify({"error": "JSON payload required"}), 400

    ward = WardRepository.get_ward_by_id(ward_id)
    if not ward:
        return jsonify({"error": "Ward not found"}), 404

    data = request.json
    name = data.get("name")
    code = data.get("code")
    geom_wkt = data.get("geom_wkt")

    if geom_wkt:
        conflicts = WardRepository.check_boundary_overlap(geom_wkt)
        # Filter out self conflict if renamed
        external_conflicts = [c for c in conflicts if c != ward["name"]]
        if external_conflicts:
            return jsonify({
                "status": "Conflict",
                "error": "The specified boundary overlaps with other wards.",
                "conflicts": external_conflicts
            }), 409

    success = WardRepository.update_ward(ward_id, name=name, geom_wkt=geom_wkt, code=code)
    if not success:
        return jsonify({"error": "Failed to update ward"}), 500

    return jsonify({
        "status": "Success",
        "message": f"Ward {ward_id} updated successfully."
    }), 200


@superadmin_bp.route("/superadmin/wards/<int:ward_id>", methods=["DELETE"])
@require_role(["super_admin"])
def delete_superadmin_ward(ward_id: int):
    """Deletes an administrative ward safely unlinking associated entities."""
    ward = WardRepository.get_ward_by_id(ward_id)
    if not ward:
        return jsonify({"error": "Ward not found"}), 404

    success = WardRepository.delete_ward(ward_id)
    if not success:
        return jsonify({"error": "Failed to delete ward"}), 500

    return jsonify({
        "status": "Success",
        "message": f"Ward {ward_id} deleted successfully."
    }), 200


@superadmin_bp.route("/superadmin/admins", methods=["GET"])
@require_role(["super_admin"])
def list_superadmin_admins():
    """Lists all registered administrators and their ward allocations."""
    try:
        admins = UserRepository.list_admins()
        return jsonify({
            "status": "Success",
            "count": len(admins),
            "data": admins
        }), 200
    except Exception as e:
        logger.error(f"Failed to fetch administrators: {e}")
        return jsonify({"error": "Failed to fetch administrators"}), 500


@superadmin_bp.route("/superadmin/admins/assign", methods=["POST"])
@require_role(["super_admin"])
def assign_admin_to_ward():
    """Assigns an administrator user to one or more wards."""
    if not request.is_json:
        return jsonify({"error": "JSON payload required"}), 400

    user_id = request.json.get("user_id")
    ward_id = request.json.get("ward_id")

    if not user_id or ward_id is None:
        return jsonify({"error": "Fields 'user_id' and 'ward_id' are required"}), 400

    try:
        w_id = int(ward_id)
    except ValueError:
        return jsonify({"error": "Invalid ward_id"}), 400

    ward = WardRepository.get_ward_by_id(w_id)
    if not ward:
        return jsonify({"error": "Ward not found"}), 404

    profile = UserRepository.get_profile_by_id(user_id)
    if not profile:
        return jsonify({"error": "User not found"}), 404

    # Fetch current assigned wards and add target ward
    current_wards = UserRepository.get_assigned_ward_ids(user_id)
    if w_id not in current_wards:
        current_wards.append(w_id)

    # Re-apply using assign_ward_admins pattern
    try:
        from app.repositories.db import get_db_cursor
        with get_db_cursor(commit=True) as cur:
            cur.execute(
                "INSERT INTO public.admin_wards (user_id, ward_id, assigned_by) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING;",
                (user_id, w_id, g.current_user["id"])
            )
            # Ensure role is admin
            if profile.get("role") == "citizen":
                cur.execute("UPDATE public.profiles SET role = 'admin' WHERE id = %s;", (user_id,))

        return jsonify({
            "status": "Success",
            "message": f"User {user_id} assigned to Ward {w_id} successfully."
        }), 200
    except Exception as e:
        logger.error(f"Failed to assign ward admin: {e}")
        return jsonify({"error": f"Failed to assign admin: {str(e)}"}), 500


@superadmin_bp.route("/superadmin/admins/remove", methods=["POST"])
@require_role(["super_admin"])
def remove_admin_from_ward():
    """Removes an administrator's assignment from a specific ward."""
    if not request.is_json:
        return jsonify({"error": "JSON payload required"}), 400

    user_id = request.json.get("user_id")
    ward_id = request.json.get("ward_id")

    if not user_id or ward_id is None:
        return jsonify({"error": "Fields 'user_id' and 'ward_id' are required"}), 400

    try:
        w_id = int(ward_id)
    except ValueError:
        return jsonify({"error": "Invalid ward_id"}), 400

    success = UserRepository.remove_ward_admin(w_id, user_id)
    return jsonify({
        "status": "Success",
        "message": f"User {user_id} removed from Ward {w_id}."
    }), 200


@superadmin_bp.route("/superadmin/admins/role", methods=["POST"])
@require_role(["super_admin"])
def update_user_role_endpoint():
    """Promotes or changes a user's role (citizen, admin, super_admin)."""
    if not request.is_json:
        return jsonify({"error": "JSON payload required"}), 400

    user_id = request.json.get("user_id")
    new_role = request.json.get("role", "").lower().strip()

    if not user_id or new_role not in ("citizen", "admin", "super_admin"):
        return jsonify({"error": "Invalid user_id or role. Allowed: citizen, admin, super_admin"}), 400

    # Prevent demoting the last super_admin
    if new_role != "super_admin":
        stats = UserRepository.get_user_statistics()
        if stats.get("total_superadmins", 0) <= 1 and g.current_user["id"] == user_id:
            return jsonify({"error": "Cannot demote the sole Super Administrator"}), 400

    success = UserRepository.update_user_role(user_id, new_role)
    if not success:
        return jsonify({"error": "Failed to update user role"}), 500

    return jsonify({
        "status": "Success",
        "message": f"User role updated to '{new_role}'."
    }), 200


@superadmin_bp.route("/superadmin/users", methods=["GET"])
@require_role(["super_admin"])
def list_superadmin_users():
    """Lists registered users with search, role filter, and masked PII."""
    search = request.args.get("search")
    role = request.args.get("role")
    limit = min(int(request.args.get("limit", config.DEFAULT_PAGE_SIZE)), config.MAX_PAGE_SIZE)
    offset = max(int(request.args.get("offset", 0)), 0)

    users = UserRepository.get_users_detailed(search=search, role=role, limit=limit, offset=offset)

    sanitized = []
    for u in users:
        raw_phone = u.get("phone_number") or ""
        masked_phone = raw_phone
        if len(raw_phone) >= 10:
            masked_phone = f"{raw_phone[:3]}****{raw_phone[-4:]}"

        sanitized.append({
            "id": u["id"],
            "full_name": u.get("full_name") or "User",
            "email": u.get("email"),
            "phone": masked_phone,
            "role": u.get("role", "citizen"),
            "is_verified": u.get("is_verified", False),
            "created_at": u.get("created_at"),
            "wards_allocated": u.get("wards_allocated", [])
        })

    return jsonify({
        "status": "Success",
        "count": len(sanitized),
        "limit": limit,
        "offset": offset,
        "data": sanitized
    }), 200


@superadmin_bp.route("/superadmin/audit", methods=["GET"])
@require_role(["super_admin"])
def get_superadmin_audit_logs():
    """Retrieves immutable lifecycle and status audit logs from public.incident_updates."""
    limit = min(int(request.args.get("limit", config.DEFAULT_PAGE_SIZE)), config.MAX_PAGE_SIZE)
    offset = max(int(request.args.get("offset", 0)), 0)

    logs = IncidentRepository.get_incident_audit_logs(limit=limit, offset=offset)

    return jsonify({
        "status": "Success",
        "count": len(logs),
        "limit": limit,
        "offset": offset,
        "data": logs
    }), 200

