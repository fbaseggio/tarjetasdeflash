import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  emptyCourse, planFocusLesson, recordFocusAttempt, finishFocusLesson,
  courseProgress, createFocusStorage,
  focusWordStatus, setFocusWordPriority,
} from "../src/focus-course.js";
import { buildQuizFromAnswers } from "../src/questions.js";
import { createQuizSession } from "../src/quiz-session.js";
import { createActivityStorage } from "../src/activity-storage.js";
import { createFocusCourseController } from "../src/focus-course-ui.js";

const course = JSON.parse(readFileSync(new URL("../assets/focus-spanish2-chapter1.json", import.meta.url)));
const entries = course.entries;
assert.equal(entries.length, 77);
assert.equal(new Set(entries.map((e) => e.id)).size, 77);
assert.ok(entries.every((e, i) => e.section === 1 && e.curriculumRank === i + 1 && e.spanish && e.english));
function memory() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
}
function attempt(state, lesson, id, correct, phase = "main", date = lesson.date) {
  recordFocusAttempt(state, lesson, { vocabularyId: id, correct, phase, date });
}
function complete(state, date, wrong = []) {
  const lesson = planFocusLesson(entries, state, date);
  state.lessons.push(lesson);
  for (const id of lesson.questionIds) {
    attempt(state, lesson, id, !wrong.includes(id));
    if (wrong.includes(id)) attempt(state, lesson, id, true, "review");
  }
  finishFocusLesson(state, lesson, `${date}T12:00:00.000Z`);
  return lesson;
}

// Seven same-day lessons teach every entry exactly once in source order.
const perfect = emptyCourse();
for (let n = 0; n < 7; n += 1) {
  const lesson = complete(perfect, "2026-10-19");
  assert.deepEqual(lesson.newWordIds, entries.slice(n * 11, n * 11 + 11).map((e) => e.id));
  assert.equal(lesson.retryIds.length, 0);
  finishFocusLesson(perfect, lesson, "ignored"); // completion is idempotent
  assert.equal(perfect.introductionLessons, n + 1);
}
assert.equal(courseProgress(perfect, entries).retired, 0);
for (let n = 0; n < 11; n += 1) {
  const lesson = complete(perfect, "2026-10-19");
  assert.equal(lesson.questionIds.length, 7);
  assert.equal(lesson.newWordIds.length, 0);
}
assert.equal(courseProgress(perfect, entries).retired, 77);
assert.equal(planFocusLesson(entries, perfect, "2026-10-20").questionIds.length, 0);

// Reprises never turn a miss into a mastery success; only three carry forward.
const missed = emptyCourse();
const missedIds = entries.slice(0, 5).map((e) => e.id);
complete(missed, "2026-10-19", missedIds);
assert.equal(missed.words[missedIds[0]].successes, 0);
assert.equal(missed.words[missedIds[0]].encounters, 1);
assert.equal(missed.words[missedIds[0]].eligibleDate, "2026-10-20");
assert.equal(planFocusLesson(entries, missed, "2026-10-19").retryIds.length, 0);
assert.deepEqual(planFocusLesson(entries, missed, "2026-10-20").retryIds, missedIds.slice(0, 3));
complete(missed, "2026-10-20", [missedIds[0]]);
assert.deepEqual(planFocusLesson(entries, missed, "2026-10-20").retryIds, missedIds.slice(3));
assert.equal(missed.words[missedIds[1]].successes, 1);
assert.equal(missed.words[missedIds[1]].firstCorrect, false);
assert.equal(missed.words[missedIds[0]].eligibleDate, "2026-10-21");

// Review buckets are separate and capped at 7 / 4 / 3; no arbitrary filling.
const buckets = emptyCourse();
buckets.introductionLessons = 7;
entries.forEach((entry, i) => {
  if (i >= 30) return;
  buckets.words[entry.id] = {
    encounters: 1, successes: i < 20 ? 1 : 0, firstCorrect: i < 10,
    everMissed: i >= 10, eligibleDate: "2026-10-19", lastDate: "2026-10-18", lastLesson: i,
  };
});
let plan = planFocusLesson(entries, buckets, "2026-10-19");
assert.equal(plan.firstCorrectIds.length, 7);
assert.equal(plan.recoveredIds.length, 4);
assert.equal(plan.retryIds.length, 3);
assert.equal(new Set(plan.questionIds).size, 14);
complete(buckets, "2026-10-19");
assert.equal(courseProgress(buckets, entries).retired, 11);
for (const id of plan.firstCorrectIds.concat(plan.recoveredIds)) {
  assert.ok(!planFocusLesson(entries, buckets, "2026-10-20").questionIds.includes(id));
}
const tiny = emptyCourse();
tiny.introductionLessons = 7;
tiny.words[entries[0].id] = { ...buckets.words[entries[20].id], successes: 0 };
assert.equal(planFocusLesson(entries, tiny, "2026-10-20").questionIds.length, 1);

// Manual preferences preserve real answers and activity; known retires even a miss.
const manual = emptyCourse();
complete(manual, "2026-10-19", [entries[0].id]);
const answerHistory = JSON.stringify(manual.lessons);
setFocusWordPriority(manual, entries[0].id, "known", "2026-10-19");
assert.equal(manual.words[entries[0].id].successes, 0);
assert.equal(courseProgress(manual, entries).known, 1);
assert.equal(courseProgress(manual, entries).retired, 1);
assert.ok(!planFocusLesson(entries, manual, "2026-10-20").questionIds.includes(entries[0].id));
setFocusWordPriority(manual, entries[0].id, "normal", "2026-10-19");
assert.ok(planFocusLesson(entries, manual, "2026-10-20").retryIds.includes(entries[0].id));
// Review a correct word: no fake wrong answer, but next-day eligibility and fresh successes.
const manualId = entries[1].id;
setFocusWordPriority(manual, manualId, "review", "2026-10-19");
assert.equal(manual.words[manualId].successes, 1);
assert.equal(manual.words[manualId].lastCorrect, true);
assert.equal(focusWordStatus(manual.words[manualId]).successes, 0);
assert.ok(!planFocusLesson(entries, manual, "2026-10-19").retryIds.includes(manualId));
assert.ok(planFocusLesson(entries, manual, "2026-10-20").retryIds.includes(manualId));
assert.equal(JSON.stringify(manual.lessons), answerHistory);
setFocusWordPriority(manual, manualId, "normal", "2026-10-19");
assert.equal(focusWordStatus(manual.words[manualId]).successes, 1);
assert.ok(!planFocusLesson(entries, manual, "2026-10-20").retryIds.includes(manualId));
// Previously completed words can be reopened; they move through the 3 then 4 buckets.
const reopened = structuredClone(perfect);
setFocusWordPriority(reopened, manualId, "review", "2026-10-19");
assert.equal(courseProgress(reopened, entries).retired, 76);
assert.equal(planFocusLesson(entries, reopened, "2026-10-19").questionIds.length, 0);
assert.deepEqual(planFocusLesson(entries, reopened, "2026-10-20").retryIds, [manualId]);
complete(reopened, "2026-10-20", [manualId]);
assert.equal(focusWordStatus(reopened.words[manualId]).successes, 0);
assert.equal(planFocusLesson(entries, reopened, "2026-10-20").questionIds.length, 0);
complete(reopened, "2026-10-21");
assert.equal(focusWordStatus(reopened.words[manualId]).successes, 1);
assert.deepEqual(planFocusLesson(entries, reopened, "2026-10-21").recoveredIds, [manualId]);
complete(reopened, "2026-10-21");
assert.equal(courseProgress(reopened, entries).retired, 77);
assert.equal(planFocusLesson(entries, reopened, "2026-10-22").questionIds.length, 0);
assert.throws(() => setFocusWordPriority(reopened, manualId, "invalid", "2026-10-22"), /Unknown/);
assert.throws(() => setFocusWordPriority(emptyCourse(), manualId, "known", "2026-10-22"), /tested/);

const boundary = emptyCourse();
const boundaryLesson = planFocusLesson(entries, boundary, "2026-12-31");
boundary.lessons.push(boundaryLesson);
attempt(boundary, boundaryLesson, entries[0].id, false);
assert.equal(boundary.words[entries[0].id].eligibleDate, "2027-01-01");
assert.throws(() => finishFocusLesson(boundary, boundaryLesson, "now"), /every question/);

// Dedicated storage never touches legacy or another profile's records.
const store = memory();
store.setItem("legacy-history", "keep");
const persistence = createFocusStorage(store);
persistence.save("gideon", missed);
assert.deepEqual(persistence.read("gideon"), missed);
assert.deepEqual(persistence.read("rebecca"), emptyCourse());
assert.equal(store.getItem("legacy-history"), "keep");
const activity = createActivityStorage(store);
const result = { correctCount: 11, wrongCount: 3, completionId: "focus-lesson-1" };
activity.recordCompletedQuiz("gideon", result);
activity.ensureMember("gideon");
activity.recordCompletedQuiz("gideon", result);
assert.equal(activity.getSummary("gideon").totalQuizzes, 1);
activity.recordCompletedQuiz("rebecca", result);
assert.equal(activity.getSummary("rebecca").totalQuizzes, 1);

// Both directions work with the small pool; related valid translations excluded.
let seed = 42;
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
for (let run = 0; run < 10; run += 1) {
  for (const definition of buildQuizFromAnswers(entries, entries, random)) {
    for (const question of Object.values(definition.variants)) {
      assert.equal(question.choices.length, 4);
      assert.equal(new Set(question.choices).size, 4);
      if (["s2c1-056", "s2c1-057"].includes(definition.vocabularyId)) {
        const alternate = definition.vocabularyId === "s2c1-056" ? "s2c1-057" : "s2c1-056";
        assert.ok(question.distractors.every((d) => d.vocabularyId !== alternate));
      }
    }
  }
}

// Minimal DOM harness: test actual controller events, timers, reload and profile switches.
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.className = ""; this.hidden = false; }
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return (this.text ?? "") + this.children.map((c) => c.textContent).join(" "); }
  append(...nodes) { nodes.forEach((node) => { node.parent = this; this.children.push(node); }); }
  replaceChildren(...nodes) { this.text = ""; this.children = []; this.append(...nodes); }
  setAttribute() {}
  removeAttribute() {}
  focus() {}
  addEventListener(name, callback) { this.listeners[name] = callback; }
  click() { if (!this.disabled) this.listeners.click?.(); }
  get classList() { return { add: (value) => { this.className += ` ${value}`; } }; }
  querySelectorAll(tag) { return this.children.flatMap((c) => [...(c.tag === tag ? [c] : []), ...c.querySelectorAll(tag)]); }
  before(node) { node.parent = this.parent; this.parent.children.splice(this.parent.children.indexOf(this), 0, node); }
  remove() { this.parent.children = this.parent.children.filter((c) => c !== this); }
}
let pending = null;
globalThis.document = { createElement: (tag) => new Element(tag) };
globalThis.window = { setTimeout: (callback) => { pending = callback; return 1; }, clearTimeout: () => { pending = null; } };
const flush = () => { const callback = pending; pending = null; callback?.(); };
const panel = new Element("section");
const uiStore = memory();
const uiActivity = createActivityStorage(uiStore);
let delay = 0;
const ui = createFocusCourseController({ panel, storage: uiStore, answerDelay: () => delay,
  recordActivity: uiActivity.recordCompletedQuiz });
const profile = { id: "gideon", name: "Gideon" };
const click = (text) => {
  const node = panel.querySelectorAll("button").find((b) => b.textContent === text);
  assert.ok(node, `Missing button ${text}: ${panel.textContent}`);
  node.click();
};
ui.activate(profile, course);
click("Begin lesson");
for (let i = 0; i < 10; i += 1) click("Next word");
click("Begin questions");
let submissions = 0;
let firstMiss = null;
while (ui.getExport(profile.id).lessons.at(-1).status !== "complete") {
  const saved = ui.getExport(profile.id).lessons.at(-1);
  const quiz = createQuizSession(saved.definitions);
  for (const answer of saved.attempts) { quiz.submitAnswer(answer.selectedAnswer); quiz.advance(); }
  const current = quiz.getState();
  if (current.phase === "complete") { flush(); continue; }
  const wrong = submissions === 0;
  const selected = wrong ? current.question.choices.find((c) => c !== current.question.correctAnswer) : current.question.correctAnswer;
  if (wrong) firstMiss = current.question.vocabularyId;
  click(selected);
  submissions += 1;
  if (submissions === 3) {
    ui.deactivate();
    assert.equal(pending, null);
    ui.activate(profile, course);
    click("Resume lesson");
  } else flush();
  assert.ok(submissions <= 12);
}
assert.equal(submissions, 12);
assert.equal(ui.getExport(profile.id).words[firstMiss].successes, 0);
assert.equal(ui.getExport(profile.id).lessons[0].wrongCount, 1);
assert.ok(panel.textContent.includes("Lesson complete"));
click("View summary");
assert.ok(panel.textContent.includes("10 / 11 correct"));
const scoredLesson = JSON.stringify(ui.getExport(profile.id).lessons[0]);
const reviewedId = Object.keys(ui.getExport(profile.id).lessons[0].firstAnswers)[0];
click("I know this");
assert.equal(ui.getExport(profile.id).words[reviewedId].manualPriority, "known");
assert.equal(panel.querySelectorAll("details")[0].open, true);
assert.ok(panel.textContent.includes("Marked as known"));
click("Review this");
assert.equal(ui.getExport(profile.id).words[reviewedId].manualPriority, "review");
assert.ok(panel.textContent.includes("Review requested"));
assert.equal(JSON.stringify(ui.getExport(profile.id).lessons[0]), scoredLesson);
ui.activate(profile, course);
click("Review last lesson");
assert.ok(panel.textContent.includes("Review requested"));
click("Use quiz results");
assert.equal(ui.getExport(profile.id).words[reviewedId].manualPriority, undefined);
assert.equal(JSON.stringify(ui.getExport(profile.id).lessons[0]), scoredLesson);
ui.activate(profile, course);
assert.equal(uiActivity.getSummary(profile.id).totalQuizzes, 1);
click("Begin lesson");
delay = 1500;
for (let i = 0; i < 10; i += 1) click("Next word");
click("Begin questions");
assert.equal(panel.querySelectorAll("button").length, 0);
assert.ok(pending);
ui.deactivate();
ui.activate({ id: "rebecca" }, course);
assert.equal(pending, null);
assert.equal(ui.getExport("rebecca").lessons.length, 0);
assert.equal(ui.getExport(profile.id).lessons.length, 2);

// A stale tab must not overwrite a newer saved lesson.
ui.activate(profile, course);
const otherTab = createFocusStorage(uiStore);
const changed = otherTab.read(profile.id);
changed.revision += 1;
otherTab.save(profile.id, changed);
const previousError = console.error;
console.error = () => {};
click("Resume lesson");
flush(); // reveal choices using the stale in-memory state
panel.querySelectorAll("button")[0].click();
console.error = previousError;
assert.ok(panel.textContent.includes("updated in another tab"));
assert.deepEqual(otherTab.read(profile.id), changed);
console.log("Focused course policy, vocabulary, persistence, activity and UI tests passed.");
