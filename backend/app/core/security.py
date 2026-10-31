import time
import logging
from typing import Optional, Dict, Any, List
import jwt
from app.core.config import config

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------------------
# 1. EXCEPTION HIERARCHY
# ------------------------------------------------------------------------------

class AuthError(Exception):
    """Base exception for authentication errors."""
    def __init__(self, message: str, status_code: int = 401, code: str = "AUTH_ERROR"):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code

class MissingTokenError(AuthError):
    def __init__(self, message: str = "Authorization header with Bearer token is required"):
        super().__init__(message, status_code=401, code="MISSING_TOKEN")

class TokenExpiredError(AuthError):
    def __init__(self, message: str = "Authentication token has expired. Please log in again."):
        super().__init__(message, status_code=401, code="TOKEN_EXPIRED")

class InvalidTokenError(AuthError):
    def __init__(self, message: str = "Invalid or malformed token", code: str = "INVALID_TOKEN"):
        super().__init__(message, status_code=401, code=code)

class InvalidSignatureError(InvalidTokenError):
    def __init__(self, message: str = "Token signature verification failed"):
        super().__init__(message, code="INVALID_SIGNATURE")

class InvalidAudienceError(InvalidTokenError):
    def __init__(self, message: str = "Token audience claim is invalid"):
        super().__init__(message, code="INVALID_AUDIENCE")

class InvalidIssuerError(InvalidTokenError):
    def __init__(self, message: str = "Token issuer claim does not match configured Supabase URL"):
        super().__init__(message, code="INVALID_ISSUER")

class MissingSubjectError(InvalidTokenError):
    def __init__(self, message: str = "Token missing valid subject (sub) claim"):
        super().__init__(message, code="MISSING_SUBJECT")

class UnsupportedAlgorithmError(InvalidTokenError):
    def __init__(self, message: str = "Token specifies an unsupported or insecure signing algorithm"):
        super().__init__(message, code="UNSUPPORTED_ALGORITHM")

class ServerConfigurationError(AuthError):
    def __init__(self, message: str = "Server authentication configuration is missing or invalid"):
        super().__init__(message, status_code=500, code="SERVER_CONFIG_ERROR")

class InsufficientPermissionsError(AuthError):
    def __init__(self, message: str = "Access denied. Insufficient role permissions."):
        super().__init__(message, status_code=403, code="INSUFFICIENT_PERMISSIONS")


# ------------------------------------------------------------------------------
# 2. TOKEN EXTRACTION
# ------------------------------------------------------------------------------

def extract_bearer_token(auth_header: Optional[str]) -> Optional[str]:
    """
    Extracts Bearer token from the HTTP Authorization header.
    Format: 'Bearer <token>'
    """
    if not auth_header:
        return None
    parts = auth_header.strip().split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


# ------------------------------------------------------------------------------
# 3. CRYPTOGRAPHIC JWT VERIFICATION
# ------------------------------------------------------------------------------

def verify_jwt_token(
    token: str,
    secret: Optional[str] = None,
    expected_issuer: Optional[str] = None,
    expected_audience: str = "authenticated"
) -> Dict[str, Any]:
    """
    Cryptographically verifies a Supabase JWT access token.
    
    SECURITY GUARANTEES:
    - Signature verification is NEVER bypassed or disabled.
    - Token expiration (exp) is strictly enforced.
    - Issuer (iss) is verified against the configured Supabase project URL when available.
    - Audience (aud) is strictly validated as 'authenticated'.
    - Subject (sub) claim is strictly required.
    - Rejects insecure 'none' algorithm and unconfigured algorithms.
    - Supports symmetric HS256 and asymmetric RS256 / ES256 via Supabase JWKS.
    - Falls back to Supabase Auth API get_user(token) when local secret is absent.
    - Fails with 500 ServerConfigurationError if no signing verification configuration exists.
    """
    if not token or not token.strip():
        raise MissingTokenError()

    # Step 1: Inspect header to identify the signing algorithm (WITHOUT trusting payload)
    try:
        header = jwt.get_unverified_header(token)
    except Exception as e:
        raise InvalidTokenError(f"Malformed JWT header: {str(e)}")

    alg = header.get("alg")
    if not alg or alg.lower() == "none":
        raise UnsupportedAlgorithmError("Insecure unsigned token (alg='none') is rejected")

    if alg not in config.SUPPORTED_ALGORITHMS:
        raise UnsupportedAlgorithmError(
            f"Algorithm '{alg}' is unsupported. Allowed algorithms: {', '.join(config.SUPPORTED_ALGORITHMS)}"
        )

    # Resolve signing secret and issuer
    jwt_secret = secret or config.SUPABASE_JWT_SECRET
    issuer = expected_issuer or config.SUPABASE_ISSUER

    decode_options = {
        "verify_signature": True,
        "verify_exp": True,
        "verify_aud": True,
        "verify_iss": bool(issuer),
        "require": ["exp", "sub", "aud"]
    }

    # --------------------------------------------------------------------------
    # Path A: Symmetric HMAC Verification (HS256 with SUPABASE_JWT_SECRET)
    # --------------------------------------------------------------------------
    if alg == "HS256" and jwt_secret:
        try:
            decoded = jwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256"],
                audience=expected_audience,
                issuer=issuer,
                options=decode_options
            )
            if not decoded.get("sub"):
                raise MissingSubjectError()
            return decoded

        except jwt.ExpiredSignatureError:
            raise TokenExpiredError()
        except jwt.InvalidSignatureError:
            raise InvalidSignatureError()
        except jwt.InvalidAudienceError:
            raise InvalidAudienceError()
        except jwt.InvalidIssuerError:
            raise InvalidIssuerError()
        except jwt.MissingRequiredClaimError as e:
            if "sub" in str(e):
                raise MissingSubjectError()
            if "aud" in str(e):
                raise InvalidAudienceError("Token missing required 'aud' claim")
            if "exp" in str(e):
                raise InvalidTokenError("Token missing required 'exp' claim")
            raise InvalidTokenError(f"Missing required claim: {str(e)}")
        except jwt.InvalidTokenError as e:
            raise InvalidTokenError(f"JWT verification failed: {str(e)}")

    # --------------------------------------------------------------------------
    # Path B: Asymmetric Verification via Supabase JWKS (RS256 / ES256)
    # --------------------------------------------------------------------------
    if alg in ("RS256", "ES256") and config.SUPABASE_URL:
        try:
            jwks_url = f"{config.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
            jwks_client = jwt.PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=3600)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            
            decoded = jwt.decode(
                token,
                signing_key.key,
                algorithms=[alg],
                audience=expected_audience,
                issuer=issuer,
                options=decode_options
            )
            if not decoded.get("sub"):
                raise MissingSubjectError()
            return decoded

        except jwt.ExpiredSignatureError:
            raise TokenExpiredError()
        except jwt.InvalidSignatureError:
            raise InvalidSignatureError()
        except jwt.InvalidAudienceError:
            raise InvalidAudienceError()
        except jwt.InvalidIssuerError:
            raise InvalidIssuerError()
        except Exception as e:
            logger.warning(f"JWKS verification failed for {alg}: {e}")

    # --------------------------------------------------------------------------
    # Path C: Supabase GoTrue Auth API Delegation (Algorithm-Agnostic)
    # --------------------------------------------------------------------------
    if config.SUPABASE_URL and config.SUPABASE_KEY:
        try:
            from supabase import create_client
            client = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)
            user_response = client.auth.get_user(token)
            
            if user_response and user_response.user:
                user = user_response.user
                if not user.id:
                    raise MissingSubjectError("User response lacks identifier")
                return {
                    "sub": user.id,
                    "email": user.email,
                    "phone": user.phone,
                    "user_metadata": user.user_metadata or {},
                    "role": user.role or "authenticated",
                    "aud": "authenticated"
                }
            raise InvalidTokenError("Supabase Auth rejected user token")

        except TokenExpiredError:
            raise
        except InvalidTokenError:
            raise
        except Exception as e:
            err_msg = str(e).lower()
            if "expired" in err_msg:
                raise TokenExpiredError()
            if "invalid" in err_msg or "malformed" in err_msg:
                raise InvalidTokenError(f"Supabase verification failed: {str(e)}")
            raise InvalidTokenError(f"Token verification rejected by Supabase Auth: {str(e)}")

    # --------------------------------------------------------------------------
    # Path D: Missing Server Configuration (Fail Securely)
    # --------------------------------------------------------------------------
    raise ServerConfigurationError(
        "Server authentication configuration missing. Configure SUPABASE_JWT_SECRET or "
        "(SUPABASE_URL and SUPABASE_KEY)."
    )


# ------------------------------------------------------------------------------
# 4. TEST TOKEN GENERATOR (FOR DETERMINISTIC CRYPTOGRAPHIC TESTING)
# ------------------------------------------------------------------------------

def create_test_token(
    user_id: str,
    role: str = "citizen",
    email: str = "test@nagarwatch.org",
    phone: str = "+919876543210",
    expires_in: int = 3600,
    secret: str = "test-jwt-secret-for-unit-testing-only-12345",
    algorithm: str = "HS256",
    audience: str = "authenticated",
    issuer: Optional[str] = None,
    headers: Optional[Dict[str, Any]] = None,
    include_sub: bool = True
) -> str:
    """Utility to generate signed JWTs for unit and security tests."""
    now = int(time.time())
    payload = {
        "aud": audience,
        "role": "authenticated",
        "email": email,
        "phone": phone,
        "user_metadata": {
            "role": role,
            "full_name": f"User {user_id[:8]}"
        },
        "iat": now,
        "exp": now + expires_in
    }
    if include_sub:
        payload["sub"] = user_id
    if issuer:
        payload["iss"] = issuer

    if algorithm.lower() == "none":
        # Insecure token for testing attack detection
        return jwt.encode(payload, key="", algorithm="none")

    return jwt.encode(payload, secret, algorithm=algorithm, headers=headers)
