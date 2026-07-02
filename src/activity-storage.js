const ACTIVITY_KEY_PREFIX = "tarjetas.activity.v1.";
const EMPTY_TOTALS = Object.freeze({ quizCount: 0, correctCount: 0, wrongCount: 0 });

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyDayNumber(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function calendarDaysBetween(earlierDateKey, laterDateKey) {
  return dateKeyDayNumber(laterDateKey) - dateKeyDayNumber(earlierDateKey);
}

function emptyActivity(today) {
  return {
    joinedDate: today,
    lastPracticeDate: null,
    currentStreak: 0,
    practiceDates: [],
    firstQuizzes: { ...EMPTY_TOTALS },
    allQuizzes: { ...EMPTY_TOTALS },
  };
}

function normalizeTotals(totals) {
  return {
    quizCount: Number.isInteger(totals?.quizCount) ? totals.quizCount : 0,
    correctCount: Number.isInteger(totals?.correctCount) ? totals.correctCount : 0,
    wrongCount: Number.isInteger(totals?.wrongCount) ? totals.wrongCount : 0,
  };
}

function normalizeActivity(value, today) {
  if (!value || typeof value !== "object") {
    return emptyActivity(today);
  }

  return {
    joinedDate: typeof value.joinedDate === "string" ? value.joinedDate : today,
    lastPracticeDate: typeof value.lastPracticeDate === "string" ? value.lastPracticeDate : null,
    currentStreak: Number.isInteger(value.currentStreak) ? value.currentStreak : 0,
    practiceDates: Array.isArray(value.practiceDates)
      ? [...new Set(value.practiceDates.filter((date) => typeof date === "string"))]
      : [],
    firstQuizzes: normalizeTotals(value.firstQuizzes),
    allQuizzes: normalizeTotals(value.allQuizzes),
  };
}

function addQuiz(totals, result) {
  totals.quizCount += 1;
  totals.correctCount += result.correctCount;
  totals.wrongCount += result.wrongCount;
}

function errorRate(totals) {
  const attempts = totals.correctCount + totals.wrongCount;
  return attempts === 0 ? null : totals.wrongCount / attempts;
}

function summarize(activity, today) {
  return Object.freeze({
    joinedDate: activity.joinedDate,
    membershipDays: Math.max(1, calendarDaysBetween(activity.joinedDate, today) + 1),
    daysPracticed: activity.practiceDates.length,
    currentStreak: activity.currentStreak,
    totalQuizzes: activity.allQuizzes.quizCount,
    firstQuizErrorRate: errorRate(activity.firstQuizzes),
    overallErrorRate: errorRate(activity.allQuizzes),
    firstQuizCount: activity.firstQuizzes.quizCount,
  });
}

export function createActivityStorage(storage, now = () => new Date()) {
  function keyFor(profileId) {
    return `${ACTIVITY_KEY_PREFIX}${profileId}`;
  }

  function read(profileId, today) {
    try {
      const serialized = storage.getItem(keyFor(profileId));
      return normalizeActivity(serialized ? JSON.parse(serialized) : null, today);
    } catch {
      return emptyActivity(today);
    }
  }

  function write(profileId, activity) {
    try {
      storage.setItem(keyFor(profileId), JSON.stringify(activity));
    } catch {
      // Quiz play remains available if browser storage is unavailable.
    }
  }

  function ensureMember(profileId) {
    const today = localDateKey(now());
    const activity = read(profileId, today);
    write(profileId, activity);
    return summarize(activity, today);
  }

  function getSummary(profileId) {
    const today = localDateKey(now());
    return summarize(read(profileId, today), today);
  }

  function recordCompletedQuiz(profileId, result) {
    if (!Number.isInteger(result.correctCount) || !Number.isInteger(result.wrongCount)) {
      throw new Error("Completed quiz counts must be integers.");
    }

    const today = localDateKey(now());
    const activity = read(profileId, today);
    const firstQuizToday = !activity.practiceDates.includes(today);

    addQuiz(activity.allQuizzes, result);

    if (firstQuizToday) {
      activity.practiceDates.push(today);
      addQuiz(activity.firstQuizzes, result);

      if (
        activity.lastPracticeDate
        && calendarDaysBetween(activity.lastPracticeDate, today) === 1
      ) {
        activity.currentStreak += 1;
      } else {
        activity.currentStreak = 1;
      }

      activity.lastPracticeDate = today;
    }

    write(profileId, activity);
    return Object.freeze({ ...summarize(activity, today), firstQuizToday });
  }

  return Object.freeze({ ensureMember, getSummary, recordCompletedQuiz });
}
