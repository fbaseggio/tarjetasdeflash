import assert from "node:assert/strict";
import {
  answerFeedback,
  buildAssessmentReview,
  buildHistoryReview,
} from "../src/review-results.js";

const rounds = [
  { id: "check", practiceSessionId: "franco:2026-07-03", stage: "check-in" },
  { id: "due-1", practiceSessionId: "franco:2026-07-03", stage: "due-review" },
  { id: "extra", practiceSessionId: null, stage: "extra" },
];
const attempts = [
  {
    quizRoundId: "check", vocabularyId: "agua", phase: "main", promptText: "agua",
    correctAnswer: "water", selectedAnswer: "door", correct: false,
    direction: "spanish-to-english", answeredAt: "2026-07-03T10:00:00.000Z",
  },
  {
    quizRoundId: "check", vocabularyId: "agua", phase: "review", promptText: "water",
    correctAnswer: "agua", selectedAnswer: "agua", correct: true,
    direction: "english-to-spanish", answeredAt: "2026-07-03T10:01:00.000Z",
  },
  {
    quizRoundId: "due-1", vocabularyId: "viaje", phase: "main", promptText: "trip",
    correctAnswer: "viaje", selectedAnswer: "viaje", correct: true,
    direction: "english-to-spanish", answeredAt: "2026-07-03T10:02:00.000Z",
  },
  {
    quizRoundId: "extra", vocabularyId: "casa", phase: "main", promptText: "casa",
    correctAnswer: "house", selectedAnswer: "house", correct: true,
    direction: "spanish-to-english", answeredAt: "2026-07-03T10:03:00.000Z",
  },
];

const sessionSections = buildHistoryReview({
  rounds,
  attempts,
  practiceSessionId: "franco:2026-07-03",
  newWords: [{ id: "viaje", spanish: "viaje", english: "trip" }],
});
assert.deepEqual(sessionSections.map((section) => section.id), [
  "check-in", "new-words", "due-review",
]);
assert.equal(sessionSections[0].wrongCount, 1);
assert.equal(sessionSections[0].items[0].recoveryAttempts, 1);
assert.equal(sessionSections[1].items[0].spanish, "viaje");
assert.equal(sessionSections[2].correctCount, 1);

const extraSections = buildHistoryReview({ rounds, attempts, roundId: "extra" });
assert.equal(extraSections.length, 1);
assert.equal(extraSections[0].title, "Extra quiz");

const assessment = buildAssessmentReview({
  attempts: [{
    vocabularyId: "agua", tier: "foundation", direction: "spanish-to-english",
    selectedAnswer: "door", correctAnswer: "water", correct: false,
  }],
}, [{ id: "agua", spanish: "agua", english: "water" }]);
assert.equal(assessment.length, 1);
assert.equal(assessment[0].items[0].prompt, "agua");
assert.equal(assessment[0].wrongCount, 1);

assert.equal(answerFeedback(true, "water"), "Correct.");
assert.equal(answerFeedback(false, "water"), "Not quite — the answer is water.");

console.log("Assessment, session, extra-quiz review sections, and feedback messages passed.");
