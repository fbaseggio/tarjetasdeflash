import assert from "node:assert/strict";
import { createLearningStorage } from "../src/learning-storage.js";

const values = new Map();
const memoryStorage = {
  getItem(key) { return values.get(key) ?? null; },
  setItem(key, value) { values.set(key, value); },
};
const dataset = { id: "test-vocabulary", version: 1 };
const vocabulary = [
  { id: "agua", spanish: "agua", english: "water", tier: "foundation" },
  { id: "viaje", spanish: "viaje", english: "trip", tier: "everyday" },
  { id: "recurso", spanish: "recurso", english: "resource", tier: "expanding" },
];
let currentDate = new Date(2026, 6, 2, 9);
const learning = createLearningStorage(memoryStorage, () => currentDate);

learning.seedOnboarding("franco", dataset, {
  completedAt: "2026-07-01T14:00:00.000Z",
  assessedWords: {
    agua: { direction: "spanish-to-english", correct: true },
    viaje: { direction: "english-to-spanish", correct: false },
  },
}, vocabulary);

let coverage = learning.getCoverage("franco", dataset);
assert.deepEqual(coverage.foundation, { tested: 1, latestCorrect: 1, latestWrong: 0 });
assert.deepEqual(coverage.everyday, { tested: 1, latestCorrect: 0, latestWrong: 1 });
assert.deepEqual(coverage.expanding, { tested: 0, latestCorrect: 0, latestWrong: 0 });

learning.recordPresentations("franco", dataset, [vocabulary[2]]);
let snapshot = learning.getSnapshot("franco", dataset);
assert.equal(snapshot.words.recurso.schedule.dueDate, "2026-07-02");
assert.equal(snapshot.words.recurso.schedule.intervalDays, 0);
assert.equal(learning.getCoverage("franco", dataset).expanding.tested, 0);

learning.recordFirstAttempts("franco", dataset, [{
  vocabularyId: "recurso",
  tier: "expanding",
  direction: "spanish-to-english",
  correct: true,
}]);
snapshot = learning.getSnapshot("franco", dataset);
assert.equal(snapshot.words.recurso.schedule.dueDate, "2026-07-03");
assert.equal(snapshot.words.recurso.schedule.intervalDays, 1);
assert.equal(snapshot.words.recurso.directions["spanish-to-english"].testCount, 1);

currentDate = new Date(2026, 6, 3, 9);
learning.recordFirstAttempts("franco", dataset, [{
  vocabularyId: "recurso",
  tier: "expanding",
  direction: "spanish-to-english",
  correct: true,
}]);
snapshot = learning.getSnapshot("franco", dataset);
assert.equal(snapshot.words.recurso.schedule.dueDate, "2026-07-06");
assert.equal(snapshot.words.recurso.schedule.intervalDays, 3);
assert.equal(snapshot.words.recurso.directions["spanish-to-english"].testCount, 2);

learning.recordFirstAttempts("franco", dataset, [{
  vocabularyId: "viaje",
  tier: "everyday",
  direction: "spanish-to-english",
  correct: true,
}], "2026-07-20");
snapshot = learning.getSnapshot("franco", dataset);
assert.equal(snapshot.words.viaje.schedule.dueDate, "2026-07-21");

currentDate = new Date(2026, 6, 4, 9);
learning.recordFirstAttempts("franco", dataset, [{
  vocabularyId: "agua",
  tier: "foundation",
  direction: "english-to-spanish",
  correct: false,
}]);
coverage = learning.getCoverage("franco", dataset);
assert.deepEqual(coverage.foundation, { tested: 1, latestCorrect: 0, latestWrong: 1 });

const firstSession = { date: "2026-07-04", status: "complete" };
learning.saveDailySession("franco", dataset, firstSession);
const secondSession = { date: "2026-07-04", status: "in-progress", repeat: true };
learning.saveDailySession("franco", dataset, secondSession);
assert.equal(firstSession.sessionKey, "2026-07-04");
assert.equal(secondSession.sessionKey, "2026-07-04#2");
assert.equal(learning.getDailySession("franco", dataset, "2026-07-04").status, "in-progress");
assert.equal(learning.getDailySessionsForDate("franco", dataset, "2026-07-04").length, 2);
assert.equal(learning.nextDailySessionKey("franco", dataset, "2026-07-04"), "2026-07-04#3");
assert.equal(learning.getSnapshot("franco", { ...dataset, version: 2 }).words.agua, undefined);

const legacyValues = new Map([["tarjetas.learning.v1.franco", JSON.stringify({
  datasetId: dataset.id,
  datasetVersion: dataset.version,
  words: {
    recurso: {
      tier: "expanding",
      encounteredAt: "2026-07-01T14:00:00.000Z",
      presentations: 1,
      directions: {},
      schedule: {
        intervalIndex: 0,
        dueDate: "2026-07-04",
        lastReviewedAt: "2026-07-01T15:00:00.000Z",
      },
    },
  },
  dailySessions: {
    "2026-07-01": { date: "2026-07-01", status: "complete" },
    "2026-07-02": { date: "2026-07-02", status: "complete", simulated: true },
    "2026-07-03": { date: "2026-07-03", status: "complete", simulated: true },
  },
})]]);
const legacyLearning = createLearningStorage({
  getItem(key) { return legacyValues.get(key) ?? null; },
  setItem(key, value) { legacyValues.set(key, value); },
}, () => new Date(2026, 6, 1, 12));
const calendarRepair = legacyLearning.normalizeCalendar("franco", dataset, "2026-07-01");
assert.equal(calendarRepair.collapsedSessions, 2);
const repairedSessions = legacyLearning.getDailySessionsForDate("franco", dataset, "2026-07-01");
assert.deepEqual(repairedSessions.map((session) => session.sessionKey), [
  "2026-07-01", "2026-07-01#2", "2026-07-01#3",
]);
assert.ok(repairedSessions.every((session) => session.date === "2026-07-01"));
assert.equal(repairedSessions[1].historyId, "franco:2026-07-02");
assert.equal(legacyLearning.getSnapshot("franco", dataset).words.recurso.schedule.dueDate, "2026-07-02");

console.log("Word evidence, same-day sessions, calendar repair, coverage, and scheduling checks passed.");
