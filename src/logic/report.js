import { splitCodeText } from "./code-text.js";
import { gradeQuestion } from "./score.js";

function yourAnswerText(question, response) {
  if (question.type === "mcq") {
    if (!response?.choiceId) {
      return "Blank";
    }
    const choice = question.choices.find((item) => item.id === response.choiceId);
    return choice ? choice.text : "Blank";
  }
  const text = (response?.numericText ?? "").trim();
  return text.length > 0 ? text : "Blank";
}

function keyText(question) {
  if (question.type === "mcq") {
    const choice = question.choices.find((item) => item.id === question.answer);
    return choice ? choice.text : String(question.answer);
  }
  return String(question.answer);
}

function sectionScore(correct, wrong) {
  return correct - wrong * 0.25;
}

export function buildReport(attempt) {
  const byId = Object.fromEntries(attempt.questions.map((question) => [question.id, question]));
  const questions = attempt.questionOrder.map((id, index) => {
    const question = byId[id];
    const response = attempt.responses[id] ?? {};
    return {
      number: index + 1,
      id,
      topic: question.topic || "No topic",
      type: question.type,
      stem: question.stem,
      yourAnswer: yourAnswerText(question, response),
      key: keyText(question),
      verdict: gradeQuestion(question, response),
      timeSpentMs: response.timeSpentMs ?? 0,
      explanation: question.explanation ?? "",
    };
  });

  const sections = new Map();
  for (const question of questions) {
    if (!sections.has(question.topic)) {
      sections.set(question.topic, {
        topic: question.topic,
        count: 0,
        correct: 0,
        wrong: 0,
        blank: 0,
        timeSpentMs: 0,
      });
    }
    const section = sections.get(question.topic);
    section.count += 1;
    section[question.verdict] += 1;
    section.timeSpentMs += question.timeSpentMs;
  }

  const sectionRows = [...sections.values()]
    .map((section) => ({
      ...section,
      score: sectionScore(section.correct, section.wrong),
    }))
    .sort((a, b) => {
      if (a.topic === "No topic") {
        return 1;
      }
      if (b.topic === "No topic") {
        return -1;
      }
      return a.topic.localeCompare(b.topic);
    });

  return {
    testTitle: attempt.testTitle,
    submittedAt: attempt.submittedAt,
    durationMs: attempt.durationMs,
    timeSpentMs: questions.reduce((sum, question) => sum + question.timeSpentMs, 0),
    score: attempt.score,
    sections: sectionRows,
    questions,
    wrong: questions.filter((question) => question.verdict === "wrong"),
    blank: questions.filter((question) => question.verdict === "blank"),
  };
}

export function filterReportQuestions(questions, { topic = "all", verdict = "all" } = {}) {
  return questions.filter((question) => {
    const topicMatches = topic === "all" || question.topic === topic;
    const verdictMatches = verdict === "all" || question.verdict === verdict;
    return topicMatches && verdictMatches;
  });
}

export function reportFilename(report, extension) {
  const slug = report.testTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "paper";
  const day = new Date(report.submittedAt).toISOString().slice(0, 10);
  return `${slug}-${day}.${extension}`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatReportTime(ms) {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function textBlock(text) {
  const { prose, code } = splitCodeText(text);
  let html = "";
  if (prose) {
    const asCode = !code && prose.includes("\n");
    html += `<p${asCode ? " class=\"code\"" : ""}>${escapeHtml(prose)}</p>`;
  }
  if (code) {
    html += `<p class="code">${escapeHtml(code)}</p>`;
  }
  return html;
}

function labeledBlock(label, text) {
  const { prose, code } = splitCodeText(text);
  if (code && !prose) {
    return `<p>${escapeHtml(label)}</p><p class="code">${escapeHtml(code)}</p>`;
  }
  const lead = prose ? `${label} ${prose}` : label;
  return `<p>${escapeHtml(lead)}</p>${code ? `<p class="code">${escapeHtml(code)}</p>` : ""}`;
}

function questionHtml(question) {
  const explanation = question.explanation ? textBlock(question.explanation) : "";
  return `<article>
    <h3>Question ${question.number}</h3>
    <p>${escapeHtml(question.topic)}</p>
    ${textBlock(question.stem)}
    ${labeledBlock("Your answer:", question.yourAnswer)}
    ${labeledBlock("Key:", question.key)}
    <p>Time spent: ${formatReportTime(question.timeSpentMs)}</p>
    <p>${escapeHtml(question.verdict)}</p>
    ${explanation}
  </article>`;
}

export function reportHtml(report) {
  const score = report.score.score.toFixed(2);
  const when = new Date(report.submittedAt).toLocaleString();
  const sections = report.sections
    .map(
      (section) => `<tr>
        <td>${escapeHtml(section.topic)}</td>
        <td>${section.count}</td>
        <td>${section.correct}</td>
        <td>${section.wrong}</td>
        <td>${section.blank}</td>
        <td>${section.score.toFixed(2)}</td>
        <td>${formatReportTime(section.timeSpentMs)}</td>
      </tr>`
    )
    .join("");
  const wrong = report.wrong.length
    ? report.wrong.map(questionHtml).join("")
    : "<p>No wrong answers.</p>";
  const blank = report.blank.length
    ? report.blank.map(questionHtml).join("")
    : "<p>No blank answers.</p>";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(report.testTitle)}</title>
  <style>
    body { margin: 2rem auto; max-width: 40rem; background: #f4f1ea; color: #171714; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    h1, h2 { font-family: Georgia, serif; font-weight: 400; letter-spacing: -0.03em; }
    table { border-collapse: collapse; width: 100%; background: #fbfaf7; }
    th, td { text-align: left; padding: 12px 14px; border-bottom: 1px solid #d9d5cc; }
    th { background: #ece7dd; font-size: 12px; letter-spacing: 0.07em; text-transform: uppercase; }
    article { background: #fbfaf7; border: 1px solid #d9d5cc; border-radius: 0; padding: 18px; margin: 12px 0; }
    .code, p { white-space: pre-wrap; }
    .code { font-family: "SFMono-Regular", Consolas, monospace; background: #201f1c; color: #f3efe7; padding: 16px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(report.testTitle)}</h1>
  <p>${score} / ${report.score.max}</p>
  <p>${report.score.correct} correct, ${report.score.wrong} wrong, ${report.score.blank} blank</p>
  <p>${escapeHtml(when)}</p>
  <p>Time used ${formatReportTime(report.timeSpentMs)} of ${formatReportTime(report.durationMs)}</p>
  <h2>Sections</h2>
  <table>
    <thead>
      <tr><th>Section</th><th>Questions</th><th>Correct</th><th>Wrong</th><th>Blank</th><th>Score</th><th>Time</th></tr>
    </thead>
    <tbody>${sections}</tbody>
  </table>
  <h2>Wrong answers</h2>
  ${wrong}
  <h2>Left blank</h2>
  ${blank}
  <h2>Every question</h2>
  ${report.questions.map(questionHtml).join("")}
</body>
</html>`;
}
