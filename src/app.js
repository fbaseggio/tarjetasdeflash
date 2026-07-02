import { buildQuestion } from "./questions.js";

const promptElement = document.querySelector("#prompt");
const choicesElement = document.querySelector("#choices");
const feedbackElement = document.querySelector("#feedback");
const nextButton = document.querySelector("#next-button");

let vocabulary = [];
let currentQuestion = null;
let previousVocabularyId = null;

function renderQuestion() {
  currentQuestion = buildQuestion(vocabulary, previousVocabularyId);
  previousVocabularyId = currentQuestion.vocabularyId;

  promptElement.textContent = currentQuestion.prompt;
  choicesElement.replaceChildren();
  feedbackElement.textContent = "Choose the best translation.";
  feedbackElement.className = "feedback";
  nextButton.hidden = true;

  currentQuestion.choices.forEach((choice, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    button.dataset.answer = choice;
    button.textContent = `${String.fromCharCode(65 + index)}. ${choice}`;
    button.addEventListener("click", handleAnswer);
    choicesElement.append(button);
  });
}

function handleAnswer(event) {
  const selectedButton = event.currentTarget;
  const selectedAnswer = selectedButton.dataset.answer;
  const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

  for (const button of choicesElement.querySelectorAll("button")) {
    button.disabled = true;

    if (button.dataset.answer === currentQuestion.correctAnswer) {
      button.classList.add("correct");
    }
  }

  if (isCorrect) {
    feedbackElement.textContent = "¡Correcto! Nice work.";
    feedbackElement.className = "feedback success";
  } else {
    selectedButton.classList.add("incorrect");
    feedbackElement.textContent = `Not quite — ${currentQuestion.prompt} means ${currentQuestion.correctAnswer}.`;
    feedbackElement.className = "feedback error";
  }

  nextButton.hidden = false;
  nextButton.focus();
}

async function start() {
  try {
    const response = await fetch("./assets/vocabulary.json");

    if (!response.ok) {
      throw new Error(`Vocabulary request failed with status ${response.status}.`);
    }

    vocabulary = await response.json();
    renderQuestion();
  } catch (error) {
    console.error(error);
    promptElement.textContent = "¡Uy!";
    feedbackElement.textContent = "The vocabulary could not be loaded. Please refresh and try again.";
    feedbackElement.className = "feedback error";
  }
}

nextButton.addEventListener("click", renderQuestion);
start();
