"""日別の学習統計と「今日の10問」。

日別の解答数・正答数はAttemptから直接集計する(専用のカウンタテーブルを
持たない)。連続学習日数も同様に、解答のあった日付の集合から計算する。
「今日の10問」だけは選定結果そのものを固定する必要があるため、
DailyPlanテーブルに保存する。
"""

import datetime
import json
import random

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models import Attempt, DailyPlan, Question

DAILY_PLAN_SIZE = 10


def today_key(now: datetime.datetime | None = None) -> str:
    return (now or datetime.datetime.utcnow()).strftime("%Y-%m-%d")


def get_daily_stats(db: Session, subject: str, days: int = 30) -> list[dict]:
    """直近days日分の {date, answered, correct} を、古い日から順に返す。"""
    since = datetime.datetime.utcnow() - datetime.timedelta(days=days - 1)
    rows = (
        db.query(
            func.date(Attempt.answered_at).label("day"),
            func.count(Attempt.id),
            func.sum(case((Attempt.is_correct.is_(True), 1), else_=0)),
        )
        .join(Question, Question.id == Attempt.question_id)
        .filter(Question.subject == subject, Attempt.answered_at >= since)
        .group_by("day")
        .all()
    )
    by_day = {day: (answered, correct or 0) for day, answered, correct in rows}

    result = []
    for i in range(days):
        day = (since + datetime.timedelta(days=i)).strftime("%Y-%m-%d")
        answered, correct = by_day.get(day, (0, 0))
        result.append({"date": day, "answered": answered, "correct": correct})
    return result


def get_streak_days(db: Session, subject: str) -> int:
    """当日を含め、連続して解答した日数を数える。

    当日ぶんはまだ0問でも「前日までの連続記録」が途切れないようにする
    (学習を始める前の時点で「昨日までの連続記録」がリセットされて見えるのを防ぐ)。
    """
    rows = (
        db.query(func.date(Attempt.answered_at))
        .join(Question, Question.id == Attempt.question_id)
        .filter(Question.subject == subject)
        .distinct()
        .all()
    )
    active_days = {row[0] for row in rows}
    if not active_days:
        return 0

    today = datetime.date.today()
    cursor = today if today.isoformat() in active_days else today - datetime.timedelta(days=1)
    if cursor.isoformat() not in active_days:
        return 0

    streak = 0
    while cursor.isoformat() in active_days:
        streak += 1
        cursor -= datetime.timedelta(days=1)
    return streak


def _select_daily_questions(db: Session, subject: str) -> list[int]:
    """優先順位: 直近の解答が不正解 > 未回答 > 正解済み。各層の中はランダム。"""
    questions = db.query(Question).filter(Question.subject == subject).all()
    if not questions:
        return []

    latest_result: dict[int, bool] = {}
    rows = (
        db.query(Attempt.question_id, Attempt.is_correct, Attempt.answered_at)
        .join(Question, Question.id == Attempt.question_id)
        .filter(Question.subject == subject)
        .order_by(Attempt.answered_at)
        .all()
    )
    for question_id, is_correct, _ in rows:
        latest_result[question_id] = is_correct  # 後の行ほど新しいので上書きでOK

    wrong, unanswered, correct = [], [], []
    for q in questions:
        result = latest_result.get(q.id)
        if result is False:
            wrong.append(q.id)
        elif result is None:
            unanswered.append(q.id)
        else:
            correct.append(q.id)

    random.shuffle(wrong)
    random.shuffle(unanswered)
    random.shuffle(correct)

    picked = (wrong + unanswered + correct)[:DAILY_PLAN_SIZE]
    return picked


def get_or_create_daily_plan(db: Session, subject: str) -> list[int]:
    """今日ぶんの10問を返す。無ければ選定して保存する(同日中は固定)。"""
    date = today_key()
    plan = (
        db.query(DailyPlan)
        .filter(DailyPlan.date == date, DailyPlan.subject == subject)
        .first()
    )
    if plan is not None:
        return json.loads(plan.question_ids_json)

    question_ids = _select_daily_questions(db, subject)
    db.add(
        DailyPlan(
            date=date,
            subject=subject,
            question_ids_json=json.dumps(question_ids),
        )
    )
    db.commit()
    return question_ids
