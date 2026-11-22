from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Turn = Literal["Manhã", "Tarde", "Noite"]
StudentStatus = Literal["present", "warning", "default"]


class StudentBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str = Field(min_length=3, max_length=150)
    avatar: str = Field(min_length=1, max_length=500)
    course: str = Field(min_length=1, max_length=150)
    turn: Turn
    professor: bool = False


class StudentCreate(StudentBase):
    registration: str = Field(min_length=4, max_length=50)


class StudentUpdate(StudentBase):
    pass


class StudentRead(StudentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    registration: str
    created_at: datetime
    updated_at: datetime


class StudentOverview(BaseModel):
    """Linha da professor view."""

    registration: str
    full_name: str
    avatar: str
    course: str
    turn: str
    present_today: bool
    total_absences: int
    status: StudentStatus
