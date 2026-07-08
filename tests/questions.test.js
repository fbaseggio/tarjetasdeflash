import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildQuestion,
  buildQuestionForAnswer,
  buildQuiz,
  buildQuizFromAnswers,
  DIRECTIONS,
} from "../src/questions.js";

const vocabulary = JSON.parse(fs.readFileSync(new URL("../assets/vocabulary.json", import.meta.url)));
const answerSlots = [0, 0, 0, 0];
let previousVocabularyId = null;

for (let index = 0; index < 10_000; index += 1) {
  const question = buildQuestion(vocabulary, previousVocabularyId);

  assert.equal(question.choices.length, 4);
  assert.equal(question.distractors.length, 3);
  assert.ok(question.distractors.every((distractor) => distractor.vocabularyId));
  assert.equal(new Set(question.choices).size, 4);
  assert.ok(question.choices.includes(question.correctAnswer));
  assert.equal(typeof question.teachingSpanish, "string");
  assert.equal(typeof question.teachingEnglish, "string");
  assert.equal(typeof question.hasTeachingVariant, "boolean");
  assert.notEqual(question.vocabularyId, previousVocabularyId);

  answerSlots[question.choices.indexOf(question.correctAnswer)] += 1;
  previousVocabularyId = question.vocabularyId;
}

for (const slotCount of answerSlots) {
  assert.ok(slotCount > 2_200 && slotCount < 2_800, `Unexpected answer distribution: ${answerSlots}`);
}

console.log(`Generated 10,000 valid questions; answer slots: ${answerSlots.join(", ")}`);

const quiz = buildQuiz(vocabulary, 10);
assert.equal(quiz.length, 10);
assert.equal(new Set(quiz.map((question) => question.vocabularyId)).size, 10);
assert.equal(
  quiz.filter((question) => question.initialDirection === DIRECTIONS.SPANISH_TO_ENGLISH).length,
  5,
);
assert.equal(
  quiz.filter((question) => question.initialDirection === DIRECTIONS.ENGLISH_TO_SPANISH).length,
  5,
);

for (const definition of quiz) {
  for (const direction of Object.values(DIRECTIONS)) {
    const question = definition.variants[direction];
    assert.equal(question.direction, direction);
    assert.equal(question.choices.length, 4);
    assert.equal(new Set(question.choices).size, 4);
    assert.ok(question.choices.includes(question.correctAnswer));
    assert.ok(question.teachingSpanish);
    assert.ok(question.teachingEnglish);
  }
}

console.log("Generated a balanced bidirectional quiz without repeated vocabulary.");

const shortRound = buildQuizFromAnswers(vocabulary, vocabulary.slice(0, 3), () => 0.41);
assert.equal(shortRound.length, 3);
assert.deepEqual(
  new Set(shortRound.map((question) => question.vocabularyId)),
  new Set(vocabulary.slice(0, 3).map((entry) => entry.id)),
);
assert.ok(shortRound.every((definition) => (
  definition.variants[definition.initialDirection].choices.length === 4
)));

console.log("Generated a short review round with distractors from the full vocabulary.");

const synonymous = [
  { id: "ser", spanish: "ser", english: "to be" },
  { id: "estar", spanish: "estar", english: "to be" },
  { id: "tener", spanish: "tener", english: "to have" },
  { id: "hacer", spanish: "hacer", english: "to do" },
  { id: "ir", spanish: "ir", english: "to go" },
];
const synonymQuestion = buildQuestionForAnswer(
  synonymous,
  synonymous[0],
  DIRECTIONS.ENGLISH_TO_SPANISH,
  () => 0.5,
);
assert.equal(synonymQuestion.prompt, "to be");
assert.ok(!synonymQuestion.choices.includes("estar"));

console.log("Equivalent prompts cannot become each other's distractors.");
