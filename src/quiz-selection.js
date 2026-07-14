import { shuffle } from "./questions.js?v=0.24.3";
import { lowerTiers } from "./tiers.js?v=0.24.3";

export class QuizSelectionError extends Error {
  constructor(message) {
    super(message);
    this.name = "QuizSelectionError";
  }
}

export function selectQuizVocabulary(
  vocabulary,
  placement,
  requestedCount = 10,
  random = Math.random,
) {
  if (!Array.isArray(vocabulary) || vocabulary.length < requestedCount) {
    throw new QuizSelectionError("The vocabulary is too small for the requested quiz.");
  }

  const frontier = placement?.learningFrontier ?? "foundation";
  const frontierPool = shuffle(
    vocabulary.filter((entry) => entry.tier === frontier),
    random,
  );
  const auditCount = frontier === "foundation" ? 0 : Math.min(2, requestedCount);
  const frontierCount = requestedCount - auditCount;
  const selected = frontierPool.slice(0, frontierCount);
  const selectedIds = new Set(selected.map((entry) => entry.id));

  if (auditCount > 0) {
    const auditTiers = lowerTiers(frontier);
    const auditPools = Object.fromEntries(auditTiers.map((tier) => [tier, shuffle(
      vocabulary.filter((entry) => entry.tier === tier && !selectedIds.has(entry.id)),
      random,
    )]));
    const preferredTiers = [...auditTiers].reverse();
    let auditSelected = 0;
    while (auditSelected < auditCount && selected.length < requestedCount && preferredTiers.length > 0) {
      const tier = preferredTiers[auditSelected % preferredTiers.length];
      const entry = auditPools[tier]?.shift();
      if (!entry) {
        preferredTiers.splice(preferredTiers.indexOf(tier), 1);
        continue;
      }
      selected.push(entry);
      selectedIds.add(entry.id);
      auditSelected += 1;
    }
  }

  if (selected.length < requestedCount) {
    const fallbackPool = shuffle(
      vocabulary.filter((entry) => !selectedIds.has(entry.id)),
      random,
    );
    selected.push(...fallbackPool.slice(0, requestedCount - selected.length));
  }

  if (selected.length !== requestedCount) {
    throw new QuizSelectionError("The tiered quiz selection could not be filled.");
  }

  return shuffle(selected, random);
}
