// Temporary course policy. Legacy curriculum history and schedules stay separate.
export const FOCUS_COURSE_ID = "spanish2-chapter1-section1-v1";
export const INTRO_LESSONS = 7;
export const NEW_WORDS_PER_LESSON = 11;

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
    successes, known, retired: known || successes >= 2,
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
    known: statuses.filter((word) => word.known).length,
    neverCorrect: statuses.filter((word) => !word.retired && word.successes === 0).length,
    firstCorrect: statuses.filter((word) => !word.retired && word.successes === 1 && word.firstCorrect).length,
    recovered: statuses.filter((word) => !word.retired && word.successes === 1 && !word.firstCorrect).length,
    total: entries.length,
  };
}

export function planFocusLesson(entries, state, date) {
  const introducing = state.introductionLessons < INTRO_LESSONS;
  const newWordIds = introducing
    ? entries.slice(state.introductionLessons * NEW_WORDS_PER_LESSON,
      (state.introductionLessons + 1) * NEW_WORDS_PER_LESSON).map((entry) => entry.id)
    : [];
  const eligible = entries.filter((entry) => {
    const word = state.words[entry.id];
    const status = focusWordStatus(word);
    return word?.encounters > 0 && !status.retired && status.eligibleDate <= date;
  }).sort((a, b) => {
    const left = state.words[a.id];
    const right = state.words[b.id];
    return left.lastLesson - right.lastLesson || a.curriculumRank - b.curriculumRank;
  });
  const firstCorrectIds = introducing ? [] : eligible.filter((entry) => (
    focusWordStatus(state.words[entry.id]).successes === 1 && focusWordStatus(state.words[entry.id]).firstCorrect
  )).slice(0, 7).map((entry) => entry.id);
  const recoveredIds = introducing ? [] : eligible.filter((entry) => (
    focusWordStatus(state.words[entry.id]).successes === 1 && !focusWordStatus(state.words[entry.id]).firstCorrect
  )).slice(0, 4).map((entry) => entry.id);
  const retryIds = eligible.filter((entry) => {
    const word = state.words[entry.id];
    return introducing
      ? (word.everMissed || word.reviewStartSuccesses !== undefined) && word.lastDate < date
      : focusWordStatus(word).successes === 0;
  }).slice(0, 3).map((entry) => entry.id);
  const questionIds = [...newWordIds, ...firstCorrectIds, ...recoveredIds, ...retryIds];
  return {
    id: `${FOCUS_COURSE_ID}:lesson-${state.lessons.length + 1}`,
    number: state.lessons.length + 1,
    introductionNumber: introducing ? state.introductionLessons + 1 : null,
    date, status: "in-progress", stage: newWordIds.length ? "new-words" : "quiz",
    newWordIds, firstCorrectIds, recoveredIds, retryIds, questionIds,
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
        || state.introductionLessons < 0 || state.introductionLessons > INTRO_LESSONS) {
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
