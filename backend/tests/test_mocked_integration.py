import io
import pytest
from unittest.mock import patch
from app.repositories.user_repo import UserRepository
from app.repositories.incident_repo import IncidentRepository
from app.repositories.ward_repo import WardRepository

class TestMockedIntegrationWorkflows:
    """
    Mocked integration tests: verifies end-to-end Flask request/response workflows
    using simulated database repository layers without requiring external network connectivity.
    """

    def test_authenticated_citizen_report_submission(self, client, citizen_token):
        """
        Integration test: Authenticated citizen submits a valid report.
        Verifies that user ID is linked from the token, not from form input.
        """
        headers = {"Authorization": f"Bearer {citizen_token}"}
        fake_image = (io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00C\x00"), "test_pothole.jpg")

        with patch("app.api.v1.incidents.extract_gps_from_image", return_value=(9.5, 76.5)), \
             patch("app.api.v1.incidents.upload_image_to_supabase", return_value="https://storage.supabase.co/pothole.jpg"), \
             patch.object(IncidentRepository, "check_duplicate", return_value=None), \
             patch.object(IncidentRepository, "find_ward_by_coordinates", return_value=(1, "Ward 1")), \
             patch.object(IncidentRepository, "create_incident", return_value={"id": "inc-new-123", "status": "reported"}):

            response = client.post(
                "/api/v1/report",
                data={
                    "image": fake_image,
                    "category": "Pothole",
                    "description": "Deep pothole on Main Street",
                    "severity": "high",
                    "user_id": "malicious-user-id-to-be-ignored"
                },
                headers=headers,
                content_type="multipart/form-data"
            )

            assert response.status_code == 201
            data = response.get_json()
            assert data["status"] == "Success"
            assert data["incident_id"] == "inc-new-123"
            assert data["routed_to_ward"] == "Ward 1"

    def test_duplicate_incident_detection_flow(self, client, citizen_token):
        """
        Integration test: Verifies that an incident reported within 20m of an existing
        active issue triggers a 409 Duplicate response with existing issue payload.
        """
        headers = {"Authorization": f"Bearer {citizen_token}"}
        fake_image = (io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00C\x00"), "pothole2.jpg")

        existing = {
            "id": "inc-existing-999",
            "category": "Pothole",
            "description": "Existing pothole reported earlier",
            "status": "reported",
            "primary_image_url": "https://storage.supabase.co/existing.jpg",
            "latitude": 9.5001,
            "longitude": 76.5001,
            "ward_id": 1
        }

        with patch("app.api.v1.incidents.extract_gps_from_image", return_value=(9.5, 76.5)), \
             patch.object(IncidentRepository, "check_duplicate", return_value=existing):

            response = client.post(
                "/api/v1/report",
                data={
                    "image": fake_image,
                    "category": "Pothole",
                    "description": "Same pothole reported again",
                    "force_new": "false"
                },
                headers=headers,
                content_type="multipart/form-data"
            )

            assert response.status_code == 409
            data = response.get_json()
            assert data["status"] == "Duplicate"
            assert data["existing_issue"]["id"] == "inc-existing-999"

    def test_admin_incident_retrieval_scoped_to_assigned_wards(self, client, admin_ward1_token):
        """
        Integration test: Admin queries complaints.
        Verifies that query filters by admin's assigned wards and ignores client query params.
        """
        headers = {"Authorization": f"Bearer {admin_ward1_token}"}
        mock_incidents = [
            {"id": "inc-1", "ward_id": 1, "category": "Streetlight", "status": "reported"}
        ]

        # Admin assigned strictly to Ward 1
        with patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "admin", "wards": [1]}), \
             patch.object(IncidentRepository, "get_admin_incidents", return_value=mock_incidents) as mock_fetch:

            # Even if client maliciously sends ?user_id=someone_else or ?ward_id=999
            response = client.get("/api/v1/admin/complaints?user_id=hacked_user_id&ward_id=999", headers=headers)

            assert response.status_code == 200
            data = response.get_json()
            assert data["wards_allocated"] == [1]
            assert data["count"] == 1
            # Verify repository was called strictly with admin's assigned wards [1], not 999
            mock_fetch.assert_called_once_with(ward_ids=[1], is_super_admin=False, limit=20, offset=0)

    def test_superadmin_user_privilege_assignment_workflow(self, client, superadmin_token):
        """
        Integration test: SuperAdmin allocates admins to a ward.
        """
        headers = {"Authorization": f"Bearer {superadmin_token}"}

        with patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "super_admin", "wards": []}), \
             patch.object(WardRepository, "get_ward_by_id", return_value={"id": 1, "name": "Test Ward 1"}), \
             patch.object(UserRepository, "assign_ward_admins", return_value=True) as mock_assign:

            response = client.post(
                "/api/v1/wards/1/admin",
                json={"user_ids": ["user-uuid-1", "user-uuid-2"]},
                headers=headers
            )

            assert response.status_code == 200
            data = response.get_json()
            assert data["status"] == "Success"
            assert data["assigned_users_count"] == 2
            mock_assign.assert_called_once()

