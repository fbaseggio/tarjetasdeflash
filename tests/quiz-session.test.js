import assert from "node:assert/strict";
import { createQuizSession } from "../src/quiz-session.js";

function makeQuestions(count = 10) {
  return Array.from({ length: count }, (_, index) => ({
    vocabularyId: `word-${index}`,
    prompt: `palabra-${index}`,
    correctAnswer: `answer-${index}`,
    choices: [`wrong-a-${index}`, `answer-${index}`, `wrong-b-${index}`, `wrong-c-${index}`],
  }));
}

const perfectQuestions = makeQuestions();
const perfectSession = createQuizSession(perfectQuestions);

for (const question of perfectQuestions) {
  const beforeAnswer = perfectSession.getState();
  assert.equal(beforeAnswer.question.vocabularyId, question.vocabularyId);
  const result = perfectSession.submitAnswer(question.correctAnswer);
  assert.equal(result.correct, true);
  perfectSession.advance();
}

const perfectScore = perfectSession.getState();
assert.equal(perfectScore.phase, "complete");
assert.equal(perfectScore.correctCount, 10);
assert.equal(perfectScore.wrongCount, 0);

const reviewQuestions = makeQuestions();
const reviewSession = createQuizSession(reviewQuestions);
const missedQuestion = reviewQuestions[0];

let result = reviewSession.submitAnswer(missedQuestion.choices[0]);
assert.equal(result.correct, false);
assert.equal(result.nextPhase, "main");
reviewSession.advance();

for (const question of reviewQuestions.slice(1)) {
  result = reviewSession.submitAnswer(question.correctAnswer);
  reviewSession.advance();
}

let reviewState = reviewSession.getState();
assert.equal(reviewState.phase, "review");
assert.equal(reviewState.question.vocabularyId, missedQuestion.vocabularyId);
assert.deepEqual(reviewState.knownWrongAnswers, [missedQuestion.choices[0]]);
assert.deepEqual(reviewState.question.choices, missedQuestion.choices);
assert.throws(
  () => reviewSession.submitAnswer(missedQuestion.choices[0]),
  /previously eliminated/,
);

result = reviewSession.submitAnswer(missedQuestion.choices[2]);
assert.equal(result.correct, false);
assert.equal(result.nextPhase, "review");
reviewSession.advance();

reviewState = reviewSession.getState();
assert.deepEqual(
  reviewState.knownWrongAnswers,
  [missedQuestion.choices[0], missedQuestion.choices[2]],
);

result = reviewSession.submitAnswer(missedQuestion.correctAnswer);
assert.equal(result.correct, true);
assert.equal(result.nextPhase, "complete");
const finalState = reviewSession.advance();

assert.equal(finalState.phase, "complete");
assert.equal(finalState.correctCount, 10);
assert.equal(finalState.wrongCount, 2);

console.log("Quiz session scoring, review queue, and answer elimination checks passed.");
