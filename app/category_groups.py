"""分野(category)を大分類(group)へ分類するための静的なタクソノミー。

基本情報技術者試験 科目Aのシラバス区分(テクノロジ系/マネジメント系/ストラテジ系)に加え、
試験範囲に閉じない実務知識の分野として「実務IT知識」を設けている。
"""

GROUP_ORDER = ["テクノロジ系", "マネジメント系", "ストラテジ系", "実務IT知識", "その他"]

CATEGORY_TO_GROUP = {
    "基礎理論": "テクノロジ系",
    "コンピュータ構成要素": "テクノロジ系",
    "ソフトウェア": "テクノロジ系",
    "ネットワーク": "テクノロジ系",
    "データベース": "テクノロジ系",
    "セキュリティ": "テクノロジ系",
    "アルゴリズム": "テクノロジ系",
    "システム開発技術": "テクノロジ系",
    "Linux": "テクノロジ系",
    "プロジェクトマネジメント": "マネジメント系",
    "サービスマネジメント": "マネジメント系",
    "システム戦略": "ストラテジ系",
    "経営戦略・法務": "ストラテジ系",
    "クラウド": "実務IT知識",
    "Web技術": "実務IT知識",
    "AI・データ活用": "実務IT知識",
}


def group_of(category: str) -> str:
    return CATEGORY_TO_GROUP.get(category, "その他")


def group_categories(categories: list[str]) -> list[dict]:
    """カテゴリのリストをグループごとにまとめ、GROUP_ORDER順・カテゴリ名順で返す。"""
    buckets: dict[str, list[str]] = {}
    for category in categories:
        buckets.setdefault(group_of(category), []).append(category)

    ordered_groups = [g for g in GROUP_ORDER if g in buckets] + [
        g for g in buckets if g not in GROUP_ORDER
    ]
    return [
        {"group": g, "categories": sorted(buckets[g])} for g in ordered_groups
    ]
