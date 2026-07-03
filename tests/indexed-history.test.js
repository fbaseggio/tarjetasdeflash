import assert from "node:assert/strict";
import {
  createIndexedHistory,
  createRecordId,
  practiceSessionRecord,
  quizRoundRecord,
} from "../src/indexed-history.js";

assert.equal(
  createRecordId("attempt", { randomUUID: () => "fixed-id" }),
  "attempt-fixed-id",
);

const session = practiceSessionRecord("franco", {
  date: "2026-07-03",
  sessionKey: "2026-07-03#2",
  historyId: "franco:2026-07-03#2",
  repeat: true,
  status: "in-progress",
  stage: "due-reviews",
  checkInIds: ["agua"],
  newWordIds: ["viaje"],
  presentedWordIds: ["viaje"],
  reviewIds: ["agua", "viaje"],
  newWordIndex: 1,
  reviewCursor: 0,
  quizRounds: 1,
  correctCount: 1,
  wrongCount: 2,
  streakCredited: true,
}, "2026-07-02T20:00:00.000Z");

assert.equal(session.id, "franco:2026-07-03#2");
assert.equal(session.sessionKey, "2026-07-03#2");
assert.equal(session.repeatedSameDay, true);
assert.equal(session.simulated, false);
assert.deepEqual(session.presentedWordIds, ["viaje"]);

const round = quizRoundRecord({
  id: "round-1",
  profileId: "franco",
  practiceSessionId: session.id,
  stage: "due-review",
  definitions: [{ vocabularyId: "agua" }],
  startedAt: "2026-07-02T20:01:00.000Z",
});
assert.equal(round.status, "in-progress");
assert.equal(round.actualQuestionCount, 1);

const unavailable = createIndexedHistory(null);
assert.equal(unavailable.getStatus().available, false);
assert.equal(await unavailable.saveAttempt({ id: "attempt-1" }), false);
assert.deepEqual(await unavailable.getProfileHistory("franco"), {
  practiceSessions: [],
  quizRounds: [],
  attempts: [],
});
assert.match(unavailable.getStatus().lastError, /not available/);

console.log("Indexed history records and graceful unavailable-storage behavior checks passed.");
