import { numericEqual, parseNumericAnswer } from './numeric.js';

function isBlankResponse(question, response) {
  if (!response) {
    return true;
  }
  if (question.type === 'mcq') {
    return !response.choiceId || response.choiceId.length === 0;
  }
  return parseNumericAnswer(response.numericText ?? '') === null;
}

function isCorrectResponse(question, response) {
  if (question.type === 'mcq') {
    return response.choiceId === question.answer;
  }
  const parsed = parseNumericAnswer(response.numericText ?? '');
  return parsed !== null && numericEqual(parsed, question.answer);
}

export function gradeQuestion(question, response) {
  if (isBlankResponse(question, response)) {
    return "blank";
  }
  if (isCorrectResponse(question, response)) {
    return "correct";
  }
  return "wrong";
}

export function scorePaper(questions, responses) {
  let correct = 0;
  let wrong = 0;
  let blank = 0;

  for (const question of questions) {
    const verdict = gradeQuestion(question, responses[question.id]);
    if (verdict === "blank") {
      blank += 1;
    } else if (verdict === "correct") {
      correct += 1;
    } else {
      wrong += 1;
    }
  }

  const max = questions.length;
  const score = correct - wrong * 0.25;

  return { correct, wrong, blank, score, max };
}
