import { shuffle } from "./questions.js";

const TIER_ORDER = Object.freeze(["foundation", "everyday", "expanding"]);

function latestResult(word) {
  return Object.values(word.directions ?? {})
    .sort((left, right) => right.testedAt.localeCompare(left.testedAt))[0] ?? null;
}

function alreadyAskedToday(word, date) {
  return word?.lastFirstAttemptDate === date;
}

function dueForOrdinaryReview(word, date) {
  return word?.schedule?.dueDate <= date
    && word.masteryTrack !== "audit"
    && !alreadyAskedToday(word, date);
}

function dueForSameDayRepair(word, date) {
  return word?.repairDueDate === date && word.retiredDate !== date;
}

function auditCandidates(vocabulary, words, placement, date, random) {
  const frontier = placement?.learningFrontier ?? "foundation";
  const lowerTiers = TIER_ORDER.filter((tier) => (
    TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf(frontier)
  ));
  if (lowerTiers.length === 0) return [];

  const byTier = Object.fromEntries(lowerTiers.map((tier) => [tier, shuffle(
    vocabulary.filter((entry) => {
      if (entry.tier !== tier) return false;
      const word = words[entry.id];
      if (alreadyAskedToday(word, date) || word?.masteryStatus === "repair") return false;
      return !word || !latestResult(word) || word.schedule?.dueDate <= date;
    }),
    random,
  )]));

  const selected = [];
  if (frontier === "expanding") {
    if (byTier.foundation?.length) selected.push(byTier.foundation.shift());
    if (byTier.everyday?.length) selected.push(byTier.everyday.shift());
  } else {
    selected.push(...(byTier.foundation ?? []).splice(0, 2));
  }

  const remaining = lowerTiers.flatMap((tier) => byTier[tier]);
  selected.push(...remaining.slice(0, 2 - selected.length));
  return selected;
}

function checkInCandidates(vocabulary, words, placement, date, random) {
  const frontier = placement?.learningFrontier ?? "foundation";
  const selected = auditCandidates(vocabulary, words, placement, date, random);
  const selectedIds = new Set(selected.map((entry) => entry.id));
  const dueFrontier = vocabulary
    .filter((entry) => {
      const word = words[entry.id];
      return entry.tier === frontier
        && word
        && !selectedIds.has(entry.id)
        && dueForOrdinaryReview(word, date);
    })
    .map((entry) => ({ entry, latest: latestResult(words[entry.id]) }));
  const wrong = shuffle(dueFrontier.filter(({ latest }) => latest && !latest.correct), random);
  const correct = shuffle(dueFrontier.filter(({ latest }) => latest?.correct), random);
  selected.push(...[...wrong, ...correct]
    .slice(0, 10 - selected.length)
    .map(({ entry }) => entry));
  return selected;
}

export function createDailySessionPlan(
  vocabulary,
  placement,
  learning,
  date,
  random = Math.random,
) {
  const words = learning.words ?? {};
  const checkIn = checkInCandidates(vocabulary, words, placement, date, random);
  const checkInIds = new Set(checkIn.map((entry) => entry.id));
  const due = vocabulary.filter((entry) => {
    const word = words[entry.id];
    if (!word || checkInIds.has(entry.id)) return false;
    return dueForSameDayRepair(word, date) || dueForOrdinaryReview(word, date);
  });
  const newWordCount = due.length > 60 ? 0 : 15;
  const frontier = placement?.learningFrontier ?? "foundation";
  const newWords = shuffle(vocabulary.filter((entry) => (
    entry.tier === frontier
    && !words[entry.id]
    && !checkInIds.has(entry.id)
  )), random).slice(0, newWordCount);
  const reviewIds = [...new Set([...due, ...newWords].map((entry) => entry.id))];

  return {
    date,
    status: "in-progress",
    stage: "intro",
    checkInIds: checkIn.map((entry) => entry.id),
    newWordIds: newWords.map((entry) => entry.id),
    presentedWordIds: [],
    reviewIds,
    newWordIndex: 0,
    reviewCursor: 0,
    correctCount: 0,
    wrongCount: 0,
    quizRounds: 0,
    streakCredited: false,
  };
}

export function getReviewRoundIds(session, size = 10) {
  return session.reviewIds.slice(session.reviewCursor, session.reviewCursor + size);
}
