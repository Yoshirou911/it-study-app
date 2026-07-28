from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.db import Base, engine
from app.routers import notes, progress, quiz

BASE_DIR = Path(__file__).resolve().parent.parent

Base.metadata.create_all(bind=engine)

app = FastAPI(title="基本情報技術者試験 学習アプリ")

app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")

app.include_router(quiz.router)
app.include_router(progress.router)
app.include_router(notes.router)


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse(request, "index.html")
