import { getAttempt } from "../db.js";
import { splitCodeText } from "../logic/code-text.js";
import {
  buildReport,
  filterReportQuestions,
  formatReportTime,
  reportFilename,
  reportHtml,
} from "../logic/report.js";

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function download(filename, mime, contents) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function addLine(parent, className, text, code) {
  const node = document.createElement("p");
  node.className = code ? `${className} code-block` : className;
  node.textContent = text;
  parent.appendChild(node);
  return node;
}

function addStem(parent, text) {
  const { prose, code } = splitCodeText(text);
  if (prose) {
    addLine(parent, "stem", prose, !code && prose.includes("\n"));
  }
  if (code) {
    addLine(parent, "stem", code, true);
  }
}

function addLabeled(parent, label, text) {
  const { prose, code } = splitCodeText(text);
  if (code && !prose) {
    addLine(parent, "review-row", label, false);
    addLine(parent, "review-row", code, true);
    return;
  }
  addLine(parent, "review-row", prose ? `${label} ${prose}` : label, false);
  if (code) {
    addLine(parent, "review-row", code, true);
  }
}

function questionBlock(question) {
  const block = document.createElement("article");
  block.className = "review-question";
  addLine(block, "review-index", `Question ${question.number}`, false);
  addLine(block, "review-topic", question.topic, false);
  addStem(block, question.stem);
  addLabeled(block, "Your answer:", question.yourAnswer);
  addLabeled(block, "Key:", question.key);
  addLine(block, "review-row", `Time spent: ${formatReportTime(question.timeSpentMs)}`, false);
  const verdict = document.createElement("p");
  verdict.className = `review-verdict is-${question.verdict}`;
  verdict.textContent = verdictLabel(question.verdict);
  block.appendChild(verdict);
  if (question.explanation) {
    addLine(block, "review-explanation", question.explanation, question.explanation.includes("\n"));
  }
  return block;
}

function verdictLabel(verdict) {
  if (verdict === "correct") {
    return "Correct";
  }
  if (verdict === "wrong") {
    return "Wrong";
  }
  return "Blank";
}

function textCell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

function filterCell(topic, verdictId, text) {
  const td = document.createElement("td");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "filter-link";
  button.dataset.verdict = verdictId;
  button.textContent = text;
  const result = verdictId === "all" ? "every result" : verdictId;
  button.setAttribute("aria-label", `${topic}, ${result}`);
  td.appendChild(button);
  return td;
}

const VERDICT_FILTERS = [
  { id: "all", label: "Everything" },
  { id: "correct", label: "Correct" },
  { id: "wrong", label: "Wrong" },
  { id: "blank", label: "Blank" },
];

export async function renderReview(container, attemptId) {
  const attempt = await getAttempt(attemptId);
  if (!attempt || attempt.status !== "submitted") {
    location.replace("#/");
    return () => {};
  }

  const report = buildReport(attempt);
  const shell = document.createElement("div");
  shell.className = "review-shell";

  const actions = document.createElement("div");
  actions.className = "report-actions";
  const back = document.createElement("a");
  back.className = "back-link btn-link";
  back.href = "#/";
  back.textContent = "Back to desk";
  const exportJson = document.createElement("button");
  exportJson.type = "button";
  exportJson.className = "btn btn-primary";
  exportJson.textContent = "Export report";
  exportJson.addEventListener("click", () => {
    download(
      reportFilename(report, "json"),
      "application/json",
      JSON.stringify(report, null, 2)
    );
  });
  const saveCopy = document.createElement("button");
  saveCopy.type = "button";
  saveCopy.className = "btn";
  saveCopy.textContent = "Save a copy";
  saveCopy.addEventListener("click", () => {
    download(reportFilename(report, "html"), "text/html", reportHtml(report));
  });
  actions.append(back, exportJson, saveCopy);
  shell.appendChild(actions);

  const scoreBlock = document.createElement("div");
  scoreBlock.className = "score-block";
  const when = new Date(report.submittedAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  scoreBlock.innerHTML = `
    <p class="score-main">${report.score.score.toFixed(2)} / ${report.score.max}</p>
    <p class="score-detail">${report.score.correct} correct, ${report.score.wrong} wrong, ${report.score.blank} blank</p>
    <h1 class="site-title">${escapeHtml(report.testTitle)}</h1>
    <p class="score-detail">${escapeHtml(when)}</p>
    <p class="score-detail">Time used ${formatReportTime(report.timeSpentMs)} of ${formatReportTime(report.durationMs)}</p>
  `;
  shell.appendChild(scoreBlock);

  const sectionHeading = document.createElement("h2");
  sectionHeading.className = "section-heading";
  sectionHeading.textContent = "Sections";
  shell.appendChild(sectionHeading);

  const tableWrap = document.createElement("div");
  tableWrap.className = "topic-scroll";
  const table = document.createElement("table");
  table.className = "topic-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th scope="col">Section</th>
        <th scope="col">Questions</th>
        <th scope="col">Correct</th>
        <th scope="col">Wrong</th>
        <th scope="col">Blank</th>
        <th scope="col">Score</th>
        <th scope="col">Time</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");
  for (const section of report.sections) {
    const tr = document.createElement("tr");
    tr.dataset.topic = section.topic;
    tr.append(
      filterCell(section.topic, "all", section.topic),
      textCell(String(section.count)),
      filterCell(section.topic, "correct", String(section.correct)),
      filterCell(section.topic, "wrong", String(section.wrong)),
      filterCell(section.topic, "blank", String(section.blank)),
      textCell(section.score.toFixed(2)),
      textCell(formatReportTime(section.timeSpentMs))
    );
    tbody.appendChild(tr);
  }
  tableWrap.appendChild(table);
  shell.appendChild(tableWrap);

  let topic = "all";
  let verdict = "all";

  const filters = document.createElement("div");
  filters.className = "report-filters";

  const sectionLabel = document.createElement("label");
  sectionLabel.className = "filter-section";
  sectionLabel.textContent = "Section";
  const sectionSelect = document.createElement("select");
  sectionSelect.className = "filter-select";
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "Every section";
  sectionSelect.appendChild(allOption);
  for (const section of report.sections) {
    const option = document.createElement("option");
    option.value = section.topic;
    option.textContent = section.topic;
    sectionSelect.appendChild(option);
  }
  sectionLabel.appendChild(sectionSelect);

  const verdictGroup = document.createElement("div");
  verdictGroup.className = "filter-set";
  verdictGroup.setAttribute("role", "group");
  verdictGroup.setAttribute("aria-label", "Result");
  const verdictButtons = new Map();
  for (const item of VERDICT_FILTERS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn filter-btn";
    button.textContent = item.label;
    button.addEventListener("click", () => {
      verdict = item.id;
      syncFilters();
    });
    verdictButtons.set(item.id, button);
    verdictGroup.appendChild(button);
  }
  filters.append(sectionLabel, verdictGroup);

  const filterStatus = document.createElement("p");
  filterStatus.className = "filter-status";

  const listHeading = document.createElement("h2");
  listHeading.className = "section-heading";
  const list = document.createElement("div");

  function paintList() {
    const shown = filterReportQuestions(report.questions, { topic, verdict });
    const verdictLabel = VERDICT_FILTERS.find((item) => item.id === verdict).label;
    const sectionLabelText = topic === "all" ? "every section" : topic;
    listHeading.textContent = `${verdictLabel} · ${sectionLabelText}`;
    filterStatus.textContent = `${shown.length} of ${report.questions.length}`;
    list.replaceChildren();
    if (shown.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-note";
      empty.textContent = "No questions match this filter.";
      list.appendChild(empty);
      return;
    }
    for (const question of shown) {
      list.appendChild(questionBlock(question));
    }
  }

  function syncFilters() {
    sectionSelect.value = topic;
    for (const [id, button] of verdictButtons) {
      const on = id === verdict;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-pressed", String(on));
    }
    for (const tr of tbody.querySelectorAll("tr")) {
      tr.classList.toggle("is-filtered", tr.dataset.topic === topic && topic !== "all");
    }
    for (const button of tbody.querySelectorAll("[data-verdict]")) {
      const rowTopic = button.closest("tr").dataset.topic;
      const on = rowTopic === topic && button.dataset.verdict === verdict;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-pressed", String(on));
    }
    paintList();
  }

  sectionSelect.addEventListener("change", () => {
    topic = sectionSelect.value;
    syncFilters();
  });

  for (const tr of tbody.querySelectorAll("tr")) {
    const sectionTopic = tr.dataset.topic;
    tr.querySelectorAll("[data-verdict]").forEach((button) => {
      button.addEventListener("click", () => {
        topic = sectionTopic;
        verdict = button.dataset.verdict;
        syncFilters();
        listHeading.scrollIntoView({ block: "nearest" });
      });
    });
  }

  shell.append(filters, filterStatus, listHeading, list);
  syncFilters();

  container.appendChild(shell);

  return () => {
    shell.remove();
  };
}
