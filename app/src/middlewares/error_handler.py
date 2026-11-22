import logging

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from src.core.exceptions import AppError

logger = logging.getLogger(__name__)


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        try:
            return await call_next(request)
        except AppError as exc:
            logger.warning(
                str(exc),
                extra={
                    "event": "app.error",
                    "status_code": exc.status_code,
                    "method": request.method,
                    "path": request.url.path,
                },
            )
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": str(exc)},
            )
        except Exception:
            logger.exception(
                "Erro não tratado",
                extra={
                    "event": "app.unhandled_error",
                    "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                    "method": request.method,
                    "path": request.url.path,
                },
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"detail": "Erro interno do servidor"},
            )
