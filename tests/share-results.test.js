import assert from "node:assert/strict";
import {
  buildSessionSharePayload,
  buildShareCardSvg,
  isFirstSessionOfDay,
  PUBLIC_APP_URL,
  shareSessionResults,
} from "../src/share-results.js";

const payload = buildSessionSharePayload({
  displayName: "Franco",
  distinctWords: 27,
  newWords: 15,
  retries: 4,
  streak: 3,
});
assert.equal(payload.title, "Franco’s Spanish practice");
assert.equal(
  payload.text,
  "🇪🇸 Franco finished today’s Tarjetas de Flash session!\n27 words practiced · 15 new words · 4 retries · 3-day streak",
);
assert.equal(payload.url, PUBLIC_APP_URL);
assert.match(payload.clipboardText, /Try it: https:\/\/fbaseggio\.github\.io\/tarjetasdeflash\/$/);
const svg = buildShareCardSvg(payload);
assert.match(svg, /width="1200" height="630"/);
assert.match(svg, />Franco practiced Spanish today</);
assert.match(svg, />27<\/text>/);
assert.match(svg, />15<\/text>/);
assert.match(svg, />4<\/text>/);
assert.match(svg, />3<\/text>/);
assert.match(
  buildShareCardSvg(buildSessionSharePayload({
    displayName: "Milo & Gideon",
    distinctWords: 1,
    newWords: 0,
    retries: 0,
    streak: 1,
  })),
  /Milo &amp; Gideon practiced Spanish today/,
);

let sharedPayload;
assert.equal(await shareSessionResults({
  async share(value) { sharedPayload = value; },
}, payload), "shared");
assert.deepEqual(sharedPayload, {
  title: payload.title,
  text: payload.text,
  url: payload.url,
});

const fakeImage = { name: "tarjetas-session-results.png", type: "image/png" };
assert.equal(await shareSessionResults({
  canShare(value) { return value.files?.[0] === fakeImage; },
  async share(value) { sharedPayload = value; },
}, payload, fakeImage), "shared-image");
assert.deepEqual(sharedPayload.files, [fakeImage]);

assert.equal(await shareSessionResults({
  async share() {
    const error = new Error("Canceled");
    error.name = "AbortError";
    throw error;
  },
}, payload), "canceled");

let copiedText;
assert.equal(await shareSessionResults({
  clipboard: { async writeText(value) { copiedText = value; } },
}, payload), "copied");
assert.equal(copiedText, payload.clipboardText);

assert.equal(await shareSessionResults({}, payload), "unavailable");

assert.equal(isFirstSessionOfDay({ date: "2026-07-02", sessionKey: "2026-07-02" }), true);
assert.equal(isFirstSessionOfDay({ date: "2026-07-02", sessionKey: "2026-07-02#2" }), false);
assert.equal(isFirstSessionOfDay({ date: "2026-07-02", repeat: true }), false);
assert.equal(isFirstSessionOfDay(null), false);

console.log("Daily-session sharing and clipboard fallback checks passed.");
