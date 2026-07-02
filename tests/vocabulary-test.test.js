import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildQuestionForAnswer, DIRECTIONS } from "../src/questions.js";

const activeVocabulary = JSON.parse(
  await readFile(new URL("../assets/vocabulary.json", import.meta.url), "utf8"),
);
const testVocabulary = JSON.parse(
  await readFile(new URL("../assets/vocabulary-test-v1.json", import.meta.url), "utf8"),
);
const metadata = JSON.parse(
  await readFile(new URL("../assets/vocabulary-test-v1.meta.json", import.meta.url), "utf8"),
);

assert.equal(testVocabulary.length, 1500);
assert.equal(metadata.entryCount, testVocabulary.length);
assert.equal(metadata.applicationStatus, "testing-only-not-yet-active");
assert.equal(new Set(testVocabulary.map((entry) => entry.id)).size, testVocabulary.length);
assert.equal(
  new Set(testVocabulary.map((entry) => entry.spanish.toLocaleLowerCase("es"))).size,
  testVocabulary.length,
);

for (const tier of ["foundation", "everyday", "expanding"]) {
  assert.equal(testVocabulary.filter((entry) => entry.tier === tier).length, 500);
}

for (const entry of testVocabulary) {
  for (const field of [
    "id",
    "spanish",
    "english",
    "partOfSpeech",
    "tier",
    "category",
    "source",
  ]) {
    assert.equal(typeof entry[field], "string", `${entry.id}.${field} must be text`);
    assert.ok(entry[field].trim(), `${entry.id}.${field} must not be empty`);
  }

  assert.equal(entry.spanish, entry.spanish.toLocaleLowerCase("es"));
  assert.doesNotMatch(entry.english, /[\[\]{}#<>_=]/);

  for (const direction of Object.values(DIRECTIONS)) {
    const question = buildQuestionForAnswer(testVocabulary, entry, direction);
    assert.equal(question.choices.length, 4);
    assert.equal(new Set(question.choices).size, 4);
    assert.ok(question.choices.includes(question.correctAnswer));
  }
}

for (const original of activeVocabulary) {
  const retained = testVocabulary.find((entry) => entry.id === original.id);
  assert.ok(retained, `Missing original entry ${original.id}`);
  assert.equal(retained.spanish, original.spanish);
  assert.equal(retained.english, original.english);
  assert.equal(retained.tier, "foundation");
}

console.log("Validated 1,500 tiered test vocabulary entries and 100 retained IDs.");
