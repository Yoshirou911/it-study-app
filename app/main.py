from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app import network
from app.db import Base, engine, ensure_schema
from app.routers import notes, progress, quiz

BASE_DIR = Path(__file__).resolve().parent.parent

Base.metadata.create_all(bind=engine)
ensure_schema()

app = FastAPI(title="STACK — IT学習帳")

app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")

app.include_router(quiz.router)
app.include_router(progress.router)
app.include_router(notes.router)


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse(request, "index.html")


@app.get("/connect", response_class=HTMLResponse)
def connect(request: Request):
    """他の端末から開くためのQRコードとURLを表示する。"""
    port = request.url.port or network.DEFAULT_PORT
    url = network.lan_url(port)
    return templates.TemplateResponse(
        request,
        "connect.html",
        {
            "lan_url": url,
            "qr_svg": network.qr_svg(url) if url else "",
            "port": port,
        },
    )
