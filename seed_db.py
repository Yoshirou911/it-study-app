"""シード問題データをDBに投入するスクリプト。

使い方:
    python seed_db.py         # 未投入の場合のみ投入
    python seed_db.py --reset # 既存データを全削除してから再投入
"""

import argparse
import json
from pathlib import Path

from app.db import Base, SessionLocal, engine
from app.models import ChoiceA, Question, StudyNote, TraceB

SEED_DIR = Path(__file__).resolve().parent / "data" / "seed"


def load_subject_a(db, path: Path) -> int:
    items = json.loads(path.read_text(encoding="utf-8"))
    for item in items:
        question = Question(
            subject="A",
            category=item["category"],
            difficulty=item["difficulty"],
            body=item["body"],
            explanation=item.get("explanation"),
        )
        question.choices = [
            ChoiceA(label=c["label"], text=c["text"], is_correct=c["is_correct"])
            for c in item["choices"]
        ]
        db.add(question)
    return len(items)


def load_subject_b(db, path: Path) -> int:
    items = json.loads(path.read_text(encoding="utf-8"))
    for item in items:
        question = Question(
            subject="B",
            category=item["category"],
            difficulty=item["difficulty"],
            body=item["body"],
            explanation=item.get("explanation"),
        )
        question.trace = TraceB(
            pseudocode=item["pseudocode"],
            answer_type=item["answer_type"],
            expected_answer=item["expected_answer"],
            choices_json=json.dumps(item.get("choices"), ensure_ascii=False)
            if item.get("choices")
            else None,
        )
        db.add(question)
    return len(items)


def load_notes(db, path: Path) -> int:
    items = json.loads(path.read_text(encoding="utf-8"))
    for item in items:
        db.add(
            StudyNote(
                category=item["category"],
                title=item["title"],
                body=item["body"],
                order=item.get("order", 0),
            )
        )
    return len(items)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="既存データを削除してから再投入する")
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(Question).count()
        existing_notes = db.query(StudyNote).count()
        if existing > 0 and not args.reset:
            print(f"既に {existing} 件の問題が登録済みです。再投入する場合は --reset を付けてください。")
            return

        if args.reset:
            if existing > 0:
                db.query(Question).delete()
                print(f"既存の問題 {existing} 件を削除しました。")
            if existing_notes > 0:
                db.query(StudyNote).delete()
                print(f"既存の教本ページ {existing_notes} 件を削除しました。")
            db.commit()

        count_a = load_subject_a(db, SEED_DIR / "questions_a.json")
        count_b = load_subject_b(db, SEED_DIR / "questions_b.json")
        count_notes = load_notes(db, SEED_DIR / "notes.json")
        db.commit()
        print(
            f"科目A: {count_a}件、科目B: {count_b}件、教本ページ: {count_notes}件のシードデータを投入しました。"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
