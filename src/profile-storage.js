const ACTIVE_PROFILE_KEY = "tarjetas.activeProfileId.v1";

export function createProfileStorage(storage) {
  return Object.freeze({
    getActiveProfileId() {
      try {
        return storage.getItem(ACTIVE_PROFILE_KEY);
      } catch {
        return null;
      }
    },

    setActiveProfileId(profileId) {
      try {
        storage.setItem(ACTIVE_PROFILE_KEY, profileId);
      } catch {
        // The current visit still works when browser storage is unavailable.
      }
    },

    clearActiveProfileId() {
      try {
        storage.removeItem(ACTIVE_PROFILE_KEY);
      } catch {
        // Nothing else is required when browser storage is unavailable.
      }
    },
  });
}
