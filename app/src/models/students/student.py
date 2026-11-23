from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from src.core.clock import now
from src.database.connection import Base


class Student(Base):
    """Usuario do sistema (tabela "Users" do diagrama): aluno ou professor."""

    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True)
    registration: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
    )
    full_name: Mapped[str] = mapped_column(String(150))
    avatar: Mapped[str] = mapped_column(String(500))
    course: Mapped[str] = mapped_column(String(150))
    turn: Mapped[str] = mapped_column(String(20))
    professor: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, onupdate=now
    )
