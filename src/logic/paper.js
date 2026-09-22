import { shuffle } from './shuffle.js';

function snapshotQuestion(question, random) {
  const snapshot = {
    id: question.id,
    type: question.type,
    stem: question.stem,
    answer: question.answer,
  };

  if (question.topic !== undefined) {
    snapshot.topic = question.topic;
  }
  if (question.explanation !== undefined) {
    snapshot.explanation = question.explanation;
  }
  if (question.choices !== undefined) {
    const shuffledChoices = shuffle(question.choices, random).map((choice) => ({
      id: choice.id,
      text: choice.text,
    }));
    snapshot.choices = shuffledChoices;
  }

  return snapshot;
}

export function buildAttempt({ id, test, questionsById, now, random = Math.random }) {
  for (const questionId of test.questionIds) {
    if (!Object.prototype.hasOwnProperty.call(questionsById, questionId)) {
      throw new Error(`Missing question: ${questionId}`);
    }
  }

  const questionOrder = shuffle(test.questionIds, random);
  const questions = questionOrder.map((questionId) =>
    snapshotQuestion(questionsById[questionId], random),
  );

  const responses = {};
  for (const questionId of questionOrder) {
    responses[questionId] = {
      marked: false,
      visited: questionId === questionOrder[0],
      timeSpentMs: 0,
    };
  }

  return {
    id,
    testId: test.id,
    testTitle: test.title,
    status: 'in_progress',
    startedAt: now,
    durationMs: test.minutes * 60 * 1000,
    questionOrder,
    questions,
    activeQuestionId: questionOrder[0],
    responses,
  };
}
