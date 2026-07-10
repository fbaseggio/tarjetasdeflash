import { buildQuestionForAnswer, DIRECTIONS, shuffle } from "./questions.js?v=0.24.0";
import { TIER_ORDER } from "./tiers.js?v=0.24.0";

export const ASSESSMENT_TIERS = Object.freeze({
  FOUNDATION: "foundation",
  EVERYDAY: "everyday",
  EXPANDING1: "expanding1",
  EXPANDING2: "expanding2",
});

export const ASSESSMENT_ANCHORS = Object.freeze({
  foundation: Object.freeze([
    "cuaderno", "libro", "escuela", "mochila", "hombre", "mujer", "mapa", "palabra",
    "cama", "ahora", "con", "porque", "computadora", "silla", "tarea", "padre",
    "día", "diccionario", "número", "semana", "país", "bandera", "arte", "historia",
  ]),
  everyday: Object.freeze([
    "azul", "fácil", "importante", "tener", "verde", "oír", "repetir", "traer",
    "ver", "volver", "aeropuerto", "hotel", "playa", "pasaporte", "feliz", "llave",
    "limpio", "triste", "ayudar", "camisa", "barato", "bueno", "cambiar", "anoche",
  ]),
  expanding1: Object.freeze([
    "acordarse", "acostarse", "despertarse", "durante", "gritar", "levantarse",
    "sentirse", "vestirse", "aceite", "arroz", "carne", "cebolla", "ensalada",
    "escoger", "leche", "manzana", "azúcar", "camarero", "siempre", "toalla",
    "jabón", "espejo", "preocuparse", "probarse",
  ]),
  expanding2: Object.freeze([
    "boca", "brazo", "cabeza", "corazón", "cuello", "cuerpo", "ojo", "pierna",
    "dolor", "farmacia", "hospital", "medicamento", "salud", "síntoma",
    "caerse", "estornudar", "olvidar", "recetar", "a menudo", "despacio",
    "cargador", "teléfono celular", "sitio web", "descargar",
  ]),
});

const CORE_PER_TIER = 4;
const CONFIRMATION_COUNT = 6;
const TOTAL_QUESTIONS = CORE_PER_TIER * TIER_ORDER.length + CONFIRMATION_COUNT;

function isSolid(score) {
  return score.total > 0 && score.correct / score.total >= 0.7;
}

function balancedDirections(count, random) {
  return shuffle(
    Array.from({ length: count }, (_, index) => (
      index % 2 === 0 ? DIRECTIONS.SPANISH_TO_ENGLISH : DIRECTIONS.ENGLISH_TO_SPANISH
    )),
    random,
  );
}

function vocabularyByLemma(vocabulary) {
  return new Map(vocabulary.map((entry) => [entry.lemma ?? entry.spanish, entry]));
}

function selectAnchors(vocabularyMap, tier, count, excludedIds, random) {
  const candidates = ASSESSMENT_ANCHORS[tier]
    .map((spanish) => vocabularyMap.get(spanish))
    .filter((entry) => entry && entry.tier === tier && !excludedIds.has(entry.id));

  if (candidates.length < count) {
    throw new Error(`The ${tier} assessment anchor pool is incomplete.`);
  }

  return shuffle(candidates, random).slice(0, count);
}

function buildItems(vocabulary, entries, tier, random) {
  const directions = balancedDirections(entries.length, random);
  return entries.map((entry, index) => Object.freeze({
    tier,
    question: buildQuestionForAnswer(vocabulary, entry, directions[index], random),
  }));
}

function emptyScores() {
  return Object.fromEntries(TIER_ORDER.map((tier) => [tier, { correct: 0, total: 0 }]));
}

function chooseConfirmationTier(scores) {
  return TIER_ORDER.find((tier) => !isSolid(scores[tier])) ?? ASSESSMENT_TIERS.EXPANDING2;
}

function calculatePlacement(scores) {
  const frontier = TIER_ORDER.find((tier) => !isSolid(scores[tier]));
  if (frontier) {
    const frontierIndex = TIER_ORDER.indexOf(frontier);
    return {
      knownThrough: frontierIndex > 0 ? TIER_ORDER[frontierIndex - 1] : null,
      learningFrontier: frontier,
    };
  }
  return {
    knownThrough: ASSESSMENT_TIERS.EXPANDING2,
    learningFrontier: ASSESSMENT_TIERS.EXPANDING2,
  };
}

export function createAssessmentSession(vocabulary, random = Math.random) {
  if (!Array.isArray(vocabulary) || vocabulary.length < TOTAL_QUESTIONS) {
    throw new Error("The assessment requires a populated tiered vocabulary.");
  }

  const byLemma = vocabularyByLemma(vocabulary);
  const usedIds = new Set();
  const coreItems = [];

  for (const tier of TIER_ORDER) {
    const entries = selectAnchors(byLemma, tier, CORE_PER_TIER, usedIds, random);
    entries.forEach((entry) => usedIds.add(entry.id));
    coreItems.push(...buildItems(vocabulary, entries, tier, random));
  }

  const items = shuffle(coreItems, random);
  const scores = emptyScores();
  const attempts = [];
  let index = 0;
  let phase = "core";
  let confirmationTier = null;
  let result = null;

  function currentItem() {
    return items[index] ?? null;
  }

  function getState() {
    const item = currentItem();
    return Object.freeze({
      phase,
      question: item?.question ?? null,
      tier: item?.tier ?? null,
      direction: item?.question.direction ?? null,
      position: phase === "complete" ? TOTAL_QUESTIONS : index + 1,
      totalQuestions: TOTAL_QUESTIONS,
      confirmationTier,
    });
  }

  function finish() {
    const placement = calculatePlacement(scores);
    const knownIndex = TIER_ORDER.indexOf(placement.knownThrough);
    result = Object.freeze({
      ...placement,
      confidence: "low",
      assessedCount: attempts.length,
      presumedKnownTiers: Object.freeze(knownIndex >= 0 ? TIER_ORDER.slice(0, knownIndex + 1) : []),
      confirmationTier,
      scores: Object.freeze(Object.fromEntries(
        Object.entries(scores).map(([tier, score]) => [tier, Object.freeze({ ...score })]),
      )),
      attempts: Object.freeze([...attempts]),
    });
    phase = "complete";
  }

  function submitAnswer(selectedAnswer) {
    const item = currentItem();
    if (!item || phase === "complete") {
      throw new Error("The assessment is already complete.");
    }
    if (!item.question.choices.includes(selectedAnswer)) {
      throw new Error("The selected answer is not one of this question's choices.");
    }

    const correct = selectedAnswer === item.question.correctAnswer;
    scores[item.tier].total += 1;
    scores[item.tier].correct += correct ? 1 : 0;
    attempts.push(Object.freeze({
      vocabularyId: item.question.vocabularyId,
      tier: item.tier,
      direction: item.question.direction,
      selectedAnswer,
      correctAnswer: item.question.correctAnswer,
      correct,
    }));
    index += 1;

    if (phase === "core" && index === coreItems.length) {
      confirmationTier = chooseConfirmationTier(scores);
      const entries = selectAnchors(
        byLemma,
        confirmationTier,
        CONFIRMATION_COUNT,
        usedIds,
        random,
      );
      entries.forEach((entry) => usedIds.add(entry.id));
      items.push(...buildItems(vocabulary, entries, confirmationTier, random));
      phase = "confirmation";
    } else if (index === TOTAL_QUESTIONS) {
      finish();
    }

    return getState();
  }

  function getResult() {
    return result;
  }

  return Object.freeze({ getState, submitAnswer, getResult });
}
