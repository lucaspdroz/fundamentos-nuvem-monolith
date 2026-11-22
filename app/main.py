from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.controllers.auth import auth_controller
from src.controllers.presences import presence_controller
from src.controllers.students import student_controller
from src.core.config import settings
from src.core.logger import setup_logging
from src.database.connection import Base, engine
from src.middlewares.error_handler import ErrorHandlerMiddleware

setup_logging()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(ErrorHandlerMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"

app.include_router(auth_controller.router, prefix=API_PREFIX)
app.include_router(student_controller.router, prefix=API_PREFIX)
app.include_router(presence_controller.router, prefix=API_PREFIX)


@app.get("/")
def status_check() -> dict[str, str]:
    return {"status": "ok"}
