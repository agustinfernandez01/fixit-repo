import logging

from fastapi import Request, Response

legacy_logger = logging.getLogger("app.legacy_routes")


def mark_legacy_route_used(
    *,
    response: Response,
    request: Request,
    successor_path: str,
    legacy_route: str,
) -> None:
    response.headers["Deprecation"] = "true"
    response.headers["Sunset"] = "Wed, 31 Dec 2026 23:59:59 GMT"
    response.headers["Link"] = f'</api/v1{successor_path}>; rel="successor-version"'

    client_host = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    # Use warning so it is visible even with default production logging levels.
    legacy_logger.warning(
        "Legacy route used | method=%s path=%s legacy=%s successor=/api/v1%s client=%s user_agent=%s",
        request.method,
        request.url.path,
        legacy_route,
        successor_path,
        client_host,
        user_agent,
    )
