export const DISTRACTOR_RELATION_SOURCE = Object.freeze({
  id: "curriculum-false-cognates-v1",
  reviewedOn: "2026-07-03",
  reference: "https://hispanismo.cervantes.es/recursos/false-friends-dictionary",
  note: "Pairs are limited to tempting meanings represented by entries in the active curriculum.",
});

export const FALSE_COGNATE_RELATION_RECORDS = Object.freeze([
  ["g-asistir-0eyyw0v", "g-ayudar-1w9mytp", "spanish-to-english"],
  ["g-ayudar-1w9mytp", "g-asistir-0eyyw0v", "english-to-spanish"],
  ["g-largo-1b1xc1u", "g-gran-grande-0d0py7q", "spanish-to-english"],
  ["g-gran-grande-0d0py7q", "g-largo-1b1xc1u", "english-to-spanish"],
  ["g-libreria-0ntdy4c", "g-biblioteca-0oo3f96", "spanish-to-english"],
  ["g-biblioteca-0oo3f96", "g-libreria-0ntdy4c", "english-to-spanish"],
  ["g-once-14dp4n8", "g-vez-1cl9k58", "spanish-to-english"],
  ["g-vez-1cl9k58", "g-once-14dp4n8", "english-to-spanish"],
  ["g-parientes-19xdkra", "g-padres-1xrak52", "spanish-to-english"],
  ["g-padres-1xrak52", "g-parientes-19xdkra", "english-to-spanish"],
  ["g-sopa-037x4q7", "g-jabon-0obanh4", "spanish-to-english"],
  ["g-jabon-0obanh4", "g-sopa-037x4q7", "english-to-spanish"],
].map(([targetId, candidateId, direction]) => Object.freeze({
  targetId,
  candidateId,
  direction,
})));

export const FALSE_COGNATE_RELATIONS = new Set(
  FALSE_COGNATE_RELATION_RECORDS.map(
    ({ targetId, candidateId, direction }) => `${targetId}>${candidateId}:${direction}`,
  ),
);
