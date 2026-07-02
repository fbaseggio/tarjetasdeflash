import { createProfileStorage } from "./profile-storage.js";
import { buildQuiz } from "./questions.js";
import { createQuizSession } from "./quiz-session.js";
import { initializeRecognition } from "./recognition.js";

const quizPanel = document.querySelector("#quiz-panel");
const resultsPanel = document.querySelector("#results-panel");
const promptElement = document.querySelector("#prompt");
const choicesElement = document.querySelector("#choices");
const feedbackElement = document.querySelector("#feedback");
const progressElement = document.querySelector("#quiz-progress");
const nextButton = document.querySelector("#next-button");
const newQuizButton = document.querySelector("#new-quiz-button");
const finalRightElement = document.querySelector("#final-right");
const finalWrongElement = document.querySelector("#final-wrong");

let vocabulary = [];
let vocabularyPromise = null;
let quizSession = null;

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
  promptElement.textContent = currentQuestion.prompt;
  choicesElement.replaceChildren();
  feedbackElement.textContent = state.phase === "review"
    ? "Try this one again. Previous misses are crossed out."
    : "Choose the best translation.";
  feedbackElement.className = "feedback";
  nextButton.hidden = true;

  currentQuestion.choices.forEach((choice, index) => {
    const button = document.createElement("button");
    const choicePrefix = `${String.fromCharCode(65 + index)}.`;
    button.type = "button";
    button.className = "choice";
    button.dataset.answer = choice;
    button.textContent = `${choicePrefix} ${choice}`;

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
  const selectedButton = event.currentTarget;
  const result = quizSession.submitAnswer(selectedButton.dataset.answer);

  for (const button of choicesElement.querySelectorAll("button")) {
    button.disabled = true;
  }

  if (result.correct) {
    selectedButton.classList.add("correct");
    feedbackElement.textContent = "¡Correcto! Nice work.";
    feedbackElement.className = "feedback success";
  } else {
    selectedButton.classList.add("incorrect");
    feedbackElement.textContent = "Not quite. We’ll bring this one back.";
    feedbackElement.className = "feedback error";
  }

  const nextLabels = {
    main: "Next question",
    review: "Review missed words",
    complete: "See final score",
  };
  nextButton.firstChild.textContent = `${nextLabels[result.nextPhase]} `;
  nextButton.hidden = false;
  nextButton.focus();
}

function showResults(state) {
  quizPanel.hidden = true;
  resultsPanel.hidden = false;
  finalRightElement.textContent = state.correctCount;
  finalWrongElement.textContent = state.wrongCount;
  newQuizButton.focus();
}

function advanceQuiz() {
  const state = quizSession.advance();

  if (state.phase === "complete") {
    showResults(state);
  } else {
    renderQuestion();
  }
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
  feedbackElement.textContent = "";

  try {
    await loadVocabulary();
    quizSession = createQuizSession(buildQuiz(vocabulary, 10));
    renderQuestion();
  } catch (error) {
    console.error(error);
    promptElement.textContent = "¡Uy!";
    feedbackElement.textContent = "The vocabulary could not be loaded. Please refresh and try again.";
    feedbackElement.className = "feedback error";
  }
}

nextButton.addEventListener("click", advanceQuiz);
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
  onRecognized: startQuiz,
});
