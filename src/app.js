import { createActivityStorage } from "./activity-storage.js?v=0.17.0";
import { APP_VERSION } from "./app-version.js?v=0.17.0";
import { createAssessmentSession } from "./assessment.js?v=0.17.0";
import { createDailySessionPlan, getReviewRoundIds } from "./daily-session.js?v=0.17.0";
import {
  buildDiagnosticExport,
  diagnosticFilename,
  downloadDiagnostic,
} from "./diagnostic-export.js?v=0.17.0";
import {
  createIndexedHistory,
  practiceSessionRecord,
  quizRoundRecord,
} from "./indexed-history.js?v=0.17.0";
import { createLearningStorage, localDateKey } from "./learning-storage.js?v=0.17.0";
import { eligibleForOrdinaryQuestion } from "./mastery-policy.js?v=0.17.0";
import { createOnboardingStorage } from "./onboarding-storage.js?v=0.17.0";
import { createProfileStorage } from "./profile-storage.js?v=0.17.0";
import { buildQuizFromAnswers } from "./questions.js?v=0.17.0";
import { selectQuizVocabulary } from "./quiz-selection.js?v=0.17.0";
import { createQuizSession } from "./quiz-session.js?v=0.17.0";
import { initializeRecognition } from "./recognition.js?v=0.17.0";
import {
  answerFeedback,
  buildAllWordsReview,
  buildAssessmentReview,
  buildHistoryReview,
  reviewGapLabel,
} from "./review-results.js?v=0.17.0";
import {
  buildSessionSharePayload,
  buildShareCardSvg,
  createShareImageFile,
  isFirstSessionOfDay,
  shareSessionResults,
} from "./share-results.js?v=0.17.0";
import { ensureCurrentStorageGeneration } from "./storage-generation.js?v=0.17.0";

const panels = {
  onboarding: document.querySelector("#onboarding-panel"),
  placement: document.querySelector("#placement-panel"),
  session: document.querySelector("#session-panel"),
  presentation: document.querySelector("#presentation-panel"),
  quiz: document.querySelector("#quiz-panel"),
  results: document.querySelector("#results-panel"),
  review: document.querySelector("#review-panel"),
};
const brandTitleElement = document.querySelector("#brand-title");
const startAssessmentButton = document.querySelector("#start-assessment-button");
const startPracticeButton = document.querySelector("#start-practice-button");
const startSessionButton = document.querySelector("#start-session-button");
const nextPresentationButton = document.querySelector("#next-presentation-button");
const newSessionButton = document.querySelector("#new-session-button");
const sessionEyebrowElement = document.querySelector("#session-eyebrow");
const placementLevelElement = document.querySelector("#placement-level");
const placementSummaryElement = document.querySelector("#placement-summary");
const reviewAssessmentButton = document.querySelector("#review-assessment-button");
const checkInCountElement = document.querySelector("#check-in-count");
const newWordCountElement = document.querySelector("#new-word-count");
const dueReviewCountElement = document.querySelector("#due-review-count");
const presentationProgressElement = document.querySelector("#presentation-progress");
const presentationSpanishElement = document.querySelector("#presentation-spanish");
const presentationEnglishElement = document.querySelector("#presentation-english");
const promptElement = document.querySelector("#prompt");
const choicesElement = document.querySelector("#choices");
const quizControlsElement = document.querySelector("#quiz-controls");
const pauseQuizButton = document.querySelector("#pause-quiz-button");
const showPreviousButton = document.querySelector("#show-previous-button");
const returnCurrentButton = document.querySelector("#return-current-button");
const quizTitleElement = document.querySelector("#quiz-title");
const directionLabelElement = document.querySelector("#direction-label");
const quizErrorElement = document.querySelector("#quiz-error");
const progressElement = document.querySelector("#quiz-progress");
const newQuizButton = document.querySelector("#new-quiz-button");
const resultsEyebrowElement = document.querySelector("#results-eyebrow");
const resultsTitleElement = document.querySelector("#results-title");
const resultsIntroElement = document.querySelector("#results-intro");
const finalRightElement = document.querySelector("#final-right");
const finalWrongElement = document.querySelector("#final-wrong");
const dailyCreditElement = document.querySelector("#daily-credit");
const streakElement = document.querySelector("#stat-streak");
const membershipDaysElement = document.querySelector("#stat-membership-days");
const practiceDaysElement = document.querySelector("#stat-practice-days");
const totalQuizzesElement = document.querySelector("#stat-total-quizzes");
const firstQuizErrorElement = document.querySelector("#stat-first-error");
const overallErrorElement = document.querySelector("#stat-overall-error");
const coverageReportElement = document.querySelector("#coverage-report");
const coverageRowsElement = document.querySelector("#coverage-rows");
const shareCardPreviewElement = document.querySelector("#share-card-preview");
const shareCardImageElement = document.querySelector("#share-card-image");
const shareResultsButton = document.querySelector("#share-results-button");
const shareResultsStatusElement = document.querySelector("#share-results-status");
const reviewResultsButton = document.querySelector("#review-results-button");
const reviewTitleElement = document.querySelector("#review-title");
const reviewSummaryElement = document.querySelector("#review-summary");
const reviewSectionsElement = document.querySelector("#review-sections");
const reviewAllWordsButton = document.querySelector("#review-all-words-button");
const backFromReviewButton = document.querySelector("#back-from-review-button");
const exportButton = document.querySelector("#export-diagnostics");
const exportStatusElement = document.querySelector("#export-status");

await ensureCurrentStorageGeneration(window.localStorage, window.indexedDB);

const activityStorage = createActivityStorage(window.localStorage);
const onboardingStorage = createOnboardingStorage(window.localStorage);
const learningStorage = createLearningStorage(window.localStorage);
const historyStorage = createIndexedHistory(window.indexedDB);
const percentFormatter = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 1,
});

let vocabulary = [];
let vocabularyById = new Map();
let datasetMetadata = null;
let vocabularyPromise = null;
let quizSession = null;
let assessmentSession = null;
let onboardingRecord = null;
let dailySession = null;
let activeProfileId = null;
let activeProfile = null;
let roundKind = null;
let roundEntries = [];
let roundFirstAttempts = [];
let currentRoundRecord = null;
let roundAttemptCount = 0;
let precedingAttemptIds = new Map();
const pendingHistoryWrites = new Set();
let latestAssessmentResult = null;
let reviewContext = null;
let reviewReturn = null;
let sectionReviewState = [];
let allWordsReviewState = [];
let showingAllWords = false;
let shareResultsPayload = null;
let choiceRevealTimer = null;
let autoAdvanceTimer = null;
let autoAdvanceCallback = null;
let lastFeedbackSnapshot = null;
let quizPaused = false;
let currentQuizRenderer = null;

const tierLabels = Object.freeze({
  foundation: "Foundation",
  everyday: "Everyday",
  expanding: "Expanding",
});

function dateFromKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function displayDate(dateKey) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dateFromKey(dateKey));
}

function hideMainPanels() {
  clearChoiceRevealTimer();
  clearAutoAdvanceTimer();
  quizPaused = false;
  hideQuizControls();
  Object.values(panels).forEach((panel) => { panel.hidden = true; });
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function clearChoiceRevealTimer() {
  if (choiceRevealTimer) {
    window.clearTimeout(choiceRevealTimer);
    choiceRevealTimer = null;
  }
}

function clearAutoAdvanceTimer({ clearCallback = true } = {}) {
  if (autoAdvanceTimer) {
    window.clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }
  if (clearCallback) {
    autoAdvanceCallback = null;
  }
}

function pauseAutoAdvanceTimer() {
  clearAutoAdvanceTimer({ clearCallback: false });
}

function scheduleAutoAdvance(callback, delay) {
  clearAutoAdvanceTimer();
  autoAdvanceCallback = callback;
  autoAdvanceTimer = window.setTimeout(() => {
    const pendingCallback = autoAdvanceCallback;
    clearAutoAdvanceTimer();
    pendingCallback?.();
  }, delay);
}

function runPendingAutoAdvance() {
  const pendingCallback = autoAdvanceCallback;
  clearAutoAdvanceTimer();
  pendingCallback?.();
}

function choiceRevealDelay() {
  return prefersReducedMotion() ? 250 : 1000;
}

function hideQuizControls() {
  quizControlsElement.hidden = true;
}

function updateQuizControls(mode = "question") {
  quizControlsElement.hidden = false;
  pauseQuizButton.hidden = mode === "previous";
  showPreviousButton.hidden = mode === "previous";
  returnCurrentButton.hidden = mode !== "previous";
  pauseQuizButton.textContent = quizPaused ? "Resume" : "Pause";
  showPreviousButton.disabled = !lastFeedbackSnapshot;
  returnCurrentButton.firstChild.textContent = autoAdvanceCallback
    ? "Continue "
    : "Return to current question ";
}

function renderProgress(state) {
  const prefix = roundKind === "check-in" ? "Step 1 · " : roundKind === "review" ? "Step 3 · " : "";
  if (state.phase === "main") {
    progressElement.textContent = `${prefix}Question ${state.mainPosition} of ${state.totalQuestions}`;
  } else {
    const noun = state.reviewRemaining === 1 ? "word" : "words";
    progressElement.textContent = `${prefix}Review · ${state.reviewRemaining} ${noun} left`;
  }
}

function renderChoices(currentQuestion, knownWrongAnswers, onAnswer) {
  choicesElement.replaceChildren();
  choicesElement.classList.remove("choices-pending");
  choicesElement.removeAttribute("aria-busy");
  quizErrorElement.hidden = true;

  currentQuestion.choices.forEach((choice, index) => {
    const button = document.createElement("button");
    const choicePrefix = `${String.fromCharCode(65 + index)}.`;
    button.type = "button";
    button.className = "choice";
    button.dataset.answer = choice;
    button.textContent = `${choicePrefix} ${choice}`;
    button.lang = currentQuestion.answerLanguage;

    if (knownWrongAnswers.has(choice)) {
      button.disabled = true;
      button.classList.add("eliminated");
      button.setAttribute("aria-label", `${choicePrefix} ${choice}, previously incorrect`);
    } else {
      button.addEventListener("click", onAnswer);
    }
    choicesElement.append(button);
  });
}

function scheduleChoiceReveal(currentQuestion, knownWrongAnswers, onAnswer) {
  clearChoiceRevealTimer();
  choicesElement.replaceChildren();
  choicesElement.classList.add("choices-pending");
  choicesElement.setAttribute("aria-busy", "true");
  quizErrorElement.hidden = true;

  const prompt = document.createElement("p");
  prompt.className = "choice-delay";
  prompt.textContent = "Think of the answer… choices appear in a moment.";
  choicesElement.append(prompt);

  choiceRevealTimer = window.setTimeout(() => {
    choiceRevealTimer = null;
    renderChoices(currentQuestion, knownWrongAnswers, onAnswer);
    choicesElement.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
  }, choiceRevealDelay());
}

function buildFeedbackSnapshot({
  kind,
  state,
  selectedAnswer,
  correct,
  repriseReminder = null,
}) {
  return Object.freeze({
    kind,
    question: state.question,
    selectedAnswer,
    correct,
    repriseReminder,
    knownWrongAnswers: Object.freeze([...(state.knownWrongAnswers ?? [])]),
    directionLabel: directionLabelElement.textContent,
    quizTitle: quizTitleElement.textContent,
    progress: progressElement.textContent,
    showsTeaching: correct && state.question.hasTeachingVariant,
  });
}

function renderFeedbackSnapshot(snapshot, { previous = false } = {}) {
  clearChoiceRevealTimer();
  progressElement.textContent = snapshot.progress;
  directionLabelElement.textContent = previous
    ? `Previous · ${snapshot.directionLabel}`
    : snapshot.directionLabel;
  quizTitleElement.textContent = previous ? "Previous question" : snapshot.quizTitle;
  promptElement.textContent = snapshot.question.prompt;
  promptElement.lang = snapshot.question.promptLanguage;
  renderChoices(
    snapshot.question,
    new Set(snapshot.knownWrongAnswers),
    () => {},
  );
  showAnswerOutcome(
    snapshot.question,
    snapshot.selectedAnswer,
    snapshot.correct,
    snapshot.repriseReminder,
  );
  updateQuizControls(previous ? "previous" : "question");
}

function showAnswerOutcome(question, selectedAnswer, correct, repriseReminder = null) {
  choicesElement.querySelectorAll("button").forEach((button) => {
    button.disabled = true;
    if (correct && button.dataset.answer === question.correctAnswer) {
      button.classList.add("correct");
    }
    if (!correct && button.dataset.answer === selectedAnswer) {
      button.classList.add("incorrect");
    }
  });
  quizErrorElement.className = `feedback ${correct ? "success" : "error"}`;
  quizErrorElement.replaceChildren(document.createTextNode(answerFeedback(correct)));
  if (
    correct
    && question.hasTeachingVariant
    && question.teachingSpanish
    && question.teachingEnglish
  ) {
    const teachingReveal = document.createElement("span");
    teachingReveal.className = "teaching-reveal";
    const spanish = document.createElement("span");
    spanish.lang = "es";
    spanish.textContent = question.teachingSpanish;
    const separator = document.createTextNode(" ↔ ");
    const english = document.createElement("span");
    english.lang = "en";
    english.textContent = question.teachingEnglish;
    teachingReveal.append(spanish, separator, english);
    quizErrorElement.append(teachingReveal);
  }
  if (repriseReminder) {
    const reminder = document.createElement("span");
    reminder.className = "reprise-reminder";
    reminder.textContent = `Last time you answered “${repriseReminder.selectedAnswer}” for “${repriseReminder.prompt}”.`;
    quizErrorElement.append(reminder);
  }
  quizErrorElement.hidden = false;
}

function feedbackDelay({ hasRepriseReminder = false, showsTeaching = false } = {}) {
  if (hasRepriseReminder) {
    return prefersReducedMotion() ? 900 : 2000;
  }
  if (showsTeaching) {
    return prefersReducedMotion() ? 600 : 1400;
  }
  return prefersReducedMotion() ? 300 : 850;
}

function renderQuestion() {
  currentQuizRenderer = renderQuestion;
  clearAutoAdvanceTimer();
  quizPaused = false;
  const state = quizSession.getState();
  const currentQuestion = state.question;
  renderProgress(state);
  const isSpanishPrompt = state.direction === "spanish-to-english";
  directionLabelElement.textContent = roundKind === "check-in"
    ? `Check-in · ${isSpanishPrompt ? "Spanish → English" : "English → Spanish"}`
    : roundKind === "review"
      ? `Due review · ${isSpanishPrompt ? "Spanish → English" : "English → Spanish"}`
      : isSpanishPrompt ? "Spanish → English" : "English → Spanish";
  quizTitleElement.textContent = isSpanishPrompt
    ? "Choose the English translation."
    : "Choose the Spanish translation.";
  promptElement.textContent = currentQuestion.prompt;
  promptElement.lang = currentQuestion.promptLanguage;
  scheduleChoiceReveal(currentQuestion, new Set(state.knownWrongAnswers), handleAnswer);
  updateQuizControls("question");
}

function renderAssessmentQuestion() {
  currentQuizRenderer = renderAssessmentQuestion;
  clearAutoAdvanceTimer();
  quizPaused = false;
  const state = assessmentSession.getState();
  const currentQuestion = state.question;
  const isSpanishPrompt = state.direction === "spanish-to-english";
  progressElement.textContent = `Starting point ${state.position} of ${state.totalQuestions}`;
  directionLabelElement.textContent = `${tierLabels[state.tier]} · ${isSpanishPrompt ? "Spanish → English" : "English → Spanish"}`;
  quizTitleElement.textContent = isSpanishPrompt
    ? "Choose the English translation."
    : "Choose the Spanish translation.";
  promptElement.textContent = currentQuestion.prompt;
  promptElement.lang = currentQuestion.promptLanguage;
  scheduleChoiceReveal(currentQuestion, new Set(), handleAssessmentAnswer);
  updateQuizControls("question");
}

function attemptFromState(state, correct, source) {
  const entry = vocabularyById.get(state.question.vocabularyId);
  return {
    vocabularyId: entry.id,
    tier: entry.tier,
    spanish: entry.spanish,
    english: entry.english,
    partOfSpeech: entry.partOfSpeech,
    direction: state.direction,
    correct,
    source,
  };
}

function recordImmutableAttempt(state, selectedAnswer, correct) {
  const attemptId = historyStorage.createId("attempt");
  const vocabularyId = state.question.vocabularyId;
  roundAttemptCount += 1;
  const selectedDistractor = state.question.distractors?.find(
    (distractor) => distractor.answer === selectedAnswer,
  );
  const record = {
    id: attemptId,
    quizRoundId: currentRoundRecord.id,
    practiceSessionId: currentRoundRecord.practiceSessionId,
    profileId: activeProfileId,
    vocabularyId,
    precedingAttemptId: precedingAttemptIds.get(vocabularyId) ?? null,
    stage: currentRoundRecord.stage,
    phase: state.phase,
    direction: state.direction,
    promptLanguage: state.question.promptLanguage,
    answerLanguage: state.question.answerLanguage,
    promptText: state.question.prompt,
    choices: [...state.question.choices],
    correctAnswer: state.question.correctAnswer,
    distractors: state.question.distractors?.map((distractor) => ({ ...distractor })) ?? [],
    selectedAnswer,
    selectedVocabularyId: correct ? vocabularyId : selectedDistractor?.vocabularyId ?? null,
    correct,
    attemptIndex: roundAttemptCount,
    mainQuestionIndex: state.mainPosition,
    answeredAt: historyStorage.nowIso(),
  };
  precedingAttemptIds.set(vocabularyId, attemptId);
  queueHistoryWrite(historyStorage.saveAttempt(record));
}

function handleAnswer(event) {
  const before = quizSession.getState();
  const selectedAnswer = event.currentTarget.dataset.answer;
  const answer = quizSession.submitAnswer(selectedAnswer);
  recordImmutableAttempt(before, selectedAnswer, answer.correct);
  if (before.phase === "main") {
    roundFirstAttempts.push(attemptFromState(before, answer.correct, roundKind ?? "extra"));
  }
  lastFeedbackSnapshot = buildFeedbackSnapshot({
    kind: "quiz",
    state: before,
    selectedAnswer,
    correct: answer.correct,
    repriseReminder: answer.repriseReminder,
  });
  renderFeedbackSnapshot(lastFeedbackSnapshot);
  scheduleAutoAdvance(() => {
    const state = quizSession.advance();
    if (state.phase === "complete") {
      completeQuizRound(state);
    } else {
      renderQuestion();
    }
  }, feedbackDelay({
    hasRepriseReminder: Boolean(answer.repriseReminder),
    showsTeaching: answer.correct && before.question.hasTeachingVariant,
  }));
}

function handleAssessmentAnswer(event) {
  const before = assessmentSession.getState();
  const selectedAnswer = event.currentTarget.dataset.answer;
  const correct = selectedAnswer === before.question.correctAnswer;
  const state = assessmentSession.submitAnswer(selectedAnswer);
  lastFeedbackSnapshot = buildFeedbackSnapshot({
    kind: "assessment",
    state: before,
    selectedAnswer,
    correct,
  });
  renderFeedbackSnapshot(lastFeedbackSnapshot);
  scheduleAutoAdvance(() => {
    if (state.phase === "complete") {
      latestAssessmentResult = assessmentSession.getResult();
      onboardingRecord = onboardingStorage.save(
        activeProfileId,
        datasetMetadata,
        latestAssessmentResult,
      );
      learningStorage.seedOnboarding(activeProfileId, datasetMetadata, onboardingRecord, vocabulary);
      showPlacement(onboardingRecord.placement);
    } else {
      renderAssessmentQuestion();
    }
  }, feedbackDelay({ showsTeaching: correct && before.question.hasTeachingVariant }));
}

function renderPauseCard() {
  choicesElement.replaceChildren();
  choicesElement.classList.add("choices-pending");
  choicesElement.removeAttribute("aria-busy");
  quizErrorElement.hidden = true;
  const pauseCard = document.createElement("p");
  pauseCard.className = "pause-card";
  const title = document.createElement("strong");
  title.textContent = "Paused";
  const note = document.createElement("span");
  note.textContent = "No answer will be recorded until you choose one.";
  pauseCard.append(title, note);
  choicesElement.append(pauseCard);
}

function toggleQuizPause() {
  if (quizPaused) {
    quizPaused = false;
    if (autoAdvanceCallback && lastFeedbackSnapshot) {
      renderFeedbackSnapshot(lastFeedbackSnapshot);
      scheduleAutoAdvance(
        autoAdvanceCallback,
        feedbackDelay({
          hasRepriseReminder: Boolean(lastFeedbackSnapshot.repriseReminder),
          showsTeaching: lastFeedbackSnapshot.showsTeaching,
        }),
      );
    } else {
      currentQuizRenderer?.();
    }
    return;
  }

  quizPaused = true;
  clearChoiceRevealTimer();
  pauseAutoAdvanceTimer();
  quizTitleElement.textContent = "Paused";
  promptElement.textContent = "Paused";
  promptElement.removeAttribute("lang");
  renderPauseCard();
  updateQuizControls("question");
  pauseQuizButton.focus();
}

function showPreviousFeedback() {
  if (!lastFeedbackSnapshot) return;
  quizPaused = false;
  clearChoiceRevealTimer();
  pauseAutoAdvanceTimer();
  renderFeedbackSnapshot(lastFeedbackSnapshot, { previous: true });
  returnCurrentButton.focus();
}

function returnToCurrentQuestion() {
  quizPaused = false;
  if (autoAdvanceCallback) {
    runPendingAutoAdvance();
  } else {
    currentQuizRenderer?.();
  }
}

function showOnboarding() {
  hideMainPanels();
  panels.onboarding.hidden = false;
  startAssessmentButton.focus();
}

function showPlacement(placement) {
  hideMainPanels();
  panels.placement.hidden = false;
  const frontierLabel = tierLabels[placement.learningFrontier];
  placementLevelElement.textContent = frontierLabel;
  if (!placement.knownThrough) {
    placementSummaryElement.textContent = "We found a few Foundation gaps, so we’ll strengthen those first.";
  } else if (placement.knownThrough === "expanding") {
    placementSummaryElement.textContent = "Expanding vocabulary already looks familiar. We’ll keep testing the edges and adjust.";
  } else {
    placementSummaryElement.textContent = `${tierLabels[placement.knownThrough]} vocabulary looks familiar. We’ll begin around ${frontierLabel} and keep adjusting.`;
  }
  reviewAssessmentButton.hidden = !latestAssessmentResult;
  startPracticeButton.focus();
}

function entryList(ids) {
  return ids.map((id) => vocabularyById.get(id)).filter(Boolean);
}

function queueHistoryWrite(promise) {
  pendingHistoryWrites.add(promise);
  promise.finally(() => pendingHistoryWrites.delete(promise));
}

function saveDailySession() {
  learningStorage.saveDailySession(activeProfileId, datasetMetadata, dailySession);
  queueHistoryWrite(historyStorage.savePracticeSession(
    practiceSessionRecord(activeProfileId, dailySession),
  ));
}

function showSessionIntro() {
  hideMainPanels();
  panels.session.hidden = false;
  sessionEyebrowElement.textContent = dailySession.repeat
    ? "Another full session today"
    : "Today’s practice session";
  checkInCountElement.textContent = `${dailySession.checkInIds.length} check-in words`;
  newWordCountElement.textContent = dailySession.newWordIds.length > 0
    ? `${dailySession.newWordIds.length} Spanish–English pairs`
    : "Paused while reviews are caught up";
  dueReviewCountElement.textContent = `${dailySession.reviewIds.length} words in short rounds`;
  startSessionButton.firstChild.textContent = dailySession.stage === "intro"
    ? "Begin check-in "
    : "Resume session ";
  startSessionButton.focus();
}

function prepareDailySession() {
  learningStorage.seedOnboarding(activeProfileId, datasetMetadata, onboardingRecord, vocabulary);
  const actualNow = new Date();
  const today = localDateKey(actualNow);
  learningStorage.normalizeCalendar(activeProfileId, datasetMetadata, today);
  learningStorage.normalizeMastery(
    activeProfileId,
    datasetMetadata,
    vocabulary,
    onboardingRecord.placement,
    today,
  );
  activityStorage.normalizeCalendar(activeProfileId, actualNow);
  dailySession = learningStorage.getDailySession(activeProfileId, datasetMetadata, today);
  if (!dailySession) {
    dailySession = createDailySessionPlan(
      vocabulary,
      onboardingRecord.placement,
      learningStorage.getSnapshot(activeProfileId, datasetMetadata),
      today,
    );
    dailySession.sessionKey = learningStorage.nextDailySessionKey(
      activeProfileId,
      datasetMetadata,
      today,
    );
    dailySession.historyId = `${activeProfileId}:${dailySession.sessionKey}`;
  }
  saveDailySession();
  if (dailySession.status === "complete") {
    showSessionResults();
  } else {
    showSessionIntro();
  }
}

function startOrResumeSession() {
  if (dailySession.stage === "new-words") {
    showPresentation();
  } else if (dailySession.stage === "due-reviews") {
    startNextReviewRound();
  } else {
    startCheckIn();
  }
}

function startRound(entries, kind) {
  hideMainPanels();
  panels.quiz.hidden = false;
  lastFeedbackSnapshot = null;
  roundKind = kind;
  roundEntries = entries;
  roundFirstAttempts = [];
  roundAttemptCount = 0;
  precedingAttemptIds = new Map();
  const definitions = buildQuizFromAnswers(vocabulary, entries);
  quizSession = createQuizSession(definitions);
  currentRoundRecord = quizRoundRecord({
    id: historyStorage.createId("round"),
    profileId: activeProfileId,
    practiceSessionId: kind === "extra" ? null : dailySession.historyId,
    stage: kind === "review" ? "due-review" : kind,
    definitions,
    startedAt: historyStorage.nowIso(),
  });
  queueHistoryWrite(historyStorage.saveQuizRound(currentRoundRecord));
  renderQuestion();
}

function startCheckIn() {
  dailySession.stage = "check-in";
  saveDailySession();
  const entries = entryList(dailySession.checkInIds);
  if (entries.length === 0) {
    beginNewWords();
    return;
  }
  startRound(entries, "check-in");
}

function beginNewWords() {
  dailySession.stage = "new-words";
  dailySession.presentedWordIds ??= [];
  saveDailySession();
  if (dailySession.newWordIds.length === 0) {
    beginDueReviews();
  } else {
    showPresentation();
  }
}

function showPresentation() {
  const entries = entryList(dailySession.newWordIds);
  const entry = entries[dailySession.newWordIndex];
  if (!entry) {
    beginDueReviews();
    return;
  }
  dailySession.presentedWordIds ??= [];
  if (!dailySession.presentedWordIds.includes(entry.id)) {
    learningStorage.recordPresentations(
      activeProfileId,
      datasetMetadata,
      [entry],
      dailySession.date,
    );
    dailySession.presentedWordIds.push(entry.id);
    saveDailySession();
  }
  hideMainPanels();
  panels.presentation.hidden = false;
  presentationProgressElement.textContent = `Word ${dailySession.newWordIndex + 1} of ${entries.length}`;
  presentationSpanishElement.textContent = entry.spanish;
  presentationEnglishElement.textContent = entry.english;
  nextPresentationButton.firstChild.textContent = dailySession.newWordIndex + 1 === entries.length
    ? "Begin reviews "
    : "Next word ";
  nextPresentationButton.focus();
}

function advancePresentation() {
  dailySession.newWordIndex += 1;
  saveDailySession();
  showPresentation();
}

function beginDueReviews() {
  dailySession.stage = "due-reviews";
  saveDailySession();
  startNextReviewRound();
}

function startNextReviewRound() {
  const ids = getReviewRoundIds(dailySession);
  if (ids.length === 0) {
    completeDailySession();
    return;
  }
  startRound(entryList(ids), "review");
}

function completeQuizRound(state) {
  currentRoundRecord = {
    ...currentRoundRecord,
    status: "completed",
    correctCount: state.correctCount,
    wrongCount: state.wrongCount,
    completedAt: historyStorage.nowIso(),
  };
  queueHistoryWrite(historyStorage.saveQuizRound(currentRoundRecord));
  const effectiveDate = roundKind === "extra" ? undefined : dailySession.date;
  learningStorage.recordFirstAttempts(
    activeProfileId,
    datasetMetadata,
    roundFirstAttempts,
    effectiveDate,
    onboardingRecord?.placement,
  );
  const activity = activityStorage.recordCompletedQuiz(activeProfileId, {
    correctCount: state.correctCount,
    wrongCount: state.wrongCount,
  }, effectiveDate ? dateFromKey(effectiveDate) : undefined);

  if (roundKind === "extra") {
    showQuizResults(state, activity);
    return;
  }

  dailySession.correctCount += state.correctCount;
  dailySession.wrongCount += state.wrongCount;
  dailySession.quizRounds += 1;
  dailySession.streakCredited ||= activity.firstQuizToday;

  if (roundKind === "check-in") {
    roundFirstAttempts.filter((attempt) => !attempt.correct).forEach((attempt) => {
      if (!dailySession.reviewIds.includes(attempt.vocabularyId)) {
        dailySession.reviewIds.push(attempt.vocabularyId);
      }
    });
    beginNewWords();
  } else {
    dailySession.reviewCursor += roundEntries.length;
    saveDailySession();
    startNextReviewRound();
  }
}

function completeDailySession() {
  dailySession.status = "complete";
  dailySession.stage = "complete";
  dailySession.completedAt = new Date().toISOString();
  saveDailySession();
  showSessionResults();
}

function renderActivity(summary) {
  streakElement.textContent = summary.currentStreak;
  membershipDaysElement.textContent = summary.membershipDays;
  practiceDaysElement.textContent = summary.daysPracticed;
  totalQuizzesElement.textContent = summary.totalQuizzes;
  firstQuizErrorElement.textContent = percentFormatter.format(summary.firstQuizErrorRate ?? 0);
  overallErrorElement.textContent = percentFormatter.format(summary.overallErrorRate ?? 0);
}

function renderCoverage() {
  const coverage = learningStorage.getCoverage(activeProfileId, datasetMetadata);
  coverageRowsElement.replaceChildren();
  Object.entries(tierLabels).forEach(([tier, label]) => {
    const row = document.createElement("div");
    row.className = "coverage-row";
    const total = vocabulary.filter((entry) => entry.tier === tier).length;
    row.innerHTML = `<strong>${label}</strong><span>${coverage[tier].tested}/${total} tested</span><span class="coverage-correct">${coverage[tier].latestCorrect} right</span><span class="coverage-wrong">${coverage[tier].latestWrong} wrong</span>`;
    coverageRowsElement.append(row);
  });
  coverageReportElement.hidden = false;
}

function reviewItemElement(item, kind) {
  const listItem = document.createElement("li");
  listItem.className = `review-item ${kind === "presentations" ? "review-pair" : ""}`;
  const mark = document.createElement("span");
  const content = document.createElement("div");

  if (kind === "presentations" || kind === "vocabulary") {
    mark.className = "review-mark";
    mark.textContent = "•";
    const pair = document.createElement("strong");
    const detail = document.createElement("span");
    pair.textContent = `${item.spanish} — ${item.english}`;
    detail.className = "review-answer";
    detail.textContent = reviewGapLabel(item.reviewGapDays);
    content.append(pair, detail);
  } else {
    mark.className = `review-mark ${item.correct ? "correct" : "incorrect"}`;
    mark.textContent = item.correct ? "✓" : "✕";
    mark.setAttribute("aria-label", item.correct ? "Correct" : "Incorrect");
    const answer = document.createElement("strong");
    const detail = document.createElement("span");
    answer.textContent = `${item.prompt} → ${item.correctAnswer}`;
    detail.className = "review-answer";
    const resultText = item.correct ? "Right" : `Your answer: ${item.selectedAnswer}`;
    const recoveryText = item.recoveryAttempts > 0
      ? ` · ${item.recoveryAttempts} follow-up ${item.recoveryAttempts === 1 ? "try" : "tries"}`
      : "";
    detail.textContent = `${resultText}${recoveryText} · ${reviewGapLabel(item.reviewGapDays)}`;
    content.append(answer, detail);
  }

  listItem.append(mark, content);
  return listItem;
}

function renderReviewSections(title, sections, summary = null) {
  reviewTitleElement.textContent = title;
  reviewSectionsElement.replaceChildren();
  const questionSections = sections.filter((section) => section.kind === "questions");
  const correct = questionSections.reduce((sum, section) => sum + section.correctCount, 0);
  const wrong = questionSections.reduce((sum, section) => sum + section.wrongCount, 0);
  reviewSummaryElement.textContent = summary ?? (questionSections.length > 0
    ? `${correct} right and ${wrong} wrong on first presentation. Longer review gaps show stronger demonstrated mastery.`
    : "Presented vocabulary. Longer review gaps show stronger demonstrated mastery.");

  if (sections.length === 0) {
    const empty = document.createElement("p");
    empty.className = "onboarding-note";
    empty.textContent = "No detailed question history is available for this earlier result.";
    reviewSectionsElement.append(empty);
    return;
  }

  sections.forEach((section) => {
    const container = document.createElement("section");
    container.className = "review-section";
    const header = document.createElement("div");
    header.className = "review-section-header";
    const heading = document.createElement("h2");
    heading.textContent = section.title;
    header.append(heading);
    if (section.kind === "questions") {
      const score = document.createElement("span");
      score.className = "review-section-score";
      score.textContent = `${section.correctCount} right · ${section.wrongCount} wrong`;
      header.append(score);
    }
    const list = document.createElement("ul");
    list.className = "review-items";
    section.items.forEach((item) => list.append(reviewItemElement(item, section.kind)));
    if (section.items.length === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "review-answer";
      emptyItem.textContent = "No stored questions for this section.";
      list.append(emptyItem);
    }
    container.append(header, list);
    reviewSectionsElement.append(container);
  });
}

async function showReviewResults() {
  if (!reviewContext) return;
  hideMainPanels();
  panels.review.hidden = false;
  reviewTitleElement.textContent = "Loading review…";
  reviewSummaryElement.textContent = "";
  reviewSectionsElement.replaceChildren();
  reviewAllWordsButton.hidden = true;
  showingAllWords = false;

  let sections;
  const learning = learningStorage.getSnapshot(activeProfileId, datasetMetadata);
  if (reviewContext.type === "assessment") {
    sections = buildAssessmentReview(reviewContext.result, vocabulary, learning.words);
  } else {
    await Promise.allSettled([...pendingHistoryWrites]);
    const history = await historyStorage.getProfileHistory(activeProfileId);
    sections = buildHistoryReview({
      rounds: history.quizRounds,
      attempts: history.attempts,
      practiceSessionId: reviewContext.practiceSessionId,
      roundId: reviewContext.roundId,
      newWords: reviewContext.newWords ?? [],
      learningWords: learning.words,
    });
  }
  sectionReviewState = sections;
  allWordsReviewState = buildAllWordsReview({
    vocabularyIds: reviewContext.allWordIds ?? [],
    vocabulary,
    learningWords: learning.words,
  });
  reviewAllWordsButton.hidden = allWordsReviewState.length === 0;
  reviewAllWordsButton.textContent = "Review all words seen this day";
  renderReviewSections(reviewContext.title, sectionReviewState);
  backFromReviewButton.focus();
}

function toggleAllWordsReview() {
  if (allWordsReviewState.length === 0) return;
  showingAllWords = !showingAllWords;
  if (showingAllWords) {
    const count = allWordsReviewState[0].items.length;
    const dateLabel = reviewContext.date ? ` · ${displayDate(reviewContext.date)}` : "";
    renderReviewSections(
      `All words seen${dateLabel}`,
      allWordsReviewState,
      `${count} distinct ${count === 1 ? "word" : "words"}. Longer review gaps show stronger demonstrated mastery.`,
    );
    reviewAllWordsButton.textContent = "Back to section results";
  } else {
    renderReviewSections(reviewContext.title, sectionReviewState);
    reviewAllWordsButton.textContent = "Review all words seen this day";
  }
}

function sessionWordIds(session) {
  if (!session) return [];
  return [...new Set([
    ...(session.checkInIds ?? []),
    ...(session.newWordIds ?? []),
    ...(session.reviewIds ?? []),
  ])];
}

function dayWordIds(date = localDateKey(new Date())) {
  return [...new Set(
    learningStorage.getDailySessionsForDate(activeProfileId, datasetMetadata, date)
      .flatMap((session) => sessionWordIds(session)),
  )];
}

function showResultsBase(correctCount, wrongCount, summary) {
  hideMainPanels();
  panels.results.hidden = false;
  finalRightElement.textContent = correctCount;
  finalWrongElement.textContent = wrongCount;
  renderActivity(summary);
  renderCoverage();
  newQuizButton.focus();
}

function showSessionResults() {
  resultsEyebrowElement.textContent = "Daily session complete";
  resultsTitleElement.textContent = "¡Buen trabajo!";
  resultsIntroElement.textContent = `You finished ${dailySession.quizRounds} short quiz rounds and met ${dailySession.newWordIds.length} new words.`;
  dailyCreditElement.textContent = dailySession.streakCredited
    ? "Today’s first check-in counted toward your streak."
    : "You had already earned today’s streak credit—and this session still counts.";
  newQuizButton.firstChild.textContent = "Start additional quiz ";
  newSessionButton.hidden = false;
  const activitySummary = activityStorage.getSummary(
    activeProfileId,
    dateFromKey(dailySession.date),
  );
  shareResultsStatusElement.textContent = "";
  shareResultsButton.hidden = !isFirstSessionOfDay(dailySession);
  shareResultsPayload = shareResultsButton.hidden ? null : buildSessionSharePayload({
    displayName: activeProfile.displayName,
    distinctWords: sessionWordIds(dailySession).length,
    newWords: dailySession.newWordIds.length,
    retries: dailySession.wrongCount,
    streak: activitySummary.currentStreak,
  });
  shareCardPreviewElement.hidden = !shareResultsPayload;
  if (shareResultsPayload) {
    const svg = buildShareCardSvg(shareResultsPayload);
    shareCardImageElement.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    shareCardImageElement.alt = `${activeProfile.displayName}’s Spanish practice results: ${sessionWordIds(dailySession).length} words practiced, ${dailySession.newWordIds.length} new words, ${dailySession.wrongCount} retries, ${activitySummary.currentStreak}-day streak.`;
  } else {
    shareCardImageElement.removeAttribute("src");
  }
  reviewContext = {
    type: "session",
    title: `Session review · ${displayDate(dailySession.date)}`,
    practiceSessionId: dailySession.historyId,
    newWords: entryList(dailySession.newWordIds),
    date: dailySession.date,
    allWordIds: dayWordIds(dailySession.date),
  };
  reviewReturn = showSessionResults;
  showResultsBase(
    dailySession.correctCount,
    dailySession.wrongCount,
    activitySummary,
  );
}

function showQuizResults(state, activity) {
  resultsEyebrowElement.textContent = "Quiz complete";
  resultsTitleElement.textContent = "¡Terminado!";
  resultsIntroElement.textContent = "You kept going until every word was right.";
  dailyCreditElement.textContent = activity.firstQuizToday
    ? "Today’s first quiz counted toward your streak."
    : "You already earned today’s streak credit—and this quiz still counts.";
  newQuizButton.firstChild.textContent = "Start another quiz ";
  newSessionButton.hidden = false;
  shareResultsButton.hidden = true;
  shareCardPreviewElement.hidden = true;
  shareCardImageElement.removeAttribute("src");
  shareResultsStatusElement.textContent = "";
  shareResultsPayload = null;
  reviewContext = {
    type: "extra",
    title: "Extra quiz review",
    roundId: currentRoundRecord.id,
    date: dailySession?.date ?? localDateKey(new Date()),
    allWordIds: [...new Set([
      ...dayWordIds(dailySession?.date),
      ...roundEntries.map((entry) => entry.id),
    ])],
  };
  reviewReturn = () => showQuizResults(state, activity);
  showResultsBase(state.correctCount, state.wrongCount, activity);
}

async function shareDailyResults() {
  if (!shareResultsPayload) return;
  shareResultsButton.disabled = true;
  shareResultsStatusElement.textContent = "Creating your results card…";
  try {
    let imageFile = null;
    try {
      imageFile = await createShareImageFile(document, URL, File, shareResultsPayload);
    } catch (error) {
      console.warn("The results image could not be created.", error);
    }
    const result = await shareSessionResults(navigator, shareResultsPayload, imageFile);
    if (result === "shared-image") {
      shareResultsStatusElement.textContent = "Results card shared.";
    } else if (result === "shared") {
      shareResultsStatusElement.textContent = "Results shared.";
    } else if (result === "copied") {
      shareResultsStatusElement.textContent = "Results copied—paste them into a text.";
    } else if (result === "canceled") {
      shareResultsStatusElement.textContent = "Sharing canceled.";
    } else {
      shareResultsStatusElement.textContent = "Sharing is not available in this browser.";
    }
  } catch (error) {
    console.error(error);
    shareResultsStatusElement.textContent = "The results could not be shared.";
  } finally {
    shareResultsButton.disabled = false;
  }
}

function startAnotherSessionToday() {
  const today = localDateKey(new Date());
  dailySession = createDailySessionPlan(
    vocabulary,
    onboardingRecord.placement,
    learningStorage.getSnapshot(activeProfileId, datasetMetadata),
    today,
  );
  dailySession.sessionKey = learningStorage.nextDailySessionKey(
    activeProfileId,
    datasetMetadata,
    today,
  );
  dailySession.historyId = `${activeProfileId}:${dailySession.sessionKey}`;
  dailySession.repeat = true;
  saveDailySession();
  showSessionIntro();
}

async function exportDiagnostics() {
  if (!activeProfile || !datasetMetadata) return;

  const originalLabel = exportButton.textContent;
  exportButton.disabled = true;
  exportButton.textContent = "Preparing…";
  exportStatusElement.textContent = "Preparing diagnostic export.";

  try {
    await Promise.allSettled([...pendingHistoryWrites]);
    const history = await historyStorage.getProfileHistory(activeProfileId);
    const storageStatus = historyStorage.getStatus();
    const exportedAt = new Date();
    const effectiveDate = dailySession?.date
      ? dateFromKey(dailySession.date)
      : exportedAt;
    const payload = buildDiagnosticExport({
      exportedAt: exportedAt.toISOString(),
      profile: activeProfile,
      dataset: datasetMetadata,
      onboarding: onboardingRecord,
      activity: activityStorage.getExport(activeProfileId, effectiveDate),
      learning: learningStorage.getSnapshot(activeProfileId, datasetMetadata),
      mastery: learningStorage.getMasteryProjection(
        activeProfileId,
        datasetMetadata,
        vocabulary,
      ),
      history,
      storageStatus,
      environment: {
        origin: window.location.origin,
        locale: navigator.language,
        languages: navigator.languages ? [...navigator.languages] : [navigator.language],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        userAgent: navigator.userAgent,
      },
    });
    downloadDiagnostic(
      document,
      URL,
      payload,
      diagnosticFilename(activeProfileId, exportedAt),
    );
    exportButton.textContent = "Downloaded";
    exportStatusElement.textContent = storageStatus.state === "ready"
      ? "Diagnostic export downloaded with IndexedDB history. Attach the JSON file to an email or conversation."
      : "Diagnostic export downloaded with a storage warning recorded inside the file.";
  } catch (error) {
    console.error(error);
    exportButton.textContent = "Export failed";
    exportStatusElement.textContent = "The diagnostic export could not be created.";
  } finally {
    window.setTimeout(() => {
      exportButton.textContent = originalLabel;
      exportButton.disabled = false;
    }, 1800);
  }
}

async function loadVocabulary() {
  if (vocabulary.length > 0) return vocabulary;
  if (!vocabularyPromise) {
    vocabularyPromise = Promise.all([
      fetch("./assets/vocabulary-official-v1.json?v=0.17.0"),
      fetch("./assets/vocabulary-official-v1.meta.json?v=0.17.0"),
    ]).then(async ([vocabularyResponse, metadataResponse]) => {
      if (!vocabularyResponse.ok || !metadataResponse.ok) {
        throw new Error("The official vocabulary or its metadata could not be loaded.");
      }
      vocabulary = await vocabularyResponse.json();
      vocabularyById = new Map(vocabulary.map((entry) => [entry.id, entry]));
      datasetMetadata = await metadataResponse.json();
      return vocabulary;
    });
  }
  return vocabularyPromise;
}

async function startQuiz() {
  hideMainPanels();
  panels.quiz.hidden = false;
  hideQuizControls();
  promptElement.textContent = "Loading…";
  choicesElement.replaceChildren();
  quizErrorElement.hidden = true;
  try {
    await loadVocabulary();
    const today = localDateKey(new Date());
    const learning = learningStorage.getSnapshot(activeProfileId, datasetMetadata);
    const eligible = vocabulary.filter((entry) => {
      const word = learning.words[entry.id];
      return eligibleForOrdinaryQuestion(word, today);
    });
    const selected = selectQuizVocabulary(eligible, onboardingRecord?.placement, 10);
    startRound(selected, "extra");
  } catch (error) {
    showQuizLoadError(error, "The vocabulary could not be loaded.");
  }
}

function showQuizLoadError(error, message) {
  console.error(error);
  hideQuizControls();
  promptElement.textContent = "¡Uy!";
  quizErrorElement.textContent = `${message} Please refresh and try again.`;
  quizErrorElement.hidden = false;
}

async function startAssessment() {
  hideMainPanels();
  panels.quiz.hidden = false;
  lastFeedbackSnapshot = null;
  hideQuizControls();
  promptElement.textContent = "Loading…";
  choicesElement.replaceChildren();
  quizErrorElement.hidden = true;
  try {
    await loadVocabulary();
    assessmentSession = createAssessmentSession(vocabulary);
    renderAssessmentQuestion();
  } catch (error) {
    showQuizLoadError(error, "The starting-point questions could not be loaded.");
  }
}

async function recognizeProfile(profile) {
  activeProfileId = profile.id;
  activeProfile = profile;
  activityStorage.ensureMember(profile.id);
  hideMainPanels();
  panels.quiz.hidden = false;
  hideQuizControls();
  promptElement.textContent = "Loading…";
  choicesElement.replaceChildren();
  try {
    await loadVocabulary();
    onboardingRecord = onboardingStorage.get(profile.id, datasetMetadata);
    if (onboardingRecord) {
      prepareDailySession();
    } else {
      showOnboarding();
    }
  } catch (error) {
    showQuizLoadError(error, "The vocabulary could not be loaded.");
  }
}

brandTitleElement.textContent = `Tarjetas de Flash (${APP_VERSION})`;

newQuizButton.addEventListener("click", startQuiz);
startAssessmentButton.addEventListener("click", startAssessment);
startPracticeButton.addEventListener("click", prepareDailySession);
startSessionButton.addEventListener("click", startOrResumeSession);
nextPresentationButton.addEventListener("click", advancePresentation);
newSessionButton.addEventListener("click", startAnotherSessionToday);
pauseQuizButton.addEventListener("click", toggleQuizPause);
showPreviousButton.addEventListener("click", showPreviousFeedback);
returnCurrentButton.addEventListener("click", returnToCurrentQuestion);
shareResultsButton.addEventListener("click", shareDailyResults);
exportButton.addEventListener("click", exportDiagnostics);
reviewAssessmentButton.addEventListener("click", () => {
  reviewContext = {
    type: "assessment",
    title: "Assessment review",
    result: latestAssessmentResult,
  };
  reviewReturn = () => showPlacement(onboardingRecord.placement);
  showReviewResults();
});
reviewResultsButton.addEventListener("click", showReviewResults);
reviewAllWordsButton.addEventListener("click", toggleAllWordsReview);
backFromReviewButton.addEventListener("click", () => reviewReturn?.());

initializeRecognition({
  form: document.querySelector("#recognition-form"),
  swallowForm: document.querySelector("#swallow-form"),
  nameForm: document.querySelector("#name-form"),
  nameSelect: document.querySelector("#profile-name"),
  customNameGroup: document.querySelector("#custom-name-group"),
  customNameInput: document.querySelector("#custom-name"),
  panel: document.querySelector("#recognition-panel"),
  title: document.querySelector("#recognition-title"),
  intro: document.querySelector(".recognition-intro"),
  feedback: document.querySelector("#recognition-feedback"),
  quizPanel: panels.quiz,
  additionalPanels: [
    panels.results,
    panels.onboarding,
    panels.placement,
    panels.session,
    panels.presentation,
    panels.review,
  ],
  userMenu: document.querySelector("#user-menu"),
  greeting: document.querySelector("#user-greeting"),
  changeUserButton: document.querySelector("#change-user"),
  storage: createProfileStorage(window.localStorage),
  onRecognized: recognizeProfile,
});
