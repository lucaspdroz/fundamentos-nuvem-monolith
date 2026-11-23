import logging

from src.core.config import settings
from src.core.exceptions import ConflictError, NotFoundError
from src.models.students.student import Student
from src.repositories.students.student_repository import StudentRepository
from src.schemas.students.student import (
    StudentCreate,
    StudentOverview,
    StudentStatus,
    StudentUpdate,
)
from src.services.presences.presence_service import PresenceService

logger = logging.getLogger(__name__)


class StudentService:
    def __init__(self, students: StudentRepository, presence_service: PresenceService) -> None:
        self.students = students
        self.presence_service = presence_service

    def get(self, student_id: int) -> Student:
        student = self.students.get_by_id(student_id)
        if student is None:
            raise NotFoundError("Aluno não encontrado")
        return student

    def create(self, data: StudentCreate) -> Student:
        if self.students.get_by_registration(data.registration) is not None:
            raise ConflictError("Matrícula já cadastrada")
        student = self.students.add(Student(**data.model_dump()))
        logger.info(
            "Aluno cadastrado",
            extra={
                "event": "student.created",
                "registration": student.registration,
                "course": student.course,
                "turn": student.turn,
                "professor": student.professor,
            },
        )
        return student

    def update(self, student_id: int, data: StudentUpdate) -> Student:
        student = self.get(student_id)
        for field, value in data.model_dump().items():
            setattr(student, field, value)
        student = self.students.save(student)
        logger.info(
            "Aluno atualizado",
            extra={
                "event": "student.updated",
                "registration": student.registration,
            },
        )
        return student

    def list_overview(self, course: str | None, turn: str | None) -> list[StudentOverview]:
        """Professor view: alunos em ordem alfabetica com o status do dia."""
        overview = []
        for student in self.students.list_students(course, turn):
            present_today = self.presence_service.is_present_today(student)
            absences = self.presence_service.count_absences(student)
            overview.append(
                StudentOverview(
                    registration=student.registration,
                    full_name=student.full_name,
                    avatar=student.avatar,
                    course=student.course,
                    turn=student.turn,
                    present_today=present_today,
                    total_absences=absences,
                    status=self._status(present_today, absences),
                )
            )
        return overview

    @staticmethod
    def _status(present_today: bool, absences: int) -> StudentStatus:
        if absences > settings.absence_limit:
            return "warning"
        if present_today:
            return "present"
        return "default"
