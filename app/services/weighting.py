import random

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Attempt, Question


def category_weights(
    db: Session, subject: str, difficulty_range: tuple[int, int] | None = None
) -> dict[str, float]:
    """分野ごとの出題重みを計算する。

    weight = (誤答数 + 1) / (出題数 + 2)
    出題実績が少ない/ない分野は 0.5 に近い重みになり、極端な偏りを避ける
    (ベイズ的な平滑化)。誤答が多い分野ほど重みが大きくなり、優先的に出題される。

    difficulty_range を渡すと、その難易度帯(ランク練習モード)の問題だけを
    対象に絞って計算する。
    """
    base_query = db.query(Question).filter(Question.subject == subject)
    if difficulty_range is not None:
        lo, hi = difficulty_range
        base_query = base_query.filter(Question.difficulty >= lo, Question.difficulty <= hi)

    categories = [row[0] for row in base_query.with_entities(Question.category).distinct().all()]

    attempt_query = (
        db.query(Question.category, func.count(Attempt.id))
        .join(Attempt, Attempt.question_id == Question.id)
        .filter(Question.subject == subject)
    )
    if difficulty_range is not None:
        lo, hi = difficulty_range
        attempt_query = attempt_query.filter(Question.difficulty >= lo, Question.difficulty <= hi)

    counts = dict(attempt_query.group_by(Question.category).all())
    incorrects = dict(
        attempt_query.filter(Attempt.is_correct.is_(False)).group_by(Question.category).all()
    )

    weights: dict[str, float] = {}
    for category in categories:
        total = counts.get(category, 0)
        incorrect = incorrects.get(category, 0)
        weights[category] = (incorrect + 1) / (total + 2)
    return weights


def pick_category(
    db: Session, subject: str, difficulty_range: tuple[int, int] | None = None
) -> str | None:
    weights = category_weights(db, subject, difficulty_range)
    if not weights:
        return None
    categories = list(weights.keys())
    return random.choices(categories, weights=[weights[c] for c in categories], k=1)[0]


def select_next_question(
    db: Session,
    subject: str,
    exclude_id: int | None = None,
    difficulty_range: tuple[int, int] | None = None,
) -> Question | None:
    category = pick_category(db, subject, difficulty_range)
    if category is None:
        return None

    def _candidates(exclude: int | None):
        query = db.query(Question).filter(
            Question.subject == subject, Question.category == category
        )
        if difficulty_range is not None:
            lo, hi = difficulty_range
            query = query.filter(Question.difficulty >= lo, Question.difficulty <= hi)
        if exclude is not None:
            query = query.filter(Question.id != exclude)
        return query.all()

    candidates = _candidates(exclude_id)
    if not candidates:
        # 除外後に候補が0件になった場合は除外条件を外して再取得
        candidates = _candidates(None)
    if not candidates:
        return None
    return random.choice(candidates)
