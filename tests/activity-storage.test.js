import assert from "node:assert/strict";
import { createActivityStorage } from "../src/activity-storage.js";

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

const storage = createMemoryStorage();
let currentDate = new Date(2026, 6, 1, 9);
const activity = createActivityStorage(storage, () => currentDate);

assert.deepEqual(activity.ensureMember("franco"), {
  joinedDate: "2026-07-01",
  membershipDays: 1,
  daysPracticed: 0,
  currentStreak: 0,
  totalQuizzes: 0,
  firstQuizErrorRate: null,
  overallErrorRate: null,
  firstQuizCount: 0,
});

let summary = activity.recordCompletedQuiz("franco", { correctCount: 10, wrongCount: 2 });
assert.equal(summary.firstQuizToday, true);
assert.equal(summary.currentStreak, 1);
assert.equal(summary.daysPracticed, 1);
assert.equal(summary.totalQuizzes, 1);
assert.equal(summary.firstQuizErrorRate, 2 / 12);
assert.equal(summary.overallErrorRate, 2 / 12);

summary = activity.recordCompletedQuiz("franco", { correctCount: 10, wrongCount: 8 });
assert.equal(summary.firstQuizToday, false);
assert.equal(summary.currentStreak, 1);
assert.equal(summary.daysPracticed, 1);
assert.equal(summary.totalQuizzes, 2);
assert.equal(summary.firstQuizErrorRate, 2 / 12);
assert.equal(summary.overallErrorRate, 10 / 30);

currentDate = new Date(2026, 6, 2, 22);
summary = activity.recordCompletedQuiz("franco", { correctCount: 10, wrongCount: 0 });
assert.equal(summary.firstQuizToday, true);
assert.equal(summary.currentStreak, 2);
assert.equal(summary.membershipDays, 2);
assert.equal(summary.daysPracticed, 2);
assert.equal(summary.totalQuizzes, 3);
assert.equal(summary.firstQuizErrorRate, 2 / 22);
assert.equal(summary.overallErrorRate, 10 / 40);

currentDate = new Date(2026, 6, 4, 8);
summary = activity.recordCompletedQuiz("franco", { correctCount: 10, wrongCount: 1 });
assert.equal(summary.currentStreak, 1);
assert.equal(summary.membershipDays, 4);
assert.equal(summary.daysPracticed, 3);
assert.equal(summary.firstQuizCount, 3);

const otherProfile = activity.ensureMember("milo");
assert.equal(otherProfile.totalQuizzes, 0);
assert.equal(otherProfile.daysPracticed, 0);

summary = activity.recordCompletedQuiz(
  "milo",
  { correctCount: 10, wrongCount: 0 },
  new Date(2026, 6, 10, 12),
);
assert.equal(summary.currentStreak, 1);
summary = activity.recordCompletedQuiz(
  "milo",
  { correctCount: 10, wrongCount: 1 },
  new Date(2026, 6, 11, 12),
);
assert.equal(summary.currentStreak, 2);
assert.equal(summary.daysPracticed, 2);

console.log("Daily activity, simulated dates, streak, membership, and error-rate checks passed.");
