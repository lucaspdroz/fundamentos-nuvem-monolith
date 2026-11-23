from fastapi import Depends
from sqlalchemy.orm import Session

from src.database.connection import get_db
from src.repositories.presences.presence_repository import PresenceRepository
from src.repositories.students.student_repository import StudentRepository
from src.services.auth.auth_service import AuthService
from src.services.presences.presence_service import PresenceService
from src.services.students.student_service import StudentService


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    return AuthService(StudentRepository(db))


def get_presence_service(db: Session = Depends(get_db)) -> PresenceService:
    return PresenceService(StudentRepository(db), PresenceRepository(db))


def get_student_service(
    db: Session = Depends(get_db),
    presence_service: PresenceService = Depends(get_presence_service),
) -> StudentService:
    return StudentService(StudentRepository(db), presence_service)
