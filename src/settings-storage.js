const SETTINGS_KEY = "tarjetas-ui-settings-v1";
const CHOICE_REVEAL_DELAYS = Object.freeze({
  off: 0,
  short: 1000,
  normal: 1500,
});

export const DEFAULT_CHOICE_REVEAL_DELAY = "short";
export const CHOICE_REVEAL_DELAY_OPTIONS = Object.freeze(Object.keys(CHOICE_REVEAL_DELAYS));

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

  function getSettings() {
    const settings = read();
    return Object.freeze({
      choiceRevealDelay: normalizeChoiceRevealDelay(settings.choiceRevealDelay),
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

  return Object.freeze({ getSettings, setChoiceRevealDelay });
}
