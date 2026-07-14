import { TIER_LABELS, TIER_ORDER } from "./tiers.js?v=0.24.3";

const GAP_CREDIT = Object.freeze([
  [60, 1],
  [30, 1],
  [14, 0.9],
  [7, 0.75],
  [3, 0.6],
  [1, 0.4],
  [0, 0.25],
]);

const PROJECTED_PRIORS = Object.freeze({
  foundation: { mean: 0.35, strength: 2 },
  everyday: { mean: 0.15, strength: 6 },
  expanding1: { mean: 0.05, strength: 10 },
  expanding2: { mean: 0.02, strength: 14 },
});

const DOWNWARD_TRANSFER_BY_DISTANCE = Object.freeze([0, 0.98, 0.94, 0.9]);

function latestResult(word) {
  return Object.values(word?.directions ?? {})
    .filter((direction) => direction?.testedAt)
    .sort((left, right) => right.testedAt.localeCompare(left.testedAt))[0] ?? null;
}

export function demonstratedWordCredit(word) {
  const latest = latestResult(word);
  if (!latest) return word?.presentations > 0 ? 0.1 : 0;
  if (!latest.correct) return 0;

  const intervalDays = Number.isInteger(word?.schedule?.intervalDays)
    ? word.schedule.intervalDays
    : 0;
  const match = GAP_CREDIT.find(([minimumDays]) => intervalDays >= minimumDays);
  return match?.[1] ?? 0.25;
}

export function estimatedLevelFromProjectedPercent(projectedPercent) {
  const percent = Number.isFinite(projectedPercent) ? projectedPercent : 0;
  if (percent < 25) return "foundation";
  if (percent < 50) return "everyday";
  if (percent < 70) return "expanding1";
  return "expanding2";
}

export function placementFrontierFromScore(score) {
  const value = Number.isFinite(score) ? score : 1;
  if (value >= 3.5) return "expanding2";
  if (value >= 2.5) return "expanding1";
  if (value >= 1.5) return "everyday";
  return "foundation";
}

function conservativeRate({ correct, tested, tier }) {
  const prior = PROJECTED_PRIORS[tier] ?? { mean: 0.05, strength: 10 };
  const strength = prior.strength;
  const posterior = (correct + prior.mean * strength) / (tested + strength);
  const standardError = Math.sqrt((posterior * (1 - posterior)) / Math.max(1, tested + strength));
  return Math.max(0, Math.min(1, posterior - 0.35 * standardError));
}

function conservativeEvidenceRate({ correct, tested }) {
  if (!tested) return 0;
  const strength = 2;
  const posterior = (correct + 0.5 * strength) / (tested + strength);
  const standardError = Math.sqrt((posterior * (1 - posterior)) / (tested + strength));
  return Math.max(0, Math.min(1, posterior - 0.35 * standardError));
}

function capFromDirectMisses({ correct, tested }) {
  const misses = tested - correct;
  if (misses <= 0) return 1;
  const observedRate = correct / tested;
  return Math.max(0, Math.min(0.98, observedRate + 0.2 / Math.sqrt(misses)));
}

function downwardProjectedRate(tierSummary, higherTierSummaries) {
  const targetIndex = TIER_ORDER.indexOf(tierSummary.tier);
  const directRate = tierSummary.directProjectedRate;
  const downwardRate = higherTierSummaries.reduce((best, higherTierSummary) => {
    const higherIndex = TIER_ORDER.indexOf(higherTierSummary.tier);
    const distance = higherIndex - targetIndex;
    const transfer = DOWNWARD_TRANSFER_BY_DISTANCE[distance] ?? 0;
    return Math.max(best, higherTierSummary.evidenceRate * transfer);
  }, 0);
  const supportedRate = Math.max(directRate, downwardRate);
  return Math.min(supportedRate, capFromDirectMisses(tierSummary));
}

export function buildMasteryStats(vocabulary, learning, dateKey = null) {
  const words = learning?.words ?? {};
  const totalWords = vocabulary.length;
  let demonstratedRaw = 0;
  let demonstratedTodayRaw = 0;
  let projectedRaw = 0;

  const tierSummaries = TIER_ORDER.map((tier) => {
    const entries = vocabulary.filter((entry) => entry.tier === tier);
    let tested = 0;
    let correct = 0;
    let demonstrated = 0;

    entries.forEach((entry) => {
      const word = words[entry.id];
      const credit = demonstratedWordCredit(word);
      demonstrated += credit;
      demonstratedRaw += credit;
      if (dateKey && word?.lastFirstAttemptDate === dateKey) {
        demonstratedTodayRaw += credit;
      }
      const latest = latestResult(word);
      if (latest) {
        tested += 1;
        if (latest.correct) correct += 1;
      }
    });

    return Object.freeze({
      tier,
      total: entries.length,
      tested,
      correct,
      demonstrated: Math.round(demonstrated),
      directProjectedRate: conservativeRate({ correct, tested, tier }),
      evidenceRate: conservativeEvidenceRate({ correct, tested }),
    });
  });

  const projectedTierSummaries = tierSummaries.map((tierSummary, index) => {
    const higherTierSummaries = tierSummaries.slice(index + 1);
    const projectedRate = downwardProjectedRate(tierSummary, higherTierSummaries);
    projectedRaw += tierSummary.total * projectedRate;
    return Object.freeze({
      tier: tierSummary.tier,
      total: tierSummary.total,
      tested: tierSummary.tested,
      correct: tierSummary.correct,
      demonstrated: tierSummary.demonstrated,
      projectedRate,
    });
  });

  const projectedPercent = totalWords > 0 ? Math.round((projectedRaw / totalWords) * 100) : 0;
  const estimatedLevel = estimatedLevelFromProjectedPercent(projectedPercent);
  const lowerTierStrength = projectedTierSummaries
    .filter(({ tier }) => tier !== "expanding2")
    .reduce((sum, tier) => sum + tier.projectedRate, 0);
  const placementScore = Math.round(Math.min(4, 1 + lowerTierStrength) * 10) / 10;
  const placementFrontier = placementFrontierFromScore(placementScore);

  return Object.freeze({
    demonstrated: Math.round(demonstratedRaw),
    demonstratedToday: Math.round(demonstratedTodayRaw),
    total: totalWords,
    projectedPercent,
    estimatedLevel,
    estimatedLevelLabel: TIER_LABELS[estimatedLevel],
    placementScore,
    placementFrontier,
    placementFrontierLabel: TIER_LABELS[placementFrontier],
    tiers: Object.freeze(projectedTierSummaries),
  });
}
