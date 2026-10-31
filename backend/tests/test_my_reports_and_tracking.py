import json
import pytest
from unittest.mock import patch, MagicMock
from app.repositories.incident_repo import IncidentRepository
from app.repositories.notification_repo import NotificationRepository

class TestMyReportsAndIncidentTracking:
    """Comprehensive test suite for Phase 5C: My Reports, Incident Tracking & Notifications."""

    MOCK_USER_REPORTS = [
        {
            "id": "11111111-2222-3333-4444-555555555555",
            "category": "Pothole",
            "description": "Deep asphalt trench near school entrance",
            "status": "in_progress",
            "severity": "critical",
            "image_url": "https://storage.supabase.co/pothole1.jpg",
            "created_at": "2026-10-30T09:00:00Z",
            "updated_at": "2026-10-30T14:00:00Z",
            "latitude": 9.591234,
            "longitude": 76.521234,
            "ward_id": 1,
            "ward_name": "Ward 1 - Central",
            "confirmations_count": 4,
            "upvotes": 4,
            "disputes_count": 0,
            "resolution_notes": None,
            "resolved_at": None,
        },
        {
            "id": "22222222-3333-4444-5555-666666666666",
            "category": "Streetlight",
            "description": "Flickering high-voltage light pole",
            "status": "resolved",
            "severity": "medium",
            "image_url": "https://storage.supabase.co/light1.jpg",
            "created_at": "2026-10-25T11:00:00Z",
            "updated_at": "2026-10-28T16:00:00Z",
            "latitude": 9.593456,
            "longitude": 76.523456,
            "ward_id": 1,
            "ward_name": "Ward 1 - Central",
            "confirmations_count": 2,
            "upvotes": 2,
            "disputes_count": 0,
            "resolution_notes": "LED module replaced and pole grounded by electrical crew.",
            "resolved_at": "2026-10-28T16:00:00Z",
            "proof_media_url": "https://storage.supabase.co/proof_light.jpg"
        },
        {
            "id": "33333333-4444-5555-6666-777777777777",
            "category": "Garbage",
            "description": "Discarded construction material on footpath",
            "status": "rejected",
            "severity": "low",
            "image_url": "https://storage.supabase.co/garbage1.jpg",
            "created_at": "2026-10-20T08:00:00Z",
            "updated_at": "2026-10-21T09:00:00Z",
            "latitude": 9.595678,
            "longitude": 76.525678,
            "ward_id": 2,
            "ward_name": "Ward 2 - East",
            "confirmations_count": 0,
            "upvotes": 0,
            "disputes_count": 1,
            "resolution_notes": "Private residential property; referred to estate board."
        }
    ]

    # ─── 1. Citizen Retrieves Their Own Reports ────────────────────────────────
    def test_get_my_reports_authenticated(self, client, citizen_token):
        """Authenticated citizen can retrieve their own submitted reports."""
        with patch.object(IncidentRepository, "get_user_incidents", return_value=(self.MOCK_USER_REPORTS, 3)):
            headers = {"Authorization": f"Bearer {citizen_token}"}
            res = client.get("/api/v1/incidents/me", headers=headers)
            assert res.status_code == 200
            data = res.get_json()
            assert data["status"] == "Success"
            assert data["count"] == 3
            assert data["total"] == 3
            assert len(data["data"]) == 3
            assert data["data"][0]["category"] == "Pothole"
            assert data["data"][0]["severity"] == "critical"
            assert data["data"][0]["ward_name"] == "Ward 1 - Central"

    # ─── 2. Unauthenticated Access Blocked ────────────────────────────────────
    def test_get_my_reports_unauthenticated_blocked(self, client):
        """Unauthenticated requests are rejected with 401."""
        res = client.get("/api/v1/incidents/me")
        assert res.status_code == 401
        data = res.get_json()
        assert data["code"] == "MISSING_TOKEN"

    # ─── 3. Multi-Criteria Filtering (Status, Category, Search, Date, Sort) ───
    def test_filter_and_search_my_reports(self, client, citizen_token):
        """Filter parameters are correctly passed to IncidentRepository."""
        filtered_list = [self.MOCK_USER_REPORTS[0]]
        with patch.object(IncidentRepository, "get_user_incidents", return_value=(filtered_list, 1)) as mock_repo:
            headers = {"Authorization": f"Bearer {citizen_token}"}
            res = client.get(
                "/api/v1/incidents/me?status=in_progress&category=Pothole&search=trench&date=week&sort=newest&limit=10&offset=0",
                headers=headers
            )
            assert res.status_code == 200
            data = res.get_json()
            assert data["count"] == 1
            assert data["data"][0]["category"] == "Pothole"

            mock_repo.assert_called_once_with(
                user_id="11111111-1111-1111-1111-111111111111",
                status="in_progress",
                category="Pothole",
                search="trench",
                date_filter="week",
                sort_by="newest",
                limit=10,
                offset=0
            )

    # ─── 4. Empty Reports State ───────────────────────────────────────────────
    def test_my_reports_empty_state(self, client, citizen_token):
        """Returns clean empty array when citizen has no submitted reports."""
        with patch.object(IncidentRepository, "get_user_incidents", return_value=([], 0)):
            headers = {"Authorization": f"Bearer {citizen_token}"}
            res = client.get("/api/v1/incidents/me", headers=headers)
            assert res.status_code == 200
            data = res.get_json()
            assert data["count"] == 0
            assert data["total"] == 0
            assert data["data"] == []

    # ─── 5. Incident Detail Ownership Validation ──────────────────────────────
    def test_get_my_incident_detail_owner_success(self, client, citizen_token):
        """Owner can view their own report detail including history and proof."""
        mock_detail = dict(self.MOCK_USER_REPORTS[1])
        mock_detail["media"] = [
            {"id": "m1", "media_url": "https://storage.supabase.co/light1.jpg", "media_type": "image"}
        ]
        mock_detail["status_history"] = [
            {"old_status": "reported", "new_status": "assigned", "notes": "Dispatched to Ward 1 Electric", "created_at": "2026-10-26T10:00:00Z"},
            {"old_status": "assigned", "new_status": "in_progress", "notes": "Bucket truck on site", "created_at": "2026-10-27T09:00:00Z"},
            {"old_status": "in_progress", "new_status": "resolved", "notes": "LED module replaced", "proof_media_url": "https://storage.supabase.co/proof_light.jpg", "created_at": "2026-10-28T16:00:00Z"}
        ]

        with patch.object(IncidentRepository, "get_user_incident_detail", return_value=(mock_detail, None)):
            headers = {"Authorization": f"Bearer {citizen_token}"}
            res = client.get(f"/api/v1/incidents/me/{mock_detail['id']}", headers=headers)
            assert res.status_code == 200
            data = res.get_json()
            assert data["status"] == "Success"
            item = data["data"]
            assert item["id"] == mock_detail["id"]
            assert len(item["status_history"]) == 3
            assert item["status_history"][2]["new_status"] == "resolved"
            assert item["status_history"][2]["proof_media_url"] is not None

    def test_get_my_incident_detail_forbidden_for_other_user_report(self, client, citizen_token):
        """Returns 403 Forbidden when citizen attempts to access another citizen's private report."""
        with patch.object(IncidentRepository, "get_user_incident_detail", return_value=(None, "FORBIDDEN")):
            headers = {"Authorization": f"Bearer {citizen_token}"}
            res = client.get("/api/v1/incidents/me/other-users-uuid-999", headers=headers)
            assert res.status_code == 403
            data = res.get_json()
            assert data["error"] == "Forbidden"
            assert "not authorized" in data["message"].lower()

    def test_get_my_incident_detail_not_found(self, client, citizen_token):
        """Returns 404 when incident ID does not exist."""
        with patch.object(IncidentRepository, "get_user_incident_detail", return_value=(None, "NOT_FOUND")):
            headers = {"Authorization": f"Bearer {citizen_token}"}
            res = client.get("/api/v1/incidents/me/non-existent-uuid", headers=headers)
            assert res.status_code == 404
            data = res.get_json()
            assert data["error"] == "Not Found"

    # ─── 6. Personal In-App Notifications API ─────────────────────────────────
    def test_get_my_notifications_success(self, client, citizen_token):
        """Citizen retrieves real in-app notification records."""
        mock_notifications = [
            {
                "id": "notif-001",
                "incident_id": "11111111-2222-3333-4444-555555555555",
                "title": "Update on your Pothole report",
                "body": "Your report #11111111 status is now 'in_progress'.",
                "type": "status_update",
                "is_read": False,
                "created_at": "2026-10-30T14:00:00Z"
            },
            {
                "id": "notif-002",
                "incident_id": "22222222-3333-4444-5555-666666666666",
                "title": "Update on your Streetlight report",
                "body": "Your report #22222222 status is now 'resolved'.",
                "type": "status_update",
                "is_read": True,
                "created_at": "2026-10-28T16:00:00Z"
            }
        ]

        with patch.object(NotificationRepository, "get_user_notifications", return_value=(mock_notifications, 2)):
            headers = {"Authorization": f"Bearer {citizen_token}"}
            res = client.get("/api/v1/notifications/me", headers=headers)
            assert res.status_code == 200
            data = res.get_json()
            assert data["status"] == "Success"
            assert data["count"] == 2
            assert data["total"] == 2
            assert len(data["data"]) == 2
            assert data["data"][0]["title"] == "Update on your Pothole report"
            assert data["data"][0]["is_read"] is False

    def test_mark_notification_as_read(self, client, citizen_token):
        """Citizen can mark their notification as read."""
        with patch.object(NotificationRepository, "mark_notification_as_read", return_value=True):
            headers = {"Authorization": f"Bearer {citizen_token}"}
            res = client.patch("/api/v1/notifications/notif-001/read", headers=headers)
            assert res.status_code == 200
            data = res.get_json()
            assert data["status"] == "Success"

    def test_mark_notification_not_found(self, client, citizen_token):
        """Returns 404 when notification ID is not found or not owned by user."""
        with patch.object(NotificationRepository, "mark_notification_as_read", return_value=False):
            headers = {"Authorization": f"Bearer {citizen_token}"}
            res = client.patch("/api/v1/notifications/not-found-id/read", headers=headers)
            assert res.status_code == 404

