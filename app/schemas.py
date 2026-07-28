from pydantic import BaseModel


class ChoiceOut(BaseModel):
    label: str
    text: str

    class Config:
        from_attributes = True


class QuestionOut(BaseModel):
    id: int
    subject: str
    category: str
    difficulty: int
    body: str
    pseudocode: str | None = None
    choices: list[ChoiceOut] = []

    class Config:
        from_attributes = True


class AnswerIn(BaseModel):
    question_id: int
    user_answer: str


class AnswerResult(BaseModel):
    correct: bool
    correct_answer: str
    explanation: str | None = None


class CategoryStat(BaseModel):
    category: str
    total: int
    correct: int
    accuracy: float


class ProgressSummary(BaseModel):
    stats: list[CategoryStat]


class NoteOut(BaseModel):
    id: int
    category: str
    title: str
    body: str
    order: int

    class Config:
        from_attributes = True


class CategoryGroupOut(BaseModel):
    group: str
    categories: list[str]
