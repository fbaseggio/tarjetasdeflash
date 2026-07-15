import { FALSE_COGNATE_RELATIONS } from "./distractor-relations.js?v=0.24.9";

export const DEFAULT_DISTRACTOR_WEIGHTS = Object.freeze({
  baseWeight: 1,
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
  bothProperNouns: 8,
  verboFalsoForVerbo: 8,
  verboForVerboFalso: 5,
  lexicalFamily: 12,
  strongTransparentCognatePenalty: 0.12,
  moderateTransparentCognatePenalty: 0.35,
});

const EDITORIAL_TRANSPARENT_COGNATES = new Set([
  "conductor",
  "futbol",
  "ingeniero",
  "periodista",
  "profesor",
  "profesora",
  "programador",
]);

export const COGNATE_TRANSPARENCY = Object.freeze({
  STRONG: "strong",
  MODERATE: "moderate",
  NONE: "none",
});

export const COGNATE_TRANSPARENCY_THRESHOLDS = Object.freeze({
  strong: 0.8,
  moderate: 0.63,
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
  const normalized = new Set();
  for (const sense of entry.senses ?? [entry.english]) {
    for (const variant of String(sense).split(/[;/]/)) {
      const value = normalizeText(variant);
      if (!value) continue;
      normalized.add(value);
      if (/^[a-z]+s$/.test(value)) normalized.add(value.slice(0, -1));
    }
  }
  return normalized;
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

function lowercaseInitial(value) {
  if (!value || /^I(?:\b|')/.test(value) || /^[A-Z]{2}(?:\b|$)/.test(value)) return value;
  return `${value[0].toLocaleLowerCase()}${value.slice(1)}`;
}

function firstTopLevelSemicolonSegment(value) {
  let depth = 0;
  let result = "";
  for (const character of String(value ?? "")) {
    if (character === "(") depth += 1;
    if (character === ")" && depth > 0) depth -= 1;
    if (character === ";" && depth === 0) break;
    result += character;
  }
  return result;
}

function firstTopLevelSentenceSegment(value) {
  const text = String(value ?? "");
  let depth = 0;
  let result = "";
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "(") depth += 1;
    if (character === ")" && depth > 0) depth -= 1;
    if (character === "." && depth === 0 && /\s/u.test(text[index + 1] ?? "")) break;
    result += character;
  }
  return result;
}

function removeParentheticalText(value) {
  let depth = 0;
  let result = "";
  for (const character of value) {
    if (character === "(") {
      depth += 1;
    } else if (character === ")" && depth > 0) {
      depth -= 1;
    } else if (depth === 0) {
      result += character;
    }
  }
  return result;
}

function shouldDropEnglishAnswerParenthetical(content) {
  const normalized = normalizeText(content);
  if (!normalized) return true;
  if (/^(form|fam|sing|adj)$/.test(normalized)) return true;
  if (/^(plural|all female group|in spain)$/.test(normalized)) return true;
  if (/^used to\b/.test(normalized)) return true;
  if (/^[eo]\s+(i|ie|ue)$/.test(normalized)) return true;
  if (/\binf\b/.test(normalized) || /\badj\b/.test(normalized)) return true;
  if (content.includes(";")) return true;

  return new Set([
    "garlic mayonnaise",
    "squid",
    "water",
    "round trip",
    "sun",
    "open air",
    "mineral",
    "pork",
    "fruit",
    "toasted",
    "fried",
    "main",
    "roast",
    "iced",
    "white red",
    "wedding",
    "chocolate",
    "caramel",
  ]).has(normalized);
}

function foldEnglishAnswerParentheticals(value) {
  let result = "";
  let index = 0;
  while (index < value.length) {
    const open = value.indexOf("(", index);
    if (open < 0) {
      result += value.slice(index);
      break;
    }

    result += value.slice(index, open);
    let depth = 1;
    let close = open + 1;
    while (close < value.length && depth > 0) {
      if (value[close] === "(") depth += 1;
      else if (value[close] === ")") depth -= 1;
      close += 1;
    }

    const content = value.slice(open + 1, close - 1).trim();
    if (!shouldDropEnglishAnswerParenthetical(content)) {
      result += ` ${content} `;
    }
    index = close;
  }
  return result
    .replace(/\s+([.,;:!?])/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSlashAlternative(value, originalToken) {
  let normalized = value
    .replace(/\((?:a|as|o|os|s)\)/giu, "")
    .replace(/[.,;:!?¿¡]+$/u, "")
    .trim();

  if (originalToken.startsWith("¿") && !normalized.startsWith("¿")) {
    normalized = `¿${normalized}`;
  }
  if (originalToken.endsWith("?") && !normalized.endsWith("?")) {
    normalized = `${normalized}?`;
  }
  if (originalToken.startsWith("¡") && !normalized.startsWith("¡")) {
    normalized = `¡${normalized}`;
  }
  if (originalToken.endsWith("!") && !normalized.endsWith("!")) {
    normalized = `${normalized}!`;
  }

  return normalized;
}

function firstSlashAlternative(value) {
  return value
    .replace(/\b((?!(?:el|la|los|las)\b)[^\s/]+)\/(?:el|la|los|las)\s+[^\s/]+/giu, "$1")
    .replace(/[^\s]+\/[^\s]+/gu, (token) => {
      const [first] = token.split("/");
      return normalizeSlashAlternative(first, token);
    })
    .replace(/\s+/g, " ")
    .trim();
}

function compactQuizText(entry, field, role = "answer") {
  const overrideField = field === "spanish"
    ? "quizSpanish"
    : field === "english" ? "quizEnglish" : null;
  const roleOverrideField = field === "english"
    ? role === "prompt" ? "quizEnglishPrompt" : "quizEnglishAnswer"
    : null;
  const roleOverride = roleOverrideField ? entry[roleOverrideField] : null;
  if (roleOverride) return roleOverride;
  const override = overrideField ? entry[overrideField] : null;
  if (override) return override;

  const firstSense = firstTopLevelSemicolonSegment(String(entry[field] ?? ""));
  let value = field === "english" && role === "prompt"
    ? firstSense
    : field === "english"
      ? foldEnglishAnswerParentheticals(firstSense)
      : removeParentheticalText(firstSense);
  value = value.replace(/\s+/g, " ").trim();

  value = firstSlashAlternative(value);

  if (entry.partOfSpeech !== "question") {
    value = firstTopLevelSentenceSegment(value);
    value = value.replace(/[.!…]+$/u, "").trim();
  }
  if (!['proper noun', 'question', 'number'].includes(entry.partOfSpeech)) {
    value = lowercaseInitial(value);
  }
  return value;
}

function cognateComparisonForms(value, language) {
  const normalized = normalizeText(value)
    .replace(language === "spanish" ? /^(el|la|los|las|el la)\s+/ : /^to\s+/, "")
    .trim();
  if (!normalized) return [];
  const words = normalized.split(/\s+/).filter((word) => word.length >= 4);
  return [...new Set([normalized.replace(/\s+/g, ""), ...words])];
}

export function cognateTransparencyScore(entry) {
  const lemmaHead = String(entry.lemma ?? entry.spanish).split(/[\/,;]/)[0];
  const spanishForms = cognateComparisonForms(lemmaHead, "spanish");
  const englishForms = [entry.english, ...(entry.senses ?? [])]
    .flatMap((value) => cognateComparisonForms(compactQuizText({
      ...entry,
      english: value,
    }, "english"), "english"));

  let score = 0;
  for (const spanish of spanishForms) {
    for (const english of englishForms) {
      if (Math.min(spanish.length, english.length) < 4) continue;
      score = Math.max(score, textSimilarity(spanish, english));
    }
  }

  const normalizedLemma = normalizeText(lemmaHead).replace(/\s+/g, "");
  if (EDITORIAL_TRANSPARENT_COGNATES.has(normalizedLemma)) score = Math.max(score, 0.85);
  return score;
}

export function cognateTransparencyLevel(entry) {
  if (entry?.partOfSpeech === "proper noun") return COGNATE_TRANSPARENCY.NONE;
  if (hasDistractorTrait(entry, "false-cognate") || hasDistractorTrait(entry, "deceptive-cognate")) {
    return COGNATE_TRANSPARENCY.NONE;
  }
  const score = cognateTransparencyScore(entry);
  if (score >= COGNATE_TRANSPARENCY_THRESHOLDS.strong) {
    return COGNATE_TRANSPARENCY.STRONG;
  }
  if (score >= COGNATE_TRANSPARENCY_THRESHOLDS.moderate) {
    return COGNATE_TRANSPARENCY.MODERATE;
  }
  return COGNATE_TRANSPARENCY.NONE;
}

export function questionFieldText(
  entry,
  field,
  { target = null, direction = null, isCandidate = false, role = "answer" } = {},
) {
  if (field !== "spanish") return compactQuizText(entry, field, role);
  if (hasDistractorTrait(entry, "verbo-falso")) return compactQuizText(entry, "lemma", role);
  const quizText = compactQuizText(entry, field, role);
  if (entry.partOfSpeech === "noun") {
    return quizText.replace(/^(el|la|los|las)(\/la)?\s+/i, "");
  }
  if (
    isCandidate
    && direction === "english-to-spanish"
    && target
    && hasDistractorTrait(target, "verbo")
    && entry.partOfSpeech === "noun"
    && sameLexicalFamily(target, entry)
  ) {
    return quizText.replace(/^(el|la|los|las)(\/la)?\s+/i, "");
  }
  return quizText;
}

function structurallyCompatible({
  target,
  candidate,
  targetIsVerbo,
  targetIsVerboFalso,
  candidateIsVerbo,
  candidateIsVerboFalso,
}) {
  if (target.partOfSpeech === candidate.partOfSpeech) return true;
  return (targetIsVerbo && candidateIsVerboFalso)
    || (targetIsVerboFalso && candidateIsVerbo);
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
    role: "answer",
  });
  const correctText = questionFieldText(target, resolvedAnswerField, { direction, role: "answer" });

  const sameLemma = target.lemma && candidate.lemma
    && normalizeText(target.lemma) === normalizeText(candidate.lemma);
  const overlappingSenses = setsOverlap(normalizedSenses(target), normalizedSenses(candidate));
  const targetIsQuestion = target.partOfSpeech === "question";
  const candidateIsQuestion = candidate.partOfSpeech === "question";
  const targetIsProperNoun = target.partOfSpeech === "proper noun";
  const candidateIsProperNoun = candidate.partOfSpeech === "proper noun";
  const targetIsVerbo = hasDistractorTrait(target, "verbo");
  const targetIsVerboFalso = hasDistractorTrait(target, "verbo-falso");
  const candidateIsVerbo = hasDistractorTrait(candidate, "verbo");
  const candidateIsVerboFalso = hasDistractorTrait(candidate, "verbo-falso");
  const lexicalFamilyMatch = sameLexicalFamily(target, candidate);
  const falseCognateMatch = relationMatches(
    falseCognateRelations,
    target.id,
    candidate.id,
    direction,
  );
  const learnerConfusionMatch = learnerConfusionIds?.has(candidate.id) ?? false;
  const compatible = structurallyCompatible({
    target,
    candidate,
    targetIsVerbo,
    targetIsVerboFalso,
    candidateIsVerbo,
    candidateIsVerboFalso,
  });

  if (
    candidate.id === target.id
    || questionFieldText(candidate, resolvedPromptField, {
      target,
      direction,
      isCandidate: true,
      role: "prompt",
    }) === questionFieldText(target, resolvedPromptField, { direction, role: "prompt" })
    || answerText === correctText
    || sameLemma
    || overlappingSenses
    || (candidateIsQuestion && !targetIsQuestion)
    || !compatible
  ) {
    return Object.freeze({ eligible: false, weight: 0, reasons: Object.freeze([]) });
  }

  let weight = weights.baseWeight;
  const reasons = [];
  const apply = (reason, multiplier) => {
    if (multiplier > 1) {
      weight *= multiplier;
      reasons.push(reason);
    }
  };
  const applyPenalty = (reason, multiplier) => {
    if (multiplier > 0 && multiplier < 1) {
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
  if (targetIsProperNoun && candidateIsProperNoun) {
    apply("both-proper-nouns", weights.bothProperNouns);
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
  if (falseCognateMatch) {
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
  if (learnerConfusionMatch) {
    apply("learner-confusion", weights.learnerConfusion);
  }

  const cognateTransparency = direction === "english-to-spanish"
    && candidate.partOfSpeech !== "proper noun"
    ? cognateTransparencyScore(candidate)
    : 0;
  if (!falseCognateMatch && cognateTransparency >= COGNATE_TRANSPARENCY_THRESHOLDS.strong) {
    applyPenalty("strong-transparent-cognate", weights.strongTransparentCognatePenalty);
  } else if (!falseCognateMatch && cognateTransparency >= COGNATE_TRANSPARENCY_THRESHOLDS.moderate) {
    applyPenalty("moderate-transparent-cognate", weights.moderateTransparentCognatePenalty);
  }

  const samePartOfSpeech = target.partOfSpeech === candidate.partOfSpeech;
  const qualityQualified = (
    (targetIsQuestion && candidateIsQuestion)
    || (targetIsProperNoun && candidateIsProperNoun)
    || (target.partOfSpeech === "number" && candidate.partOfSpeech === "number")
    || lexicalFamilyMatch
    || falseCognateMatch
    || learnerConfusionMatch
    || (samePartOfSpeech && sharedSemanticTags.some((tag) => tag.includes(":")))
    || (
      (samePartOfSpeech || (targetIsVerbo && candidateIsVerboFalso))
      && reasons.some((reason) => reason === "similar-spelling" || reason === "similar-sound")
    )
  );
  const broadSemanticQualified = samePartOfSpeech
    && sharedSemanticTags.some((tag) => !tag.includes(":"));

  return Object.freeze({
    eligible: true,
    weight,
    reasons: Object.freeze(reasons),
    qualified: qualityQualified,
    broadSemanticQualified,
    fallbackEligible: samePartOfSpeech,
    cognateTransparency,
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
  const correctAnswer = questionFieldText(target, answerField, { direction, role: "answer" });
  const seenAnswers = new Set([correctAnswer]);
  const candidatesByAnswer = new Map();

  for (const entry of vocabulary) {
    const answerText = questionFieldText(entry, answerField, {
      target,
      direction,
      isCandidate: true,
      role: "answer",
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
  while (selected.length < count && candidates.length > 0) {
    const qualityCandidates = candidates.filter((candidate) => candidate.score.qualified);
    const broadSemanticCandidates = candidates.filter(
      (candidate) => candidate.score.broadSemanticQualified,
    );
    const fallbackCandidates = candidates.filter(
      (candidate) => candidate.score.fallbackEligible,
    );
    const pool = qualityCandidates.length > 0
      ? qualityCandidates
      : broadSemanticCandidates.length > 0 ? broadSemanticCandidates : fallbackCandidates;
    if (pool.length === 0) break;
    const poolIndex = weightedIndex(pool, random);
    const choice = pool[poolIndex];
    const candidateIndex = candidates.indexOf(choice);
    candidates.splice(candidateIndex, 1);
    seenAnswers.add(choice.answerText);
    selected.push({
      ...choice,
      selectionMode: qualityCandidates.length > 0
        ? "quality"
        : broadSemanticCandidates.length > 0 ? "broad-semantic" : "format-fallback",
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
    cognateTransparency: choice.score.cognateTransparency,
    selectionMode: choice.selectionMode,
  })));
}
