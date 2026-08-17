const state = {
  course: null, // 選択中のコース(ホーム画面ではnull)
  subject: "A",
  currentQuestion: null,
  dashboardSubject: "A",
  textbookCategory: null,
  textbookChapter: null,
};

const el = {
  tabBtns: document.querySelectorAll(".tab-btn"),
  courseNav: document.getElementById("course-nav"),
  courseBar: document.getElementById("course-bar"),
  backToHome: document.getElementById("back-to-home"),
  brandTitle: document.getElementById("brand-title"),
  courseList: document.getElementById("course-list"),
  dashSubjectSwitch: document.getElementById("dash-subject-switch"),
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
  statsList: document.getElementById("stats-list"),
  textbookCategoryNav: document.getElementById("textbook-category-nav"),
  textbookChapterNav: document.getElementById("textbook-chapter-nav"),
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

el.backToHome.addEventListener("click", showHome);

/** コース選択画面へ戻る */
function showHome() {
  state.course = null;
  state.textbookCategory = null;
  state.textbookChapter = null;
  state.currentQuestion = null;

  el.courseNav.hidden = true;
  el.courseBar.hidden = true;
  el.brandTitle.textContent = "IT学習アプリ";
  switchView("home-view");
  loadCourses();
}

async function loadCourses() {
  const res = await fetch("/api/courses");
  const courses = await res.json();
  el.courseList.innerHTML = "";

  courses.forEach((course) => {
    const card = document.createElement("button");
    card.className = "course-card";

    const name = document.createElement("h3");
    name.textContent = course.name;

    const subtitle = document.createElement("span");
    subtitle.className = "course-subtitle";
    subtitle.textContent = course.subtitle;

    const desc = document.createElement("p");
    desc.className = "course-desc";
    desc.textContent = course.description;

    const stats = document.createElement("div");
    stats.className = "course-stats";
    [
      [course.category_count, "分野"],
      [course.chapter_count, "章の教本"],
      [course.question_count, "問"],
    ].forEach(([value, label]) => {
      const item = document.createElement("span");
      const num = document.createElement("strong");
      num.textContent = value;
      item.appendChild(num);
      item.appendChild(document.createTextNode(label));
      stats.appendChild(item);
    });

    card.appendChild(name);
    card.appendChild(subtitle);
    card.appendChild(desc);
    card.appendChild(stats);
    card.addEventListener("click", () => openCourse(course));
    el.courseList.appendChild(card);
  });
}

/** コース専用画面に入る */
function openCourse(course) {
  state.course = course;
  state.subject = course.subjects[0];
  state.dashboardSubject = course.subjects[0];
  state.textbookCategory = null;
  state.textbookChapter = null;
  state.currentQuestion = null;

  el.brandTitle.textContent = course.name;
  el.courseNav.hidden = false;
  el.courseBar.hidden = false;

  // このコースに無い科目のタブは隠す(実務IT知識には科目Bが無い)
  el.tabBtns.forEach((btn) => {
    const subject = btn.dataset.subject;
    btn.hidden = subject ? !course.subjects.includes(subject) : false;
    btn.classList.toggle("active", btn.dataset.tab === "textbook");
  });

  renderDashboardSubjectSwitch(course);
  switchView("textbook-view");
  loadTextbookCategories();
}

function renderDashboardSubjectSwitch(course) {
  el.dashSubjectSwitch.innerHTML = "";
  if (course.subjects.length < 2) return; // 科目が1つだけなら切替は不要

  course.subjects.forEach((subject) => {
    const btn = document.createElement("button");
    btn.className = "dash-subject-btn";
    btn.textContent = `科目${subject}`;
    if (subject === state.dashboardSubject) btn.classList.add("active");
    btn.addEventListener("click", () => {
      el.dashSubjectSwitch
        .querySelectorAll("button")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.dashboardSubject = subject;
      loadDashboard(subject);
    });
    el.dashSubjectSwitch.appendChild(btn);
  });
}

/** APIに渡すコース絞り込みパラメータ */
function courseParam() {
  return state.course ? `course=${encodeURIComponent(state.course.id)}` : "";
}

async function loadNextQuestion() {
  el.resultArea.hidden = true;
  const excludeId = state.currentQuestion ? state.currentQuestion.id : "";
  const params = new URLSearchParams({ subject: state.subject });
  if (excludeId) params.set("exclude_id", excludeId);
  if (state.course) params.set("course", state.course.id);

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
  const res = await fetch(`/api/progress/summary?subject=${subject}&${courseParam()}`);
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
  const res = await fetch(`/api/notes/categories?${courseParam()}`);
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

  el.textbookChapterNav.innerHTML = "";
  el.textbookContent.innerHTML = "";

  if (notes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "この分野の教本はまだ準備中です。";
    el.textbookContent.appendChild(empty);
    return;
  }

  // 選択中の章がこの分野に無ければ先頭の章に戻す
  if (!notes.some((n) => n.key === state.textbookChapter)) {
    state.textbookChapter = notes[0].key;
  }

  if (notes.length > 1) {
    el.textbookChapterNav.hidden = false;
    notes.forEach((note, index) => {
      const btn = document.createElement("button");
      btn.className = "chapter-btn";
      if (note.key === state.textbookChapter) btn.classList.add("active");

      const num = document.createElement("span");
      num.className = "chapter-num";
      num.textContent = index + 1;
      const label = document.createElement("span");
      label.textContent = note.title;

      btn.appendChild(num);
      btn.appendChild(label);
      btn.addEventListener("click", () => {
        state.textbookChapter = note.key;
        loadTextbookNotes(category);
        el.textbookContent.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      el.textbookChapterNav.appendChild(btn);
    });
  } else {
    el.textbookChapterNav.hidden = true;
  }

  const current = notes.find((n) => n.key === state.textbookChapter) || notes[0];
  renderMarkdownLite(el.textbookContent, current.body);

  // 章が複数あるときは末尾に「次の章へ」を出す
  const currentIndex = notes.indexOf(current);
  if (currentIndex < notes.length - 1) {
    const next = notes[currentIndex + 1];
    const nextBtn = document.createElement("button");
    nextBtn.className = "next-chapter-btn";
    nextBtn.textContent = `次の章へ: ${next.title}`;
    nextBtn.addEventListener("click", () => {
      state.textbookChapter = next.key;
      loadTextbookNotes(category);
      el.textbookContent.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    el.textbookContent.appendChild(nextBtn);
  }
}

/**
 * 教本・解説用の簡易マークダウンをDOMに描画する。
 *
 * 対応記法:
 *   # / ## / ###     見出し
 *   - / 1.           箇条書き・番号付きリスト
 *   > [ラベル] 本文   囲み枠(補足・注意・例え話など)
 *   ```              計算例などの整形済みブロック
 *   | a | b |        表(2行目の |---| は区切り行)
 *   **強調** `コード`  インライン装飾
 *
 * 信頼できる自前コンテンツのみを対象とし、innerHTMLは使わずDOM要素を組み立てる。
 */
function renderMarkdownLite(container, text) {
  container.innerHTML = "";

  const lines = text.split("\n");
  let i = 0;
  let list = null; // 連続するリスト項目をまとめるための現在のul/ol

  const closeList = () => {
    list = null;
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (line === "") {
      closeList();
      i++;
      continue;
    }

    // 整形済みブロック(計算例など)
    if (line.startsWith("```")) {
      closeList();
      const label = line.slice(3).trim();
      const buffer = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        buffer.push(lines[i]);
        i++;
      }
      i++; // 閉じる ``` を読み飛ばす

      const block = document.createElement("div");
      block.className = "example-block";
      if (label) {
        const caption = document.createElement("div");
        caption.className = "example-label";
        caption.textContent = label;
        block.appendChild(caption);
      }
      const pre = document.createElement("pre");
      pre.textContent = buffer.join("\n");
      block.appendChild(pre);
      container.appendChild(block);
      continue;
    }

    // 表
    if (line.startsWith("|")) {
      closeList();
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(lines[i].trim());
        i++;
      }
      container.appendChild(buildTable(rows));
      continue;
    }

    // 囲み枠
    if (line.startsWith("> ")) {
      closeList();
      const buffer = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        buffer.push(lines[i].trim().slice(2));
        i++;
      }
      container.appendChild(buildCallout(buffer));
      continue;
    }

    // 見出し
    if (line.startsWith("### ")) {
      closeList();
      container.appendChild(buildInlineElement("h4", line.slice(4)));
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      closeList();
      container.appendChild(buildInlineElement("h3", line.slice(3)));
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      closeList();
      container.appendChild(buildInlineElement("h2", line.slice(2)));
      i++;
      continue;
    }

    // リスト
    const numbered = line.match(/^(\d+)\.\s+(.*)$/);
    if (line.startsWith("- ") || numbered) {
      const wantTag = numbered ? "OL" : "UL";
      if (!list || list.tagName !== wantTag) {
        list = document.createElement(numbered ? "ol" : "ul");
        container.appendChild(list);
      }
      list.appendChild(
        buildInlineElement("li", numbered ? numbered[2] : line.slice(2))
      );
      i++;
      continue;
    }

    closeList();
    container.appendChild(buildInlineElement("p", line));
    i++;
  }
}

function buildTable(rows) {
  const wrapper = document.createElement("div");
  wrapper.className = "table-wrapper";
  const table = document.createElement("table");

  const cells = (row) =>
    row
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());

  const isSeparator = (row) => /^\|[\s:|-]+\|?$/.test(row);

  rows.forEach((row, index) => {
    if (isSeparator(row)) return;

    const isHeader = index === 0;
    const tr = document.createElement("tr");
    cells(row).forEach((cellText) => {
      tr.appendChild(buildInlineElement(isHeader ? "th" : "td", cellText));
    });

    if (isHeader) {
      const thead = document.createElement("thead");
      thead.appendChild(tr);
      table.appendChild(thead);
    } else {
      let tbody = table.querySelector("tbody");
      if (!tbody) {
        tbody = document.createElement("tbody");
        table.appendChild(tbody);
      }
      tbody.appendChild(tr);
    }
  });

  wrapper.appendChild(table);
  return wrapper;
}

/** "> [注意] 本文" のように先頭に [ラベル] があれば見出し付きの囲み枠にする */
function buildCallout(lines) {
  const box = document.createElement("div");
  box.className = "callout";

  const labelMatch = lines[0].match(/^\[(.+?)\]\s*(.*)$/);
  let bodyLines = lines;

  if (labelMatch) {
    const label = document.createElement("div");
    label.className = "callout-label";
    label.textContent = labelMatch[1];
    box.appendChild(label);
    box.dataset.kind = labelMatch[1];
    bodyLines = [labelMatch[2], ...lines.slice(1)];
  }

  bodyLines.forEach((text) => {
    const trimmed = text.trim();
    if (trimmed === "") return;
    if (trimmed.startsWith("- ")) {
      let ul = box.querySelector("ul:last-of-type");
      if (!ul) {
        ul = document.createElement("ul");
        box.appendChild(ul);
      }
      ul.appendChild(buildInlineElement("li", trimmed.slice(2)));
    } else {
      box.appendChild(buildInlineElement("p", trimmed));
    }
  });

  return box;
}

function buildInlineElement(tagName, text) {
  const node = document.createElement(tagName);
  // **強調** と `コード` を切り出す
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  parts.forEach((part) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = part.slice(2, -2);
      node.appendChild(strong);
    } else if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      const code = document.createElement("code");
      code.textContent = part.slice(1, -1);
      node.appendChild(code);
    } else if (part) {
      node.appendChild(document.createTextNode(part));
    }
  });
  return node;
}

loadCourses();
