"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const sourceData = path.join(root, "source", "public", "data");
const rootData = path.join(root, "data");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const readBuffer = file => fs.readFileSync(file);
const normalizeAsset = value => String(value || "").replace(/^\.\//, "").split(/[?#]/, 1)[0];

function filesUnder(directory, prefix = "") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(absolute, relative) : [relative];
  }).sort();
}

function assertSameFile(left, right, message) {
  assert.ok(fs.existsSync(left), message + " (missing " + left + ")");
  assert.ok(fs.existsSync(right), message + " (missing " + right + ")");
  assert.ok(readBuffer(left).equals(readBuffer(right)), message);
}

// 1) Verify checked-in root/public mirrors before build-static has a chance to rewrite them.
const buildSource = read("scripts/build-static.cjs");
const copiesBlock = buildSource.match(/const canonicalCopies = \[([\s\S]*?)\n\];/);
assert.ok(copiesBlock, "the static build must declare its canonical root/public copy map");
const canonicalCopies = [...copiesBlock[1].matchAll(/\[\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\]/g)]
  .map(match => [match[1], match[2]]);
assert.ok(canonicalCopies.length >= 20, "the canonical root/public map must cover the app modules");
for (const [rootName, publicName] of canonicalCopies) {
  assertSameFile(
    path.join(root, rootName),
    path.join(publicDir, publicName),
    "checked-in root/public files must match before build: " + rootName
  );
}

// 2) The entire canonical data tree, not just a small required-file allowlist, must be mirrored.
assert.ok(fs.existsSync(sourceData), "canonical source/public/data must exist");
const sourceDataFiles = filesUnder(sourceData);
assert.ok(sourceDataFiles.length > 0, "canonical source data must not be empty");
for (const relative of sourceDataFiles) {
  const canonical = path.join(sourceData, relative);
  assertSameFile(canonical, path.join(rootData, relative),
    "root data copy must match canonical source: " + relative);
  assertSameFile(canonical, path.join(publicDir, "data", relative),
    "public data copy must match canonical source: " + relative);
}

// 3) Do not let generated inline engines hide a stale committed app shell.
const rootHtml = read("index.html");
const publicHtml = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
assert.equal(rootHtml, publicHtml, "root and public app shells must be identical before build");
const inlineEngines = [
  ["career-engine.js", "<script>\n/* Shared career progression and award engine for LAST WHISTLE. */"],
  ["match-engine.js", "<script>\n/* Deterministic, shared event-based match simulation for LAST WHISTLE. No DOM or storage. */"]
];
for (const [name, marker] of inlineEngines) {
  const start = rootHtml.indexOf(marker);
  assert.ok(start >= 0, name + " inline engine marker must exist");
  assert.equal(rootHtml.indexOf(marker, start + marker.length), -1,
    name + " inline engine marker must occur exactly once");
  const openEnd = rootHtml.indexOf(">", start) + 1;
  const close = rootHtml.indexOf("</script>", openEnd);
  assert.ok(openEnd > start && close > openEnd, name + " inline engine block must be well formed");
  const inlineSource = rootHtml.slice(openEnd, close).trim();
  const canonicalSource = read("source/public/data/" + name).trim();
  assert.equal(inlineSource, canonicalSource,
    name + " inline runtime must match canonical source before build");
}

// 4) Validate the runtime dependency graph and offline shell from the same HTML/SW files.
const swSource = read("sw.js");
assertSameFile(path.join(root, "sw.js"), path.join(publicDir, "sw.js"),
  "root/public service workers must match before build");
const shellMatch = swSource.match(/const APP_SHELL\s*=\s*(\[[\s\S]*?\]);/);
assert.ok(shellMatch, "service worker must declare a parseable APP_SHELL");
const appShell = JSON.parse(shellMatch[1]);
const shellSet = new Set(appShell);
const shellByPath = new Map(appShell.map(url => [normalizeAsset(url), url]));

const scriptTags = [...rootHtml.matchAll(/<script\b[^>]*>/gi)].map(match => {
  const src = match[0].match(/\bsrc=["']([^"']+)["']/i);
  return src ? { url: src[1], offset: match.index } : null;
}).filter(Boolean);
const stylesheetTags = [...rootHtml.matchAll(/<link\b[^>]*>/gi)].map(match => {
  const tag = match[0];
  const href = tag.match(/\bhref=["']([^"']+)["']/i);
  const rel = (tag.match(/\brel=["']([^"']+)["']/i) || [])[1] || "";
  return href && /stylesheet/i.test(rel) ? { url: href[1], offset: match.index } : null;
}).filter(Boolean);

function assertLocalAsset(url, source) {
  if (/^(?:https?:)?\/\//i.test(url)) return;
  const relative = normalizeAsset(url);
  assert.ok(relative && !relative.startsWith("../"),
    source + " must use an app-local asset path: " + url);
  assert.ok(fs.existsSync(path.join(publicDir, relative)),
    source + " references a missing public asset: " + url);
  assert.ok(shellSet.has(url),
    source + " asset must be precached with the exact version: " + url);
}

for (const item of scriptTags) assertLocalAsset(item.url, "page script");
for (const item of stylesheetTags) assertLocalAsset(item.url, "page stylesheet");
for (const url of appShell) {
  const relative = normalizeAsset(url);
  assert.ok(relative, "APP_SHELL cannot contain an empty path");
  assert.ok(fs.existsSync(path.join(publicDir, relative)),
    "APP_SHELL references a missing public file: " + url);
  assert.ok(!url.includes(".."), "APP_SHELL must not escape the app scope: " + url);
}

// The state bus must initialize before world/career UI code; source roster data must initialize before DB.
const scriptIndex = url => scriptTags.findIndex(item => normalizeAsset(item.url) === normalizeAsset(url));
const requireBefore = (first, second, reason) => {
  const a = scriptIndex(first), b = scriptIndex(second);
  assert.ok(a >= 0 && b >= 0 && a < b, reason);
};
requireBefore("./career-state-store.js?v=8", "./football-world-ai.js?v=85",
  "the shared state bus must load before the world engine");
requireBefore("./football-world-rosters.js?v=6", "./football-world-db.js?v=11",
  "sourced rosters must load before the world database");
requireBefore("./football-world-db.js?v=11", "./transfer-awards-engine.js?v=27",
  "the world database must load before transfer/award integration");
requireBefore("./transfer-awards-engine.js?v=27", "./story-mode.js?v=14",
  "the award engine and inline career/match engines must load before feature modules");

const workerSource = read("football-world-worker.js");
const importsMatch = workerSource.match(/importScripts\(([\s\S]*?)\)\s*;/);
assert.ok(importsMatch, "world worker must declare its explicit module imports");
const workerImports = JSON.parse("[" + importsMatch[1] + "]");
assert.ok(workerImports.length >= 4, "world worker must load the state, roster, database and AI modules");
for (const url of workerImports) {
  assert.ok(shellSet.has(url), "worker dependency must be precached with its exact version: " + url);
  assert.ok(fs.existsSync(path.join(publicDir, normalizeAsset(url))),
    "worker dependency must exist in public: " + url);
  const pageReference = scriptTags.find(item => normalizeAsset(item.url) === normalizeAsset(url));
  const shellReference = shellByPath.get(normalizeAsset(url));
  if (pageReference) assert.equal(pageReference.url, url,
    "page and worker must use the same version for shared dependency: " + url);
  if (shellReference) assert.equal(shellReference, url,
    "service worker and worker must use the same version for shared dependency: " + url);
}
const workerUrlMatch = read("football-world-ai.js").match(/new\s+global\.Worker\(["']([^"']+)["']\)/);
assert.ok(workerUrlMatch, "world AI must declare the worker URL used by the runtime");
assert.ok(shellSet.has(workerUrlMatch[1]),
  "the exact worker URL requested by world AI must be precached");
assert.equal(
  workerUrlMatch[1],
  shellByPath.get(normalizeAsset(workerUrlMatch[1])),
  "world AI and service worker must agree on the worker version"
);

console.log("PASS: pre-build integration contract — checked-in mirrors, canonical engines/data, page dependencies, worker imports and offline cache are connected.");
