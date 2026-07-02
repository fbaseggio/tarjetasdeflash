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

learning.saveDailySession("franco", dataset, { date: "2026-07-04", status: "in-progress" });
assert.equal(learning.getDailySession("franco", dataset, "2026-07-04").status, "in-progress");
assert.equal(learning.getSnapshot("franco", { ...dataset, version: 2 }).words.agua, undefined);

console.log("Word evidence, effective-date scheduling, coverage, and daily-session persistence checks passed.");
