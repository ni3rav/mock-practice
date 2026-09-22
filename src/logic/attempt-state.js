import { parseNumericAnswer } from './numeric.js';
import { scorePaper } from './score.js';

function cloneAttempt(attempt) {
  return {
    ...attempt,
    questionOrder: [...attempt.questionOrder],
    questions: attempt.questions.map((question) => {
      const copy = {
        id: question.id,
        type: question.type,
        stem: question.stem,
        answer: question.answer,
      };
      if (question.topic !== undefined) {
        copy.topic = question.topic;
      }
      if (question.explanation !== undefined) {
        copy.explanation = question.explanation;
      }
      if (question.choices !== undefined) {
        copy.choices = question.choices.map((choice) => ({
          id: choice.id,
          text: choice.text,
        }));
      }
      return copy;
    }),
    responses: Object.fromEntries(
      Object.entries(attempt.responses).map(([questionId, response]) => [
        questionId,
        { ...response },
      ]),
    ),
  };
}

function questionById(attempt) {
  return Object.fromEntries(attempt.questions.map((question) => [question.id, question]));
}

function isBlankForCount(question, response) {
  if (question.type === 'mcq') {
    return !response.choiceId || response.choiceId.length === 0;
  }
  return parseNumericAnswer(response.numericText ?? '') === null;
}

function responsesForScoring(attempt) {
  const scored = {};
  for (const [questionId, response] of Object.entries(attempt.responses)) {
    const entry = {};
    if (response.choiceId !== undefined) {
      entry.choiceId = response.choiceId;
    }
    if (response.numericText !== undefined) {
      entry.numericText = response.numericText;
    }
    scored[questionId] = entry;
  }
  return scored;
}

export function flushTime(attempt, questionId, now, enteredAt) {
  if (enteredAt == null) {
    return attempt;
  }

  const next = cloneAttempt(attempt);
  const response = next.responses[questionId];
  if (!response) {
    return next;
  }

  response.timeSpentMs += Math.max(0, now - enteredAt);
  return next;
}

export function setActive(attempt, questionId, now, enteredAt) {
  if (!attempt.responses[questionId]) {
    return { attempt, enteredAt };
  }

  let next = flushTime(attempt, attempt.activeQuestionId, now, enteredAt);
  next = cloneAttempt(next);
  next.activeQuestionId = questionId;
  next.responses[questionId] = {
    ...next.responses[questionId],
    visited: true,
  };

  return { attempt: next, enteredAt: now };
}

export function toggleChoice(attempt, questionId, choiceId) {
  const question = questionById(attempt)[questionId];
  if (!question || question.type !== 'mcq') {
    return attempt;
  }

  const next = cloneAttempt(attempt);
  const response = next.responses[questionId];
  if (response.choiceId === choiceId) {
    const { choiceId: _removed, ...rest } = response;
    next.responses[questionId] = rest;
  } else {
    next.responses[questionId] = { ...response, choiceId };
  }

  return next;
}

export function setNumericText(attempt, questionId, text) {
  const question = questionById(attempt)[questionId];
  if (!question || question.type !== 'numeric') {
    return attempt;
  }

  const next = cloneAttempt(attempt);
  next.responses[questionId] = {
    ...next.responses[questionId],
    numericText: text,
  };
  return next;
}

export function toggleMark(attempt, questionId) {
  if (!attempt.responses[questionId]) {
    return attempt;
  }

  const next = cloneAttempt(attempt);
  next.responses[questionId] = {
    ...next.responses[questionId],
    marked: !next.responses[questionId].marked,
  };
  return next;
}

export function submitAttempt(attempt, now, enteredAt) {
  if (attempt.status === 'submitted') {
    return attempt;
  }

  let next = flushTime(attempt, attempt.activeQuestionId, now, enteredAt);
  next = cloneAttempt(next);
  next.status = 'submitted';
  next.submittedAt = now;
  next.score = scorePaper(next.questions, responsesForScoring(next));
  return next;
}

export function countOpen(attempt) {
  const questions = questionById(attempt);
  let blank = 0;
  let marked = 0;

  for (const [questionId, response] of Object.entries(attempt.responses)) {
    const question = questions[questionId];
    if (question && isBlankForCount(question, response)) {
      blank += 1;
    }
    if (response.marked) {
      marked += 1;
    }
  }

  return { blank, marked };
}
