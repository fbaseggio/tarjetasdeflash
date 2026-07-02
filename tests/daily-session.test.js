import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDailySessionPlan, getReviewRoundIds } from "../src/daily-session.js";

const vocabulary = JSON.parse(
  await readFile(new URL("../assets/vocabulary-test-v1.json", import.meta.url), "utf8"),
);
const assessed = ["foundation", "everyday", "expanding"]
  .flatMap((tier) => vocabulary.filter((entry) => entry.tier === tier).slice(0, 6));
const words = Object.fromEntries(assessed.map((entry, index) => [entry.id, {
  tier: entry.tier,
  directions: {
    "spanish-to-english": {
      correct: index % 4 !== 0,
      testedAt: `2026-07-01T12:${String(index).padStart(2, "0")}:00.000Z`,
    },
  },
  schedule: null,
}]));

const plan = createDailySessionPlan(
  vocabulary,
  { knownThrough: "everyday", learningFrontier: "expanding" },
  { words },
  "2026-07-02",
  () => 0.41,
);
assert.equal(plan.checkInIds.length, 10);
assert.equal(
  plan.checkInIds.filter((id) => vocabulary.find((entry) => entry.id === id).tier === "foundation").length,
  2,
);
assert.equal(plan.newWordIds.length, 15);
assert.equal(plan.reviewIds.length, 15);
assert.ok(plan.newWordIds.every((id) => vocabulary.find((entry) => entry.id === id).tier === "expanding"));
assert.equal(new Set([...plan.checkInIds, ...plan.newWordIds]).size, 25);
assert.equal(getReviewRoundIds(plan).length, 10);
plan.reviewCursor = 10;
assert.equal(getReviewRoundIds(plan).length, 5);

const backloggedWords = Object.fromEntries(vocabulary.slice(0, 61).map((entry) => [entry.id, {
  tier: entry.tier,
  directions: {},
  schedule: { dueDate: "2026-07-01" },
}]));
const backlogPlan = createDailySessionPlan(
  vocabulary,
  { knownThrough: "foundation", learningFrontier: "everyday" },
  { words: backloggedWords },
  "2026-07-02",
  () => 0.41,
);
assert.equal(backlogPlan.newWordIds.length, 0);
assert.ok(backlogPlan.reviewIds.length >= 51);

console.log("Three-stage daily plan, frontier selection, review rounds, and backlog throttling checks passed.");
