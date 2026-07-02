export function shuffle(items, random = Math.random) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function buildQuestion(vocabulary, previousVocabularyId = null, random = Math.random) {
  if (!Array.isArray(vocabulary) || vocabulary.length < 4) {
    throw new Error("At least four vocabulary entries are required.");
  }

  const promptPool = vocabulary.filter((entry) => entry.id !== previousVocabularyId);
  const promptChoices = promptPool.length > 0 ? promptPool : vocabulary;
  const answer = promptChoices[Math.floor(random() * promptChoices.length)];

  const seenTranslations = new Set([answer.english]);
  const distractors = [];

  for (const entry of shuffle(vocabulary, random)) {
    if (entry.id === answer.id || seenTranslations.has(entry.english)) {
      continue;
    }

    seenTranslations.add(entry.english);
    distractors.push(entry.english);

    if (distractors.length === 3) {
      break;
    }
  }

  if (distractors.length !== 3) {
    throw new Error("Four distinct answer choices could not be generated.");
  }

  return {
    vocabularyId: answer.id,
    prompt: answer.spanish,
    correctAnswer: answer.english,
    choices: shuffle([answer.english, ...distractors], random),
  };
}
