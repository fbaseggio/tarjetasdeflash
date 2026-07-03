const STORAGE_GENERATION_KEY = "tarjetas.storageGeneration";
const CURRENT_STORAGE_GENERATION = "2";
const HISTORY_KEY_PREFIXES = Object.freeze([
  "tarjetas.activity.",
  "tarjetas.onboarding.",
  "tarjetas.learning.",
]);
const LEGACY_DATABASES = Object.freeze(["tarjetas-learning"]);

function historyKeys(storage) {
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && HISTORY_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      keys.push(key);
    }
  }
  return keys;
}

function deleteDatabase(indexedDbFactory, name) {
  if (!indexedDbFactory?.deleteDatabase) return Promise.resolve();
  return new Promise((resolve) => {
    const request = indexedDbFactory.deleteDatabase(name);
    request.onsuccess = resolve;
    request.onerror = resolve;
    request.onblocked = resolve;
  });
}

export async function ensureCurrentStorageGeneration(storage, indexedDbFactory) {
  try {
    if (storage.getItem(STORAGE_GENERATION_KEY) === CURRENT_STORAGE_GENERATION) {
      return false;
    }

    historyKeys(storage).forEach((key) => storage.removeItem(key));
    await Promise.all(LEGACY_DATABASES.map((name) => deleteDatabase(indexedDbFactory, name)));
    storage.setItem(STORAGE_GENERATION_KEY, CURRENT_STORAGE_GENERATION);
    return true;
  } catch {
    return false;
  }
}
