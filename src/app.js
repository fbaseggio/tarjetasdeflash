import { createActivityStorage } from "./activity-storage.js";
import { createProfileStorage } from "./profile-storage.js";
import { buildQuiz } from "./questions.js";
import { createQuizSession } from "./quiz-session.js";
import { initializeRecognition } from "./recognition.js";

const quizPanel = document.querySelector("#quiz-panel");
const resultsPanel = document.querySelector("#results-panel");
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
const percentFormatter = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 1,
});

let vocabulary = [];
let vocabularyPromise = null;
let quizSession = null;
let activeProfileId = null;

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
      button.addEventListener("click", handleAnswer);
    }

    choicesElement.append(button);
  });
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
    vocabularyPromise = fetch("./assets/vocabulary.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Vocabulary request failed with status ${response.status}.`);
        }

        return response.json();
      })
      .then((loadedVocabulary) => {
        vocabulary = loadedVocabulary;
        return vocabulary;
      });
  }

  return vocabularyPromise;
}

async function startQuiz() {
  quizPanel.hidden = false;
  resultsPanel.hidden = true;
  promptElement.textContent = "Loading…";
  choicesElement.replaceChildren();
  quizErrorElement.hidden = true;

  try {
    await loadVocabulary();
    quizSession = createQuizSession(buildQuiz(vocabulary, 10));
    renderQuestion();
  } catch (error) {
    console.error(error);
    promptElement.textContent = "¡Uy!";
    quizErrorElement.textContent = "The vocabulary could not be loaded. Please refresh and try again.";
    quizErrorElement.hidden = false;
  }
}

newQuizButton.addEventListener("click", startQuiz);

initializeRecognition({
  form: document.querySelector("#recognition-form"),
  panel: document.querySelector("#recognition-panel"),
  feedback: document.querySelector("#recognition-feedback"),
  quizPanel,
  additionalPanels: [resultsPanel],
  userMenu: document.querySelector("#user-menu"),
  greeting: document.querySelector("#user-greeting"),
  changeUserButton: document.querySelector("#change-user"),
  storage: createProfileStorage(window.localStorage),
  onRecognized(profile) {
    activeProfileId = profile.id;
    activityStorage.ensureMember(profile.id);
    startQuiz();
  },
});
