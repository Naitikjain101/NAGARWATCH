from functools import wraps
from typing import List, Union, Callable, Any
from flask import request, jsonify, g
from app.core.security import (
    extract_bearer_token,
    verify_jwt_token,
    MissingTokenError,
    TokenExpiredError,
    InvalidTokenError,
    AuthError
)
from app.repositories.user_repo import UserRepository

# Role Normalization: Map role aliases to canonical forms
ROLE_ALIASES = {
    "superadmin": "super_admin",
    "super_admin": "super_admin",
    "admin": "admin",
    "citizen": "citizen"
}

def normalize_role(role: str) -> str:
    """Normalizes role strings to canonical identifiers."""
    return ROLE_ALIASES.get(role.lower().strip(), "citizen") if role else "citizen"


def require_auth(f: Callable) -> Callable:
    """
    Decorator: Enforces that a valid Supabase JWT Bearer token is provided.
    Extracts the token, validates it cryptographically, resolves the user's
    database-backed role and permissions, and populates `g.current_user`.
    """
    @wraps(f)
    def decorated(*args: Any, **kwargs: Any):
        token = extract_bearer_token(request.headers.get("Authorization"))
        if not token:
            return jsonify({
                "error": "Unauthorized",
                "message": "Authorization header with Bearer token is required",
                "code": "MISSING_TOKEN"
            }), 401

        try:
            payload = verify_jwt_token(token)
            user_id = payload.get("sub")
            if not user_id:
                return jsonify({
                    "error": "Unauthorized",
                    "message": "Invalid token: subject identifier missing",
                    "code": "INVALID_TOKEN"
                }), 401

            # Fetch authoritative database role and ward allocations
            user_auth = UserRepository.get_user_role_and_wards(user_id)
            role = normalize_role(user_auth.get("role", "citizen"))

            g.current_user = {
                "id": str(user_id),
                "role": role,
                "wards": user_auth.get("wards", []),
                "email": payload.get("email"),
                "phone": payload.get("phone") or payload.get("user_metadata", {}).get("phone"),
                "token_payload": payload
            }

        except TokenExpiredError as e:
            return jsonify({
                "error": "Unauthorized",
                "message": str(e),
                "code": "TOKEN_EXPIRED"
            }), 401
        except InvalidTokenError as e:
            return jsonify({
                "error": "Unauthorized",
                "message": str(e),
                "code": getattr(e, "code", "INVALID_TOKEN")
            }), 401
        except AuthError as e:
            error_title = "Server Configuration Error" if e.status_code == 500 else "Unauthorized"
            return jsonify({
                "error": error_title,
                "message": str(e),
                "code": getattr(e, "code", "AUTH_ERROR")
            }), e.status_code
        except Exception as e:
            return jsonify({
                "error": "Unauthorized",
                "message": f"Authentication failed: {str(e)}",
                "code": "AUTH_FAILED"
            }), 401

        return f(*args, **kwargs)
    return decorated


def require_role(allowed_roles: Union[str, List[str]]) -> Callable:
    """
    Decorator: Requires that the authenticated user possesses one of the allowed roles.
    Works seamlessly with require_auth.
    Supports roles: 'citizen', 'admin', 'super_admin'.
    """
    if isinstance(allowed_roles, str):
        allowed_roles = [allowed_roles]
    normalized_allowed = [normalize_role(r) for r in allowed_roles]

    def decorator(f: Callable) -> Callable:
        @wraps(f)
        @require_auth
        def decorated(*args: Any, **kwargs: Any):
            user_role = g.current_user.get("role", "citizen")
            
            # Super admin possesses root authority over all lower roles
            if user_role == "super_admin":
                return f(*args, **kwargs)

            if user_role not in normalized_allowed:
                return jsonify({
                    "error": "Forbidden",
                    "message": f"Access denied. Requires one of the following roles: {', '.join(allowed_roles)}",
                    "code": "INSUFFICIENT_ROLE"
                }), 403

            return f(*args, **kwargs)
        return decorated
    return decorator


def require_ward_access(ward_id_param_name: str = "ward_id") -> Callable:
    """
    Decorator: Ensures an admin has jurisdiction over the specified ward.
    - Super admins have global access across all wards.
    - Admins are verified against their assigned ward IDs in admin_wards.
    - Citizens are blocked.
    """
    def decorator(f: Callable) -> Callable:
        @wraps(f)
        @require_role(["admin", "super_admin"])
        def decorated(*args: Any, **kwargs: Any):
            current_user = g.current_user
            
            if current_user.get("role") == "super_admin":
                return f(*args, **kwargs)

            # Retrieve target ward_id from route kwargs, query string, or JSON payload
            target_ward_id = kwargs.get(ward_id_param_name)
            if target_ward_id is None:
                target_ward_id = request.args.get(ward_id_param_name)
            if target_ward_id is None and request.is_json:
                target_ward_id = request.json.get(ward_id_param_name)

            if target_ward_id is not None:
                try:
                    target_ward_id = int(target_ward_id)
                except (ValueError, TypeError):
                    return jsonify({"error": "Bad Request", "message": "Invalid ward ID provided"}), 400

                assigned_wards = current_user.get("wards", [])
                if target_ward_id not in assigned_wards:
                    return jsonify({
                        "error": "Forbidden",
                        "message": f"Unauthorized jurisdiction. You are not assigned to ward {target_ward_id}.",
                        "code": "WARD_ACCESS_DENIED"
                    }), 403

            return f(*args, **kwargs)
        return decorated
    return decorator

