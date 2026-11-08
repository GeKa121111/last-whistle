"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const rootHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const publicHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
assert.equal(rootHtml, publicHtml, "root and public application shells must remain byte-identical");

const start = rootHtml.indexOf("function loadGame(options = {}){");
const end = rootHtml.indexOf("\nfunction ensureLeagueSegmentId(){", start);
assert.ok(start >= 0 && end > start, "the deployed loadGame function must exist");
const loadSource = rootHtml.slice(start, end) + "\nglobalThis.__loadLegacyCareer = loadGame;";

const INITIAL = {
  name: "Initial Player", age: 18, pos: "جناح", leagueDivision: 2, clubName: "مركز شباب النور",
  clubIndex: 0, season: 1, day: 1, calendarDay: 1, physical: 55, contractType: "professional",
  freeAgent: false, schemaVersion: 10, league: [], fixtureSchedule: [], seasonApps: 0,
  leagueApps: 0, leagueRoundHistory: [], careerMatchHistory: [], transferHistory: [],
  professionalism: 50, mediaReputation: 50, teamChemistry: 50, coachRelationship: 50,
  currentReleaseClause: 0, goalBonusPerGoal: 0, cleanSheetBonus: 0,
  nationalTournamentFormat: 2, nationalTournamentMatches: 0, randomSeed: 1831565813,
  leagueArchiveSequence: 0, seasonAppsTarget: 0
};

function createHarness(saved) {
  const calls = { rebuild: 0, derive: 0, ensure: 0, saves: 0, warnings: [] };
  const raw = JSON.stringify(saved);
  const storage = new Map([["lastWhistleCareer_v4", raw]]);
  const sandbox = {
    INITIAL,
    STORAGE_KEY: "lastWhistleCareer_v4",
    FALLBACK_STORAGE_PREFIX: "LWIDB1:",
    LEGACY_STORAGE_KEYS: ["lastWhistleCareer_v3"],
    CLUBS: [{ name: "مركز شباب النور", ov: 40 }],
    state: null,
    window: {
      LWStateStore: { getStartupSave: () => null },
      LWCareer: {
        rebuildLegacyCareerStats() { calls.rebuild++; },
        deriveLeagueRatingStats() { calls.derive++; },
        ensureState() { calls.ensure++; },
        normalizeLeagueRoundIndex(index, history, apps, roundCount) {
          const safeIndex = typeof index === "number" && Number.isFinite(index) ? Math.floor(index) : 0;
          const historyRound = history.reduce((maximum, row) =>
            Math.max(maximum, typeof row.matchday === "number" && Number.isFinite(row.matchday) ? Math.floor(row.matchday) : 0), 0);
          return Math.min(Math.max(safeIndex, historyRound, apps), roundCount);
        },
        leagueMatchTarget: () => 10
      },
      LWCatalog: { clubsForCountry: () => ({ competition: "اختبار الدوري" }) }
    },
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, value); },
      removeItem(key) { storage.delete(key); }
    },
    structuredCloneSafe(value) { return JSON.parse(JSON.stringify(value)); },
    decodeStoredSave(value) { return value; },
    legacyPhysicalFallback() { return 55; },
    clamp(value, min = 0, max = 100) {
      const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
      return Math.max(min, Math.min(max, Math.round(numeric)));
    },
    normalizeSavedBooleanFlag(value) {
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return Number.isFinite(value) && value !== 0;
      if (typeof value === "string") return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
      return false;
    },
    normalizeNationalTournamentCounter(value, maximum) {
      const numeric = typeof value === "number" ? value
        : typeof value === "string" && value.trim() ? Number(value) : NaN;
      return Number.isFinite(numeric) ? Math.max(0, Math.min(maximum, Math.floor(numeric))) : 0;
    },
    normalizeSavedCupHistoryFlags(value) { return Array.isArray(value) ? value : []; },
    createLeague() { return [{ name: "مركز شباب النور", pts: 0, gf: 0, ga: 0 }]; },
    ensureLeague() {
      if (!Array.isArray(sandbox.state.league)) sandbox.state.league = sandbox.createLeague();
    },
    ensureFixtureSchedule() {
      if (!Array.isArray(sandbox.state.fixtureSchedule) || sandbox.state.fixtureSchedule.length === 0) {
        sandbox.state.fixtureSchedule = Array.from({ length: 10 }, () => []);
      }
    },
    clubNameForLeague() { return sandbox.state.clubName; },
    closeUnfinishedCupAtSeasonEnd() {},
    seasonMatchTotal() { return 10; },
    saveGame() { calls.saves++; return true; },
    toast(message) { calls.warnings.push(String(message)); },
    console: { warn(...args) { calls.warnings.push(args); } }
  };
  vm.createContext(sandbox);
  new vm.Script(loadSource, { filename: "deployed-loadGame" }).runInContext(sandbox);
  return { sandbox, calls, storage };
}

function load(saved) {
  const harness = createHarness(saved);
  const result = harness.sandbox.__loadLegacyCareer();
  assert.equal(result, true, "a recoverable legacy career must load instead of resetting to a new career");
  return { state: harness.sandbox.state, calls: harness.calls, storage: harness.storage };
}

(async () => {
  const hostile = JSON.parse('{"toString":1,"valueOf":1}');
  const malformed = load({
    ...INITIAL,
    name: "Recovered Player",
    age: hostile,
    leagueDivision: hostile,
    season: hostile,
    day: hostile,
    calendarDay: hostile,
    pos: hostile,
    clubName: hostile,
    physical: hostile,
    contractType: hostile,
    freeAgent: hostile,
    schemaVersion: hostile,
    professionalism: hostile,
    mediaReputation: hostile,
    teamChemistry: hostile,
    coachRelationship: hostile,
    transferOffersWindowId: hostile,
    transferOffersAttemptKey: hostile,
    currentReleaseClause: hostile,
    goalBonusPerGoal: hostile,
    cleanSheetBonus: hostile,
    nationalTournamentFormat: hostile,
    nationalTournamentMatches: hostile,
    randomSeed: hostile,
    leagueArchiveSequence: hostile,
    seasonApps: hostile,
    leagueApps: hostile,
    leagueSegmentIsPartial: hostile,
    leagueRoundIndex: hostile,
    lastLeagueMatchCalendarDay: hostile,
    seasonAppsTarget: hostile,
    transferHistory: [
      { season: hostile, text: hostile },
      { season: "3", text: "انتقال قديم إلى مركز شباب النور" }
    ],
    leagueRoundHistory: [{ matchday: hostile }, { matchday: "4" }],
    careerMatchHistory: [{ scope: "league", calendarDay: hostile, day: "6" }]
  });
  assert.equal(malformed.state.name, "Recovered Player");
  assert.equal(malformed.state.age, 18);
  assert.equal(malformed.state.leagueDivision, INITIAL.leagueDivision);
  assert.equal(malformed.state.season, INITIAL.season);
  assert.equal(malformed.state.day, INITIAL.day);
  assert.equal(malformed.state.calendarDay, INITIAL.calendarDay);
  assert.equal(malformed.state.pos, INITIAL.pos);
  assert.equal(malformed.state.clubName, INITIAL.clubName);
  assert.equal(malformed.state.physical, 55);
  assert.equal(malformed.state.contractType, "youth-amateur");
  assert.equal(malformed.state.seasonApps, 0);
  assert.equal(malformed.state.leagueApps, 0);
  assert.equal(malformed.state.leagueRoundIndex, 4);
  assert.equal(malformed.state.lastLeagueMatchCalendarDay, 6);
  assert.equal(malformed.state.currentReleaseClause, 0);
  assert.equal(malformed.state.goalBonusPerGoal, 0);
  assert.equal(malformed.state.cleanSheetBonus, 0);
  assert.equal(malformed.state.nationalTournamentFormat, 2);
  assert.equal(malformed.state.randomSeed, 1831565813);
  assert.equal(malformed.state.transferOffersWindowId, "");
  assert.equal(malformed.state.transferOffersAttemptKey, "");
  assert.equal(malformed.state.transferHistory.length, 2,
    "malformed transfer history must be preserved instead of being deleted during load");
  assert.equal(malformed.state.leagueRoundHistory.length, 2,
    "malformed round-history rows must remain in the original save");
  assert.equal(malformed.state.careerMatchHistory.length, 1,
    "career match history must remain untouched during metadata normalization");
  assert.equal(malformed.calls.ensure, 1);

  const malformedNestedContainers = load({
    ...INITIAL,
    agent: [],
    sponsorContract: [],
    loan: [],
    suspensions: [],
    bookings: [],
    competitionStats: [],
    cupState: {
      champion: false, eliminated: false, abandoned: false, createdSeason: 1,
      history: [], teams: [], leagueOpponents: [], groupOpponents: [], groups: [], standings: []
    }
  });
  assert.equal(malformedNestedContainers.state.agent, false,
    "an array must not be accepted as an agent record");
  assert.equal(malformedNestedContainers.state.sponsorContract, null,
    "an array must not be accepted as a sponsor contract");
  assert.equal(malformedNestedContainers.state.loan, null,
    "an array must not be accepted as a loan record");
  assert.equal(Object.keys(malformedNestedContainers.state.suspensions).length, 0,
    "an array must not be accepted as suspension metadata");
  assert.equal(Object.keys(malformedNestedContainers.state.bookings).length, 0,
    "an array must not be accepted as booking metadata");
  assert.equal(Object.keys(malformedNestedContainers.state.competitionStats).length, 0,
    "an array must not be accepted as competition statistics");
  assert.equal(Object.keys(malformedNestedContainers.state.cupState.groupOpponents).length, 0,
    "an array must not be accepted as cup group-opponent metadata");

  const validNestedContainers = load({
    ...INITIAL,
    agent: { id: "agent-legacy" },
    sponsorContract: { brand: "Legacy Sponsor" },
    loan: { parentClub: "Parent FC" },
    suspensions: { red: 1 },
    bookings: { yellow: 2 },
    competitionStats: { league: { apps: 4 } },
    cupState: {
      champion: false, eliminated: false, abandoned: false, createdSeason: 1,
      history: [], teams: [], leagueOpponents: [], groupOpponents: { groupA: ["A", "B"] },
      groups: [], standings: []
    }
  });
  assert.equal(validNestedContainers.state.agent.id, "agent-legacy");
  assert.equal(validNestedContainers.state.sponsorContract.brand, "Legacy Sponsor");
  assert.equal(validNestedContainers.state.loan.parentClub, "Parent FC");
  assert.equal(validNestedContainers.state.suspensions.red, 1);
  assert.equal(validNestedContainers.state.bookings.yellow, 2);
  assert.equal(validNestedContainers.state.competitionStats.league.apps, 4);
  assert.equal(Object.keys(validNestedContainers.state.cupState.groupOpponents).length, 1);
  assert.deepEqual(Array.from(validNestedContainers.state.cupState.groupOpponents.groupA), ["A", "B"],
    "valid nested legacy records must remain intact");

  const numericStrings = load({
    ...INITIAL,
    name: "Numeric Legacy Player",
    age: "27",
    leagueDivision: "1",
    season: "5",
    day: "12",
    calendarDay: "18",
    physical: "61",
    schemaVersion: "10",
    seasonApps: "8",
    leagueApps: "6",
    leagueRoundIndex: "4",
    currentReleaseClause: "250",
    goalBonusPerGoal: "15",
    cleanSheetBonus: "20",
    randomSeed: "123",
    freeAgent: "false",
    seasonAppsTarget: "10",
    leagueRoundHistory: [{ matchday: "4" }]
  });
  assert.equal(numericStrings.state.age, 27);
  assert.equal(numericStrings.state.leagueDivision, 1);
  assert.equal(numericStrings.state.season, 5);
  assert.equal(numericStrings.state.day, 12);
  assert.equal(numericStrings.state.calendarDay, 18);
  assert.equal(numericStrings.state.physical, 61);
  assert.equal(numericStrings.state.seasonApps, 8);
  assert.equal(numericStrings.state.leagueApps, 6);
  assert.equal(numericStrings.state.leagueRoundIndex, 6);
  assert.equal(numericStrings.state.currentReleaseClause, 250);
  assert.equal(numericStrings.state.goalBonusPerGoal, 15);
  assert.equal(numericStrings.state.cleanSheetBonus, 20);
  assert.equal(numericStrings.state.randomSeed, 123);
  assert.equal(numericStrings.state.freeAgent, false);
  assert.equal(numericStrings.state.contractType, "professional");

  console.log("PASS: legacy load normalizes hostile scalar metadata, preserves every history row, and remains compatible with numeric-string saves.");
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
