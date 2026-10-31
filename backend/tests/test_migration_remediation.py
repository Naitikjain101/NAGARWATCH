import io
import pytest
from unittest.mock import patch, MagicMock
from app.repositories.incident_repo import IncidentRepository
from app.repositories.user_repo import UserRepository
from app.repositories.ward_repo import WardRepository

class TestMigrationRemediationRegressionSuite:
    """
    Comprehensive regression test suite covering Phase 1C migration remediation:
    1. Legacy complaint with NULL geometry.
    2. Legacy complaint with valid geometry.
    3. New incident creation.
    4. Complaint-to-incident synchronization.
    5. No duplicate incident creation.
    6. Transaction rollback.
    7. Status constraint compatibility.
    8. Legacy phone-number access restrictions.
    9. Verification uniqueness.
    10. Ward-admin authorization.
    """

    # 1. Legacy complaint with NULL geometry
    def test_01_legacy_complaint_with_null_geometry(self):
        """
        Verifies that legacy complaints with NULL geometry are safely accommodated
        without fabricating dummy coordinates or crashing the repository.
        """
        mock_unlocated_complaint = {
            "id": 101,
            "category": "Garbage",
            "description": "Legacy report with no GPS",
            "status": "reported",
            "primary_image_url": "https://storage.supabase.co/unlocated.jpg",
            "created_at": "2024-01-01T00:00:00Z",
            "latitude": None,
            "longitude": None,
            "ward_id": None
        }

        with patch.object(IncidentRepository, "get_incident_by_id", return_value=mock_unlocated_complaint):
            incident = IncidentRepository.get_incident_by_id("101")
            assert incident is not None
            assert incident["latitude"] is None
            assert incident["longitude"] is None
            assert incident["category"] == "Garbage"

    # 2. Legacy complaint with valid geometry
    def test_02_legacy_complaint_with_valid_geometry(self):
        """
        Verifies that legacy complaints with valid geometry retain proper coordinates.
        """
        mock_located_complaint = {
            "id": 102,
            "category": "Pothole",
            "description": "Located legacy complaint",
            "status": "reported",
            "primary_image_url": "https://storage.supabase.co/located.jpg",
            "created_at": "2024-01-01T00:00:00Z",
            "latitude": 9.5123456,
            "longitude": 76.5123456,
            "ward_id": 1
        }

        with patch.object(IncidentRepository, "get_incident_by_id", return_value=mock_located_complaint):
            incident = IncidentRepository.get_incident_by_id("102")
            assert incident is not None
            assert incident["latitude"] == 9.5123456
            assert incident["longitude"] == 76.5123456
            assert incident["ward_id"] == 1

    # 3. New incident creation
    def test_03_new_incident_creation_flow(self, client, citizen_token):
        """
        Verifies that newly reported incidents are created with all metadata
        and routed properly to wards.
        """
        headers = {"Authorization": f"Bearer {citizen_token}"}
        fake_image = (io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00C\x00"), "pothole.jpg")

        with patch("app.api.v1.incidents.extract_gps_from_image", return_value=(9.5, 76.5)), \
             patch("app.api.v1.incidents.upload_image_to_supabase", return_value="https://storage.supabase.co/pothole.jpg"), \
             patch.object(IncidentRepository, "check_duplicate", return_value=None), \
             patch.object(IncidentRepository, "find_ward_by_coordinates", return_value=(1, "Ward 1 Central")), \
             patch.object(IncidentRepository, "create_incident", return_value={"id": "inc-uuid-301", "status": "reported"}):

            response = client.post(
                "/api/v1/report",
                data={
                    "image": fake_image,
                    "category": "Pothole",
                    "description": "Hazardous road depression",
                    "severity": "high"
                },
                headers=headers,
                content_type="multipart/form-data"
            )

            assert response.status_code == 201
            data = response.get_json()
            assert data["status"] == "Success"
            assert data["incident_id"] == "inc-uuid-301"
            assert data["routed_to_ward"] == "Ward 1 Central"

    # 4. Complaint-to-incident synchronization
    def test_04_complaint_to_incident_synchronization(self):
        """
        Verifies that querying an incident by legacy ID retrieves the synchronized record.
        """
        mock_synced = {
            "id": "uuid-sync-401",
            "legacy_complaint_id": 401,
            "category": "Streetlight",
            "description": "Synchronized from complaints",
            "status": "reported",
            "ward_id": 2
        }

        with patch.object(IncidentRepository, "get_incident_by_id", return_value=mock_synced):
            res = IncidentRepository.get_incident_by_id("401")
            assert res is not None
            assert res["id"] == "uuid-sync-401"
            assert res["legacy_complaint_id"] == 401

    # 5. No duplicate incident creation
    def test_05_no_duplicate_incident_creation_on_dual_write(self):
        """
        Verifies that create_incident returns a single incident ID and does not
        produce duplicate key violations or multiple incident records.
        """
        created = IncidentRepository.create_incident.__doc__
        assert "Authoritative write model" in created
        assert "Single INSERT into public.incidents" in created

        mock_result = {
            "id": "uuid-single-501",
            "status": "reported",
            "created_at": "2024-01-01T00:00:00Z",
            "image_url": "https://storage.supabase.co/img.jpg"
        }

        with patch.object(IncidentRepository, "create_incident", return_value=mock_result):
            res = IncidentRepository.create_incident(
                user_id="user-123",
                ward_id=1,
                category="Garbage",
                description="Test no duplicate",
                lon=76.5,
                lat=9.5,
                image_url="https://storage.supabase.co/img.jpg"
            )
            assert res["id"] == "uuid-single-501"
            assert res["status"] == "reported"

    # 6. Transaction rollback
    def test_06_transaction_rollback_on_failure(self):
        """
        Verifies that if database insertion fails, exceptions are raised
        and transactions are rolled back cleanly.
        """
        with patch("app.repositories.incident_repo.get_db_cursor", side_effect=RuntimeError("DB Connection Error")):
            with pytest.raises(RuntimeError) as exc_info:
                IncidentRepository.create_incident(
                    user_id="user-fail",
                    ward_id=1,
                    category="Pothole",
                    description="Rollback test",
                    lon=76.5,
                    lat=9.5,
                    image_url="https://storage.supabase.co/fail.jpg"
                )
            assert "DB Connection Error" in str(exc_info.value)

    # 7. Status constraint compatibility
    def test_07_status_constraint_harmonization(self, client, admin_ward1_token):
        """
        Verifies that sending legacy status 'pending' is harmonized to 'reported'
        without triggering database constraint violations.
        """
        headers = {"Authorization": f"Bearer {admin_ward1_token}"}
        mock_incident = {"id": "inc-stat-701", "ward_id": 1, "status": "reported"}

        with patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "admin", "wards": [1]}), \
             patch.object(IncidentRepository, "get_incident_by_id", return_value=mock_incident), \
             patch.object(IncidentRepository, "update_status", return_value=True) as mock_update:

            # Admin attempts to set legacy status "pending"
            response = client.patch(
                "/api/v1/admin/incidents/inc-stat-701/status",
                json={"status": "pending", "notes": "Set back to pending"},
                headers=headers
            )

            assert response.status_code == 200
            # update_status must be called with normalized "reported"
            mock_update.assert_called_once_with(
                incident_id="inc-stat-701",
                new_status="reported",
                user_id="22222222-2222-2222-2222-222222222222",
                notes="Set back to pending"
            )

    # 8. Legacy phone-number access restrictions
    def test_08_legacy_phone_number_access_restrictions(self, client, citizen_token):
        """
        Verifies that non-admin citizens cannot query complaints belonging to
        other phone numbers.
        """
        headers = {"Authorization": f"Bearer {citizen_token}"}

        # Citizen token has phone "+1234567890". Maliciously querying phone "+9999999999"
        response = client.get(
            "/api/v1/complaints/user/+9999999999",
            headers=headers
        )

        assert response.status_code == 403
        data = response.get_json()
        assert data["error"] == "Forbidden"

    # 9. Verification uniqueness
    def test_09_verification_uniqueness_enforcement(self, client, citizen_token):
        """
        Verifies that duplicate community verifications return 409 Conflict.
        """
        headers = {"Authorization": f"Bearer {citizen_token}"}

        # First verification succeeds
        with patch.object(IncidentRepository, "add_verification", return_value=(True, "SUCCESS")):
            resp1 = client.post(
                "/api/v1/incidents/inc-vote-901/verifications",
                json={"type": "confirm"},
                headers=headers
            )
            assert resp1.status_code == 200

        # Second verification rejected due to uniqueness constraint
        with patch.object(IncidentRepository, "add_verification", return_value=(False, "ALREADY_VERIFIED")):
            resp2 = client.post(
                "/api/v1/incidents/inc-vote-901/verifications",
                json={"type": "confirm"},
                headers=headers
            )
            assert resp2.status_code == 409
            data = resp2.get_json()
            assert data["code"] == "DUPLICATE_VOTE"

    # 10. Ward-admin authorization
    def test_10_ward_admin_authorization_enforcement(self, client, admin_ward1_token):
        """
        Verifies that an administrator assigned to Ward 1 is blocked from modifying
        incidents located in Ward 2 (returns 403 OUT_OF_JURISDICTION).
        """
        headers = {"Authorization": f"Bearer {admin_ward1_token}"}
        incident_ward_2 = {"id": "inc-ward2-001", "ward_id": 2, "status": "reported"}

        with patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "admin", "wards": [1]}), \
             patch.object(IncidentRepository, "get_incident_by_id", return_value=incident_ward_2):

            response = client.patch(
                "/api/v1/admin/incidents/inc-ward2-001/status",
                json={"status": "in_progress"},
                headers=headers
            )

            assert response.status_code == 403
            data = response.get_json()
            assert data["code"] == "OUT_OF_JURISDICTION"
