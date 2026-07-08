import { readFile } from "node:fs/promises";
import {
  DEFAULT_DISTRACTOR_WEIGHTS,
  selectWeightedDistractors,
} from "../src/distractors.js";

const vocabulary = JSON.parse(
  await readFile(new URL("../assets/vocabulary-official-v1.json", import.meta.url), "utf8"),
);

const requestedQuestions = Number.parseInt(process.argv[2] ?? "6000", 10);
if (!Number.isInteger(requestedQuestions) || requestedQuestions < 1) {
  throw new Error("Question count must be a positive integer.");
}

let seed = 0x5eed1234;
function random() {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 2 ** 32;
}

const directions = ["spanish-to-english", "english-to-spanish"];
const summary = {
  questionCount: 0,
  distractorCount: 0,
  fallbackCount: 0,
  broadSemanticCount: 0,
  reasons: {},
  groups: {},
};

function recordGroup(key, details) {
  const group = summary.groups[key] ?? { questions: 0, fallback: 0 };
  group.questions += 1;
  group.fallback += details.filter(
    (choice) => choice.selectionMode === "format-fallback",
  ).length;
  summary.groups[key] = group;
}

for (let index = 0; index < requestedQuestions; index += 1) {
  const target = vocabulary[index % vocabulary.length];
  const direction = directions[index % directions.length];
  const details = selectWeightedDistractors(vocabulary, target, direction, 3, random);
  const fallback = details.filter(
    (choice) => choice.selectionMode === "format-fallback",
  ).length;
  const broadSemantic = details.filter(
    (choice) => choice.selectionMode === "broad-semantic",
  ).length;

  summary.questionCount += 1;
  summary.distractorCount += details.length;
  summary.fallbackCount += fallback;
  summary.broadSemanticCount += broadSemantic;
  recordGroup(`direction:${direction}`, details);
  recordGroup(`tier:${target.tier}`, details);
  recordGroup(`pos:${target.partOfSpeech}`, details);

  for (const choice of details) {
    for (const reason of choice.reasons) {
      summary.reasons[reason] = (summary.reasons[reason] ?? 0) + 1;
    }
  }
}

const average = summary.fallbackCount / summary.questionCount;
console.log(`Distractor simulation (${summary.questionCount.toLocaleString()} questions)`);
console.log(`Format fallback distractors: ${average.toFixed(3)} of 3`);
console.log(
  `Broad-semantic backoff distractors: `
  + `${(summary.broadSemanticCount / summary.questionCount).toFixed(3)} of 3`,
);
console.log("Weights:", DEFAULT_DISTRACTOR_WEIGHTS);
console.log("Reason frequency:");
for (const [reason, count] of Object.entries(summary.reasons).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${reason}: ${(count / summary.distractorCount * 100).toFixed(1)}%`);
}
console.log("Groups:");
for (const [key, group] of Object.entries(summary.groups).sort()) {
  console.log(`  ${key}: ${(group.fallback / group.questions).toFixed(3)} (${group.questions})`);
}
