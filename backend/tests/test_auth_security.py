import pytest
from unittest.mock import patch
from app.core.security import create_test_token
from app.repositories.user_repo import UserRepository
from app.repositories.incident_repo import IncidentRepository
from app.repositories.ward_repo import WardRepository

class TestJwtAuthentication:
    """Unit tests verifying Supabase Bearer JWT token extraction and cryptographic validation."""

    def test_missing_token_rejected(self, client):
        """1. Missing token: Rejects requests without Authorization header with 401."""
        response = client.get("/api/v1/incidents/me")
        assert response.status_code == 401
        data = response.get_json()
        assert data["code"] == "MISSING_TOKEN"

    def test_invalid_signature_rejected(self, client):
        """2. Invalid signature: Rejects tokens signed with wrong cryptographic key."""
        wrong_secret_token = create_test_token(
            user_id="11111111-1111-1111-1111-111111111111",
            secret="completely-wrong-and-untrusted-secret-key-12345"
        )
        headers = {"Authorization": f"Bearer {wrong_secret_token}"}
        response = client.get("/api/v1/incidents/me", headers=headers)
        assert response.status_code == 401
        data = response.get_json()
        assert data["code"] in ("INVALID_SIGNATURE", "INVALID_TOKEN")

    def test_expired_token_rejected(self, client, expired_token):
        """3. Expired token: Rejects tokens where exp is in the past."""
        headers = {"Authorization": f"Bearer {expired_token}"}
        response = client.get("/api/v1/incidents/me", headers=headers)
        assert response.status_code == 401
        data = response.get_json()
        assert data["code"] == "TOKEN_EXPIRED"

    def test_incorrect_issuer_rejected(self, client, monkeypatch):
        """4. Incorrect issuer: Rejects tokens with mismatched iss claim."""
        from app.core.config import config
        monkeypatch.setattr(config, "SUPABASE_URL", "https://real-project.supabase.co")
        
        # Token claiming to be from an attacker's rogue issuer
        rogue_token = create_test_token(
            user_id="11111111-1111-1111-1111-111111111111",
            issuer="https://evil-attacker.supabase.co/auth/v1",
            secret=config.SUPABASE_JWT_SECRET
        )
        headers = {"Authorization": f"Bearer {rogue_token}"}
        response = client.get("/api/v1/incidents/me", headers=headers)
        assert response.status_code == 401
        data = response.get_json()
        assert data["code"] in ("INVALID_ISSUER", "INVALID_TOKEN")

    def test_incorrect_audience_rejected(self, client):
        """5. Incorrect audience: Rejects tokens where aud != 'authenticated'."""
        from app.core.config import config
        wrong_aud_token = create_test_token(
            user_id="11111111-1111-1111-1111-111111111111",
            audience="wrong_audience_service",
            secret=config.SUPABASE_JWT_SECRET
        )
        headers = {"Authorization": f"Bearer {wrong_aud_token}"}
        response = client.get("/api/v1/incidents/me", headers=headers)
        assert response.status_code == 401
        data = response.get_json()
        assert data["code"] in ("INVALID_AUDIENCE", "INVALID_TOKEN")

    def test_missing_subject_rejected(self, client):
        """6. Missing subject: Rejects tokens without sub claim."""
        from app.core.config import config
        no_sub_token = create_test_token(
            user_id="11111111-1111-1111-1111-111111111111",
            secret=config.SUPABASE_JWT_SECRET,
            include_sub=False
        )
        headers = {"Authorization": f"Bearer {no_sub_token}"}
        response = client.get("/api/v1/incidents/me", headers=headers)
        assert response.status_code == 401
        data = response.get_json()
        assert data["code"] in ("MISSING_SUBJECT", "INVALID_TOKEN")

    def test_unsupported_algorithm_rejected(self, client):
        """7. Unsupported algorithm: Rejects tokens specifying unconfigured algorithms."""
        from app.core.config import config
        hs512_token = create_test_token(
            user_id="11111111-1111-1111-1111-111111111111",
            algorithm="HS512",
            secret=config.SUPABASE_JWT_SECRET
        )
        headers = {"Authorization": f"Bearer {hs512_token}"}
        response = client.get("/api/v1/incidents/me", headers=headers)
        assert response.status_code == 401
        data = response.get_json()
        assert data["code"] == "UNSUPPORTED_ALGORITHM"

    def test_forged_unsigned_token_rejected(self, client):
        """8. Forged unsigned token: Rejects attack tokens with alg='none'."""
        unsigned_token = create_test_token(
            user_id="11111111-1111-1111-1111-111111111111",
            algorithm="none"
        )
        headers = {"Authorization": f"Bearer {unsigned_token}"}
        response = client.get("/api/v1/incidents/me", headers=headers)
        assert response.status_code == 401
        data = response.get_json()
        assert data["code"] == "UNSUPPORTED_ALGORITHM"

    def test_valid_token_with_supported_signing_configuration(self, client, citizen_token):
        """9. Valid token: Decodes and accepts tokens signed with supported configuration."""
        headers = {"Authorization": f"Bearer {citizen_token}"}
        with patch.object(IncidentRepository, "get_user_incidents", return_value=[]):
            response = client.get("/api/v1/incidents/me", headers=headers)
            assert response.status_code == 200
            data = response.get_json()
            assert data["status"] == "Success"

    def test_missing_production_configuration_fails_securely(self, client, citizen_token, monkeypatch):
        """
        10. Missing production configuration: When server lacks signing credentials,
        fails securely with 500 Server Configuration Error, NEVER unauthenticated access.
        """
        from app.core.config import config
        monkeypatch.setattr(config, "SUPABASE_JWT_SECRET", "")
        monkeypatch.setattr(config, "SUPABASE_URL", "")
        monkeypatch.setattr(config, "SUPABASE_KEY", "")

        headers = {"Authorization": f"Bearer {citizen_token}"}
        response = client.get("/api/v1/incidents/me", headers=headers)
        assert response.status_code == 500
        data = response.get_json()
        assert data["code"] == "SERVER_CONFIG_ERROR"
        assert "Server Configuration Error" in data["error"]


class TestRoleBasedAuthorization:
    """Unit tests verifying RBAC role guards: citizen, admin, super_admin."""

    def test_citizen_accessing_admin_complaints_blocked(self, client, citizen_token):
        """Verifies that ordinary citizens are forbidden from accessing admin complaint queues."""
        headers = {"Authorization": f"Bearer {citizen_token}"}
        # Citizen profile in DB has role 'citizen'
        with patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "citizen", "wards": []}):
            response = client.get("/api/v1/admin/complaints", headers=headers)
            assert response.status_code == 403
            data = response.get_json()
            assert data["code"] == "INSUFFICIENT_ROLE"

    def test_citizen_accessing_superadmin_users_blocked(self, client, citizen_token):
        """Verifies that ordinary citizens cannot access the superadmin user management directory."""
        headers = {"Authorization": f"Bearer {citizen_token}"}
        with patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "citizen", "wards": []}):
            response = client.get("/api/v1/admin/users", headers=headers)
            assert response.status_code == 403
            data = response.get_json()
            assert data["code"] == "INSUFFICIENT_ROLE"

    def test_citizen_creating_ward_boundary_blocked(self, client, citizen_token):
        """Verifies that ordinary citizens cannot create ward boundaries."""
        headers = {"Authorization": f"Bearer {citizen_token}"}
        with patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "citizen", "wards": []}):
            response = client.post("/api/v1/wards", json={"name": "Fake Ward", "geom_wkt": "POLYGON(...) "}, headers=headers)
            assert response.status_code == 403
            data = response.get_json()
            assert data["code"] == "INSUFFICIENT_ROLE"

    def test_admin_accessing_superadmin_apis_blocked(self, client, admin_ward1_token):
        """Verifies that ward administrators cannot perform super-admin operations (e.g. assigning admins)."""
        headers = {"Authorization": f"Bearer {admin_ward1_token}"}
        with patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "admin", "wards": [1]}):
            response = client.post("/api/v1/wards/1/admin", json={"user_ids": []}, headers=headers)
            assert response.status_code == 403
            data = response.get_json()
            assert data["code"] == "INSUFFICIENT_ROLE"

    def test_superadmin_access_granted(self, client, superadmin_token):
        """Verifies that super administrators have full access to admin queues and user listings."""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        with patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "super_admin", "wards": []}), \
             patch.object(IncidentRepository, "get_admin_incidents", return_value=[]), \
             patch.object(UserRepository, "list_users", return_value=[]):
            
            # 1. Admin complaints access
            res1 = client.get("/api/v1/admin/complaints", headers=headers)
            assert res1.status_code == 200

            # 2. SuperAdmin users listing
            res2 = client.get("/api/v1/admin/users", headers=headers)
            assert res2.status_code == 200


class TestWardJurisdictionAndIncidentUpdates:
    """Unit tests verifying ward-scoped jurisdiction controls."""

    def test_admin_cannot_update_incident_in_unassigned_ward(self, client, admin_ward1_token):
        """
        Verifies that an administrator assigned to Ward 1 CANNOT update an incident located in Ward 2.
        """
        headers = {"Authorization": f"Bearer {admin_ward1_token}"}
        # Admin has role 'admin' with assigned wards: [1]
        with patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "admin", "wards": [1]}), \
             patch.object(IncidentRepository, "get_incident_by_id", return_value={"id": "inc-222", "ward_id": 2, "status": "reported"}):
            
            # Attempt to update incident in Ward 2
            response = client.patch(
                "/api/v1/admin/complaints/inc-222/status",
                json={"status": "resolved"},
                headers=headers
            )
            assert response.status_code == 403
            data = response.get_json()
            assert data["code"] == "OUT_OF_JURISDICTION"

    def test_admin_can_update_incident_in_assigned_ward(self, client, admin_ward1_token):
        """
        Verifies that an administrator assigned to Ward 1 CAN update an incident located in Ward 1.
        """
        headers = {"Authorization": f"Bearer {admin_ward1_token}"}
        with patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "admin", "wards": [1]}), \
             patch.object(IncidentRepository, "get_incident_by_id", return_value={"id": "inc-111", "ward_id": 1, "status": "reported"}), \
             patch.object(IncidentRepository, "update_status", return_value=True):
            
            response = client.patch(
                "/api/v1/admin/complaints/inc-111/status",
                json={"status": "in_progress"},
                headers=headers
            )
            assert response.status_code == 200
            data = response.get_json()
            assert data["status"] == "Success"

    def test_superadmin_can_update_incident_in_any_ward(self, client, superadmin_token):
        """
        Verifies that a super administrator can update incidents across any ward.
        """
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        with patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "super_admin", "wards": []}), \
             patch.object(IncidentRepository, "get_incident_by_id", return_value={"id": "inc-999", "ward_id": 99, "status": "reported"}), \
             patch.object(IncidentRepository, "update_status", return_value=True):
            
            response = client.patch(
                "/api/v1/admin/complaints/inc-999/status",
                json={"status": "resolved"},
                headers=headers
            )
            assert response.status_code == 200


class TestUserPrivacyAndDataIsolation:
    """Unit tests verifying user data isolation and PII protection."""

    def test_unauthenticated_user_cannot_access_user_list(self, client):
        """Verifies that unauthenticated callers cannot dump user profiles."""
        response = client.get("/api/v1/admin/users")
        assert response.status_code == 401

    def test_citizen_cannot_query_other_users_phone_reports(self, client, citizen_token):
        """
        Verifies that Citizen A cannot query reports by supplying Citizen B's phone number in URL.
        """
        headers = {"Authorization": f"Bearer {citizen_token}"}
        with patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "citizen", "wards": []}):
            # citizen_token has phone +919876543210; attempts to query +919999999999
            response = client.get("/api/v1/complaints/user/+919999999999", headers=headers)
            assert response.status_code == 403


class TestDuplicateVotePrevention:
    """Unit tests verifying anti-Sybil duplicate voting enforcement."""

    def test_duplicate_vote_rejected(self, client, citizen_token):
        """
        Verifies that a citizen cannot vote/verify more than once on the same incident.
        """
        headers = {"Authorization": f"Bearer {citizen_token}"}
        with patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "citizen", "wards": []}), \
             patch.object(IncidentRepository, "add_verification", return_value=(False, "ALREADY_VERIFIED")):
            
            response = client.post("/api/v1/complaints/issue-123/vote", headers=headers)
            assert response.status_code == 409
            data = response.get_json()
            assert data["code"] == "DUPLICATE_VOTE"


class TestValidationAndErrorHandling:
    """Unit tests verifying payload validation, overlap conflicts, and health status."""

    def test_invalid_status_update_rejected(self, client, admin_ward1_token):
        """Verifies that arbitrary or invalid status values are rejected with 400."""
        headers = {"Authorization": f"Bearer {admin_ward1_token}"}
        with patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "admin", "wards": [1]}):
            response = client.patch(
                "/api/v1/admin/complaints/inc-1/status",
                json={"status": "invalid_status_xyz"},
                headers=headers
            )
            assert response.status_code == 400
            data = response.get_json()
            assert "Invalid status" in data["error"]

    def test_ward_overlap_conflict_rejected(self, client, superadmin_token):
        """Verifies that overlapping boundary creations return 409 Conflict with conflict names."""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        with patch.object(UserRepository, "get_user_role_and_wards", return_value={"role": "super_admin", "wards": []}), \
             patch.object(WardRepository, "check_boundary_overlap", return_value=["Downtown Ward 1"]):
            
            response = client.post(
                "/api/v1/wards",
                json={"name": "Overlapping Sector", "geom_wkt": "POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))"},
                headers=headers
            )
            assert response.status_code == 409
            data = response.get_json()
            assert data["status"] == "Conflict"
            assert "Downtown Ward 1" in data["conflicts"]

    def test_report_without_image_rejected(self, client):
        """Verifies that submitting an incident without an image returns 400."""
        response = client.post("/api/v1/report", data={"category": "Pothole"})
        assert response.status_code == 400

    def test_health_check_operational(self, client):
        """Verifies root and /api/v1/health endpoints return 200 with platform details."""
        res_root = client.get("/")
        assert res_root.status_code == 200
        data_root = res_root.get_json()
        assert data_root["platform"] == "NAGARWATCH"

        res_api = client.get("/api/v1/health")
        assert res_api.status_code == 200

