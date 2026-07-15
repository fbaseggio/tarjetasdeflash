import { cognateTransparencyLevel, COGNATE_TRANSPARENCY } from "./distractors.js?v=0.24.9";
import { shuffle } from "./questions.js?v=0.24.9";
import { lowerTiers, tierIndex, TIER_ORDER } from "./tiers.js?v=0.24.9";

const CHECK_IN_SIZE = 10;
const BASE_NEW_WORD_COUNT = 15;
const MIN_NEW_WORD_COUNT = 8;
const BACKLOG_WORDS_PER_NEW_WORD_REDUCTION = 8;
const NEW_WORD_TRANSPARENCY_WEIGHTS = Object.freeze({
  [COGNATE_TRANSPARENCY.NONE]: 1,
  [COGNATE_TRANSPARENCY.MODERATE]: 0.6,
  [COGNATE_TRANSPARENCY.STRONG]: 0.35,
});
export const NEW_WORD_STYLES = Object.freeze({
  MIXED: "mixed",
  TOPIC_GROUPS: "topic-groups",
});
const MIN_TOPIC_PACKET_SIZE = 7;
const SOFT_MAX_TOPIC_PACKET_SIZE = 12;
const KEEP_TOGETHER_TOPIC_PACKET_SIZE = 13;

function latestResult(word) {
  return Object.values(word?.directions ?? {})
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

function dateOrdinal(dateKey) {
  const time = Date.parse(`${dateKey}T00:00:00.000Z`);
  return Number.isFinite(time) ? Math.floor(time / 86400000) : 0;
}

function everyOtherDay(dateKey) {
  return dateOrdinal(dateKey) % 2 === 0;
}

function tierEvidence(vocabulary, words, tier) {
  return vocabulary
    .filter((entry) => entry.tier === tier)
    .map((entry) => {
      const result = latestResult(words[entry.id]);
      return result ? { result, entry } : null;
    })
    .filter(Boolean)
    .sort((left, right) => right.result.testedAt.localeCompare(left.result.testedAt));
}

export function lowerTierHealth(vocabulary, words, tier) {
  const evidence = tierEvidence(vocabulary, words, tier);
  const tested = evidence.length;
  const correct = evidence.filter(({ result }) => result.correct).length;
  const recent = evidence.slice(0, 4);
  const recentWrong = recent.filter(({ result }) => !result.correct).length;
  const earlyWarning = recent.length >= 4 && recentWrong >= 2;
  const confirmedWeak = tested >= 10 && correct / tested < 0.95;

  return Object.freeze({
    tier,
    tested,
    correct,
    recentCount: recent.length,
    recentWrong,
    successRate: tested > 0 ? correct / tested : null,
    weak: earlyWarning || confirmedWeak,
    earlyWarning,
    confirmedWeak,
  });
}

function auditSlotCounts(vocabulary, words, frontier, date) {
  const tiers = lowerTiers(frontier);
  const counts = Object.fromEntries(tiers.map((tier) => [tier, 0]));
  const health = Object.fromEntries(
    tiers.map((tier) => [tier, lowerTierHealth(vocabulary, words, tier)]),
  );

  if (frontier === "everyday") {
    counts.foundation = 1;
  } else if (frontier === "expanding1") {
    counts.foundation = 1;
    counts.everyday = 1;
  } else if (frontier === "expanding2") {
    counts.everyday = 1;
    counts.expanding1 = 1;
    if (everyOtherDay(date) || health.foundation?.weak) {
      counts.foundation = 1;
    }
  }

  tiers.forEach((tier) => {
    if (health[tier]?.weak) counts[tier] += 1;
  });

  return { counts, health };
}

function auditTierCandidates(vocabulary, words, tier, date, random) {
  const eligible = vocabulary.filter((entry) => {
    if (entry.tier !== tier) return false;
    const word = words[entry.id];
    if (alreadyAskedToday(word, date) || word?.masteryStatus === "repair") return false;
    return !word || !latestResult(word) || word.schedule?.dueDate <= date;
  });

  const untested = shuffle(eligible.filter((entry) => !latestResult(words[entry.id])), random);
  const due = shuffle(eligible.filter((entry) => latestResult(words[entry.id])), random);
  return [...untested, ...due];
}

function weightedSampleWithoutReplacement(entries, count, weightForEntry, random) {
  const candidates = entries.map((entry) => ({
    entry,
    weight: Math.max(0, Number(weightForEntry(entry)) || 0),
  }));
  const selected = [];

  while (selected.length < count && candidates.length > 0) {
    const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
    let threshold = random() * (totalWeight > 0 ? totalWeight : candidates.length);
    let selectedIndex = candidates.length - 1;

    for (let index = 0; index < candidates.length; index += 1) {
      threshold -= totalWeight > 0 ? candidates[index].weight : 1;
      if (threshold < 0) {
        selectedIndex = index;
        break;
      }
    }

    selected.push(candidates[selectedIndex].entry);
    candidates.splice(selectedIndex, 1);
  }

  return selected;
}

export function newWordSelectionWeight(entry) {
  return NEW_WORD_TRANSPARENCY_WEIGHTS[cognateTransparencyLevel(entry)]
    ?? NEW_WORD_TRANSPARENCY_WEIGHTS[COGNATE_TRANSPARENCY.NONE];
}

function selectMixedNewWords(vocabulary, words, placement, checkInIds, count, random) {
  const frontier = placement?.learningFrontier ?? "foundation";
  const tiers = TIER_ORDER.slice(tierIndex(frontier));
  const selected = [];
  const selectedIds = new Set(checkInIds);

  tiers.forEach((tier) => {
    if (selected.length >= count) return;
    const pool = vocabulary.filter((entry) => (
      entry.tier === tier
      && !words[entry.id]
      && !selectedIds.has(entry.id)
    ));
    const tierSelection = weightedSampleWithoutReplacement(
      pool,
      count - selected.length,
      newWordSelectionWeight,
      random,
    );
    tierSelection.forEach((entry) => {
      selected.push(entry);
      selectedIds.add(entry.id);
    });
  });

  return selected;
}

function curriculumOrder(left, right) {
  return (left.curriculumRank ?? 0) - (right.curriculumRank ?? 0)
    || (left.chapter ?? 0) - (right.chapter ?? 0)
    || String(left.spanish).localeCompare(String(right.spanish), "es");
}

function splitTopicGroup(entries) {
  const ordered = [...entries].sort(curriculumOrder);
  if (ordered.length <= KEEP_TOGETHER_TOPIC_PACKET_SIZE) return [ordered];
  const chunkCount = Math.ceil(ordered.length / SOFT_MAX_TOPIC_PACKET_SIZE);
  const chunkSize = Math.ceil(ordered.length / chunkCount);
  const chunks = [];
  for (let index = 0; index < ordered.length; index += chunkSize) {
    chunks.push(ordered.slice(index, index + chunkSize));
  }
  return chunks;
}

function topicPacketsForTier(vocabulary, words, tier, selectedIds) {
  const groups = new Map();
  vocabulary
    .filter((entry) => entry.tier === tier && !words[entry.id] && !selectedIds.has(entry.id))
    .sort(curriculumOrder)
    .forEach((entry) => {
      const key = `${entry.chapter ?? ""}|${entry.category ?? ""}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    });

  return [...groups.values()].flatMap(splitTopicGroup);
}

function selectThematicNewWords(vocabulary, words, placement, checkInIds, count) {
  const frontier = placement?.learningFrontier ?? "foundation";
  const tiers = TIER_ORDER.slice(tierIndex(frontier));
  const selectedIds = new Set(checkInIds);

  for (const tier of tiers) {
    const packets = topicPacketsForTier(vocabulary, words, tier, selectedIds);
    for (let packetIndex = 0; packetIndex < packets.length; packetIndex += 1) {
      const packet = [...packets[packetIndex]];
      if (packet.length >= Math.min(MIN_TOPIC_PACKET_SIZE, count)) {
        return packet.slice(0, Math.max(count, KEEP_TOGETHER_TOPIC_PACKET_SIZE));
      }

      for (
        let nextIndex = packetIndex + 1;
        nextIndex < packets.length && packet.length < MIN_TOPIC_PACKET_SIZE;
        nextIndex += 1
      ) {
        packet.push(...packets[nextIndex]);
      }

      if (packet.length > 0) {
        return packet.slice(0, Math.max(count, KEEP_TOGETHER_TOPIC_PACKET_SIZE));
      }
    }
  }

  return [];
}

function selectNewWords(vocabulary, words, placement, checkInIds, count, random, style) {
  if (style === NEW_WORD_STYLES.TOPIC_GROUPS) {
    return selectThematicNewWords(vocabulary, words, placement, checkInIds, count);
  }
  return selectMixedNewWords(vocabulary, words, placement, checkInIds, count, random);
}

function auditCandidates(vocabulary, words, placement, date, random) {
  const frontier = placement?.learningFrontier ?? "foundation";
  const auditTiers = lowerTiers(frontier);
  if (auditTiers.length === 0) return [];

  const { counts } = auditSlotCounts(vocabulary, words, frontier, date);
  const byTier = Object.fromEntries(
    auditTiers.map((tier) => [tier, auditTierCandidates(vocabulary, words, tier, date, random)]),
  );
  const desiredSlots = Math.min(
    CHECK_IN_SIZE,
    Object.values(counts).reduce((sum, count) => sum + count, 0),
  );

  const selected = [];
  auditTiers.forEach((tier) => {
    for (let index = 0; index < counts[tier] && selected.length < CHECK_IN_SIZE; index += 1) {
      const entry = byTier[tier]?.shift();
      if (entry) selected.push(entry);
    }
  });

  const remaining = auditTiers.flatMap((tier) => byTier[tier]);
  selected.push(...remaining.slice(0, Math.max(0, desiredSlots - selected.length)));
  return selected;
}

function supplementalAuditCandidates(vocabulary, words, placement, date, selectedIds, random) {
  const frontier = placement?.learningFrontier ?? "foundation";
  const { counts } = auditSlotCounts(vocabulary, words, frontier, date);
  const tiers = lowerTiers(frontier).filter((tier) => counts[tier] > 0).reverse();
  const byTier = Object.fromEntries(tiers.map((tier) => [tier, auditTierCandidates(
    vocabulary,
    words,
    tier,
    date,
    random,
  ).filter((entry) => !selectedIds.has(entry.id))]));
  const selected = [];
  const availableTiers = [...tiers];
  let tierCursor = 0;

  while (availableTiers.length > 0) {
    const tier = availableTiers[tierCursor % availableTiers.length];
    const entry = byTier[tier]?.shift();
    if (entry) {
      selected.push(entry);
      tierCursor += 1;
      continue;
    }
    availableTiers.splice(availableTiers.indexOf(tier), 1);
    if (availableTiers.length > 0) {
      tierCursor %= availableTiers.length;
    }
  }

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
    .slice(0, CHECK_IN_SIZE - selected.length)
    .map(({ entry }) => entry));
  selected.forEach((entry) => selectedIds.add(entry.id));
  if (selected.length < CHECK_IN_SIZE) {
    selected.push(...supplementalAuditCandidates(
      vocabulary,
      words,
      placement,
      date,
      selectedIds,
      random,
    ).slice(0, CHECK_IN_SIZE - selected.length));
  }
  return selected;
}

export function adaptiveNewWordCount(backlogCount) {
  const backlog = Number.isFinite(backlogCount) ? Math.max(0, Math.floor(backlogCount)) : 0;
  return Math.max(
    MIN_NEW_WORD_COUNT,
    BASE_NEW_WORD_COUNT - Math.floor(backlog / BACKLOG_WORDS_PER_NEW_WORD_REDUCTION),
  );
}

export function createDailySessionPlan(
  vocabulary,
  placement,
  learning,
  date,
  random = Math.random,
  options = {},
) {
  const words = learning.words ?? {};
  const totalDueBacklog = vocabulary.filter((entry) => {
    const word = words[entry.id];
    return word && (dueForSameDayRepair(word, date) || dueForOrdinaryReview(word, date));
  }).length;
  const checkIn = checkInCandidates(vocabulary, words, placement, date, random);
  const checkInIds = new Set(checkIn.map((entry) => entry.id));
  const due = vocabulary.filter((entry) => {
    const word = words[entry.id];
    if (!word || checkInIds.has(entry.id)) return false;
    return dueForSameDayRepair(word, date) || dueForOrdinaryReview(word, date);
  });
  const newWordCount = adaptiveNewWordCount(totalDueBacklog);
  const newWords = selectNewWords(
    vocabulary,
    words,
    placement,
    checkInIds,
    newWordCount,
    random,
    options.newWordStyle,
  );
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
