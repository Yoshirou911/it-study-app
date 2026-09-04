"""プレイヤーランク(XPに応じたBronze〜Sovereignの総合ランク)。

分野別の正答率(S〜D、progress.py)とは別物。あちらは「どの分野が苦手か」を
示す診断だが、こちらは「これまでどれだけ積み上げてきたか」を示す進捗の
可視化で、科目や分野を横断した全解答が対象になる。

XPは専用のカラムを持たず、Attempt(解答履歴)からその場で計算する。
書き込み経路を増やさずに済み、採点ロジック(quiz.py)を変更する必要もない。
"""

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models import Attempt

# 正解・不正解それぞれで得られるXP。復習や模試での再挑戦も区別せず、
# 解答した回数だけ積み上がる(「解き続けること」自体を評価する設計)。
XP_PER_CORRECT = 10
XP_PER_INCORRECT = 2

# id: 内部識別子 / name: 英語表記 / label: 日本語表記
# xp_min: このランクに入るために必要な最低XP / color: バッジの基調色(将来の再デザインでも使う)
RANKS = [
    {"id": "bronze", "name": "BRONZE", "label": "ブロンズ", "xp_min": 0, "color": "#c98a4b"},
    {"id": "silver", "name": "SILVER", "label": "シルバー", "xp_min": 200, "color": "#a9b4c2"},
    {"id": "gold", "name": "GOLD", "label": "ゴールド", "xp_min": 500, "color": "#e0b23e"},
    {"id": "platinum", "name": "PLATINUM", "label": "プラチナ", "xp_min": 900, "color": "#5fd0c7"},
    {"id": "diamond", "name": "DIAMOND", "label": "ダイヤモンド", "xp_min": 1400, "color": "#6fb3ef"},
    {"id": "master", "name": "MASTER", "label": "マスター", "xp_min": 2000, "color": "#b083e0"},
    {"id": "sovereign", "name": "SOVEREIGN", "label": "ソヴリン", "xp_min": 3000, "color": "#e0577a"},
]


def compute_total_xp(db: Session) -> int:
    """全解答履歴(科目・分野を問わない)からXP合計を計算する。"""
    total = db.query(
        func.sum(
            case(
                (Attempt.is_correct.is_(True), XP_PER_CORRECT),
                else_=XP_PER_INCORRECT,
            )
        )
    ).scalar()
    return int(total or 0)


def get_player_rank(db: Session) -> dict:
    """現在のランク・次のランクまでの進捗を返す。"""
    xp = compute_total_xp(db)

    current = RANKS[0]
    for rank in RANKS:
        if xp >= rank["xp_min"]:
            current = rank

    current_index = RANKS.index(current)
    next_rank = RANKS[current_index + 1] if current_index + 1 < len(RANKS) else None

    if next_rank is None:
        progress_pct = 100
        remaining_xp = 0
    else:
        span = next_rank["xp_min"] - current["xp_min"]
        progress_pct = round((xp - current["xp_min"]) / span * 100) if span > 0 else 100
        remaining_xp = max(0, next_rank["xp_min"] - xp)

    return {
        "xp": xp,
        "current": current,
        "next": next_rank,
        "progress_pct": max(0, min(100, progress_pct)),
        "remaining_xp": remaining_xp,
    }
