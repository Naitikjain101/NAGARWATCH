from flask import Blueprint, request, jsonify, g
from app.middleware.auth import require_role
from app.repositories.ward_repo import WardRepository
from app.repositories.user_repo import UserRepository
import logging

logger = logging.getLogger(__name__)

wards_bp = Blueprint("wards", __name__)

@wards_bp.route("/wards", methods=["GET"])
def get_wards():
    """Fetches all registered wards and their GeoJSON geometry."""
    wards = WardRepository.list_wards()
    return jsonify({
        "status": "Success",
        "count": len(wards),
        "data": wards
    }), 200


@wards_bp.route("/wards", methods=["POST"])
@require_role(["super_admin"])
def create_ward():
    """
    Creates a new administrative ward boundary.
    
    SECURITY GUARANTEE: Restricted strictly to authenticated Super Administrators.
    Performs PostGIS boundary overlap collision detection before insertion.
    """
    if not request.is_json:
        return jsonify({"error": "JSON payload required"}), 400

    data = request.json
    name = data.get("name", "").strip()
    geom_wkt = data.get("geom_wkt", "").strip()

    if not name or not geom_wkt:
        return jsonify({"error": "Missing required fields: 'name' and 'geom_wkt'"}), 400

    # 1. Check for spatial overlap conflicts with existing wards
    conflicts = WardRepository.check_boundary_overlap(geom_wkt)
    if conflicts:
        return jsonify({
            "status": "Conflict",
            "error": "The drawn boundary overlaps with existing wards.",
            "conflicts": conflicts
        }), 409

    # 2. Insert new ward
    try:
        new_id = WardRepository.create_ward(name, geom_wkt)
        return jsonify({
            "status": "Success",
            "ward_id": new_id,
            "name": name
        }), 201
    except Exception as e:
        logger.error(f"Failed to create ward: {e}")
        return jsonify({"error": f"Failed to save ward boundary: {str(e)}"}), 500


@wards_bp.route("/wards/<int:ward_id>", methods=["DELETE"])
@require_role(["super_admin"])
def delete_ward(ward_id: int):
    """
    Deletes an administrative ward.
    
    SECURITY GUARANTEE: Restricted strictly to authenticated Super Administrators.
    Unlinks associated incidents and cleans up admin assignments cleanly.
    """
    ward = WardRepository.get_ward_by_id(ward_id)
    if not ward:
        return jsonify({"error": "Ward not found"}), 404

    success = WardRepository.delete_ward(ward_id)
    if not success:
        return jsonify({"error": "Failed to delete ward"}), 500

    return jsonify({
        "status": "Success",
        "message": f"Ward {ward_id} was successfully deleted."
    }), 200


@wards_bp.route("/wards/<int:ward_id>/admin", methods=["POST"])
@require_role(["super_admin"])
def assign_ward_admins(ward_id: int):
    """
    Allocates administrators to a specific ward and synchronizes RBAC profile roles.
    
    SECURITY GUARANTEE: Restricted strictly to authenticated Super Administrators.
    Prevents unauthorized privilege elevation by ordinary users or ward admins.
    """
    if not request.is_json:
        return jsonify({"error": "JSON payload required"}), 400

    ward = WardRepository.get_ward_by_id(ward_id)
    if not ward:
        return jsonify({"error": "Ward not found"}), 404

    user_ids = request.json.get("user_ids", [])
    if not isinstance(user_ids, list):
        return jsonify({"error": "'user_ids' must be a list of user UUIDs"}), 400

    try:
        UserRepository.assign_ward_admins(
            ward_id=ward_id,
            user_ids=user_ids,
            assigned_by=g.current_user["id"]
        )
        return jsonify({
            "status": "Success",
            "message": f"Admins for ward {ward_id} synchronized successfully.",
            "ward_id": ward_id,
            "assigned_users_count": len(user_ids)
        }), 200
    except Exception as e:
        logger.error(f"Admin assignment failed: {e}")
        return jsonify({"error": f"Failed to assign ward admins: {str(e)}"}), 500

