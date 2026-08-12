"""シード問題データ・教本データをDBに投入するスクリプト。

使い方:
    python seed_db.py               # 未投入の場合のみ投入
    python seed_db.py --reset       # 既存データを全削除してから再投入(解答履歴も消える)
    python seed_db.py --reset-notes # 教本だけ再投入する(問題と解答履歴は保持)

教本は data/seed/notes/*.json に分野グループごとに分割して置く。
このディレクトリ内の全JSONを読み込むので、ファイルを追加するだけで教本を増やせる。
"""

import argparse
import json
from pathlib import Path

from app.category_groups import DEFAULT_LEVEL, LEVELS
from app.db import Base, SessionLocal, engine, ensure_schema
from app.models import Attempt, ChoiceA, Question, StudyNote, TraceB

SEED_DIR = Path(__file__).resolve().parent / "data" / "seed"
NOTES_DIR = SEED_DIR / "notes"


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


def load_notes(db, directory: Path) -> int:
    """ディレクトリ内の全JSONから教本ページを読み込む。"""
    count = 0
    for path in sorted(directory.glob("*.json")):
        items = json.loads(path.read_text(encoding="utf-8"))
        for item in items:
            level = item.get("level", DEFAULT_LEVEL)
            if level not in LEVELS:
                raise ValueError(
                    f"{path.name}: 不正な level '{level}' (許可: {'/'.join(LEVELS)})"
                )
            db.add(
                StudyNote(
                    category=item["category"],
                    level=level,
                    title=item["title"],
                    body=item["body"],
                    order=item.get("order", 0),
                )
            )
            count += 1
    return count


def reseed_notes(db) -> None:
    existing = db.query(StudyNote).count()
    if existing > 0:
        db.query(StudyNote).delete()
        print(f"既存の教本ページ {existing} 件を削除しました。")
    count = load_notes(db, NOTES_DIR)
    db.commit()
    print(f"教本ページ {count} 件を投入しました。")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--reset",
        action="store_true",
        help="既存データを全削除してから再投入する(解答履歴も消える)",
    )
    parser.add_argument(
        "--reset-notes",
        action="store_true",
        help="教本だけ再投入する(問題と解答履歴は保持)",
    )
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    ensure_schema()
    db = SessionLocal()
    try:
        if args.reset_notes:
            reseed_notes(db)
            return

        existing = db.query(Question).count()
        if existing > 0 and not args.reset:
            print(
                f"既に {existing} 件の問題が登録済みです。\n"
                "問題ごと再投入する場合は --reset、教本だけ更新する場合は --reset-notes を付けてください。"
            )
            return

        if args.reset and existing > 0:
            # 一括DELETEはORMのcascadeを通らず、SQLiteは既定でFKを強制しないため、
            # 子テーブルを明示的に消してから問題本体を消す(孤児レコード防止)。
            for model in (Attempt, ChoiceA, TraceB):
                db.query(model).delete()
            db.query(Question).delete()
            db.commit()
            print(f"既存の問題 {existing} 件(および解答履歴)を削除しました。")

        count_a = load_subject_a(db, SEED_DIR / "questions_a.json")
        count_b = load_subject_b(db, SEED_DIR / "questions_b.json")
        db.commit()
        print(f"科目A: {count_a}件、科目B: {count_b}件の問題を投入しました。")

        reseed_notes(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
