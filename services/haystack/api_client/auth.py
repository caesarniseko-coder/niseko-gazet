"""Bot authentication against the Next.js API (NextAuth)."""

import httpx
import structlog

from config import NEXTJS_API_URL, HAYSTACK_BOT_EMAIL, HAYSTACK_BOT_PASSWORD

logger = structlog.get_logger()

_session_token: str | None = None


async def get_session_token() -> str:
    """Authenticate as the Haystack bot and return a session token.

    Uses NextAuth's credentials sign-in flow:
    1. GET /api/auth/csrf to get CSRF token
    2. POST /api/auth/callback/credentials with email/password
    3. Extract session cookie from response
    """
    global _session_token

    if _session_token:
        # Validate existing token
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{NEXTJS_API_URL}/api/auth/session",
                    cookies={"next-auth.session-token": _session_token},
                )
                session = resp.json()
                if session and session.get("user"):
                    return _session_token
        except Exception:
            pass
        _session_token = None

    # Fresh login
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=False) as client:
        # Step 1: Get CSRF token
        csrf_resp = await client.get(f"{NEXTJS_API_URL}/api/auth/csrf")
        csrf_resp.raise_for_status()
        csrf_token = csrf_resp.json()["csrfToken"]
        cookies = dict(csrf_resp.cookies)

        # Step 2: POST credentials
        login_resp = await client.post(
            f"{NEXTJS_API_URL}/api/auth/callback/credentials",
            data={
                "csrfToken": csrf_token,
                "email": HAYSTACK_BOT_EMAIL,
                "password": HAYSTACK_BOT_PASSWORD,
                "json": "true",
            },
            cookies=cookies,
        )

        # NextAuth returns a redirect (302) with session cookie on success
        all_cookies = {**dict(csrf_resp.cookies), **dict(login_resp.cookies)}
        token = all_cookies.get("next-auth.session-token") or all_cookies.get(
            "__Secure-next-auth.session-token"
        )

        if not token:
            logger.error(
                "auth.login_failed",
                status=login_resp.status_code,
                email=HAYSTACK_BOT_EMAIL,
            )
            raise RuntimeError(
                f"Failed to authenticate as bot: status {login_resp.status_code}"
            )

        _session_token = token
        logger.info("auth.login_success", email=HAYSTACK_BOT_EMAIL)
        return _session_token


def clear_session():
    """Clear the cached session token."""
    global _session_token
    _session_token = None
