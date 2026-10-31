import io
import json
import pytest
from unittest.mock import patch, MagicMock
from app.repositories.user_repo import UserRepository
from app.repositories.incident_repo import IncidentRepository

class TestCitizenProfileAndReporting:
    """Comprehensive tests for Phase 5A: Citizen Profile & Incident Reporting."""

    # ─── 1. Citizen Profile Retrieval ──────────────────────────────────────────
    def test_get_profile_authenticated(self, client, citizen_token):
        """Authenticated citizen can retrieve their full profile details."""
        mock_profile = {
            "id": "citizen-123",
            "role": "citizen",
            "full_name": "Ramesh Kumar",
            "email": "ramesh@nagarwatch.in",
            "phone_number": "+919876543210",
            "avatar_url": "https://storage.supabase.co/avatars/ramesh.jpg",
            "reputation_score": 15,
            "is_verified": True,
            "primary_ward_id": 4,
            "primary_ward_name": "Indiranagar",
            "created_at": "2026-10-15T10:00:00Z"
        }

        with patch.object(UserRepository, "get_profile_by_id", return_value=mock_profile):
            headers = {"Authorization": f"Bearer {citizen_token}"}
            res = client.get("/api/v1/users/me", headers=headers)
            assert res.status_code == 200
            data = res.get_json()
            assert data["status"] == "Success"
            profile = data["data"]
            assert profile["full_name"] == "Ramesh Kumar"
            assert profile["phone_number"] == "+919876543210"
            assert profile["role"] == "citizen"
            assert profile["is_verified"] is True
            assert profile["primary_ward_name"] == "Indiranagar"

    # ─── 2. Missing Profile Safe Auto-Provisioning ─────────────────────────────
    def test_missing_profile_auto_provisioning(self, client, citizen_token):
        """When profile record is missing, it is safely auto-provisioned as citizen."""
        with patch.object(UserRepository, "get_profile_by_id", return_value=None), \
             patch.object(UserRepository, "ensure_profile_exists", return_value={
                 "id": "citizen-123",
                 "role": "citizen",
                 "full_name": "Citizen",
                 "email": "citizen@example.com",
                 "phone_number": None,
                 "reputation_score": 0,
                 "is_verified": False
             }):
            headers = {"Authorization": f"Bearer {citizen_token}"}
            res = client.get("/api/v1/users/me", headers=headers)
            assert res.status_code == 200
            data = res.get_json()
            assert data["data"]["role"] == "citizen"

    # ─── 3. Profile Update Permitted Fields ────────────────────────────────────
    def test_update_profile_permitted_fields(self, client, citizen_token):
        """Citizen can update permitted fields: full_name and phone_number."""
        updated_data = {
            "id": "citizen-123",
            "role": "citizen",
            "full_name": "Ramesh K. Updated",
            "phone_number": "+919876543211",
            "avatar_url": "https://storage.supabase.co/avatars/new.jpg",
            "reputation_score": 15,
            "is_verified": True
        }

        with patch.object(UserRepository, "update_citizen_profile", return_value=updated_data):
            headers = {"Authorization": f"Bearer {citizen_token}", "Content-Type": "application/json"}
            payload = {
                "full_name": "Ramesh K. Updated",
                "phone_number": "+919876543211"
            }
            res = client.patch("/api/v1/users/me", headers=headers, json=payload)
            assert res.status_code == 200
            data = res.get_json()
            assert data["status"] == "Success"
            assert data["data"]["full_name"] == "Ramesh K. Updated"
            assert data["data"]["phone_number"] == "+919876543211"

    # ─── 4. Role Escalation Prevention ─────────────────────────────────────────
    def test_role_escalation_forbidden(self, client, citizen_token):
        """Citizen cannot modify their role (attempting admin escalation returns 403)."""
        headers = {"Authorization": f"Bearer {citizen_token}", "Content-Type": "application/json"}
        payload = {"role": "admin"}
        res = client.patch("/api/v1/users/me", headers=headers, json=payload)
        assert res.status_code == 403
        data = res.get_json()
        assert "Role modifications cannot be performed" in data["message"]

    # ─── 5. Reputation & Verification Tampering Blocked ───────────────────────
    def test_administrative_fields_tampering_blocked(self, client, citizen_token):
        """Tampering with reputation_score or is_verified returns 403 Forbidden."""
        headers = {"Authorization": f"Bearer {citizen_token}", "Content-Type": "application/json"}
        res = client.patch("/api/v1/users/me", headers=headers, json={"reputation_score": 999})
        assert res.status_code == 403

        res_ver = client.patch("/api/v1/users/me", headers=headers, json={"is_verified": True})
        assert res_ver.status_code == 403

    # ─── 6. Phone Number Format Validation ────────────────────────────────────
    def test_invalid_phone_number_validation(self, client, citizen_token):
        """Invalid phone numbers are rejected with 400 Validation Error."""
        headers = {"Authorization": f"Bearer {citizen_token}", "Content-Type": "application/json"}
        res = client.patch("/api/v1/users/me", headers=headers, json={"phone_number": "not-a-number"})
        assert res.status_code == 400
        assert "Validation Error" in res.get_json()["error"]

    # ─── 7. Full Name Length Validation ───────────────────────────────────────
    def test_invalid_name_length_validation(self, client, citizen_token):
        """Names that are too short (<2 chars) are rejected with 400."""
        headers = {"Authorization": f"Bearer {citizen_token}", "Content-Type": "application/json"}
        res = client.patch("/api/v1/users/me", headers=headers, json={"full_name": "A"})
        assert res.status_code == 400

    # ─── 8. Avatar Upload Validation & Processing ─────────────────────────────
    def test_avatar_upload_success(self, client, citizen_token):
        """Valid avatar image uploads successfully and updates profile avatar_url."""
        fake_avatar = (io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 100), "avatar.jpg")
        with patch("app.api.v1.users.upload_image_to_supabase", return_value="https://storage.supabase.co/avatars/new.jpg"), \
             patch.object(UserRepository, "update_citizen_profile", return_value={}):
            headers = {"Authorization": f"Bearer {citizen_token}"}
            res = client.post("/api/v1/users/me/avatar", headers=headers, data={"avatar": fake_avatar})
            assert res.status_code == 200
            assert res.get_json()["avatar_url"] == "https://storage.supabase.co/avatars/new.jpg"

    # ─── 9. Valid Incident Report Submission ──────────────────────────────────
    def test_valid_incident_report_submission(self, client, citizen_token):
        """Submitting a valid incident report creates record and returns 201."""
        fake_img = (io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 200), "pothole.jpg")
        with patch("app.api.v1.incidents.extract_gps_from_image", return_value=None), \
             patch.object(IncidentRepository, "check_duplicate", return_value=None), \
             patch.object(IncidentRepository, "find_ward_by_coordinates", return_value=(2, "Ward 2 South")), \
             patch("app.api.v1.incidents.upload_image_to_supabase", return_value="https://storage.supabase.co/pothole.jpg"), \
             patch.object(IncidentRepository, "create_incident", return_value={"id": "inc-new-777", "status": "reported"}):

            headers = {"Authorization": f"Bearer {citizen_token}"}
            res = client.post(
                "/api/v1/report",
                headers=headers,
                data={
                    "image": fake_img,
                    "category": "Road damage",  # Tests synonym normalization
                    "description": "Large dangerous pothole near junction",
                    "severity": "high",
                    "latitude": "12.9716",
                    "longitude": "77.5946"
                }
            )
            assert res.status_code == 201
            data = res.get_json()
            assert data["status"] == "Success"
            assert data["incident_id"] == "inc-new-777"
            assert data["category"] == "Pothole"
            assert data["routed_to_ward"] == "Ward 2 South"

    # ─── 10. Missing Category Validation ──────────────────────────────────────
    def test_missing_category_rejected(self, client):
        """Submitting a report without a category returns 400 Validation Error."""
        fake_img = (io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 200), "pothole.jpg")
        res = client.post(
            "/api/v1/report",
            data={
                "image": fake_img,
                "category": "",
                "description": "Valid description",
                "latitude": "12.9",
                "longitude": "77.5"
            }
        )
        assert res.status_code == 400
        assert "category is required" in res.get_json()["message"].lower()

    # ─── 11. Missing Location Validation ──────────────────────────────────────
    def test_missing_location_rejected(self, client):
        """Submitting an image with no EXIF GPS and no form coordinates returns 400."""
        fake_img = (io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 200), "pothole.jpg")
        with patch("app.api.v1.incidents.extract_gps_from_image", return_value=None):
            res = client.post(
                "/api/v1/report",
                data={
                    "image": fake_img,
                    "category": "Garbage",
                    "description": "Uncollected garbage piles"
                }
            )
            assert res.status_code == 400
            assert "location" in str(res.get_json()).lower()

    # ─── 12. Invalid Coordinates Validation ───────────────────────────────────
    def test_invalid_coordinates_rejected(self, client):
        """Coordinates outside valid [-90, 90] and [-180, 180] are rejected with 400."""
        fake_img = (io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 200), "pothole.jpg")
        with patch("app.api.v1.incidents.extract_gps_from_image", return_value=None):
            res = client.post(
                "/api/v1/report",
                data={
                    "image": fake_img,
                    "category": "Pothole",
                    "description": "Valid description",
                    "latitude": "195.0",  # Out of bounds
                    "longitude": "77.5"
                }
            )
            assert res.status_code == 400
            assert "between -90 and 90" in res.get_json()["reason"]

    # ─── 13. Invalid Image File Format ────────────────────────────────────────
    def test_invalid_image_type_rejected(self, client):
        """Non-image files are rejected with 400."""
        fake_doc = (io.BytesIO(b"%PDF-1.4..."), "document.pdf")
        res = client.post(
            "/api/v1/report",
            data={
                "image": fake_doc,
                "category": "Pothole",
                "description": "Valid description",
                "latitude": "12.9",
                "longitude": "77.5"
            }
        )
        assert res.status_code == 400
        assert "Invalid file format" in res.get_json()["error"]

    # ─── 14. Oversized Image File ─────────────────────────────────────────────
    def test_oversized_image_rejected(self, client):
        """Files exceeding MAX_CONTENT_LENGTH return 413."""
        with patch("app.core.config.config.MAX_CONTENT_LENGTH", 1024):
            huge_img = (io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 2000), "huge.jpg")
            res = client.post(
                "/api/v1/report",
                data={
                    "image": huge_img,
                    "category": "Pothole",
                    "description": "Valid description",
                    "latitude": "12.9",
                    "longitude": "77.5"
                }
            )
            assert res.status_code == 413

    # ─── 15. Upload Failure Handling Without Record Creation ──────────────────
    def test_storage_upload_failure_handles_cleanly(self, client):
        """If storage upload throws an error, returns 502 without creating broken incident."""
        fake_img = (io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 200), "pothole.jpg")
        with patch("app.api.v1.incidents.extract_gps_from_image", return_value=(12.9, 77.5)), \
             patch.object(IncidentRepository, "check_duplicate", return_value=None), \
             patch.object(IncidentRepository, "find_ward_by_coordinates", return_value=(1, "Ward 1")), \
             patch("app.api.v1.incidents.upload_image_to_supabase", side_effect=Exception("Storage Connection Timeout")), \
             patch.object(IncidentRepository, "create_incident") as mock_create:

            res = client.post(
                "/api/v1/report",
                data={
                    "image": fake_img,
                    "category": "Pothole",
                    "description": "Valid description"
                }
            )
            assert res.status_code == 502
            assert res.get_json()["error"] == "Upload Error"
            # Ensure database record was NOT created
            mock_create.assert_not_called()

    # ─── 16. Duplicate Incident Detection (409) ───────────────────────────────
    def test_duplicate_incident_detection_response(self, client):
        """When an active incident of the same category is within 20m, returns 409."""
        fake_img = (io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 200), "pothole.jpg")
        existing = {
            "id": "existing-uuid-99",
            "category": "Pothole",
            "description": "Earlier pothole report",
            "status": "reported",
            "primary_image_url": "https://storage.supabase.co/existing.jpg",
            "created_at": None,
            "latitude": 12.9,
            "longitude": 77.5,
            "ward_id": 1
        }
        with patch("app.api.v1.incidents.extract_gps_from_image", return_value=(12.9, 77.5)), \
             patch.object(IncidentRepository, "check_duplicate", return_value=existing):

            res = client.post(
                "/api/v1/report",
                data={
                    "image": fake_img,
                    "category": "Pothole",
                    "description": "Same pothole spotted",
                    "force_new": "false"
                }
            )
            assert res.status_code == 409
            data = res.get_json()
            assert data["status"] == "Duplicate"
            assert data["duplicate"] is True
            assert data["existing_issue"]["id"] == "existing-uuid-99"

    # ─── 17. Duplicate Override with force_new ────────────────────────────────
    def test_duplicate_override_creates_new_incident(self, client):
        """When force_new=true, bypasses duplicate check and creates new report."""
        fake_img = (io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 200), "pothole.jpg")
        with patch("app.api.v1.incidents.extract_gps_from_image", return_value=(12.9, 77.5)), \
             patch.object(IncidentRepository, "find_ward_by_coordinates", return_value=(1, "Ward 1")), \
             patch("app.api.v1.incidents.upload_image_to_supabase", return_value="https://storage.supabase.co/new.jpg"), \
             patch.object(IncidentRepository, "create_incident", return_value={"id": "inc-forced-1", "status": "reported"}):

            res = client.post(
                "/api/v1/report",
                data={
                    "image": fake_img,
                    "category": "Pothole",
                    "description": "Distinct pothole across street",
                    "force_new": "true"
                }
            )
            assert res.status_code == 201
            assert res.get_json()["incident_id"] == "inc-forced-1"

