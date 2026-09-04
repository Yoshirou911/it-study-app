"""Question ORMオブジェクトを、API応答用のQuestionOutへ変換する共通処理。

出題(quiz.py)・復習(study.py)・「今日の10問」・模試のいずれも同じ形の
問題データを返す必要があるため、変換ロジックをここに1本化する。
"""

import json

from app.models import Question
from app.schemas import ChoiceOut, QuestionOut, RankTierOut
from app.services.rank import difficulty_rank_tier


def to_question_out(question: Question) -> QuestionOut:
    if question.subject == "A":
        choices = [ChoiceOut.model_validate(c) for c in question.choices]
    elif question.subject == "B" and question.trace.answer_type == "choice":
        # 科目Bは元々「値を直接入力させる」形式のみだったが、TraceB.choices_json は
        # 選択式トレース問題(IPA新シラバスに実在する形式)に備えて用意されていた列。
        raw = json.loads(question.trace.choices_json or "[]")
        choices = [ChoiceOut(label=c["label"], text=c["text"]) for c in raw]
    else:
        choices = []

    return QuestionOut(
        id=question.id,
        subject=question.subject,
        category=question.category,
        difficulty=question.difficulty,
        difficulty_rank=RankTierOut(**difficulty_rank_tier(question.difficulty)),
        body=question.body,
        pseudocode=question.trace.pseudocode if question.subject == "B" else None,
        choices=choices,
    )
