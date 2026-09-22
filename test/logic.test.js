import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  countOpen,
  flushTime,
  setActive,
  setNumericText,
  submitAttempt,
  toggleChoice,
  toggleMark,
} from '../src/logic/attempt-state.js';
import { numericEqual, parseNumericAnswer } from '../src/logic/numeric.js';
import { buildAttempt } from '../src/logic/paper.js';
import { scorePaper } from '../src/logic/score.js';
import { shuffle } from '../src/logic/shuffle.js';
import { remainingMs } from '../src/logic/time.js';
import { validateImport } from '../src/logic/validate.js';

describe('parseNumericAnswer', () => {
  it('accepts plain integers and decimals', () => {
    assert.equal(parseNumericAnswer('200'), 200);
    assert.equal(parseNumericAnswer('200.0'), 200);
    assert.equal(parseNumericAnswer('  200.5  '), 200.5);
  });

  it('rejects empty, exponent, fraction, units, and trailing dot', () => {
    assert.equal(parseNumericAnswer(''), null);
    assert.equal(parseNumericAnswer('   '), null);
    assert.equal(parseNumericAnswer('1e2'), null);
    assert.equal(parseNumericAnswer('1/2'), null);
    assert.equal(parseNumericAnswer('200 meters'), null);
    assert.equal(parseNumericAnswer('200.'), null);
  });

  it('rejects non-strings', () => {
    assert.equal(parseNumericAnswer(200), null);
    assert.equal(parseNumericAnswer(null), null);
  });
});

describe('numericEqual', () => {
  it('matches equal values within epsilon', () => {
    assert.equal(numericEqual(200, 200), true);
    assert.equal(numericEqual(0.3, 0.1 + 0.2), true);
  });

  it('does not match different values', () => {
    assert.equal(numericEqual(200, 200.5), false);
  });
});

describe('scorePaper', () => {
  const questions = [
    { id: 'q1', type: 'mcq', stem: 'A', answer: 'a' },
    { id: 'q2', type: 'mcq', stem: 'B', answer: 'b' },
    { id: 'q3', type: 'numeric', stem: 'C', answer: 10 },
    { id: 'q4', type: 'numeric', stem: 'D', answer: 5 },
  ];

  it('scores correct, wrong, and blank', () => {
    const result = scorePaper(questions, {
      q1: { choiceId: 'a' },
      q2: { choiceId: 'c' },
      q3: { numericText: '10' },
      q4: { numericText: '' },
    });

    assert.deepEqual(result, {
      correct: 2,
      wrong: 1,
      blank: 1,
      score: 1.75,
      max: 4,
    });
  });

  it('treats missing responses as blank', () => {
    const result = scorePaper([questions[0]], {});
    assert.deepEqual(result, {
      correct: 0,
      wrong: 0,
      blank: 1,
      score: 0,
      max: 1,
    });
  });
});

describe('shuffle', () => {
  it('preserves contents without mutating the input', () => {
    const items = ['a', 'b', 'c', 'd'];
    const copy = [...items];
    const random = () => 0;
    const shuffled = shuffle(items, random);

    assert.notEqual(shuffled, items);
    assert.deepEqual(items, copy);
    assert.deepEqual([...shuffled].sort(), copy.sort());
  });
});

describe('remainingMs', () => {
  it('returns remaining duration', () => {
    assert.equal(remainingMs(1000, 60000, 16000), 45000);
  });
});

describe('validateImport', () => {
  it('rejects non-objects and missing keys', () => {
    assert.deepEqual(validateImport(null, []), {
      ok: false,
      errors: ['data is not a plain object'],
    });
    assert.deepEqual(validateImport([], []), {
      ok: false,
      errors: ['data is not a plain object'],
    });
    assert.deepEqual(validateImport({}, []), {
      ok: false,
      errors: ['neither questions nor tests is present'],
    });
  });

  it('rejects invalid arrays and field values', () => {
    const badMcq = validateImport(
      {
        questions: [
          {
            id: 'q1',
            type: 'mcq',
            stem: 'Pick one',
            choices: [{ id: 'a', text: 'Only' }],
            answer: 'b',
          },
        ],
      },
      [],
    );
    assert.equal(badMcq.ok, false);
    assert.ok(badMcq.errors.some((error) => error.includes('choices length')));
    assert.ok(badMcq.errors.some((error) => error.includes('answer is not one of the choice ids')));

    const badNumeric = validateImport(
      {
        questions: [
          {
            id: 'n1',
            type: 'numeric',
            stem: 'Value',
            answer: '200',
          },
        ],
      },
      [],
    );
    assert.equal(badNumeric.ok, false);
    assert.ok(badNumeric.errors.some((error) => error.includes('answer is not a finite number')));
  });

  it('accepts upsert when test references an existing question id', () => {
    const result = validateImport(
      {
        tests: [
          {
            id: 'paper-1',
            title: 'Mixed paper',
            minutes: 15,
            questionIds: ['kept-1', 'new-1'],
          },
        ],
        questions: [
          {
            id: 'new-1',
            type: 'numeric',
            stem: 'What is 10% of 50?',
            answer: 5,
          },
        ],
      },
      ['kept-1'],
    );

    assert.equal(result.ok, true);
    assert.equal(result.questions.length, 1);
    assert.deepEqual(result.tests[0].questionIds, ['kept-1', 'new-1']);
  });

  it('rejects missing bank references', () => {
    const result = validateImport(
      {
        tests: [
          {
            id: 'paper-1',
            title: 'Broken paper',
            minutes: 10,
            questionIds: ['missing-1'],
          },
        ],
      },
      [],
    );

    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes('is not in the bank')));
  });
});

describe('buildAttempt and attempt state', () => {
  const test = {
    id: 't1',
    title: 'Sample',
    minutes: 10,
    questionIds: ['mcq-1', 'num-1'],
  };

  const questionsById = {
    'mcq-1': {
      id: 'mcq-1',
      type: 'mcq',
      stem: 'Pick',
      choices: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ],
      answer: 'a',
    },
    'num-1': {
      id: 'num-1',
      type: 'numeric',
      stem: 'Enter',
      answer: 42,
    },
  };

  it('snapshots questions independently from the bank', () => {
    let random = 0;
    const attempt = buildAttempt({
      id: 'a1',
      test,
      questionsById,
      now: 1000,
      random: () => random++ / 10,
    });

    const snapshot = attempt.questions.find((question) => question.id === 'mcq-1');
    questionsById['mcq-1'].stem = 'Changed';
    questionsById['mcq-1'].choices[0].text = 'Changed';

    assert.equal(snapshot.stem, 'Pick');
    assert.notEqual(snapshot.choices[0].text, 'Changed');
  });

  it('toggles MCQ choice off and accumulates time on navigation', () => {
    let attempt = buildAttempt({
      id: 'a1',
      test,
      questionsById,
      now: 1000,
      random: () => 0,
    });

    attempt = toggleChoice(attempt, 'mcq-1', 'a');
    assert.equal(attempt.responses['mcq-1'].choiceId, 'a');

    attempt = toggleChoice(attempt, 'mcq-1', 'a');
    assert.equal(attempt.responses['mcq-1'].choiceId, undefined);

    let enteredAt = 1000;
    ({ attempt, enteredAt } = setActive(attempt, 'mcq-1', 5000, enteredAt));
    assert.equal(attempt.responses['num-1'].timeSpentMs, 4000);
    assert.equal(attempt.responses['mcq-1'].visited, true);
    assert.equal(enteredAt, 5000);
  });

  it('submits idempotently with score', () => {
    let attempt = buildAttempt({
      id: 'a1',
      test,
      questionsById,
      now: 1000,
      random: () => 0,
    });

    attempt = toggleChoice(attempt, 'mcq-1', 'a');
    attempt = setNumericText(attempt, 'num-1', '42');
    attempt = submitAttempt(attempt, 9000, 8000);

    assert.equal(attempt.status, 'submitted');
    assert.equal(attempt.submittedAt, 9000);
    assert.deepEqual(attempt.score, {
      correct: 2,
      wrong: 0,
      blank: 0,
      score: 2,
      max: 2,
    });

    const resubmitted = submitAttempt(attempt, 10000, 9500);
    assert.equal(resubmitted, attempt);
  });

  it('counts blank and marked responses', () => {
    let attempt = buildAttempt({
      id: 'a1',
      test,
      questionsById,
      now: 1000,
      random: () => 0,
    });

    attempt = toggleChoice(attempt, 'mcq-1', 'a');
    attempt = toggleMark(attempt, 'num-1');

    assert.deepEqual(countOpen(attempt), { blank: 1, marked: 1 });
  });

  it('leaves attempt unchanged when flushTime has no enteredAt', () => {
    const attempt = buildAttempt({
      id: 'a1',
      test,
      questionsById,
      now: 1000,
      random: () => 0,
    });

    const flushed = flushTime(attempt, attempt.activeQuestionId, 5000, null);
    assert.equal(flushed, attempt);
  });
});

describe('sample percentages.json', () => {
  it('validates against an empty bank', () => {
    const data = JSON.parse(
      readFileSync(new URL('../sample/percentages.json', import.meta.url), 'utf8'),
    );
    const result = validateImport(data, []);
    assert.equal(result.ok, true);
    assert.equal(result.questions.length, 8);
    assert.equal(result.tests.length, 1);
  });
});
