from datetime import date, datetime
from zoneinfo import ZoneInfo

from src.core.config import settings

_TZ = ZoneInfo(settings.timezone)


def now() -> datetime:
    return datetime.now(_TZ)


def today() -> date:
    return now().date()
