import pytest
from unittest.mock import patch, MagicMock
from app.repositories.user_repo import UserRepository
from app.repositories.ward_repo import WardRepository
from app.repositories.incident_repo import IncidentRepository

class TestSuperAdminApi:
    """Verifies RBAC and controller behavior for /api/v1/superadmin/* endpoints."""

    def test_unauthenticated_request_rejected(self, client):
        """Unauthenticated requests to superadmin endpoints return 401."""
        res = client.get("/api/v1/superadmin/overview")
        assert res.status_code == 401

    def test_citizen_forbidden(self, client, citizen_token):
        """Citizens receive 403 when attempting to access SuperAdmin control panel."""
        with patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "citizen", "wards": []}):
            headers = {"Authorization": f"Bearer {citizen_token}"}
            res = client.get("/api/v1/superadmin/overview", headers=headers)
            assert res.status_code == 403

    def test_ward_admin_forbidden(self, client, admin_ward1_token):
        """Ward administrators receive 403 when attempting to access SuperAdmin endpoints."""
        with patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "admin", "wards": [1]}):
            headers = {"Authorization": f"Bearer {admin_ward1_token}"}
            res = client.get("/api/v1/superadmin/overview", headers=headers)
            assert res.status_code == 403

    @patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "super_admin", "wards": []})
    @patch.object(UserRepository, "get_user_statistics")
    @patch.object(IncidentRepository, "get_platform_incident_statistics")
    @patch.object(WardRepository, "list_wards")
    @patch.object(IncidentRepository, "get_admin_incidents")
    @patch.object(UserRepository, "get_users_detailed")
    def test_superadmin_overview_success(
        self, mock_users, mock_incidents, mock_wards, mock_inc_stats, mock_user_stats, mock_role, client, superadmin_token
    ):
        """Super administrator receives comprehensive platform metrics."""
        mock_user_stats.return_value = {
            "total_users": 100, "total_citizens": 95, "total_admins": 4, "total_superadmins": 1
        }
        mock_inc_stats.return_value = {
            "total_incidents": 50, "reported": 10, "verified": 5, "in_progress": 15, "resolved": 20, "rejected": 0
        }
        mock_wards.return_value = [{"id": 1, "name": "Ward 1"}]
        mock_incidents.return_value = []
        mock_users.return_value = [
            {"id": "u-1", "full_name": "Test Citizen", "email": "tc@example.com", "phone_number": "9876543210", "role": "citizen"}
        ]

        headers = {"Authorization": f"Bearer {superadmin_token}"}
        res = client.get("/api/v1/superadmin/overview", headers=headers)
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert data["users"]["total_users"] == 100
        assert data["incidents"]["total_incidents"] == 50
        assert data["total_wards"] == 1
        # Phone masking check
        assert data["recent_users"][0]["phone"] == "987****3210"

    @patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "super_admin", "wards": []})
    @patch.object(WardRepository, "check_boundary_overlap")
    @patch.object(WardRepository, "create_ward")
    def test_create_ward_success_and_conflict(
        self, mock_create, mock_overlap, mock_role, client, superadmin_token
    ):
        """Verifies ward creation and boundary collision detection."""
        headers = {"Authorization": f"Bearer {superadmin_token}"}

        # Case 1: Overlapping conflict
        mock_overlap.return_value = ["Ward 1 - Central"]
        res = client.post(
            "/api/v1/superadmin/wards",
            json={"name": "New Ward", "geom_wkt": "POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))"},
            headers=headers
        )
        assert res.status_code == 409
        assert "Ward 1 - Central" in res.get_json()["conflicts"]

        # Case 2: Clean creation
        mock_overlap.return_value = []
        mock_create.return_value = 42
        res2 = client.post(
            "/api/v1/superadmin/wards",
            json={"name": "Clean Ward", "geom_wkt": "POLYGON((2 2, 3 2, 3 3, 2 3, 2 2))"},
            headers=headers
        )
        assert res2.status_code == 201
        assert res2.get_json()["ward_id"] == 42

    @patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "super_admin", "wards": []})
    @patch.object(UserRepository, "get_user_statistics")
    @patch.object(UserRepository, "update_user_role")
    def test_demote_sole_superadmin_safeguard(
        self, mock_update, mock_stats, mock_role, client, superadmin_token
    ):
        """Prevents demoting the platform's sole Super Administrator."""
        mock_stats.return_value = {"total_superadmins": 1}

        headers = {"Authorization": f"Bearer {superadmin_token}"}
        res = client.post(
            "/api/v1/superadmin/admins/role",
            json={"user_id": "33333333-3333-3333-3333-333333333333", "role": "admin"},
            headers=headers
        )
        assert res.status_code == 400
        assert "Cannot demote the sole Super Administrator" in res.get_json()["error"]
        mock_update.assert_not_called()

    @patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "super_admin", "wards": []})
    @patch.object(UserRepository, "get_users_detailed")
    def test_list_users_masks_pii(self, mock_users, mock_role, client, superadmin_token):
        """User directory query preserves citizen privacy with masked phone numbers."""
        mock_users.return_value = [
            {"id": "u-9", "full_name": "Priya", "email": "p@test.in", "phone_number": "9123456789", "role": "citizen"}
        ]
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        res = client.get("/api/v1/superadmin/users?role=citizen", headers=headers)
        assert res.status_code == 200
        users = res.get_json()["data"]
        assert len(users) == 1
        assert users[0]["phone"] == "912****6789"
        assert "9123456789" not in str(res.get_json())

    @patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "super_admin", "wards": []})
    @patch.object(IncidentRepository, "get_incident_audit_logs")
    def test_get_audit_logs(self, mock_audit, mock_role, client, superadmin_token):
        """Retrieves status transition logs from immutable update records."""
        mock_audit.return_value = [
            {"id": 1, "incident_id": "inc-1", "old_status": "reported", "new_status": "verified", "notes": "Inspected"}
        ]
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        res = client.get("/api/v1/superadmin/audit", headers=headers)
        assert res.status_code == 200
        logs = res.get_json()["data"]
        assert len(logs) == 1
        assert logs[0]["old_status"] == "reported"
        assert logs[0]["new_status"] == "verified"
