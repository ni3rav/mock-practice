import { buildAttempt } from "./logic/paper.js";
import { submitAttempt } from "./logic/attempt-state.js";
import {
  deleteAttempt,
  findInProgress,
  getAttempt,
  getQuestion,
  getTest,
  putAttempt,
} from "./db.js";

function newAttemptId() {
  if (typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // file:// is not a secure context in every browser
    }
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function startOrResume(testId, now = Date.now()) {
  const existing = await findInProgress(testId);
  if (existing) {
    return { attempt: existing, mode: "resume" };
  }

  const test = await getTest(testId);
  if (!test) {
    throw new Error(testId);
  }

  const questionsById = {};
  for (const questionId of test.questionIds) {
    const question = await getQuestion(questionId);
    if (!question) {
      throw new Error(questionId);
    }
    questionsById[questionId] = question;
  }

  const attempt = buildAttempt({
    id: newAttemptId(),
    test,
    questionsById,
    now,
  });
  await putAttempt(attempt);
  return { attempt, mode: "started" };
}

export async function persist(attempt) {
  const current = await getAttempt(attempt.id);
  if (current?.status === "submitted" && attempt.status !== "submitted") {
    return;
  }
  await putAttempt(attempt);
}

export async function abandon(attemptId) {
  await deleteAttempt(attemptId);
}

export async function submitAndStore(attempt, now, enteredAt) {
  const submitted = submitAttempt(attempt, now, enteredAt);
  await putAttempt(submitted);
  return submitted;
}
