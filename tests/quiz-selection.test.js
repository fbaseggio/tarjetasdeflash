import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { selectQuizVocabulary } from "../src/quiz-selection.js";

const vocabulary = JSON.parse(
  await readFile(new URL("../assets/vocabulary-official-v1.json", import.meta.url), "utf8"),
);

const everydayQuiz = selectQuizVocabulary(
  vocabulary,
  { learningFrontier: "everyday" },
  10,
  () => 0.41,
);
assert.equal(everydayQuiz.filter((entry) => entry.tier === "everyday").length, 8);
assert.equal(everydayQuiz.filter((entry) => entry.tier === "foundation").length, 2);
assert.equal(new Set(everydayQuiz.map((entry) => entry.id)).size, 10);

const foundationQuiz = selectQuizVocabulary(
  vocabulary,
  { learningFrontier: "foundation" },
  10,
  () => 0.41,
);
assert.ok(foundationQuiz.every((entry) => entry.tier === "foundation"));

const expandingQuiz = selectQuizVocabulary(
  vocabulary,
  { learningFrontier: "expanding1" },
  10,
  () => 0.41,
);
assert.equal(expandingQuiz.filter((entry) => entry.tier === "expanding1").length, 8);
assert.equal(expandingQuiz.filter((entry) => entry.tier === "foundation").length, 1);
assert.equal(expandingQuiz.filter((entry) => entry.tier === "everyday").length, 1);

const expanding2Quiz = selectQuizVocabulary(
  vocabulary,
  { learningFrontier: "expanding2" },
  10,
  () => 0.41,
);
assert.equal(expanding2Quiz.filter((entry) => entry.tier === "expanding2").length, 8);
assert.equal(expanding2Quiz.filter((entry) => entry.tier === "expanding1").length, 1);
assert.equal(expanding2Quiz.filter((entry) => entry.tier === "everyday").length, 1);

const sparseEligibleQuiz = selectQuizVocabulary(
  [
    ...vocabulary.filter((entry) => entry.tier === "foundation").slice(0, 2),
    ...vocabulary.filter((entry) => entry.tier === "everyday").slice(0, 2),
    ...vocabulary.filter((entry) => entry.tier === "expanding1").slice(0, 2),
  ],
  { learningFrontier: "expanding2" },
  6,
  () => 0.41,
);
assert.equal(sparseEligibleQuiz.length, 6);
assert.equal(new Set(sparseEligibleQuiz.map((entry) => entry.id)).size, 6);
assert.ok(sparseEligibleQuiz.every((entry) => entry.tier !== "expanding2"));

console.log("Frontier-weighted quiz selection checks passed.");
