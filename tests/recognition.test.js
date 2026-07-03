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
    swallowForm: new FakeElement(),
    nameForm: new FakeElement(),
    panel: new FakeElement(),
    title: new FakeElement(),
    intro: new FakeElement(),
    feedback: new FakeElement(),
    quizPanel: new FakeElement(),
    userMenu: new FakeElement(),
    greeting: new FakeElement(),
    changeUserButton: new FakeElement(),
  };
  const recognizedProfiles = [];
  let answers = initialAnswers;
  let swallowAnswer = null;
  let profileName = null;

  initializeRecognition({
    ...elements,
    storage: createProfileStorage(memoryStorage),
    onRecognized(profile) {
      recognizedProfiles.push(profile);
    },
    readAnswers() {
      return answers;
    },
    readSwallowAnswer() {
      return swallowAnswer;
    },
    readName() {
      return profileName;
    },
  });

  return {
    ...elements,
    recognizedProfiles,
    setAnswers(nextAnswers) {
      answers = nextAnswers;
    },
    setSwallowAnswer(nextAnswer) {
      swallowAnswer = nextAnswer;
    },
    setProfileName(nextName) {
      profileName = nextName;
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

const registrationStorage = createMemoryStorage();
const registration = createHarness(registrationStorage);
registration.setAnswers({ animal: "lion", color: "purple" });
registration.form.dispatch("submit");
assert.equal(registration.form.hidden, true);
assert.equal(registration.swallowForm.hidden, false);
assert.equal(registration.nameForm.hidden, true);
assert.equal(registration.title.textContent, "One last identity check.");
assert.equal(registration.intro.textContent, "What is the air-speed of a swallow?");

registration.setSwallowAnswer("miles-per-hour");
registration.swallowForm.dispatch("submit");
assert.equal(registration.feedback.textContent, "We don’t recognize that answer yet. Try again.");
assert.equal(registration.nameForm.hidden, true);

registration.setSwallowAnswer("african-or-european");
registration.swallowForm.dispatch("submit");
assert.equal(registration.swallowForm.hidden, true);
assert.equal(registration.nameForm.hidden, false);
assert.equal(registration.title.textContent, "Welcome, traveler.");

registration.setProfileName("cristina");
registration.nameForm.dispatch("submit");
assert.equal(registration.greeting.textContent, "¡Hola, Cristina!");
assert.equal(registration.recognizedProfiles[0].id, "cristina");
assert.equal(registration.panel.hidden, true);

const registeredReturnVisit = createHarness(registrationStorage);
assert.equal(registeredReturnVisit.greeting.textContent, "¡Hola, Cristina!");
assert.equal(registeredReturnVisit.recognizedProfiles[0].id, "cristina");

console.log("Recognition controller checks passed.");
