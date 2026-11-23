from fastapi import status


class AppError(Exception):
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
