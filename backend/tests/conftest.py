import pytest
import time
import os
import sys
from unittest.mock import MagicMock

# Add backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import create_app
from app.core.config import config
from app.core.security import create_test_token
from app.repositories.user_repo import UserRepository
from app.repositories.incident_repo import IncidentRepository
from app.repositories.ward_repo import WardRepository

TEST_SECRET = "test-jwt-secret-for-unit-testing-only-nagarwatch-12345"

@pytest.fixture(autouse=True)
def setup_test_config(monkeypatch):
    """Sets testing configuration across all tests."""
    monkeypatch.setattr(config, "SUPABASE_JWT_SECRET", TEST_SECRET)
    monkeypatch.setattr(config, "SUPABASE_URL", "")
    monkeypatch.setattr(config, "DEBUG", True)

@pytest.fixture
def app():
    """Initializes Flask test application instance."""
    app = create_app({
        "TESTING": True,
        "DEBUG": True
    })
    return app

@pytest.fixture
def client(app):
    """Flask HTTP test client."""
    return app.test_client()

@pytest.fixture
def citizen_token():
    """Generates a valid signed JWT token for a citizen user."""
    return create_test_token(
        user_id="11111111-1111-1111-1111-111111111111",
        role="citizen",
        email="citizen@nagarwatch.org",
        phone="+919876543210",
        expires_in=3600,
        secret=TEST_SECRET
    )

@pytest.fixture
def admin_ward1_token():
    """Generates a valid signed JWT token for an admin assigned to Ward 1."""
    return create_test_token(
        user_id="22222222-2222-2222-2222-222222222222",
        role="admin",
        email="admin_ward1@nagarwatch.org",
        phone="+919876543211",
        expires_in=3600,
        secret=TEST_SECRET
    )

@pytest.fixture
def superadmin_token():
    """Generates a valid signed JWT token for a super administrator."""
    return create_test_token(
        user_id="33333333-3333-3333-3333-333333333333",
        role="super_admin",
        email="director@nagarwatch.org",
        phone="+919876543212",
        expires_in=3600,
        secret=TEST_SECRET
    )

@pytest.fixture
def expired_token():
    """Generates an expired signed JWT token."""
    return create_test_token(
        user_id="44444444-4444-4444-4444-444444444444",
        role="citizen",
        email="expired@nagarwatch.org",
        phone="+919876543213",
        expires_in=-3600,  # Expired 1 hour ago
        secret=TEST_SECRET
    )

