import { getAttempt } from "../db.js";
import {
  buildReport,
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

function questionBlock(question) {
  const block = document.createElement("article");
  block.className = "review-question";
  block.innerHTML = `
    <p class="review-index">Question ${question.number}</p>
    <p class="review-topic">${escapeHtml(question.topic)}</p>
    <p class="stem">${escapeHtml(question.stem)}</p>
    <p class="review-row">Your answer: ${escapeHtml(question.yourAnswer)}</p>
    <p class="review-row">Key: ${escapeHtml(question.key)}</p>
    <p class="review-row">Time spent: ${formatReportTime(question.timeSpentMs)}</p>
    <p class="review-verdict is-${question.verdict}">${verdictLabel(question.verdict)}</p>
  `;
  if (question.explanation) {
    const explanation = document.createElement("p");
    explanation.className = "review-explanation";
    explanation.textContent = question.explanation;
    block.appendChild(explanation);
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

function addQuestionGroup(shell, title, questions, emptyText) {
  const heading = document.createElement("h2");
  heading.className = "section-heading";
  heading.textContent = title;
  shell.appendChild(heading);
  if (questions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = emptyText;
    shell.appendChild(empty);
    return;
  }
  for (const question of questions) {
    shell.appendChild(questionBlock(question));
  }
}

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
    tr.innerHTML = `
      <td>${escapeHtml(section.topic)}</td>
      <td>${section.count}</td>
      <td>${section.correct}</td>
      <td>${section.wrong}</td>
      <td>${section.blank}</td>
      <td>${section.score.toFixed(2)}</td>
      <td>${formatReportTime(section.timeSpentMs)}</td>
    `;
    tbody.appendChild(tr);
  }
  tableWrap.appendChild(table);
  shell.appendChild(tableWrap);

  addQuestionGroup(shell, "Wrong answers", report.wrong, "No wrong answers.");
  addQuestionGroup(shell, "Left blank", report.blank, "No blank answers.");
  addQuestionGroup(shell, "Every question", report.questions, "This paper has no questions.");

  container.appendChild(shell);

  return () => {
    shell.remove();
  };
}
