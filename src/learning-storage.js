import {
  auditGapDays,
  buildMasteryProjection,
  conceptKey,
  intervalIndexForDays,
  isBelowFrontier,
  masteryAfterAttempt,
  REVIEW_INTERVALS,
} from "./mastery-policy.js?v=0.24.12";
import { TIER_ORDER } from "./tiers.js?v=0.24.12";

const LEARNING_KEY_PREFIX = "tarjetas.learning.v2.";
const CALENDAR_MODEL_VERSION = 2;
const MASTERY_MODEL_VERSION = 2;
const DIRECTIONS = Object.freeze(["spanish-to-english", "english-to-spanish"]);
const MANUAL_PRIORITY = Object.freeze({
  MORE: "more",
  LESS: "less",
});

export function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  return localDateKey(date);
}

function intervalDaysForPriority(intervalDays, manualPriority) {
  if (!manualPriority) return intervalDays;
  const fallbackIndex = manualPriority === MANUAL_PRIORITY.LESS ? 0 : 1;
  const currentIndex = REVIEW_INTERVALS.indexOf(intervalDays);
  const index = currentIndex >= 0 ? currentIndex : fallbackIndex;
  if (manualPriority === MANUAL_PRIORITY.MORE) {
    return REVIEW_INTERVALS[Math.max(0, index - 1)];
  }
  if (manualPriority === MANUAL_PRIORITY.LESS) {
    return REVIEW_INTERVALS[Math.min(REVIEW_INTERVALS.length - 1, index + 2)];
  }
  return intervalDays;
}

function scheduleWithPriority(intervalDays, baseDate, lastReviewedAt, manualPriority) {
  const adjustedIntervalDays = intervalDaysForPriority(intervalDays, manualPriority);
  return {
    intervalIndex: intervalIndexForDays(adjustedIntervalDays),
    intervalDays: adjustedIntervalDays,
    dueDate: addDays(baseDate, adjustedIntervalDays),
    lastReviewedAt,
  };
}

function emptyLearning(dataset) {
  return {
    datasetId: dataset.id,
    datasetVersion: dataset.version,
    calendarModelVersion: CALENDAR_MODEL_VERSION,
    masteryModelVersion: MASTERY_MODEL_VERSION,
    words: {},
    dailySessions: {},
  };
}

function emptyWord(entry, encounteredAt) {
  return {
    tier: entry.tier,
    conceptKey: entry.spanish ? conceptKey(entry) : null,
    encounteredAt,
    presentations: 0,
    directions: {},
    schedule: null,
  };
}

function latestWordResult(word) {
  return DIRECTIONS
    .map((direction) => word.directions?.[direction])
    .filter(Boolean)
    .sort((left, right) => right.testedAt.localeCompare(left.testedAt))[0] ?? null;
}

function sessionSequence(session) {
  const suffix = (session.sessionKey ?? session.date).split("#")[1];
  return suffix ? Number.parseInt(suffix, 10) : 1;
}

function summarize(words) {
  const tiers = Object.fromEntries(TIER_ORDER.map((tier) => [
    tier,
    { tested: 0, latestCorrect: 0, latestWrong: 0 },
  ]));

  Object.values(words).forEach((word) => {
    const latest = latestWordResult(word);
    if (!latest || !tiers[word.tier]) {
      return;
    }
    tiers[word.tier].tested += 1;
    tiers[word.tier][latest.correct ? "latestCorrect" : "latestWrong"] += 1;
  });

  return Object.freeze(Object.fromEntries(
    Object.entries(tiers).map(([tier, values]) => [tier, Object.freeze({ ...values })]),
  ));
}

export function createLearningStorage(storage, now = () => new Date()) {
  function keyFor(profileId) {
    return `${LEARNING_KEY_PREFIX}${profileId}`;
  }

  function read(profileId, dataset) {
    try {
      const value = JSON.parse(storage.getItem(keyFor(profileId)) ?? "null");
      if (
        value?.datasetId === dataset.id
        && value?.words
        && value?.dailySessions
      ) {
        value.datasetVersion = dataset.version;
        value.calendarModelVersion ??= 1;
        value.masteryModelVersion ??= 1;
        return value;
      }
    } catch {
      // A malformed record is replaced with a clean dataset-scoped record.
    }
    return emptyLearning(dataset);
  }

  function write(profileId, learning) {
    try {
      storage.setItem(keyFor(profileId), JSON.stringify(learning));
    } catch {
      // Practice remains available when browser storage is unavailable.
    }
  }

  function seedOnboarding(profileId, dataset, onboardingRecord, vocabulary) {
    const learning = read(profileId, dataset);
    const entries = new Map(vocabulary.map((entry) => [entry.id, entry]));
    const testedAt = onboardingRecord.completedAt;
    const effectiveDate = localDateKey(new Date(testedAt));

    Object.entries(onboardingRecord.assessedWords ?? {}).forEach(([vocabularyId, assessed]) => {
      const entry = entries.get(vocabularyId);
      if (!entry || learning.words[vocabularyId]) {
        return;
      }
      const word = emptyWord(entry, testedAt);
      word.directions[assessed.direction] = {
        correct: Boolean(assessed.correct),
        testedAt,
        testedDate: effectiveDate,
        testCount: 1,
        source: "onboarding",
      };
      const policy = masteryAfterAttempt(word, {
        ...entry,
        vocabularyId,
        direction: assessed.direction,
        correct: Boolean(assessed.correct),
        source: "onboarding",
      }, effectiveDate, onboardingRecord.placement);
      Object.assign(word, policy);
      word.schedule = scheduleWithPriority(
        policy.intervalDays,
        effectiveDate,
        testedAt,
        word.manualPriority,
      );
      learning.words[vocabularyId] = word;
    });

    write(profileId, learning);
    return learning;
  }

  function getSnapshot(profileId, dataset) {
    return read(profileId, dataset);
  }

  function recordPresentations(
    profileId,
    dataset,
    entries,
    effectiveDate = localDateKey(now()),
  ) {
    const learning = read(profileId, dataset);
    const timestamp = now().toISOString();

    entries.forEach((entry) => {
      const word = learning.words[entry.id] ?? emptyWord(entry, timestamp);
      word.presentations += 1;
      word.encounteredAt ??= timestamp;
      word.schedule ??= {
        intervalIndex: -1,
        intervalDays: 0,
        dueDate: effectiveDate,
        lastReviewedAt: null,
      };
      learning.words[entry.id] = word;
    });

    write(profileId, learning);
    return learning;
  }

  function recordFirstAttempts(
    profileId,
    dataset,
    attempts,
    effectiveDate = localDateKey(now()),
    placement = null,
  ) {
    const learning = read(profileId, dataset);
    const timestamp = now().toISOString();

    attempts.forEach((attempt) => {
      const word = learning.words[attempt.vocabularyId] ?? emptyWord(attempt, timestamp);
      word.conceptKey ??= attempt.spanish ? conceptKey(attempt) : null;
      const previous = word.directions[attempt.direction];
      word.directions[attempt.direction] = {
        correct: Boolean(attempt.correct),
        testedAt: timestamp,
        testedDate: effectiveDate,
        testCount: (previous?.testCount ?? 0) + 1,
        source: attempt.source ?? "session",
      };

      const policy = masteryAfterAttempt(word, attempt, effectiveDate, placement);
      Object.assign(word, policy);
      word.schedule = scheduleWithPriority(
        policy.intervalDays,
        effectiveDate,
        timestamp,
        word.manualPriority,
      );
      learning.words[attempt.vocabularyId] = word;
    });

    write(profileId, learning);
    return learning;
  }

  function getCoverage(profileId, dataset) {
    return summarize(read(profileId, dataset).words);
  }

  function setManualPriority(
    profileId,
    dataset,
    vocabularyId,
    priority,
    effectiveDate = localDateKey(now()),
  ) {
    const learning = read(profileId, dataset);
    const word = learning.words[vocabularyId];
    if (!word) return null;
    const normalizedPriority = priority === MANUAL_PRIORITY.MORE || priority === MANUAL_PRIORITY.LESS
      ? priority
      : null;

    if (normalizedPriority) {
      word.manualPriority = normalizedPriority;
      word.manualPriorityUpdatedAt = now().toISOString();
    } else {
      delete word.manualPriority;
      delete word.manualPriorityUpdatedAt;
    }

    if (word.schedule && normalizedPriority) {
      word.schedule = scheduleWithPriority(
        word.schedule.intervalDays,
        effectiveDate,
        word.schedule.lastReviewedAt,
        normalizedPriority,
      );
    }
    learning.words[vocabularyId] = word;
    write(profileId, learning);
    return word;
  }

  function recoverFromHistory(profileId, dataset, vocabulary, history, placement = null) {
    const learning = read(profileId, dataset);
    const entries = new Map(vocabulary.map((entry) => [entry.id, entry]));
    const sessions = new Map((history?.practiceSessions ?? []).map((session) => [session.id, session]));
    const historicalAttempts = (history?.attempts ?? [])
      .filter((attempt) => (
        attempt?.phase === "main"
        && typeof attempt.vocabularyId === "string"
        && typeof attempt.direction === "string"
        && typeof attempt.answeredAt === "string"
        && entries.has(attempt.vocabularyId)
      ));
    const historicalWordIds = new Set(historicalAttempts.map((attempt) => attempt.vocabularyId));
    const currentWordCount = Object.keys(learning.words ?? {}).length;
    if (historicalWordIds.size <= currentWordCount) {
      return Object.freeze({
        changed: false,
        recoveredWordCount: 0,
        historicalWordCount: historicalWordIds.size,
        currentWordCount,
      });
    }

    const existingWords = learning.words ?? {};
    const events = [];
    Object.entries(existingWords).forEach(([vocabularyId, word]) => {
      const entry = entries.get(vocabularyId);
      if (!entry) return;
      Object.entries(word.directions ?? {}).forEach(([direction, result]) => {
        if (!result?.testedAt) return;
        events.push({
          vocabularyId,
          entry,
          direction,
          correct: Boolean(result.correct),
          source: result.source ?? "existing-learning",
          testedAt: result.testedAt,
          effectiveDate: result.testedDate ?? localDateKey(new Date(result.testedAt)),
        });
      });
    });
    historicalAttempts.forEach((attempt) => {
      const entry = entries.get(attempt.vocabularyId);
      const session = sessions.get(attempt.practiceSessionId);
      events.push({
        vocabularyId: attempt.vocabularyId,
        entry,
        direction: attempt.direction,
        correct: Boolean(attempt.correct),
        source: attempt.stage ?? "history",
        testedAt: attempt.answeredAt,
        effectiveDate: session?.effectiveDate ?? localDateKey(new Date(attempt.answeredAt)),
      });
    });

    events.sort((left, right) => left.testedAt.localeCompare(right.testedAt));
    const recoveredWords = {};
    events.forEach((event) => {
      const existing = existingWords[event.vocabularyId];
      const word = recoveredWords[event.vocabularyId] ?? emptyWord(
        event.entry,
        existing?.encounteredAt ?? event.testedAt,
      );
      word.presentations = Math.max(word.presentations ?? 0, existing?.presentations ?? 0);
      const previous = word.directions[event.direction];
      word.directions[event.direction] = {
        correct: event.correct,
        testedAt: event.testedAt,
        testedDate: event.effectiveDate,
        testCount: (previous?.testCount ?? 0) + 1,
        source: event.source,
      };
      const policy = masteryAfterAttempt(word, {
        ...event.entry,
        vocabularyId: event.vocabularyId,
        direction: event.direction,
        correct: event.correct,
        source: event.source,
      }, event.effectiveDate, placement);
      Object.assign(word, policy);
      word.schedule = scheduleWithPriority(
        policy.intervalDays,
        event.effectiveDate,
        event.testedAt,
        word.manualPriority,
      );
      recoveredWords[event.vocabularyId] = word;
    });

    Object.entries(existingWords).forEach(([vocabularyId, existing]) => {
      const recovered = recoveredWords[vocabularyId];
      if (!recovered) {
        recoveredWords[vocabularyId] = existing;
        return;
      }
      if (existing.manualPriority) {
        recovered.manualPriority = existing.manualPriority;
        recovered.manualPriorityUpdatedAt = existing.manualPriorityUpdatedAt;
        if (recovered.schedule) {
          recovered.schedule = scheduleWithPriority(
            recovered.schedule.intervalDays,
            recovered.schedule.lastReviewedAt
              ? localDateKey(new Date(recovered.schedule.lastReviewedAt))
              : recovered.schedule.dueDate,
            recovered.schedule.lastReviewedAt,
            recovered.manualPriority,
          );
        }
      }
    });

    const recoveredWordCount = Object.keys(recoveredWords).length;
    if (recoveredWordCount <= currentWordCount) {
      return Object.freeze({
        changed: false,
        recoveredWordCount,
        historicalWordCount: historicalWordIds.size,
        currentWordCount,
      });
    }

    learning.words = recoveredWords;
    learning.datasetVersion = dataset.version;
    write(profileId, learning);
    return Object.freeze({
      changed: true,
      recoveredWordCount,
      historicalWordCount: historicalWordIds.size,
      currentWordCount,
    });
  }

  function normalizeMastery(profileId, dataset, vocabulary, placement, today = localDateKey(now())) {
    const learning = read(profileId, dataset);
    if (learning.masteryModelVersion === MASTERY_MODEL_VERSION) return false;
    const entries = new Map(vocabulary.map((entry) => [entry.id, entry]));

    Object.entries(learning.words).forEach(([vocabularyId, word]) => {
      const entry = entries.get(vocabularyId);
      if (!entry) return;
      word.tier = entry.tier;
      word.conceptKey ??= conceptKey(entry);
      const latest = latestWordResult(word);
      if (latest) {
        word.lastFirstAttemptDate ??= latest.testedDate
          ?? localDateKey(new Date(latest.testedAt));
        word.lastFirstAttemptCorrect ??= Boolean(latest.correct);
        word.lastFirstAttemptSource ??= latest.source ?? "legacy";
      }
      const below = isBelowFrontier(entry.tier, placement);
      if (below && latest?.correct) {
        const gap = auditGapDays(entry.tier);
        word.masteryTrack = "audit";
        word.masteryStatus = "presumed-mastered";
        word.repairCleanStreak = 0;
        if (gap) {
          word.schedule = {
            intervalIndex: intervalIndexForDays(gap),
            intervalDays: gap,
            dueDate: addDays(word.lastFirstAttemptDate, gap),
            lastReviewedAt: word.schedule?.lastReviewedAt ?? latest.testedAt,
          };
        }
      } else if (latest && !latest.correct) {
        word.masteryTrack = "repair";
        word.masteryStatus = "repair";
        word.repairCleanStreak = 0;
        word.schedule = {
          intervalIndex: 0,
          intervalDays: 1,
          dueDate: addDays(word.lastFirstAttemptDate, 1),
          lastReviewedAt: word.schedule?.lastReviewedAt ?? latest.testedAt,
        };
      } else {
        word.masteryTrack ??= below ? "audit" : "frontier";
        word.masteryStatus ??= below ? "presumed-mastered" : "learning";
        if (!below && latest?.correct && (word.schedule?.intervalDays ?? 0) < 3) {
          word.schedule = {
            intervalIndex: intervalIndexForDays(3),
            intervalDays: 3,
            dueDate: addDays(word.lastFirstAttemptDate, 3),
            lastReviewedAt: word.schedule?.lastReviewedAt ?? latest.testedAt,
          };
        }
      }
      if (word.lastFirstAttemptDate === today) {
        word.retiredDate = latest?.correct ? today : null;
        word.repairDueDate = latest?.correct ? null : today;
      }
    });

    learning.masteryModelVersion = MASTERY_MODEL_VERSION;
    write(profileId, learning);
    return true;
  }

  function getMasteryProjection(profileId, dataset, vocabulary) {
    return buildMasteryProjection(vocabulary, read(profileId, dataset).words, dataset);
  }

  function getDailySession(profileId, dataset, dateKey = localDateKey(now())) {
    const sessions = Object.values(read(profileId, dataset).dailySessions)
      .filter((session) => session.date === dateKey)
      .sort((left, right) => sessionSequence(left) - sessionSequence(right));
    return [...sessions].reverse().find((session) => session.status !== "complete")
      ?? sessions.at(-1)
      ?? null;
  }

  function getDailySessionsForDate(profileId, dataset, dateKey = localDateKey(now())) {
    return Object.values(read(profileId, dataset).dailySessions)
      .filter((session) => session.date === dateKey)
      .sort((left, right) => sessionSequence(left) - sessionSequence(right));
  }

  function nextDailySessionKey(profileId, dataset, dateKey = localDateKey(now())) {
    const learning = read(profileId, dataset);
    if (!learning.dailySessions[dateKey]) return dateKey;
    let sequence = 2;
    while (learning.dailySessions[`${dateKey}#${sequence}`]) sequence += 1;
    return `${dateKey}#${sequence}`;
  }

  function saveDailySession(profileId, dataset, session) {
    const learning = read(profileId, dataset);
    session.sessionKey ??= nextDailySessionKey(profileId, dataset, session.date);
    session.historyId ??= `${profileId}:${session.sessionKey}`;
    learning.dailySessions[session.sessionKey] = session;
    write(profileId, learning);
    return session;
  }

  function normalizeCalendar(profileId, dataset, today = localDateKey(now())) {
    const learning = read(profileId, dataset);
    if (learning.calendarModelVersion === CALENDAR_MODEL_VERSION) {
      return Object.freeze({ changed: false, collapsedSessions: 0 });
    }

    const originalSessions = Object.entries(learning.dailySessions)
      .sort(([, left], [, right]) => (
        (left.completedAt ?? left.date).localeCompare(right.completedAt ?? right.date)
      ));
    const normalizedSessions = {};
    const dateCounts = new Map();
    let collapsedSessions = 0;

    originalSessions.forEach(([originalKey, originalSession]) => {
      const session = { ...originalSession };
      const synthetic = Boolean(session.simulated) || session.date > today;
      const date = synthetic ? today : session.date;
      const sequence = (dateCounts.get(date) ?? 0) + 1;
      dateCounts.set(date, sequence);
      const sessionKey = sequence === 1 ? date : `${date}#${sequence}`;
      session.historyId ??= `${profileId}:${originalKey}`;
      session.sessionKey = sessionKey;
      session.date = date;
      session.repeat = Boolean(session.repeat) || sequence > 1;
      session.simulated = false;
      normalizedSessions[sessionKey] = session;
      if (synthetic) collapsedSessions += 1;
    });

    if (collapsedSessions > 0) {
      Object.values(learning.words).forEach((word) => {
        if (!word.schedule) return;
        const reference = word.schedule.lastReviewedAt ?? word.encounteredAt;
        if (!reference) return;
        const intervalDays = Number.isInteger(word.schedule.intervalDays)
          ? word.schedule.intervalDays
          : REVIEW_INTERVALS[word.schedule.intervalIndex] ?? 0;
        const correctedDueDate = addDays(localDateKey(new Date(reference)), intervalDays);
        if (word.schedule.dueDate > correctedDueDate) {
          word.schedule.dueDate = correctedDueDate;
        }
        word.schedule.intervalDays = intervalDays;
      });
    }

    learning.dailySessions = normalizedSessions;
    learning.calendarModelVersion = CALENDAR_MODEL_VERSION;
    write(profileId, learning);
    return Object.freeze({ changed: true, collapsedSessions });
  }

  return Object.freeze({
    getSnapshot,
    seedOnboarding,
    recordPresentations,
    recordFirstAttempts,
    setManualPriority,
    recoverFromHistory,
    getCoverage,
    normalizeMastery,
    getMasteryProjection,
    getDailySession,
    getDailySessionsForDate,
    nextDailySessionKey,
    saveDailySession,
    normalizeCalendar,
  });
}
