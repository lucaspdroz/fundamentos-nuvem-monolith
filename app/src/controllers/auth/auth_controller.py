from fastapi import APIRouter, Depends

from src.controllers.dependencies import get_auth_service
from src.schemas.auth.login import LoginRequest
from src.schemas.students.student import StudentRead
from src.services.auth.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/login",
    response_model=StudentRead,
    summary="Login pela matrícula",
)
def login(
    data: LoginRequest,
    service: AuthService = Depends(get_auth_service),
):
    return service.login(data)
