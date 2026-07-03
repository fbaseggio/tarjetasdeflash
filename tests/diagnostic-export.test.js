import assert from "node:assert/strict";
import { APP_VERSION } from "../src/app-version.js";
import {
  buildDiagnosticExport,
  diagnosticFilename,
  downloadDiagnostic,
} from "../src/diagnostic-export.js";

const payload = buildDiagnosticExport({
  exportedAt: "2026-07-02T20:00:00.000Z",
  profile: { id: "franco", displayName: "Franco", privateValue: "excluded" },
  dataset: {
    id: "test-vocabulary",
    version: 2,
    entryCount: 1500,
    applicationStatus: "active-testing-vocabulary",
  },
  onboarding: { placement: { learningFrontier: "everyday" } },
  activity: { summary: { currentStreak: 3 } },
  learning: { words: { agua: { tier: "foundation" } } },
  mastery: { schemaVersion: 1, concepts: [{ conceptKey: "agua|noun|water" }] },
  history: { practiceSessions: [], quizRounds: [], attempts: [] },
  storageStatus: { available: true, state: "ready", schemaVersion: 1 },
  environment: { timezone: "America/New_York", locale: "en-US" },
});

assert.equal(payload.exportType, "tarjetas-diagnostic");
assert.equal(payload.application.version, APP_VERSION);
assert.deepEqual(payload.profile, { id: "franco", displayName: "Franco" });
assert.equal(payload.vocabulary.version, 2);
assert.equal(payload.diagnostics.storage.schemaVersion, 1);
assert.equal(payload.mastery.schemaVersion, 1);
assert.equal(payload.profile.privateValue, undefined);
assert.match(
  diagnosticFilename("franco", new Date("2026-07-02T20:00:00.000Z")),
  /^tarjetas-franco-diagnostic-2026-07-02T20-00-00-000Z\.json$/,
);

let clicked = false;
let appended = false;
let removed = false;
let revoked = null;
let scheduledDelay = null;
const fakeLink = {
  click() { clicked = true; },
  remove() { removed = true; },
};
const fakeDocument = {
  createElement(name) {
    assert.equal(name, "a");
    return fakeLink;
  },
  body: {
    append(link) {
      assert.equal(link, fakeLink);
      appended = true;
    },
  },
};
const fakeUrl = {
  createObjectURL(blob) {
    assert.equal(blob.type, "application/json");
    return "blob:diagnostic";
  },
  revokeObjectURL(url) { revoked = url; },
};
downloadDiagnostic(fakeDocument, fakeUrl, payload, "diagnostic.json", (callback, delay) => {
  scheduledDelay = delay;
  callback();
});
assert.equal(fakeLink.href, "blob:diagnostic");
assert.equal(fakeLink.download, "diagnostic.json");
assert.equal(clicked, true);
assert.equal(appended, true);
assert.equal(removed, true);
assert.equal(revoked, "blob:diagnostic");
assert.equal(scheduledDelay, 1000);

console.log("Active-profile diagnostic schema, filename, and download checks passed.");
