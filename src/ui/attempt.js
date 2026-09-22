import { getAttempt } from "../db.js";
import { persist, abandon, submitAndStore } from "../attempt.js";
import { remainingMs } from "../logic/time.js";
import {
  flushTime,
  setActive,
  toggleChoice,
  setNumericText,
  toggleMark,
  countOpen,
} from "../logic/attempt-state.js";

function formatRemaining(ms) {
  const clamped = Math.max(0, ms);
  const totalSec = Math.ceil(clamped / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatMs(ms) {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function questionById(attempt) {
  return Object.fromEntries(attempt.questions.map((q) => [q.id, q]));
}

function isAnswered(attempt, questionId) {
  const question = questionById(attempt)[questionId];
  const response = attempt.responses[questionId];
  if (!question || !response) {
    return false;
  }
  if (question.type === "mcq") {
    return Boolean(response.choiceId);
  }
  return (response.numericText ?? "").trim().length > 0;
}

function paletteClass(attempt, questionId) {
  const response = attempt.responses[questionId];
  if (!response.visited) {
    return "is-unvisited";
  }
  return isAnswered(attempt, questionId) ? "is-answered" : "is-visited";
}

function questionTimeMs(attempt, questionId, now, enteredAt) {
  const response = attempt.responses[questionId];
  let ms = response.timeSpentMs;
  if (questionId === attempt.activeQuestionId && enteredAt != null) {
    ms += Math.max(0, now - enteredAt);
  }
  return ms;
}

function dialogOpen() {
  return Boolean(document.querySelector("dialog[open]"));
}

export async function renderAttempt(container, attemptId) {
  let attempt = await getAttempt(attemptId);
  if (!attempt) {
    location.replace("#/");
    return () => {};
  }
  if (attempt.status === "submitted") {
    location.replace(`#/review/${attemptId}`);
    return () => {};
  }

  let enteredAt = Date.now();
  let autoSubmitted = false;
  let clockEl;
  let timeOnQuestionEl;
  let numericInput;
  let submitDialog;
  let abandonDialog;

  const shell = document.createElement("div");
  shell.className = "attempt-shell";
  shell.innerHTML = `
    <header class="clock-bar">
      <p class="clock" aria-live="polite"></p>
    </header>
    <div class="paper-sheet">
      <p class="stem"></p>
      <p class="question-meta"></p>
      <div class="choices" hidden></div>
      <input class="numeric-input" hidden inputmode="decimal" autocomplete="off">
      <div class="attempt-actions">
        <button type="button" class="btn mark-btn">Mark for review</button>
      </div>
      <div class="palette" role="navigation" aria-label="Question palette"></div>
      <footer class="attempt-footer">
        <button type="button" class="btn btn-primary" data-action="submit">Submit paper</button>
        <button type="button" class="btn btn-danger" data-action="abandon">Abandon paper</button>
      </footer>
    </div>
    <dialog class="confirm-dialog" data-dialog="submit">
      <p class="submit-message"></p>
      <div class="confirm-actions">
        <button type="button" class="btn btn-primary" data-confirm="submit">Submit paper</button>
        <button type="button" class="btn" data-dismiss="submit">Keep working</button>
      </div>
    </dialog>
    <dialog class="confirm-dialog" data-dialog="abandon">
      <p>Abandon this paper? Your answers on it will be deleted.</p>
      <div class="confirm-actions">
        <button type="button" class="btn btn-danger" data-confirm="abandon">Abandon paper</button>
        <button type="button" class="btn" data-dismiss="abandon">Keep working</button>
      </div>
    </dialog>
  `;

  container.appendChild(shell);

  clockEl = shell.querySelector(".clock");
  const stemEl = shell.querySelector(".stem");
  timeOnQuestionEl = shell.querySelector(".question-meta");
  const choicesEl = shell.querySelector(".choices");
  numericInput = shell.querySelector(".numeric-input");
  const paletteEl = shell.querySelector(".palette");
  const markBtn = shell.querySelector(".mark-btn");
  submitDialog = shell.querySelector('[data-dialog="submit"]');
  abandonDialog = shell.querySelector('[data-dialog="abandon"]');
  const submitMessage = submitDialog.querySelector(".submit-message");

  async function save(next) {
    attempt = next;
    await persist(attempt);
  }

  async function doSubmit(now) {
    if (autoSubmitted) {
      return;
    }
    autoSubmitted = true;
    const stored = await submitAndStore(attempt, now, enteredAt);
    location.replace(`#/review/${stored.id}`);
  }

  function paintClock(now) {
    const remaining = remainingMs(attempt.startedAt, attempt.durationMs, now);
    clockEl.textContent = formatRemaining(remaining);
    clockEl.classList.toggle("is-expiring", remaining > 0 && remaining <= 60000);
    if (remaining <= 0 && !autoSubmitted) {
      doSubmit(now);
    }
  }

  function renderQuestion() {
    const question = questionById(attempt)[attempt.activeQuestionId];
    const response = attempt.responses[attempt.activeQuestionId];
    const now = Date.now();

    stemEl.textContent = question.stem;
    timeOnQuestionEl.textContent = `Time on this question: ${formatMs(
      questionTimeMs(attempt, attempt.activeQuestionId, now, enteredAt)
    )}`;

    markBtn.classList.toggle("is-marked", response.marked);
    markBtn.textContent = response.marked ? "Marked for review" : "Mark for review";

    choicesEl.replaceChildren();
    choicesEl.hidden = question.type !== "mcq";
    numericInput.hidden = question.type !== "numeric";

    if (question.type === "mcq") {
      question.choices.forEach((choice, index) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "choice";
        if (response.choiceId === choice.id) {
          btn.classList.add("is-selected");
        }
        btn.textContent = `${index + 1}. ${choice.text}`;
        btn.addEventListener("click", async () => {
          await save(toggleChoice(attempt, question.id, choice.id));
          renderQuestion();
          renderPalette();
        });
        choicesEl.appendChild(btn);
      });
    } else {
      numericInput.value = response.numericText ?? "";
    }

    renderPalette();
    paintClock(now);
  }

  function renderPalette() {
    paletteEl.replaceChildren();
    attempt.questionOrder.forEach((questionId, index) => {
      const response = attempt.responses[questionId];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `palette-cell ${paletteClass(attempt, questionId)}`;
      if (questionId === attempt.activeQuestionId) {
        btn.classList.add("is-active");
      }
      if (response.marked) {
        btn.classList.add("is-marked");
      }
      btn.textContent = String(index + 1);
      btn.addEventListener("click", async () => {
        if (questionId === attempt.activeQuestionId) {
          return;
        }
        const now = Date.now();
        const result = setActive(attempt, questionId, now, enteredAt);
        attempt = result.attempt;
        enteredAt = result.enteredAt;
        await persist(attempt);
        renderQuestion();
      });
      paletteEl.appendChild(btn);
    });
  }

  numericInput.addEventListener("input", async () => {
    await save(setNumericText(attempt, attempt.activeQuestionId, numericInput.value));
    renderPalette();
  });

  markBtn.addEventListener("click", async () => {
    await save(toggleMark(attempt, attempt.activeQuestionId));
    renderQuestion();
  });

  shell.querySelector('[data-action="submit"]').addEventListener("click", () => {
    const { blank, marked } = countOpen(attempt);
    submitMessage.textContent = `Submit this paper? ${blank} questions are blank. ${marked} are marked.`;
    submitDialog.showModal();
  });

  shell.querySelector('[data-action="abandon"]').addEventListener("click", () => {
    abandonDialog.showModal();
  });

  submitDialog.querySelector('[data-confirm="submit"]').addEventListener("click", async () => {
    submitDialog.close();
    await doSubmit(Date.now());
  });

  submitDialog.querySelector('[data-dismiss="submit"]').addEventListener("click", () => {
    submitDialog.close();
  });

  abandonDialog.querySelector('[data-confirm="abandon"]').addEventListener("click", async () => {
    abandonDialog.close();
    await abandon(attempt.id);
    location.replace("#/");
  });

  abandonDialog.querySelector('[data-dismiss="abandon"]').addEventListener("click", () => {
    abandonDialog.close();
  });

  async function moveRelative(delta) {
    const order = attempt.questionOrder;
    const idx = order.indexOf(attempt.activeQuestionId);
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= order.length) {
      return;
    }
    const now = Date.now();
    const result = setActive(attempt, order[nextIdx], now, enteredAt);
    attempt = result.attempt;
    enteredAt = result.enteredAt;
    await persist(attempt);
    renderQuestion();
  }

  function onKeyDown(event) {
    if (dialogOpen()) {
      return;
    }

    const question = questionById(attempt)[attempt.activeQuestionId];
    const numericFocused = document.activeElement === numericInput;

    if (numericFocused) {
      return;
    }

    if (event.key === "m" || event.key === "M") {
      event.preventDefault();
      save(toggleMark(attempt, attempt.activeQuestionId)).then(() => renderQuestion());
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveRelative(-1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveRelative(1);
      return;
    }

    if (question.type === "mcq") {
      const digit = Number(event.key);
      if (digit >= 1 && digit <= 5) {
        const choice = question.choices[digit - 1];
        if (choice) {
          event.preventDefault();
          save(toggleChoice(attempt, question.id, choice.id)).then(() => {
            renderQuestion();
            renderPalette();
          });
        }
      }
    }
  }

  async function onVisibilityChange() {
    if (document.visibilityState === "hidden") {
      const now = Date.now();
      attempt = flushTime(attempt, attempt.activeQuestionId, now, enteredAt);
      enteredAt = now;
      await persist(attempt);
    }
  }

  const clockInterval = setInterval(() => {
    const now = Date.now();
    paintClock(now);
    if (timeOnQuestionEl) {
      timeOnQuestionEl.textContent = `Time on this question: ${formatMs(
        questionTimeMs(attempt, attempt.activeQuestionId, now, enteredAt)
      )}`;
    }
  }, 250);

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("visibilitychange", onVisibilityChange);

  renderQuestion();

  return () => {
    clearInterval(clockInterval);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    shell.remove();
  };
}
