from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.category_groups import LEVELS, group_categories
from app.db import get_db
from app.models import StudyNote
from app.schemas import CategoryGroupOut, CurriculumOut, NoteOut

router = APIRouter(prefix="/api/notes", tags=["notes"])


@router.get("/curriculum", response_model=list[CurriculumOut])
def curriculum(db: Session = Depends(get_db)):
    """レベル→大分類→分野 の3階層をまとめて返す。

    教本タブのナビゲーションは一度これを取得すれば、レベル切り替えのたびに
    再取得せずに描画できる。
    """
    rows = db.query(StudyNote.level, StudyNote.category).distinct().all()

    by_level: dict[str, list[str]] = {}
    for level, category in rows:
        by_level.setdefault(level, []).append(category)

    ordered_levels = [lv for lv in LEVELS if lv in by_level] + [
        lv for lv in by_level if lv not in LEVELS
    ]
    return [
        CurriculumOut(
            level=level,
            groups=[
                CategoryGroupOut(**g) for g in group_categories(by_level[level])
            ],
        )
        for level in ordered_levels
    ]


@router.get("", response_model=list[NoteOut])
def list_notes(
    category: str | None = None,
    level: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(StudyNote)
    if category:
        query = query.filter(StudyNote.category == category)
    if level:
        query = query.filter(StudyNote.level == level)
    notes = query.order_by(StudyNote.category, StudyNote.order).all()
    return [NoteOut.model_validate(n) for n in notes]
