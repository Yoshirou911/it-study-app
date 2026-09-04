"""シードデータ(問題・教本)をDBに投入するスクリプト。

各シード項目が持つ固定キー("key")で既存レコードと照合し、

    キーが既にある → 内容を更新する(idは維持されるので解答履歴が残る)
    キーが無い     → 新規追加する

という形で投入する。問題文の修正も、問題の追加も、学習履歴を壊さずに行える。

使い方:
    python seed_db.py           # 追加・更新(通常はこちら)
    python seed_db.py --reset   # DBを空にしてから投入する(解答履歴も消える)

教本は data/seed/notes/*.json に分野グループごとに分割して置く。
このディレクトリ内の全JSONを読み込むので、ファイルを追加するだけで教本を増やせる。

キーの命名は `<分野スラッグ>-<連番>` で統一している(例: nw-05)。科目Bは
先頭に b- を付け(例: b-algo-05)、教本は note- を付ける(例: note-basic-nw-05)。
既存データにキーを足す/確認する場合は tools/assign_keys.py を使う。
一度公開したキーは変更しないこと(変更すると別問題として扱われ履歴が切れる)。
"""

import argparse
import json
from pathlib import Path

from sqlalchemy import text

from app.category_groups import DEFAULT_LEVEL, LEVELS
from app.db import Base, SessionLocal, engine, ensure_schema
from app.models import Attempt, ChoiceA, Question, StudyNote, TraceB

SEED_DIR = Path(__file__).resolve().parent / "data" / "seed"
NOTES_DIR = SEED_DIR / "notes"


def load_json(path: Path) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_notes_seed() -> list[dict]:
    """notes/ 配下の全JSONを1つのリストにまとめて読み込む。"""
    items: list[dict] = []
    for path in sorted(NOTES_DIR.glob("*.json")):
        for item in load_json(path):
            level = item.get("level", DEFAULT_LEVEL)
            if level not in LEVELS:
                raise ValueError(
                    f"{path.name}: 不正な level '{level}' (許可: {'/'.join(LEVELS)})"
                )
            items.append(item)
    return items


# --------------------------------------------------------------------------
# スキーマ移行
# --------------------------------------------------------------------------


def _column_exists(conn, table: str, column: str) -> bool:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return any(row[1] == column for row in rows)


def _index_exists(conn, index_name: str) -> bool:
    row = conn.execute(
        text("SELECT 1 FROM sqlite_master WHERE type='index' AND name=:n"),
        {"n": index_name},
    ).fetchone()
    return row is not None


def migrate_schema(seed_questions: list[dict], seed_notes: list[dict]) -> None:
    """key列を持たない旧DBを、履歴を保ったまま移行する。

    ensure_schema() が key 列自体は(NULL許容で)追加済みの前提。ここでは、
    まだ key が割り当てられていない既存行に、シードデータと本文(問題は body、
    教本は category+title)を突き合わせてキーを割り当て、そのうえで
    UNIQUEインデックスを作る。一致しなかった行には legacy-<id> を振り、
    履歴だけは残しつつ以降の更新対象から外す。
    """
    with engine.begin() as conn:
        # questions: body で照合
        unmatched = conn.execute(
            text("SELECT id, body FROM questions WHERE key IS NULL")
        ).fetchall()
        if unmatched:
            by_body: dict[str, str] = {}
            for item in seed_questions:
                by_body.setdefault(item["body"], item["key"])
            matched = 0
            for row_id, body in unmatched:
                key = by_body.get(body, f"legacy-{row_id}")
                if key in by_body.values():
                    matched += 1
                conn.execute(
                    text("UPDATE questions SET key = :key WHERE id = :id"),
                    {"key": key, "id": row_id},
                )
            print(f"[migrate] questions: {matched}件を既存データと紐づけました。")

        if not _index_exists(conn, "ix_questions_key_unique"):
            conn.execute(
                text("CREATE UNIQUE INDEX ix_questions_key_unique ON questions(key)")
            )

        # study_notes: (category, title) で照合
        unmatched_notes = conn.execute(
            text("SELECT id, category, title FROM study_notes WHERE key IS NULL")
        ).fetchall()
        if unmatched_notes:
            by_title: dict[tuple[str, str], str] = {}
            for item in seed_notes:
                by_title.setdefault((item["category"], item["title"]), item["key"])
            matched = 0
            for row_id, category, title in unmatched_notes:
                key = by_title.get((category, title), f"legacy-{row_id}")
                if key in by_title.values():
                    matched += 1
                conn.execute(
                    text("UPDATE study_notes SET key = :key WHERE id = :id"),
                    {"key": key, "id": row_id},
                )
            print(f"[migrate] study_notes: {matched}件を既存データと紐づけました。")

        if not _index_exists(conn, "ix_study_notes_key_unique"):
            conn.execute(
                text("CREATE UNIQUE INDEX ix_study_notes_key_unique ON study_notes(key)")
            )


# --------------------------------------------------------------------------
# upsert
# --------------------------------------------------------------------------


def upsert_questions(db, items: list[dict], subject: str) -> tuple[int, int]:
    existing = {q.key: q for q in db.query(Question).filter(Question.subject == subject)}
    added = updated = 0

    for item in items:
        question = existing.get(item["key"])
        if question is None:
            question = Question(key=item["key"], subject=subject)
            db.add(question)
            added += 1
        else:
            updated += 1

        question.category = item["category"]
        question.difficulty = item["difficulty"]
        question.body = item["body"]
        question.explanation = item.get("explanation")

        if subject == "A":
            # 選択肢には履歴が紐づかないため、毎回作り直して問題ない
            question.choices = [
                ChoiceA(label=c["label"], text=c["text"], is_correct=c["is_correct"])
                for c in item["choices"]
            ]
        else:
            trace = question.trace or TraceB()
            trace.pseudocode = item["pseudocode"]
            trace.answer_type = item["answer_type"]
            trace.expected_answer = item["expected_answer"]
            trace.choices_json = (
                json.dumps(item["choices"], ensure_ascii=False)
                if item.get("choices")
                else None
            )
            question.trace = trace

    return added, updated


def upsert_notes(db, items: list[dict]) -> tuple[int, int]:
    existing = {n.key: n for n in db.query(StudyNote)}
    added = updated = 0

    for item in items:
        note = existing.get(item["key"])
        if note is None:
            note = StudyNote(key=item["key"])
            db.add(note)
            added += 1
        else:
            updated += 1

        note.category = item["category"]
        note.level = item.get("level", DEFAULT_LEVEL)
        note.title = item["title"]
        note.body = item["body"]
        note.order = item.get("order", 0)

    return added, updated


def report_orphans(db, seed_keys: set[str]) -> None:
    """シードから削除されたのにDBに残っている問題を知らせる(自動削除はしない)。"""
    orphans = [q.key for q in db.query(Question) if q.key not in seed_keys]
    if orphans:
        print(
            f"注意: シードに存在しない問題が {len(orphans)} 件DBに残っています "
            f"(履歴保護のため自動削除はしません): {', '.join(orphans[:5])}"
            + (" ..." if len(orphans) > 5 else "")
        )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--reset",
        action="store_true",
        help="DBを空にしてから投入する(解答履歴も削除される)",
    )
    args = parser.parse_args()

    questions_a = load_json(SEED_DIR / "questions_a.json")
    questions_b = load_json(SEED_DIR / "questions_b.json")
    notes = load_notes_seed()

    Base.metadata.create_all(bind=engine)
    ensure_schema()
    migrate_schema(questions_a + questions_b, notes)

    db = SessionLocal()
    try:
        if args.reset:
            attempts = db.query(Attempt).count()
            # 一括DELETEはORMのcascadeを通らず、SQLiteは既定でFKを強制しないため、
            # 子テーブルを明示的に消してから親を消す(孤児レコード防止)。
            for model in (Attempt, ChoiceA, TraceB):
                db.query(model).delete()
            db.query(Question).delete()
            db.query(StudyNote).delete()
            db.commit()
            print(f"DBを初期化しました(解答履歴 {attempts} 件を削除)。")

        added_a, updated_a = upsert_questions(db, questions_a, "A")
        added_b, updated_b = upsert_questions(db, questions_b, "B")
        added_n, updated_n = upsert_notes(db, notes)
        db.commit()

        print(
            f"科目A: 新規{added_a}件 / 更新{updated_a}件\n"
            f"科目B: 新規{added_b}件 / 更新{updated_b}件\n"
            f"教本  : 新規{added_n}件 / 更新{updated_n}件"
        )

        seed_keys = {i["key"] for i in questions_a + questions_b}
        report_orphans(db, seed_keys)

        kept = db.query(Attempt).count()
        print(f"解答履歴: {kept} 件を保持しています。")
    finally:
        db.close()


if __name__ == "__main__":
    main()
