import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildQuestionForAnswer, DIRECTIONS } from "../src/questions.js";
import { cognateTransparencyScore } from "../src/distractors.js";

const officialVocabulary = JSON.parse(
  await readFile(new URL("../assets/vocabulary-official-v1.json", import.meta.url), "utf8"),
);
const metadata = JSON.parse(
  await readFile(new URL("../assets/vocabulary-official-v1.meta.json", import.meta.url), "utf8"),
);

assert.equal(officialVocabulary.length, 1523);
assert.equal(metadata.entryCount, officialVocabulary.length);
assert.equal(metadata.applicationStatus, "active-official-vocabulary");
assert.equal(new Set(officialVocabulary.map((entry) => entry.id)).size, officialVocabulary.length);
assert.equal(
  officialVocabulary.filter((entry) => entry.partOfSpeech === "unknown").length,
  0,
  "official vocabulary should not contain unknown parts of speech",
);
assert.equal(metadata.transformation.unknownPartOfSpeechCount, 0);
assert.equal(officialVocabulary.filter((entry) => entry.partOfSpeech === "expression").length, 0);
assert.equal(officialVocabulary.filter((entry) => entry.partOfSpeech === "question").length, 29);
assert.equal(officialVocabulary.filter((entry) => entry.partOfSpeech === "phrase").length, 73);
assert.equal(officialVocabulary.filter((entry) => entry.partOfSpeech === "proper noun").length, 28);
assert.equal(officialVocabulary.filter((entry) => entry.partOfSpeech === "number").length, 31);
assert.equal(officialVocabulary.filter((entry) => entry.partOfSpeech === "conjunction").length, 10);
assert.ok(
  officialVocabulary
    .filter((entry) => /[¿?]/.test(entry.spanish))
    .every((entry) => entry.partOfSpeech === "question"),
);
assert.equal(
  metadata.transformation.semanticTagging.taggedEntryCount,
  officialVocabulary.filter((entry) => entry.semanticTags.length > 0).length,
);
assert.equal(
  metadata.transformation.semanticTagging.untaggedEntryCount,
  officialVocabulary.filter((entry) => entry.semanticTags.length === 0).length,
);
assert.ok(
  officialVocabulary.filter((entry) => entry.semanticTags.length > 0).length
    === officialVocabulary.length,
);
assert.ok(officialVocabulary.every((entry) => Array.isArray(entry.semanticTags)));
const transparentCognates = officialVocabulary.filter((entry) => (
  entry.partOfSpeech !== "proper noun" && cognateTransparencyScore(entry) >= 0.63
));
assert.ok(
  transparentCognates.length >= 280 && transparentCognates.length <= 320,
  `${transparentCognates.length} transparent cognates`,
);

const verbos = officialVocabulary.filter((entry) => entry.distractorTraits?.includes("verbo"));
const verbosFalsos = officialVocabulary.filter(
  (entry) => entry.distractorTraits?.includes("verbo-falso"),
);
assert.equal(verbos.length, 179);
assert.deepEqual(
  verbosFalsos.map((entry) => entry.lemma).sort(),
  ["azúcar", "calamar", "celular", "deber", "lugar", "mujer", "porvenir", "suéter", "titular"],
);
assert.equal(metadata.transformation.distractorTraits.verboCount, verbos.length);
assert.equal(metadata.transformation.distractorTraits.verboFalsoCount, verbosFalsos.length);
const lexicalFamilyEntries = officialVocabulary.filter((entry) => entry.lexicalFamily);
assert.equal(metadata.transformation.lexicalFamilies.familyCount, 24);
assert.equal(metadata.transformation.lexicalFamilies.taggedEntryCount, lexicalFamilyEntries.length);
assert.equal(lexicalFamilyEntries.length, 53);
assert.equal(
  officialVocabulary.find((entry) => entry.lemma === "invitar").lexicalFamily,
  officialVocabulary.find((entry) => entry.lemma === "invitado").lexicalFamily,
);
assert.equal(
  new Set(officialVocabulary.map((entry) => entry.spanish.toLocaleLowerCase("es"))).size,
  officialVocabulary.length,
);

assert.equal(officialVocabulary.filter((entry) => entry.year === 1).length, 998);
assert.equal(officialVocabulary.filter((entry) => entry.year === 2).length, 525);
assert.equal(officialVocabulary.filter((entry) => entry.years?.includes(2)).length, 544);
assert.deepEqual(metadata.years.map((year) => year.label), ["Year 1", "Year 2"]);
assert.equal(metadata.years.find((year) => year.id === 1).entryCount, 998);
assert.equal(metadata.years.find((year) => year.id === 2).newEntryCount, 525);
assert.equal(metadata.years.find((year) => year.id === 2).repeatedYear1EntryCount, 19);

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
  assert.ok(Number.isInteger(entry.year));
  assert.ok(Array.isArray(entry.years) && entry.years.includes(entry.year));
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
assert.equal(officialVocabulary.find((entry) => entry.spanish === "Bogotá").partOfSpeech, "proper noun");
assert.equal(officialVocabulary.find((entry) => entry.spanish === "ellos son").partOfSpeech, "conjugated verb");

const jugo = officialVocabulary.find((entry) => entry.spanish === "el jugo (de fruta)");
const jugoQuestion = buildQuestionForAnswer(
  officialVocabulary,
  jugo,
  DIRECTIONS.SPANISH_TO_ENGLISH,
);
assert.equal(jugo.spanish, "el jugo (de fruta)");
assert.equal(jugoQuestion.prompt, "jugo");
assert.equal(jugoQuestion.teachingSpanish, "el jugo (de fruta)");
assert.equal(jugoQuestion.teachingEnglish, "(fruit) juice");
assert.equal(jugoQuestion.hasTeachingVariant, true);

const correr = officialVocabulary.find((entry) => entry.spanish === "correr");
const correrQuestion = buildQuestionForAnswer(
  officialVocabulary,
  correr,
  DIRECTIONS.SPANISH_TO_ENGLISH,
);
assert.equal(correrQuestion.hasTeachingVariant, false);

const precio = officialVocabulary.find((entry) => entry.lemma === "precio (fijo)");
const precioQuestion = buildQuestionForAnswer(
  officialVocabulary,
  precio,
  DIRECTIONS.SPANISH_TO_ENGLISH,
);
assert.equal(precioQuestion.prompt, "precio");
assert.equal(precioQuestion.correctAnswer, "price");

const salirCon = officialVocabulary.find((entry) => entry.spanish === "salir con");
const salirSpanishToEnglish = buildQuestionForAnswer(
  officialVocabulary,
  salirCon,
  DIRECTIONS.SPANISH_TO_ENGLISH,
);
const salirEnglishToSpanish = buildQuestionForAnswer(
  officialVocabulary,
  salirCon,
  DIRECTIONS.ENGLISH_TO_SPANISH,
);
assert.equal(salirSpanishToEnglish.correctAnswer, "to go out with");
assert.equal(salirEnglishToSpanish.prompt, "to go out (with)");

const desdeHace = officialVocabulary.find((entry) => entry.spanish === "desde hace");
const desdeHaceSpanishToEnglish = buildQuestionForAnswer(
  officialVocabulary,
  desdeHace,
  DIRECTIONS.SPANISH_TO_ENGLISH,
);
const desdeHaceEnglishToSpanish = buildQuestionForAnswer(
  officialVocabulary,
  desdeHace,
  DIRECTIONS.ENGLISH_TO_SPANISH,
);
assert.equal(desdeHaceSpanishToEnglish.correctAnswer, "for a period of time");
assert.equal(desdeHaceEnglishToSpanish.prompt, "for (a period of time)");

const tocar = officialVocabulary.find((entry) => entry.spanish === "tocar un instrumento musical");
const tocarQuestion = buildQuestionForAnswer(
  officialVocabulary,
  tocar,
  DIRECTIONS.SPANISH_TO_ENGLISH,
);
assert.equal(tocar.year, 2);
assert.equal(tocarQuestion.correctAnswer, "to play a musical instrument");
assert.equal(tocarQuestion.teachingEnglish, "to touch; to play a musical instrument");
assert.equal(tocarQuestion.hasTeachingVariant, true);

const enCaso = officialVocabulary.find((entry) => entry.spanish === "en caso de que");
const enCasoQuestion = buildQuestionForAnswer(
  officialVocabulary,
  enCaso,
  DIRECTIONS.SPANISH_TO_ENGLISH,
);
assert.equal(enCasoQuestion.correctAnswer, "in case");
assert.equal(enCasoQuestion.teachingEnglish, "in case that");

const estacion = officialVocabulary.find((entry) => entry.spanish === "la estación");
assert.deepEqual(estacion.years, [1, 2]);
assert.ok(estacion.senses.includes("season"));
assert.ok(estacion.senses.includes("station"));

console.log("Validated 1,523 entries in the official curriculum vocabulary.");
