const state = {
  subject: "A",
  currentQuestion: null,
  dashboardSubject: "A",
  textbookLevel: null,
  textbookCategory: null,
  curriculum: null, // [{ level, groups: [{ group, categories }] }]

  quizMode: "normal", // "normal" | "review" | "daily" | "mock"
  daily: { questions: [], index: 0 },
  mock: {
    setNumber: null,
    questions: [],
    index: 0,
    correct: 0,
    timeLimitMinutes: 0,
    deadline: null,
    timerId: null,
  },
  lab: {
    exercises: null, // 初回だけ取得してキャッシュする
    currentId: null,
  },
  rankPractice: {
    tier: null, // "bronze" | "silver" | "gold"
  },
};

const el = {
  tabBtns: document.querySelectorAll(".tab-btn"),
  quizView: document.getElementById("quiz-view"),
  dashboardView: document.getElementById("dashboard-view"),
  category: document.getElementById("q-category"),
  difficulty: document.getElementById("q-difficulty"),
  difficultyBadge: document.getElementById("q-difficulty-badge"),
  body: document.getElementById("q-body"),
  pseudocode: document.getElementById("q-pseudocode"),
  choicesArea: document.getElementById("choices-area"),
  textAnswerArea: document.getElementById("text-answer-area"),
  textAnswerInput: document.getElementById("text-answer-input"),
  submitTextAnswer: document.getElementById("submit-text-answer"),
  resultArea: document.getElementById("result-area"),
  resultMessage: document.getElementById("result-message"),
  explanationBlock: document.getElementById("explanation-block"),
  explanationArea: document.getElementById("explanation-area"),
  nextQuestion: document.getElementById("next-question"),
  dashSubjectBtns: document.querySelectorAll(".dash-subject-btn"),
  statsList: document.getElementById("stats-list"),
  textbookLevelNav: document.getElementById("textbook-level-nav"),
  textbookCategoryNav: document.getElementById("textbook-category-nav"),
  textbookContent: document.getElementById("textbook-content"),
  rankHero: document.getElementById("rank-hero"),
  rankHeroRing: document.getElementById("rank-hero-ring"),
  rankHeroLetter: document.getElementById("rank-hero-letter"),
  rankHeroPct: document.getElementById("rank-hero-pct"),
  rankHeroCount: document.getElementById("rank-hero-count"),

  quizModeBtns: document.querySelectorAll(".quiz-mode-btn"),
  reviewDueBadge: document.getElementById("review-due-badge"),
  quizProgress: document.getElementById("quiz-progress"),
  quizProgressLabel: document.getElementById("quiz-progress-label"),
  quizTimer: document.getElementById("quiz-timer"),
  quizCard: document.getElementById("quiz-card"),
  mockSetup: document.getElementById("mock-setup"),
  mockSetList: document.getElementById("mock-set-list"),
  rankSetup: document.getElementById("rank-setup"),
  rankTierList: document.getElementById("rank-tier-list"),
  mockSummary: document.getElementById("mock-summary"),
  mockSummaryPct: document.getElementById("mock-summary-pct"),
  mockSummaryDetail: document.getElementById("mock-summary-detail"),
  mockSummaryRetry: document.getElementById("mock-summary-retry"),
  quizEmptyPanel: document.getElementById("quiz-empty-panel"),
  quizEmptyTitle: document.getElementById("quiz-empty-title"),
  quizEmptyLead: document.getElementById("quiz-empty-lead"),

  streakCard: document.getElementById("streak-card"),
  streakDays: document.getElementById("streak-days"),
  dailyChart: document.getElementById("daily-chart"),

  playerRankCard: document.getElementById("player-rank-card"),
  playerRankRing: document.getElementById("player-rank-ring"),
  playerRankIcon: document.getElementById("player-rank-icon"),
  playerRankName: document.getElementById("player-rank-name"),
  playerRankXp: document.getElementById("player-rank-xp"),
  playerRankBarFill: document.getElementById("player-rank-bar-fill"),
  playerRankNext: document.getElementById("player-rank-next"),

  labExerciseNav: document.getElementById("lab-exercise-nav"),
  labWorkbench: document.getElementById("lab-workbench"),
  labTitle: document.getElementById("lab-title"),
  labClearedBadge: document.getElementById("lab-cleared-badge"),
  labRequirement: document.getElementById("lab-requirement"),
  labTags: document.getElementById("lab-tags"),
  labCode: document.getElementById("lab-code"),
  labRun: document.getElementById("lab-run"),
  labReset: document.getElementById("lab-reset"),
  labToggleHints: document.getElementById("lab-toggle-hints"),
  labToggleSolution: document.getElementById("lab-toggle-solution"),
  labHints: document.getElementById("lab-hints"),
  labSolution: document.getElementById("lab-solution"),
  labResult: document.getElementById("lab-result"),
  labResultSummary: document.getElementById("lab-result-summary"),
  labCases: document.getElementById("lab-cases"),
  labLogs: document.getElementById("lab-logs"),
};

const RANK_THRESHOLDS = [
  { min: 90, rank: "S" },
  { min: 75, rank: "A" },
  { min: 60, rank: "B" },
  { min: 40, rank: "C" },
  { min: 0, rank: "D" },
];

function rankFor(pct) {
  return RANK_THRESHOLDS.find((t) => pct >= t.min).rank;
}

function switchView(viewId) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById(viewId).classList.add("active");
}

el.tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    el.tabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.dataset.tab;
    if (tab === "dashboard") {
      switchView("dashboard-view");
      loadDashboard(state.dashboardSubject);
    } else if (tab === "textbook") {
      switchView("textbook-view");
      loadTextbook();
    } else if (tab === "lab") {
      switchView("lab-view");
      loadLab();
    } else {
      state.subject = btn.dataset.subject;
      switchView("quiz-view");
      setQuizMode("normal");
    }
  });
});

el.quizModeBtns.forEach((btn) => {
  btn.addEventListener("click", () => setQuizMode(btn.dataset.mode));
});

el.dashSubjectBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    el.dashSubjectBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.dashboardSubject = btn.dataset.subject;
    loadDashboard(state.dashboardSubject);
  });
});

// ─── 出題モード(通常/復習/今日の10問/模試)の切り替え ─────────────────────
//
// 「次にどの問題を出すか」だけが4モードで違い、問題の表示(renderQuestion)と
// 採点(submitAnswer)はすべて共通で使い回す。

function stopMockTimer() {
  if (state.mock.timerId) {
    clearInterval(state.mock.timerId);
    state.mock.timerId = null;
  }
}

function showQuizEmpty(title, lead) {
  el.quizCard.hidden = true;
  el.quizProgress.hidden = true;
  el.quizEmptyTitle.textContent = title;
  el.quizEmptyLead.textContent = lead;
  el.quizEmptyPanel.hidden = false;
}

function setQuizMode(mode) {
  stopMockTimer();
  state.quizMode = mode;
  state.currentQuestion = null;

  el.quizModeBtns.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  el.quizEmptyPanel.hidden = true;
  el.mockSetup.hidden = true;
  el.mockSummary.hidden = true;
  el.rankSetup.hidden = true;
  el.quizProgress.hidden = true;
  el.quizTimer.hidden = true;
  el.quizCard.hidden = false;
  el.resultArea.hidden = true;

  if (mode === "normal") loadNextQuestion();
  else if (mode === "review") loadReviewNext();
  else if (mode === "daily") startDailyMode();
  else if (mode === "mock") showMockSetup();
  else if (mode === "rank") showRankSetup();
}

/** 「次の問題へ」ボタンの挙動は、モードによって「次に何を出すか」が違う。 */
function advanceQuiz() {
  if (state.quizMode === "normal") loadNextQuestion();
  else if (state.quizMode === "review") loadReviewNext();
  else if (state.quizMode === "daily") {
    state.daily.index += 1;
    showDailyQuestion();
  } else if (state.quizMode === "mock") {
    state.mock.index += 1;
    if (state.mock.index >= state.mock.questions.length) finishMockExam();
    else showMockQuestion();
  } else if (state.quizMode === "rank") {
    loadRankPracticeNext();
  }
}

async function refreshReviewBadge() {
  try {
    const res = await fetch(`/api/study/review/summary?subject=${state.subject}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.due > 0) {
      el.reviewDueBadge.textContent = data.due;
      el.reviewDueBadge.hidden = false;
    } else {
      el.reviewDueBadge.hidden = true;
    }
  } catch {
    // バッジは付加情報なので、失敗しても黙って諦める
  }
}

async function loadNextQuestion() {
  el.resultArea.hidden = true;
  const excludeId = state.currentQuestion ? state.currentQuestion.id : "";
  const params = new URLSearchParams({ subject: state.subject });
  if (excludeId) params.set("exclude_id", excludeId);

  const res = await fetch(`/api/quiz/next?${params}`);
  if (!res.ok) {
    showQuizEmpty("出題可能な問題がありません", "シードデータを投入してください。");
    return;
  }
  const question = await res.json();
  state.currentQuestion = question;
  renderQuestion(question);
  refreshReviewBadge();
}

// ─── 復習(間隔反復) ─────────────────────────────────────────────────────

async function loadReviewNext() {
  el.resultArea.hidden = true;
  const res = await fetch(`/api/study/review/next?subject=${state.subject}`);
  if (!res.ok) {
    showQuizEmpty(
      "復習対象はありません",
      "正解した問題は、時間をおいて忘れかけた頃に復習として出てくる。まずは通常演習で解いてみよう。"
    );
    refreshReviewBadge();
    return;
  }
  const question = await res.json();
  state.currentQuestion = question;
  renderQuestion(question);
}

// ─── 今日の10問 ─────────────────────────────────────────────────────────

async function startDailyMode() {
  const res = await fetch(`/api/study/daily/plan?subject=${state.subject}`);
  const data = await res.json();
  state.daily.questions = data.questions;
  state.daily.index = 0;
  if (state.daily.questions.length === 0) {
    showQuizEmpty("今日の10問はまだ準備できません", "問題データが投入されていないようです。");
    return;
  }
  showDailyQuestion();
}

function showDailyQuestion() {
  el.resultArea.hidden = true;
  const { questions, index } = state.daily;
  if (index >= questions.length) {
    showQuizEmpty("今日の10問、完了!", "お疲れさま。続きは通常演習や復習でどうぞ。");
    return;
  }
  el.quizProgress.hidden = false;
  el.quizProgressLabel.textContent = `${index + 1} / ${questions.length}問`;
  const question = questions[index];
  state.currentQuestion = question;
  renderQuestion(question);
}

// ─── 模試 ───────────────────────────────────────────────────────────────

async function showMockSetup() {
  el.quizCard.hidden = true;
  el.mockSetup.hidden = false;
  const res = await fetch(`/api/study/mock/sets?subject=${state.subject}`);
  const sets = await res.json();
  el.mockSetList.innerHTML = "";
  sets.forEach((s) => {
    const btn = document.createElement("button");
    btn.className = "mock-set-btn";
    btn.innerHTML = `<span class="mock-set-name">セット${s.set_number}</span><span class="mock-set-meta">${s.size}問 ・ ${s.time_limit_minutes}分</span>`;
    btn.addEventListener("click", () => startMockExam(s.set_number));
    el.mockSetList.appendChild(btn);
  });
}

async function startMockExam(setNumber) {
  const res = await fetch(`/api/study/mock/start?subject=${state.subject}&set=${setNumber}`);
  const data = await res.json();
  state.mock = {
    setNumber,
    questions: data.questions,
    index: 0,
    correct: 0,
    timeLimitMinutes: data.time_limit_minutes,
    deadline: Date.now() + data.time_limit_minutes * 60 * 1000,
    timerId: null,
  };
  el.mockSetup.hidden = true;
  el.mockSummary.hidden = true;
  el.quizCard.hidden = false;
  el.quizTimer.hidden = false;
  startMockTimer();
  showMockQuestion();
}

function startMockTimer() {
  stopMockTimer();
  updateMockTimerLabel();
  state.mock.timerId = setInterval(() => {
    updateMockTimerLabel();
    if (Date.now() >= state.mock.deadline) finishMockExam();
  }, 1000);
}

function updateMockTimerLabel() {
  const remainingMs = Math.max(0, state.mock.deadline - Date.now());
  const totalSec = Math.floor(remainingMs / 1000);
  const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  el.quizTimer.textContent = `残り ${m}:${s}`;
}

function showMockQuestion() {
  el.resultArea.hidden = true;
  const { questions, index } = state.mock;
  el.quizProgress.hidden = false;
  el.quizProgressLabel.textContent = `${index + 1} / ${questions.length}問`;
  const question = questions[index];
  state.currentQuestion = question;
  renderQuestion(question);
}

function finishMockExam() {
  stopMockTimer();
  el.quizCard.hidden = true;
  el.quizProgress.hidden = true;
  el.quizTimer.hidden = true;
  el.mockSummary.hidden = false;
  const total = state.mock.questions.length;
  const pct = total > 0 ? Math.round((state.mock.correct / total) * 100) : 0;
  el.mockSummaryPct.textContent = pct;
  el.mockSummaryDetail.textContent = `${total}問中${state.mock.correct}問正解`;
}

el.mockSummaryRetry.addEventListener("click", () => setQuizMode("mock"));

// ─── ランク練習(難易度をBronze/Silver/Goldで絞り込んで出題) ─────────────────

async function showRankSetup() {
  el.quizCard.hidden = true;
  el.rankSetup.hidden = false;
  const res = await fetch(`/api/study/rank-practice/tiers?subject=${state.subject}`);
  const tiers = await res.json();
  el.rankTierList.innerHTML = "";
  tiers.forEach((tier) => {
    const btn = document.createElement("button");
    btn.className = "mock-set-btn rank-tier-btn";
    btn.style.setProperty("--rank-color", tier.color);
    btn.innerHTML = `<span class="mock-set-name">${tier.name} <span class="rank-tier-label">${tier.label}</span></span><span class="mock-set-meta">${tier.question_count}問</span>`;
    btn.disabled = tier.question_count === 0;
    btn.addEventListener("click", () => selectRankTier(tier.id));
    el.rankTierList.appendChild(btn);
  });
}

function selectRankTier(tierId) {
  state.rankPractice.tier = tierId;
  el.rankSetup.hidden = true;
  el.quizCard.hidden = false;
  loadRankPracticeNext();
}

async function loadRankPracticeNext() {
  el.resultArea.hidden = true;
  const params = new URLSearchParams({ subject: state.subject, tier: state.rankPractice.tier });
  if (state.currentQuestion) params.set("exclude_id", state.currentQuestion.id);

  const res = await fetch(`/api/study/rank-practice/next?${params}`);
  if (!res.ok) {
    showQuizEmpty("このランクに問題がありません", "別のランクを選んでみてください。");
    return;
  }
  const question = await res.json();
  state.currentQuestion = question;
  renderQuestion(question);
}

function renderDifficultyDots(level) {
  el.difficulty.innerHTML = "";
  const wrap = document.createElement("span");
  wrap.className = "difficulty-dots";
  for (let i = 1; i <= 5; i++) {
    const dot = document.createElement("span");
    dot.className = i <= level ? "dot filled" : "dot";
    wrap.appendChild(dot);
  }
  el.difficulty.appendChild(wrap);
}

function renderDifficultyBadge(rank) {
  el.difficultyBadge.textContent = rank.label;
  el.difficultyBadge.style.setProperty("--rank-color", rank.color);
  el.difficultyBadge.dataset.rank = rank.id;
}

function renderQuestion(question) {
  el.category.textContent = question.category;
  renderDifficultyBadge(question.difficulty_rank);
  renderDifficultyDots(question.difficulty);
  el.body.textContent = question.body;

  if (question.pseudocode) {
    el.pseudocode.textContent = question.pseudocode;
    el.pseudocode.hidden = false;
  } else {
    el.pseudocode.hidden = true;
  }

  // 科目Aは常に選択式。科目Bは基本は自由入力だが、選択式トレース問題では
  // choicesが渡ってくるので、その有無で表示を切り替える。
  if (question.choices.length > 0) {
    el.choicesArea.innerHTML = "";
    el.choicesArea.hidden = false;
    el.textAnswerArea.hidden = true;
    question.choices.forEach((choice) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = `${choice.label}. ${choice.text}`;
      btn.addEventListener("click", () => submitAnswer(choice.label));
      el.choicesArea.appendChild(btn);
    });
  } else {
    el.choicesArea.hidden = true;
    el.textAnswerArea.hidden = false;
    el.textAnswerInput.value = "";
    el.textAnswerInput.focus();
  }
}

el.submitTextAnswer.addEventListener("click", () => {
  submitAnswer(el.textAnswerInput.value);
});
el.textAnswerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitAnswer(el.textAnswerInput.value);
});

async function submitAnswer(userAnswer) {
  const res = await fetch("/api/quiz/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question_id: state.currentQuestion.id,
      user_answer: userAnswer,
    }),
  });
  const result = await res.json();
  showResult(result);
}

function showResult(result) {
  el.resultArea.hidden = false;
  el.resultMessage.textContent = result.correct
    ? "正解です!"
    : `不正解です。正解: ${result.correct_answer}`;
  el.resultMessage.className = result.correct ? "correct" : "incorrect";

  if (result.explanation) {
    renderMarkdownLite(el.explanationArea, result.explanation);
    el.explanationBlock.hidden = false;
  } else {
    el.explanationBlock.hidden = true;
  }

  if (state.quizMode === "mock" && result.correct) {
    state.mock.correct += 1;
  }
}

el.nextQuestion.addEventListener("click", advanceQuiz);

function renderRankHero(stats) {
  if (stats.length === 0) {
    el.rankHero.hidden = true;
    return;
  }

  const totalCount = stats.reduce((sum, s) => sum + s.total, 0);
  const correctCount = stats.reduce((sum, s) => sum + s.correct, 0);
  const pct = totalCount ? Math.round((correctCount / totalCount) * 100) : 0;
  const rank = rankFor(pct);

  el.rankHero.hidden = false;
  el.rankHero.dataset.rank = rank;
  el.rankHeroRing.style.setProperty("--pct", pct);
  el.rankHeroLetter.textContent = rank;
  el.rankHeroPct.textContent = pct;
  el.rankHeroCount.textContent = `(${totalCount}問中${correctCount}問正解)`;
}

function buildRankBadge(pct) {
  const rank = rankFor(pct);
  const badge = document.createElement("span");
  badge.className = "rank-badge";
  badge.dataset.rank = rank;
  badge.textContent = rank;
  return badge;
}

async function loadDashboard(subject) {
  const res = await fetch(`/api/progress/summary?subject=${subject}`);
  const data = await res.json();
  el.statsList.innerHTML = "";

  renderRankHero(data.stats);
  loadStreakAndChart(subject);
  loadPlayerRank();

  if (data.stats.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "まだ解答履歴がありません。問題を解いてみましょう。";
    el.statsList.appendChild(empty);
    return;
  }

  data.stats.forEach((stat) => {
    const pct = Math.round(stat.accuracy * 100);

    const row = document.createElement("div");
    row.className = "stat-row";

    const top = document.createElement("div");
    top.className = "stat-row-top";

    const category = document.createElement("span");
    category.className = "stat-category";
    category.textContent = stat.category;

    const figures = document.createElement("span");
    figures.className = "stat-figures";
    figures.textContent = `${stat.correct} / ${stat.total} 問`;

    const accuracy = document.createElement("span");
    accuracy.className = "stat-accuracy";
    accuracy.textContent = `${pct}%`;

    const left = document.createElement("div");
    left.className = "stat-row-left";
    left.appendChild(buildRankBadge(pct));
    left.appendChild(category);
    left.appendChild(document.createTextNode(" "));
    left.appendChild(figures);

    top.appendChild(left);
    top.appendChild(accuracy);

    const track = document.createElement("div");
    track.className = "stat-bar-track";
    const fill = document.createElement("div");
    fill.className = "stat-bar-fill";
    fill.style.width = `${pct}%`;
    track.appendChild(fill);

    row.appendChild(top);
    row.appendChild(track);
    el.statsList.appendChild(row);
  });
}

/** 連続学習日数と、直近14日の解答数を棒グラフで表示する。 */
// 英語名の頭文字だけだとSilverとSovereignが衝突するため、2文字の略称を個別に持つ。
const PLAYER_RANK_ICON = {
  bronze: "Br",
  silver: "Si",
  gold: "Au",
  platinum: "Pt",
  diamond: "Di",
  master: "Ma",
  sovereign: "So",
};

/**
 * XPに応じた総合ランク(Bronze〜Sovereign)を表示する。分野別正答率(S〜D)とは
 * 別物で、こちらは科目・分野を横断した「これまでの積み上げ」を示す。
 */
async function loadPlayerRank() {
  const res = await fetch("/api/study/rank");
  if (!res.ok) {
    el.playerRankCard.hidden = true;
    return;
  }
  const data = await res.json();

  if (data.xp === 0) {
    el.playerRankCard.hidden = true;
    return;
  }

  el.playerRankCard.hidden = false;
  el.playerRankCard.dataset.rank = data.current.id;
  el.playerRankCard.style.setProperty("--rank-color", data.current.color);
  el.playerRankRing.style.setProperty("--pct", data.next ? data.progress_pct : 100);
  el.playerRankIcon.textContent = PLAYER_RANK_ICON[data.current.id] || "";
  el.playerRankName.textContent = `${data.current.name} ${data.current.label}`;
  el.playerRankXp.textContent = `${data.xp} XP`;
  el.playerRankBarFill.style.width = `${data.next ? data.progress_pct : 100}%`;
  el.playerRankNext.textContent = data.next
    ? `次のランク ${data.next.label} まで あと${data.remaining_xp} XP`
    : "最高ランクに到達済み";
}

async function loadStreakAndChart(subject) {
  const res = await fetch(`/api/study/daily/stats?subject=${subject}&days=14`);
  if (!res.ok) {
    el.streakCard.hidden = true;
    return;
  }
  const data = await res.json();
  const hasAnyActivity = data.days.some((d) => d.answered > 0);
  if (!hasAnyActivity && data.streak_days === 0) {
    el.streakCard.hidden = true;
    return;
  }

  el.streakCard.hidden = false;
  el.streakDays.textContent = data.streak_days;

  const max = Math.max(1, ...data.days.map((d) => d.answered));
  el.dailyChart.innerHTML = "";
  data.days.forEach((day) => {
    const col = document.createElement("div");
    col.className = "daily-chart-col";
    col.title = `${day.date}: ${day.answered}問(${day.correct}問正解)`;

    const bar = document.createElement("div");
    bar.className = "daily-chart-bar";
    const heightPct = day.answered > 0 ? Math.max(6, Math.round((day.answered / max) * 100)) : 0;
    bar.style.height = `${heightPct}%`;
    if (day.answered === 0) bar.classList.add("is-empty");

    const label = document.createElement("span");
    label.className = "daily-chart-label";
    label.textContent = day.date.slice(8); // 日だけ表示

    col.appendChild(bar);
    col.appendChild(label);
    el.dailyChart.appendChild(col);
  });
}

/** カリキュラム(レベル→大分類→分野)は初回だけ取得し、以降は state から描画する。 */
async function loadTextbook() {
  if (state.curriculum === null) {
    const res = await fetch("/api/notes/curriculum");
    state.curriculum = await res.json();
  }
  renderTextbookNav();
}

function showTextbookEmptyState() {
  el.textbookLevelNav.innerHTML = "";
  el.textbookCategoryNav.innerHTML = "";
  el.textbookContent.innerHTML = "";
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = "教本データがまだ登録されていません。";
  el.textbookContent.appendChild(empty);
}

function renderTextbookNav() {
  const curriculum = state.curriculum;
  if (!curriculum || curriculum.length === 0) {
    showTextbookEmptyState();
    return;
  }

  const levels = curriculum.map((c) => c.level);
  if (!levels.includes(state.textbookLevel)) {
    state.textbookLevel = levels[0];
    state.textbookCategory = null;
  }

  const current = curriculum.find((c) => c.level === state.textbookLevel);
  const categories = current.groups.flatMap((g) => g.categories);
  if (!categories.includes(state.textbookCategory)) {
    state.textbookCategory = categories[0];
  }

  renderLevelNav(levels);
  renderCategoryNav(current.groups);
  // 呼び出し元がクリック後にスクロールできるよう、読み込みのPromiseを返す
  return loadTextbookNotes(state.textbookLevel, state.textbookCategory);
}

/**
 * 選んだ分野の解説は画面より下にあるため、選び直しても見た目が変わらず
 * 「反応がない」ように見えてしまう。クリックのたびに解説エリアまで
 * スクロールし、選択がちゃんと反映されたことが分かるようにする。
 */
function scrollToTextbookContent() {
  el.textbookContent.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderLevelNav(levels) {
  el.textbookLevelNav.innerHTML = "";
  levels.forEach((level) => {
    const btn = document.createElement("button");
    btn.className = "level-btn";
    btn.textContent = level;
    if (level === state.textbookLevel) btn.classList.add("active");
    btn.addEventListener("click", () => {
      if (level === state.textbookLevel) {
        scrollToTextbookContent();
        return;
      }
      state.textbookLevel = level;
      // レベルによって分野の顔ぶれが変わるため、選択中の分野は選び直させる
      state.textbookCategory = null;
      renderTextbookNav().then(scrollToTextbookContent);
    });
    el.textbookLevelNav.appendChild(btn);
  });
}

function renderCategoryNav(groups) {
  el.textbookCategoryNav.innerHTML = "";
  groups.forEach((groupEntry) => {
    const groupBlock = document.createElement("div");
    groupBlock.className = "category-group";

    const label = document.createElement("span");
    label.className = "category-group-label";
    label.textContent = groupEntry.group;
    groupBlock.appendChild(label);

    const row = document.createElement("div");
    row.className = "subject-switch";
    groupEntry.categories.forEach((category) => {
      const btn = document.createElement("button");
      btn.className = "dash-subject-btn";
      btn.textContent = category;
      if (category === state.textbookCategory) btn.classList.add("active");
      btn.addEventListener("click", () => {
        state.textbookCategory = category;
        renderTextbookNav().then(scrollToTextbookContent);
      });
      row.appendChild(btn);
    });
    groupBlock.appendChild(row);
    el.textbookCategoryNav.appendChild(groupBlock);
  });
}

async function loadTextbookNotes(level, category) {
  const params = new URLSearchParams({ category, level });
  const res = await fetch(`/api/notes?${params}`);
  const notes = await res.json();
  el.textbookContent.innerHTML = "";
  notes.forEach((note) => {
    const section = document.createElement("div");
    renderMarkdownLite(section, note.body);
    el.textbookContent.appendChild(section);
  });
}

/**
 * 簡易マークダウンをDOMに描画する。対応する記法は次のとおり。
 *   "# " 見出し / "## " 小見出し / "### " 小々見出し
 *   "- " 箇条書き / "1. " 番号付き箇条書き
 *   "**強調**" / "`コード`"
 *   ``` で囲んだコードブロック
 *   "|" 区切りの表
 * 信頼できる自前コンテンツのみを対象とし、innerHTMLは使わずDOM要素を組み立てる。
 */
function renderMarkdownLite(container, text) {
  container.innerHTML = "";
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (line.startsWith("```")) {
      i = appendCodeBlock(container, lines, i);
    } else if (isTableRow(line) && isTableSeparator(lines[i + 1])) {
      i = appendTable(container, lines, i);
    } else if (line.startsWith("- ")) {
      i = appendList(container, lines, i, "ul", /^-\s+/);
    } else if (/^\d+\.\s/.test(line)) {
      i = appendList(container, lines, i, "ol", /^\d+\.\s+/);
    } else {
      if (line !== "") container.appendChild(buildBlockElement(line));
      i += 1;
    }
  }
}

function buildBlockElement(line) {
  if (line.startsWith("### ")) return buildInlineElement("h4", line.slice(4));
  if (line.startsWith("## ")) return buildInlineElement("h3", line.slice(3));
  if (line.startsWith("# ")) return buildInlineElement("h2", line.slice(2));
  return buildInlineElement("p", line);
}

/** ``` から次の ``` までをそのまま <pre> に流し込み、閉じ行の次の位置を返す。 */
function appendCodeBlock(container, lines, start) {
  const body = [];
  let i = start + 1;
  while (i < lines.length && !lines[i].trim().startsWith("```")) {
    body.push(lines[i]);
    i += 1;
  }
  const pre = document.createElement("pre");
  pre.className = "code-block";
  pre.textContent = body.join("\n");
  container.appendChild(pre);
  return i + 1; // 閉じる ``` を読み飛ばす
}

function appendList(container, lines, start, tagName, markerPattern) {
  const list = document.createElement(tagName);
  let i = start;
  while (i < lines.length && markerPattern.test(lines[i].trim())) {
    const content = lines[i].trim().replace(markerPattern, "");
    list.appendChild(buildInlineElement("li", content));
    i += 1;
  }
  container.appendChild(list);
  return i;
}

function isTableRow(line) {
  return line.startsWith("|") && line.endsWith("|");
}

function isTableSeparator(line) {
  if (line === undefined) return false;
  const trimmed = line.trim();
  return isTableRow(trimmed) && /^\|[\s:|-]+\|$/.test(trimmed);
}

function splitTableRow(line) {
  // 前後の "|" を落としてから分割する(空セルが混ざらないようにするため)
  return line.trim().slice(1, -1).split("|").map((cell) => cell.trim());
}

function appendTable(container, lines, start) {
  const table = document.createElement("table");
  table.className = "note-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  splitTableRow(lines[start]).forEach((cell) => {
    headRow.appendChild(buildInlineElement("th", cell));
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  let i = start + 2; // 見出し行と区切り行を飛ばす
  while (i < lines.length && isTableRow(lines[i].trim())) {
    const row = document.createElement("tr");
    splitTableRow(lines[i]).forEach((cell) => {
      row.appendChild(buildInlineElement("td", cell));
    });
    tbody.appendChild(row);
    i += 1;
  }
  table.appendChild(tbody);

  const wrapper = document.createElement("div");
  wrapper.className = "table-wrapper";
  wrapper.appendChild(table);
  container.appendChild(wrapper);
  return i;
}

function buildInlineElement(tagName, text) {
  const node = document.createElement(tagName);
  // **強調** と `コード` を1回の分割で拾う。
  // 強調の中身は "**" 以外なら何でも許す(`**COUNT(*)**` のように * を含む場合があるため)。
  const parts = text.split(/(\*\*(?:(?!\*\*)[\s\S])+\*\*|`[^`]+`)/g);
  parts.forEach((part) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = part.slice(2, -2);
      node.appendChild(strong);
    } else if (part.length > 1 && part.startsWith("`") && part.endsWith("`")) {
      const code = document.createElement("code");
      code.textContent = part.slice(1, -1);
      node.appendChild(code);
    } else if (part) {
      node.appendChild(document.createTextNode(part));
    }
  });
  return node;
}

// ─── ラボ(サンドボックス実行つきコード演習) ───────────────────────────────
//
// 課題データ(static/lab-exercises.json)は静的なJSONで、採点はブラウザ内の
// Web Worker(static/lab-runner.js)で完結する。サーバへは何も送らない。
// 「書きかけのコード」「クリア済みかどうか」は端末のlocalStorageだけに置き、
// 弱点克服のための解答履歴(Attempt)とは別扱いにする。演習の失敗は「弱点」
// ではなく練習の一部なので、ここを混ぜると分野別正答率の意味がぼやける。

const LAB_DRAFTS_KEY = "stack-lab-drafts";
const LAB_CLEARED_KEY = "stack-lab-cleared";
const LAB_RUN_TIMEOUT_MS = 2000;

function readLabStorage(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function getLabDraft(exerciseId) {
  const draft = readLabStorage(LAB_DRAFTS_KEY)[exerciseId];
  return typeof draft === "string" ? draft : null;
}

function saveLabDraft(exerciseId, code) {
  try {
    const drafts = readLabStorage(LAB_DRAFTS_KEY);
    drafts[exerciseId] = code.slice(0, 20000);
    localStorage.setItem(LAB_DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // 端末のストレージが使えなくても、実行自体は妨げない
  }
}

function isLabCleared(exerciseId) {
  return Boolean(readLabStorage(LAB_CLEARED_KEY)[exerciseId]);
}

function markLabCleared(exerciseId) {
  try {
    const cleared = readLabStorage(LAB_CLEARED_KEY);
    if (cleared[exerciseId]) return;
    cleared[exerciseId] = new Date().toISOString();
    localStorage.setItem(LAB_CLEARED_KEY, JSON.stringify(cleared));
  } catch {
    // クリア記録の保存に失敗しても、結果表示自体は既に済んでいる
  }
}

async function loadLab() {
  if (state.lab.exercises === null) {
    const res = await fetch("/static/lab-exercises.json");
    state.lab.exercises = await res.json();
  }
  renderLabNav();
  if (state.lab.currentId === null && state.lab.exercises.length > 0) {
    selectLabExercise(state.lab.exercises[0].id);
  }
}

const LAB_LEVEL_LABEL = { beginner: "入門", intermediate: "標準", advanced: "発展" };

function renderLabNav() {
  el.labExerciseNav.innerHTML = "";
  state.lab.exercises.forEach((ex) => {
    const btn = document.createElement("button");
    btn.className = "dash-subject-btn lab-nav-btn";
    if (ex.id === state.lab.currentId) btn.classList.add("active");
    btn.innerHTML = `${isLabCleared(ex.id) ? "✓ " : ""}${escapeForBadge(ex.title)}<span class="lab-nav-level">${LAB_LEVEL_LABEL[ex.level] || ex.level}</span>`;
    btn.addEventListener("click", () => selectLabExercise(ex.id));
    el.labExerciseNav.appendChild(btn);
  });
}

function escapeForBadge(text) {
  // innerHTMLへ差し込む前提の小さなヘルパー。演習タイトルは自前データのみ対象。
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function selectLabExercise(exerciseId) {
  state.lab.currentId = exerciseId;
  const exercise = state.lab.exercises.find((e) => e.id === exerciseId);
  if (!exercise) return;

  renderLabNav();
  el.labWorkbench.hidden = false;
  el.labTitle.textContent = exercise.title;
  el.labClearedBadge.hidden = !isLabCleared(exerciseId);
  el.labRequirement.textContent = exercise.requirement;

  el.labTags.innerHTML = "";
  exercise.tags.forEach((tag) => {
    const span = document.createElement("span");
    span.className = "lab-tag";
    span.textContent = tag;
    el.labTags.appendChild(span);
  });

  el.labCode.value = getLabDraft(exerciseId) ?? exercise.starterCode;

  el.labHints.innerHTML = "";
  exercise.hints.forEach((hint) => {
    const li = document.createElement("li");
    li.textContent = hint;
    el.labHints.appendChild(li);
  });
  el.labHints.hidden = true;
  el.labToggleHints.textContent = "ヒントを見る";

  el.labSolution.textContent = exercise.solution;
  el.labSolution.hidden = true;
  el.labToggleSolution.textContent = "解答例を見る";

  el.labResult.hidden = true;
}

el.labCode.addEventListener("input", () => {
  if (state.lab.currentId) saveLabDraft(state.lab.currentId, el.labCode.value);
});

el.labReset.addEventListener("click", () => {
  const exercise = state.lab.exercises.find((e) => e.id === state.lab.currentId);
  if (!exercise) return;
  el.labCode.value = exercise.starterCode;
  saveLabDraft(exercise.id, exercise.starterCode);
});

el.labToggleHints.addEventListener("click", () => {
  el.labHints.hidden = !el.labHints.hidden;
  el.labToggleHints.textContent = el.labHints.hidden ? "ヒントを見る" : "ヒントを隠す";
});

el.labToggleSolution.addEventListener("click", () => {
  el.labSolution.hidden = !el.labSolution.hidden;
  el.labToggleSolution.textContent = el.labSolution.hidden ? "解答例を見る" : "解答例を隠す";
});

/**
 * 利用者のコードをWeb Worker(lab-runner.js)の中だけで実行する。
 * fetch等の通信系グローバルはWorker側で無効化されており、DOMや
 * localStorageにも触れない。無限ループ対策として、時間内に終わらなければ
 * Workerごと強制終了する。
 */
function runLabExercise({ code, functionName, cases }, timeoutMs = LAB_RUN_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let worker;
    try {
      worker = new Worker("/static/lab-runner.js");
    } catch (error) {
      resolve({ logs: [], cases: [], error: `実行環境を起動できませんでした: ${error.message}` });
      return;
    }

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timerId);
      worker.terminate();
      resolve(result);
    };

    const timerId = window.setTimeout(() => {
      finish({
        logs: [],
        cases: [],
        error: `${timeoutMs}ミリ秒以内に終了しませんでした。無限ループになっていないか確認してください。`,
      });
    }, timeoutMs);

    worker.onmessage = (event) => {
      const data = event.data || {};
      finish({ logs: data.logs || [], cases: data.cases || [], error: data.error || null });
    };
    worker.onerror = (event) => {
      finish({ logs: [], cases: [], error: `実行中にエラーが発生しました: ${event.message || "詳細不明"}` });
    };

    worker.postMessage({ type: "run", code, functionName, cases });
  });
}

el.labRun.addEventListener("click", async () => {
  const exercise = state.lab.exercises.find((e) => e.id === state.lab.currentId);
  if (!exercise) return;

  el.labRun.disabled = true;
  el.labRun.textContent = "実行中...";

  const result = await runLabExercise({
    code: el.labCode.value,
    functionName: exercise.functionName,
    cases: exercise.cases,
  });

  el.labRun.disabled = false;
  el.labRun.textContent = "実行する";
  renderLabResult(exercise, result);
});

function renderLabResult(exercise, result) {
  el.labResult.hidden = false;

  if (result.error) {
    el.labResultSummary.textContent = result.error;
    el.labResultSummary.className = "incorrect";
    el.labCases.innerHTML = "";
    el.labLogs.hidden = true;
    return;
  }

  const total = result.cases.length;
  const passed = result.cases.filter((c) => c.passed).length;
  const allPassed = total > 0 && passed === total;

  el.labResultSummary.textContent = allPassed
    ? `全${total}件のテストに合格!`
    : `${total}件中${passed}件に合格`;
  el.labResultSummary.className = allPassed ? "correct" : "incorrect";

  el.labCases.innerHTML = "";
  result.cases.forEach((c) => {
    const li = document.createElement("li");
    li.className = c.passed ? "lab-case is-pass" : "lab-case is-fail";
    const label = document.createElement("span");
    label.className = "lab-case-label";
    label.textContent = `${c.passed ? "✓" : "✗"} ${c.label}`;
    li.appendChild(label);

    if (!c.passed) {
      const detail = document.createElement("span");
      detail.className = "lab-case-detail";
      detail.textContent = c.error
        ? `エラー: ${c.error}`
        : `入力: ${c.argsText} / 期待値: ${c.expectedText} / 実際: ${c.actualText}`;
      li.appendChild(detail);
    }
    el.labCases.appendChild(li);
  });

  if (result.logs.length > 0) {
    el.labLogs.hidden = false;
    el.labLogs.textContent = result.logs.join("\n");
  } else {
    el.labLogs.hidden = true;
  }

  if (allPassed) {
    markLabCleared(exercise.id);
    el.labClearedBadge.hidden = false;
    renderLabNav();
  }
}

loadTextbook();

// PWAとして「インストール」できるようにする。失敗しても通常のWeb表示は
// 問題なく動くため、対応していないブラウザでも安全に無視できる。
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/static/sw.js").catch(() => {});
  });
}
