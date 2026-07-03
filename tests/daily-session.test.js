import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDailySessionPlan, getReviewRoundIds } from "../src/daily-session.js";

const vocabulary = JSON.parse(
  await readFile(new URL("../assets/vocabulary-test-v1.json", import.meta.url), "utf8"),
);
const foundation = vocabulary.filter((entry) => entry.tier === "foundation");
const everyday = vocabulary.filter((entry) => entry.tier === "everyday");
const expanding = vocabulary.filter((entry) => entry.tier === "expanding");
const dueFrontier = expanding.slice(0, 8);
const words = Object.fromEntries(dueFrontier.map((entry, index) => [entry.id, {
  tier: entry.tier,
  masteryTrack: "frontier",
  masteryStatus: "learning",
  lastFirstAttemptDate: "2026-07-01",
  directions: {
    "spanish-to-english": {
      correct: index % 4 !== 0,
      testedAt: `2026-07-01T12:${String(index).padStart(2, "0")}:00.000Z`,
    },
  },
  schedule: { intervalDays: 3, dueDate: "2026-07-02" },
}]));

const plan = createDailySessionPlan(
  vocabulary,
  { knownThrough: "everyday", learningFrontier: "expanding" },
  { words },
  "2026-07-02",
  () => 0.41,
);
assert.equal(plan.checkInIds.length, 10);
assert.equal(plan.checkInIds.filter((id) => foundation.some((entry) => entry.id === id)).length, 1);
assert.equal(plan.checkInIds.filter((id) => everyday.some((entry) => entry.id === id)).length, 1);
assert.equal(plan.checkInIds.filter((id) => dueFrontier.some((entry) => entry.id === id)).length, 8);
assert.equal(plan.newWordIds.length, 15);
assert.equal(plan.reviewIds.length, 15);
assert.ok(plan.newWordIds.every((id) => expanding.some((entry) => entry.id === id)));
assert.equal(new Set([...plan.checkInIds, ...plan.newWordIds]).size, 25);
assert.equal(getReviewRoundIds(plan).length, 10);
plan.reviewCursor = 10;
assert.equal(getReviewRoundIds(plan).length, 5);

const askedToday = Object.fromEntries(dueFrontier.map((entry) => [entry.id, {
  ...words[entry.id],
  lastFirstAttemptDate: "2026-07-02",
  retiredDate: "2026-07-02",
}]));
const secondSameDayPlan = createDailySessionPlan(
  vocabulary,
  { knownThrough: "everyday", learningFrontier: "expanding" },
  { words: askedToday },
  "2026-07-02",
  () => 0.41,
);
assert.ok(secondSameDayPlan.checkInIds.every((id) => !dueFrontier.some((entry) => entry.id === id)));
assert.ok(secondSameDayPlan.reviewIds.every((id) => !dueFrontier.some((entry) => entry.id === id)));

const missedAudit = foundation[0];
const repairPlan = createDailySessionPlan(
  vocabulary,
  { knownThrough: "everyday", learningFrontier: "expanding" },
  { words: {
    [missedAudit.id]: {
      tier: "foundation",
      masteryTrack: "repair",
      masteryStatus: "repair",
      lastFirstAttemptDate: "2026-07-02",
      lastFirstAttemptCorrect: false,
      repairDueDate: "2026-07-02",
      retiredDate: null,
      directions: { "spanish-to-english": { correct: false, testedAt: "2026-07-02T10:00:00Z" } },
      schedule: { intervalDays: 1, dueDate: "2026-07-03" },
    },
  } },
  "2026-07-02",
  () => 0.41,
);
assert.ok(!repairPlan.checkInIds.includes(missedAudit.id));
assert.ok(repairPlan.reviewIds.includes(missedAudit.id));

const backlogEntries = everyday.slice(0, 61);
const backloggedWords = Object.fromEntries(backlogEntries.map((entry) => [entry.id, {
  tier: entry.tier,
  masteryTrack: "frontier",
  masteryStatus: "learning",
  lastFirstAttemptDate: "2026-07-01",
  directions: {},
  schedule: { intervalDays: 1, dueDate: "2026-07-01" },
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

console.log("Due-only check-in, tiered audits, same-day retirement, repair, and backlog checks passed.");
