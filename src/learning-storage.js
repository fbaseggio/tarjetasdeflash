const LEARNING_KEY_PREFIX = "tarjetas.learning.v1.";
const CALENDAR_MODEL_VERSION = 2;
const REVIEW_INTERVALS = Object.freeze([1, 3, 7, 14, 30, 60]);
const DIRECTIONS = Object.freeze(["spanish-to-english", "english-to-spanish"]);

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

function emptyLearning(dataset) {
  return {
    datasetId: dataset.id,
    datasetVersion: dataset.version,
    calendarModelVersion: CALENDAR_MODEL_VERSION,
    words: {},
    dailySessions: {},
  };
}

function emptyWord(entry, encounteredAt) {
  return {
    tier: entry.tier,
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
  const tiers = {
    foundation: { tested: 0, latestCorrect: 0, latestWrong: 0 },
    everyday: { tested: 0, latestCorrect: 0, latestWrong: 0 },
    expanding: { tested: 0, latestCorrect: 0, latestWrong: 0 },
  };

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
        && value?.datasetVersion === dataset.version
        && value?.words
        && value?.dailySessions
      ) {
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

    Object.entries(onboardingRecord.assessedWords ?? {}).forEach(([vocabularyId, assessed]) => {
      const entry = entries.get(vocabularyId);
      if (!entry || learning.words[vocabularyId]) {
        return;
      }
      const word = emptyWord(entry, testedAt);
      word.directions[assessed.direction] = {
        correct: Boolean(assessed.correct),
        testedAt,
        testCount: 1,
        source: "onboarding",
      };
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
  ) {
    const learning = read(profileId, dataset);
    const timestamp = now().toISOString();

    attempts.forEach((attempt) => {
      const word = learning.words[attempt.vocabularyId] ?? emptyWord(attempt, timestamp);
      const previous = word.directions[attempt.direction];
      word.directions[attempt.direction] = {
        correct: Boolean(attempt.correct),
        testedAt: timestamp,
        testCount: (previous?.testCount ?? 0) + 1,
        source: attempt.source ?? "session",
      };

      const priorIndex = Number.isInteger(word.schedule?.intervalIndex)
        ? word.schedule.intervalIndex
        : -1;
      const intervalIndex = attempt.correct
        ? Math.min(priorIndex + 1, REVIEW_INTERVALS.length - 1)
        : 0;
      word.schedule = {
        intervalIndex,
        intervalDays: REVIEW_INTERVALS[intervalIndex],
        dueDate: addDays(effectiveDate, REVIEW_INTERVALS[intervalIndex]),
        lastReviewedAt: timestamp,
      };
      learning.words[attempt.vocabularyId] = word;
    });

    write(profileId, learning);
    return learning;
  }

  function getCoverage(profileId, dataset) {
    return summarize(read(profileId, dataset).words);
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
    getCoverage,
    getDailySession,
    getDailySessionsForDate,
    nextDailySessionKey,
    saveDailySession,
    normalizeCalendar,
  });
}
