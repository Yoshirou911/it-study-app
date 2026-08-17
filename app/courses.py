"""学習コースの定義。

コースは分野グループ(category_groups の GROUP_ORDER)の組み合わせとして定義する。
将来 応用情報技術者試験 などを追加する場合も、ここに1エントリ足すだけでよい。
"""

from app.category_groups import CATEGORY_TO_GROUP

COURSES = [
    {
        "id": "fe",
        "name": "基本情報技術者試験",
        "subtitle": "科目A・科目B対策",
        "description": "IPAの出題範囲に沿って、テクノロジ系・マネジメント系・ストラテジ系を体系的に学ぶ。",
        "groups": ["テクノロジ系", "マネジメント系", "ストラテジ系"],
        "subjects": ["A", "B"],
    },
    {
        "id": "practical",
        "name": "実務IT知識",
        "subtitle": "現場で使う知識",
        "description": "資格試験の範囲を超えて、クラウド・Web技術・AIなど実務で必要になる知識を学ぶ。",
        "groups": ["実務IT知識"],
        "subjects": ["A"],
    },
]

_BY_ID = {c["id"]: c for c in COURSES}


def get_course(course_id: str) -> dict | None:
    return _BY_ID.get(course_id)


def categories_of(course_id: str) -> list[str]:
    """コースに属する分野名の一覧を返す。未知のIDなら空リスト。"""
    course = _BY_ID.get(course_id)
    if course is None:
        return []
    groups = set(course["groups"])
    return [c for c, g in CATEGORY_TO_GROUP.items() if g in groups]
