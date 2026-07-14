import assert from "node:assert/strict";
import {
  answerFeedback,
  buildAllWordsReview,
  buildAssessmentReview,
  buildHistoryReview,
  reviewGapDays,
  reviewGapLabel,
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
  learningWords: {
    agua: { schedule: { intervalIndex: 0, dueDate: "2026-07-04" } },
    viaje: { schedule: { intervalIndex: 2, dueDate: "2026-07-10" }, manualPriority: "more" },
  },
});
assert.deepEqual(sessionSections.map((section) => section.id), [
  "check-in", "new-words", "due-review",
]);
assert.equal(sessionSections[0].wrongCount, 1);
assert.equal(sessionSections[0].items[0].recoveryAttempts, 1);
assert.equal(sessionSections[1].items[0].spanish, "viaje");
assert.equal(sessionSections[1].items[0].reviewGapDays, 7);
assert.equal(sessionSections[1].items[0].manualPriority, "more");
assert.equal(sessionSections[2].correctCount, 1);
assert.equal(sessionSections[2].items[0].manualPriority, "more");
assert.equal(sessionSections[0].items[0].reviewGapDays, 1);

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

const allWords = buildAllWordsReview({
  vocabularyIds: ["viaje", "agua", "viaje"],
  vocabulary: [
    { id: "agua", spanish: "agua", english: "water" },
    { id: "viaje", spanish: "viaje", english: "trip" },
  ],
  learningWords: {
    agua: { schedule: { intervalDays: 3 } },
    viaje: { schedule: { intervalIndex: 2 }, manualPriority: "less" },
  },
});
assert.equal(allWords.length, 1);
assert.deepEqual(allWords[0].items.map((item) => item.vocabularyId), ["agua", "viaje"]);
assert.deepEqual(allWords[0].items.map((item) => item.reviewGapDays), [3, 7]);
assert.deepEqual(allWords[0].items.map((item) => item.manualPriority), [null, "less"]);

assert.equal(reviewGapDays({ schedule: { intervalDays: 14, intervalIndex: 0 } }), 14);
assert.equal(reviewGapDays({ schedule: { intervalIndex: 5 } }), 60);
assert.equal(reviewGapDays({ schedule: null }), null);
assert.equal(reviewGapLabel(1), "Review gap: 1 day");
assert.equal(reviewGapLabel(7), "Review gap: 7 days");
assert.equal(reviewGapLabel(null), "Review gap not set");

assert.equal(answerFeedback(true), "Correct.");
assert.equal(answerFeedback(false), "Incorrect.");

console.log("Assessment, section, all-words, review-gap, and feedback checks passed.");
