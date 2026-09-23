import {
  importBank,
  getAllTests,
  findInProgress,
  listSubmittedAttempts,
  deleteTest,
  deleteAttempt,
} from "../db.js";
import { startOrResume } from "../attempt.js";
import samplePaper from "../../sample/percentages.json" with { type: "json" };

function formatLocalDateTime(epochMs) {
  return new Date(epochMs).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatScore(score) {
  return score.toFixed(2);
}

export async function renderDesk(container) {
  const [tests, history] = await Promise.all([
    getAllTests(),
    listSubmittedAttempts(),
  ]);

  const shell = document.createElement("div");
  shell.className = "shell";

  shell.innerHTML = `
    <h1 class="site-title">Mock Practice</h1>
    <div class="import-panel">
      <label class="btn btn-primary">
        Import a paper
        <input class="file-input" type="file" accept=".json,application/json">
      </label>
      <button type="button" class="btn" data-action="sample">Load the sample paper</button>
      <a class="btn-link" href="#/file">Question file</a>
      <p class="status-message" hidden></p>
    </div>
    <dialog class="confirm-dialog">
      <p class="confirm-copy"></p>
      <div class="confirm-actions">
        <button type="button" class="btn btn-danger" data-confirm>Delete</button>
        <button type="button" class="btn" data-dismiss>Keep it</button>
      </div>
    </dialog>
  `;

  const statusEl = shell.querySelector(".status-message");
  const fileInput = shell.querySelector(".file-input");
  const confirmDialog = shell.querySelector("dialog");
  const confirmCopy = shell.querySelector(".confirm-copy");
  let pendingDelete = null;

  function askDelete(message, action) {
    pendingDelete = action;
    confirmCopy.textContent = message;
    confirmDialog.showModal();
  }

  confirmDialog.querySelector("[data-dismiss]").addEventListener("click", () => {
    pendingDelete = null;
    confirmDialog.close();
  });

  confirmDialog.querySelector("[data-confirm]").addEventListener("click", async () => {
    const action = pendingDelete;
    pendingDelete = null;
    confirmDialog.close();
    if (action) {
      await action();
      await redraw();
    }
  });

  function showStatus(text, isError = false) {
    statusEl.hidden = false;
    statusEl.textContent = text;
    statusEl.classList.toggle("is-error", isError);
  }

  async function handleImport(data) {
    const result = await importBank(data);
    if (!result.ok) {
      showStatus(
        `${result.errors.join("\n")}\nNothing was saved.`,
        true
      );
      return;
    }
    showStatus(
      `Imported ${countLabel(result.questionCount, "question", "questions")} and ${countLabel(result.testCount, "paper", "papers")}.`
    );
    redraw();
  }

  async function importFromText(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      showStatus("The file is not valid JSON. Nothing was saved.", true);
      return;
    }
    await handleImport(data);
  }

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) {
      return;
    }
    await importFromText(await file.text());
  });

  shell.querySelector('[data-action="sample"]').addEventListener("click", async () => {
    await handleImport(structuredClone(samplePaper));
  });

  container.appendChild(shell);

  async function redraw() {
    const [nextTests, nextHistory] = await Promise.all([
      getAllTests(),
      listSubmittedAttempts(),
    ]);

    shell.querySelectorAll(".desk-section").forEach((el) => el.remove());

    const papersHeading = document.createElement("h2");
    papersHeading.className = "section-heading desk-section";
    papersHeading.textContent = "Papers";
    shell.appendChild(papersHeading);

    if (nextTests.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-note desk-section";
      empty.textContent =
        "Import a JSON file of questions and tests to sit a paper. A sample paper is included.";
      shell.appendChild(empty);
    } else {
      const list = document.createElement("ul");
      list.className = "schedule-list desk-section";
      for (const test of nextTests) {
        const inProgress = await findInProgress(test.id);
        const item = document.createElement("li");
        item.className = "schedule-item";
        item.innerHTML = `
          <div class="row-main">
            <p class="schedule-title">${escapeHtml(test.title)}</p>
            <p class="schedule-meta">${test.questionIds.length} questions, ${test.minutes} minutes</p>
          </div>
        `;
        const actions = document.createElement("div");
        actions.className = "row-actions";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-primary";
        btn.textContent = inProgress ? "Resume" : "Start";
        btn.addEventListener("click", async () => {
          const { attempt } = await startOrResume(test.id);
          location.hash = `#/attempt/${attempt.id}`;
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "btn btn-danger";
        remove.textContent = "Delete";
        remove.addEventListener("click", () => {
          askDelete(
            "Delete this paper? The questions stay in the bank. An unfinished sitting is discarded.",
            () => deleteTest(test.id)
          );
        });
        actions.append(btn, remove);
        item.appendChild(actions);
        list.appendChild(item);
      }
      shell.appendChild(list);
    }

    if (nextHistory.length > 0) {
      const historyHeading = document.createElement("h2");
      historyHeading.className = "section-heading desk-section";
      historyHeading.textContent = "History";
      shell.appendChild(historyHeading);

      const historyList = document.createElement("ul");
      historyList.className = "history-list desk-section";
      for (const attempt of nextHistory) {
        const item = document.createElement("li");
        item.className = "history-item";
        const score = attempt.score;
        item.innerHTML = `
          <div class="row-main">
            <p class="history-title">${escapeHtml(attempt.testTitle)}</p>
            <p class="history-meta">${formatLocalDateTime(attempt.submittedAt)}</p>
            <p class="history-meta">${formatScore(score.score)} / ${score.max}</p>
          </div>
        `;
        const actions = document.createElement("div");
        actions.className = "row-actions";
        const link = document.createElement("a");
        link.className = "btn-link";
        link.href = `#/review/${attempt.id}`;
        link.textContent = "Review";
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "btn btn-danger";
        remove.textContent = "Delete";
        remove.addEventListener("click", () => {
          askDelete("Delete this report?", () => deleteAttempt(attempt.id));
        });
        actions.append(link, remove);
        item.appendChild(actions);
        historyList.appendChild(item);
      }
      shell.appendChild(historyList);
    }
  }

  await redraw();

  return () => {
    shell.remove();
  };
}

function countLabel(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
