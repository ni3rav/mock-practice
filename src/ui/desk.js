import {
  importBank,
  getAllTests,
  findInProgress,
  listSubmittedAttempts,
} from "../db.js";
import { startOrResume } from "../attempt.js";

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
    <h1 class="site-title">Astound Prep</h1>
    <div class="import-panel">
      <label class="btn btn-primary">
        Import a paper
        <input class="file-input" type="file" accept=".json,application/json">
      </label>
      <button type="button" class="btn" data-action="sample">Load the sample paper</button>
      <p class="status-message" hidden></p>
    </div>
  `;

  const statusEl = shell.querySelector(".status-message");
  const fileInput = shell.querySelector(".file-input");

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
    try {
      const response = await fetch("./sample/percentages.json");
      if (!response.ok) {
        showStatus("The sample paper could not be loaded. Nothing was saved.", true);
        return;
      }
      await importFromText(await response.text());
    } catch {
      showStatus("The sample paper could not be loaded. Nothing was saved.", true);
    }
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
          <p class="schedule-title">${escapeHtml(test.title)}</p>
          <p class="schedule-meta">${test.questionIds.length} questions, ${test.minutes} minutes</p>
        `;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-primary";
        btn.textContent = inProgress ? "Resume" : "Start";
        btn.addEventListener("click", async () => {
          const { attempt } = await startOrResume(test.id);
          location.hash = `#/attempt/${attempt.id}`;
        });
        item.appendChild(btn);
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
          <p class="history-title">${escapeHtml(attempt.testTitle)}</p>
          <p class="history-meta">${formatLocalDateTime(attempt.submittedAt)}</p>
          <p class="history-meta">${formatScore(score.score)} / ${score.max}</p>
        `;
        const link = document.createElement("a");
        link.className = "btn-link";
        link.href = `#/review/${attempt.id}`;
        link.textContent = "Review";
        item.appendChild(link);
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
