import { oppositeDirection } from "./questions.js?v=0.24.0";

export function createQuizSession(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("A quiz requires at least one question.");
  }

  const questionIds = new Set(questions.map((question) => question.vocabularyId));

  if (questionIds.size !== questions.length) {
    throw new Error("Quiz questions must use distinct vocabulary items.");
  }

  const totalQuestions = questions.length;
  const reviewQueue = [];
  const wrongAnswersByVariant = new Map();
  let phase = "main";
  let mainIndex = 0;
  let currentDefinition = questions[0];
  let currentDirection = currentDefinition.initialDirection;
  let currentReviewItem = null;
  let submitted = false;
  let correctCount = 0;
  let wrongCount = 0;

  function variantKey(questionId, direction) {
    return `${questionId}:${direction}`;
  }

  function getWrongAnswers(questionId, direction) {
    const key = variantKey(questionId, direction);

    if (!wrongAnswersByVariant.has(key)) {
      wrongAnswersByVariant.set(key, new Set());
    }

    return wrongAnswersByVariant.get(key);
  }

  function currentQuestion() {
    return currentDefinition?.variants[currentDirection] ?? null;
  }

  function nextPhase() {
    if (phase === "main" && mainIndex + 1 < totalQuestions) {
      return "main";
    }

    return reviewQueue.length > 0 ? "review" : "complete";
  }

  function getState() {
    const question = currentQuestion();
    const reviewRemaining = phase === "review" ? reviewQueue.length + 1 : reviewQueue.length;

    return Object.freeze({
      phase,
      direction: currentDirection,
      question,
      submitted,
      totalQuestions,
      mainPosition: phase === "main" ? mainIndex + 1 : null,
      reviewRemaining,
      knownWrongAnswers: question
        ? Object.freeze([...getWrongAnswers(currentDefinition.vocabularyId, currentDirection)])
        : Object.freeze([]),
      correctCount,
      wrongCount,
    });
  }

  function submitAnswer(answer) {
    const question = currentQuestion();

    if (phase === "complete" || !question) {
      throw new Error("The quiz is already complete.");
    }

    if (submitted) {
      throw new Error("This question has already been answered.");
    }

    if (!question.choices.includes(answer)) {
      throw new Error("The selected answer is not one of this question's choices.");
    }

    const knownWrongAnswers = getWrongAnswers(currentDefinition.vocabularyId, currentDirection);

    if (knownWrongAnswers.has(answer)) {
      throw new Error("A previously eliminated answer cannot be selected again.");
    }

    const correct = answer === question.correctAnswer;
    const repriseReminder = correct && phase === "review" && currentReviewItem?.firstOpposite
      ? Object.freeze({ ...currentReviewItem.originalMiss })
      : null;

    if (correct) {
      correctCount += 1;
    } else {
      wrongCount += 1;
      knownWrongAnswers.add(answer);
      const originalMiss = phase === "main"
        ? Object.freeze({ prompt: question.prompt, selectedAnswer: answer })
        : currentReviewItem?.originalMiss ?? null;
      reviewQueue.push(Object.freeze({
        definition: currentDefinition,
        direction: oppositeDirection(currentDirection),
        firstOpposite: phase === "main",
        originalMiss,
      }));
    }

    submitted = true;
    return Object.freeze({ correct, nextPhase: nextPhase(), repriseReminder });
  }

  function advance() {
    if (!submitted) {
      throw new Error("Submit an answer before advancing.");
    }

    if (phase === "main" && mainIndex + 1 < totalQuestions) {
      mainIndex += 1;
      currentDefinition = questions[mainIndex];
      currentDirection = currentDefinition.initialDirection;
      currentReviewItem = null;
    } else if (reviewQueue.length > 0) {
      phase = "review";
      const reviewItem = reviewQueue.shift();
      currentReviewItem = reviewItem;
      currentDefinition = reviewItem.definition;
      currentDirection = reviewItem.direction;
    } else {
      phase = "complete";
      currentDefinition = null;
      currentDirection = null;
      currentReviewItem = null;
    }

    submitted = false;
    return getState();
  }

  return Object.freeze({ getState, submitAnswer, advance });
}
