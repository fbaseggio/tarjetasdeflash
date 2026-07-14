import {
  questionFieldText,
  selectWeightedDistractors,
} from "./distractors.js?v=0.24.4";

export const DIRECTIONS = Object.freeze({
  SPANISH_TO_ENGLISH: "spanish-to-english",
  ENGLISH_TO_SPANISH: "english-to-spanish",
});

export function oppositeDirection(direction) {
  if (direction === DIRECTIONS.SPANISH_TO_ENGLISH) {
    return DIRECTIONS.ENGLISH_TO_SPANISH;
  }

  if (direction === DIRECTIONS.ENGLISH_TO_SPANISH) {
    return DIRECTIONS.SPANISH_TO_ENGLISH;
  }

  throw new Error(`Unknown question direction: ${direction}`);
}

export function shuffle(items, random = Math.random) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function buildQuestionForAnswer(
  vocabulary,
  answer,
  direction = DIRECTIONS.SPANISH_TO_ENGLISH,
  random = Math.random,
) {
  if (!Array.isArray(vocabulary) || vocabulary.length < 4) {
    throw new Error("At least four vocabulary entries are required.");
  }

  const isSpanishPrompt = direction === DIRECTIONS.SPANISH_TO_ENGLISH;

  if (!isSpanishPrompt && direction !== DIRECTIONS.ENGLISH_TO_SPANISH) {
    throw new Error(`Unknown question direction: ${direction}`);
  }

  const promptField = isSpanishPrompt ? "spanish" : "english";
  const answerField = isSpanishPrompt ? "english" : "spanish";
  const quizSpanish = questionFieldText(answer, "spanish", { direction, role: "answer" });
  const quizEnglishPrompt = questionFieldText(answer, "english", { direction, role: "prompt" });
  const quizEnglishAnswer = questionFieldText(answer, "english", { direction, role: "answer" });
  const correctAnswer = questionFieldText(answer, answerField, { direction, role: "answer" });
  const distractorDetails = selectWeightedDistractors(
    vocabulary,
    answer,
    direction,
    3,
    random,
  );
  const distractors = distractorDetails.map((choice) => choice.answer);

  return Object.freeze({
    vocabularyId: answer.id,
    direction,
    promptLanguage: isSpanishPrompt ? "es" : "en",
    answerLanguage: isSpanishPrompt ? "en" : "es",
    prompt: questionFieldText(answer, promptField, { direction, role: "prompt" }),
    correctAnswer,
    teachingSpanish: answer.spanish,
    teachingEnglish: answer.english,
    hasTeachingVariant: quizSpanish !== answer.spanish
      || quizEnglishPrompt !== answer.english
      || quizEnglishAnswer !== answer.english,
    distractors: distractorDetails,
    choices: Object.freeze(shuffle([correctAnswer, ...distractors], random)),
  });
}

export function buildQuestion(vocabulary, previousVocabularyId = null, random = Math.random) {
  if (!Array.isArray(vocabulary) || vocabulary.length < 4) {
    throw new Error("At least four vocabulary entries are required.");
  }

  const promptPool = vocabulary.filter((entry) => entry.id !== previousVocabularyId);
  const promptChoices = promptPool.length > 0 ? promptPool : vocabulary;
  const answer = promptChoices[Math.floor(random() * promptChoices.length)];

  return buildQuestionForAnswer(vocabulary, answer, DIRECTIONS.SPANISH_TO_ENGLISH, random);
}

export function buildQuiz(vocabulary, requestedCount = 10, random = Math.random) {
  if (!Number.isInteger(requestedCount) || requestedCount < 1) {
    throw new Error("Quiz size must be a positive integer.");
  }

  if (!Array.isArray(vocabulary) || vocabulary.length < 4) {
    throw new Error("At least four vocabulary entries are required.");
  }

  const count = Math.min(requestedCount, vocabulary.length);
  const answers = shuffle(vocabulary, random).slice(0, count);
  const directions = shuffle(
    Array.from({ length: count }, (_, index) => (
      index % 2 === 0 ? DIRECTIONS.SPANISH_TO_ENGLISH : DIRECTIONS.ENGLISH_TO_SPANISH
    )),
    random,
  );

  return answers.map((answer, index) => Object.freeze({
    vocabularyId: answer.id,
    initialDirection: directions[index],
    variants: Object.freeze({
      [DIRECTIONS.SPANISH_TO_ENGLISH]: buildQuestionForAnswer(
        vocabulary,
        answer,
        DIRECTIONS.SPANISH_TO_ENGLISH,
        random,
      ),
      [DIRECTIONS.ENGLISH_TO_SPANISH]: buildQuestionForAnswer(
        vocabulary,
        answer,
        DIRECTIONS.ENGLISH_TO_SPANISH,
        random,
      ),
    }),
  }));
}

export function buildQuizFromAnswers(vocabulary, answers, random = Math.random) {
  if (!Array.isArray(vocabulary) || vocabulary.length < 4) {
    throw new Error("At least four vocabulary entries are required.");
  }
  if (!Array.isArray(answers) || answers.length === 0) {
    throw new Error("At least one quiz answer is required.");
  }

  const vocabularyIds = new Set(vocabulary.map((entry) => entry.id));
  if (answers.some((entry) => !vocabularyIds.has(entry.id))) {
    throw new Error("Every quiz answer must belong to the vocabulary.");
  }

  const directions = shuffle(
    Array.from({ length: answers.length }, (_, index) => (
      index % 2 === 0 ? DIRECTIONS.SPANISH_TO_ENGLISH : DIRECTIONS.ENGLISH_TO_SPANISH
    )),
    random,
  );

  return shuffle(answers, random).map((answer, index) => Object.freeze({
    vocabularyId: answer.id,
    initialDirection: directions[index],
    variants: Object.freeze({
      [DIRECTIONS.SPANISH_TO_ENGLISH]: buildQuestionForAnswer(
        vocabulary,
        answer,
        DIRECTIONS.SPANISH_TO_ENGLISH,
        random,
      ),
      [DIRECTIONS.ENGLISH_TO_SPANISH]: buildQuestionForAnswer(
        vocabulary,
        answer,
        DIRECTIONS.ENGLISH_TO_SPANISH,
        random,
      ),
    }),
  }));
}
