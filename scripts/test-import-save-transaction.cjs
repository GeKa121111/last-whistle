"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, "missing " + signature);
  const open = source.indexOf("{", start);
  assert.ok(open > start, "missing function body for " + signature);
  let depth = 0, quote = "", escaped = false, lineComment = false, blockComment = false;
  for (let i = open; i < source.length; i++) {
    const ch = source[i], next = source[i + 1];
    if (lineComment) { if (ch === "\n") lineComment = false; continue; }
    if (blockComment) { if (ch === "*" && next === "/") { blockComment = false; i++; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "/" && next === "/") { lineComment = true; i++; continue; }
    if (ch === "/" && next === "*") { blockComment = true; i++; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth++;
    if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error("Unclosed function body: " + signature);
}

const importSource = extractFunction(html, "async function importSaveFile(file)");
const STORAGE_KEY = "lastWhistleCareer_v4";
const listKeys = [
  "achievements","diary","seasonLog","careerMatchHistory","seasonHistory","leagueArchives",
  "recordedMatchIds","transferHistory","fixtureSchedule","calendarEvents","cupHistory",
  "internationalHistory","promotionHistory","careerAwards","transferOffers","currentCompetitions",
  "trophyCabinet","awardCeremonies"
];
const INITIAL = {
  name: "Previous Career", age: 24, season: 2, day: 1, calendarDay: 1, money: 500,
  league: [], cupState: null, transferNegotiation: null, physical: 55, contractType: "professional",
  ...Object.fromEntries(listKeys.map(key => [key, []]))
};

function createHarness({ previousRaw = null, failLoad = false } = {}) {
  const originalState = { ...INITIAL, name: "Current In-Memory Career", money: 777 };
  const storage = new Map(previousRaw === null ? [] : [[STORAGE_KEY, previousRaw]]);
  const published = [];
  const calls = { saves: 0, saveGame: 0, renders: 0, toasts: [] };
  const shared = {
    current: originalState,
    publish(value, meta) { this.current = value; published.push({ value, source: meta && meta.source }); },
    save() { calls.saves++; return Promise.resolve(); },
    getState() { return this.current; }
  };
  const sandbox = {
    state: originalState,
    INITIAL,
    STORAGE_KEY,
    structuredCloneSafe(value) { return JSON.parse(JSON.stringify(value)); },
    legacyPhysicalFallback() { return 55; },
    normalizeSavedBooleanFlag(value) { return value === true || value === 1 || ["true","1","yes","on"].includes(String(value).toLowerCase()); },
    validateBackupValue(value) { return value; },
    encodeStoredSave(value) { return JSON.stringify(value); },
    decodeStoredSave(value) { return value; },
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, value); },
      removeItem(key) { storage.delete(key); }
    },
    window: {
      confirm() { return true; },
      LWStateStore: shared,
      LWCareer: {
        ensureState() {},
        rebuildLegacyCareerStats() {},
        deriveLeagueRatingStats() {}
      }
    },
    loadGame() {
      if (failLoad) { sandbox.state = { ...INITIAL, name: "Partially Imported" }; return false; }
      const raw = storage.get(STORAGE_KEY);
      if (!raw) return false;
      sandbox.state = { ...INITIAL, ...JSON.parse(raw) };
      return true;
    },
    saveGame(silent) { calls.saveGame++; assert.equal(silent, true); return true; },
    render() { calls.renders++; },
    showPage() {},
    closeDrawer() {},
    toast(message) { calls.toasts.push(String(message)); },
    console
  };
  vm.createContext(sandbox);
  new vm.Script(importSource + "\nglobalThis.runImport = importSaveFile;", { filename: "importSaveFile" }).runInContext(sandbox);
  return { sandbox, originalState, storage, published, calls, shared };
}

(async function main() {
  const importedCareer = {
    name: "Imported Career", age: 26, season: 5, day: 30, calendarDay: 30,
    money: 2500, league: [], cupState: null, transferNegotiation: null,
    careerStarted: true, schemaVersion: 10
  };
  const file = { size: 200, async text() {
    return JSON.stringify({ game: "LAST WHISTLE", version: 6, career: importedCareer });
  } };

  const success = createHarness();
  await success.sandbox.runImport(file);
  assert.equal(success.sandbox.state.name, "Imported Career");
  assert.equal(success.shared.current, success.sandbox.state,
    "successful import must publish the exact live state object loaded by the game");
  assert.equal(success.published.at(-1).source, "import");
  assert.equal(success.calls.saves, 0,
    "import must not start an unawaited IndexedDB write before loadGame validates the replacement");
  assert.equal(success.calls.saveGame, 1, "successful import must enter the normal queued persistence pipeline");
  assert.ok(success.storage.has(STORAGE_KEY), "the validated import must have a fallback copy before queued persistence");
  assert.ok(success.calls.toasts.some(message => message.includes("بنجاح")));

  const failedEmptyStorage = createHarness({ failLoad: true });
  const previousRef = failedEmptyStorage.originalState;
  await failedEmptyStorage.sandbox.runImport(file);
  assert.equal(failedEmptyStorage.sandbox.state, previousRef,
    "failed import with no previous localStorage key must restore the previous in-memory career object");
  assert.equal(failedEmptyStorage.shared.current, previousRef,
    "failed import must republish the restored career to every state-store subscriber");
  assert.equal(failedEmptyStorage.storage.has(STORAGE_KEY), false,
    "failed import must remove the rejected temporary fallback when no previous key existed");
  assert.equal(failedEmptyStorage.calls.saves, 0,
    "failed imports must never start an IndexedDB write");
  assert.equal(failedEmptyStorage.calls.saveGame, 0);

  const previousRaw = JSON.stringify({ ...INITIAL, name: "Persisted Prior Career", money: 900 });
  const failedExistingStorage = createHarness({ previousRaw, failLoad: true });
  await failedExistingStorage.sandbox.runImport(file);
  assert.equal(failedExistingStorage.sandbox.state, failedExistingStorage.originalState);
  assert.equal(failedExistingStorage.shared.current, failedExistingStorage.originalState);
  assert.equal(failedExistingStorage.storage.get(STORAGE_KEY), previousRaw,
    "failed imports must preserve the exact previous local fallback bytes");
  assert.equal(failedExistingStorage.calls.saves, 0);
  assert.equal(failedExistingStorage.calls.saveGame, 0);

  console.log("PASS: save import commits only after loading succeeds and restores the prior live state, store binding, and fallback on failure.");
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
