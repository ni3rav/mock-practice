import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildReport, reportFilename, reportHtml } from "../src/logic/report.js";
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

  it("includes the wrong stem in the saved copy", () => {
    const html = reportHtml(buildReport(attempt()));
    assert.match(html, /What is 15% of 240\?/);
    assert.match(html, /Wrong answers/);
    assert.match(html, /-0\.25/);
  });
});
