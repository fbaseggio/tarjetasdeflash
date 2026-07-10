import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAssessmentSession } from "../src/assessment.js";

const vocabulary = JSON.parse(
  await readFile(new URL("../assets/vocabulary-official-v1.json", import.meta.url), "utf8"),
);

function completeAssessment(answerCorrectlyForTier) {
  const session = createAssessmentSession(vocabulary, () => 0.37);
  let state = session.getState();

  while (state.phase !== "complete") {
    const question = state.question;
    const shouldBeCorrect = answerCorrectlyForTier(state.tier);
    const answer = shouldBeCorrect
      ? question.correctAnswer
      : question.choices.find((choice) => choice !== question.correctAnswer);
    state = session.submitAnswer(answer);
  }

  return session.getResult();
}

const advanced = completeAssessment(() => true);
assert.equal(advanced.assessedCount, 22);
assert.equal(advanced.confirmationTier, "expanding2");
assert.equal(advanced.knownThrough, "expanding2");
assert.equal(advanced.learningFrontier, "expanding2");
assert.equal(advanced.confidence, "low");
assert.deepEqual(advanced.presumedKnownTiers, ["foundation", "everyday", "expanding1", "expanding2"]);

const foundationRepair = completeAssessment((tier) => tier !== "foundation");
assert.equal(foundationRepair.confirmationTier, "foundation");
assert.equal(foundationRepair.knownThrough, null);
assert.equal(foundationRepair.learningFrontier, "foundation");
assert.equal(foundationRepair.scores.foundation.total, 10);

const everydayStart = completeAssessment((tier) => tier !== "everyday");
assert.equal(everydayStart.confirmationTier, "everyday");
assert.equal(everydayStart.knownThrough, "foundation");
assert.equal(everydayStart.learningFrontier, "everyday");
assert.equal(everydayStart.scores.everyday.total, 10);

const expandingStart = completeAssessment((tier) => tier !== "expanding1");
assert.equal(expandingStart.confirmationTier, "expanding1");
assert.equal(expandingStart.knownThrough, "everyday");
assert.equal(expandingStart.learningFrontier, "expanding1");
assert.equal(expandingStart.scores.expanding1.total, 10);

const expanding2Start = completeAssessment((tier) => tier !== "expanding2");
assert.equal(expanding2Start.confirmationTier, "expanding2");
assert.equal(expanding2Start.knownThrough, "expanding1");
assert.equal(expanding2Start.learningFrontier, "expanding2");
assert.equal(expanding2Start.scores.expanding2.total, 10);

console.log("Adaptive 22-question onboarding placement checks passed.");
