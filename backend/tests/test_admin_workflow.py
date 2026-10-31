import pytest
import io
from unittest.mock import patch, MagicMock
from app.repositories.user_repo import UserRepository
from app.repositories.incident_repo import IncidentRepository

class TestAdminWorkflow:
    """Verifies complete ward administrator workflows and jurisdictional security."""

    def test_admin_cannot_modify_incident_outside_assigned_ward(self, client, admin_ward1_token):
        """Ward admin cannot update an incident assigned to another ward (403)."""
        headers = {"Authorization": f"Bearer {admin_ward1_token}"}
        foreign_incident = {"id": "inc-ward-2", "ward_id": 2, "status": "reported"}

        # Admin is assigned strictly to Ward 1
        with patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "admin", "wards": [1]}), \
             patch.object(IncidentRepository, "get_incident_by_id", return_value=foreign_incident), \
             patch.object(IncidentRepository, "update_status") as mock_update:

            res = client.patch(
                "/api/v1/admin/incidents/inc-ward-2/status",
                json={"status": "in_progress", "notes": "Unauthorized attempt"},
                headers=headers
            )
            assert res.status_code == 403
            assert res.get_json()["code"] == "OUT_OF_JURISDICTION"
            mock_update.assert_not_called()

    def test_admin_updates_incident_with_resolution_and_proof(self, client, admin_ward1_token):
        """Ward admin can resolve incident within assigned ward and attach proof."""
        headers = {"Authorization": f"Bearer {admin_ward1_token}"}
        my_incident = {"id": "inc-ward-1", "ward_id": 1, "status": "in_progress"}

        with patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "admin", "wards": [1]}), \
             patch.object(IncidentRepository, "get_incident_by_id", return_value=my_incident), \
             patch.object(IncidentRepository, "update_status", return_value=True) as mock_update:

            res = client.patch(
                "/api/v1/admin/incidents/inc-ward-1/status",
                json={
                    "status": "resolved",
                    "notes": "Pothole filled with asphalt. Inspected by crew.",
                    "proof_media_url": "https://storage.supabase.co/proof-001.jpg"
                },
                headers=headers
            )
            assert res.status_code == 200
            assert res.get_json()["status"] == "Success"
            mock_update.assert_called_once_with(
                incident_id="inc-ward-1",
                new_status="resolved",
                user_id="22222222-2222-2222-2222-222222222222",
                notes="Pothole filled with asphalt. Inspected by crew.",
                proof_media_url="https://storage.supabase.co/proof-001.jpg"
            )

    def test_admin_upload_proof_jurisdiction_check(self, client, admin_ward1_token):
        """Uploading resolution proof to incident outside jurisdiction returns 403."""
        headers = {"Authorization": f"Bearer {admin_ward1_token}"}
        foreign_incident = {"id": "inc-foreign-9", "ward_id": 9, "status": "in_progress"}

        with patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "admin", "wards": [1]}), \
             patch.object(IncidentRepository, "get_incident_by_id", return_value=foreign_incident):

            fake_file = (io.BytesIO(b"fake-bytes"), "proof.jpg")
            res = client.post(
                "/api/v1/admin/incidents/inc-foreign-9/proof",
                data={"image": fake_file},
                headers=headers,
                content_type="multipart/form-data"
            )
            assert res.status_code == 403
            assert res.get_json()["code"] == "OUT_OF_JURISDICTION"

    def test_citizen_cannot_access_admin_proof_endpoint(self, client, citizen_token):
        """Citizen cannot call admin proof upload endpoint (403)."""
        headers = {"Authorization": f"Bearer {citizen_token}"}
        fake_file = (io.BytesIO(b"fake-bytes"), "proof.jpg")

        with patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "citizen", "wards": []}):
            res = client.post(
                "/api/v1/admin/incidents/inc-1/proof",
                data={"image": fake_file},
                headers=headers,
                content_type="multipart/form-data"
            )
            assert res.status_code == 403

    def test_file_format_validation_on_incident_report(self, client, citizen_token):
        """Report endpoint rejects unsupported file extensions like .exe or .pdf."""
        headers = {"Authorization": f"Bearer {citizen_token}"}
        bad_file = (io.BytesIO(b"malicious-payload"), "exploit.exe")

        res = client.post(
            "/api/v1/report",
            data={
                "image": bad_file,
                "category": "Pothole",
                "description": "Test bad file",
                "latitude": "9.5",
                "longitude": "76.5"
            },
            headers=headers,
            content_type="multipart/form-data"
        )
        assert res.status_code == 400
        assert "Invalid file format" in res.get_json()["error"]

