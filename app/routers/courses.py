from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.courses import COURSES, categories_of
from app.db import get_db
from app.models import Question, StudyNote
from app.schemas import CourseOut

router = APIRouter(prefix="/api/courses", tags=["courses"])


@router.get("", response_model=list[CourseOut])
def list_courses(db: Session = Depends(get_db)):
    question_counts = dict(
        db.query(Question.category, func.count(Question.id))
        .group_by(Question.category)
        .all()
    )
    chapter_counts = dict(
        db.query(StudyNote.category, func.count(StudyNote.id))
        .group_by(StudyNote.category)
        .all()
    )

    result = []
    for course in COURSES:
        categories = categories_of(course["id"])
        result.append(
            CourseOut(
                id=course["id"],
                name=course["name"],
                subtitle=course["subtitle"],
                description=course["description"],
                subjects=course["subjects"],
                category_count=len(categories),
                question_count=sum(question_counts.get(c, 0) for c in categories),
                chapter_count=sum(chapter_counts.get(c, 0) for c in categories),
            )
        )
    return result
