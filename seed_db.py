"""シードデータ(問題・教本)をDBに投入するスクリプト。

各シード項目が持つ固定キー("key")で既存レコードと照合し、
    キーが既にある → 内容を更新(idは維持されるので解答履歴が残る)
    キーが無い     → 新規追加
という形で投入する。問題文の修正も、問題の追加も、学習履歴を壊さずに行える。

使い方:
    python seed_db.py           # 追加・更新(通常はこちら)
    python seed_db.py --reset   # DBを空にしてから投入(履歴も消える)
"""

import argparse
import json
from pathlib import Path

from sqlalchemy import text

from app.db import Base, SessionLocal, engine
from app.models import Attempt, ChoiceA, Question, StudyNote, TraceB

SEED_DIR = Path(__file__).resolve().parent / "data" / "seed"


def load_seed(filename: str) -> list[dict]:
    return json.loads((SEED_DIR / filename).read_text(encoding="utf-8"))


# --------------------------------------------------------------------------
# スキーマ移行
# --------------------------------------------------------------------------


def _column_exists(conn, table: str, column: str) -> bool:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return any(row[1] == column for row in rows)


def migrate_schema(seed_questions: list[dict], seed_notes: list[dict]) -> None:
    """key カラムを持たない旧スキーマのDBを、履歴を保ったまま移行する。

    旧DBの各行には key が無いため、問題文(body)が一致するシード項目のキーを
    割り当てて紐づけ直す。一致しなかった行には legacy-<id> を振り、
    履歴だけは残しつつ以降の更新対象から外す。
    """
    with engine.begin() as conn:
        for table, seeds, match_column in (
            ("questions", seed_questions, "body"),
            ("study_notes", seed_notes, "title"),
        ):
            if _column_exists(conn, table, "key"):
                continue

            print(f"[migrate] {table} に key カラムを追加しています...")
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN key VARCHAR(50)"))

            matched = 0
            for item in seeds:
                result = conn.execute(
                    text(
                        f"UPDATE {table} SET key = :key "
                        f"WHERE key IS NULL AND {match_column} = :value"
                    ),
                    {"key": item["key"], "value": item[match_column]},
                )
                matched += result.rowcount

            leftover = conn.execute(
                text(
                    f"UPDATE {table} SET key = 'legacy-' || id WHERE key IS NULL"
                )
            ).rowcount

            conn.execute(
                text(
                    f"CREATE UNIQUE INDEX IF NOT EXISTS ix_{table}_key "
                    f"ON {table}(key)"
                )
            )
            print(f"[migrate] {table}: {matched}件を既存データと紐づけ、{leftover}件を legacy 扱いにしました。")


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


def upsert_notes(db, items: list[dict]) -> tuple[int, int, int]:
    """教本を投入する。

    教本には学習履歴が紐づかない純粋なコンテンツなので、
    シードから消えたページはDBからも削除してよい(問題とは扱いが異なる)。
    """
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
        note.title = item["title"]
        note.body = item["body"]
        note.order = item.get("order", 0)

    seed_keys = {i["key"] for i in items}
    removed = 0
    for key, note in existing.items():
        if key not in seed_keys:
            db.delete(note)
            removed += 1

    return added, updated, removed


def report_orphans(db, seed_keys: set[str]) -> None:
    """シードから削除されたのにDBに残っている問題を通知する(自動削除はしない)。"""
    orphans = [
        q.key for q in db.query(Question) if q.key not in seed_keys
    ]
    if orphans:
        print(
            f"注意: シードに存在しない問題が {len(orphans)} 件DBに残っています "
            f"(履歴保護のため自動削除はしません): {', '.join(orphans[:5])}"
            + (" ..." if len(orphans) > 5 else "")
        )


# --------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--reset",
        action="store_true",
        help="DBを空にしてから投入する(解答履歴も削除されます)",
    )
    args = parser.parse_args()

    questions_a = load_seed("questions_a.json")
    questions_b = load_seed("questions_b.json")
    notes = load_seed("notes.json")

    Base.metadata.create_all(bind=engine)
    migrate_schema(questions_a + questions_b, notes)

    db = SessionLocal()
    try:
        if args.reset:
            attempts = db.query(Attempt).count()
            db.query(Attempt).delete()
            db.query(Question).delete()
            db.query(StudyNote).delete()
            db.commit()
            print(f"DBを初期化しました(解答履歴 {attempts} 件を削除)。")

        added_a, updated_a = upsert_questions(db, questions_a, "A")
        added_b, updated_b = upsert_questions(db, questions_b, "B")
        added_n, updated_n, removed_n = upsert_notes(db, notes)
        db.commit()

        print(
            f"科目A: 新規{added_a}件 / 更新{updated_a}件\n"
            f"科目B: 新規{added_b}件 / 更新{updated_b}件\n"
            f"教本  : 新規{added_n}件 / 更新{updated_n}件 / 削除{removed_n}件"
        )

        seed_keys = {i["key"] for i in questions_a + questions_b}
        report_orphans(db, seed_keys)

        kept = db.query(Attempt).count()
        print(f"解答履歴: {kept} 件を保持しています。")
    finally:
        db.close()


if __name__ == "__main__":
    main()
