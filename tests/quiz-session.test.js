import assert from "node:assert/strict";
import { DIRECTIONS } from "../src/questions.js";
import { createQuizSession } from "../src/quiz-session.js";

function makeVariant(index, direction) {
  const isSpanishPrompt = direction === DIRECTIONS.SPANISH_TO_ENGLISH;
  const correctAnswer = isSpanishPrompt ? `english-${index}` : `spanish-${index}`;
  const wrongPrefix = isSpanishPrompt ? "english-wrong" : "spanish-wrong";

  return {
    vocabularyId: `word-${index}`,
    direction,
    promptLanguage: isSpanishPrompt ? "es" : "en",
    answerLanguage: isSpanishPrompt ? "en" : "es",
    prompt: isSpanishPrompt ? `spanish-${index}` : `english-${index}`,
    correctAnswer,
    choices: [
      `${wrongPrefix}-a-${index}`,
      correctAnswer,
      `${wrongPrefix}-b-${index}`,
      `${wrongPrefix}-c-${index}`,
    ],
  };
}

function makeQuestions(count = 10) {
  return Array.from({ length: count }, (_, index) => ({
    vocabularyId: `word-${index}`,
    initialDirection: index % 2 === 0
      ? DIRECTIONS.SPANISH_TO_ENGLISH
      : DIRECTIONS.ENGLISH_TO_SPANISH,
    variants: {
      [DIRECTIONS.SPANISH_TO_ENGLISH]: makeVariant(index, DIRECTIONS.SPANISH_TO_ENGLISH),
      [DIRECTIONS.ENGLISH_TO_SPANISH]: makeVariant(index, DIRECTIONS.ENGLISH_TO_SPANISH),
    },
  }));
}

const perfectQuestions = makeQuestions();
const perfectSession = createQuizSession(perfectQuestions);

for (const definition of perfectQuestions) {
  const beforeAnswer = perfectSession.getState();
  assert.equal(beforeAnswer.question.vocabularyId, definition.vocabularyId);
  const result = perfectSession.submitAnswer(beforeAnswer.question.correctAnswer);
  assert.equal(result.correct, true);
  perfectSession.advance();
}

const perfectScore = perfectSession.getState();
assert.equal(perfectScore.phase, "complete");
assert.equal(perfectScore.correctCount, 10);
assert.equal(perfectScore.wrongCount, 0);

const reviewQuestions = makeQuestions();
const reviewSession = createQuizSession(reviewQuestions);
const missedDefinition = reviewQuestions[0];
const initialVariant = missedDefinition.variants[DIRECTIONS.SPANISH_TO_ENGLISH];
const oppositeVariant = missedDefinition.variants[DIRECTIONS.ENGLISH_TO_SPANISH];

let result = reviewSession.submitAnswer(initialVariant.choices[0]);
assert.equal(result.correct, false);
reviewSession.advance();

for (const definition of reviewQuestions.slice(1)) {
  const state = reviewSession.getState();
  assert.equal(state.question.vocabularyId, definition.vocabularyId);
  reviewSession.submitAnswer(state.question.correctAnswer);
  reviewSession.advance();
}

let reviewState = reviewSession.getState();
assert.equal(reviewState.phase, "review");
assert.equal(reviewState.direction, DIRECTIONS.ENGLISH_TO_SPANISH);
assert.equal(reviewState.question.prompt, oppositeVariant.prompt);
assert.deepEqual(reviewState.knownWrongAnswers, []);

reviewSession.submitAnswer(oppositeVariant.choices[0]);
reviewSession.advance();
reviewState = reviewSession.getState();
assert.equal(reviewState.direction, DIRECTIONS.SPANISH_TO_ENGLISH);
assert.deepEqual(reviewState.knownWrongAnswers, [initialVariant.choices[0]]);
assert.throws(
  () => reviewSession.submitAnswer(initialVariant.choices[0]),
  /previously eliminated/,
);

reviewSession.submitAnswer(initialVariant.choices[2]);
reviewSession.advance();
reviewState = reviewSession.getState();
assert.equal(reviewState.direction, DIRECTIONS.ENGLISH_TO_SPANISH);
assert.deepEqual(reviewState.knownWrongAnswers, [oppositeVariant.choices[0]]);

result = reviewSession.submitAnswer(oppositeVariant.correctAnswer);
assert.equal(result.correct, true);
assert.equal(result.nextPhase, "complete");
const finalState = reviewSession.advance();

assert.equal(finalState.phase, "complete");
assert.equal(finalState.correctCount, 10);
assert.equal(finalState.wrongCount, 3);

console.log("Alternating-direction review and direction-specific elimination checks passed.");
