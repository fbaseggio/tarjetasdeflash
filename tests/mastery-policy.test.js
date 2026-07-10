import assert from "node:assert/strict";
import {
  auditGapDays,
  buildMasteryProjection,
  conceptKey,
  eligibleForOrdinaryQuestion,
  masteryAfterAttempt,
} from "../src/mastery-policy.js";

const placement = { learningFrontier: "expanding1" };
const foundation = {
  id: "agua", spanish: "agua", english: "water", partOfSpeech: "noun", tier: "foundation",
};
const everyday = {
  id: "viaje", spanish: "viaje", english: "trip", partOfSpeech: "noun", tier: "everyday",
};
const frontier = {
  id: "recurso", spanish: "recurso", english: "resource", partOfSpeech: "noun", tier: "expanding1",
};
const strongCognate = {
  id: "menu", spanish: "el menú", lemma: "menú", english: "menu", partOfSpeech: "noun", tier: "expanding1",
};
const moderateCognate = {
  id: "universidad", spanish: "la universidad", lemma: "universidad", english: "university", partOfSpeech: "noun", tier: "expanding1",
};

assert.equal(auditGapDays("foundation"), 60);
assert.equal(auditGapDays("everyday"), 30);
assert.equal(auditGapDays("expanding1"), 30);
assert.equal(conceptKey(foundation), "agua|noun|water");
assert.equal(eligibleForOrdinaryQuestion(null, "2026-07-01"), true);
assert.equal(eligibleForOrdinaryQuestion({
  lastFirstAttemptDate: "2026-07-01", schedule: { dueDate: "2026-07-01" },
}, "2026-07-01"), false);
assert.equal(eligibleForOrdinaryQuestion({
  lastFirstAttemptDate: "2026-06-30", schedule: { dueDate: "2026-07-01" },
}, "2026-07-01"), true);

let result = masteryAfterAttempt({}, {
  ...frontier, vocabularyId: frontier.id, correct: true, source: "review",
}, "2026-07-01", placement);
assert.equal(result.intervalDays, 3);
assert.equal(result.retiredDate, "2026-07-01");

result = masteryAfterAttempt({
  tier: "expanding1",
  lastFirstAttemptDate: "2026-07-01",
  schedule: { intervalDays: 3 },
}, {
  ...frontier, vocabularyId: frontier.id, correct: true, source: "check-in",
}, "2026-07-01", placement);
assert.equal(result.intervalDays, 3);

result = masteryAfterAttempt({}, {
  ...strongCognate,
  vocabularyId: strongCognate.id,
  direction: "english-to-spanish",
  correct: true,
  source: "review",
}, "2026-07-01", placement);
assert.equal(result.intervalDays, 14);

result = masteryAfterAttempt({}, {
  ...strongCognate,
  vocabularyId: strongCognate.id,
  direction: "spanish-to-english",
  correct: true,
  source: "review",
}, "2026-07-01", placement);
assert.equal(result.intervalDays, 7);

result = masteryAfterAttempt({}, {
  ...moderateCognate,
  vocabularyId: moderateCognate.id,
  direction: "english-to-spanish",
  correct: true,
  source: "review",
}, "2026-07-01", placement);
assert.equal(result.intervalDays, 7);

result = masteryAfterAttempt({}, {
  ...moderateCognate,
  vocabularyId: moderateCognate.id,
  direction: "spanish-to-english",
  correct: true,
  source: "review",
}, "2026-07-01", placement);
assert.equal(result.intervalDays, 3);

result = masteryAfterAttempt({}, {
  ...foundation, vocabularyId: foundation.id, correct: true, source: "check-in",
}, "2026-07-01", placement);
assert.equal(result.intervalDays, 60);
assert.equal(result.masteryTrack, "audit");

result = masteryAfterAttempt({}, {
  ...everyday, vocabularyId: everyday.id, correct: true, source: "check-in",
}, "2026-07-01", placement);
assert.equal(result.intervalDays, 30);

result = masteryAfterAttempt({}, {
  ...foundation, vocabularyId: foundation.id, correct: false, source: "check-in",
}, "2026-07-01", placement);
assert.equal(result.masteryStatus, "repair");
assert.equal(result.repairDueDate, "2026-07-01");
assert.equal(result.retiredDate, null);

result = masteryAfterAttempt({
  tier: "foundation",
  masteryStatus: "repair",
  repairCleanStreak: 0,
  lastFirstAttemptDate: "2026-07-01",
  schedule: { intervalDays: 1 },
}, {
  ...foundation, vocabularyId: foundation.id, correct: true, source: "review",
}, "2026-07-01", placement);
assert.equal(result.intervalDays, 1);
assert.equal(result.masteryStatus, "repair");
assert.equal(result.retiredDate, "2026-07-01");

result = masteryAfterAttempt({
  tier: "foundation",
  masteryStatus: "repair",
  repairCleanStreak: 1,
  lastFirstAttemptDate: "2026-07-04",
  schedule: { intervalDays: 3 },
}, {
  ...foundation, vocabularyId: foundation.id, correct: true, source: "review",
}, "2026-07-07", placement);
assert.equal(result.masteryStatus, "presumed-mastered");
assert.equal(result.intervalDays, 60);

const projection = buildMasteryProjection([foundation], {
  agua: {
    conceptKey: conceptKey(foundation),
    tier: "foundation",
    masteryTrack: "audit",
    masteryStatus: "presumed-mastered",
    schedule: { intervalDays: 60, dueDate: "2026-08-30" },
    directions: { "spanish-to-english": { correct: true, testCount: 2 } },
  },
}, { id: "test", version: 1 });
assert.equal(projection.concepts[0].evidenceCount, 2);
assert.equal(projection.concepts[0].reviewGapDays, 60);

console.log("Frontier, audit, repair, same-day, and portable mastery policy checks passed.");
