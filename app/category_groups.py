"""分野(category)を大分類(group)へ分類するための静的なタクソノミー。

基本情報技術者試験のシラバスに閉じず、IT エンジニアの基礎から応用までを
一続きのカリキュラムとして扱えるよう、コンピュータ科学の基礎からインフラ・
設計・マネジメントまでを大分類として並べている。

各解説ページ(StudyNote)は category に加えて level("基礎" / "応用")を持ち、
同じ分野の中で入門から実務・設計レベルまで段階的に読み進められる。
"""

LEVELS = ["基礎", "応用"]
DEFAULT_LEVEL = "基礎"

GROUP_ORDER = [
    "コンピュータ科学の基礎",
    "プログラミングとアルゴリズム",
    "ネットワーク",
    "データとデータベース",
    "Web・アプリケーション開発",
    "セキュリティ",
    "システムとインフラ",
    "ソフトウェア工学・設計",
    "開発プロセスとマネジメント",
    "IT戦略・ビジネス",
    "その他",
]

CATEGORY_TO_GROUP = {
    # コンピュータ科学の基礎
    "基礎理論": "コンピュータ科学の基礎",
    "データ表現": "コンピュータ科学の基礎",
    "コンピュータ構成要素": "コンピュータ科学の基礎",
    "オペレーティングシステム": "コンピュータ科学の基礎",
    # プログラミングとアルゴリズム
    "プログラミング基礎": "プログラミングとアルゴリズム",
    "データ構造": "プログラミングとアルゴリズム",
    "アルゴリズム": "プログラミングとアルゴリズム",
    "オブジェクト指向": "プログラミングとアルゴリズム",
    # ネットワーク
    "ネットワーク": "ネットワーク",
    # データとデータベース
    "データベース": "データとデータベース",
    "SQL": "データとデータベース",
    "AI・データ活用": "データとデータベース",
    # Web・アプリケーション開発
    "Web技術": "Web・アプリケーション開発",
    "HTTP・API設計": "Web・アプリケーション開発",
    "フロントエンド": "Web・アプリケーション開発",
    # セキュリティ
    "セキュリティ": "セキュリティ",
    "暗号・認証": "セキュリティ",
    # システムとインフラ
    "Linux": "システムとインフラ",
    "クラウド": "システムとインフラ",
    "コンテナ・仮想化": "システムとインフラ",
    "インフラ運用・監視": "システムとインフラ",
    "システム構成・性能": "システムとインフラ",
    # ソフトウェア工学・設計
    "ソフトウェア": "ソフトウェア工学・設計",
    "設計原則・パターン": "ソフトウェア工学・設計",
    "テスト": "ソフトウェア工学・設計",
    "バージョン管理": "ソフトウェア工学・設計",
    "システム開発技術": "ソフトウェア工学・設計",
    # 開発プロセスとマネジメント
    "アジャイル・DevOps": "開発プロセスとマネジメント",
    "プロジェクトマネジメント": "開発プロセスとマネジメント",
    "サービスマネジメント": "開発プロセスとマネジメント",
    # IT戦略・ビジネス
    "システム戦略": "IT戦略・ビジネス",
    "経営戦略・法務": "IT戦略・ビジネス",
}

# 分野内での並び順。ここに無い分野は名前順で後ろに並ぶ。
CATEGORY_ORDER = {category: i for i, category in enumerate(CATEGORY_TO_GROUP)}


def group_of(category: str) -> str:
    return CATEGORY_TO_GROUP.get(category, "その他")


def _category_sort_key(category: str) -> tuple[int, str]:
    return (CATEGORY_ORDER.get(category, len(CATEGORY_ORDER)), category)


def group_categories(categories: list[str]) -> list[dict]:
    """カテゴリのリストをグループごとにまとめ、GROUP_ORDER順・カリキュラム順で返す。"""
    buckets: dict[str, list[str]] = {}
    for category in categories:
        buckets.setdefault(group_of(category), []).append(category)

    ordered_groups = [g for g in GROUP_ORDER if g in buckets] + [
        g for g in buckets if g not in GROUP_ORDER
    ]
    return [
        {"group": g, "categories": sorted(buckets[g], key=_category_sort_key)}
        for g in ordered_groups
    ]
