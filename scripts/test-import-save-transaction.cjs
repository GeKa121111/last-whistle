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
const physicalFallbackSource = extractFunction(html, "function legacyPhysicalFallback(position,skills)");
const importFallbackSource = extractFunction(html, "function encodeImportFallback(value)");
assert.match(importSource, /encodeImportFallback\(restored\)/,
  "imports must use the full-snapshot fallback encoder");
assert.doesNotMatch(importFallbackSource, /compactSnapshotForStorage/,
  "the import fallback encoder must not trim world-simulation history");
assert.match(html, /function loadGame\(options = \{\}\)\s*\{\s*const requireLocalFallback = options && options\.requireLocalFallback === true;/,
  "loadGame must support strict import-only fallback loading");
assert.match(importSource, /loadGame\(\{requireLocalFallback:true\}\)/,
  "imports must require the exact fallback written for the incoming backup");
const STORAGE_KEY = "lastWhistleCareer_v4";
const listKeys = [
  "achievements","diary","seasonLog","careerMatchHistory","seasonHistory","leagueArchives",
  "recordedMatchIds","transferHistory","fixtureSchedule","calendarEvents","cupHistory",
  "internationalHistory","promotionHistory","careerAwards","transferOffers","currentCompetitions",
  "trophyCabinet","awardCeremonies"
];
const INITIAL = {
  name: "Previous Career", age: 24, pos: "جناح", leagueDivision: 2, clubName: "مركز شباب النور",
  season: 2, day: 1, calendarDay: 1, money: 500,
  league: [], cupState: null, transferNegotiation: null, physical: 55, contractType: "professional",
  ...Object.fromEntries(listKeys.map(key => [key, []]))
};

function createHarness({ previousRaw = null, failLoad = false, corruptEncodedFallback = false, startupSave = { ...INITIAL, name: "IndexedDB Prior Career", money: 333 } } = {}) {
  const originalState = { ...INITIAL, name: "Current In-Memory Career", money: 777 };
  const storage = new Map(previousRaw === null ? [] : [[STORAGE_KEY, previousRaw]]);
  const published = [];
  const calls = { saves: 0, saveGame: 0, encodeImportFallback: 0, loadGame: [], renders: 0, toasts: [] };
  const shared = {
    current: originalState,
    publish(value, meta) { this.current = value; published.push({ value, source: meta && meta.source }); },
    save() { calls.saves++; return Promise.resolve(); },
    getState() { return this.current; },
    getStartupSave() { return startupSave; }
  };
  const sandbox = {
    state: originalState,
    INITIAL,
    STORAGE_KEY,
    structuredCloneSafe(value) { return JSON.parse(JSON.stringify(value)); },
    clamp(value, min = 0, max = 100) {
      const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
      return Math.max(min, Math.min(max, Math.round(numeric)));
    },
    normalizeSavedBooleanFlag(value) {
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return Number.isFinite(value) ? value !== 0 : false;
      if (typeof value === "string") return ["true","1","yes","on"].includes(value.trim().toLowerCase());
      return false;
    },
    validateBackupValue(value) { return value; },
    encodeStoredSave(value) { return corruptEncodedFallback ? "not-json" : JSON.stringify(value); },
    decodeStoredSave(value) { return value; },
    FALLBACK_STORAGE_PREFIX: "LWIDB1:",
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
      },
      LZString: { compressToUTF16(value) { return value; } }
    },
    loadGame(options = {}) {
      calls.loadGame.push(options);
      if (failLoad) { sandbox.state = { ...INITIAL, name: "Partially Imported" }; return false; }
      const requireLocalFallback = options && options.requireLocalFallback === true;
      let indexedSave = requireLocalFallback ? null : sandbox.window.LWStateStore.getStartupSave();
      let raw = storage.has(STORAGE_KEY) ? storage.get(STORAGE_KEY) : null;
      if (requireLocalFallback && !(typeof raw === "string" && raw.startsWith("LWIDB1:"))) return false;
      if (typeof raw === "string" && raw.startsWith("LWIDB1:")) {
        const fallbackPayload = raw.slice("LWIDB1:".length);
        try {
          const fallbackSave = JSON.parse(fallbackPayload);
          if (fallbackSave && typeof fallbackSave === "object" && !Array.isArray(fallbackSave)) {
            indexedSave = null;
            raw = fallbackPayload;
          } else {
            raw = null;
            if (requireLocalFallback) return false;
          }
        } catch (_) {
          raw = null;
          if (requireLocalFallback) return false;
        }
      }
      if (requireLocalFallback && !raw) return false;
      if (indexedSave) raw = null;
      if (!raw && !indexedSave) return false;
      const saved = indexedSave ? JSON.parse(JSON.stringify(indexedSave)) : JSON.parse(raw);
      sandbox.state = { ...INITIAL, ...saved };
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
  new vm.Script(physicalFallbackSource + "\n" + importFallbackSource + "\nglobalThis.runImportFallbackEncoder = encodeImportFallback;", { filename: "backup-import-helpers" }).runInContext(sandbox);
  const actualImportFallbackEncoder = sandbox.runImportFallbackEncoder;
  sandbox.encodeImportFallback = value => {
    calls.encodeImportFallback++;
    return corruptEncodedFallback ? "not-json" : actualImportFallbackEncoder(value);
  };
  new vm.Script(importSource + "\nglobalThis.runImport = importSaveFile;", { filename: "importSaveFile" }).runInContext(sandbox);
  return { sandbox, originalState, storage, published, calls, shared };
}

(async function main() {
  const importedCareer = {
    name: "Imported Career", age: 26, season: 5, day: 30, calendarDay: 30,
    money: 2500, league: [], cupState: null, transferNegotiation: null,
    careerStarted: true, schemaVersion: 10,
    worldSimulation: {
      clubs: { club1: { id: "club1" } },
      players: { player1: { id: "player1" } },
      leagueTables: { "1900": [{ marker: "old-season-table" }] },
      playerHistory: {
        player1: Array.from({ length: 6 }, (_, index) => ({ season: index + 1, marker: "history-" + index }))
      }
    }
  };
  const makeBackupFile = career => ({ size: 200, async text() {
    return JSON.stringify({ game: "LAST WHISTLE", version: 6, career });
  } });
  const file = makeBackupFile(importedCareer);

  const success = createHarness();
  await success.sandbox.runImport(file);
  assert.equal(success.sandbox.state.name, "Imported Career",
    "a valid import must take precedence over an older IndexedDB startup save");
  assert.equal(success.calls.loadGame[0].requireLocalFallback, true,
    "import must explicitly require the temporary fallback instead of accepting a stale startup record");
  assert.ok(String(success.storage.get(STORAGE_KEY)).startsWith("LWIDB1:"),
    "the imported fallback must carry the priority marker consumed by loadGame");
  assert.equal(success.calls.encodeImportFallback, 1,
    "import must use the dedicated full-snapshot fallback encoder");
  const importedFallback = JSON.parse(success.storage.get(STORAGE_KEY).slice("LWIDB1:".length));
  assert.equal(importedFallback.worldSimulation.playerHistory.player1.length, 6,
    "the import fallback must preserve every historical player-history row");
  assert.ok(importedFallback.worldSimulation.leagueTables["1900"],
    "the import fallback must preserve older world-simulation league tables");
  assert.equal(success.sandbox.state.worldSimulation.playerHistory.player1.length, 6,
    "the loaded career must retain all imported player-history rows");
  assert.ok(success.sandbox.state.worldSimulation.leagueTables["1900"],
    "the loaded career must retain older world-simulation league tables");

  const hostileMetadata = JSON.parse('{"toString":1,"valueOf":1}');
  const malformedMetadataCareer = {
    ...importedCareer,
    age: hostileMetadata, season: hostileMetadata, day: hostileMetadata,
    calendarDay: hostileMetadata, seasonApps: hostileMetadata, leagueApps: hostileMetadata,
    leagueSegmentIsPartial: hostileMetadata, clubName: hostileMetadata, leagueDivision: hostileMetadata,
    pos: "حارس مرمى", physical: undefined, fitness: hostileMetadata, composure: "70",
    transferHistory: [{ season: hostileMetadata, text: hostileMetadata }],
    leagueRoundIndex: hostileMetadata,
    leagueRoundHistory: [{ matchday: hostileMetadata }, { matchday: "4" }]
  };
  const malformedMetadata = createHarness();
  await malformedMetadata.sandbox.runImport(makeBackupFile(malformedMetadataCareer));
  assert.equal(malformedMetadata.sandbox.state.name, "Imported Career",
    "malformed optional metadata must not reject an otherwise valid career backup");
  assert.equal(malformedMetadata.sandbox.state.age, 18);
  assert.equal(malformedMetadata.sandbox.state.season, INITIAL.season,
    "a malformed season must fall back to the existing initial-season value");
  assert.equal(malformedMetadata.sandbox.state.day, 1);
  assert.equal(malformedMetadata.sandbox.state.calendarDay, 1);
  assert.equal(malformedMetadata.sandbox.state.seasonApps, 0);
  assert.equal(malformedMetadata.sandbox.state.leagueApps, 0);
  assert.equal(malformedMetadata.sandbox.state.leagueRoundIndex, 4);
  assert.equal(malformedMetadata.sandbox.state.leagueSegmentIsPartial, false);
  assert.equal(malformedMetadata.sandbox.state.clubName, INITIAL.clubName);
  assert.equal(malformedMetadata.sandbox.state.contractType, "youth-amateur");
  assert.equal(malformedMetadata.sandbox.state.physical, 55);
  assert.equal(typeof malformedMetadata.sandbox.state.transferHistory[0].text, "object",
    "metadata normalization must not delete the original transfer-history row");
  assert.equal(malformedMetadata.calls.saveGame, 1);
  assert.ok(malformedMetadata.calls.toasts.some(message => message.includes("بنجاح")));

  const numericMetadataCareer = {
    ...importedCareer,
    age: "21", season: "5", day: "12", calendarDay: "30",
    leagueDivision: "1", seasonApps: "8", leagueApps: "0",
    leagueSegmentIsPartial: "false", clubName: "Club A",
    transferHistory: [{ season: "5", text: "Transferred from Club A" }],
    leagueRoundIndex: "6", leagueRoundHistory: [{ matchday: "7" }],
    pos: "مهاجم", physical: "63"
  };
  const numericMetadata = createHarness();
  await numericMetadata.sandbox.runImport(makeBackupFile(numericMetadataCareer));
  assert.equal(numericMetadata.sandbox.state.season, 5);
  assert.equal(numericMetadata.sandbox.state.day, 12);
  assert.equal(numericMetadata.sandbox.state.calendarDay, 30);
  assert.equal(numericMetadata.sandbox.state.seasonApps, 8);
  assert.equal(numericMetadata.sandbox.state.leagueApps, 8);
  assert.equal(numericMetadata.sandbox.state.leagueRoundIndex, 6);
  assert.equal(numericMetadata.sandbox.state.leagueSegmentIsPartial, true);
  assert.equal(numericMetadata.sandbox.state.clubName, "Club A",
    "valid legacy club names must remain unchanged");
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

  const corruptPreviousRaw = JSON.stringify({ ...INITIAL, name: "Persisted Prior Career", money: 900 });
  const failedCorruptFallback = createHarness({
    previousRaw: corruptPreviousRaw,
    corruptEncodedFallback: true,
    startupSave: { ...INITIAL, name: "Stale IndexedDB Career", money: 333 }
  });
  await failedCorruptFallback.sandbox.runImport(file);
  assert.equal(failedCorruptFallback.sandbox.state, failedCorruptFallback.originalState,
    "a corrupt import fallback must not silently load the older IndexedDB career");
  assert.equal(failedCorruptFallback.shared.current, failedCorruptFallback.originalState,
    "a rejected fallback must republish the exact previous in-memory career");
  assert.equal(failedCorruptFallback.storage.get(STORAGE_KEY), corruptPreviousRaw,
    "a rejected fallback must restore the exact prior local backup bytes");
  assert.equal(failedCorruptFallback.calls.saveGame, 0,
    "a corrupt fallback must never enter the persistence queue");
  assert.ok(failedCorruptFallback.calls.toasts.some(message => message.includes("تعذرت الاستعادة")),
    "a corrupt fallback must report a failed import instead of a false success");

  console.log("PASS: save import requires its own validated fallback and restores the previous career when fallback decoding fails.");
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
