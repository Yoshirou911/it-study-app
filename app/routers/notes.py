from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.category_groups import group_categories
from app.db import get_db
from app.models import StudyNote
from app.schemas import CategoryGroupOut, NoteOut

router = APIRouter(prefix="/api/notes", tags=["notes"])


@router.get("/categories", response_model=list[CategoryGroupOut])
def list_categories(db: Session = Depends(get_db)):
    rows = db.query(StudyNote.category).distinct().all()
    return group_categories([r[0] for r in rows])


@router.get("", response_model=list[NoteOut])
def list_notes(category: str | None = None, db: Session = Depends(get_db)):
    query = db.query(StudyNote)
    if category:
        query = query.filter(StudyNote.category == category)
    notes = query.order_by(StudyNote.category, StudyNote.order).all()
    return [NoteOut.model_validate(n) for n in notes]
