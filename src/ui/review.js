import { getAttempt } from "../db.js";
import { parseNumericAnswer, numericEqual } from "../logic/numeric.js";

function formatMs(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatScore(score) {
  return score.toFixed(2);
}

function verdictFor(question, response) {
  if (question.type === "mcq") {
    if (!response?.choiceId) {
      return "blank";
    }
    return response.choiceId === question.answer ? "correct" : "wrong";
  }
  const parsed = parseNumericAnswer(response?.numericText ?? "");
  if (parsed === null) {
    return "blank";
  }
  return numericEqual(parsed, question.answer) ? "correct" : "wrong";
}

function yourAnswerText(question, response) {
  if (question.type === "mcq") {
    if (!response?.choiceId) {
      return "Blank";
    }
    const choice = question.choices.find((c) => c.id === response.choiceId);
    return choice ? choice.text : "Blank";
  }
  const text = (response?.numericText ?? "").trim();
  return text.length > 0 ? text : "Blank";
}

function keyText(question) {
  if (question.type === "mcq") {
    const choice = question.choices.find((c) => c.id === question.answer);
    return choice ? choice.text : question.answer;
  }
  return String(question.answer);
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

function buildTopicBreakdown(attempt) {
  const topics = new Map();
  for (const question of attempt.questions) {
    if (!question.topic) {
      continue;
    }
    if (!topics.has(question.topic)) {
      topics.set(question.topic, { correct: 0, wrong: 0, blank: 0 });
    }
    const bucket = topics.get(question.topic);
    const verdict = verdictFor(question, attempt.responses[question.id]);
    bucket[verdict] += 1;
  }
  return [...topics.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([topic, counts]) => ({
      topic,
      ...counts,
      score: counts.correct - counts.wrong * 0.25,
    }));
}

export async function renderReview(container, attemptId) {
  const attempt = await getAttempt(attemptId);
  if (!attempt || attempt.status !== "submitted") {
    location.replace("#/");
    return () => {};
  }

  const { score } = attempt;
  const topics = buildTopicBreakdown(attempt);
  const hasTopics = topics.length > 0;

  const shell = document.createElement("div");
  shell.className = "review-shell";

  const back = document.createElement("a");
  back.className = "back-link btn-link";
  back.href = "#/";
  back.textContent = "Back to desk";
  shell.appendChild(back);

  const scoreBlock = document.createElement("div");
  scoreBlock.className = "score-block";
  scoreBlock.innerHTML = `
    <p class="score-main">${formatScore(score.score)} / ${score.max}</p>
    <p class="score-detail">${score.correct} correct, ${score.wrong} wrong, ${score.blank} blank</p>
    <h1 class="site-title">${escapeHtml(attempt.testTitle)}</h1>
  `;
  shell.appendChild(scoreBlock);

  if (hasTopics) {
    const table = document.createElement("table");
    table.className = "topic-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th scope="col">Topic</th>
          <th scope="col">Correct</th>
          <th scope="col">Wrong</th>
          <th scope="col">Blank</th>
          <th scope="col">Score</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");
    for (const row of topics) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(row.topic)}</td>
        <td>${row.correct}</td>
        <td>${row.wrong}</td>
        <td>${row.blank}</td>
        <td>${formatScore(row.score)}</td>
      `;
      tbody.appendChild(tr);
    }
    shell.appendChild(table);
  }

  attempt.questionOrder.forEach((questionId, index) => {
    const question = attempt.questions.find((q) => q.id === questionId);
    const response = attempt.responses[questionId];
    const verdict = verdictFor(question, response);

    const block = document.createElement("article");
    block.className = "review-question";
    block.innerHTML = `
      <p class="review-index">Question ${index + 1}</p>
      <p class="stem">${escapeHtml(question.stem)}</p>
      <p class="review-row">Your answer: ${escapeHtml(yourAnswerText(question, response))}</p>
      <p class="review-row">Key: ${escapeHtml(keyText(question))}</p>
      <p class="review-row">Time spent: ${formatMs(response.timeSpentMs)}</p>
      <p class="review-verdict is-${verdict}">${verdictLabel(verdict)}</p>
    `;
    if (question.explanation) {
      const explanation = document.createElement("p");
      explanation.className = "review-explanation";
      explanation.textContent = question.explanation;
      block.appendChild(explanation);
    }
    shell.appendChild(block);
  });

  container.appendChild(shell);

  return () => {
    shell.remove();
  };
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
