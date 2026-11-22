from fastapi import APIRouter, Depends, status

from src.controllers.dependencies import get_presence_service
from src.schemas.presences.presence import AttendanceSummary, PresenceCreate, PresenceRead
from src.services.presences.presence_service import PresenceService

router = APIRouter(prefix="/students/{registration}/presences", tags=["presences"])


@router.get(
    "",
    response_model=AttendanceSummary,
    summary="Dashboard do aluno",
)
def get_attendance(
    registration: str,
    service: PresenceService = Depends(get_presence_service),
):
    return service.summary(registration)


@router.post(
    "",
    response_model=PresenceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Check presence",
)
def check_in(
    registration: str,
    data: PresenceCreate,
    service: PresenceService = Depends(get_presence_service),
):
    return service.check_in(registration, data)
