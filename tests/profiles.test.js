import assert from "node:assert/strict";
import {
  beginsSelfRegistration,
  getProfileById,
  isCorrectSwallowAnswer,
  resolveProfile,
  resolveSelfRegisteredProfile,
  SELF_REGISTRATION_NAMES,
} from "../src/profiles.js";
import { createProfileStorage } from "../src/profile-storage.js";

assert.equal(resolveProfile("elephant", "blue")?.displayName, "Franco");
assert.equal(resolveProfile("panda", "purple")?.displayName, "Rebecca");
assert.equal(resolveProfile("penguin", "red")?.displayName, "Milo");
assert.equal(resolveProfile("lion", "green")?.displayName, "Gideon");
assert.equal(resolveProfile("elephant", "green"), null);
assert.equal(resolveProfile("unknown", "blue"), null);
assert.equal(getProfileById("milo")?.displayName, "Milo");
assert.equal(getProfileById("cristina")?.displayName, "Cristina");
assert.equal(getProfileById("unknown"), null);
assert.equal(beginsSelfRegistration("lion", "purple"), true);
assert.equal(beginsSelfRegistration("lion", "green"), false);
assert.equal(isCorrectSwallowAnswer("african-or-european"), true);
assert.equal(isCorrectSwallowAnswer("meters-per-second"), false);
assert.equal(resolveSelfRegisteredProfile("seth")?.displayName, "Seth");
assert.equal(resolveSelfRegisteredProfile("franco"), null);
assert.equal(SELF_REGISTRATION_NAMES.length, 15);

const values = new Map();
const memoryStorage = {
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
const profileStorage = createProfileStorage(memoryStorage);

assert.equal(profileStorage.getActiveProfileId(), null);
profileStorage.setActiveProfileId("franco");
assert.equal(profileStorage.getActiveProfileId(), "franco");
profileStorage.clearActiveProfileId();
assert.equal(profileStorage.getActiveProfileId(), null);

console.log("Profile recognition and active-profile storage checks passed.");
