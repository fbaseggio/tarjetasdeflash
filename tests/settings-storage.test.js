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
assert.deepEqual(storage.getSettings(), { choiceRevealDelay: "normal", newWordStyle: "mixed" });
assert.deepEqual(storage.getSettings("franco"), { choiceRevealDelay: "normal", newWordStyle: "mixed" });
assert.deepEqual(storage.getSettings("gideon"), {
  choiceRevealDelay: "normal",
  newWordStyle: "topic-groups",
});
assert.equal(choiceRevealDelayMs("off"), 0);
assert.equal(choiceRevealDelayMs("short"), 1000);
assert.equal(choiceRevealDelayMs("normal"), 1500);

storage.setChoiceRevealDelay("normal");
assert.deepEqual(storage.getSettings(), { choiceRevealDelay: "normal", newWordStyle: "mixed" });

storage.setChoiceRevealDelay("wildly annoying");
assert.deepEqual(storage.getSettings(), { choiceRevealDelay: "normal", newWordStyle: "mixed" });
assert.equal(choiceRevealDelayMs("wildly annoying"), 1500);
assert.equal(storage.setNewWordStyle("gideon", "mixed").newWordStyle, "mixed");
assert.equal(storage.getSettings("gideon").newWordStyle, "mixed");
assert.equal(storage.setNewWordStyle("franco", "topic-groups").newWordStyle, "topic-groups");
assert.equal(storage.setNewWordStyle("franco", "chaos").newWordStyle, "mixed");

const unavailable = createSettingsStorage({
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
});
assert.deepEqual(unavailable.getSettings(), { choiceRevealDelay: "normal", newWordStyle: "mixed" });
assert.deepEqual(unavailable.setChoiceRevealDelay("off"), {
  choiceRevealDelay: "normal",
  newWordStyle: "mixed",
});

console.log("Choice reveal delay and new-word style settings checks passed.");
