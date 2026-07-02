import assert from "node:assert/strict";
import fs from "node:fs";
import { buildQuestion } from "../src/questions.js";

const vocabulary = JSON.parse(fs.readFileSync(new URL("../assets/vocabulary.json", import.meta.url)));
const answerSlots = [0, 0, 0, 0];
let previousVocabularyId = null;

for (let index = 0; index < 10_000; index += 1) {
  const question = buildQuestion(vocabulary, previousVocabularyId);

  assert.equal(question.choices.length, 4);
  assert.equal(new Set(question.choices).size, 4);
  assert.ok(question.choices.includes(question.correctAnswer));
  assert.notEqual(question.vocabularyId, previousVocabularyId);

  answerSlots[question.choices.indexOf(question.correctAnswer)] += 1;
  previousVocabularyId = question.vocabularyId;
}

for (const slotCount of answerSlots) {
  assert.ok(slotCount > 2_200 && slotCount < 2_800, `Unexpected answer distribution: ${answerSlots}`);
}

console.log(`Generated 10,000 valid questions; answer slots: ${answerSlots.join(", ")}`);
