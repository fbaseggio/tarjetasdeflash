import { readFile } from "node:fs/promises";
import {
  buildQuestionForAnswer,
  DIRECTIONS,
} from "../src/questions.js";
import { cognateTransparencyScore } from "../src/distractors.js";

const vocabulary = JSON.parse(
  await readFile(new URL("../assets/vocabulary-official-v1.json", import.meta.url), "utf8"),
);
const vocabularyById = new Map(vocabulary.map((entry) => [entry.id, entry]));
const requestedQuestions = Number.parseInt(process.argv[2] ?? "200", 10);
const requestedSamples = Number.parseInt(process.argv[3] ?? "40", 10);

if (!Number.isInteger(requestedQuestions) || requestedQuestions < 1) {
  throw new Error("Question count must be a positive integer.");
}
if (!Number.isInteger(requestedSamples) || requestedSamples < 0) {
  throw new Error("Sample count must be zero or greater.");
}

let seed = 0x20260708;
function random() {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 2 ** 32;
}

function shorten(value) {
  return value.length > 42 ? `${value.slice(0, 39)}…` : value;
}

const summary = {
  fallbackChoices: 0,
  fallbackQuestions: 0,
  broadSemanticChoices: 0,
  broadSemanticQuestions: 0,
  reasonCounts: {},
  shortenedPrompts: 0,
  shortenedAnswers: 0,
  selectedStrongCognates: 0,
  selectedModerateCognates: 0,
};
const samples = [];
const directions = [
  DIRECTIONS.SPANISH_TO_ENGLISH,
  DIRECTIONS.ENGLISH_TO_SPANISH,
];

for (let index = 0; index < requestedQuestions; index += 1) {
  const target = vocabulary[(index * 193) % vocabulary.length];
  const direction = directions[index % directions.length];
  const question = buildQuestionForAnswer(vocabulary, target, direction, random);
  const fallbackCount = question.distractors.filter(
    (choice) => choice.selectionMode === "format-fallback",
  ).length;
  const broadSemanticCount = question.distractors.filter(
    (choice) => choice.selectionMode === "broad-semantic",
  ).length;
  summary.fallbackChoices += fallbackCount;
  if (fallbackCount > 0) summary.fallbackQuestions += 1;
  summary.broadSemanticChoices += broadSemanticCount;
  if (broadSemanticCount > 0) summary.broadSemanticQuestions += 1;

  const promptField = direction === DIRECTIONS.SPANISH_TO_ENGLISH ? "spanish" : "english";
  const answerField = direction === DIRECTIONS.SPANISH_TO_ENGLISH ? "english" : "spanish";
  if (question.prompt !== target[promptField]) summary.shortenedPrompts += 1;
  if (question.correctAnswer !== target[answerField]) summary.shortenedAnswers += 1;

  for (const distractor of question.distractors) {
    if (distractor.reasons.includes("strong-transparent-cognate")) {
      summary.selectedStrongCognates += 1;
    }
    if (distractor.reasons.includes("moderate-transparent-cognate")) {
      summary.selectedModerateCognates += 1;
    }
    for (const reason of distractor.reasons) {
      summary.reasonCounts[reason] = (summary.reasonCounts[reason] ?? 0) + 1;
    }
  }

  if (samples.length < requestedSamples) {
    const arrow = direction === DIRECTIONS.SPANISH_TO_ENGLISH ? "ES→EN" : "EN→ES";
    const renderedDistractors = question.distractors.map((choice) => {
      const entry = vocabularyById.get(choice.vocabularyId);
      const marker = choice.selectionMode === "format-fallback" ? "fallback" : "quality";
      return `${choice.answer} {${entry.partOfSpeech}; ${marker}; ${choice.reasons.join(", ")}}`;
    });
    samples.push(
      `${index + 1}. ${arrow} **${shorten(question.prompt)}** → `
      + `${shorten(question.correctAnswer)}\n   - ${renderedDistractors.join("\n   - ")}`,
    );
  }
}

const totalChoices = requestedQuestions * 3;
console.log("# Distractor audit");
console.log("");
console.log(`- Questions: ${requestedQuestions}`);
console.log(
  `- Format fallback: ${summary.fallbackChoices}/${totalChoices} choices `
  + `across ${summary.fallbackQuestions}/${requestedQuestions} questions`,
);
console.log(
  `- Broad-semantic backoff: ${summary.broadSemanticChoices}/${totalChoices} choices `
  + `across ${summary.broadSemanticQuestions}/${requestedQuestions} questions`,
);
console.log(`- Shortened prompts: ${summary.shortenedPrompts}`);
console.log(`- Shortened correct answers: ${summary.shortenedAnswers}`);
const ordinaryVocabulary = vocabulary.filter((entry) => entry.partOfSpeech !== "proper noun");
const strongCognates = ordinaryVocabulary.filter(
  (entry) => cognateTransparencyScore(entry) >= 0.8,
).length;
const flaggedCognates = ordinaryVocabulary.filter(
  (entry) => cognateTransparencyScore(entry) >= 0.63,
).length;
console.log(`- Transparent-cognate vocabulary: ${strongCognates} strong; ${flaggedCognates} total`);
console.log(
  `- Selected transparent cognates: ${summary.selectedStrongCognates} strong; `
  + `${summary.selectedModerateCognates} moderate`,
);
console.log("- Most common affinity reasons:");
for (const [reason, count] of Object.entries(summary.reasonCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  - ${reason}: ${count}`);
}

if (samples.length > 0) {
  console.log("");
  console.log("## Sample questions");
  console.log("");
  console.log(samples.join("\n\n"));
}
