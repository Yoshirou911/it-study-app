from app.models import Question

from .base import GradeResult, Grader


def _normalize(value: str) -> str:
    return value.strip().replace(" ", "").replace("　", "")


class SubjectBGrader(Grader):
    """科目B(擬似言語トレース)判定: 模範解答との照合方式。

    将来、値を変えた出題バリエーションが必要になった場合は、このクラスを
    擬似言語ミニインタプリタで実行結果を計算する実装に差し替える
    (Grader インターフェースは変えずに済む)。
    """

    def grade(self, question: Question, user_answer: str) -> GradeResult:
        trace = question.trace
        expected = _normalize(trace.expected_answer)
        actual = _normalize(user_answer)
        is_correct = expected.casefold() == actual.casefold()
        return GradeResult(correct=is_correct, correct_answer=trace.expected_answer)
