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
  const wrongAnswersByQuestion = new Map();
  let phase = "main";
  let mainIndex = 0;
  let currentQuestion = questions[0];
  let submitted = false;
  let correctCount = 0;
  let wrongCount = 0;

  function getWrongAnswers(questionId) {
    if (!wrongAnswersByQuestion.has(questionId)) {
      wrongAnswersByQuestion.set(questionId, new Set());
    }

    return wrongAnswersByQuestion.get(questionId);
  }

  function nextPhase() {
    if (phase === "main" && mainIndex + 1 < totalQuestions) {
      return "main";
    }

    return reviewQueue.length > 0 ? "review" : "complete";
  }

  function getState() {
    const reviewRemaining = phase === "review" ? reviewQueue.length + 1 : reviewQueue.length;

    return Object.freeze({
      phase,
      question: currentQuestion,
      submitted,
      totalQuestions,
      mainPosition: phase === "main" ? mainIndex + 1 : null,
      reviewRemaining,
      knownWrongAnswers: currentQuestion
        ? Object.freeze([...getWrongAnswers(currentQuestion.vocabularyId)])
        : Object.freeze([]),
      correctCount,
      wrongCount,
    });
  }

  function submitAnswer(answer) {
    if (phase === "complete" || !currentQuestion) {
      throw new Error("The quiz is already complete.");
    }

    if (submitted) {
      throw new Error("This question has already been answered.");
    }

    if (!currentQuestion.choices.includes(answer)) {
      throw new Error("The selected answer is not one of this question's choices.");
    }

    const knownWrongAnswers = getWrongAnswers(currentQuestion.vocabularyId);

    if (knownWrongAnswers.has(answer)) {
      throw new Error("A previously eliminated answer cannot be selected again.");
    }

    const correct = answer === currentQuestion.correctAnswer;

    if (correct) {
      correctCount += 1;
    } else {
      wrongCount += 1;
      knownWrongAnswers.add(answer);
      reviewQueue.push(currentQuestion);
    }

    submitted = true;

    return Object.freeze({ correct, nextPhase: nextPhase() });
  }

  function advance() {
    if (!submitted) {
      throw new Error("Submit an answer before advancing.");
    }

    if (phase === "main" && mainIndex + 1 < totalQuestions) {
      mainIndex += 1;
      currentQuestion = questions[mainIndex];
    } else if (reviewQueue.length > 0) {
      phase = "review";
      currentQuestion = reviewQueue.shift();
    } else {
      phase = "complete";
      currentQuestion = null;
    }

    submitted = false;
    return getState();
  }

  return Object.freeze({ getState, submitAnswer, advance });
}
