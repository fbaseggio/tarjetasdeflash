import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { selectWeightedDistractors } from "../src/distractors.js";

const vocabulary = JSON.parse(
  await readFile(new URL("../assets/vocabulary-official-v1.json", import.meta.url), "utf8"),
);

let seed = 0x5eed1234;
function random() {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 2 ** 32;
}

const questionCount = 1_000;
const vocabularyById = new Map(vocabulary.map((entry) => [entry.id, entry]));
const baselineByDirection = {
  "spanish-to-english": { baseline: 0, questions: 0 },
  "english-to-spanish": { baseline: 0, questions: 0 },
};

for (let index = 0; index < questionCount; index += 1) {
  const target = vocabulary[index % vocabulary.length];
  const direction = index % 2 === 0 ? "spanish-to-english" : "english-to-spanish";
  const choices = selectWeightedDistractors(vocabulary, target, direction, 3, random);
  if (target.partOfSpeech !== "question") {
    assert.ok(
      choices.every(
        (choice) => vocabularyById.get(choice.vocabularyId).partOfSpeech !== "question",
      ),
      "questions must not distract non-question targets",
    );
  }
  baselineByDirection[direction].questions += 1;
  baselineByDirection[direction].baseline += choices.filter((choice) => choice.baseline).length;
}

const questions = vocabulary.filter((entry) => entry.partOfSpeech === "question");
let questionDistractorCount = 0;
for (let index = 0; index < 200; index += 1) {
  const target = questions[index % questions.length];
  const direction = index % 2 === 0 ? "spanish-to-english" : "english-to-spanish";
  const choices = selectWeightedDistractors(vocabulary, target, direction, 3, random);
  questionDistractorCount += choices.filter(
    (choice) => vocabularyById.get(choice.vocabularyId).partOfSpeech === "question",
  ).length;
}
const questionsPerQuestion = questionDistractorCount / 200;
assert.ok(
  questionsPerQuestion >= 1.8 && questionsPerQuestion <= 2.8,
  `${questionsPerQuestion} question distractors per question target`,
);

const verbos = vocabulary.filter((entry) => entry.distractorTraits?.includes("verbo"));
const verbosFalsos = vocabulary.filter(
  (entry) => entry.distractorTraits?.includes("verbo-falso"),
);
let falsosForVerbos = 0;
let verbosForFalsos = 0;
for (let index = 0; index < 500; index += 1) {
  const direction = index % 2 === 0 ? "spanish-to-english" : "english-to-spanish";
  const verboChoices = selectWeightedDistractors(
    vocabulary,
    verbos[index % verbos.length],
    direction,
    3,
    random,
  );
  assert.ok(verboChoices.every((choice) => (
    vocabularyById.get(choice.vocabularyId).distractorTraits?.some(
      (trait) => trait === "verbo" || trait === "verbo-falso",
    ) || (
      verbos[index % verbos.length].lexicalFamily
      && vocabularyById.get(choice.vocabularyId).lexicalFamily
        === verbos[index % verbos.length].lexicalFamily
    )
  )));
  falsosForVerbos += verboChoices.filter((choice) => (
    vocabularyById.get(choice.vocabularyId).distractorTraits?.includes("verbo-falso")
  )).length;

  const falsoChoices = selectWeightedDistractors(
    vocabulary,
    verbosFalsos[index % verbosFalsos.length],
    direction,
    3,
    random,
  );
  verbosForFalsos += falsoChoices.filter((choice) => (
    vocabularyById.get(choice.vocabularyId).distractorTraits?.includes("verbo")
  )).length;
}
const falsosPerVerbo = falsosForVerbos / 500;
const verbosPerFalso = verbosForFalsos / 500;
assert.ok(falsosPerVerbo >= 0.3 && falsosPerVerbo <= 0.8, `${falsosPerVerbo} falsos`);
assert.ok(verbosPerFalso >= 0.7 && verbosPerFalso <= 1.3, `${verbosPerFalso} verbos`);

const familyVerbos = verbos.filter((target) => (
  target.lexicalFamily
  && vocabulary.some((candidate) => (
    candidate.id !== target.id
    && candidate.lexicalFamily === target.lexicalFamily
    && !candidate.distractorTraits?.includes("verbo")
  ))
));
let lexicalFamilyChoices = 0;
for (let index = 0; index < 500; index += 1) {
  const target = familyVerbos[index % familyVerbos.length];
  const direction = index % 2 === 0 ? "spanish-to-english" : "english-to-spanish";
  const choices = selectWeightedDistractors(vocabulary, target, direction, 3, random);
  lexicalFamilyChoices += choices.filter((choice) => (
    vocabularyById.get(choice.vocabularyId).lexicalFamily === target.lexicalFamily
  )).length;
}
const lexicalFamilyPerEligibleVerbo = lexicalFamilyChoices / 500;
assert.ok(
  lexicalFamilyPerEligibleVerbo >= 0.3 && lexicalFamilyPerEligibleVerbo <= 0.8,
  `${lexicalFamilyPerEligibleVerbo} lexical-family choices`,
);

const directionAverages = Object.fromEntries(
  Object.entries(baselineByDirection).map(([direction, result]) => [
    direction,
    result.baseline / result.questions,
  ]),
);
const overallAverage = Object.values(baselineByDirection)
  .reduce((sum, result) => sum + result.baseline, 0) / questionCount;

assert.ok(overallAverage >= 0.4 && overallAverage <= 0.6, `${overallAverage} baseline choices`);
for (const [direction, average] of Object.entries(directionAverages)) {
  assert.ok(average >= 0.35 && average <= 0.65, `${direction}: ${average} baseline choices`);
}

console.log(
  `Distractor calibration: ${overallAverage.toFixed(3)} baseline choices; `
  + `ES→EN ${directionAverages["spanish-to-english"].toFixed(3)}, `
  + `EN→ES ${directionAverages["english-to-spanish"].toFixed(3)}.`,
);
console.log(`${questionsPerQuestion.toFixed(3)} question distractors per question target.`);
console.log(
  `${falsosPerVerbo.toFixed(3)} verbos-falsos per verbo; `
  + `${verbosPerFalso.toFixed(3)} verbos per verbo-falso.`,
);
console.log(
  `${lexicalFamilyPerEligibleVerbo.toFixed(3)} lexical-family distractors `
  + "per eligible verbo.",
);
