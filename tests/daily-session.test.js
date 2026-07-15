import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  adaptiveNewWordCount,
  createDailySessionPlan,
  getReviewRoundIds,
  lowerTierHealth,
  NEW_WORD_STYLES,
  newWordSelectionWeight,
} from "../src/daily-session.js";

const vocabulary = JSON.parse(
  await readFile(new URL("../assets/vocabulary-official-v1.json", import.meta.url), "utf8"),
);
const foundation = vocabulary.filter((entry) => entry.tier === "foundation");
const everyday = vocabulary.filter((entry) => entry.tier === "everyday");
const expanding = vocabulary.filter((entry) => entry.tier === "expanding1");
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
  { knownThrough: "everyday", learningFrontier: "expanding1" },
  { words },
  "2026-07-02",
  () => 0.41,
);
assert.equal(plan.checkInIds.length, 10);
assert.equal(plan.checkInIds.filter((id) => foundation.some((entry) => entry.id === id)).length, 1);
assert.equal(plan.checkInIds.filter((id) => everyday.some((entry) => entry.id === id)).length, 1);
assert.equal(plan.checkInIds.filter((id) => dueFrontier.some((entry) => entry.id === id)).length, 8);
assert.equal(plan.newWordIds.length, 14);
assert.equal(plan.reviewIds.length, 14);
assert.ok(plan.newWordIds.every((id) => expanding.some((entry) => entry.id === id)));
assert.equal(new Set([...plan.checkInIds, ...plan.newWordIds]).size, 24);
assert.equal(getReviewRoundIds(plan).length, 10);
plan.reviewCursor = 10;
assert.equal(getReviewRoundIds(plan).length, 4);

const askedToday = Object.fromEntries(dueFrontier.map((entry) => [entry.id, {
  ...words[entry.id],
  lastFirstAttemptDate: "2026-07-02",
  retiredDate: "2026-07-02",
}]));
const secondSameDayPlan = createDailySessionPlan(
  vocabulary,
  { knownThrough: "everyday", learningFrontier: "expanding1" },
  { words: askedToday },
  "2026-07-02",
  () => 0.41,
);
assert.ok(secondSameDayPlan.checkInIds.every((id) => !dueFrontier.some((entry) => entry.id === id)));
assert.ok(secondSameDayPlan.reviewIds.every((id) => !dueFrontier.some((entry) => entry.id === id)));

const missedAudit = foundation[0];
const repairPlan = createDailySessionPlan(
  vocabulary,
  { knownThrough: "everyday", learningFrontier: "expanding1" },
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
assert.equal(backlogPlan.newWordIds.length, 8);
assert.ok(backlogPlan.reviewIds.length >= 51);

const remainingFoundation = foundation.slice(0, 4);
const completedFoundationWords = Object.fromEntries(foundation.slice(4).map((entry) => [entry.id, {
  tier: entry.tier,
  masteryTrack: "frontier",
  masteryStatus: "learning",
  lastFirstAttemptDate: "2026-07-01",
  directions: {
    "spanish-to-english": {
      correct: true,
      testedAt: "2026-07-01T12:00:00.000Z",
    },
  },
  schedule: { intervalDays: 30, dueDate: "2099-01-01" },
}]));
const nearlyFinishedFoundationPlan = createDailySessionPlan(
  vocabulary,
  { knownThrough: null, learningFrontier: "foundation" },
  { words: completedFoundationWords },
  "2026-07-02",
  () => 0.41,
);
assert.equal(nearlyFinishedFoundationPlan.newWordIds.length, 15);
assert.equal(nearlyFinishedFoundationPlan.newWordIds.filter((id) => (
  remainingFoundation.some((entry) => entry.id === id)
)).length, 4);
assert.equal(nearlyFinishedFoundationPlan.newWordIds.filter((id) => (
  everyday.some((entry) => entry.id === id)
)).length, 11);

const expanding2 = vocabulary.filter((entry) => entry.tier === "expanding2");
const exp2Plan = createDailySessionPlan(
  vocabulary,
  { knownThrough: "expanding1", learningFrontier: "expanding2" },
  { words: {} },
  "2026-07-02",
  () => 0.41,
);
assert.equal(exp2Plan.checkInIds.length, 10);
assert.ok(exp2Plan.checkInIds.filter((id) => foundation.some((entry) => entry.id === id)).length >= 1);
assert.ok(exp2Plan.checkInIds.filter((id) => everyday.some((entry) => entry.id === id)).length >= 1);
assert.ok(exp2Plan.checkInIds.filter((id) => expanding.some((entry) => entry.id === id)).length >= 1);
assert.ok(exp2Plan.newWordIds.every((id) => expanding2.some((entry) => entry.id === id)));

const exp2OddDayPlan = createDailySessionPlan(
  vocabulary,
  { knownThrough: "expanding1", learningFrontier: "expanding2" },
  { words: {} },
  "2026-07-03",
  () => 0.41,
);
assert.equal(exp2OddDayPlan.checkInIds.filter((id) => foundation.some((entry) => entry.id === id)).length, 0);
assert.equal(exp2OddDayPlan.checkInIds.length, 10);

const weakFoundationEntries = foundation.slice(0, 4);
const weakFoundationWords = Object.fromEntries(weakFoundationEntries.map((entry, index) => [entry.id, {
  tier: "foundation",
  masteryTrack: "audit",
  masteryStatus: "presumed-mastered",
  lastFirstAttemptDate: "2026-07-01",
  directions: {
    "spanish-to-english": {
      correct: index > 1,
      testedAt: `2026-07-01T12:${String(index).padStart(2, "0")}:00.000Z`,
    },
  },
  schedule: { intervalDays: 60, dueDate: "2026-07-02" },
}]));
const health = lowerTierHealth(vocabulary, weakFoundationWords, "foundation");
assert.equal(health.earlyWarning, true);
assert.equal(health.weak, true);
const weakFoundationPlan = createDailySessionPlan(
  vocabulary,
  { knownThrough: "expanding1", learningFrontier: "expanding2" },
  { words: weakFoundationWords },
  "2026-07-03",
  () => 0.41,
);
assert.ok(weakFoundationPlan.checkInIds.filter((id) => foundation.some((entry) => entry.id === id)).length >= 2);

function fakeEntry(id, category, curriculumRank) {
  return {
    id,
    spanish: id,
    english: id,
    lemma: id,
    tier: "foundation",
    chapter: 1,
    category,
    curriculumRank,
    partOfSpeech: "noun",
  };
}

const thematicVocabulary = [
  ...Array.from({ length: 6 }, (_, index) => fakeEntry(`day-${index}`, "Los días", index + 1)),
  ...Array.from({ length: 5 }, (_, index) => fakeEntry(`month-${index}`, "Los meses", index + 7)),
  ...Array.from({ length: 4 }, (_, index) => fakeEntry(`place-${index}`, "Los lugares", index + 12)),
];
const thematicPlan = createDailySessionPlan(
  thematicVocabulary,
  { knownThrough: null, learningFrontier: "foundation" },
  { words: {} },
  "2026-07-02",
  () => 0.99,
  { newWordStyle: NEW_WORD_STYLES.TOPIC_GROUPS },
);
assert.deepEqual(thematicPlan.newWordIds, [
  "day-0", "day-1", "day-2", "day-3", "day-4", "day-5",
  "month-0", "month-1", "month-2", "month-3", "month-4",
]);

const fourteenWordTopic = Array.from(
  { length: 14 },
  (_, index) => fakeEntry(`city-${index}`, "En la ciudad", index + 1),
);
const splitTopicPlan = createDailySessionPlan(
  fourteenWordTopic,
  { knownThrough: null, learningFrontier: "foundation" },
  { words: {} },
  "2026-07-02",
  () => 0.99,
  { newWordStyle: NEW_WORD_STYLES.TOPIC_GROUPS },
);
assert.deepEqual(splitTopicPlan.newWordIds, [
  "city-0", "city-1", "city-2", "city-3", "city-4", "city-5", "city-6",
]);

assert.equal(adaptiveNewWordCount(0), 15);
assert.equal(adaptiveNewWordCount(8), 14);
assert.equal(adaptiveNewWordCount(60), 8);
assert.equal(newWordSelectionWeight({
  spanish: "zapato",
  lemma: "zapato",
  english: "shoe",
  partOfSpeech: "noun",
}), 1);
assert.equal(newWordSelectionWeight({
  spanish: "la universidad",
  lemma: "universidad",
  english: "university",
  partOfSpeech: "noun",
}), 0.6);
assert.equal(newWordSelectionWeight({
  spanish: "el menú",
  lemma: "menú",
  english: "menu",
  partOfSpeech: "noun",
}), 0.35);

console.log("Due-only check-in, adaptive audits, lower-tier health, same-day retirement, repair, and backlog checks passed.");
