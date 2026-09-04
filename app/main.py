from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app import network
from app.db import Base, engine, ensure_schema
from app.routers import notes, progress, quiz, study

BASE_DIR = Path(__file__).resolve().parent.parent


def _read_version() -> str:
    """VERSIONファイル(1行だけのプレーンテキスト)からバージョン番号を読む。

    起動時に1度だけ読めばよい。CHANGELOG.mdの運用ルールも参照。
    """
    path = BASE_DIR / "VERSION"
    return path.read_text(encoding="utf-8").strip() if path.exists() else "0.0.0"


APP_VERSION = _read_version()

Base.metadata.create_all(bind=engine)
ensure_schema()

app = FastAPI(title="STACK — IT学習帳", version=APP_VERSION)

app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")


def static_url(filename: str) -> str:
    """静的ファイルのURLに更新時刻を付け、ブラウザの古いキャッシュを無効化する。

    StaticFilesはCache-Controlを明示的に指定していないため、ブラウザは
    ヒューリスティックにキャッシュを使うことがある。ファイルを直せても
    利用者のブラウザには届かず、直したはずの不具合が再現し続ける事故を防ぐため、
    ファイルの更新時刻(mtime)をクエリ文字列に付け、変更のたびに別URLとして
    強制的に再取得させる。
    """
    path = BASE_DIR / "static" / filename
    version = int(path.stat().st_mtime) if path.exists() else 0
    return f"/static/{filename}?v={version}"


templates.env.globals["static_url"] = static_url
templates.env.globals["app_version"] = APP_VERSION

app.include_router(quiz.router)
app.include_router(progress.router)
app.include_router(notes.router)
app.include_router(study.router)


@app.get("/api/version")
def version():
    return {"version": APP_VERSION}


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
