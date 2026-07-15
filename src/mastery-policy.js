import { cognateTransparencyLevel, COGNATE_TRANSPARENCY } from "./distractors.js?v=0.24.10";
import { tierIndex } from "./tiers.js?v=0.24.10";

export const MASTERY_SCHEMA_VERSION = 1;
export const REVIEW_INTERVALS = Object.freeze([1, 3, 7, 14, 30, 60]);

function normalizedConceptPart(value) {
  return String(value ?? "")
    .normalize("NFC")
    .toLocaleLowerCase("es")
    .replaceAll(/\s+/g, " ")
    .trim();
}

export function conceptKey(entry) {
  return [entry.spanish, entry.partOfSpeech ?? "unknown", entry.english]
    .map(normalizedConceptPart)
    .join("|");
}

export function isBelowFrontier(tier, placement) {
  const frontier = placement?.learningFrontier ?? "foundation";
  return tierIndex(tier) < tierIndex(frontier);
}

export function auditGapDays(tier) {
  if (tier === "foundation") return 60;
  if (tier === "everyday") return 30;
  if (tier === "expanding1") return 30;
  return null;
}

export function intervalIndexForDays(days) {
  return REVIEW_INTERVALS.indexOf(days);
}

export function eligibleForOrdinaryQuestion(word, date) {
  if (!word) return true;
  return word.lastFirstAttemptDate !== date && word.schedule?.dueDate <= date;
}

function frontierAdvanceSteps(attempt) {
  const transparency = cognateTransparencyLevel(attempt);
  if (transparency === COGNATE_TRANSPARENCY.STRONG) {
    return attempt.direction === "english-to-spanish" ? 3 : 2;
  }
  if (
    transparency === COGNATE_TRANSPARENCY.MODERATE
    && attempt.direction === "english-to-spanish"
  ) {
    return 2;
  }
  return 1;
}

function nextFrontierGap(priorDays, steps = 1) {
  const advanceSteps = Number.isInteger(steps) && steps > 0 ? steps : 1;
  if (!Number.isInteger(priorDays) || priorDays <= 1) {
    return REVIEW_INTERVALS[Math.min(advanceSteps, REVIEW_INTERVALS.length - 1)];
  }
  const index = REVIEW_INTERVALS.indexOf(priorDays);
  return REVIEW_INTERVALS[Math.min(Math.max(1, index + advanceSteps), REVIEW_INTERVALS.length - 1)];
}

export function masteryAfterAttempt(word, attempt, effectiveDate, placement) {
  const sameDay = word.lastFirstAttemptDate === effectiveDate;
  const belowFrontier = isBelowFrontier(attempt.tier ?? word.tier, placement);
  const correctiveReview = attempt.source === "review" && sameDay;
  const priorGap = word.schedule?.intervalDays;
  let masteryTrack = belowFrontier ? "audit" : "frontier";
  let masteryStatus = belowFrontier ? "presumed-mastered" : "learning";
  let repairCleanStreak = word.repairCleanStreak ?? 0;
  let intervalDays;

  if (!attempt.correct) {
    intervalDays = 1;
    masteryTrack = "repair";
    masteryStatus = "repair";
    repairCleanStreak = 0;
  } else if (belowFrontier && word.masteryStatus === "repair") {
    masteryTrack = "repair";
    masteryStatus = "repair";
    if (sameDay) {
      intervalDays = Number.isInteger(priorGap) ? priorGap : 1;
    } else {
      repairCleanStreak += 1;
      if (repairCleanStreak >= 2) {
        masteryTrack = "audit";
        masteryStatus = "presumed-mastered";
        intervalDays = auditGapDays(attempt.tier ?? word.tier);
        repairCleanStreak = 0;
      } else {
        masteryTrack = "repair";
        masteryStatus = "repair";
        intervalDays = 3;
      }
    }
  } else if (belowFrontier) {
    intervalDays = auditGapDays(attempt.tier ?? word.tier);
  } else if (sameDay) {
    intervalDays = Number.isInteger(priorGap) && priorGap > 0 ? priorGap : 3;
  } else {
    intervalDays = nextFrontierGap(priorGap, frontierAdvanceSteps(attempt));
  }

  return Object.freeze({
    intervalDays,
    intervalIndex: intervalIndexForDays(intervalDays),
    masteryTrack,
    masteryStatus,
    repairCleanStreak,
    lastFirstAttemptDate: effectiveDate,
    lastFirstAttemptCorrect: Boolean(attempt.correct),
    lastFirstAttemptSource: attempt.source ?? "session",
    retiredDate: attempt.correct || attempt.source === "review" ? effectiveDate : null,
    repairDueDate: !attempt.correct && attempt.source !== "review" ? effectiveDate : null,
    sameDay,
    correctiveReview,
  });
}

export function buildMasteryProjection(vocabulary, words, dataset) {
  const entries = new Map(vocabulary.map((entry) => [entry.id, entry]));
  const concepts = Object.entries(words).flatMap(([vocabularyId, word]) => {
    const entry = entries.get(vocabularyId);
    if (!entry) return [];
    return [{
      conceptKey: word.conceptKey ?? conceptKey(entry),
      vocabularyIds: [vocabularyId],
      spanish: entry.spanish,
      english: entry.english,
      partOfSpeech: entry.partOfSpeech ?? null,
      sourceTier: entry.tier,
      masteryTrack: word.masteryTrack ?? null,
      masteryStatus: word.masteryStatus ?? null,
      reviewGapDays: word.schedule?.intervalDays ?? null,
      nextDueDate: word.schedule?.dueDate ?? null,
      lastFirstAttemptDate: word.lastFirstAttemptDate ?? null,
      lastFirstAttemptCorrect: word.lastFirstAttemptCorrect ?? null,
      repairCleanStreak: word.repairCleanStreak ?? 0,
      presentations: word.presentations ?? 0,
      evidenceCount: Object.values(word.directions ?? {})
        .reduce((sum, direction) => sum + (direction.testCount ?? 0), 0),
      directions: Object.fromEntries(Object.entries(word.directions ?? {}).map(
        ([direction, evidence]) => [direction, { ...evidence }],
      )),
    }];
  }).sort((left, right) => left.conceptKey.localeCompare(right.conceptKey, "es"));

  return Object.freeze({
    schemaVersion: MASTERY_SCHEMA_VERSION,
    sourceDataset: { id: dataset.id, version: dataset.version },
    concepts: Object.freeze(concepts.map((record) => Object.freeze(record))),
  });
}
