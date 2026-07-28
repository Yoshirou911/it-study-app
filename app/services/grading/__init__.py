from app.models import Question

from .base import Grader
from .subject_a import SubjectAGrader
from .subject_b import SubjectBGrader

_GRADERS: dict[str, Grader] = {
    "A": SubjectAGrader(),
    "B": SubjectBGrader(),
}


def get_grader(question: Question) -> Grader:
    return _GRADERS[question.subject]


__all__ = ["Grader", "SubjectAGrader", "SubjectBGrader", "get_grader"]
