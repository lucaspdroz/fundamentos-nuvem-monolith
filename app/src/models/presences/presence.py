from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.core.clock import now
from src.database.connection import Base


class Presence(Base):
    """Registro de presenca (tabela "registry" do diagrama)."""

    __tablename__ = "presences"
    __table_args__ = (
        UniqueConstraint("student_id", "presence_date", name="uq_presence_student_day"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    presence: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    presence_date: Mapped[date] = mapped_column(Date, index=True)
    room: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
