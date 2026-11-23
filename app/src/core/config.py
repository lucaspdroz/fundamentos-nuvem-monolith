from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "classmate-api"
    cors_origins: list[str] = ["http://localhost:4200"]
    database_url: str = "sqlite:///./data/classmate.db"
    timezone: str = "America/Sao_Paulo"
    absence_limit: int = 5
    log_level: str = "INFO"


settings = Settings()
