"""間隔反復(スペースドリペティション)による復習スケジュール。

正解するたびに次の復習日を先送りにし(1→3→7→14→30→60日)、不正解なら
連続正解数を0に戻して即日また出題対象にする。この状態は専用テーブルを
持たず、Attempt(解答履歴)を時系列に再生して毎回その場で計算する。

書き込み用の状態を別テーブルで持つと「解答履歴とずれる」「移行が必要になる」
という問題が起きやすい。Attemptから導出する方式なら、履歴さえ正しければ
常に正しい状態が得られ、書き込み経路のバグも生まれない。
"""

import datetime

from sqlalchemy.orm import Session

from app.models import Attempt, Question

# 連続正解数(streak)に応じた次回復習までの日数。
REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30, 60]
MAX_STREAK = len(REVIEW_INTERVAL_DAYS)


def _compute_states(db: Session, subject: str) -> dict[int, tuple[datetime.datetime, int]]:
    """question_id -> (最終解答日時, 連続正解数) の対応表を作る。

    1問ずつ問い合わせるとN+1になるため、対象科目の解答履歴を1回のクエリで
    まとめて取得し、Python側で問題ごとに時系列を再生する。
    """
    rows = (
        db.query(Attempt.question_id, Attempt.is_correct, Attempt.answered_at)
        .join(Question, Question.id == Attempt.question_id)
        .filter(Question.subject == subject)
        .order_by(Attempt.question_id, Attempt.answered_at)
        .all()
    )

    states: dict[int, tuple[datetime.datetime, int]] = {}
    streak = 0
    current_id = None
    last_at = None
    for question_id, is_correct, answered_at in rows:
        if question_id != current_id:
            if current_id is not None:
                states[current_id] = (last_at, streak)
            current_id = question_id
            streak = 0
        streak = min(streak + 1, MAX_STREAK) if is_correct else 0
        last_at = answered_at
    if current_id is not None:
        states[current_id] = (last_at, streak)
    return states


def _due_at(last_at: datetime.datetime, streak: int) -> datetime.datetime:
    days = REVIEW_INTERVAL_DAYS[streak - 1] if streak > 0 else 0
    return last_at + datetime.timedelta(days=days)


def get_due_question_ids(db: Session, subject: str, now: datetime.datetime | None = None) -> list[int]:
    """復習期日を過ぎている問題のidを、期日が古い順(同着ならstreakが低い順)で返す。"""
    now = now or datetime.datetime.utcnow()
    states = _compute_states(db, subject)
    due = [
        (question_id, _due_at(last_at, streak), streak)
        for question_id, (last_at, streak) in states.items()
        if _due_at(last_at, streak) <= now
    ]
    due.sort(key=lambda row: (row[1], row[2]))
    return [row[0] for row in due]


def get_review_summary(db: Session, subject: str, now: datetime.datetime | None = None) -> dict:
    """ダッシュボード表示用の集計。due/scheduled/masteredの3指標を返す。"""
    now = now or datetime.datetime.utcnow()
    states = _compute_states(db, subject)
    total_questions = db.query(Question).filter(Question.subject == subject).count()

    scheduled = len(states)
    due = sum(1 for _, (last_at, streak) in states.items() if _due_at(last_at, streak) <= now)
    mastered = sum(1 for _, (_, streak) in states.items() if streak >= MAX_STREAK)
    return {
        "due": due,
        "scheduled": scheduled,
        "mastered": mastered,
        "untracked": max(0, total_questions - scheduled),
    }
