from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Attempt, Question
from app.schemas import CategoryStat, ProgressSummary

router = APIRouter(prefix="/api/progress", tags=["progress"])


@router.get("/summary", response_model=ProgressSummary)
def summary(subject: str, db: Session = Depends(get_db)):
    if subject not in ("A", "B"):
        raise HTTPException(status_code=400, detail="subject must be 'A' or 'B'")

    rows = (
        db.query(
            Question.category,
            func.count(Attempt.id),
            func.sum(case((Attempt.is_correct.is_(True), 1), else_=0)),
        )
        .join(Attempt, Attempt.question_id == Question.id)
        .filter(Question.subject == subject)
        .group_by(Question.category)
        .all()
    )

    stats = []
    for category, total, correct in rows:
        correct = correct or 0
        stats.append(
            CategoryStat(
                category=category,
                total=total,
                correct=correct,
                accuracy=round(correct / total, 3) if total else 0.0,
            )
        )
    stats.sort(key=lambda s: s.accuracy)
    return ProgressSummary(stats=stats)
