import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildQuestionForAnswer, DIRECTIONS } from "../src/questions.js";

const officialVocabulary = JSON.parse(
  await readFile(new URL("../assets/vocabulary-official-v1.json", import.meta.url), "utf8"),
);
const metadata = JSON.parse(
  await readFile(new URL("../assets/vocabulary-official-v1.meta.json", import.meta.url), "utf8"),
);

assert.equal(officialVocabulary.length, 998);
assert.equal(metadata.entryCount, officialVocabulary.length);
assert.equal(metadata.applicationStatus, "active-official-vocabulary");
assert.equal(new Set(officialVocabulary.map((entry) => entry.id)).size, officialVocabulary.length);
assert.equal(
  new Set(officialVocabulary.map((entry) => entry.spanish.toLocaleLowerCase("es"))).size,
  officialVocabulary.length,
);

for (const tierMetadata of metadata.tiers) {
  assert.equal(
    officialVocabulary.filter((entry) => entry.tier === tierMetadata.id).length,
    tierMetadata.entryCount,
  );
}

for (const entry of officialVocabulary) {
  for (const field of [
    "id",
    "spanish",
    "english",
    "lemma",
    "partOfSpeech",
    "tier",
    "category",
    "source",
  ]) {
    assert.equal(typeof entry[field], "string", `${entry.id}.${field} must be text`);
    assert.ok(entry[field].trim(), `${entry.id}.${field} must not be empty`);
  }

  assert.ok(Number.isInteger(entry.chapter));
  assert.ok(Array.isArray(entry.chapters) && entry.chapters.includes(entry.chapter));
  assert.ok(Array.isArray(entry.senses) && entry.senses.length > 0);
  assert.ok(Array.isArray(entry.sourceRows) && entry.sourceRows.length > 0);
  assert.equal("doIKnowIt" in entry, false);
  assert.equal("rebeccaNeedsWorkOnIt" in entry, false);

  for (const direction of Object.values(DIRECTIONS)) {
    const question = buildQuestionForAnswer(officialVocabulary, entry, direction);
    assert.equal(question.choices.length, 4);
    assert.equal(new Set(question.choices).size, 4);
    assert.ok(question.choices.includes(question.correctAnswer));
  }
}

const pedir = officialVocabulary.find((entry) => entry.lemma === "pedir");
assert.equal(pedir.spanish, "pedir");
assert.equal(pedir.grammar.stemChange, "e:i");
assert.deepEqual(pedir.senses, ["to ask for", "to request", "to order (food)"]);
assert.equal(officialVocabulary.find((entry) => entry.lemma === "cero").english, "0");

console.log("Validated 998 entries in the official curriculum vocabulary.");
