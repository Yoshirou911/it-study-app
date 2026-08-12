from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)
DATABASE_URL = f"sqlite:///{DATA_DIR / 'study.db'}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 既存DBに後から追加した列。(テーブル名, 列名, DDL断片)
_ADDED_COLUMNS = [
    ("study_notes", "level", "VARCHAR(4) DEFAULT '基礎'"),
]


def ensure_schema() -> None:
    """create_all の後に、既存DBへ不足している列を追加する。

    create_all は既存テーブルに列を足さないため、モデルに列を追加したあとも
    古い study.db を持っているユーザーの環境では OperationalError になる。
    学習履歴(attempts)を消さずに追従できるよう、最小限の ALTER だけを行う。
    """
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    with engine.begin() as conn:
        for table, column, ddl in _ADDED_COLUMNS:
            if table not in existing_tables:
                continue
            columns = {c["name"] for c in inspector.get_columns(table)}
            if column in columns:
                continue
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
