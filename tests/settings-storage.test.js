import assert from "node:assert/strict";
import {
  choiceRevealDelayMs,
  createSettingsStorage,
} from "../src/settings-storage.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

const storage = createSettingsStorage(memoryStorage());
assert.deepEqual(storage.getSettings(), { choiceRevealDelay: "normal" });
assert.equal(choiceRevealDelayMs("off"), 0);
assert.equal(choiceRevealDelayMs("short"), 1000);
assert.equal(choiceRevealDelayMs("normal"), 1500);

storage.setChoiceRevealDelay("normal");
assert.deepEqual(storage.getSettings(), { choiceRevealDelay: "normal" });

storage.setChoiceRevealDelay("wildly annoying");
assert.deepEqual(storage.getSettings(), { choiceRevealDelay: "normal" });
assert.equal(choiceRevealDelayMs("wildly annoying"), 1500);

const unavailable = createSettingsStorage({
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
});
assert.deepEqual(unavailable.getSettings(), { choiceRevealDelay: "normal" });
assert.deepEqual(unavailable.setChoiceRevealDelay("off"), { choiceRevealDelay: "normal" });

console.log("Choice reveal delay settings checks passed.");
