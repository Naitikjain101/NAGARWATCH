import logging
import urllib.request
import urllib.parse
import json
from typing import List, Dict, Any, Optional, Tuple
from app.repositories.db import get_db_cursor
from app.core.config import config

logger = logging.getLogger(__name__)

class NotificationRepository:
    """
    Repository for user-specific in-app notification records.
    Provides direct PostgreSQL access with Supabase REST fallback.
    """

    @staticmethod
    def get_user_notifications(
        user_id: str,
        limit: int = 20,
        offset: int = 0
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Retrieves notifications for the specified authenticated user.
        Strictly prevents accessing other users' notification records.
        """
        query = """
            SELECT id, user_id, incident_id, title, body, type, is_read, created_at,
                   COUNT(*) OVER() AS full_count
            FROM public.notifications
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s;
        """
        try:
            with get_db_cursor(commit=False, dict_cursor=True) as cur:
                cur.execute(query, (user_id, limit, offset))
                rows = cur.fetchall()
                results = []
                total = 0
                for row in rows:
                    total = row.get("full_count", 0)
                    item = dict(row)
                    item.pop("full_count", None)
                    if hasattr(item.get("created_at"), "isoformat"):
                        item["created_at"] = item["created_at"].isoformat() + "Z"
                    results.append(item)
                return results, total
        except Exception as e:
            logger.debug(f"Direct DB query get_user_notifications skipped or failed: {e}")

        # Supabase REST fallback
        if config.SUPABASE_URL and config.SUPABASE_KEY:
            try:
                base = config.SUPABASE_URL.rstrip('/')
                key = config.SUPABASE_KEY
                url = (
                    f"{base}/rest/v1/notifications?"
                    f"user_id=eq.{user_id}&"
                    f"order=created_at.desc&"
                    f"limit={limit}&offset={offset}&"
                    f"select=id,user_id,incident_id,title,body,type,is_read,created_at"
                )
                req = urllib.request.Request(
                    url,
                    headers={"apikey": key, "Authorization": f"Bearer {key}"}
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status == 200:
                        rows = json.loads(resp.read().decode('utf-8'))
                        return rows, len(rows)
            except Exception as rest_err:
                logger.warning(f"REST fallback get_user_notifications failed: {rest_err}")

        return [], 0

    @staticmethod
    def mark_notification_as_read(notification_id: str, user_id: str) -> bool:
        """
        Marks a specific notification as read, ensuring ownership validation.
        """
        query = """
            UPDATE public.notifications
            SET is_read = TRUE
            WHERE id = %s AND user_id = %s
            RETURNING id;
        """
        try:
            with get_db_cursor(commit=True) as cur:
                cur.execute(query, (notification_id, user_id))
                row = cur.fetchone()
                return bool(row)
        except Exception as e:
            logger.debug(f"Direct DB query mark_notification_as_read failed: {e}")

        # REST fallback
        if config.SUPABASE_URL and config.SUPABASE_KEY:
            try:
                base = config.SUPABASE_URL.rstrip('/')
                key = config.SUPABASE_KEY
                url = f"{base}/rest/v1/notifications?id=eq.{notification_id}&user_id=eq.{user_id}"
                data = json.dumps({"is_read": True}).encode('utf-8')
                req = urllib.request.Request(
                    url,
                    data=data,
                    headers={
                        "apikey": key,
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json",
                        "Prefer": "return=representation"
                    },
                    method="PATCH"
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    return resp.status in (200, 204)
            except Exception as rest_err:
                logger.warning(f"REST fallback mark_notification_as_read failed: {rest_err}")

        return False

    @staticmethod
    def create_notification(
        user_id: str,
        incident_id: Optional[str],
        title: str,
        body: str,
        notif_type: str = "status_update"
    ) -> bool:
        """
        Creates an authentic notification record for a citizen.
        """
        query = """
            INSERT INTO public.notifications (user_id, incident_id, title, body, type)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id;
        """
        try:
            with get_db_cursor(commit=True) as cur:
                cur.execute(query, (user_id, incident_id, title, body, notif_type))
                row = cur.fetchone()
                return bool(row)
        except Exception as e:
            logger.debug(f"Direct DB query create_notification failed: {e}")

        # REST fallback
        if config.SUPABASE_URL and config.SUPABASE_KEY:
            try:
                base = config.SUPABASE_URL.rstrip('/')
                key = config.SUPABASE_KEY
                url = f"{base}/rest/v1/notifications"
                data = json.dumps({
                    "user_id": user_id,
                    "incident_id": incident_id,
                    "title": title,
                    "body": body,
                    "type": notif_type
                }).encode('utf-8')
                req = urllib.request.Request(
                    url,
                    data=data,
                    headers={
                        "apikey": key,
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json"
                    },
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    return resp.status in (200, 201)
            except Exception as rest_err:
                logger.warning(f"REST fallback create_notification failed: {rest_err}")

        return False
