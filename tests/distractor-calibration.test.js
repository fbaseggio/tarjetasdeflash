import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { selectWeightedDistractors } from "../src/distractors.js";

const vocabulary = JSON.parse(
  await readFile(new URL("../assets/vocabulary-official-v1.json", import.meta.url), "utf8"),
);
const vocabularyById = new Map(vocabulary.map((entry) => [entry.id, entry]));

let seed = 0x5eed1234;
function random() {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 2 ** 32;
}

function hasTrait(entry, trait) {
  return entry.distractorTraits?.includes(trait) ?? false;
}

function structurallyCompatible(target, candidate) {
  if (target.partOfSpeech === candidate.partOfSpeech) return true;
  return (
    (hasTrait(target, "verbo") && hasTrait(candidate, "verbo-falso"))
    || (hasTrait(target, "verbo-falso") && hasTrait(candidate, "verbo"))
  );
}

const questionCount = vocabulary.length * 2;
let fallbackChoices = 0;
let fallbackQuestions = 0;
let broadSemanticChoices = 0;

for (let index = 0; index < questionCount; index += 1) {
  const target = vocabulary[index % vocabulary.length];
  const direction = index < vocabulary.length
    ? "spanish-to-english"
    : "english-to-spanish";
  const choices = selectWeightedDistractors(vocabulary, target, direction, 3, random);

  assert.equal(choices.length, 3);
  assert.ok(choices.every((choice) => choice.selectionMode !== "baseline"));
  assert.ok(choices.every((choice) => (
    structurallyCompatible(target, vocabularyById.get(choice.vocabularyId))
  )), `format mismatch for ${target.spanish}`);

  for (const choice of choices) {
    const candidate = vocabularyById.get(choice.vocabularyId);
    if (target.partOfSpeech !== "question") {
      assert.notEqual(candidate.partOfSpeech, "question");
    }
    if (target.partOfSpeech !== "proper noun") {
      assert.notEqual(candidate.partOfSpeech, "proper noun");
    }
    if (target.partOfSpeech !== "number") {
      assert.notEqual(candidate.partOfSpeech, "number");
    }
    if (target.partOfSpeech !== "phrase") {
      assert.notEqual(candidate.partOfSpeech, "phrase");
    }

    if (target.partOfSpeech !== candidate.partOfSpeech) {
      assert.ok(
        choice.reasons.includes("similar-spelling") || choice.reasons.includes("similar-sound"),
        "cross-POS verbo surface confusers need spelling or sound affinity",
      );
      assert.equal(choice.selectionMode, "quality");
    }
  }

  const questionFallbacks = choices.filter(
    (choice) => choice.selectionMode === "format-fallback",
  ).length;
  fallbackChoices += questionFallbacks;
  if (questionFallbacks > 0) fallbackQuestions += 1;
  broadSemanticChoices += choices.filter(
    (choice) => choice.selectionMode === "broad-semantic",
  ).length;
}

const fallbackChoiceRate = fallbackChoices / (questionCount * 3);
const fallbackQuestionRate = fallbackQuestions / questionCount;
assert.ok(fallbackChoiceRate < 0.05, `${fallbackChoiceRate} fallback choice rate`);
assert.ok(fallbackQuestionRate < 0.05, `${fallbackQuestionRate} fallback question rate`);

for (const partOfSpeech of ["question", "proper noun", "number"]) {
  const targets = vocabulary.filter((entry) => entry.partOfSpeech === partOfSpeech);
  for (let index = 0; index < 100; index += 1) {
    const target = targets[index % targets.length];
    const direction = index % 2 === 0 ? "spanish-to-english" : "english-to-spanish";
    const choices = selectWeightedDistractors(vocabulary, target, direction, 3, random);
    assert.ok(choices.every(
      (choice) => vocabularyById.get(choice.vocabularyId).partOfSpeech === partOfSpeech,
    ));
  }
}

console.log(
  `Distractor calibration: ${(fallbackChoiceRate * 100).toFixed(2)}% fallback choices in `
  + `${(fallbackQuestionRate * 100).toFixed(2)}% of questions; `
  + `${broadSemanticChoices} broad-semantic backoff choices.`,
);
