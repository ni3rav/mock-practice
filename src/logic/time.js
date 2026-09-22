export function remainingMs(startedAt, durationMs, now) {
  return durationMs - (now - startedAt);
}
