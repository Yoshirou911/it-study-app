from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.courses import categories_of
from app.db import get_db
from app.models import Attempt, Question
from app.schemas import AnswerIn, AnswerResult, ChoiceOut, QuestionOut
from app.services.grading import get_grader
from app.services.weighting import select_next_question

router = APIRouter(prefix="/api/quiz", tags=["quiz"])


def _to_question_out(question: Question) -> QuestionOut:
    return QuestionOut(
        id=question.id,
        subject=question.subject,
        category=question.category,
        difficulty=question.difficulty,
        body=question.body,
        pseudocode=question.trace.pseudocode if question.subject == "B" else None,
        choices=[ChoiceOut.model_validate(c) for c in question.choices]
        if question.subject == "A"
        else [],
    )


@router.get("/next", response_model=QuestionOut)
def next_question(
    subject: str,
    exclude_id: int | None = None,
    course: str | None = None,
    db: Session = Depends(get_db),
):
    if subject not in ("A", "B"):
        raise HTTPException(status_code=400, detail="subject must be 'A' or 'B'")

    categories = categories_of(course) if course else None
    question = select_next_question(
        db, subject, exclude_id=exclude_id, categories=categories
    )
    if question is None:
        raise HTTPException(status_code=404, detail="出題可能な問題がありません")
    return _to_question_out(question)


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
