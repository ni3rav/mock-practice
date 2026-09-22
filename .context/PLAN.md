# Astound Prep — plan

Status: approved
Last updated: 2026-09-22

This file is the source of truth across sessions. Read it before changing the product. When a decision changes, update this file before changing code. The chat is not the source of truth once this file exists.

Do not start building from this file alone. Build only when asked.

## Product

A local mock-test desk. You import a JSON bank, sit a named paper under one clock, move with a question palette, and review a frozen result. IndexedDB is the only storage.

One user, this browser only. No accounts and no server.

IndiaBix is out of this project permanently. Every question in the bank is one the user supplies. Do not scrape question banks.

## Locked decisions

- Question types are single-correct MCQ and numeric fill-in. No images. No multi-correct.
- The user sets one clock on the test. At zero the attempt auto-submits. The per-question clock only records time spent. It is not a limit.
- A palette lets you jump, skip, and mark for review. Mark is a flag on top of answered or blank. It does not change the score.
- Scoring is +1 correct, −0.25 wrong, 0 blank, for both question types. The total is shown to two decimals.
- A paper is a named list of questions plus a minute limit. Each attempt shuffles question order and MCQ choice order once at the start, then saves that order. A refresh does not reshuffle.
- Questions and papers enter only by JSON import. Edit them outside the app and re-import.
- Re-import upserts by id. The same id updates the question or test. Ids missing from the file stay in the bank.
- An attempt copies the stems, choices, key, and explanation at start. A later import cannot change an old score.
- Opening a test with an unfinished attempt resumes it. A clean start happens only after submit or abandon.
- A refresh resumes the same attempt. Remaining time is the duration minus wall-clock time since `startedAt`. Closing the tab does not submit.

## Defaults included with approval

- Papers are defined in the JSON. There is no screen for assembling a paper.
- Abandon deletes the unfinished attempt. It never appears in history. History is submitted attempts only.
- One unfinished attempt per test. Two different tests may each have their own unfinished attempt.
- Submit asks for confirmation and shows how many are blank and how many are marked. If the clock hits zero while that dialog is open, the attempt submits anyway.
- Clicking the selected MCQ choice again clears it back to blank. An empty numeric field is blank, so it scores 0, not −0.25.
- Numeric answers match as numbers. `200` and `200.0` match. `200.5` does not match `200`. Comparison uses an absolute epsilon of `1e-6` so binary float noise does not fail a short decimal. There is no per-question tolerance. Units, fractions, and exponent notation (`1e2`) do not match. A blank or whitespace-only field is unanswered.
- An MCQ has 2 to 5 choices. `answer` is a choice id, so shuffling choices cannot break the key.
- `topic` and `explanation` may be omitted. Review groups a topic breakdown when any question on the paper has a topic.
- Stems are plain text. There is no calculator, no in-app question editor, and no way to delete a submitted attempt.
- Two tabs open on the same attempt are unsupported. The last write wins.
- The Java/Maven notes in the project rules do not apply to this product. This is a static browser app.

## Import file

Both arrays are optional, and at least one must be present. A later file may add questions only, or papers only. The whole import runs in one transaction. Any validation error writes nothing.

```json
{
  "questions": [
    {
      "id": "pct-01",
      "type": "mcq",
      "topic": "percentages",
      "stem": "What is 20% of 50?",
      "choices": [
        { "id": "a", "text": "5" },
        { "id": "b", "text": "10" },
        { "id": "c", "text": "15" },
        { "id": "d", "text": "20" }
      ],
      "answer": "b",
      "explanation": "0.2 × 50 = 10"
    },
    {
      "id": "pct-02",
      "type": "numeric",
      "topic": "percentages",
      "stem": "A number increased by 10% becomes 220. The number is",
      "answer": 200
    }
  ],
  "tests": [
    {
      "id": "percentages-20",
      "title": "Percentages — 20",
      "minutes": 20,
      "questionIds": ["pct-01", "pct-02"]
    }
  ]
}
```

Validation:

- A paper is rejected when any `questionIds` entry is missing from the bank after this file is applied on top of what is already stored.
- Choice ids are unique within a question.
- Question ids and test ids are unique within the file.
- `minutes` is a positive integer.
- An MCQ `answer` must be one of that question’s choice ids.
- A numeric `answer` must be a finite number.
- `stem`, choice `text`, and `title` are non-empty strings.
- `id` values are non-empty strings.

## IndexedDB

Database name: `astound-prep`, version 1.

| Store | Key | Contents |
|---|---|---|
| `questions` | `id` | Bank record as imported, plus `updatedAt` |
| `tests` | `id` | `title`, `minutes`, `questionIds`, `updatedAt` |
| `attempts` | generated id | Snapshot, responses, shuffle order, timings, score |

`attempts` is indexed by `testId` and by `status` (`in_progress` or `submitted`).

An in-progress attempt stores:

- `startedAt` (epoch ms) and `durationMs`
- shuffled question order
- a snapshot of each question, with MCQ choices already in their shuffled order
- the active question
- per question: the response, `marked`, `visited`, and `timeSpentMs`

Time spent flushes when you leave a question, hide the tab, or submit. The visible per-question clock is stored time plus the current visit.

On submit, the score is computed from the snapshot only and stored: correct count, wrong count, blank count, score, and max. Max is one point per question. Review reads that stored result.

Score:

- correct: answered and matches the snapshotted key
- wrong: answered and does not match
- blank: not answered
- `score = correct * 1 + wrong * -0.25`
- MCQ match compares choice ids, not display position
- numeric match uses the epsilon rule above

Attempt ids come from `crypto.randomUUID()`. Shuffle is Fisher-Yates, persisted on the attempt.

## Screens

1. **Desk.** Import control. Papers listed as an exam schedule: title, question count, minutes, and Resume or Start. Below that, submitted attempts: paper title, date, score, open review. Empty desk: the import control, one sentence on the file shape, and a pointer to the sample file.
2. **Attempt.** The clock is the loud element. Then the stem, the choices or the numeric field, time spent on this question, mark, palette, and submit. Palette cells encode not-visited, visited-blank, answered, and a mark on top of any of those. Cell numbers are the paper sequence.
3. **Review.** Score, the three counts, topic breakdown when topics exist, then each question with your answer, the key, right/wrong/blank, time spent, and explanation.
4. **Confirm.** Submit and abandon each get a confirm step.

Keyboard, ignored while the numeric field is focused: `1`–`5` selects a choice, `m` toggles mark, left and right arrows move between questions.

The sample file is `sample/percentages.json`: a short original percentages set written for this project. Do not copy questions from IndiaBix or any other published bank.

## Visual brief

This is an examination desk. The characteristic object is a printed question paper under a wall clock. The home screen is a schedule of papers. On the attempt, the remaining time is the one memorable element. Everything around it stays quiet.

Tokens:

- Paper `#E4EEF2`
- Ink `#1C1915`
- Ruling `#9BB0BA`
- Stamp red `#8E2A2A` for a wrong mark and the expiring clock
- Correct mark `#1E5C40`
- Stem face: Newsreader
- UI face: Atkinson Hyperlegible
- The clock uses the UI face with tabular numbers

Quality floor: usable at phone width, visible keyboard focus, `prefers-reduced-motion` respected, contrast that stays readable for a long sitting.

At build time, write a short design pass against this brief before touching CSS. Revise any choice that reads as a generic template. The brief’s own words win, including these tokens, unless a later edit to this file changes them.

Avoid spending freedom on these default looks: warm cream with a terracotta accent, near-black with one acid accent, broadsheet hairline newspaper layout, identical rounded cards with a soft grey shadow, tracked-out all-caps eyebrows, and a monospace face for small labels.

## PWA

The app is an installable progressive web app. It still has no server and no accounts.

- `manifest.webmanifest` with `name` "Astound Prep", `short_name` "Prep", `display` `standalone`, `start_url` `./`, `scope` `./`, `background_color` and `theme_color` `#E4EEF2`.
- Icons at 192 and 512, plus a maskable icon. They use the paper and ink colors. The mark is a clock on a question sheet, because that is the signature of this desk.
- A service worker caches the app shell (HTML, CSS, JS modules, manifest, icons, vendored fonts) so a refresh works offline after the first load. IndexedDB is unchanged by the worker.
- Register the worker from the app. Cache name is versioned.
- Vendor Newsreader and Atkinson Hyperlegible as woff2 under `fonts/`. Both are SIL Open Font License. Do not load them from a CDN at runtime, or the offline clock and stems fall back to a generic face.
- `theme-color` matches the paper.

## Stack

Static files, no build step, no framework.

```
index.html
styles.css
manifest.webmanifest
sw.js
icons/
fonts/
src/logic/     pure functions
src/db.js      IndexedDB only
src/attempt.js persistence helpers over db + logic
src/main.js    wires screens
src/ui/
sample/percentages.json
package.json   { "type": "module" } so node:test can import the logic
.context/PLAN.md
```

Run with a local static server. ES modules do not load reliably from `file://`.

Pure functions cover import validation, numeric parsing, scoring, shuffle, remaining-time math, and attempt state transitions (answer, mark, move, flush time, submit). Test those with `node:test`. The browser check walks import, start, refresh-resume, palette, submit-on-expiry, review, upsert, abandon, and offline reload after the service worker installs.

## Build order

1. Pure logic and `node:test`
2. IndexedDB layer
3. Desk, attempt, and review screens, including the PWA shell
4. Sample file of original questions
5. Browser pass of the flows listed above

## Out of scope

- Scraping or copying third-party question banks
- Accounts, sync, or a backend
- Images, multi-correct, or a penalty other than 0.25
- In-app question editor
- Calculator
- Random topic drills
- Deleting bank rows by omitting them from a JSON file
- Deleting a submitted attempt
- Multiple users
- Multi-tab consistency

## Changelog

- 2026-09-22 — Plan approved and written down. No code yet.
- 2026-09-22 — PWA added: installable shell, offline cache, vendored faces. IndiaBix and the aptitude add-on stay out.
