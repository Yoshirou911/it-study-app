from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Attempt, Question
from app.schemas import AnswerIn, AnswerResult, QuestionOut
from app.services.grading import get_grader
from app.services.questions import to_question_out
from app.services.weighting import select_next_question

router = APIRouter(prefix="/api/quiz", tags=["quiz"])


@router.get("/next", response_model=QuestionOut)
def next_question(subject: str, exclude_id: int | None = None, db: Session = Depends(get_db)):
    if subject not in ("A", "B"):
        raise HTTPException(status_code=400, detail="subject must be 'A' or 'B'")

    question = select_next_question(db, subject, exclude_id=exclude_id)
    if question is None:
        raise HTTPException(status_code=404, detail="出題可能な問題がありません")
    return to_question_out(question)


@router.post("/answer", response_model=AnswerResult)
def answer_question(payload: AnswerIn, db: Session = Depends(get_db)):
    question = db.get(Question, payload.question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="問題が見つかりません")

    grader = get_grader(question)
    result = grader.grade(question, payload.user_answer)

    db.add(
        Attempt(
            question_id=question.id,
            user_answer=payload.user_answer,
            is_correct=result.correct,
        )
    )
    db.commit()

    return AnswerResult(
        correct=result.correct,
        correct_answer=result.correct_answer,
        explanation=question.explanation,
    )
