from app.models import Question

from .base import GradeResult, Grader


class SubjectAGrader(Grader):
    """科目A(四択)判定: 選択肢ラベルの照合"""

    def grade(self, question: Question, user_answer: str) -> GradeResult:
        correct_choice = next(c for c in question.choices if c.is_correct)
        is_correct = user_answer.strip() == correct_choice.label
        return GradeResult(correct=is_correct, correct_answer=correct_choice.label)
