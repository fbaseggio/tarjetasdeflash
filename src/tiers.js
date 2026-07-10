export const TIER_ORDER = Object.freeze(["foundation", "everyday", "expanding1", "expanding2"]);

export const TIER_LABELS = Object.freeze({
  foundation: "Foundation",
  everyday: "Everyday",
  expanding1: "Expanding 1",
  expanding2: "Expanding 2",
});

export function tierIndex(tier) {
  const index = TIER_ORDER.indexOf(tier);
  return index < 0 ? 0 : index;
}

export function lowerTiers(frontier) {
  return TIER_ORDER.slice(0, tierIndex(frontier));
}
