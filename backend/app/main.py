import logging
import re
from flask import Flask, jsonify, request
from flask_cors import CORS
from app.core.config import config
from app.api.v1.incidents import incidents_bp
from app.api.v1.admin import admin_bp
from app.api.v1.wards import wards_bp
from app.api.v1.users import users_bp
from app.api.v1.superadmin import superadmin_bp

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

# RFC 1918 private subnets and localhost pattern for seamless local network development
LOCAL_NETWORK_ORIGIN_REGEX = re.compile(
    r"^https?://(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$"
)

# Vercel deployment preview and production origin pattern
VERCEL_ORIGIN_REGEX = re.compile(
    r"^https?://[a-zA-Z0-9-_.]+\.vercel\.app$"
)

# Render backend service origin pattern
RENDER_ORIGIN_REGEX = re.compile(
    r"^https?://[a-zA-Z0-9-_.]+\.onrender\.com$"
)

def is_allowed_origin(origin: str) -> bool:
    """Verifies whether an HTTP Origin is authorized for CORS access."""
    if not origin:
        return False
    if origin in config.ALLOWED_ORIGINS:
        return True
    if LOCAL_NETWORK_ORIGIN_REGEX.match(origin):
        return True
    if VERCEL_ORIGIN_REGEX.match(origin):
        return True
    if RENDER_ORIGIN_REGEX.match(origin):
        return True
    return False

def create_app(test_config=None) -> Flask:
    """
    Application factory for the AREAWATCH REST API.
    Configures secure CORS, registers modular blueprints, and binds global error handlers.
    """
    # Validate production configuration if running in production
    if not test_config:
        config.validate_production_config()

    app = Flask(__name__)
    
    # Apply configuration
    if test_config:
        app.config.update(test_config)
    else:
        app.config["DEBUG"] = config.DEBUG
        app.config["MAX_CONTENT_LENGTH"] = config.MAX_CONTENT_LENGTH

    # Restrict CORS to configured origins (+ Vercel, Render, and local network subnets)
    cors_origins = list(config.ALLOWED_ORIGINS)
    cors_origins.extend([LOCAL_NETWORK_ORIGIN_REGEX, VERCEL_ORIGIN_REGEX, RENDER_ORIGIN_REGEX])

    logger.info(f"Configuring CORS for allowed origins: {config.ALLOWED_ORIGINS} (Vercel & LAN enabled)")
    CORS(
        app,
        resources={r"/api/*": {"origins": cors_origins}},
        supports_credentials=True,
        methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"]
    )

    # Register API Blueprints
    app.register_blueprint(incidents_bp, url_prefix="/api/v1")
    app.register_blueprint(admin_bp, url_prefix="/api/v1")
    app.register_blueprint(wards_bp, url_prefix="/api/v1")
    app.register_blueprint(users_bp, url_prefix="/api/v1")
    app.register_blueprint(superadmin_bp, url_prefix="/api/v1")

    @app.route("/api/<path:dummy>", methods=["OPTIONS"])
    def preflight_options(dummy):
        """Global preflight OPTIONS handler for CORS preflight validation."""
        origin = request.headers.get("Origin")
        response = app.make_default_options_response()
        if origin and is_allowed_origin(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Accept"
            response.headers["Access-Control-Max-Age"] = "86400"
        return response

    @app.after_request
    def ensure_cors_headers(response):
        origin = request.headers.get("Origin")
        if origin and is_allowed_origin(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Accept"
            response.headers["Access-Control-Max-Age"] = "86400"
        return response

    def _with_cors(response, status=200):
        origin = request.headers.get("Origin")
        if origin and is_allowed_origin(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Accept"
        return response, status

    # Root & Production Health Checks (Compatible with Render / Uptime monitors)
    @app.route("/", methods=["GET"])
    @app.route("/health", methods=["GET"])
    @app.route("/api/v1/health", methods=["GET"])
    def health_check():
        return _with_cors(jsonify({
            "status": "Online",
            "version": "2.0.0",
            "platform": "NAGARWATCH",
            "app": "AREAWATCH",
            "message": "NagarWatch / AreaWatch Community Safety & Neighbourhood Intelligence Backend is operational."
        }), 200)

    # Global Error Handlers
    @app.errorhandler(400)
    def bad_request(error):
        return _with_cors(jsonify({"error": "Bad Request", "message": str(error.description if hasattr(error, "description") else error)}), 400)

    @app.errorhandler(401)
    def unauthorized(error):
        return _with_cors(jsonify({"error": "Unauthorized", "message": "Authentication required"}), 401)

    @app.errorhandler(403)
    def forbidden(error):
        return _with_cors(jsonify({"error": "Forbidden", "message": "Access denied"}), 403)

    @app.errorhandler(404)
    def not_found(error):
        return _with_cors(jsonify({"error": "Not Found", "message": "Requested endpoint does not exist"}), 404)

    @app.errorhandler(405)
    def method_not_allowed(error):
        return _with_cors(jsonify({"error": "Method Not Allowed", "message": "HTTP method not supported on this endpoint"}), 405)

    @app.errorhandler(413)
    def payload_too_large(error):
        return _with_cors(jsonify({"error": "Payload Too Large", "message": f"Upload exceeds maximum size limit of {config.MAX_CONTENT_LENGTH // (1024*1024)}MB"}), 413)

    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"Internal Server Error: {error}")
        return _with_cors(jsonify({"error": "Internal Server Error", "message": "An unexpected error occurred. Please try again later."}), 500)

    @app.errorhandler(Exception)
    def handle_unexpected_exception(error):
        logger.error(f"Unhandled Exception: {error}", exc_info=True)
        return _with_cors(jsonify({"error": "Internal Server Error", "message": "An unexpected error occurred. Please try again later."}), 500)

    return app

