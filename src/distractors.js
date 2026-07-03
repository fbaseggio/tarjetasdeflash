import { FALSE_COGNATE_RELATIONS } from "./distractor-relations.js?v=0.13.0";

export const DEFAULT_DISTRACTOR_WEIGHTS = Object.freeze({
  baseline: 1,
  baselineSlotProbability: 0.5,
  samePartOfSpeech: 1.5,
  sameTier: 1.15,
  sameChapter: 1.2,
  adjacentChapter: 1.05,
  sameBroadSemanticTag: 1.5,
  sameNarrowSemanticTag: 4,
  falseCognate: 5,
  similarSpelling: 2.5,
  similarSound: 2,
  similarAnswerForm: 1.03,
  learnerConfusion: 6,
  bothQuestions: 60,
  verboFalsoForVerbo: 8,
  verboForVerboFalso: 5,
  lexicalFamily: 12,
});

const similarityCache = new Map();

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function spanishComparisonForm(entry) {
  return normalizeText(entry.lemma ?? entry.spanish)
    .replace(/^(el|la|los|las)\s+/, "")
    .replace(/\b(el|la|los|las)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function spanishSoundForm(entry) {
  return spanishComparisonForm(entry)
    .replace(/gue/g, "ge")
    .replace(/gui/g, "gi")
    .replace(/qu/g, "k")
    .replace(/[bv]/g, "b")
    .replace(/ll|y/g, "y")
    .replace(/[z]/g, "s")
    .replace(/ce|ci/g, (value) => `s${value[1]}`)
    .replace(/ge|gi/g, (value) => `x${value[1]}`)
    .replace(/j/g, "x")
    .replace(/ch/g, "c")
    .replace(/h/g, "")
    .replace(/c|q/g, "k")
    .replace(/[^a-z0-9]/g, "");
}

function levenshteinDistance(left, right) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }

  return previous[right.length];
}

export function textSimilarity(left, right) {
  const cacheKey = left <= right ? `${left}\u0000${right}` : `${right}\u0000${left}`;
  if (similarityCache.has(cacheKey)) return similarityCache.get(cacheKey);

  const longest = Math.max(left.length, right.length);
  const similarity = longest === 0 ? 1 : 1 - levenshteinDistance(left, right) / longest;
  if (similarityCache.size >= 50_000) similarityCache.clear();
  similarityCache.set(cacheKey, similarity);
  return similarity;
}

function answerForm(value) {
  const normalized = normalizeText(value);
  const words = normalized ? normalized.split(/\s+/).length : 0;
  return {
    words,
    length: normalized.length,
    numeric: /^\d+$/.test(normalized),
  };
}

function haveSimilarAnswerForm(left, right) {
  const leftForm = answerForm(left);
  const rightForm = answerForm(right);
  if (leftForm.numeric || rightForm.numeric) return leftForm.numeric && rightForm.numeric;
  return (
    leftForm.words === rightForm.words
    && Math.abs(leftForm.length - rightForm.length) <= Math.max(3, leftForm.length * 0.35)
  );
}

function normalizedSenses(entry) {
  return new Set((entry.senses ?? [entry.english]).map(normalizeText).filter(Boolean));
}

function setsOverlap(left, right) {
  return [...left].some((value) => right.has(value));
}

function relationMatches(relations, targetId, candidateId, direction) {
  if (!relations) return false;
  const keys = [
    `${targetId}>${candidateId}:${direction}`,
    `${targetId}>${candidateId}:both`,
  ];
  return keys.some((key) => relations.has?.(key) || relations.includes?.(key));
}

function semanticTags(entry) {
  const explicit = entry.semanticTags ?? [];
  if (explicit.length > 0) return new Set(explicit);
  if (entry.category && !String(entry.category).startsWith("chapter-")) {
    return new Set([entry.category]);
  }
  return new Set();
}

function hasDistractorTrait(entry, trait) {
  return entry.distractorTraits?.includes(trait) ?? false;
}

function sameLexicalFamily(left, right) {
  return Boolean(left.lexicalFamily && left.lexicalFamily === right.lexicalFamily);
}

export function questionFieldText(
  entry,
  field,
  { target = null, direction = null, isCandidate = false } = {},
) {
  if (field !== "spanish") return entry[field];
  if (hasDistractorTrait(entry, "verbo-falso")) return entry.lemma;
  if (
    isCandidate
    && direction === "english-to-spanish"
    && target
    && hasDistractorTrait(target, "verbo")
    && entry.partOfSpeech === "noun"
    && sameLexicalFamily(target, entry)
  ) {
    return entry.spanish.replace(/^(el|la|los|las)(\/la)?\s+/i, "");
  }
  return entry[field];
}

export function scoreDistractorCandidate(
  target,
  candidate,
  direction,
  {
    answerField,
    promptField,
    weights = DEFAULT_DISTRACTOR_WEIGHTS,
    falseCognateRelations = FALSE_COGNATE_RELATIONS,
    learnerConfusionIds = null,
  } = {},
) {
  const resolvedAnswerField = answerField
    ?? (direction === "spanish-to-english" ? "english" : "spanish");
  const resolvedPromptField = promptField
    ?? (direction === "spanish-to-english" ? "spanish" : "english");
  const answerText = questionFieldText(candidate, resolvedAnswerField, {
    target,
    direction,
    isCandidate: true,
  });
  const correctText = questionFieldText(target, resolvedAnswerField, { direction });

  const sameLemma = target.lemma && candidate.lemma
    && normalizeText(target.lemma) === normalizeText(candidate.lemma);
  const overlappingSenses = setsOverlap(normalizedSenses(target), normalizedSenses(candidate));
  const targetIsQuestion = target.partOfSpeech === "question";
  const candidateIsQuestion = candidate.partOfSpeech === "question";
  const targetIsVerbo = hasDistractorTrait(target, "verbo");
  const targetIsVerboFalso = hasDistractorTrait(target, "verbo-falso");
  const candidateIsVerbo = hasDistractorTrait(candidate, "verbo");
  const candidateIsVerboFalso = hasDistractorTrait(candidate, "verbo-falso");
  const lexicalFamilyMatch = sameLexicalFamily(target, candidate);

  if (
    candidate.id === target.id
    || questionFieldText(candidate, resolvedPromptField, {
      target,
      direction,
      isCandidate: true,
    }) === questionFieldText(target, resolvedPromptField, { direction })
    || answerText === correctText
    || sameLemma
    || overlappingSenses
    || (candidateIsQuestion && !targetIsQuestion)
    || (targetIsVerbo && !candidateIsVerbo && !candidateIsVerboFalso && !lexicalFamilyMatch)
  ) {
    return Object.freeze({ eligible: false, weight: 0, reasons: Object.freeze([]), baseline: false });
  }

  let weight = weights.baseline;
  const reasons = [];
  const apply = (reason, multiplier) => {
    if (multiplier > 1) {
      weight *= multiplier;
      reasons.push(reason);
    }
  };

  if (target.partOfSpeech && target.partOfSpeech === candidate.partOfSpeech) {
    apply("same-part-of-speech", weights.samePartOfSpeech);
  }
  if (targetIsQuestion && candidateIsQuestion) {
    apply("both-questions", weights.bothQuestions);
  }
  if (targetIsVerbo && candidateIsVerboFalso) {
    apply("verbo-falso-for-verbo", weights.verboFalsoForVerbo);
  }
  if (targetIsVerboFalso && candidateIsVerbo) {
    apply("verbo-for-verbo-falso", weights.verboForVerboFalso);
  }
  if (lexicalFamilyMatch) {
    apply("lexical-family", weights.lexicalFamily);
  }
  if (target.tier && target.tier === candidate.tier) {
    apply("same-tier", weights.sameTier);
  }
  if (Number.isInteger(target.chapter) && Number.isInteger(candidate.chapter)) {
    const chapterDistance = Math.abs(target.chapter - candidate.chapter);
    if (chapterDistance === 0) apply("same-chapter", weights.sameChapter);
    else if (chapterDistance === 1) apply("adjacent-chapter", weights.adjacentChapter);
  }

  const targetSemanticTags = semanticTags(target);
  const candidateSemanticTags = semanticTags(candidate);
  const sharedSemanticTags = [...targetSemanticTags].filter(
    (tag) => candidateSemanticTags.has(tag),
  );
  if (sharedSemanticTags.some((tag) => !tag.includes(":"))) {
    apply("same-broad-semantic-tag", weights.sameBroadSemanticTag);
  }
  if (sharedSemanticTags.some((tag) => tag.includes(":"))) {
    apply("same-narrow-semantic-tag", weights.sameNarrowSemanticTag);
  }
  if (relationMatches(falseCognateRelations, target.id, candidate.id, direction)) {
    apply("false-cognate", weights.falseCognate);
  }

  const targetSpanish = spanishComparisonForm(target).replace(/\s/g, "");
  const candidateSpanish = spanishComparisonForm(candidate).replace(/\s/g, "");
  const spellingSimilarity = textSimilarity(targetSpanish, candidateSpanish);
  if (
    Math.min(targetSpanish.length, candidateSpanish.length) >= 3
    && spellingSimilarity >= 0.72
  ) {
    apply("similar-spelling", weights.similarSpelling);
  }

  const targetSound = spanishSoundForm(target);
  const candidateSound = spanishSoundForm(candidate);
  if (
    Math.min(targetSound.length, candidateSound.length) >= 3
    && textSimilarity(targetSound, candidateSound) >= 0.78
  ) {
    apply("similar-sound", weights.similarSound);
  }

  if (haveSimilarAnswerForm(correctText, answerText)) {
    apply("similar-answer-form", weights.similarAnswerForm);
  }
  if (learnerConfusionIds?.has(candidate.id)) {
    apply("learner-confusion", weights.learnerConfusion);
  }

  return Object.freeze({
    eligible: true,
    weight,
    reasons: Object.freeze(reasons),
    baseline: reasons.length === 0,
  });
}

function weightedIndex(candidates, random) {
  const totalWeight = candidates.reduce((sum, item) => sum + item.score.weight, 0);
  let threshold = random() * totalWeight;

  for (let index = 0; index < candidates.length; index += 1) {
    threshold -= candidates[index].score.weight;
    if (threshold < 0) return index;
  }

  return candidates.length - 1;
}

function uniformIndex(candidates, random) {
  return Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
}

export function selectWeightedDistractors(
  vocabulary,
  target,
  direction,
  count = 3,
  random = Math.random,
  options = {},
) {
  const isSpanishPrompt = direction === "spanish-to-english";
  const promptField = isSpanishPrompt ? "spanish" : "english";
  const answerField = isSpanishPrompt ? "english" : "spanish";
  const correctAnswer = questionFieldText(target, answerField, { direction });
  const seenAnswers = new Set([correctAnswer]);
  const candidatesByAnswer = new Map();

  for (const entry of vocabulary) {
    const answerText = questionFieldText(entry, answerField, {
      target,
      direction,
      isCandidate: true,
    });
    if (seenAnswers.has(answerText)) continue;

    const score = scoreDistractorCandidate(target, entry, direction, {
      ...options,
      answerField,
      promptField,
    });
    if (!score.eligible) continue;

    const existing = candidatesByAnswer.get(answerText);
    if (!existing || score.weight > existing.score.weight) {
      candidatesByAnswer.set(answerText, { entry, answerText, score });
    }
  }

  const candidates = [...candidatesByAnswer.values()];
  const selected = [];
  const baselineProbability = options.weights?.baselineSlotProbability
    ?? DEFAULT_DISTRACTOR_WEIGHTS.baselineSlotProbability;

  if (candidates.length > 0 && random() < baselineProbability) {
    const [choice] = candidates.splice(uniformIndex(candidates, random), 1);
    seenAnswers.add(choice.answerText);
    selected.push({ ...choice, selectionMode: "baseline" });
  }

  while (selected.length < count && candidates.length > 0) {
    const relatedCandidates = candidates.filter((candidate) => !candidate.score.baseline);
    const pool = relatedCandidates.length > 0 ? relatedCandidates : candidates;
    const poolIndex = relatedCandidates.length > 0
      ? weightedIndex(pool, random)
      : uniformIndex(pool, random);
    const choice = pool[poolIndex];
    const candidateIndex = candidates.indexOf(choice);
    candidates.splice(candidateIndex, 1);
    seenAnswers.add(choice.answerText);
    selected.push({
      ...choice,
      selectionMode: relatedCandidates.length > 0 ? "related" : "baseline-fallback",
    });
  }

  if (selected.length !== count) {
    throw new Error("Four distinct answer choices could not be generated.");
  }

  return Object.freeze(selected.map((choice) => Object.freeze({
    vocabularyId: choice.entry.id,
    answer: choice.answerText,
    weight: choice.score.weight,
    reasons: choice.score.reasons,
    baseline: choice.selectionMode !== "related",
    selectionMode: choice.selectionMode,
  })));
}
