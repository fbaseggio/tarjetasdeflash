import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { selectQuizVocabulary } from "../src/quiz-selection.js";

const vocabulary = JSON.parse(
  await readFile(new URL("../assets/vocabulary-test-v1.json", import.meta.url), "utf8"),
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
  { learningFrontier: "expanding" },
  10,
  () => 0.41,
);
assert.equal(expandingQuiz.filter((entry) => entry.tier === "expanding").length, 8);
assert.equal(expandingQuiz.filter((entry) => entry.tier === "foundation").length, 2);

console.log("Frontier-weighted quiz selection checks passed.");
