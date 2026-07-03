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

const ORIGINAL_PROFILES = [
  { id: "franco", displayName: "Franco", animal: "elephant", color: "blue" },
  { id: "rebecca", displayName: "Rebecca", animal: "panda", color: "purple" },
  { id: "milo", displayName: "Milo", animal: "penguin", color: "red" },
  { id: "gideon", displayName: "Gideon", animal: "lion", color: "green" },
];

export const SELF_REGISTRATION_NAMES = Object.freeze([
  "Seth",
  "Cristina",
  "Jeremy",
  "Hannah",
  "Natalie",
  "Jackie",
  "Lisa",
  "Sherry",
  "Lynette",
  "Kari",
  "Sam",
  "Ajit",
  "Jake",
  "Karen",
  "Tricia",
]);

const SELF_REGISTERED_PROFILES = SELF_REGISTRATION_NAMES.map((displayName) => ({
  id: displayName.toLocaleLowerCase("en-US"),
  displayName,
}));

export const PROFILES = Object.freeze([...ORIGINAL_PROFILES, ...SELF_REGISTERED_PROFILES]);

export const SWALLOW_ANSWERS = Object.freeze([
  { id: "meters-per-second", label: "11 meters per second" },
  { id: "miles-per-hour", label: "24 miles per hour" },
  { id: "laden-pigeon", label: "Faster than a laden pigeon" },
  {
    id: "african-or-european",
    label: "What do you mean, an African or a European swallow?",
    correct: true,
  },
]);

const profilesById = new Map(PROFILES.map((profile) => [profile.id, profile]));
const profilesByAnswers = new Map(
  ORIGINAL_PROFILES.map((profile) => [`${profile.animal}:${profile.color}`, profile]),
);

export function getProfileById(profileId) {
  return profilesById.get(profileId) ?? null;
}

export function resolveProfile(animal, color) {
  return profilesByAnswers.get(`${animal}:${color}`) ?? null;
}

export function beginsSelfRegistration(animal, color) {
  return animal === "lion" && color === "purple";
}

export function isCorrectSwallowAnswer(answerId) {
  return SWALLOW_ANSWERS.some((answer) => answer.id === answerId && answer.correct);
}

export function resolveSelfRegisteredProfile(profileId) {
  const profile = profilesById.get(profileId);
  return SELF_REGISTERED_PROFILES.includes(profile) ? profile : null;
}
