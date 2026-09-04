from pydantic import BaseModel


class ChoiceOut(BaseModel):
    label: str
    text: str

    class Config:
        from_attributes = True


class RankTierOut(BaseModel):
    id: str
    name: str
    label: str
    xp_min: int
    color: str


class QuestionOut(BaseModel):
    id: int
    subject: str
    category: str
    difficulty: int
    difficulty_rank: RankTierOut
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
    level: str
    title: str
    body: str
    order: int

    class Config:
        from_attributes = True


class CategoryGroupOut(BaseModel):
    group: str
    categories: list[str]


class CurriculumOut(BaseModel):
    """レベルごとの分野一覧。教本タブのナビゲーション構築に使う。"""

    level: str
    groups: list[CategoryGroupOut]


class ReviewSummaryOut(BaseModel):
    due: int
    scheduled: int
    mastered: int
    untracked: int


class DailyPlanOut(BaseModel):
    date: str
    questions: list[QuestionOut]
    answered_today: list[int]  # このプランのうち、今日すでに解答したquestion_id


class DailyStatOut(BaseModel):
    date: str
    answered: int
    correct: int


class DailyStatsOut(BaseModel):
    streak_days: int
    days: list[DailyStatOut]


class MockExamSetOut(BaseModel):
    set_number: int
    size: int
    time_limit_minutes: int


class MockExamOut(BaseModel):
    set_number: int
    time_limit_minutes: int
    questions: list[QuestionOut]


class DifficultyRankTierOut(RankTierOut):
    question_count: int


class PlayerRankOut(BaseModel):
    xp: int
    current: RankTierOut
    next: RankTierOut | None
    progress_pct: int
    remaining_xp: int
