const state = {
  subject: "A",
  currentQuestion: null,
  dashboardSubject: "A",
  textbookCategory: null,
};

const el = {
  tabBtns: document.querySelectorAll(".tab-btn"),
  quizView: document.getElementById("quiz-view"),
  dashboardView: document.getElementById("dashboard-view"),
  category: document.getElementById("q-category"),
  difficulty: document.getElementById("q-difficulty"),
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
  textbookCategoryNav: document.getElementById("textbook-category-nav"),
  textbookContent: document.getElementById("textbook-content"),
  rankHero: document.getElementById("rank-hero"),
  rankHeroRing: document.getElementById("rank-hero-ring"),
  rankHeroLetter: document.getElementById("rank-hero-letter"),
  rankHeroPct: document.getElementById("rank-hero-pct"),
  rankHeroCount: document.getElementById("rank-hero-count"),
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
      loadTextbookCategories();
    } else {
      state.subject = btn.dataset.subject;
      switchView("quiz-view");
      loadNextQuestion();
    }
  });
});

el.dashSubjectBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    el.dashSubjectBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.dashboardSubject = btn.dataset.subject;
    loadDashboard(state.dashboardSubject);
  });
});

async function loadNextQuestion() {
  el.resultArea.hidden = true;
  const excludeId = state.currentQuestion ? state.currentQuestion.id : "";
  const params = new URLSearchParams({ subject: state.subject });
  if (excludeId) params.set("exclude_id", excludeId);

  const res = await fetch(`/api/quiz/next?${params}`);
  if (!res.ok) {
    el.body.textContent = "出題可能な問題がありません。シードデータを投入してください。";
    el.choicesArea.hidden = true;
    el.textAnswerArea.hidden = true;
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

function renderQuestion(question) {
  el.category.textContent = question.category;
  renderDifficultyDots(question.difficulty);
  el.body.textContent = question.body;

  if (question.pseudocode) {
    el.pseudocode.textContent = question.pseudocode;
    el.pseudocode.hidden = false;
  } else {
    el.pseudocode.hidden = true;
  }

  if (question.subject === "A") {
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
}

el.nextQuestion.addEventListener("click", loadNextQuestion);

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

async function loadTextbookCategories() {
  const res = await fetch("/api/notes/categories");
  const groups = await res.json();
  const allCategories = groups.flatMap((g) => g.categories);
  el.textbookCategoryNav.innerHTML = "";

  if (allCategories.length === 0) {
    el.textbookContent.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "教本データがまだ登録されていません。";
    el.textbookContent.appendChild(empty);
    return;
  }

  if (!state.textbookCategory || !allCategories.includes(state.textbookCategory)) {
    state.textbookCategory = allCategories[0];
  }

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
        loadTextbookCategories();
      });
      row.appendChild(btn);
    });
    groupBlock.appendChild(row);
    el.textbookCategoryNav.appendChild(groupBlock);
  });

  loadTextbookNotes(state.textbookCategory);
}

async function loadTextbookNotes(category) {
  const res = await fetch(`/api/notes?category=${encodeURIComponent(category)}`);
  const notes = await res.json();
  el.textbookContent.innerHTML = "";
  notes.forEach((note) => {
    const section = document.createElement("div");
    renderMarkdownLite(section, note.body);
    el.textbookContent.appendChild(section);
  });
}

/**
 * 簡易マークダウン("# "見出し, "## "小見出し, "- "箇条書き, "**強調**")をDOMに描画する。
 * 信頼できる自前コンテンツのみを対象とし、innerHTMLは使わずDOM要素を組み立てる。
 */
function renderMarkdownLite(container, text) {
  container.innerHTML = "";
  let currentList = null;

  text.split("\n").forEach((rawLine) => {
    const line = rawLine.trim();
    currentList = line.startsWith("- ") ? currentList : null;

    if (line === "") return;

    if (line.startsWith("## ")) {
      container.appendChild(buildInlineElement("h3", line.slice(3)));
    } else if (line.startsWith("# ")) {
      container.appendChild(buildInlineElement("h2", line.slice(2)));
    } else if (line.startsWith("- ")) {
      if (!currentList) {
        currentList = document.createElement("ul");
        container.appendChild(currentList);
      }
      currentList.appendChild(buildInlineElement("li", line.slice(2)));
    } else {
      container.appendChild(buildInlineElement("p", line));
    }
  });
}

function buildInlineElement(tagName, text) {
  const node = document.createElement(tagName);
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  parts.forEach((part) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = part.slice(2, -2);
      node.appendChild(strong);
    } else if (part) {
      node.appendChild(document.createTextNode(part));
    }
  });
  return node;
}

loadTextbookCategories();
