import { shuffle } from "./questions.js?v=0.24.0";
import { lowerTiers } from "./tiers.js?v=0.24.0";

export function selectQuizVocabulary(
  vocabulary,
  placement,
  requestedCount = 10,
  random = Math.random,
) {
  if (!Array.isArray(vocabulary) || vocabulary.length < requestedCount) {
    throw new Error("The vocabulary is too small for the requested quiz.");
  }

  const frontier = placement?.learningFrontier ?? "foundation";
  const frontierPool = shuffle(
    vocabulary.filter((entry) => entry.tier === frontier),
    random,
  );
  const auditCount = frontier === "foundation" ? 0 : Math.min(2, requestedCount);
  const frontierCount = requestedCount - auditCount;
  const selected = frontierPool.slice(0, frontierCount);

  if (selected.length < frontierCount) {
    throw new Error(`Not enough ${frontier} vocabulary is available.`);
  }

  if (auditCount > 0) {
    const selectedIds = new Set(selected.map((entry) => entry.id));
    const auditTiers = lowerTiers(frontier);
    const auditPools = Object.fromEntries(auditTiers.map((tier) => [tier, shuffle(
      vocabulary.filter((entry) => entry.tier === tier && !selectedIds.has(entry.id)),
      random,
    )]));
    const preferredTiers = [...auditTiers].reverse();
    while (selected.length < requestedCount && preferredTiers.length > 0) {
      const tier = preferredTiers[(selected.length - frontierCount) % preferredTiers.length];
      const entry = auditPools[tier]?.shift();
      if (!entry) {
        preferredTiers.splice(preferredTiers.indexOf(tier), 1);
        continue;
      }
      selected.push(entry);
      selectedIds.add(entry.id);
    }
  }

  if (selected.length !== requestedCount) {
    throw new Error("The tiered quiz selection could not be filled.");
  }

  return shuffle(selected, random);
}
