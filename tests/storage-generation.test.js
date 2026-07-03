import assert from "node:assert/strict";
import { ensureCurrentStorageGeneration } from "../src/storage-generation.js";

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
  }

  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const deletedDatabases = [];
const indexedDb = {
  deleteDatabase(name) {
    deletedDatabases.push(name);
    const request = {};
    queueMicrotask(() => request.onsuccess?.());
    return request;
  },
};
const storage = new MemoryStorage({
  "tarjetas.activeProfileId.v1": "franco",
  "tarjetas.activity.v1.franco": "old activity",
  "tarjetas.onboarding.v1.franco": "old onboarding",
  "tarjetas.learning.v1.franco": "old learning",
  unrelated: "keep me",
});

assert.equal(await ensureCurrentStorageGeneration(storage, indexedDb), true);
assert.equal(storage.getItem("tarjetas.storageGeneration"), "2");
assert.equal(storage.getItem("tarjetas.activeProfileId.v1"), "franco");
assert.equal(storage.getItem("unrelated"), "keep me");
assert.equal(storage.getItem("tarjetas.activity.v1.franco"), null);
assert.equal(storage.getItem("tarjetas.onboarding.v1.franco"), null);
assert.equal(storage.getItem("tarjetas.learning.v1.franco"), null);
assert.deepEqual(deletedDatabases, ["tarjetas-learning"]);

assert.equal(await ensureCurrentStorageGeneration(storage, indexedDb), false);
assert.deepEqual(deletedDatabases, ["tarjetas-learning"]);

console.log("Storage-generation reset checks passed.");
