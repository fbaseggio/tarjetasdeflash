import { createActivityStorage } from "./activity-storage.js";
import { createAssessmentSession } from "./assessment.js";
import { createDailySessionPlan, getReviewRoundIds } from "./daily-session.js";
import {
  buildDiagnosticExport,
  diagnosticFilename,
  downloadDiagnostic,
} from "./diagnostic-export.js";
import {
  createIndexedHistory,
  practiceSessionRecord,
  quizRoundRecord,
} from "./indexed-history.js";
import { createLearningStorage, localDateKey } from "./learning-storage.js";
import { createOnboardingStorage } from "./onboarding-storage.js";
import { createProfileStorage } from "./profile-storage.js";
import { buildQuizFromAnswers } from "./questions.js";
import { selectQuizVocabulary } from "./quiz-selection.js";
import { createQuizSession } from "./quiz-session.js";
import { initializeRecognition } from "./recognition.js";
import {
  answerFeedback,
  buildAssessmentReview,
  buildHistoryReview,
} from "./review-results.js";

const panels = {
  onboarding: document.querySelector("#onboarding-panel"),
  placement: document.querySelector("#placement-panel"),
  session: document.querySelector("#session-panel"),
  presentation: document.querySelector("#presentation-panel"),
  quiz: document.querySelector("#quiz-panel"),
  results: document.querySelector("#results-panel"),
  review: document.querySelector("#review-panel"),
};
const startAssessmentButton = document.querySelector("#start-assessment-button");
const startPracticeButton = document.querySelector("#start-practice-button");
const startSessionButton = document.querySelector("#start-session-button");
const nextPresentationButton = document.querySelector("#next-presentation-button");
const testNextDayButton = document.querySelector("#test-next-day-button");
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
const reviewResultsButton = document.querySelector("#review-results-button");
const reviewTitleElement = document.querySelector("#review-title");
const reviewSummaryElement = document.querySelector("#review-summary");
const reviewSectionsElement = document.querySelector("#review-sections");
const backFromReviewButton = document.querySelector("#back-from-review-button");
const exportButton = document.querySelector("#export-diagnostics");
const exportStatusElement = document.querySelector("#export-status");

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

const tierLabels = Object.freeze({
  foundation: "Foundation",
  everyday: "Everyday",
  expanding: "Expanding",
});

function dateFromKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function nextDateKey(dateKey) {
  const date = dateFromKey(dateKey);
  date.setDate(date.getDate() + 1);
  return localDateKey(date);
}

function displayDate(dateKey) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dateFromKey(dateKey));
}

function hideMainPanels() {
  Object.values(panels).forEach((panel) => { panel.hidden = true; });
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

function showAnswerOutcome(question, selectedAnswer, correct) {
  choicesElement.querySelectorAll("button").forEach((button) => {
    button.disabled = true;
    if (button.dataset.answer === question.correctAnswer) {
      button.classList.add("correct");
    }
    if (!correct && button.dataset.answer === selectedAnswer) {
      button.classList.add("incorrect");
    }
  });
  quizErrorElement.className = `feedback ${correct ? "success" : "error"}`;
  quizErrorElement.textContent = answerFeedback(correct, question.correctAnswer);
  quizErrorElement.hidden = false;
}

function feedbackDelay() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 300 : 850;
}

function renderQuestion() {
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
  renderChoices(currentQuestion, new Set(state.knownWrongAnswers), handleAnswer);
}

function renderAssessmentQuestion() {
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
  renderChoices(currentQuestion, new Set(), handleAssessmentAnswer);
}

function attemptFromState(state, correct, source) {
  const entry = vocabularyById.get(state.question.vocabularyId);
  return {
    vocabularyId: entry.id,
    tier: entry.tier,
    direction: state.direction,
    correct,
    source,
  };
}

function recordImmutableAttempt(state, selectedAnswer, correct) {
  const attemptId = historyStorage.createId("attempt");
  const vocabularyId = state.question.vocabularyId;
  roundAttemptCount += 1;
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
    selectedAnswer,
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
  showAnswerOutcome(before.question, selectedAnswer, answer.correct);
  window.setTimeout(() => {
    const state = quizSession.advance();
    if (state.phase === "complete") {
      completeQuizRound(state);
    } else {
      renderQuestion();
    }
  }, feedbackDelay());
}

function handleAssessmentAnswer(event) {
  const before = assessmentSession.getState();
  const selectedAnswer = event.currentTarget.dataset.answer;
  const correct = selectedAnswer === before.question.correctAnswer;
  const state = assessmentSession.submitAnswer(selectedAnswer);
  showAnswerOutcome(before.question, selectedAnswer, correct);
  window.setTimeout(() => {
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
  }, feedbackDelay());
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
  sessionEyebrowElement.textContent = dailySession.simulated
    ? `Test day · ${displayDate(dailySession.date)}`
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
  const today = localDateKey(new Date());
  dailySession = learningStorage.getDailySession(activeProfileId, datasetMetadata, today);
  if (!dailySession) {
    dailySession = createDailySessionPlan(
      vocabulary,
      onboardingRecord.placement,
      learningStorage.getSnapshot(activeProfileId, datasetMetadata),
      today,
    );
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
    practiceSessionId: kind === "extra" ? null : `${activeProfileId}:${dailySession.date}`,
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
  startRound(entryList(dailySession.checkInIds), "check-in");
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

  if (kind === "presentations") {
    mark.className = "review-mark";
    mark.textContent = "•";
    const spanish = document.createElement("strong");
    const english = document.createElement("span");
    spanish.textContent = item.spanish;
    spanish.lang = "es";
    english.textContent = item.english;
    content.append(spanish, english);
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
    detail.textContent = `${resultText}${recoveryText}`;
    content.append(answer, detail);
  }

  listItem.append(mark, content);
  return listItem;
}

function renderReviewSections(title, sections) {
  reviewTitleElement.textContent = title;
  reviewSectionsElement.replaceChildren();
  const questionSections = sections.filter((section) => section.kind === "questions");
  const correct = questionSections.reduce((sum, section) => sum + section.correctCount, 0);
  const wrong = questionSections.reduce((sum, section) => sum + section.wrongCount, 0);
  reviewSummaryElement.textContent = questionSections.length > 0
    ? `${correct} right and ${wrong} wrong on first presentation, organized by section.`
    : "Presented vocabulary, organized by section.";

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

  let sections;
  if (reviewContext.type === "assessment") {
    sections = buildAssessmentReview(reviewContext.result, vocabulary);
  } else {
    await Promise.allSettled([...pendingHistoryWrites]);
    const history = await historyStorage.getProfileHistory(activeProfileId);
    sections = buildHistoryReview({
      rounds: history.quizRounds,
      attempts: history.attempts,
      practiceSessionId: reviewContext.practiceSessionId,
      roundId: reviewContext.roundId,
      newWords: reviewContext.newWords ?? [],
    });
  }
  renderReviewSections(reviewContext.title, sections);
  backFromReviewButton.focus();
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
  if (dailySession.simulated) {
    const testDate = displayDate(dailySession.date);
    dailyCreditElement.textContent = dailySession.streakCredited
      ? `The ${testDate} test-day check-in counted toward your streak.`
      : `The ${testDate} test day already had streak credit—and this session still counts.`;
  } else {
    dailyCreditElement.textContent = dailySession.streakCredited
      ? "Today’s check-in counted toward your streak."
      : "You had already earned today’s streak credit—and this session still counts.";
  }
  newQuizButton.firstChild.textContent = "Start additional quiz ";
  testNextDayButton.hidden = false;
  reviewContext = {
    type: "session",
    title: `Session review · ${displayDate(dailySession.date)}`,
    practiceSessionId: `${activeProfileId}:${dailySession.date}`,
    newWords: entryList(dailySession.newWordIds),
  };
  reviewReturn = showSessionResults;
  showResultsBase(
    dailySession.correctCount,
    dailySession.wrongCount,
    activityStorage.getSummary(activeProfileId, dateFromKey(dailySession.date)),
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
  testNextDayButton.hidden = false;
  reviewContext = {
    type: "extra",
    title: "Extra quiz review",
    roundId: currentRoundRecord.id,
  };
  reviewReturn = () => showQuizResults(state, activity);
  showResultsBase(state.correctCount, state.wrongCount, activity);
}

function startTestNextDay() {
  let testDate = nextDateKey(dailySession.date);
  let existing = learningStorage.getDailySession(activeProfileId, datasetMetadata, testDate);

  while (existing?.status === "complete") {
    testDate = nextDateKey(testDate);
    existing = learningStorage.getDailySession(activeProfileId, datasetMetadata, testDate);
  }

  dailySession = existing ?? createDailySessionPlan(
    vocabulary,
    onboardingRecord.placement,
    learningStorage.getSnapshot(activeProfileId, datasetMetadata),
    testDate,
  );
  dailySession.simulated = true;
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
      fetch("./assets/vocabulary-test-v1.json"),
      fetch("./assets/vocabulary-test-v1.meta.json"),
    ]).then(async ([vocabularyResponse, metadataResponse]) => {
      if (!vocabularyResponse.ok || !metadataResponse.ok) {
        throw new Error("The testing vocabulary or its metadata could not be loaded.");
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
  promptElement.textContent = "Loading…";
  choicesElement.replaceChildren();
  quizErrorElement.hidden = true;
  try {
    await loadVocabulary();
    const selected = selectQuizVocabulary(vocabulary, onboardingRecord?.placement, 10);
    startRound(selected, "extra");
  } catch (error) {
    showQuizLoadError(error, "The vocabulary could not be loaded.");
  }
}

function showQuizLoadError(error, message) {
  console.error(error);
  promptElement.textContent = "¡Uy!";
  quizErrorElement.textContent = `${message} Please refresh and try again.`;
  quizErrorElement.hidden = false;
}

async function startAssessment() {
  hideMainPanels();
  panels.quiz.hidden = false;
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

newQuizButton.addEventListener("click", startQuiz);
startAssessmentButton.addEventListener("click", startAssessment);
startPracticeButton.addEventListener("click", prepareDailySession);
startSessionButton.addEventListener("click", startOrResumeSession);
nextPresentationButton.addEventListener("click", advancePresentation);
testNextDayButton.addEventListener("click", startTestNextDay);
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
backFromReviewButton.addEventListener("click", () => reviewReturn?.());

initializeRecognition({
  form: document.querySelector("#recognition-form"),
  panel: document.querySelector("#recognition-panel"),
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
