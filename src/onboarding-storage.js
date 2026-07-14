const ONBOARDING_KEY_PREFIX = "tarjetas.onboarding.v2.";

export function createOnboardingStorage(storage, now = () => new Date()) {
  function keyFor(profileId) {
    return `${ONBOARDING_KEY_PREFIX}${profileId}`;
  }

  function get(profileId, dataset) {
    try {
      const serialized = storage.getItem(keyFor(profileId));
      if (!serialized) {
        return null;
      }
      const value = JSON.parse(serialized);
      if (
        value?.datasetId !== dataset.id
        || !value?.placement
      ) {
        return null;
      }
      value.datasetVersion = dataset.version;
      return value;
    } catch {
      return null;
    }
  }

  function save(profileId, dataset, assessmentResult) {
    const value = {
      completedAt: now().toISOString(),
      datasetId: dataset.id,
      datasetVersion: dataset.version,
      placement: {
        knownThrough: assessmentResult.knownThrough,
        learningFrontier: assessmentResult.learningFrontier,
        confidence: assessmentResult.confidence,
        assessedCount: assessmentResult.assessedCount,
        presumedKnownTiers: [...assessmentResult.presumedKnownTiers],
        confirmationTier: assessmentResult.confirmationTier,
        scores: assessmentResult.scores,
      },
      assessedWords: Object.fromEntries(
        assessmentResult.attempts.map((attempt) => [attempt.vocabularyId, {
          tier: attempt.tier,
          direction: attempt.direction,
          correct: attempt.correct,
        }]),
      ),
    };

    try {
      storage.setItem(keyFor(profileId), JSON.stringify(value));
    } catch {
      // The current visit can continue even if persistence is unavailable.
    }

    return value;
  }

  return Object.freeze({ get, save });
}
