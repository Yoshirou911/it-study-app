"""模試(まとまった構成比の問題セット)。

分野を横断してランダムに出す通常演習とは違い、模試は「毎回同じ構成の
問題セット」を、時間を計って通しで解く体験を提供する。セットの中身は
固定シード付き乱数で選ぶため、同じセット番号なら常に同じ問題(の同じ並び)
になる。問題を追加してもセット定義そのものは変えずに済むよう、
分野ごとの目標問題数だけをここで定義する。
"""

import random

from sqlalchemy.orm import Session

from app.models import Question

# セットごとの総問題数の目安。IPA本番(科目A 60問/90分、科目B 20問/100分)より
# 小さくしているのは、現状の保有問題数(科目Aは分野ごとに数問)で全分野を
# 網羅しつつ、同じ問題ばかり繰り返さない範囲に収めるため。
SUBJECT_TARGET_SIZE = {"A": 40, "B": 20}
TIME_LIMIT_MINUTES = {"A": 60, "B": 40}

# 定義済みの模試セット番号。setごとに乱数シードを変えることで、
# 「セット1とセット2で違う問題」を再現可能に保つ。
AVAILABLE_SETS = {"A": [1, 2], "B": [1, 2]}


def build_mock_exam(db: Session, subject: str, set_number: int) -> list[Question]:
    """分野をできるだけ均等にカバーしながら、目標数までseed固定で抽出する。"""
    if set_number not in AVAILABLE_SETS.get(subject, []):
        raise ValueError(f"未定義の模試セットです: subject={subject} set={set_number}")

    questions = db.query(Question).filter(Question.subject == subject).order_by(Question.key).all()
    by_category: dict[str, list[Question]] = {}
    for q in questions:
        by_category.setdefault(q.category, []).append(q)

    rng = random.Random(f"mock-{subject}-{set_number}")
    for bucket in by_category.values():
        rng.shuffle(bucket)

    target = SUBJECT_TARGET_SIZE[subject]
    categories = sorted(by_category.keys())
    picked: list[Question] = []
    cursor = {c: 0 for c in categories}

    # 分野を1周ずつ回しながら1問ずつ取る(ラウンドロビン)ことで、
    # 特定分野に偏らせず、全分野をなるべく満遍なくカバーする。
    while len(picked) < target and categories:
        progressed = False
        for category in categories:
            if len(picked) >= target:
                break
            bucket = by_category[category]
            i = cursor[category]
            if i < len(bucket):
                picked.append(bucket[i])
                cursor[category] = i + 1
                progressed = True
        if not progressed:
            break

    rng.shuffle(picked)
    return picked
