import { shuffle } from "./questions.js";

const TIER_ORDER = Object.freeze(["foundation", "everyday", "expanding"]);

function latestResult(word) {
  return Object.values(word.directions ?? {})
    .sort((left, right) => right.testedAt.localeCompare(left.testedAt))[0] ?? null;
}

function prioritizedEntries(vocabulary, words, predicate, random) {
  const candidates = vocabulary.filter(predicate).map((entry) => ({
    entry,
    latest: latestResult(words[entry.id] ?? {}),
  }));
  const untested = shuffle(candidates.filter(({ latest }) => !latest), random);
  const wrong = shuffle(candidates.filter(({ latest }) => latest && !latest.correct), random);
  const correct = shuffle(candidates.filter(({ latest }) => latest?.correct), random);
  return [...untested, ...wrong, ...correct].map(({ entry }) => entry);
}

function checkInCandidates(vocabulary, words, placement, random) {
  const entries = new Map(vocabulary.map((entry) => [entry.id, entry]));
  const encountered = Object.entries(words)
    .map(([id, word]) => ({ entry: entries.get(id), latest: latestResult(word) }))
    .filter(({ entry, latest }) => entry && latest);

  const selected = [];
  const frontier = placement?.learningFrontier ?? "foundation";
  const auditCount = frontier === "foundation" ? 0 : 2;
  selected.push(...prioritizedEntries(
    vocabulary,
    words,
    (entry) => entry.tier === "foundation",
    random,
  ).slice(0, auditCount));

  if (selected.length < 10) {
    const selectedIds = new Set(selected.map((entry) => entry.id));
    const wrong = shuffle(encountered.filter(({ entry, latest }) => (
      !selectedIds.has(entry.id)
      && (frontier === "foundation" || entry.tier !== "foundation")
      && !latest.correct
    )), random);
    const correct = shuffle(encountered.filter(({ entry, latest }) => (
      !selectedIds.has(entry.id)
      && (frontier === "foundation" || entry.tier !== "foundation")
      && latest.correct
    )), random);
    selected.push(...[...wrong, ...correct]
      .slice(0, 10 - selected.length)
      .map(({ entry }) => entry));
  }

  if (selected.length < 10) {
    const selectedIds = new Set(selected.map((entry) => entry.id));
    const knownTierIndex = Math.max(0, TIER_ORDER.indexOf(placement?.knownThrough));
    const fallback = shuffle(vocabulary.filter((entry) => (
      TIER_ORDER.indexOf(entry.tier) <= knownTierIndex && !selectedIds.has(entry.id)
    )), random);
    selected.push(...fallback.slice(0, 10 - selected.length));
  }

  return selected;
}

export function createDailySessionPlan(
  vocabulary,
  placement,
  learning,
  date,
  random = Math.random,
) {
  const checkIn = checkInCandidates(vocabulary, learning.words, placement, random);
  const checkInIds = new Set(checkIn.map((entry) => entry.id));
  const allDue = vocabulary.filter((entry) => {
    const dueDate = learning.words[entry.id]?.schedule?.dueDate;
    return dueDate && dueDate <= date;
  });
  const due = allDue.filter((entry) => !checkInIds.has(entry.id));
  const newWordCount = allDue.length > 60 ? 0 : 15;
  const frontier = placement?.learningFrontier ?? "foundation";
  const newWords = shuffle(vocabulary.filter((entry) => (
    entry.tier === frontier
    && !learning.words[entry.id]
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
