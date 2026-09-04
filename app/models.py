import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # シードデータ側で管理する固定キー。再投入時の同一性判定に使うため、
    # 一度公開したキーは変更しないこと(変更すると別問題として扱われ履歴が切れる)。
    key: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    subject: Mapped[str] = mapped_column(String(1))  # "A" or "B"
    category: Mapped[str] = mapped_column(String(50), index=True)
    difficulty: Mapped[int] = mapped_column(Integer, default=3)  # 1(易)〜5(難)
    body: Mapped[str] = mapped_column(Text)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow
    )

    choices: Mapped[list["ChoiceA"]] = relationship(
        back_populates="question", cascade="all, delete-orphan"
    )
    trace: Mapped["TraceB"] = relationship(
        back_populates="question", uselist=False, cascade="all, delete-orphan"
    )
    attempts: Mapped[list["Attempt"]] = relationship(
        back_populates="question", cascade="all, delete-orphan"
    )


class ChoiceA(Base):
    """科目A(四択)の選択肢"""

    __tablename__ = "choices_a"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"))
    label: Mapped[str] = mapped_column(String(4))  # ア/イ/ウ/エ
    text: Mapped[str] = mapped_column(Text)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)

    question: Mapped["Question"] = relationship(back_populates="choices")


class TraceB(Base):
    """科目B(擬似言語トレース)の模範解答"""

    __tablename__ = "traces_b"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), unique=True)
    pseudocode: Mapped[str] = mapped_column(Text)
    answer_type: Mapped[str] = mapped_column(String(10))  # "value" or "choice"
    expected_answer: Mapped[str] = mapped_column(Text)  # 完全一致で照合する正解文字列
    choices_json: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # answer_type=="choice" の場合の選択肢(JSON配列文字列)

    question: Mapped["Question"] = relationship(back_populates="trace")


class Attempt(Base):
    """解答履歴。分野別正答率の集計にも使う"""

    __tablename__ = "attempts"
    __table_args__ = (UniqueConstraint("id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), index=True)
    user_answer: Mapped[str] = mapped_column(Text)
    is_correct: Mapped[bool] = mapped_column(Boolean)
    answered_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, index=True
    )

    question: Mapped["Question"] = relationship(back_populates="attempts")


class DailyPlan(Base):
    """「今日の10問」の固定セット。同じ日のうちは何度開いても同じ問題を出す。

    復習の定着度(streak)や日別成績は Attempt から都度計算できるため専用の
    テーブルを持たないが、「今日の10問」だけは選定結果そのものを固定する
    必要があるため、これだけは明示的に保存する。
    """

    __tablename__ = "daily_plans"
    __table_args__ = (UniqueConstraint("date", "subject", name="uq_daily_plan_date_subject"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[str] = mapped_column(String(10), index=True)  # "YYYY-MM-DD"(端末のローカル日付)
    subject: Mapped[str] = mapped_column(String(1))  # "A" or "B"
    question_ids_json: Mapped[str] = mapped_column(Text)  # 問題idのJSON配列


class StudyNote(Base):
    """分野別の教本的な解説ページ"""

    __tablename__ = "study_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(50), index=True)
    level: Mapped[str] = mapped_column(String(4), default="基礎", index=True)  # 基礎 / 応用
    title: Mapped[str] = mapped_column(String(100))
    body: Mapped[str] = mapped_column(Text)  # 簡易マークダウン(#見出し, -箇条書き, **強調**)
    order: Mapped[int] = mapped_column(Integer, default=0)
