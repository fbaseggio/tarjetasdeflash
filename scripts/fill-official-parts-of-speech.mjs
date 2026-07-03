import { readFile, writeFile } from "node:fs/promises";

const vocabularyUrl = new URL("../assets/vocabulary-official-v1.json", import.meta.url);
const metadataUrl = new URL("../assets/vocabulary-official-v1.meta.json", import.meta.url);

const vocabulary = JSON.parse(await readFile(vocabularyUrl, "utf8"));
const metadata = JSON.parse(await readFile(metadataUrl, "utf8"));

const properNouns = new Set([
  "Canadá",
  "Cuba",
  "Ecuador",
  "España",
  "Estados Unidos",
  "Lima",
  "Madrid",
  "México",
  "Panamá",
  "Perú",
  "Puerto Rico",
  "República Dominicana",
  "San José",
  "San Juan",
  "San Salvador",
  "Santo Domingo",
  "Venezuela",
  "Washington, D.C.",
]);

const pronouns = new Set([
  "¿cuánto(s)/a(s)?",
  "¿cuántos/cuántas?",
  "¿de quién...?",
  "¿de quiénes...?",
]);

const adjectives = new Set(["mi", "su"]);
const adverbs = new Set(["de todas partes", "mañana"]);

const conjugatedVerbs = new Set([
  "Estudias…",
  "Estudio…",
  "(no) hay",
  "él es",
  "nosotras somos",
  "nosotros somos",
  "tú eres",
  "usted es",
  "ustedes son",
  "yo soy",
]);

const nounsWithoutArticles = new Set([
  "señor (Sr.); don",
  "señora (Sra.); doña",
]);

const verbsWithoutInfinitives = new Set(["tomando"]);
const laterExpressions = new Set(["¡hala!"]);

const verbExpressions = new Set([
  "escalar montañas",
  "escribir un mensaje electrónico",
  "escribir una carta",
  "ir de excursión",
  "leer el correo electrónico",
  "leer un periódico",
  "leer una revista",
  "practicar deportes",
]);

function inferPartOfSpeech(entry) {
  if (entry.partOfSpeech !== "unknown") return entry.partOfSpeech;
  if (/^\d+$/.test(entry.english)) return "number";
  if (properNouns.has(entry.spanish)) return "proper noun";
  if (pronouns.has(entry.spanish)) return "pronoun";
  if (adjectives.has(entry.spanish)) return "adjective";
  if (adverbs.has(entry.spanish)) return "adverb";
  if (conjugatedVerbs.has(entry.spanish)) return "conjugated verb";
  if (nounsWithoutArticles.has(entry.spanish)) return "noun";
  if (verbsWithoutInfinitives.has(entry.spanish)) return "verb";
  if (laterExpressions.has(entry.spanish)) return "expression";

  // Chapters 0–1 contain fixed classroom and social utterances.
  if (entry.chapter <= 1) return "expression";

  if (/^(el|la|los|las|el\/la)\b/i.test(entry.spanish)) return "noun";
  if (verbExpressions.has(entry.spanish)) return "verb expression";

  const firstWord = entry.spanish
    .replace(/^\W+/u, "")
    .split(/[\s(]/u)[0]
    .toLocaleLowerCase("es");
  if (/(ar|er|ir)$/.test(firstWord)) return "verb";

  if (
    entry.spanish.includes("/a") ||
    ["canadiense", "costarricense", "estadounidense", "joven, jóvenes"].includes(
      entry.spanish,
    )
  ) {
    return "adjective";
  }

  throw new Error(`Could not infer part of speech for ${entry.id}: ${entry.spanish}`);
}

let updatedCount = 0;
let reclassifiedFormCount = 0;
for (const entry of vocabulary) {
  const inferred = inferPartOfSpeech(entry);
  if (entry.partOfSpeech !== inferred) {
    entry.partOfSpeech = inferred;
    updatedCount += 1;
  }

  const isQuestion = /[¿?]/.test(entry.spanish);
  const structuralPartOfSpeech = isQuestion
    ? "question"
    : entry.partOfSpeech === "expression" ? "phrase" : entry.partOfSpeech;
  if (entry.partOfSpeech !== structuralPartOfSpeech) {
    entry.partOfSpeech = structuralPartOfSpeech;
    reclassifiedFormCount += 1;
  }
}

const unknownPartOfSpeechCount = vocabulary.filter(
  (entry) => entry.partOfSpeech === "unknown",
).length;

metadata.transformation.unknownPartOfSpeechCount = unknownPartOfSpeechCount;
metadata.transformation.inferredPartOfSpeechCount =
  (metadata.transformation.inferredPartOfSpeechCount ?? 0) + updatedCount;
metadata.transformation.reclassifiedQuestionOrPhraseCount = reclassifiedFormCount
  || metadata.transformation.reclassifiedQuestionOrPhraseCount
  || 0;
const inferenceNote =
  "Previously blank parts of speech were inferred from articles, infinitive forms, learner-facing glosses, and explicit review of introductory expressions.";
if (!metadata.notes.includes(inferenceNote)) metadata.notes.push(inferenceNote);
const formNote =
  "Learner-facing interrogatives use the question category; other former expressions use phrase so question distractors can be weighted independently.";
if (!metadata.notes.includes(formNote)) metadata.notes.push(formNote);

await writeFile(vocabularyUrl, `${JSON.stringify(vocabulary, null, 2)}\n`);
await writeFile(metadataUrl, `${JSON.stringify(metadata, null, 2)}\n`);

console.log(
  `Filled ${updatedCount} missing parts of speech, reclassified ${reclassifiedFormCount} questions or phrases; ${unknownPartOfSpeechCount} remain.`,
);
