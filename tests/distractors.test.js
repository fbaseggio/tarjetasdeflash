import assert from "node:assert/strict";
import {
  cognateTransparencyScore,
  questionFieldText,
  scoreDistractorCandidate,
  selectWeightedDistractors,
  textSimilarity,
} from "../src/distractors.js";
import { FALSE_COGNATE_RELATIONS } from "../src/distractor-relations.js";

const target = {
  id: "rojo",
  spanish: "rojo",
  english: "red",
  lemma: "rojo",
  senses: ["red"],
  partOfSpeech: "adjective",
  tier: "foundation",
  chapter: 1,
  semanticTags: ["description", "description:color"],
};
const related = {
  id: "verde",
  spanish: "verde",
  english: "green",
  lemma: "verde",
  senses: ["green"],
  partOfSpeech: "adjective",
  tier: "foundation",
  chapter: 1,
  semanticTags: ["description", "description:color"],
};
const baseline = {
  id: "biblioteca",
  spanish: "la biblioteca",
  english: "library",
  lemma: "biblioteca",
  senses: ["library"],
  partOfSpeech: "noun",
  tier: "expanding1",
  chapter: 8,
};
const equivalent = {
  id: "colorado",
  spanish: "colorado",
  english: "reddish",
  lemma: "colorado",
  senses: ["red"],
  partOfSpeech: "adjective",
  tier: "everyday",
  chapter: 4,
};

const relatedScore = scoreDistractorCandidate(target, related, "spanish-to-english");
const baselineScore = scoreDistractorCandidate(target, baseline, "spanish-to-english");
const equivalentScore = scoreDistractorCandidate(target, equivalent, "spanish-to-english");

assert.equal(relatedScore.eligible, true);
assert.equal(relatedScore.qualified, true);
assert.ok(relatedScore.reasons.includes("same-part-of-speech"));
assert.ok(relatedScore.reasons.includes("same-broad-semantic-tag"));
assert.equal(baselineScore.eligible, false);
assert.equal(baselineScore.weight, 0);
assert.equal(equivalentScore.eligible, false);
assert.equal(equivalentScore.weight, 0);

const question = {
  id: "question",
  spanish: "¿Cómo estás?",
  english: "How are you?",
  partOfSpeech: "question",
};
const otherQuestion = {
  id: "other-question",
  spanish: "¿Qué tal?",
  english: "How is it going?",
  partOfSpeech: "question",
};
assert.equal(
  scoreDistractorCandidate(target, otherQuestion, "spanish-to-english").eligible,
  false,
);
const questionScore = scoreDistractorCandidate(
  question,
  otherQuestion,
  "spanish-to-english",
);
assert.equal(questionScore.eligible, true);
assert.ok(questionScore.reasons.includes("both-questions"));
assert.ok(questionScore.weight >= 60);

const properNoun = {
  id: "madrid",
  spanish: "Madrid",
  english: "Madrid",
  partOfSpeech: "proper noun",
  tier: "foundation",
  chapter: 1,
  semanticTags: ["description", "description:color"],
};
const otherProperNoun = {
  id: "lima",
  spanish: "Lima",
  english: "Lima",
  partOfSpeech: "proper noun",
  tier: "foundation",
  chapter: 1,
  semanticTags: ["place", "place:geography"],
};
const properForOrdinaryScore = scoreDistractorCandidate(
  target,
  properNoun,
  "spanish-to-english",
);
assert.equal(properForOrdinaryScore.eligible, false);
assert.equal(properForOrdinaryScore.weight, 0);
assert.deepEqual(properForOrdinaryScore.reasons, []);

const properForProperScore = scoreDistractorCandidate(
  properNoun,
  otherProperNoun,
  "spanish-to-english",
);
assert.equal(properForProperScore.eligible, true);
assert.ok(properForProperScore.reasons.includes("both-proper-nouns"));
assert.ok(properForProperScore.weight >= 8);

assert.ok(textSimilarity("casa", "caza") >= 0.7);
const transparentCognate = {
  id: "restaurante",
  spanish: "el restaurante",
  english: "restaurant",
  lemma: "restaurante",
  senses: ["restaurant"],
  partOfSpeech: "noun",
  semanticTags: ["place", "place:building"],
};
const placeTarget = {
  id: "hotel",
  spanish: "el hotel",
  english: "hotel",
  lemma: "hotel",
  senses: ["hotel"],
  partOfSpeech: "noun",
  semanticTags: ["place", "place:building"],
};
assert.ok(cognateTransparencyScore(transparentCognate) >= 0.8);
assert.equal(cognateTransparencyScore({
  spanish: "el profesor",
  english: "teacher",
  lemma: "profesor",
  senses: ["teacher"],
}), 0.85);
const transparentEnglishToSpanish = scoreDistractorCandidate(
  placeTarget,
  transparentCognate,
  "english-to-spanish",
);
const transparentSpanishToEnglish = scoreDistractorCandidate(
  placeTarget,
  transparentCognate,
  "spanish-to-english",
);
assert.ok(transparentEnglishToSpanish.reasons.includes("strong-transparent-cognate"));
assert.ok(transparentEnglishToSpanish.weight < transparentSpanishToEnglish.weight);
const falseCognateOverride = scoreDistractorCandidate(
  placeTarget,
  transparentCognate,
  "english-to-spanish",
  { falseCognateRelations: new Set(["hotel>restaurante:english-to-spanish"]) },
);
assert.ok(falseCognateOverride.reasons.includes("false-cognate"));
assert.ok(!falseCognateOverride.reasons.includes("strong-transparent-cognate"));
assert.ok(
  FALSE_COGNATE_RELATIONS.has(
    "g-libreria-0ntdy4c>g-biblioteca-0oo3f96:spanish-to-english",
  ),
);

const vocabulary = [
  target,
  related,
  baseline,
  equivalent,
  {
    id: "amarillo",
    spanish: "amarillo",
    english: "yellow",
    lemma: "amarillo",
    senses: ["yellow"],
    partOfSpeech: "adjective",
    tier: "foundation",
    chapter: 1,
    semanticTags: ["description", "description:color"],
  },
  {
    id: "azul",
    spanish: "azul",
    english: "blue",
    lemma: "azul",
    senses: ["blue"],
    partOfSpeech: "adjective",
    tier: "expanding1",
    chapter: 8,
    semanticTags: [],
  },
  {
    id: "correr",
    spanish: "correr",
    english: "to run",
    lemma: "correr",
    senses: ["to run"],
    partOfSpeech: "verb",
    tier: "everyday",
    chapter: 5,
  },
];

const selected = selectWeightedDistractors(
  vocabulary,
  target,
  "spanish-to-english",
  3,
  (() => {
    const values = [0.1, 0.999, 0.4, 0.4, 0.4, 0.4];
    return () => values.shift() ?? 0.4;
  })(),
);
assert.equal(selected.length, 3);
assert.equal(new Set(selected.map((choice) => choice.answer)).size, 3);
assert.ok(selected.every((choice) => choice.vocabularyId !== equivalent.id));
assert.equal(selected.filter((choice) => choice.selectionMode === "format-fallback").length, 1);
assert.equal(selected.filter((choice) => choice.selectionMode === "quality").length, 2);

const familyVerb = {
  id: "invitar",
  spanish: "invitar",
  english: "to invite",
  lemma: "invitar",
  partOfSpeech: "verb",
  distractorTraits: ["verbo"],
  lexicalFamily: "invitation",
};
const familyNoun = {
  id: "invitado",
  spanish: "el/la invitado/a",
  english: "guest",
  lemma: "invitado",
  partOfSpeech: "noun",
  lexicalFamily: "invitation",
};
const familyScore = scoreDistractorCandidate(
  familyVerb,
  familyNoun,
  "english-to-spanish",
);
assert.equal(familyScore.eligible, false);
assert.equal(
  questionFieldText(familyNoun, "spanish", {
    target: familyVerb,
    direction: "english-to-spanish",
    isCandidate: true,
  }),
  "invitado",
);
assert.equal(
  questionFieldText(
    {
      spanish: "el calamar",
      lemma: "calamar",
      distractorTraits: ["verbo-falso"],
    },
    "spanish",
  ),
  "calamar",
);
assert.equal(
  questionFieldText(
    { spanish: "el jugo (de fruta)", partOfSpeech: "noun" },
    "spanish",
  ),
  "jugo",
);
assert.equal(
  questionFieldText(
    { english: "(fixed; set) price", partOfSpeech: "noun" },
    "english",
  ),
  "price",
);
assert.equal(
  questionFieldText(
    { spanish: "Adiós.", partOfSpeech: "phrase" },
    "spanish",
  ),
  "adiós",
);
assert.equal(
  questionFieldText(
    { spanish: "¿Cómo estás?", partOfSpeech: "question" },
    "spanish",
  ),
  "¿Cómo estás?",
);
assert.equal(
  questionFieldText(
    { spanish: "sacar/tomar fotos", partOfSpeech: "verb" },
    "spanish",
  ),
  "sacar fotos",
);
assert.equal(
  questionFieldText(
    { spanish: "el año/los años", partOfSpeech: "noun" },
    "spanish",
  ),
  "año",
);
assert.equal(
  questionFieldText(
    { english: "talk/reality show", partOfSpeech: "noun" },
    "english",
  ),
  "talk show",
);
assert.equal(
  questionFieldText(
    { english: "good/bad time", partOfSpeech: "phrase" },
    "english",
  ),
  "good time",
);
assert.equal(
  questionFieldText(
    { spanish: "¿cuánto(s)/a(s)?", partOfSpeech: "question" },
    "spanish",
  ),
  "¿cuánto?",
);

console.log("Quality gate, compact quiz text, and weighted distractor checks passed.");
