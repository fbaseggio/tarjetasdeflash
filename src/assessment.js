import { buildQuestionForAnswer, DIRECTIONS, shuffle } from "./questions.js";

export const ASSESSMENT_TIERS = Object.freeze({
  FOUNDATION: "foundation",
  EVERYDAY: "everyday",
  EXPANDING: "expanding",
});

export const ASSESSMENT_ANCHORS = Object.freeze({
  foundation: Object.freeze([
    "casa", "agua", "puerta", "escuela", "calle", "pregunta", "verdad", "dormir",
    "recordar", "escuchar", "buscar", "llegar", "feliz", "grande", "pequeño", "leer",
    "escribir", "comer", "hablar", "tiempo", "lluvia", "familia", "trabajo", "ciudad",
  ]),
  everyday: Object.freeze([
    "noticia", "cerrar", "construir", "crecer", "hambre", "consejo", "cárcel",
    "peligroso", "esconder", "antiguo", "maravilloso", "fuente", "decisión", "resolver",
    "entrada", "salida", "completo", "cantar", "preferir", "opinión", "viaje", "calmar",
    "doler", "sociedad", "cantidad", "agradecer",
  ]),
  expanding: Object.freeze([
    "universo", "instituto", "obligar", "respeto", "investigar", "propiedad", "discurso",
    "rechazar", "convencer", "población", "compromiso", "búsqueda", "estructura",
    "extranjero", "conocimiento", "ciudadano", "industria", "recurso", "actitud",
    "proponer", "archivo", "temporada", "tratamiento", "capacidad",
  ]),
});

const CORE_PER_TIER = 4;
const CONFIRMATION_COUNT = 6;
const TOTAL_QUESTIONS = CORE_PER_TIER * 3 + CONFIRMATION_COUNT;

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

function vocabularyBySpanish(vocabulary) {
  return new Map(vocabulary.map((entry) => [entry.spanish, entry]));
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
  return {
    foundation: { correct: 0, total: 0 },
    everyday: { correct: 0, total: 0 },
    expanding: { correct: 0, total: 0 },
  };
}

function chooseConfirmationTier(scores) {
  if (!isSolid(scores.foundation)) {
    return ASSESSMENT_TIERS.FOUNDATION;
  }
  if (!isSolid(scores.everyday)) {
    return ASSESSMENT_TIERS.EVERYDAY;
  }
  return ASSESSMENT_TIERS.EXPANDING;
}

function calculatePlacement(scores) {
  if (!isSolid(scores.foundation)) {
    return { knownThrough: null, learningFrontier: ASSESSMENT_TIERS.FOUNDATION };
  }
  if (!isSolid(scores.everyday)) {
    return {
      knownThrough: ASSESSMENT_TIERS.FOUNDATION,
      learningFrontier: ASSESSMENT_TIERS.EVERYDAY,
    };
  }
  if (!isSolid(scores.expanding)) {
    return {
      knownThrough: ASSESSMENT_TIERS.EVERYDAY,
      learningFrontier: ASSESSMENT_TIERS.EXPANDING,
    };
  }
  return {
    knownThrough: ASSESSMENT_TIERS.EXPANDING,
    learningFrontier: ASSESSMENT_TIERS.EXPANDING,
  };
}

export function createAssessmentSession(vocabulary, random = Math.random) {
  if (!Array.isArray(vocabulary) || vocabulary.length < 18) {
    throw new Error("The assessment requires a populated tiered vocabulary.");
  }

  const bySpanish = vocabularyBySpanish(vocabulary);
  const usedIds = new Set();
  const coreItems = [];

  for (const tier of Object.values(ASSESSMENT_TIERS)) {
    const entries = selectAnchors(bySpanish, tier, CORE_PER_TIER, usedIds, random);
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
    result = Object.freeze({
      ...placement,
      confidence: "low",
      assessedCount: attempts.length,
      presumedKnownTiers: Object.freeze([ASSESSMENT_TIERS.FOUNDATION]),
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
        bySpanish,
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
