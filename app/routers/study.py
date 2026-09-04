"""復習(間隔反復)・今日の10問・模試のエンドポイント。

出題(quiz.py)と採点(POST /api/quiz/answer)の仕組みはそのまま使い、
「次にどの問題を出すか」の選び方だけをここで増やしている。
"""

import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Attempt, Question
from app.schemas import (
    DailyPlanOut,
    DailyStatsOut,
    MockExamOut,
    MockExamSetOut,
    PlayerRankOut,
    QuestionOut,
    ReviewSummaryOut,
)
from app.services import daily, mock_exam, rank, review
from app.services.questions import to_question_out

router = APIRouter(prefix="/api/study", tags=["study"])


# ---------------------------------------------------------------------------
# プレイヤーランク(XPに応じたBronze〜Sovereignの総合ランク)
# ---------------------------------------------------------------------------


@router.get("/rank", response_model=PlayerRankOut)
def player_rank(db: Session = Depends(get_db)):
    return rank.get_player_rank(db)


def _require_subject(subject: str) -> None:
    if subject not in ("A", "B"):
        raise HTTPException(status_code=400, detail="subject must be 'A' or 'B'")


# ---------------------------------------------------------------------------
# 復習(間隔反復)
# ---------------------------------------------------------------------------


@router.get("/review/summary", response_model=ReviewSummaryOut)
def review_summary(subject: str, db: Session = Depends(get_db)):
    _require_subject(subject)
    return review.get_review_summary(db, subject)


@router.get("/review/next", response_model=QuestionOut)
def review_next(subject: str, db: Session = Depends(get_db)):
    _require_subject(subject)
    due_ids = review.get_due_question_ids(db, subject)
    if not due_ids:
        raise HTTPException(status_code=404, detail="復習対象の問題がありません")
    question = db.get(Question, due_ids[0])
    return to_question_out(question)


# ---------------------------------------------------------------------------
# 今日の10問
# ---------------------------------------------------------------------------


@router.get("/daily/plan", response_model=DailyPlanOut)
def daily_plan(subject: str, db: Session = Depends(get_db)):
    _require_subject(subject)
    question_ids = daily.get_or_create_daily_plan(db, subject)
    questions = [db.get(Question, qid) for qid in question_ids]
    questions = [q for q in questions if q is not None]  # 万一削除されていたら除く

    today = daily.today_key()
    tomorrow = (datetime.datetime.strptime(today, "%Y-%m-%d") + datetime.timedelta(days=1)).strftime(
        "%Y-%m-%d"
    )
    answered_today = {
        row[0]
        for row in db.query(Attempt.question_id)
        .filter(
            Attempt.question_id.in_(question_ids),
            Attempt.answered_at >= today,
            Attempt.answered_at < tomorrow,
        )
        .distinct()
        .all()
    }

    return DailyPlanOut(
        date=today,
        questions=[to_question_out(q) for q in questions],
        answered_today=sorted(answered_today),
    )


@router.get("/daily/stats", response_model=DailyStatsOut)
def daily_stats(subject: str, days: int = 30, db: Session = Depends(get_db)):
    _require_subject(subject)
    days = max(1, min(days, 180))
    return DailyStatsOut(
        streak_days=daily.get_streak_days(db, subject),
        days=daily.get_daily_stats(db, subject, days),
    )


# ---------------------------------------------------------------------------
# 模試
# ---------------------------------------------------------------------------


@router.get("/mock/sets", response_model=list[MockExamSetOut])
def mock_sets(subject: str):
    _require_subject(subject)
    return [
        MockExamSetOut(
            set_number=n,
            size=mock_exam.SUBJECT_TARGET_SIZE[subject],
            time_limit_minutes=mock_exam.TIME_LIMIT_MINUTES[subject],
        )
        for n in mock_exam.AVAILABLE_SETS[subject]
    ]


@router.get("/mock/start", response_model=MockExamOut)
def mock_start(subject: str, set: int, db: Session = Depends(get_db)):
    _require_subject(subject)
    try:
        questions = mock_exam.build_mock_exam(db, subject, set)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return MockExamOut(
        set_number=set,
        time_limit_minutes=mock_exam.TIME_LIMIT_MINUTES[subject],
        questions=[to_question_out(q) for q in questions],
    )
