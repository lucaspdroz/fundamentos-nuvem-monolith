from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models.students.student import Student


class StudentRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, student_id: int) -> Student | None:
        return self.db.get(Student, student_id)

    def get_by_registration(self, registration: str) -> Student | None:
        return self.db.scalar(select(Student).where(Student.registration == registration))

    def list_students(self, course: str | None = None, turn: str | None = None) -> list[Student]:
        """Somente alunos (sem professores), em ordem alfabetica."""
        stmt = select(Student).where(Student.professor.is_(False))
        if course:
            stmt = stmt.where(Student.course == course)
        if turn:
            stmt = stmt.where(Student.turn == turn)
        return list(self.db.scalars(stmt.order_by(Student.full_name)))

    def add(self, student: Student) -> Student:
        self.db.add(student)
        self.db.commit()
        self.db.refresh(student)
        return student

    def save(self, student: Student) -> Student:
        self.db.commit()
        self.db.refresh(student)
        return student
