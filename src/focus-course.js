// Temporary course policy. Legacy curriculum history and schedules stay separate.
export const FOCUS_COURSE_ID = "spanish2-chapter1-section1-v1";
export const FOCUS_QUIZ_SIZE = 11;

function nextDay(date) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + 1));
  return value.toISOString().slice(0, 10);
}

export function emptyCourse() {
  return { courseId: FOCUS_COURSE_ID, introductionLessons: 0, words: {}, lessons: [] };
}

// Manual preferences affect scheduling, never the recorded answers or quiz score.
export function focusWordStatus(word) {
  const successes = Math.max(0, (word?.successes ?? 0) - (word?.reviewStartSuccesses ?? 0));
  const known = word?.manualPriority === "known";
  const pendingReview = word?.manualPriority === "review";
  return {
    successes, known, mastered: successes >= 2, retired: known,
    needsReview: !known && (pendingReview || word?.lastCorrect === false || successes === 0),
    firstCorrect: Boolean(word?.firstCorrect) && word?.reviewStartSuccesses === undefined,
    eligibleDate: pendingReview ? nextDay(word.manualPriorityDate) : word?.eligibleDate,
  };
}

export function setFocusWordPriority(state, wordId, priority, date) {
  if (!["known", "review", "normal"].includes(priority)) throw new Error("Unknown word preference.");
  const word = state.words[wordId];
  if (!word?.encounters) throw new Error("Only tested words can be changed.");
  if (state.lessons.at(-1)?.status === "in-progress") {
    throw new Error("Finish the current lesson before changing word preferences.");
  }
  state.priorityChanges ??= [];
  state.priorityChanges.push({ wordId, priority, date });
  if (priority === "normal") {
    delete word.manualPriority;
    delete word.manualPriorityDate;
    delete word.reviewStartSuccesses;
  } else {
    word.manualPriority = priority;
    word.manualPriorityDate = date;
    // A fresh review cycle requires two fresh first-answer successes.
    if (priority === "review") word.reviewStartSuccesses = word.successes;
  }
}

export function courseProgress(state, entries) {
  const tested = entries.filter((entry) => state.words[entry.id]?.encounters > 0);
  const statuses = tested.map((entry) => focusWordStatus(state.words[entry.id]));
  return {
    tested: tested.length,
    retired: statuses.filter((word) => word.retired).length,
    mastered: statuses.filter((word) => !word.known && word.mastered).length,
    known: statuses.filter((word) => word.known).length,
    needsReview: statuses.filter((word) => word.needsReview).length,
    neverCorrect: statuses.filter((word) => !word.retired && word.successes === 0).length,
    firstCorrect: statuses.filter((word) => !word.retired && word.successes === 1 && word.firstCorrect).length,
    recovered: statuses.filter((word) => !word.retired && word.successes === 1 && !word.firstCorrect).length,
    total: entries.length,
  };
}

export function planFocusLesson(entries, state, date, random = Math.random) {
  // Shuffle before a stable count sort: ties are random, lower counts always win.
  const leastCorrectFirst = (pool) => {
    const shuffled = [...pool];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }
    return shuffled.sort((a, b) => (state.words[a.id]?.successes ?? 0)
      - (state.words[b.id]?.successes ?? 0));
  };
  const unseen = entries.filter((entry) => !state.words[entry.id]?.encounters);
  const introducing = unseen.length > 0;
  const eligible = entries.filter((entry) => {
    const word = state.words[entry.id];
    const status = focusWordStatus(word);
    return word?.encounters > 0 && !status.known && status.eligibleDate <= date;
  });
  const retryIds = leastCorrectFirst(eligible.filter((entry) => {
    const word = state.words[entry.id];
    const status = focusWordStatus(word);
    return word.lastCorrect === false || status.successes === 0
      || (introducing && status.successes < 2
        && (word.everMissed || word.reviewStartSuccesses !== undefined) && word.lastDate < date);
  })).slice(0, 3).map((entry) => entry.id);
  const newWordIds = unseen.slice(0, FOCUS_QUIZ_SIZE - retryIds.length).map((entry) => entry.id);
  const chosen = new Set([...retryIds, ...newWordIds]);
  const scheduled = leastCorrectFirst(eligible.filter((entry) => !chosen.has(entry.id)
    && focusWordStatus(state.words[entry.id]).successes === 1
    && state.words[entry.id].lastCorrect !== false))
    .slice(0, FOCUS_QUIZ_SIZE - chosen.size);
  const firstCorrectIds = scheduled.filter((entry) => focusWordStatus(state.words[entry.id]).firstCorrect)
    .map((entry) => entry.id);
  const recoveredIds = scheduled.filter((entry) => !focusWordStatus(state.words[entry.id]).firstCorrect)
    .map((entry) => entry.id);
  scheduled.forEach((entry) => chosen.add(entry.id));
  const fillIds = leastCorrectFirst(eligible.filter((entry) => !chosen.has(entry.id)
    && focusWordStatus(state.words[entry.id]).successes > 0
    && state.words[entry.id].lastCorrect !== false))
    .slice(0, FOCUS_QUIZ_SIZE - chosen.size).map((entry) => entry.id);
  const questionIds = [...retryIds, ...newWordIds, ...firstCorrectIds, ...recoveredIds, ...fillIds];
  return {
    id: `${FOCUS_COURSE_ID}:lesson-${state.lessons.length + 1}`,
    number: state.lessons.length + 1,
    introductionNumber: introducing ? state.introductionLessons + 1 : null,
    date, status: "in-progress", stage: "quiz",
    newWordIds, firstCorrectIds, recoveredIds, retryIds, fillIds, questionIds,
    presentationIndex: 0, definitions: null, attempts: [], firstAnswers: {},
  };
}

export function recordFocusAttempt(state, lesson, attempt) {
  if (lesson.status !== "in-progress") throw new Error("This lesson is already complete.");
  if (!lesson.questionIds.includes(attempt.vocabularyId)) throw new Error("Word is outside this lesson.");
  lesson.attempts.push(attempt);
  // Reprises never change mastery or review eligibility.
  if (attempt.phase !== "main" || lesson.firstAnswers[attempt.vocabularyId]) return;
  lesson.firstAnswers[attempt.vocabularyId] = attempt;
  const prior = state.words[attempt.vocabularyId];
  const word = prior ?? { encounters: 0, successes: 0, firstCorrect: attempt.correct, everMissed: false };
  word.encounters += 1;
  word.successes += attempt.correct ? 1 : 0;
  if (word.manualPriority === "review") delete word.manualPriority;
  word.everMissed ||= !attempt.correct;
  word.lastCorrect = attempt.correct;
  word.lastDate = attempt.date;
  word.lastLesson = lesson.number;
  word.eligibleDate = attempt.correct ? attempt.date : nextDay(attempt.date);
  state.words[attempt.vocabularyId] = word;
}

export function finishFocusLesson(state, lesson, completedAt) {
  if (lesson.status === "complete") return;
  if (lesson.questionIds.some((id) => !lesson.firstAnswers[id])) {
    throw new Error("Finish every question before completing the lesson.");
  }
  const resolved = new Set(lesson.attempts.filter((attempt) => attempt.correct)
    .map((attempt) => attempt.vocabularyId));
  if (lesson.questionIds.some((id) => !resolved.has(id))) {
    throw new Error("Finish retry practice before completing the lesson.");
  }
  lesson.status = "complete";
  lesson.completedAt = completedAt;
  lesson.correctCount = lesson.attempts.filter((attempt) => attempt.correct).length;
  lesson.wrongCount = lesson.attempts.filter((attempt) => !attempt.correct).length;
  if (lesson.newWordIds.length > 0) state.introductionLessons += 1;
}

export function createFocusStorage(storage) {
  const key = (profileId) => `tarjetas.focus.v1.${FOCUS_COURSE_ID}.${profileId}`;
  function read(profileId) {
    const raw = storage.getItem(key(profileId));
    if (!raw) return emptyCourse();
    const state = JSON.parse(raw);
    if (state.courseId !== FOCUS_COURSE_ID || !state.words || !Array.isArray(state.lessons)
        || !Number.isInteger(state.introductionLessons)
        || state.introductionLessons < 0) {
      throw new Error("The saved course data could not be read. Your data has not been reset.");
    }
    return state;
  }
  function save(profileId, state) {
    // Surface write errors instead of claiming progress was saved.
    storage.setItem(key(profileId), JSON.stringify(state));
    return state;
  }
  return Object.freeze({ read, save });
}
