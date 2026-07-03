import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const appVersionSource = await readFile(new URL("../src/app-version.js", import.meta.url), "utf8");
const version = appVersionSource.match(/APP_VERSION\s*=\s*"([^"]+)"/)?.[1];
assert.ok(version, "APP_VERSION must be declared as a string");

const sourceDirectory = new URL("../src/", import.meta.url);
const sourceFiles = (await readdir(sourceDirectory)).filter((name) => name.endsWith(".js"));
for (const sourceFile of sourceFiles) {
  const source = await readFile(new URL(sourceFile, sourceDirectory), "utf8");
  for (const match of source.matchAll(/from\s+"(\.\/[^"?]+\.js(?:\?v=([^"?]+))?)"/g)) {
    assert.equal(
      match[2],
      version,
      `${sourceFile} imports ${match[1]} without the current cache version`,
    );
  }
}

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
assert.match(html, new RegExp(`styles\\.css\\?v=${version.replaceAll(".", "\\.")}`));
assert.match(html, new RegExp(`app\\.js\\?v=${version.replaceAll(".", "\\.")}`));

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
assert.match(appSource, new RegExp(`vocabulary-official-v1\\.json\\?v=${version.replaceAll(".", "\\.")}`));
assert.match(appSource, new RegExp(`vocabulary-official-v1\\.meta\\.json\\?v=${version.replaceAll(".", "\\.")}`));

console.log(`All browser modules and release assets use cache version ${version}.`);
