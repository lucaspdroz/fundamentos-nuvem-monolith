import logging
from datetime import date

from src.core.clock import now, today
from src.core.exceptions import ConflictError, NotFoundError
from src.models.presences.presence import Presence
from src.models.students.student import Student
from src.repositories.presences.presence_repository import PresenceRepository
from src.repositories.students.student_repository import StudentRepository
from src.schemas.presences.presence import AttendanceSummary, PresenceCreate, PresenceRead

logger = logging.getLogger(__name__)


class PresenceService:
    def __init__(self, students: StudentRepository, presences: PresenceRepository) -> None:
        self.students = students
        self.presences = presences

    def check_in(self, registration: str, data: PresenceCreate) -> Presence:
        student = self._get_student(registration)
        current = now()

        if self.presences.exists_on(student.id, current.date()):
            raise ConflictError("Presença de hoje já registrada")

        presence = self.presences.add(
            Presence(
                student_id=student.id,
                presence=current,
                presence_date=current.date(),
                room=data.room,
                created_at=current,
            )
        )
        logger.info(
            "Presença registrada",
            extra={
                "event": "presence.checked_in",
                "registration": student.registration,
                "course": student.course,
                "turn": student.turn,
                "room": presence.room,
            },
        )
        return presence

    def summary(self, registration: str) -> AttendanceSummary:
        student = self._get_student(registration)
        absences = self.absence_dates(student)
        return AttendanceSummary(
            registration=student.registration,
            present_today=self.is_present_today(student),
            total_absences=len(absences),
            absences=absences,
            presences=[
                PresenceRead.model_validate(p) for p in self.presences.list_by_student(student.id)
            ],
        )

    def is_present_today(self, student: Student) -> bool:
        return self.presences.exists_on(student.id, today())

    def count_absences(self, student: Student) -> int:
        return len(self.absence_dates(student))

    def absence_dates(self, student: Student) -> list[date]:
        """Faltas = dias de aula da turma (desde o cadastro, sem contar hoje) sem presenca do aluno.

        Como nao existe calendario de aulas, um "dia de aula" e qualquer dia em que
        alguem do mesmo curso e turno fez presenca.
        """
        start = student.created_at.date()
        end = today()
        class_days = self.presences.class_days(student.course, student.turn, start, end)
        attended = self.presences.attended_days(student.id, start, end)
        return sorted(class_days - attended)

    def _get_student(self, registration: str) -> Student:
        student = self.students.get_by_registration(registration)
        if student is None:
            raise NotFoundError("Aluno não encontrado")
        return student
