from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.models import Question


@dataclass
class GradeResult:
    correct: bool
    correct_answer: str


class Grader(ABC):
    """科目ごとの正誤判定エンジンの共通インターフェース。

    将来、科目Bをミニインタプリタ判定に差し替える場合もこのインターフェースを
    実装するだけでよく、呼び出し側(routers/quiz.py)は変更不要になる。
    """

    @abstractmethod
    def grade(self, question: Question, user_answer: str) -> GradeResult: ...
