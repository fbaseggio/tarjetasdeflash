export const ANIMALS = Object.freeze([
  { id: "elephant", label: "Elefante" },
  { id: "panda", label: "Panda" },
  { id: "penguin", label: "Pingüino" },
  { id: "lion", label: "León" },
]);

export const COLORS = Object.freeze([
  { id: "blue", label: "Azul" },
  { id: "purple", label: "Morado" },
  { id: "red", label: "Rojo" },
  { id: "green", label: "Verde" },
]);

export const PROFILES = Object.freeze([
  { id: "franco", displayName: "Franco", animal: "elephant", color: "blue" },
  { id: "rebecca", displayName: "Rebecca", animal: "panda", color: "purple" },
  { id: "milo", displayName: "Milo", animal: "penguin", color: "red" },
  { id: "gideon", displayName: "Gideon", animal: "lion", color: "green" },
]);

const profilesById = new Map(PROFILES.map((profile) => [profile.id, profile]));
const profilesByAnswers = new Map(
  PROFILES.map((profile) => [`${profile.animal}:${profile.color}`, profile]),
);

export function getProfileById(profileId) {
  return profilesById.get(profileId) ?? null;
}

export function resolveProfile(animal, color) {
  return profilesByAnswers.get(`${animal}:${color}`) ?? null;
}
