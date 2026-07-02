import { shuffle } from "./questions.js";

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
    const auditPool = shuffle(
      vocabulary.filter((entry) => entry.tier === "foundation" && !selectedIds.has(entry.id)),
      random,
    );
    selected.push(...auditPool.slice(0, auditCount));
  }

  if (selected.length !== requestedCount) {
    throw new Error("The tiered quiz selection could not be filled.");
  }

  return shuffle(selected, random);
}
