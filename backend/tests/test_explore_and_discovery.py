import json
import pytest
from unittest.mock import patch, MagicMock
from app.repositories.incident_repo import IncidentRepository

class TestExploreAndIncidentDiscovery:
    """Comprehensive test suite for Phase 5B: Live Incident Discovery & Explore APIs."""

    MOCK_PUBLIC_INCIDENTS = [
        {
            "id": "inc-001",
            "category": "Pothole",
            "description": "Hazardous road crater on MG Road near bus stop",
            "status": "in_progress",
            "severity": "high",
            "image_url": "https://storage.supabase.co/pothole.jpg",
            "created_at": "2026-10-30T10:00:00Z",
            "latitude": 9.591234,
            "longitude": 76.521234,
            "ward_id": 1,
            "ward_name": "Ward 1 - Central",
            "upvotes": 5,
            "disputes_count": 0,
            "distance_meters": 120.5
        },
        {
            "id": "inc-002",
            "category": "Streetlight",
            "description": "Broken bulb and dark corner near school crossing",
            "status": "reported",
            "severity": "medium",
            "image_url": "https://storage.supabase.co/streetlight.jpg",
            "created_at": "2026-10-30T11:30:00Z",
            "latitude": 9.593456,
            "longitude": 76.523456,
            "ward_id": 2,
            "ward_name": "Ward 2 - East",
            "upvotes": 2,
            "disputes_count": 0,
            "distance_meters": 450.0
        },
        {
            "id": "inc-003",
            "category": "Garbage",
            "description": "Commercial waste dumped on sidewalk",
            "status": "resolved",
            "severity": "low",
            "image_url": "https://storage.supabase.co/garbage.jpg",
            "created_at": "2026-10-29T14:00:00Z",
            "latitude": 9.595678,
            "longitude": 76.525678,
            "ward_id": 1,
            "ward_name": "Ward 1 - Central",
            "upvotes": 12,
            "disputes_count": 1,
            "resolution_notes": "Cleaned by sanitation truck #4",
            "resolved_at": "2026-10-30T16:00:00Z"
        }
    ]

    # ─── 1. Public Incidents Discovery Feed ────────────────────────────────────
    def test_list_public_incidents_success(self, client):
        """Public incident retrieval succeeds and returns sanitized records."""
        with patch.object(IncidentRepository, "get_public_incidents", return_value=(self.MOCK_PUBLIC_INCIDENTS, 3)):
            res = client.get("/api/v1/incidents")
            assert res.status_code == 200
            data = res.get_json()
            assert data["status"] == "Success"
            assert data["count"] == 3
            assert data["total"] == 3
            assert len(data["data"]) == 3
            assert data["data"][0]["category"] == "Pothole"

    # ─── 2. Strict PII Protection ─────────────────────────────────────────────
    def test_public_incidents_never_expose_reporter_pii(self, client):
        """Guarantees that public feeds never expose citizen phone, email, or user_id."""
        with patch.object(IncidentRepository, "get_public_incidents", return_value=(self.MOCK_PUBLIC_INCIDENTS, 3)):
            res = client.get("/api/v1/incidents")
            assert res.status_code == 200
            data = res.get_json()
            for inc in data["data"]:
                assert "phone" not in inc
                assert "phone_number" not in inc
                assert "email" not in inc
                assert "user_id" not in inc

    # ─── 3. Filtering by Category, Status, Severity, Ward ─────────────────────
    def test_filter_incidents_by_criteria(self, client):
        """Passes category, status, severity, and ward parameters to repository."""
        filtered_potholes = [self.MOCK_PUBLIC_INCIDENTS[0]]
        with patch.object(IncidentRepository, "get_public_incidents", return_value=(filtered_potholes, 1)) as mock_repo:
            res = client.get("/api/v1/incidents?category=Pothole&status=in_progress&severity=high&ward_id=1")
            assert res.status_code == 200
            data = res.get_json()
            assert data["count"] == 1
            assert data["data"][0]["category"] == "Pothole"
            assert data["data"][0]["status"] == "in_progress"

            mock_repo.assert_called_once_with(
                category="Pothole",
                status="in_progress",
                severity="high",
                ward_id=1,
                search=None,
                lat=None,
                lon=None,
                radius_meters=None,
                limit=20,
                offset=0
            )

    # ─── 4. Search Keyword Query ──────────────────────────────────────────────
    def test_search_incidents_by_keyword(self, client):
        """Searches across description and category with query string."""
        with patch.object(IncidentRepository, "get_public_incidents", return_value=([self.MOCK_PUBLIC_INCIDENTS[1]], 1)) as mock_repo:
            res = client.get("/api/v1/incidents?q=school")
            assert res.status_code == 200
            data = res.get_json()
            assert data["count"] == 1
            assert data["data"][0]["category"] == "Streetlight"

            mock_repo.assert_called_once_with(
                category=None,
                status=None,
                severity=None,
                ward_id=None,
                search="school",
                lat=None,
                lon=None,
                radius_meters=None,
                limit=20,
                offset=0
            )

    # ─── 5. Spatial Nearby Discovery with Radius ──────────────────────────────
    def test_spatial_nearby_discovery(self, client):
        """Queries nearby incidents with GPS coordinates and radius in meters."""
        with patch.object(IncidentRepository, "get_public_incidents", return_value=(self.MOCK_PUBLIC_INCIDENTS, 3)) as mock_repo:
            res = client.get("/api/v1/incidents?lat=9.591&lon=76.521&radius=10000")
            assert res.status_code == 200
            data = res.get_json()
            assert data["count"] == 3

            mock_repo.assert_called_once_with(
                category=None,
                status=None,
                severity=None,
                ward_id=None,
                search=None,
                lat=9.591,
                lon=76.521,
                radius_meters=10000.0,
                limit=20,
                offset=0
            )

    # ─── 6. Coordinate Boundary Validation ───────────────────────────────────
    def test_coordinate_boundary_validation(self, client):
        """Rejects latitude outside [-90, 90] or longitude outside [-180, 180]."""
        # Invalid latitude (> 90)
        res = client.get("/api/v1/incidents?lat=95.0&lon=76.0")
        assert res.status_code == 400
        assert "Validation Error" in res.get_json()["error"]

        # Invalid longitude (< -180)
        res = client.get("/api/v1/incidents?lat=9.0&lon=-195.0")
        assert res.status_code == 400

        # Non-numeric coordinate string
        res = client.get("/api/v1/incidents?lat=abc&lon=76.0")
        assert res.status_code == 400

    # ─── 7. Incident Detail View with Media & History ─────────────────────────
    def test_get_incident_detail_success(self, client):
        """Retrieves complete public incident detail including verified status timeline."""
        mock_detail = {
            "id": "inc-001",
            "category": "Pothole",
            "description": "Hazardous road crater on MG Road near bus stop",
            "status": "in_progress",
            "severity": "high",
            "image_url": "https://storage.supabase.co/pothole.jpg",
            "created_at": "2026-10-30T10:00:00Z",
            "latitude": 9.591234,
            "longitude": 76.521234,
            "ward_id": 1,
            "ward_name": "Ward 1 - Central",
            "confirmations_count": 5,
            "disputes_count": 0,
            "media": [
                {"id": "m-1", "media_url": "https://storage.supabase.co/pothole-angle1.jpg", "media_type": "image/jpeg"},
                {"id": "m-2", "media_url": "https://storage.supabase.co/pothole-angle2.jpg", "media_type": "image/jpeg"}
            ],
            "status_history": [
                {"old_status": "reported", "new_status": "verified", "notes": "Community verified by 3 citizens", "created_at": "2026-10-30T10:30:00Z"},
                {"old_status": "verified", "new_status": "in_progress", "notes": "Dispatched maintenance crew", "created_at": "2026-10-30T11:00:00Z"}
            ]
        }

        with patch.object(IncidentRepository, "get_public_incident_detail", return_value=mock_detail):
            res = client.get("/api/v1/incidents/inc-001")
            assert res.status_code == 200
            data = res.get_json()
            assert data["status"] == "Success"
            item = data["data"]
            assert item["id"] == "inc-001"
            assert len(item["media"]) == 2
            assert len(item["status_history"]) == 2
            assert item["confirmations_count"] == 5
            # Privacy verification
            assert "user_id" not in item
            assert "phone" not in item
            assert "email" not in item

    # ─── 8. Detail View Non-Existent Returns 404 ─────────────────────────────
    def test_get_incident_detail_not_found(self, client):
        """Returns 404 when incident ID does not exist."""
        with patch.object(IncidentRepository, "get_public_incident_detail", return_value=None), \
             patch.object(IncidentRepository, "get_incident_by_id", return_value=None):
            res = client.get("/api/v1/incidents/non-existent-uuid")
            assert res.status_code == 404
            assert res.get_json()["error"] == "Not Found"

    # ─── 9. Community Verification & Duplicate Prevention ─────────────────────
    def test_community_verification_authenticated(self, client, citizen_token):
        """Authenticated citizens can register verification on an incident."""
        with patch.object(IncidentRepository, "add_verification", return_value=(True, "OK")):
            headers = {"Authorization": f"Bearer {citizen_token}"}
            res = client.post("/api/v1/incidents/inc-001/verifications", headers=headers, json={"type": "confirm"})
            assert res.status_code == 200
            data = res.get_json()
            assert data["status"] == "Success"

    def test_community_verification_unauthenticated_blocked(self, client):
        """Unauthenticated requests cannot verify incidents."""
        res = client.post("/api/v1/incidents/inc-001/verifications", json={"type": "confirm"})
        assert res.status_code == 401

    def test_community_verification_duplicate_prevention(self, client, citizen_token):
        """Prevents duplicate verification votes from the same citizen user."""
        with patch.object(IncidentRepository, "add_verification", return_value=(False, "ALREADY_VERIFIED")):
            headers = {"Authorization": f"Bearer {citizen_token}"}
            res = client.post("/api/v1/incidents/inc-001/verifications", headers=headers, json={"type": "confirm"})
            assert res.status_code == 409
            data = res.get_json()
            assert data["code"] == "DUPLICATE_VOTE"

    # ─── 10. Legacy Ward Endpoint Fallback ────────────────────────────────────
    def test_ward_endpoint_coordinates_outside_registered_boundaries(self, client):
        """Gracefully falls back to nearby spatial query when coordinates are outside ward boundaries."""
        with patch.object(IncidentRepository, "find_ward_by_coordinates", return_value=None), \
             patch.object(IncidentRepository, "get_public_incidents", return_value=(self.MOCK_PUBLIC_INCIDENTS, 3)):
            res = client.get("/api/v1/complaints/ward?lat=9.59&lon=76.52")
            assert res.status_code == 200
            data = res.get_json()
            assert data["status"] == "Success"
            assert data["ward_name"] == "Nearby Neighbourhood"
            assert data["count"] == 3

