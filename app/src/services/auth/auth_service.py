import logging

from src.core.exceptions import NotFoundError
from src.models.students.student import Student
from src.repositories.students.student_repository import StudentRepository
from src.schemas.auth.login import LoginRequest

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, students: StudentRepository) -> None:
        self.students = students

    def login(self, data: LoginRequest) -> Student:
        student = self.students.get_by_registration(data.registration)
        if student is None:
            raise NotFoundError("Matrícula não cadastrada")
        logger.info(
            "Login realizado",
            extra={
                "event": "auth.login",
                "registration": student.registration,
                "professor": student.professor,
            },
        )
        return student
