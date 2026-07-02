import { createActivityStorage } from "./activity-storage.js";
import { createAssessmentSession } from "./assessment.js";
import { createOnboardingStorage } from "./onboarding-storage.js";
import { createProfileStorage } from "./profile-storage.js";
import { buildQuiz } from "./questions.js";
import { selectQuizVocabulary } from "./quiz-selection.js";
import { createQuizSession } from "./quiz-session.js";
import { initializeRecognition } from "./recognition.js";

const quizPanel = document.querySelector("#quiz-panel");
const resultsPanel = document.querySelector("#results-panel");
const onboardingPanel = document.querySelector("#onboarding-panel");
const placementPanel = document.querySelector("#placement-panel");
const startAssessmentButton = document.querySelector("#start-assessment-button");
const startPracticeButton = document.querySelector("#start-practice-button");
const placementLevelElement = document.querySelector("#placement-level");
const placementSummaryElement = document.querySelector("#placement-summary");
const promptElement = document.querySelector("#prompt");
const choicesElement = document.querySelector("#choices");
const quizTitleElement = document.querySelector("#quiz-title");
const directionLabelElement = document.querySelector("#direction-label");
const quizErrorElement = document.querySelector("#quiz-error");
const progressElement = document.querySelector("#quiz-progress");
const newQuizButton = document.querySelector("#new-quiz-button");
const finalRightElement = document.querySelector("#final-right");
const finalWrongElement = document.querySelector("#final-wrong");
const dailyCreditElement = document.querySelector("#daily-credit");
const streakElement = document.querySelector("#stat-streak");
const membershipDaysElement = document.querySelector("#stat-membership-days");
const practiceDaysElement = document.querySelector("#stat-practice-days");
const totalQuizzesElement = document.querySelector("#stat-total-quizzes");
const firstQuizErrorElement = document.querySelector("#stat-first-error");
const overallErrorElement = document.querySelector("#stat-overall-error");

const activityStorage = createActivityStorage(window.localStorage);
const onboardingStorage = createOnboardingStorage(window.localStorage);
const percentFormatter = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 1,
});

let vocabulary = [];
let datasetMetadata = null;
let vocabularyPromise = null;
let quizSession = null;
let assessmentSession = null;
let onboardingRecord = null;
let activeProfileId = null;

const tierLabels = Object.freeze({
  foundation: "Foundation",
  everyday: "Everyday",
  expanding: "Expanding",
});

function renderProgress(state) {
  if (state.phase === "main") {
    progressElement.textContent = `Question ${state.mainPosition} of ${state.totalQuestions}`;
  } else {
    const noun = state.reviewRemaining === 1 ? "word" : "words";
    progressElement.textContent = `Review · ${state.reviewRemaining} ${noun} left`;
  }
}

function renderQuestion() {
  const state = quizSession.getState();
  const currentQuestion = state.question;
  const knownWrongAnswers = new Set(state.knownWrongAnswers);

  renderProgress(state);
  const isSpanishPrompt = state.direction === "spanish-to-english";
  directionLabelElement.textContent = isSpanishPrompt ? "Spanish → English" : "English → Spanish";
  quizTitleElement.textContent = isSpanishPrompt
    ? "Choose the English translation."
    : "Choose the Spanish translation.";
  promptElement.textContent = currentQuestion.prompt;
  promptElement.lang = currentQuestion.promptLanguage;
  renderChoices(currentQuestion, knownWrongAnswers, handleAnswer);
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

function renderAssessmentQuestion() {
  const state = assessmentSession.getState();
  const currentQuestion = state.question;
  const isSpanishPrompt = state.direction === "spanish-to-english";
  const direction = isSpanishPrompt ? "Spanish → English" : "English → Spanish";

  progressElement.textContent = `Starting point ${state.position} of ${state.totalQuestions}`;
  directionLabelElement.textContent = `${tierLabels[state.tier]} · ${direction}`;
  quizTitleElement.textContent = isSpanishPrompt
    ? "Choose the English translation."
    : "Choose the Spanish translation.";
  promptElement.textContent = currentQuestion.prompt;
  promptElement.lang = currentQuestion.promptLanguage;
  renderChoices(currentQuestion, new Set(), handleAssessmentAnswer);
}

function handleAnswer(event) {
  quizSession.submitAnswer(event.currentTarget.dataset.answer);
  const state = quizSession.advance();

  if (state.phase === "complete") {
    showResults(state);
  } else {
    renderQuestion();
  }
}

function handleAssessmentAnswer(event) {
  const state = assessmentSession.submitAnswer(event.currentTarget.dataset.answer);

  if (state.phase === "complete") {
    const result = assessmentSession.getResult();
    onboardingRecord = onboardingStorage.save(activeProfileId, datasetMetadata, result);
    showPlacement(onboardingRecord.placement);
  } else {
    renderAssessmentQuestion();
  }
}

function hideMainPanels() {
  onboardingPanel.hidden = true;
  placementPanel.hidden = true;
  quizPanel.hidden = true;
  resultsPanel.hidden = true;
}

function showOnboarding() {
  hideMainPanels();
  onboardingPanel.hidden = false;
  startAssessmentButton.focus();
}

function showPlacement(placement) {
  hideMainPanels();
  placementPanel.hidden = false;
  const frontierLabel = tierLabels[placement.learningFrontier];
  placementLevelElement.textContent = frontierLabel;

  if (!placement.knownThrough) {
    placementSummaryElement.textContent =
      "We found a few Foundation gaps, so we’ll strengthen those first.";
  } else if (placement.knownThrough === "expanding") {
    placementSummaryElement.textContent =
      "Expanding vocabulary already looks familiar. We’ll keep testing the edges and adjust.";
  } else {
    placementSummaryElement.textContent =
      `${tierLabels[placement.knownThrough]} vocabulary looks familiar. `
      + `We’ll begin around ${frontierLabel} and keep adjusting.`;
  }

  startPracticeButton.focus();
}

function showResults(state) {
  const activity = activityStorage.recordCompletedQuiz(activeProfileId, {
    correctCount: state.correctCount,
    wrongCount: state.wrongCount,
  });

  quizPanel.hidden = true;
  resultsPanel.hidden = false;
  finalRightElement.textContent = state.correctCount;
  finalWrongElement.textContent = state.wrongCount;
  dailyCreditElement.textContent = activity.firstQuizToday
    ? "Today’s first quiz counted toward your streak."
    : "You already earned today’s streak credit—and this quiz still counts.";
  streakElement.textContent = activity.currentStreak;
  membershipDaysElement.textContent = activity.membershipDays;
  practiceDaysElement.textContent = activity.daysPracticed;
  totalQuizzesElement.textContent = activity.totalQuizzes;
  firstQuizErrorElement.textContent = percentFormatter.format(activity.firstQuizErrorRate);
  overallErrorElement.textContent = percentFormatter.format(activity.overallErrorRate);
  newQuizButton.focus();
}

async function loadVocabulary() {
  if (vocabulary.length > 0) {
    return vocabulary;
  }

  if (!vocabularyPromise) {
    vocabularyPromise = Promise.all([
      fetch("./assets/vocabulary-test-v1.json"),
      fetch("./assets/vocabulary-test-v1.meta.json"),
    ]).then(async ([vocabularyResponse, metadataResponse]) => {
      if (!vocabularyResponse.ok || !metadataResponse.ok) {
        throw new Error("The testing vocabulary or its metadata could not be loaded.");
      }
      vocabulary = await vocabularyResponse.json();
      datasetMetadata = await metadataResponse.json();
      return vocabulary;
    });
  }

  return vocabularyPromise;
}

async function startQuiz() {
  onboardingPanel.hidden = true;
  placementPanel.hidden = true;
  quizPanel.hidden = false;
  resultsPanel.hidden = true;
  promptElement.textContent = "Loading…";
  choicesElement.replaceChildren();
  quizErrorElement.hidden = true;

  try {
    await loadVocabulary();
    const selectedVocabulary = selectQuizVocabulary(
      vocabulary,
      onboardingRecord?.placement,
      10,
    );
    quizSession = createQuizSession(buildQuiz(selectedVocabulary, 10));
    renderQuestion();
  } catch (error) {
    console.error(error);
    promptElement.textContent = "¡Uy!";
    quizErrorElement.textContent = "The vocabulary could not be loaded. Please refresh and try again.";
    quizErrorElement.hidden = false;
  }
}

async function startAssessment() {
  hideMainPanels();
  quizPanel.hidden = false;
  promptElement.textContent = "Loading…";
  choicesElement.replaceChildren();
  quizErrorElement.hidden = true;

  try {
    await loadVocabulary();
    assessmentSession = createAssessmentSession(vocabulary);
    renderAssessmentQuestion();
  } catch (error) {
    console.error(error);
    promptElement.textContent = "¡Uy!";
    quizErrorElement.textContent = "The starting-point questions could not be loaded. Please refresh and try again.";
    quizErrorElement.hidden = false;
  }
}

async function recognizeProfile(profile) {
  activeProfileId = profile.id;
  activityStorage.ensureMember(profile.id);
  hideMainPanels();
  quizPanel.hidden = false;
  promptElement.textContent = "Loading…";
  choicesElement.replaceChildren();

  try {
    await loadVocabulary();
    onboardingRecord = onboardingStorage.get(profile.id, datasetMetadata);
    if (onboardingRecord) {
      startQuiz();
    } else {
      showOnboarding();
    }
  } catch (error) {
    console.error(error);
    quizErrorElement.textContent = "The vocabulary could not be loaded. Please refresh and try again.";
    quizErrorElement.hidden = false;
  }
}

newQuizButton.addEventListener("click", startQuiz);
startAssessmentButton.addEventListener("click", startAssessment);
startPracticeButton.addEventListener("click", startQuiz);

initializeRecognition({
  form: document.querySelector("#recognition-form"),
  panel: document.querySelector("#recognition-panel"),
  feedback: document.querySelector("#recognition-feedback"),
  quizPanel,
  additionalPanels: [resultsPanel, onboardingPanel, placementPanel],
  userMenu: document.querySelector("#user-menu"),
  greeting: document.querySelector("#user-greeting"),
  changeUserButton: document.querySelector("#change-user"),
  storage: createProfileStorage(window.localStorage),
  onRecognized: recognizeProfile,
});
