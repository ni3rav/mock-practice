import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitCodeText } from "../src/logic/code-text.js";
import { buildReport, filterReportQuestions, reportFilename, reportHtml } from "../src/logic/report.js";
import { scorePaper } from "../src/logic/score.js";

function attempt() {
  const questions = [
    {
      id: "q1",
      type: "mcq",
      topic: "percentages",
      stem: "What is 15% of 240?",
      choices: [
        { id: "a", text: "30" },
        { id: "b", text: "36" },
      ],
      answer: "b",
      explanation: "0.15 × 240 = 36.",
    },
    {
      id: "q2",
      type: "numeric",
      topic: "ratios",
      stem: "A shirt priced at 800 is sold at a 25% discount. The selling price is",
      answer: 600,
    },
    {
      id: "q3",
      type: "mcq",
      stem: "Untagged stem",
      choices: [
        { id: "a", text: "Yes" },
        { id: "b", text: "No" },
      ],
      answer: "a",
    },
  ];
  const responses = {
    q1: { choiceId: "a", timeSpentMs: 12000 },
    q2: { numericText: "", timeSpentMs: 5000 },
    q3: { choiceId: "a", timeSpentMs: 3000 },
  };
  return {
    testTitle: "Percentages — 10",
    submittedAt: Date.parse("2026-09-22T16:30:00.000Z"),
    durationMs: 10 * 60 * 1000,
    questionOrder: ["q1", "q2", "q3"],
    questions,
    responses,
    score: scorePaper(questions, responses),
  };
}

describe("buildReport", () => {
  it("splits sections and lists wrong and blank answers", () => {
    const report = buildReport(attempt());

    assert.deepEqual(
      report.sections.map((section) => section.topic),
      ["percentages", "ratios", "No topic"]
    );
    assert.equal(report.wrong.length, 1);
    assert.equal(report.wrong[0].number, 1);
    assert.equal(report.wrong[0].yourAnswer, "30");
    assert.equal(report.wrong[0].key, "36");
    assert.equal(report.blank.length, 1);
    assert.equal(report.blank[0].number, 2);
    assert.equal(report.questions[2].verdict, "correct");

    const sectionScore = report.sections.reduce((sum, section) => sum + section.score, 0);
    assert.equal(sectionScore, report.score.score);
    assert.equal(report.timeSpentMs, 20000);
  });

  it("names the export from the paper title and the day it was submitted", () => {
    const report = buildReport(attempt());
    assert.equal(reportFilename(report, "json"), "percentages-10-2026-09-22.json");
  });

  it("keeps line breaks and angle brackets in the saved copy", () => {
    const paper = attempt();
    paper.questions[0].stem = "if (i < n) {\n  return i;\n}";
    paper.questions[0].explanation = "stop while i < n";
    const html = reportHtml(buildReport(paper));
    assert.match(html, /if \(i &lt; n\) \{\n {2}return i;/);
    assert.match(html, /class="code"/);
  });

  it("includes the wrong stem in the saved copy", () => {
    const html = reportHtml(buildReport(attempt()));
    assert.match(html, /What is 15% of 240\?/);
    assert.match(html, /Wrong answers/);
    assert.match(html, /-0\.25/);
  });

  it("keeps the sentence out of a code block that follows a blank line", () => {
    const paper = attempt();
    paper.questions[0].stem = "How many rows?\n\nSELECT id\nFROM books;";
    paper.questions[0].choices[0].text = "SELECT id\nFROM books";
    const html = reportHtml(buildReport(paper));
    assert.match(html, /<p>How many rows\?<\/p><p class="code">SELECT id/);
    const split = splitCodeText(paper.questions[0].stem);
    assert.equal(split.prose, "How many rows?");
    assert.match(split.code, /^SELECT id/);
  });
});

describe("filterReportQuestions", () => {
  it("narrows by section and result together", () => {
    const report = buildReport(attempt());
    assert.equal(filterReportQuestions(report.questions, { topic: "ratios", verdict: "blank" }).length, 1);
    assert.equal(filterReportQuestions(report.questions, { topic: "ratios", verdict: "wrong" }).length, 0);
    assert.equal(filterReportQuestions(report.questions, { verdict: "correct" })[0].topic, "No topic");
    assert.equal(filterReportQuestions(report.questions).length, 3);
  });
});
