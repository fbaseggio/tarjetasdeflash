const SETTINGS_KEY = "tarjetas-ui-settings-v1";
const CHOICE_REVEAL_DELAYS = Object.freeze({
  off: 0,
  short: 1000,
  normal: 1500,
});
const NEW_WORD_STYLES = Object.freeze({
  MIXED: "mixed",
  TOPIC_GROUPS: "topic-groups",
});

export const DEFAULT_CHOICE_REVEAL_DELAY = "normal";
export const CHOICE_REVEAL_DELAY_OPTIONS = Object.freeze(Object.keys(CHOICE_REVEAL_DELAYS));
export const DEFAULT_NEW_WORD_STYLE = NEW_WORD_STYLES.MIXED;
export const NEW_WORD_STYLE_OPTIONS = Object.freeze(Object.values(NEW_WORD_STYLES));

function safeParse(rawValue) {
  if (!rawValue) return {};
  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeChoiceRevealDelay(value) {
  return CHOICE_REVEAL_DELAY_OPTIONS.includes(value)
    ? value
    : DEFAULT_CHOICE_REVEAL_DELAY;
}

function defaultNewWordStyle(profileId) {
  return profileId === "gideon" ? NEW_WORD_STYLES.TOPIC_GROUPS : DEFAULT_NEW_WORD_STYLE;
}

function normalizeNewWordStyle(value, profileId = null) {
  return NEW_WORD_STYLE_OPTIONS.includes(value)
    ? value
    : defaultNewWordStyle(profileId);
}

export function choiceRevealDelayMs(setting) {
  return CHOICE_REVEAL_DELAYS[normalizeChoiceRevealDelay(setting)];
}

export function createSettingsStorage(storage) {
  function read() {
    try {
      return safeParse(storage?.getItem(SETTINGS_KEY));
    } catch {
      return {};
    }
  }

  function save(settings) {
    try {
      storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // The app keeps working with in-memory defaults if storage is unavailable.
    }
  }

  function getSettings(profileId = null) {
    const settings = read();
    return Object.freeze({
      choiceRevealDelay: normalizeChoiceRevealDelay(settings.choiceRevealDelay),
      newWordStyle: normalizeNewWordStyle(
        settings.newWordStyleByProfile?.[profileId],
        profileId,
      ),
    });
  }

  function setChoiceRevealDelay(choiceRevealDelay) {
    const settings = {
      ...read(),
      choiceRevealDelay: normalizeChoiceRevealDelay(choiceRevealDelay),
    };
    save(settings);
    return getSettings();
  }

  function setNewWordStyle(profileId, newWordStyle) {
    const settings = read();
    const byProfile = {
      ...(settings.newWordStyleByProfile ?? {}),
      [profileId]: normalizeNewWordStyle(newWordStyle, profileId),
    };
    save({
      ...settings,
      newWordStyleByProfile: byProfile,
    });
    return getSettings(profileId);
  }

  return Object.freeze({ getSettings, setChoiceRevealDelay, setNewWordStyle });
}
