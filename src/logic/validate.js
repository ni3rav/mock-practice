function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function normalizeQuestion(raw) {
  const question = {
    id: raw.id,
    type: raw.type,
    stem: raw.stem,
    answer: raw.answer,
  };
  if (raw.topic !== undefined) {
    question.topic = raw.topic;
  }
  if (raw.explanation !== undefined) {
    question.explanation = raw.explanation;
  }
  if (raw.choices !== undefined) {
    question.choices = raw.choices.map((choice) => ({
      id: choice.id,
      text: choice.text,
    }));
  }
  return question;
}

function normalizeTest(raw) {
  return {
    id: raw.id,
    title: raw.title,
    minutes: raw.minutes,
    questionIds: [...raw.questionIds],
  };
}

function validateQuestion(raw, path, errors) {
  if (!isPlainObject(raw)) {
    errors.push(`${path} is not an object`);
    return;
  }

  if (!isNonEmptyString(raw.id)) {
    errors.push(`${path}.id is not a non-empty string`);
  }
  if (!isNonEmptyString(raw.stem)) {
    errors.push(`${path}.stem is not a non-empty string`);
  }
  if (raw.type !== 'mcq' && raw.type !== 'numeric') {
    errors.push(`${path}.type is not "mcq" or "numeric"`);
  }

  if (raw.topic !== undefined && !isNonEmptyString(raw.topic)) {
    errors.push(`${path}.topic is not a non-empty string`);
  }
  if (raw.explanation !== undefined && !isNonEmptyString(raw.explanation)) {
    errors.push(`${path}.explanation is not a non-empty string`);
  }

  if (raw.type === 'mcq') {
    if (!Array.isArray(raw.choices)) {
      errors.push(`${path}.choices is not an array`);
      return;
    }
    if (raw.choices.length < 2 || raw.choices.length > 5) {
      errors.push(`${path}.choices length is outside 2..5`);
    }

    const choiceIds = new Set();
    for (let i = 0; i < raw.choices.length; i += 1) {
      const choice = raw.choices[i];
      const choicePath = `${path}.choices[${i}]`;
      if (!isPlainObject(choice)) {
        errors.push(`${choicePath} is not an object`);
        continue;
      }
      if (!isNonEmptyString(choice.id)) {
        errors.push(`${choicePath}.id is not a non-empty string`);
      } else if (choiceIds.has(choice.id)) {
        errors.push(`${path}.choices has duplicate choice ids`);
      } else {
        choiceIds.add(choice.id);
      }
      if (!isNonEmptyString(choice.text)) {
        errors.push(`${choicePath}.text is not a non-empty string`);
      }
    }

    if (!isNonEmptyString(raw.answer)) {
      errors.push(`${path}.answer is not a non-empty string`);
    } else if (choiceIds.size > 0 && !choiceIds.has(raw.answer)) {
      errors.push(`${path}.answer is not one of the choice ids`);
    }
  }

  if (raw.type === 'numeric') {
    if (typeof raw.answer !== 'number' || !Number.isFinite(raw.answer)) {
      errors.push(`${path}.answer is not a finite number`);
    }
  }
}

function validateTest(raw, path, errors, fileQuestionIds, existingQuestionIds) {
  if (!isPlainObject(raw)) {
    errors.push(`${path} is not an object`);
    return;
  }

  if (!isNonEmptyString(raw.id)) {
    errors.push(`${path}.id is not a non-empty string`);
  }
  if (!isNonEmptyString(raw.title)) {
    errors.push(`${path}.title is not a non-empty string`);
  }
  if (!Number.isInteger(raw.minutes) || raw.minutes <= 0) {
    errors.push(`${path}.minutes is not a positive integer`);
  }

  if (!Array.isArray(raw.questionIds)) {
    errors.push(`${path}.questionIds is not an array`);
    return;
  }
  if (raw.questionIds.length === 0) {
    errors.push(`${path}.questionIds is empty`);
  }

  const seenIds = new Set();
  for (let i = 0; i < raw.questionIds.length; i += 1) {
    const questionId = raw.questionIds[i];
    const idPath = `${path}.questionIds[${i}]`;
    if (!isNonEmptyString(questionId)) {
      errors.push(`${idPath} is not a non-empty string`);
      continue;
    }
    if (seenIds.has(questionId)) {
      errors.push(`${path}.questionIds contains duplicates`);
    } else {
      seenIds.add(questionId);
    }
    if (!fileQuestionIds.has(questionId) && !existingQuestionIds.has(questionId)) {
      errors.push(`${idPath} is not in the bank`);
    }
  }
}

export function validateImport(data, existingQuestionIds) {
  const errors = [];

  if (!isPlainObject(data)) {
    return { ok: false, errors: ['data is not a plain object'] };
  }

  const hasQuestionsKey = Object.prototype.hasOwnProperty.call(data, 'questions');
  const hasTestsKey = Object.prototype.hasOwnProperty.call(data, 'tests');

  if (!hasQuestionsKey && !hasTestsKey) {
    return { ok: false, errors: ['neither questions nor tests is present'] };
  }

  const questionsRaw = hasQuestionsKey ? data.questions : [];
  const testsRaw = hasTestsKey ? data.tests : [];

  if (hasQuestionsKey && !Array.isArray(questionsRaw)) {
    errors.push('questions is not an array');
  }
  if (hasTestsKey && !Array.isArray(testsRaw)) {
    errors.push('tests is not an array');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const existingIds = new Set(existingQuestionIds);
  const fileQuestionIds = new Set();
  const seenQuestionIds = new Set();
  const seenTestIds = new Set();

  for (let i = 0; i < questionsRaw.length; i += 1) {
    const question = questionsRaw[i];
    const path = `questions[${i}]`;
    validateQuestion(question, path, errors);

    if (isPlainObject(question) && isNonEmptyString(question.id)) {
      if (seenQuestionIds.has(question.id)) {
        errors.push(`${path}.id is duplicated in the file`);
      } else {
        seenQuestionIds.add(question.id);
        fileQuestionIds.add(question.id);
      }
    }
  }

  for (let i = 0; i < testsRaw.length; i += 1) {
    const test = testsRaw[i];
    const path = `tests[${i}]`;

    if (isPlainObject(test) && isNonEmptyString(test.id)) {
      if (seenTestIds.has(test.id)) {
        errors.push(`${path}.id is duplicated in the file`);
      } else {
        seenTestIds.add(test.id);
      }
    }

    validateTest(test, path, errors, fileQuestionIds, existingIds);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    questions: questionsRaw.map(normalizeQuestion),
    tests: testsRaw.map(normalizeTest),
  };
}
