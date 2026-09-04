"""シードデータ(教本・問題)の全項目に、安定した固定キー(key)を割り当てる。

master ブランチで先行実装されていた「キーで照合してアップサートする」方式
(seed_db.py 側)をこちらに移植するための、1回限りの移行スクリプト。
キーが既に付いている項目は変更しない(冪等)。

命名規則: <分野スラッグ>-<連番2桁>  (例: nw-05, algo-12)
科目Bの問題は先頭に b- を付ける(例: b-algo-05)。教本は note- を付ける
(例: note-nw-05)。分野をまたいだ通し番号ではなく、分野ごとに1から振り直す。
"""

import glob
import json
from pathlib import Path

SEED_DIR = Path(__file__).resolve().parent.parent / "data" / "seed"

# 分野名 → ASCIIスラッグ。増えたらここに追記する。
CATEGORY_SLUG = {
    "基礎理論": "theory",
    "データ表現": "repr",
    "コンピュータ構成要素": "hw",
    "オペレーティングシステム": "os",
    "プログラミング基礎": "prog",
    "データ構造": "ds",
    "アルゴリズム": "algo",
    "オブジェクト指向": "oop",
    "ネットワーク": "nw",
    "データベース": "db",
    "SQL": "sql",
    "AI・データ活用": "ai",
    "Web技術": "web",
    "HTTP・API設計": "http",
    "フロントエンド": "fe",
    "セキュリティ": "sec",
    "暗号・認証": "crypto",
    "Linux": "linux",
    "クラウド": "cloud",
    "コンテナ・仮想化": "container",
    "インフラ運用・監視": "ops",
    "システム構成・性能": "perf",
    "ソフトウェア": "sw",
    "設計原則・パターン": "design",
    "テスト": "test",
    "バージョン管理": "vcs",
    "システム開発技術": "sdlc",
    "アジャイル・DevOps": "agile",
    "プロジェクトマネジメント": "pm",
    "サービスマネジメント": "sm",
    "システム戦略": "strategy",
    "経営戦略・法務": "biz",
}


def slug_of(category: str) -> str:
    slug = CATEGORY_SLUG.get(category)
    if slug is None:
        raise SystemExit(f"未登録の分野です。CATEGORY_SLUGに追加してください: {category}")
    return slug


def assign(items: list[dict], prefix_fn) -> int:
    """counters は分野+接頭辞ごとの連番。既存キーの番号を引き継いで続きから振る。"""
    counters: dict[str, int] = {}
    assigned = 0

    # 既存キーの番号を先に数え、新規採番が衝突しないようにする
    for item in items:
        if "key" in item and item["key"]:
            prefix = prefix_fn(item)
            base = item["key"][len(prefix) :].lstrip("-")
            if base.isdigit():
                counters[prefix] = max(counters.get(prefix, 0), int(base))

    for item in items:
        if item.get("key"):
            continue
        prefix = prefix_fn(item)
        counters[prefix] = counters.get(prefix, 0) + 1
        item["key"] = f"{prefix}-{counters[prefix]:02d}"
        assigned += 1

    return assigned


LEVEL_SLUG = {"基礎": "basic", "応用": "adv"}


def process_notes() -> None:
    total = 0
    for path in sorted(glob.glob(str(SEED_DIR / "notes" / "*.json"))):
        items = json.loads(Path(path).read_text(encoding="utf-8"))
        n = assign(
            items,
            lambda item: f"note-{LEVEL_SLUG[item['level']]}-{slug_of(item['category'])}",
        )
        if n:
            Path(path).write_text(
                json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
        total += n
        print(f"{Path(path).name}: {n}件にキーを付与")
    print(f"教本 合計: {total}件")


def process_questions(filename: str, subject_prefix: str) -> None:
    path = SEED_DIR / filename
    items = json.loads(path.read_text(encoding="utf-8"))
    prefix_fn = lambda item: f"{subject_prefix}{slug_of(item['category'])}"
    n = assign(items, prefix_fn)
    if n:
        path.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{filename}: {n}件にキーを付与")


def main() -> None:
    process_notes()
    process_questions("questions_a.json", "")
    process_questions("questions_b.json", "b-")


if __name__ == "__main__":
    main()
