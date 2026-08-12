const state = {
  subject: "A",
  currentQuestion: null,
  dashboardSubject: "A",
  textbookLevel: null,
  textbookCategory: null,
  curriculum: null, // [{ level, groups: [{ group, categories }] }]
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
  textbookLevelNav: document.getElementById("textbook-level-nav"),
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
      loadTextbook();
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
  loadTextbookNotes(state.textbookLevel, state.textbookCategory);
}

function renderLevelNav(levels) {
  el.textbookLevelNav.innerHTML = "";
  levels.forEach((level) => {
    const btn = document.createElement("button");
    btn.className = "level-btn";
    btn.textContent = level;
    if (level === state.textbookLevel) btn.classList.add("active");
    btn.addEventListener("click", () => {
      if (level === state.textbookLevel) return;
      state.textbookLevel = level;
      // レベルによって分野の顔ぶれが変わるため、選択中の分野は選び直させる
      state.textbookCategory = null;
      renderTextbookNav();
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
        renderTextbookNav();
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

loadTextbook();
