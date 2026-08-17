# IT学習アプリ

基本情報技術者試験（科目A・科目B）を軸に、IT分野の知識を体系的に学習するためのWebアプリ。
将来的にIT知識全般を網羅することを目標にしている。

## 特徴

- **教本 → 演習の流れ** — 分野ごとの解説を読んでから問題に取り組む構成
- **弱点克服型の出題** — 分野別の誤答率に応じて出題を重み付けし、苦手分野を重点的に出す
- **ランク表示** — 総合／分野別の理解度を S〜D のランクで可視化
- **科目B対応** — IPA擬似言語のトレース問題

## 起動方法

`start.bat` をダブルクリックするだけ。初回は仮想環境の構築とデータ投入が自動で走り、
完了するとブラウザが開く。

手動で起動する場合:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python seed_db.py
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## 問題・教本の追加方法

`data/seed/` 配下のJSONを編集し、`python seed_db.py` を実行する。

```
data/seed/questions_a.json   科目A（四択）
data/seed/questions_b.json   科目B（擬似言語トレース）
data/seed/notes.json         教本
```

各項目は **`key`（固定キー）** を持つ。投入時はこのキーで既存レコードと照合し、

- キーが既にある → 内容を更新（学習履歴はそのまま残る）
- キーが無い → 新規追加

という動作をする。そのため、問題文の修正も問題の追加も、**学習履歴を失わずに行える**。

> **注意**: 一度使ったキーは変更しないこと。変更すると別の問題として扱われ、
> それまでの解答履歴との紐づけが切れる。

キーの命名は `<分野プレフィックス>-<連番>` で統一している（例: `nw-05`, `sec-12`）。
科目Bは `b-` を頭に付ける（例: `b-algo-05`）。

`--reset` を付けると学習履歴ごとDBを作り直す（通常は使わない）。

## 構成

```
app/
  main.py              FastAPIエントリポイント
  models.py            DBモデル（SQLAlchemy）
  category_groups.py   分野の大分類定義
  routers/             API（出題・進捗・教本）
  services/
    grading/           正誤判定エンジン（科目A/Bで分離）
    weighting.py       弱点克服型の出題重み付け
data/seed/             問題・教本データ
static/ templates/     フロントエンド
```

## 技術スタック

Python 3.12 / FastAPI / SQLAlchemy / SQLite / 素のHTML・CSS・JavaScript

## 学習データについて

解答履歴は `data/study.db`（Git管理外）に保存されるため、PCごとに独立している。
複数PCで進捗を共有したい場合は別途同期の仕組みが必要。
