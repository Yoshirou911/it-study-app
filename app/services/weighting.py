import random

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Attempt, Question


def category_weights(db: Session, subject: str) -> dict[str, float]:
    """分野ごとの出題重みを計算する。

    weight = (誤答数 + 1) / (出題数 + 2)
    出題実績が少ない/ない分野は 0.5 に近い重みになり、極端な偏りを避ける
    (ベイズ的な平滑化)。誤答が多い分野ほど重みが大きくなり、優先的に出題される。
    """
    categories = [
        row[0]
        for row in db.query(Question.category)
        .filter(Question.subject == subject)
        .distinct()
        .all()
    ]

    counts = dict(
        db.query(
            Question.category,
            func.count(Attempt.id),
        )
        .join(Attempt, Attempt.question_id == Question.id)
        .filter(Question.subject == subject)
        .group_by(Question.category)
        .all()
    )
    incorrects = dict(
        db.query(
            Question.category,
            func.count(Attempt.id),
        )
        .join(Attempt, Attempt.question_id == Question.id)
        .filter(Question.subject == subject, Attempt.is_correct.is_(False))
        .group_by(Question.category)
        .all()
    )

    weights: dict[str, float] = {}
    for category in categories:
        total = counts.get(category, 0)
        incorrect = incorrects.get(category, 0)
        weights[category] = (incorrect + 1) / (total + 2)
    return weights


def pick_category(db: Session, subject: str) -> str | None:
    weights = category_weights(db, subject)
    if not weights:
        return None
    categories = list(weights.keys())
    return random.choices(categories, weights=[weights[c] for c in categories], k=1)[0]


def select_next_question(
    db: Session, subject: str, exclude_id: int | None = None
) -> Question | None:
    category = pick_category(db, subject)
    if category is None:
        return None

    query = db.query(Question).filter(
        Question.subject == subject, Question.category == category
    )
    if exclude_id is not None:
        query = query.filter(Question.id != exclude_id)

    candidates = query.all()
    if not candidates:
        # 除外後に候補が0件になった場合は除外条件を外して再取得
        candidates = db.query(Question).filter(
            Question.subject == subject, Question.category == category
        ).all()
    if not candidates:
        return None
    return random.choice(candidates)
