from fastapi import APIRouter, Depends, status

from src.controllers.dependencies import get_student_service
from src.schemas.students.student import (
    StudentCreate,
    StudentOverview,
    StudentRead,
    StudentUpdate,
)
from src.services.students.student_service import StudentService

router = APIRouter(prefix="/students", tags=["students"])


@router.get(
    "",
    response_model=list[StudentOverview],
    summary="Professor view",
)
def list_students(
    course: str | None = None,
    turn: str | None = None,
    service: StudentService = Depends(get_student_service),
):
    return service.list_overview(course, turn)


@router.post(
    "",
    response_model=StudentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_student(
    data: StudentCreate,
    service: StudentService = Depends(get_student_service),
):
    return service.create(data)


@router.get(
    "/{student_id}",
    response_model=StudentRead,
)
def get_student(
    student_id: int,
    service: StudentService = Depends(get_student_service),
):
    return service.get(student_id)


@router.put(
    "/{student_id}",
    response_model=StudentRead,
)
def update_student(
    student_id: int,
    data: StudentUpdate,
    service: StudentService = Depends(get_student_service),
):
    return service.update(student_id, data)
