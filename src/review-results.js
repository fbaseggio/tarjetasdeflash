const STAGE_LABELS = Object.freeze({
  "check-in": "Check-in",
  "due-review": "Due reviews",
  extra: "Extra quiz",
});

const TIER_LABELS = Object.freeze({
  foundation: "Foundation assessment",
  everyday: "Everyday assessment",
  expanding: "Expanding assessment",
});

function questionItem(attempt, relatedAttempts) {
  return Object.freeze({
    vocabularyId: attempt.vocabularyId,
    prompt: attempt.promptText,
    correctAnswer: attempt.correctAnswer,
    selectedAnswer: attempt.selectedAnswer,
    correct: attempt.correct,
    direction: attempt.direction,
    recoveryAttempts: Math.max(0, relatedAttempts.length - 1),
  });
}

function questionSection(id, title, attempts) {
  const items = attempts.filter((attempt) => attempt.phase === "main").map((attempt) => {
    const related = attempts.filter((candidate) => candidate.vocabularyId === attempt.vocabularyId);
    return questionItem(attempt, related);
  });
  return Object.freeze({
    id,
    title,
    kind: "questions",
    correctCount: items.filter((item) => item.correct).length,
    wrongCount: items.filter((item) => !item.correct).length,
    items: Object.freeze(items),
  });
}

export function buildHistoryReview({ rounds, attempts, practiceSessionId = null, roundId = null, newWords = [] }) {
  const selectedRounds = rounds.filter((round) => (
    roundId ? round.id === roundId : round.practiceSessionId === practiceSessionId
  ));
  const selectedRoundIds = new Set(selectedRounds.map((round) => round.id));
  const selectedAttempts = attempts.filter((attempt) => selectedRoundIds.has(attempt.quizRoundId));
  const sections = [];

  for (const stage of ["check-in", "new-words", "due-review", "extra"]) {
    if (stage === "new-words") {
      if (newWords.length > 0) {
        sections.push(Object.freeze({
          id: "new-words",
          title: "New words",
          kind: "presentations",
          items: Object.freeze(newWords.map((entry) => Object.freeze({
            vocabularyId: entry.id,
            spanish: entry.spanish,
            english: entry.english,
          }))),
        }));
      }
      continue;
    }
    const stageRoundIds = new Set(
      selectedRounds.filter((round) => round.stage === stage).map((round) => round.id),
    );
    if (stageRoundIds.size === 0) continue;
    const stageAttempts = selectedAttempts
      .filter((attempt) => stageRoundIds.has(attempt.quizRoundId))
      .sort((left, right) => left.answeredAt.localeCompare(right.answeredAt));
    sections.push(questionSection(stage, STAGE_LABELS[stage], stageAttempts));
  }

  return Object.freeze(sections);
}

export function buildAssessmentReview(assessmentResult, vocabulary) {
  const entries = new Map(vocabulary.map((entry) => [entry.id, entry]));
  return Object.freeze(["foundation", "everyday", "expanding"].map((tier) => {
    const items = assessmentResult.attempts.filter((attempt) => attempt.tier === tier).map((attempt) => {
      const entry = entries.get(attempt.vocabularyId);
      const spanishPrompt = attempt.direction === "spanish-to-english";
      return Object.freeze({
        vocabularyId: attempt.vocabularyId,
        prompt: spanishPrompt ? entry.spanish : entry.english,
        correctAnswer: attempt.correctAnswer,
        selectedAnswer: attempt.selectedAnswer,
        correct: attempt.correct,
        direction: attempt.direction,
        recoveryAttempts: 0,
      });
    });
    return Object.freeze({
      id: `assessment-${tier}`,
      title: TIER_LABELS[tier],
      kind: "questions",
      correctCount: items.filter((item) => item.correct).length,
      wrongCount: items.filter((item) => !item.correct).length,
      items: Object.freeze(items),
    });
  }).filter((section) => section.items.length > 0));
}

export function answerFeedback(correct) {
  return correct ? "Correct." : "Incorrect.";
}
