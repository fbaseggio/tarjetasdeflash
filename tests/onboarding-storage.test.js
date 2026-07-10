import assert from "node:assert/strict";
import { createOnboardingStorage } from "../src/onboarding-storage.js";

const values = new Map();
const memoryStorage = {
  getItem(key) {
    return values.get(key) ?? null;
  },
  setItem(key, value) {
    values.set(key, value);
  },
};
const dataset = { id: "spanish-high-school-test-v1", version: 1 };
const storage = createOnboardingStorage(
  memoryStorage,
  () => new Date("2026-07-02T18:00:00.000Z"),
);

assert.equal(storage.get("franco", dataset), null);

const saved = storage.save("franco", dataset, {
  knownThrough: "foundation",
  learningFrontier: "everyday",
  confidence: "low",
  assessedCount: 22,
  presumedKnownTiers: ["foundation"],
  confirmationTier: "everyday",
  scores: {
    foundation: { correct: 4, total: 4 },
    everyday: { correct: 4, total: 10 },
    expanding1: { correct: 1, total: 4 },
    expanding2: { correct: 0, total: 4 },
  },
  attempts: [{
    vocabularyId: "agua",
    tier: "foundation",
    direction: "spanish-to-english",
    correct: true,
  }],
});

assert.equal(saved.completedAt, "2026-07-02T18:00:00.000Z");
assert.equal(storage.get("franco", dataset)?.placement.learningFrontier, "everyday");
assert.equal(storage.get("milo", dataset), null);
assert.equal(storage.get("franco", { ...dataset, version: 2 }), null);

console.log("Per-profile, dataset-versioned onboarding storage checks passed.");
