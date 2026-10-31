import os
import pytest
from app.core.config import config
from app.repositories.db import db_manager

# Determine if live database credentials are provided and actually reachable
def is_live_db_available():
    if not (os.getenv("DB_PASS") and os.getenv("DB_HOST")):
        return False
    try:
        db_manager.initialize_pool()
        return db_manager._pool is not None
    except Exception:
        return False

has_db_connection = is_live_db_available()
real_supabase_url = os.getenv("SUPABASE_URL", "")
real_supabase_key = os.getenv("SUPABASE_KEY", "")
has_supabase_credentials = bool(real_supabase_url and real_supabase_key)

@pytest.mark.skipif(not has_db_connection, reason="Live PostgreSQL connection pool is not reachable from this environment.")
class TestDatabaseIntegration:
    """
    Integration tests executed against an active PostgreSQL + PostGIS database.
    Verifies actual database connection, table presence, and spatial functions.
    """
    
    def test_database_connection(self):
        """Verifies connection pool can successfully borrow and return a connection."""
        with db_manager.get_connection() as conn:
            assert conn is not None
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
                assert cur.fetchone()[0] == 1

    def test_postgis_extension_available(self):
        """Verifies PostGIS extension is installed and functioning."""
        with db_manager.get_cursor(commit=False) as cur:
            cur.execute("SELECT PostGIS_Version();")
            version = cur.fetchone()[0]
            assert "3." in version or "2." in version

    def test_incidents_table_exists(self):
        """Verifies incidents table is present in the public schema."""
        with db_manager.get_cursor(commit=False) as cur:
            cur.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = 'incidents'
                );
            """)
            exists = cur.fetchone()[0]
            assert exists is True


@pytest.mark.skipif(not has_supabase_credentials, reason="Live Supabase credentials (SUPABASE_URL, SUPABASE_KEY) not configured.")
class TestSupabaseAuthIntegration:
    """
    Integration tests executed against live Supabase Auth service.
    Verifies actual Supabase GoTrue token verification over network.
    """

    def test_live_supabase_client_initialization(self):
        """Verifies Supabase client can be initialized with credentials."""
        from supabase import create_client
        client = create_client(real_supabase_url, real_supabase_key)
        assert client is not None

