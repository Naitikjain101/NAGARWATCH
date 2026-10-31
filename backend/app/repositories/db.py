import logging
from contextlib import contextmanager
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from app.core.config import config

logger = logging.getLogger(__name__)

class DatabaseManager:
    _instance = None
    _pool: pool.ThreadedConnectionPool = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DatabaseManager, cls).__new__(cls)
        return cls._instance

    def initialize_pool(self):
        """Initializes the connection pool lazily."""
        if self._pool is None:
            try:
                self._pool = pool.ThreadedConnectionPool(
                    minconn=config.DB_POOL_MIN,
                    maxconn=config.DB_POOL_MAX,
                    host=config.DB_HOST,
                    port=config.DB_PORT,
                    database=config.DB_NAME,
                    user=config.DB_USER,
                    password=config.DB_PASS,
                    connect_timeout=1
                )
                logger.info("Database connection pool initialized successfully.")
            except Exception as e:
                logger.warning(f"Could not initialize database pool: {e}")
                self._pool = None

    @contextmanager
    def get_connection(self):
        """Context manager yielding a pooled connection."""
        if self._pool is None:
            self.initialize_pool()
        if self._pool is None:
            raise RuntimeError("Database connection pool is not available. Check DB credentials.")

        conn = self._pool.getconn()
        try:
            yield conn
        finally:
            self._pool.putconn(conn)

    @contextmanager
    def get_cursor(self, commit: bool = True, cursor_factory=None):
        """Context manager yielding a database cursor with automatic commit/rollback."""
        with self.get_connection() as conn:
            cur = conn.cursor(cursor_factory=cursor_factory)
            try:
                yield cur
                if commit:
                    conn.commit()
            except Exception as e:
                conn.rollback()
                logger.error(f"Database transaction error: {e}")
                raise
            finally:
                cur.close()

db_manager = DatabaseManager()

@contextmanager
def get_db_cursor(commit: bool = True, dict_cursor: bool = False):
    """Convenience helper for database cursor context management."""
    cursor_factory = RealDictCursor if dict_cursor else None
    with db_manager.get_cursor(commit=commit, cursor_factory=cursor_factory) as cur:
        yield cur

