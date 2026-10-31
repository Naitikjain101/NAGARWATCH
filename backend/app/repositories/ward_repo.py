import json
import urllib.request
from typing import Optional, List, Dict, Any
from app.repositories.db import get_db_cursor
from app.core.config import config
import logging

logger = logging.getLogger(__name__)

class WardRepository:
    @staticmethod
    def list_wards() -> List[Dict[str, Any]]:
        """Fetches all registered wards with GeoJSON geometry, sorted by name."""
        query = """
            SELECT id, name, ST_AsGeoJSON(geom) AS geom_json 
            FROM public.wards 
            ORDER BY name ASC;
        """
        try:
            with get_db_cursor(commit=False, dict_cursor=True) as cur:
                cur.execute(query)
                rows = cur.fetchall()
                wards = []
                for row in rows:
                    geom = json.loads(row["geom_json"]) if row.get("geom_json") else None
                    wards.append({
                        "id": row["id"],
                        "name": row["name"],
                        "geom": geom
                    })
                return wards
        except Exception as e:
            logger.debug(f"Direct DB query list_wards skipped or failed: {e}")

        # Supabase REST API fallback
        if config.SUPABASE_URL and config.SUPABASE_KEY:
            try:
                base = config.SUPABASE_URL.rstrip('/')
                key = config.SUPABASE_KEY
                url = f"{base}/rest/v1/wards?select=id,name,geom&order=name.asc"
                req = urllib.request.Request(url, headers={"apikey": key, "Authorization": f"Bearer {key}"})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status == 200:
                        rows = json.loads(resp.read().decode('utf-8'))
                        return [{
                            "id": r["id"],
                            "name": r["name"],
                            "geom": r.get("geom")
                        } for r in rows]
            except Exception as rest_err:
                logger.error(f"REST fallback list_wards failed: {rest_err}")

        return []

    @staticmethod
    def get_ward_by_id(ward_id: int) -> Optional[Dict[str, Any]]:
        """Retrieves a single ward by ID."""
        query = "SELECT id, name FROM public.wards WHERE id = %s;"
        try:
            with get_db_cursor(commit=False, dict_cursor=True) as cur:
                cur.execute(query, (ward_id,))
                return cur.fetchone()
        except Exception as e:
            logger.debug(f"Direct DB query get_ward_by_id skipped or failed: {e}")

        # Supabase REST fallback
        if config.SUPABASE_URL and config.SUPABASE_KEY:
            try:
                base = config.SUPABASE_URL.rstrip('/')
                key = config.SUPABASE_KEY
                url = f"{base}/rest/v1/wards?id=eq.{ward_id}&select=id,name"
                req = urllib.request.Request(url, headers={"apikey": key, "Authorization": f"Bearer {key}"})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status == 200:
                        rows = json.loads(resp.read().decode('utf-8'))
                        return rows[0] if rows else None
            except Exception as rest_err:
                logger.error(f"REST fallback get_ward_by_id failed: {rest_err}")

        return None

    @staticmethod
    def check_boundary_overlap(geom_wkt: str) -> List[str]:
        """
        Checks for spatial boundary intersections with existing wards.
        Uses ST_Area(ST_Intersection(...)) > 0 to allow boundaries to touch
        without throwing overlap conflicts.
        """
        query = """
            SELECT name 
            FROM public.wards 
            WHERE ST_Area(ST_Intersection(geom, ST_GeomFromText(%s, 4326))) > 0;
        """
        try:
            with get_db_cursor(commit=False) as cur:
                cur.execute(query, (geom_wkt,))
                rows = cur.fetchall()
                return [row[0] for row in rows]
        except Exception as e:
            logger.error(f"Boundary overlap check failed: {e}")
            return []

    @staticmethod
    def create_ward(name: str, geom_wkt: str) -> int:
        """Inserts a new spatial ward boundary into public.wards."""
        query = """
            INSERT INTO public.wards (name, geom) 
            VALUES (%s, ST_GeomFromText(%s, 4326)) 
            RETURNING id;
        """
        with get_db_cursor(commit=True) as cur:
            cur.execute(query, (name, geom_wkt))
            return cur.fetchone()[0]

    @staticmethod
    def update_ward(ward_id: int, name: Optional[str] = None, geom_wkt: Optional[str] = None, code: Optional[str] = None) -> bool:
        """Updates ward details (name, geometry, municipal code)."""
        updates = []
        params = []
        if name is not None:
            updates.append("name = %s")
            params.append(name.strip())
        if code is not None:
            updates.append("code = %s")
            params.append(code.strip())
        if geom_wkt is not None:
            updates.append("geom = ST_GeomFromText(%s, 4326)")
            params.append(geom_wkt.strip())

        if not updates:
            return False

        query = f"UPDATE public.wards SET {', '.join(updates)} WHERE id = %s RETURNING id;"
        params.append(ward_id)

        try:
            with get_db_cursor(commit=True) as cur:
                cur.execute(query, tuple(params))
                row = cur.fetchone()
                return bool(row)
        except Exception as e:
            logger.error(f"Error updating ward {ward_id}: {e}")
            return False

    @staticmethod
    def delete_ward(ward_id: int) -> bool:
        """
        Unlinks incidents and complaints from the ward and deletes the boundary.
        """
        with get_db_cursor(commit=True) as cur:
            # Unlink references
            cur.execute("UPDATE public.incidents SET ward_id = NULL WHERE ward_id = %s;", (ward_id,))
            try:
                cur.execute("UPDATE public.complaints SET ward_id = NULL WHERE ward_id = %s;", (ward_id,))
            except Exception:
                pass

            # Delete the ward
            cur.execute("DELETE FROM public.wards WHERE id = %s RETURNING id;", (ward_id,))
            row = cur.fetchone()
            return bool(row)

