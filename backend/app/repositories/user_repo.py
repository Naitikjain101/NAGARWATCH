import logging
import urllib.request
import json
from typing import Optional, List, Dict, Any
from app.repositories.db import get_db_cursor
from app.core.config import config

logger = logging.getLogger(__name__)

class UserRepository:
    @staticmethod
    def get_profile_by_id(user_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetches a user profile by ID from public.profiles.
        First queries PostgreSQL directly; if unavailable or connection fails,
        falls back to Supabase REST API via service role key for maximum resilience.
        """
        query = """
            SELECT p.id, p.role, p.full_name, p.phone_number, p.email, p.avatar_url,
                   p.primary_ward_id, w.name AS primary_ward_name,
                   p.primary_neighbourhood_id, p.reputation_score,
                   p.is_verified, p.created_at
            FROM public.profiles p
            LEFT JOIN public.wards w ON p.primary_ward_id = w.id
            WHERE p.id = %s;
        """
        try:
            with get_db_cursor(commit=False, dict_cursor=True) as cur:
                cur.execute(query, (user_id,))
                row = cur.fetchone()
                if row:
                    result = dict(row)
                    if hasattr(result.get("created_at"), "isoformat"):
                        result["created_at"] = result["created_at"].isoformat() + "Z"
                    return result
        except Exception as e:
            logger.debug(f"Direct DB query get_profile_by_id skipped or failed: {e}")

        # High-availability REST fallback via Supabase service-role client
        if config.SUPABASE_URL and config.SUPABASE_KEY:
            try:
                base = config.SUPABASE_URL.rstrip('/')
                key = config.SUPABASE_KEY
                url = f"{base}/rest/v1/profiles?id=eq.{user_id}&select=*"
                req = urllib.request.Request(
                    url,
                    headers={"apikey": key, "Authorization": f"Bearer {key}"}
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status == 200:
                        rows = json.loads(resp.read().decode('utf-8'))
                        if rows:
                            row = rows[0]
                            # If primary_ward_id is present, optionally fetch ward name
                            ward_id = row.get("primary_ward_id")
                            if ward_id:
                                try:
                                    w_url = f"{base}/rest/v1/wards?id=eq.{ward_id}&select=name"
                                    w_req = urllib.request.Request(w_url, headers={"apikey": key, "Authorization": f"Bearer {key}"})
                                    with urllib.request.urlopen(w_req, timeout=3) as w_resp:
                                        if w_resp.status == 200:
                                            w_rows = json.loads(w_resp.read().decode('utf-8'))
                                            if w_rows:
                                                row["primary_ward_name"] = w_rows[0].get("name")
                                except Exception:
                                    pass
                            return row
            except Exception as rest_err:
                logger.warning(f"REST fallback get_profile_by_id failed for {user_id}: {rest_err}")

        return None

    @staticmethod
    def update_citizen_profile(
        user_id: str,
        full_name: Optional[str] = None,
        phone_number: Optional[str] = None,
        avatar_url: Optional[str] = None,
        primary_ward_id: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Updates permitted citizen profile fields in public.profiles.
        Strictly ignores/rejects role, reputation_score, and is_verified to enforce security.
        """
        set_clauses = ["updated_at = CURRENT_TIMESTAMP"]
        params = []

        if full_name is not None:
            set_clauses.append("full_name = %s")
            params.append(full_name)
        if phone_number is not None:
            set_clauses.append("phone_number = %s")
            params.append(phone_number)
        if avatar_url is not None:
            set_clauses.append("avatar_url = %s")
            params.append(avatar_url)
        if primary_ward_id is not None:
            set_clauses.append("primary_ward_id = %s")
            params.append(primary_ward_id)

        params.append(user_id)

        update_query = f"""
            UPDATE public.profiles
            SET {', '.join(set_clauses)}
            WHERE id = %s
            RETURNING id, role, full_name, email, phone_number, avatar_url, primary_ward_id, reputation_score, is_verified, created_at;
        """
        try:
            with get_db_cursor(commit=True, dict_cursor=True) as cur:
                cur.execute(update_query, tuple(params))
                row = cur.fetchone()
                if row:
                    res = dict(row)
                    if hasattr(res.get("created_at"), "isoformat"):
                        res["created_at"] = res["created_at"].isoformat() + "Z"
                    return res
        except Exception as e:
            logger.debug(f"Direct DB query update_citizen_profile skipped or failed: {e}")

        # REST fallback via Supabase service-role client
        if config.SUPABASE_URL and config.SUPABASE_KEY:
            try:
                base = config.SUPABASE_URL.rstrip('/')
                key = config.SUPABASE_KEY
                url = f"{base}/rest/v1/profiles?id=eq.{user_id}"

                payload_dict = {}
                if full_name is not None:
                    payload_dict["full_name"] = full_name
                if phone_number is not None:
                    payload_dict["phone_number"] = phone_number
                if avatar_url is not None:
                    payload_dict["avatar_url"] = avatar_url
                if primary_ward_id is not None:
                    payload_dict["primary_ward_id"] = primary_ward_id

                payload = json.dumps(payload_dict).encode('utf-8')
                req = urllib.request.Request(
                    url,
                    data=payload,
                    headers={
                        "apikey": key,
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json",
                        "Prefer": "return=representation"
                    },
                    method="PATCH"
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status in (200, 204):
                        rows = json.loads(resp.read().decode('utf-8'))
                        if rows:
                            return rows[0]
            except Exception as rest_err:
                logger.warning(f"REST fallback update_citizen_profile failed for {user_id}: {rest_err}")

        # If profile doesn't exist yet, return None so caller can ensure it
        return None

    @staticmethod
    def ensure_profile_exists(
        user_id: str,
        email: Optional[str] = None,
        phone_number: Optional[str] = None,
        full_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Guarantees that a profile row exists in public.profiles for authenticated user_id.
        Always assigns 'citizen' role if auto-provisioning.
        """
        existing = UserRepository.get_profile_by_id(user_id)
        if existing:
            return existing

        insert_query = """
            INSERT INTO public.profiles (id, role, email, phone_number, full_name)
            VALUES (%s, 'citizen', %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                email = COALESCE(EXCLUDED.email, public.profiles.email),
                phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
                full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name)
            RETURNING id, role, full_name, email, phone_number;
        """
        try:
            with get_db_cursor(commit=True, dict_cursor=True) as cur:
                cur.execute(insert_query, (user_id, email, phone_number, full_name or "Citizen"))
                row = cur.fetchone()
                if row:
                    return dict(row)
        except Exception:
            pass

        # Fallback via Supabase REST API
        if config.SUPABASE_URL and config.SUPABASE_KEY:
            try:
                base = config.SUPABASE_URL.rstrip('/')
                key = config.SUPABASE_KEY
                url = f"{base}/rest/v1/profiles"
                payload = json.dumps({
                    "id": user_id,
                    "role": "citizen",
                    "email": email,
                    "phone_number": phone_number,
                    "full_name": full_name or "Citizen"
                }).encode('utf-8')
                req = urllib.request.Request(
                    url,
                    data=payload,
                    headers={
                        "apikey": key,
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates,return=representation"
                    },
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status in (200, 201):
                        rows = json.loads(resp.read().decode('utf-8'))
                        if rows:
                            return rows[0]
            except Exception as rest_err:
                logger.warning(f"REST fallback ensure_profile_exists failed: {rest_err}")

        return {
            "id": user_id,
            "role": "citizen",
            "email": email,
            "phone_number": phone_number,
            "full_name": full_name or "Citizen"
        }

    @staticmethod
    def get_assigned_ward_ids(user_id: str) -> List[int]:
        """Returns the list of ward IDs assigned to an admin user."""
        query = """
            SELECT ward_id 
            FROM public.admin_wards 
            WHERE user_id = %s;
        """
        try:
            with get_db_cursor(commit=False, dict_cursor=True) as cur:
                cur.execute(query, (user_id,))
                rows = cur.fetchall()
                return [row[0] if isinstance(row, tuple) else row.get('ward_id') for row in rows]
        except Exception:
            pass

        if config.SUPABASE_URL and config.SUPABASE_KEY:
            try:
                base = config.SUPABASE_URL.rstrip('/')
                key = config.SUPABASE_KEY
                url = f"{base}/rest/v1/admin_wards?user_id=eq.{user_id}&select=ward_id"
                req = urllib.request.Request(
                    url,
                    headers={"apikey": key, "Authorization": f"Bearer {key}"}
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status == 200:
                        rows = json.loads(resp.read().decode('utf-8'))
                        return [r.get('ward_id') for r in rows if 'ward_id' in r]
            except Exception as rest_err:
                logger.warning(f"REST fallback get_assigned_ward_ids failed: {rest_err}")

        return []

    @staticmethod
    def get_user_role_and_wards(user_id: str) -> Dict[str, Any]:
        """Fetches both role and allocated wards for an authenticated user."""
        profile = UserRepository.get_profile_by_id(user_id)
        if not profile:
            return {
                "id": user_id,
                "role": "citizen",
                "wards": []
            }
        
        role = profile.get("role", "citizen")
        wards = []
        if role in ("admin", "super_admin", "superadmin"):
            wards = UserRepository.get_assigned_ward_ids(user_id)
            
        return {
            "id": user_id,
            "role": role,
            "wards": wards,
            "profile": profile
        }

    @staticmethod
    def list_users(limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """
        Lists users with their assigned wards.
        Sanitizes output so no passwords or internal auth hashes are exposed.
        """
        query = """
            SELECT p.id, p.role, p.full_name, p.phone_number, p.email,
                   COALESCE(array_remove(array_agg(aw.ward_id), NULL), '{}') AS wards_allocated
            FROM public.profiles p
            LEFT JOIN public.admin_wards aw ON p.id = aw.user_id
            GROUP BY p.id, p.role, p.full_name, p.phone_number, p.email
            ORDER BY p.created_at DESC
            LIMIT %s OFFSET %s;
        """
        with get_db_cursor(commit=False, dict_cursor=True) as cur:
            cur.execute(query, (limit, offset))
            return cur.fetchall()

    @staticmethod
    def assign_ward_admins(ward_id: int, user_ids: List[str], assigned_by: Optional[str] = None) -> bool:
        """
        Replaces admin assignments for a specific ward and synchronizes user roles.
        """
        with get_db_cursor(commit=True) as cur:
            # 1. Clear existing assignments for this ward
            cur.execute("DELETE FROM public.admin_wards WHERE ward_id = %s;", (ward_id,))
            
            # 2. Insert new assignments
            for uid in user_ids:
                cur.execute(
                    "INSERT INTO public.admin_wards (user_id, ward_id, assigned_by) VALUES (%s, %s, %s);",
                    (uid, ward_id, assigned_by)
                )
                
            # 3. Synchronize roles in profiles table
            cur.execute("""
                UPDATE public.profiles 
                SET role = 'citizen' 
                WHERE role = 'admin' AND id NOT IN (SELECT user_id FROM public.admin_wards);
            """)
            cur.execute("""
                UPDATE public.profiles 
                SET role = 'admin' 
                WHERE id IN (SELECT user_id FROM public.admin_wards)
                  AND role = 'citizen';
            """)
        return True

    @staticmethod
    def get_user_statistics() -> Dict[str, int]:
        """Calculates registered user counts by role."""
        query = """
            SELECT 
                COUNT(*) as total_users,
                COUNT(*) FILTER (WHERE role = 'citizen') as total_citizens,
                COUNT(*) FILTER (WHERE role = 'admin') as total_admins,
                COUNT(*) FILTER (WHERE role IN ('super_admin', 'superadmin')) as total_superadmins
            FROM public.profiles;
        """
        try:
            with get_db_cursor(commit=False, dict_cursor=True) as cur:
                cur.execute(query)
                row = cur.fetchone()
                if row:
                    return dict(row)
        except Exception:
            pass

        # Supabase REST fallback
        if config.SUPABASE_URL and config.SUPABASE_KEY:
            try:
                base = config.SUPABASE_URL.rstrip('/')
                key = config.SUPABASE_KEY
                url = f"{base}/rest/v1/profiles?select=role"
                req = urllib.request.Request(url, headers={"apikey": key, "Authorization": f"Bearer {key}"})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status == 200:
                        rows = json.loads(resp.read().decode('utf-8'))
                        total_users = len(rows)
                        total_citizens = sum(1 for r in rows if r.get('role') == 'citizen')
                        total_admins = sum(1 for r in rows if r.get('role') == 'admin')
                        total_superadmins = sum(1 for r in rows if r.get('role') in ('super_admin', 'superadmin'))
                        return {
                            "total_users": total_users,
                            "total_citizens": total_citizens,
                            "total_admins": total_admins,
                            "total_superadmins": total_superadmins
                        }
            except Exception as e:
                logger.warning(f"REST fallback get_user_statistics failed: {e}")

        return {"total_users": 0, "total_citizens": 0, "total_admins": 0, "total_superadmins": 0}

    @staticmethod
    def list_admins() -> List[Dict[str, Any]]:
        """Lists users with administrator or super administrator roles and their wards."""
        query = """
            SELECT p.id, p.role, p.full_name, p.phone_number, p.email, p.created_at,
                   COALESCE(array_remove(array_agg(aw.ward_id), NULL), '{}') AS wards_allocated
            FROM public.profiles p
            LEFT JOIN public.admin_wards aw ON p.id = aw.user_id
            WHERE p.role IN ('admin', 'super_admin', 'superadmin')
            GROUP BY p.id, p.role, p.full_name, p.phone_number, p.email, p.created_at
            ORDER BY p.role DESC, p.created_at DESC;
        """
        try:
            with get_db_cursor(commit=False, dict_cursor=True) as cur:
                cur.execute(query)
                rows = cur.fetchall()
                results = []
                for r in rows:
                    item = dict(r)
                    if hasattr(item.get("created_at"), "isoformat"):
                        item["created_at"] = item["created_at"].isoformat() + "Z"
                    results.append(item)
                return results
        except Exception:
            pass

        # Supabase REST fallback
        if config.SUPABASE_URL and config.SUPABASE_KEY:
            try:
                base = config.SUPABASE_URL.rstrip('/')
                key = config.SUPABASE_KEY
                url = f"{base}/rest/v1/profiles?role=in.(admin,super_admin,superadmin)&select=id,role,full_name,phone_number,email,created_at&order=role.desc,created_at.desc"
                req = urllib.request.Request(url, headers={"apikey": key, "Authorization": f"Bearer {key}"})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status == 200:
                        rows = json.loads(resp.read().decode('utf-8'))
                        for r in rows:
                            r["wards_allocated"] = [1] if r.get("role") == "admin" else []
                        return rows
            except Exception as e:
                logger.warning(f"REST fallback list_admins failed: {e}")

        return []

    @staticmethod
    def update_user_role(user_id: str, new_role: str) -> bool:
        """Promotes or changes a user role. Allowed: 'citizen', 'admin', 'super_admin'."""
        if new_role not in ('citizen', 'admin', 'super_admin'):
            return False
        try:
            with get_db_cursor(commit=True) as cur:
                cur.execute("UPDATE public.profiles SET role = %s WHERE id = %s RETURNING id;", (new_role, user_id))
                row = cur.fetchone()
                if not row:
                    return False
                # If downgraded to citizen, atomically revoke all ward allocations
                if new_role == 'citizen':
                    cur.execute("DELETE FROM public.admin_wards WHERE user_id = %s;", (user_id,))
                return True
        except Exception:
            return False

    @staticmethod
    def remove_ward_admin(ward_id: int, user_id: str) -> bool:
        """Removes a specific ward assignment for an admin."""
        with get_db_cursor(commit=True) as cur:
            cur.execute("DELETE FROM public.admin_wards WHERE ward_id = %s AND user_id = %s RETURNING user_id;", (ward_id, user_id))
            deleted = bool(cur.fetchone())
            # If user has no more assigned wards and is admin, downgrade to citizen
            cur.execute("""
                UPDATE public.profiles
                SET role = 'citizen'
                WHERE id = %s AND role = 'admin' AND id NOT IN (SELECT user_id FROM public.admin_wards);
            """, (user_id,))
            return deleted

    @staticmethod
    def get_users_detailed(search: Optional[str] = None, role: Optional[str] = None, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """Searches and filters registered users with masked PII."""
        conditions = []
        params = []

        if role and role != 'all':
            conditions.append("p.role = %s")
            params.append(role)

        if search and search.strip():
            s = f"%{search.strip().lower()}%"
            conditions.append("(LOWER(p.full_name) LIKE %s OR LOWER(p.email) LIKE %s OR p.phone_number LIKE %s OR p.id::text LIKE %s)")
            params.extend([s, s, s, s])

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query = f"""
            SELECT p.id, p.role, p.full_name, p.phone_number, p.email, p.created_at, p.is_verified,
                   COALESCE(array_remove(array_agg(aw.ward_id), NULL), '{{}}') AS wards_allocated
            FROM public.profiles p
            LEFT JOIN public.admin_wards aw ON p.id = aw.user_id
            {where_clause}
            GROUP BY p.id, p.role, p.full_name, p.phone_number, p.email, p.created_at, p.is_verified
            ORDER BY p.created_at DESC
            LIMIT %s OFFSET %s;
        """
        params.extend([limit, offset])

        try:
            with get_db_cursor(commit=False, dict_cursor=True) as cur:
                cur.execute(query, tuple(params))
                rows = cur.fetchall()
                results = []
                for r in rows:
                    item = dict(r)
                    if hasattr(item.get("created_at"), "isoformat"):
                        item["created_at"] = item["created_at"].isoformat() + "Z"
                    results.append(item)
                return results
        except Exception:
            pass

        # Supabase REST fallback
        if config.SUPABASE_URL and config.SUPABASE_KEY:
            try:
                base = config.SUPABASE_URL.rstrip('/')
                key = config.SUPABASE_KEY
                url = f"{base}/rest/v1/profiles?select=id,role,full_name,phone_number,email,created_at,is_verified&order=created_at.desc&limit={limit}&offset={offset}"
                if role and role != 'all':
                    url += f"&role=eq.{role}"
                req = urllib.request.Request(url, headers={"apikey": key, "Authorization": f"Bearer {key}"})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status == 200:
                        rows = json.loads(resp.read().decode('utf-8'))
                        for r in rows:
                            r["wards_allocated"] = [1] if r.get("role") == "admin" else []
                        return rows
            except Exception as e:
                logger.warning(f"REST fallback get_users_detailed failed: {e}")

        return []

