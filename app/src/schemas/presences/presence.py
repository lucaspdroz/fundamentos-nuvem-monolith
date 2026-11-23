from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class PresenceCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    room: str = Field(min_length=1, max_length=50)


class PresenceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    presence: datetime
    room: str
    created_at: datetime


class AttendanceSummary(BaseModel):
    """Dados do dashboard do aluno."""

    registration: str
    present_today: bool
    total_absences: int
    absences: list[date]
    presences: list[PresenceRead]
