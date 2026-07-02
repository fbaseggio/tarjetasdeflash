import assert from "node:assert/strict";
import { createProfileStorage } from "../src/profile-storage.js";
import { initializeRecognition } from "../src/recognition.js";

class FakeElement {
  constructor() {
    this.hidden = false;
    this.textContent = "";
    this.listeners = new Map();
    this.resetCount = 0;
    this.focusCount = 0;
  }

  addEventListener(eventName, listener) {
    this.listeners.set(eventName, listener);
  }

  dispatch(eventName) {
    this.listeners.get(eventName)?.({ preventDefault() {} });
  }

  reset() {
    this.resetCount += 1;
  }

  focus() {
    this.focusCount += 1;
  }

  querySelector() {
    return this;
  }
}

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function createHarness(memoryStorage, initialAnswers = { animal: null, color: null }) {
  const elements = {
    form: new FakeElement(),
    panel: new FakeElement(),
    feedback: new FakeElement(),
    quizPanel: new FakeElement(),
    userMenu: new FakeElement(),
    greeting: new FakeElement(),
    changeUserButton: new FakeElement(),
  };
  const recognizedProfiles = [];
  let answers = initialAnswers;

  initializeRecognition({
    ...elements,
    storage: createProfileStorage(memoryStorage),
    onRecognized(profile) {
      recognizedProfiles.push(profile);
    },
    readAnswers() {
      return answers;
    },
  });

  return {
    ...elements,
    recognizedProfiles,
    setAnswers(nextAnswers) {
      answers = nextAnswers;
    },
  };
}

const memoryStorage = createMemoryStorage();
const firstVisit = createHarness(memoryStorage);

assert.equal(firstVisit.panel.hidden, false);
assert.equal(firstVisit.quizPanel.hidden, true);
assert.equal(firstVisit.userMenu.hidden, true);

firstVisit.setAnswers({ animal: "elephant", color: "green" });
firstVisit.form.dispatch("submit");
assert.equal(firstVisit.feedback.textContent, "We don’t recognize that combination yet. Try again.");
assert.equal(firstVisit.recognizedProfiles.length, 0);

firstVisit.setAnswers({ animal: "elephant", color: "blue" });
firstVisit.form.dispatch("submit");
assert.equal(firstVisit.greeting.textContent, "¡Hola, Franco!");
assert.equal(firstVisit.panel.hidden, true);
assert.equal(firstVisit.quizPanel.hidden, false);
assert.equal(firstVisit.recognizedProfiles[0].id, "franco");

const returnVisit = createHarness(memoryStorage);
assert.equal(returnVisit.greeting.textContent, "¡Hola, Franco!");
assert.equal(returnVisit.panel.hidden, true);
assert.equal(returnVisit.quizPanel.hidden, false);
assert.equal(returnVisit.recognizedProfiles[0].id, "franco");

returnVisit.changeUserButton.dispatch("click");
assert.equal(returnVisit.panel.hidden, false);
assert.equal(returnVisit.quizPanel.hidden, true);
assert.equal(returnVisit.userMenu.hidden, true);
assert.equal(returnVisit.form.focusCount, 1);

const afterChange = createHarness(memoryStorage);
assert.equal(afterChange.panel.hidden, false);
assert.equal(afterChange.recognizedProfiles.length, 0);

console.log("Recognition controller checks passed.");
