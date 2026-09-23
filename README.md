# Mock Practice

A local app for timed mock tests. Questions, attempts, and reports stay in this browser. There is no account and no upload.

## What you need

- Node.js 20 or newer
- [Bun](https://bun.sh) 1.1 or newer, for the single program that opens the window
- Chromium or Chrome

Check them:

```bash
node -v
bun -v
```

## Run it

From this folder:

```bash
npm install
npm test
npm run binary
./mock-practice
```

`npm install` fetches the one build tool. `npm test` checks scoring, import rules, and the report. `npm run binary` writes `dist/` and compiles `./mock-practice`. That program opens a standalone window at `http://127.0.0.1:8765/`.

Close the window and the program stops. Open `./mock-practice` again and the same papers are still there. A second launch, while the first window is open, only opens another window.

The compiled program is not committed. Build it on each machine.

## Sit a paper

1. Choose **Load the sample paper**, or **Import a paper** and pick a JSON file you wrote.
2. Choose **Start**. The clock is the whole paper. At zero it submits.
3. Afterward, **Review** opens the mark sheet. **Export report** downloads JSON. **Save a copy** downloads HTML.
4. **Delete** on a paper removes that paper and discards an unfinished sitting. The questions stay. **Delete** on a report removes that result.

**Question file** shows the JSON shape and can copy it.

A question is `mcq` or `numeric`. An MCQ `answer` is a choice id. A numeric `answer` is a JSON number. `topic` is the section name on the report. A test lists `questionIds` and `minutes`.

## Open the built files without Bun

This uses a different browser storage than `./mock-practice`, so papers do not carry over.

```bash
npm install
npm run build
npm run open
```

`npm run open` rebuilds `dist/` and opens `dist/index.html` as a file. Modules in `src/` still need a static server if you skip the build. From this folder:

```bash
python3 -m http.server 8765
```

Then open `http://127.0.0.1:8765/`.
