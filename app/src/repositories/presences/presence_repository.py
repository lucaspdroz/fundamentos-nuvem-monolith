from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models.presences.presence import Presence
from src.models.students.student import Student


class PresenceRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_by_student(self, student_id: int) -> list[Presence]:
        stmt = (
            select(Presence)
            .where(Presence.student_id == student_id)
            .order_by(Presence.presence.desc())
        )
        return list(self.db.scalars(stmt))

    def exists_on(self, student_id: int, day: date) -> bool:
        stmt = select(Presence.id).where(
            Presence.student_id == student_id, Presence.presence_date == day
        )
        return self.db.scalar(stmt) is not None

    def add(self, presence: Presence) -> Presence:
        self.db.add(presence)
        self.db.commit()
        self.db.refresh(presence)
        return presence

    def class_days(self, course: str, turn: str, start: date, end: date) -> set[date]:
        """Dias em que houve aula para o curso/turno: dias em que alguem da turma fez presenca.

        Intervalo [start, end).
        """
        stmt = (
            select(Presence.presence_date)
            .distinct()
            .join(Student, Student.id == Presence.student_id)
            .where(
                Student.course == course,
                Student.turn == turn,
                Presence.presence_date >= start,
                Presence.presence_date < end,
            )
        )
        return set(self.db.scalars(stmt))

    def attended_days(self, student_id: int, start: date, end: date) -> set[date]:
        """Dias em que o aluno fez presenca. Intervalo [start, end)."""
        stmt = select(Presence.presence_date).where(
            Presence.student_id == student_id,
            Presence.presence_date >= start,
            Presence.presence_date < end,
        )
        return set(self.db.scalars(stmt))
