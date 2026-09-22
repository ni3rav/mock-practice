const NUMERIC_PATTERN = /^[+-]?\d+(\.\d+)?$/;

export function parseNumericAnswer(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!NUMERIC_PATTERN.test(trimmed)) {
    return null;
  }
  return Number(trimmed);
}

export function numericEqual(left, right) {
  return Math.abs(left - right) <= 1e-6;
}
