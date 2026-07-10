import { TIER_LABELS, TIER_ORDER } from "./tiers.js?v=0.23.0";

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
  foundation: { mean: 0.35, strength: 2, spillover: 0.45 },
  everyday: { mean: 0.15, strength: 6, spillover: 0.35 },
  expanding1: { mean: 0.05, strength: 10, spillover: 0.25 },
  expanding2: { mean: 0.02, strength: 14, spillover: 0 },
});

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

function conservativeRate({ correct, tested, tier, priorMean }) {
  const prior = PROJECTED_PRIORS[tier] ?? { mean: 0.05, strength: 10 };
  const strength = prior.strength;
  const posterior = (correct + priorMean * strength) / (tested + strength);
  const standardError = Math.sqrt((posterior * (1 - posterior)) / Math.max(1, tested + strength));
  return Math.max(0, Math.min(1, posterior - 0.35 * standardError));
}

export function buildMasteryStats(vocabulary, learning, dateKey = null) {
  const words = learning?.words ?? {};
  const totalWords = vocabulary.length;
  let demonstratedRaw = 0;
  let demonstratedTodayRaw = 0;
  let projectedRaw = 0;
  let priorMean = PROJECTED_PRIORS.foundation.mean;

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

    priorMean = Math.max(priorMean, PROJECTED_PRIORS[tier].mean);
    const projectedRate = conservativeRate({ correct, tested, tier, priorMean });
    projectedRaw += entries.length * projectedRate;
    priorMean = Math.max(PROJECTED_PRIORS[tier].mean, projectedRate * PROJECTED_PRIORS[tier].spillover);

    return Object.freeze({
      tier,
      total: entries.length,
      tested,
      correct,
      demonstrated: Math.round(demonstrated),
      projectedRate,
    });
  });

  const projectedPercent = totalWords > 0 ? Math.round((projectedRaw / totalWords) * 100) : 0;
  const estimatedLevel = estimatedLevelFromProjectedPercent(projectedPercent);
  const lowerTierStrength = tierSummaries
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
    tiers: Object.freeze(tierSummaries),
  });
}
