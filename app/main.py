from fastapi import FastAPI

app = FastAPI(title="fundamentos-nuvem-api")


@app.get("/")
def status_check() -> dict[str, str]:
    return {"status": "ok"}
