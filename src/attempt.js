import { buildAttempt } from "./logic/paper.js";
import { submitAttempt } from "./logic/attempt-state.js";
import {
  deleteAttempt,
  findInProgress,
  getQuestion,
  getTest,
  putAttempt,
} from "./db.js";

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
    id: crypto.randomUUID(),
    test,
    questionsById,
    now,
  });
  await putAttempt(attempt);
  return { attempt, mode: "started" };
}

export async function persist(attempt) {
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
