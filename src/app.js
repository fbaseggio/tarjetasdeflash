import { createActivityStorage } from "./activity-storage.js";
import { createAssessmentSession } from "./assessment.js";
import { createDailySessionPlan, getReviewRoundIds } from "./daily-session.js";
import { createLearningStorage, localDateKey } from "./learning-storage.js";
import { createOnboardingStorage } from "./onboarding-storage.js";
import { createProfileStorage } from "./profile-storage.js";
import { buildQuiz, buildQuizFromAnswers } from "./questions.js";
import { selectQuizVocabulary } from "./quiz-selection.js";
import { createQuizSession } from "./quiz-session.js";
import { initializeRecognition } from "./recognition.js";

const panels = {
  onboarding: document.querySelector("#onboarding-panel"),
  placement: document.querySelector("#placement-panel"),
  session: document.querySelector("#session-panel"),
  presentation: document.querySelector("#presentation-panel"),
  quiz: document.querySelector("#quiz-panel"),
  results: document.querySelector("#results-panel"),
};
const startAssessmentButton = document.querySelector("#start-assessment-button");
const startPracticeButton = document.querySelector("#start-practice-button");
const startSessionButton = document.querySelector("#start-session-button");
const nextPresentationButton = document.querySelector("#next-presentation-button");
const placementLevelElement = document.querySelector("#placement-level");
const placementSummaryElement = document.querySelector("#placement-summary");
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

const activityStorage = createActivityStorage(window.localStorage);
const onboardingStorage = createOnboardingStorage(window.localStorage);
const learningStorage = createLearningStorage(window.localStorage);
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
let roundKind = null;
let roundEntries = [];
let roundFirstAttempts = [];

const tierLabels = Object.freeze({
  foundation: "Foundation",
  everyday: "Everyday",
  expanding: "Expanding",
});

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

function handleAnswer(event) {
  const before = quizSession.getState();
  const answer = quizSession.submitAnswer(event.currentTarget.dataset.answer);
  if (before.phase === "main") {
    roundFirstAttempts.push(attemptFromState(before, answer.correct, roundKind ?? "extra"));
  }
  const state = quizSession.advance();

  if (state.phase === "complete") {
    completeQuizRound(state);
  } else {
    renderQuestion();
  }
}

function handleAssessmentAnswer(event) {
  const state = assessmentSession.submitAnswer(event.currentTarget.dataset.answer);
  if (state.phase === "complete") {
    const result = assessmentSession.getResult();
    onboardingRecord = onboardingStorage.save(activeProfileId, datasetMetadata, result);
    learningStorage.seedOnboarding(activeProfileId, datasetMetadata, onboardingRecord, vocabulary);
    showPlacement(onboardingRecord.placement);
  } else {
    renderAssessmentQuestion();
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
  startPracticeButton.focus();
}

function entryList(ids) {
  return ids.map((id) => vocabularyById.get(id)).filter(Boolean);
}

function saveDailySession() {
  learningStorage.saveDailySession(activeProfileId, datasetMetadata, dailySession);
}

function showSessionIntro() {
  hideMainPanels();
  panels.session.hidden = false;
  checkInCountElement.textContent = `${dailySession.checkInIds.length} familiar words`;
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
    saveDailySession();
  }
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
  quizSession = createQuizSession(buildQuizFromAnswers(vocabulary, entries));
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
    learningStorage.recordPresentations(activeProfileId, datasetMetadata, [entry]);
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
  learningStorage.recordFirstAttempts(activeProfileId, datasetMetadata, roundFirstAttempts);
  const activity = activityStorage.recordCompletedQuiz(activeProfileId, {
    correctCount: state.correctCount,
    wrongCount: state.wrongCount,
  });

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
    ? "Today’s check-in counted toward your streak."
    : "You had already earned today’s streak credit—and this session still counts.";
  newQuizButton.firstChild.textContent = "Start extra practice ";
  showResultsBase(
    dailySession.correctCount,
    dailySession.wrongCount,
    activityStorage.getSummary(activeProfileId),
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
  showResultsBase(state.correctCount, state.wrongCount, activity);
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
    roundKind = "extra";
    roundEntries = selected;
    roundFirstAttempts = [];
    quizSession = createQuizSession(buildQuiz(selected, 10));
    renderQuestion();
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
  ],
  userMenu: document.querySelector("#user-menu"),
  greeting: document.querySelector("#user-greeting"),
  changeUserButton: document.querySelector("#change-user"),
  storage: createProfileStorage(window.localStorage),
  onRecognized: recognizeProfile,
});
