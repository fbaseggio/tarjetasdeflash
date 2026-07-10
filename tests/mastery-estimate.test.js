import assert from "node:assert/strict";
import {
  buildMasteryStats,
  demonstratedWordCredit,
  estimatedLevelFromProjectedPercent,
  placementFrontierFromScore,
} from "../src/mastery-estimate.js";

const vocabulary = [
  { id: "f1", tier: "foundation" },
  { id: "f2", tier: "foundation" },
  { id: "e1", tier: "everyday" },
  { id: "x1", tier: "expanding1" },
  { id: "x2", tier: "expanding2" },
];

assert.equal(demonstratedWordCredit({ presentations: 1, directions: {} }), 0.1);
assert.equal(demonstratedWordCredit({
  directions: { "spanish-to-english": { correct: false, testedAt: "2026-07-01T10:00:00Z" } },
  schedule: { intervalDays: 3 },
}), 0);
assert.equal(demonstratedWordCredit({
  directions: { "spanish-to-english": { correct: true, testedAt: "2026-07-01T10:00:00Z" } },
  schedule: { intervalDays: 30 },
}), 1);

const stats = buildMasteryStats(vocabulary, {
  words: {
    f1: {
      lastFirstAttemptDate: "2026-07-10",
      directions: { "spanish-to-english": { correct: true, testedAt: "2026-07-10T10:00:00Z" } },
      schedule: { intervalDays: 30 },
    },
    f2: {
      lastFirstAttemptDate: "2026-07-09",
      directions: { "spanish-to-english": { correct: true, testedAt: "2026-07-09T10:00:00Z" } },
      schedule: { intervalDays: 3 },
    },
    e1: {
      lastFirstAttemptDate: "2026-07-10",
      directions: { "english-to-spanish": { correct: false, testedAt: "2026-07-10T10:05:00Z" } },
      schedule: { intervalDays: 1 },
    },
    x1: { presentations: 1, directions: {}, schedule: { intervalDays: 0 } },
  },
}, "2026-07-10");

assert.equal(stats.total, 5);
assert.equal(stats.demonstrated, 2);
assert.equal(stats.demonstratedToday, 1);
assert.ok(stats.projectedPercent >= 0);
assert.ok(stats.projectedPercent <= 100);
assert.equal(stats.estimatedLevel, estimatedLevelFromProjectedPercent(stats.projectedPercent));
assert.ok(stats.estimatedLevelLabel);
assert.ok(stats.placementScore >= 1);
assert.ok(stats.placementScore <= 4);
assert.equal(stats.placementFrontier, placementFrontierFromScore(stats.placementScore));
assert.ok(stats.placementFrontierLabel);
assert.equal(stats.tiers.length, 4);
assert.deepEqual(stats.tiers.map((tier) => tier.tier), [
  "foundation",
  "everyday",
  "expanding1",
  "expanding2",
]);

const strongFoundation = buildMasteryStats(
  Array.from({ length: 34 }, (_, index) => ({
    id: `f${index}`,
    tier: index < 30 ? "foundation" : ["everyday", "expanding1", "expanding2", "expanding2"][index - 30],
  })),
  {
    words: Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`f${index}`, {
      directions: { "spanish-to-english": { correct: true, testedAt: `2026-07-01T10:${String(index).padStart(2, "0")}:00Z` } },
      schedule: { intervalDays: 30 },
    }])),
  },
);
assert.ok(strongFoundation.tiers[0].projectedRate > 0.9);
assert.ok(strongFoundation.projectedPercent > 60);

assert.equal(estimatedLevelFromProjectedPercent(0), "foundation");
assert.equal(estimatedLevelFromProjectedPercent(24), "foundation");
assert.equal(estimatedLevelFromProjectedPercent(25), "everyday");
assert.equal(estimatedLevelFromProjectedPercent(49), "everyday");
assert.equal(estimatedLevelFromProjectedPercent(50), "expanding1");
assert.equal(estimatedLevelFromProjectedPercent(69), "expanding1");
assert.equal(estimatedLevelFromProjectedPercent(70), "expanding2");
assert.equal(placementFrontierFromScore(1.4), "foundation");
assert.equal(placementFrontierFromScore(1.5), "everyday");
assert.equal(placementFrontierFromScore(2.5), "expanding1");
assert.equal(placementFrontierFromScore(3.5), "expanding2");

console.log("Estimated and demonstrated mastery checks passed.");
