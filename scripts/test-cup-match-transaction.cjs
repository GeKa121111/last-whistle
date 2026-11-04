"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const publicHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
assert.equal(html, publicHtml, "root and public app shells must stay synchronized");

function extractFunction(source, name) {
  const start = source.indexOf("function " + name + "(");
  assert.notEqual(start, -1, "missing function " + name);
  const open = source.indexOf("{", start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    const next = source[i + 1];
    if (lineComment) {
      if (c === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (c === "*" && next === "/") { blockComment = false; i++; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === "\\") { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "/" && next === "/") { lineComment = true; i++; continue; }
    if (c === "/" && next === "*") { blockComment = true; i++; continue; }
    if (c === "'" || c === '"' || c === "`") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error("unterminated function " + name);
}

const clone = extractFunction(html, "cloneSeasonTransitionState");
const restore = extractFunction(html, "restoreSeasonTransitionState");
const persistRollback = extractFunction(html, "persistRollbackSnapshot");
const unsafe = extractFunction(html, "playCupMatchUnsafe");
const wrapper = extractFunction(html, "playCupMatch");

const cupHistoryLookup = extractFunction(html, "cupHistoryForCompetition");
const competitionRenderer = extractFunction(html, "renderCurrentCompetitions");
assert.match(competitionRenderer, /const history=cupHistoryForCompetition\(comp\);/,
  "competition cards must use the club-and-country-aware cup history lookup");
const cupHistoryLookupSandbox = {
  state: { season: 5, clubName: "United FC", leagueCountry: "England", cupHistory: [] }
};
vm.createContext(cupHistoryLookupSandbox);
vm.runInContext(cupHistoryLookup + "\nglobalThis.findCupHistoryForTest = cupHistoryForCompetition;",
  cupHistoryLookupSandbox, { filename: "cup-history-country-identity.js" });
cupHistoryLookupSandbox.state.cupHistory = [
  { name: "National Cup", season: 5, club: "United FC", country: "Scotland", champion: true },
  { name: "National Cup", season: 5, club: "United FC", country: "England", eliminated: true }
];
assert.equal(cupHistoryLookupSandbox.findCupHistoryForTest({ name: "National Cup" }).country, "England",
  "a same-named club in another country must not supply this club's cup outcome");
cupHistoryLookupSandbox.state.cupHistory = [
  { name: "National Cup", season: 5, club: "United FC", country: "Scotland", champion: true }
];
assert.equal(cupHistoryLookupSandbox.findCupHistoryForTest({ name: "National Cup" }), undefined,
  "a foreign club's cup win must not appear in the current club's competition list");
const unidentifiedLegacyClubHistory = [
  { name: "National Cup", season: 5, club: "United FC", eliminated: true }
];
cupHistoryLookupSandbox.state.cupHistory = unidentifiedLegacyClubHistory;
assert.equal(cupHistoryLookupSandbox.findCupHistoryForTest({ name: "National Cup" }), undefined,
  "legacy cup rows without country metadata must not be attributed to the current club");
assert.deepEqual(cupHistoryLookupSandbox.state.cupHistory, unidentifiedLegacyClubHistory,
  "unidentified legacy cup history must remain saved and unchanged");
cupHistoryLookupSandbox.state.cupHistory = [
  { name: "National Cup", season: 5, country: "England", champion: true }
];
assert.equal(cupHistoryLookupSandbox.findCupHistoryForTest({ name: "National Cup" }), undefined,
  "legacy cup rows without club identity must not be attributed to the current club");
cupHistoryLookupSandbox.state.cupHistory = [
  { name: "National Cup", season: 5, champion: true }
];
assert.equal(cupHistoryLookupSandbox.findCupHistoryForTest({ name: "National Cup" }), undefined,
  "legacy cup rows without either identity field must not be treated as a club trophy");

const competitionRendererSandbox = {
  state: {
    season: 6, seasonFinished: false, league: [], leagueCompetition: "Test League",
    leagueCountry: "England", leagueDivision: 1, clubName: "United FC", cupHistory: [],
    cupState: {
      name: "National Cup", createdSeason: 5, champion: false,
      eliminated: true, abandoned: true
    }
  },
  currentCompetitionsBox: { innerHTML: "" },
  $: id => id === "currentCompetitions" ? competitionRendererSandbox.currentCompetitionsBox : null,
  clubNameForLeague: () => "United FC",
  competitionsForCurrentClub: () => [{ name: "National Cup", kind: "cup" }],
  competitionLockReason: () => "",
  club: () => ({ name: "United FC" }),
  setText: () => {},
  safeHTML: value => String(value)
};
vm.createContext(competitionRendererSandbox);
vm.runInContext(cupHistoryLookup + "\n" + competitionRenderer +
  "\nglobalThis.renderCompetitionsForTest = renderCurrentCompetitions;",
  competitionRendererSandbox, { filename: "season-scoped-cup-status.js" });
competitionRendererSandbox.renderCompetitionsForTest();
assert.match(competitionRendererSandbox.currentCompetitionsBox.innerHTML, /مجدولة/,
  "an abandoned cup from a previous season must not mark the current season's same-named competition as closed");
assert.doesNotMatch(competitionRendererSandbox.currentCompetitionsBox.innerHTML, /أُغلقت البطولة دون اكتمالها/,
  "stale previous-season cup state must not leak into the current competition status");
competitionRendererSandbox.state.cupState.createdSeason = 6;
competitionRendererSandbox.renderCompetitionsForTest();
assert.match(competitionRendererSandbox.currentCompetitionsBox.innerHTML, /أُغلقت البطولة دون اكتمالها/,
  "an abandoned cup from the current season must still be shown as closed");
competitionRendererSandbox.state.cupState.createdSeason = 5;
competitionRendererSandbox.state.cupHistory = [
  { name: "National Cup", season: 6, club: "United FC", champion: true }
];
competitionRendererSandbox.renderCompetitionsForTest();
assert.match(competitionRendererSandbox.currentCompetitionsBox.innerHTML, /سجل قديم غير محدد النادي أو الدولة/,
  "unidentified legacy trophy rows must be shown as unknown rather than assigned to the current club");
assert.doesNotMatch(competitionRendererSandbox.currentCompetitionsBox.innerHTML, /بطل البطولة|انتهى المشوار/,
  "unidentified legacy rows must not fabricate a current club's cup outcome");
competitionRendererSandbox.state.cupHistory[0].country = "England";
competitionRendererSandbox.renderCompetitionsForTest();
assert.match(competitionRendererSandbox.currentCompetitionsBox.innerHTML, /بطل البطولة/,
  "a history row with matching club, country and season must still show the correct club trophy");
competitionRendererSandbox.state.cupHistory[0].country = "Scotland";
competitionRendererSandbox.renderCompetitionsForTest();
assert.match(competitionRendererSandbox.currentCompetitionsBox.innerHTML, /مجدولة/,
  "a same-name result from a different country must not affect the current club");

const activeCupRenderer = extractFunction(html, "renderActiveCup");
const activeCupBox = { innerHTML: "" };
const activeCupSandbox = {
  state: {
    season: 6, calendarEvents: [],
    cupState: {
      name: "National Cup", createdSeason: 5, champion: false,
      eliminated: false, abandoned: true, phase: "knockout",
      rounds: ["Final"], stage: 0, history: [], points: 0, gf: 0, gd: 0
    }
  },
  activeCupBox,
  $: id => id === "cupActive" ? activeCupBox : null,
  calendarDateLabel: () => "2026-11-04"
};
vm.createContext(activeCupSandbox);
vm.runInContext(activeCupRenderer + "\nglobalThis.renderActiveCupForTest = renderActiveCup;",
  activeCupSandbox, { filename: "season-scoped-active-cup-panel.js" });
activeCupSandbox.renderActiveCupForTest();
assert.match(activeCupBox.innerHTML, /لا توجد بطولة نشطة في الموسم الحالي/,
  "the active-cup panel must not present a previous-season cup as the current cup");
assert.doesNotMatch(activeCupBox.innerHTML, /بطولتك الحالية|data-play-cup/,
  "a stale previous-season cup must not expose current-cup details or a match action");
activeCupSandbox.state.cupState.createdSeason = 6;
activeCupSandbox.renderActiveCupForTest();
assert.match(activeCupBox.innerHTML, /بطولتك الحالية/,
  "a current-season cup must remain visible in the active-cup panel");
assert.match(activeCupBox.innerHTML, /أُغلقت البطولة دون اكتمالها/,
  "a current-season abandoned cup must retain its closed status");
activeCupSandbox.state.cupState.abandoned = false;
activeCupSandbox.renderActiveCupForTest();
assert.match(activeCupBox.innerHTML, /data-play-cup/,
  "a current-season active cup must retain its playable match action");

const closeCupFunction = extractFunction(html, "closeUnfinishedCupAtSeasonEnd");
function runSeasonEndCupClosure(existingHistory) {
  const sandbox = {
    state: {
      season: 5, clubName: "United FC", leagueCountry: "England", leagueDivision: 1,
      cupHistory: existingHistory,
      cupState: {
        name: "National Cup", createdSeason: 5, champion: false,
        eliminated: false, abandoned: false, matchesPlayed: 4, history: []
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(closeCupFunction + "\nglobalThis.closeCupForTest = closeUnfinishedCupAtSeasonEnd;",
    sandbox, { filename: "season-end-cup-history-identity.js" });
  assert.equal(sandbox.closeCupForTest(), true);
  return sandbox.state.cupHistory;
}
const foreignSeasonEndCup = runSeasonEndCupClosure([
  { name: "National Cup", season: 5, club: "United FC", country: "Scotland", champion: true }
]);
assert.equal(foreignSeasonEndCup.length, 2,
  "a same-named cup record from another country must not suppress the current club's season-end record");
assert.equal(foreignSeasonEndCup[0].club, "United FC");
assert.equal(foreignSeasonEndCup[0].country, "England");
assert.equal(foreignSeasonEndCup[0].division, 1);
const sameSeasonEndCup = runSeasonEndCupClosure([
  { name: "National Cup", season: 5, club: "United FC", country: "England", eliminated: true }
]);
assert.equal(sameSeasonEndCup.length, 1,
  "season-end cup closure must remain idempotent for the same club and country");
const legacySeasonEndCup = runSeasonEndCupClosure([
  { name: "National Cup", season: 5, eliminated: true }
]);
assert.equal(legacySeasonEndCup.length, 2,
  "an unidentified legacy row must not be treated as proof that this club's cup was archived");


assert.match(wrapper, /cloneSeasonTransitionState\(state\)/,
  "cup settlement must snapshot the complete career before it starts");
assert.match(wrapper, /restoreSeasonTransitionState\(snapshot\)/,
  "cup settlement must restore the career after a failed or partial operation");
assert.match(unsafe, /if\(!settled\)[\s\S]*?return false;/,
  "a rejected match result must signal the outer cup transaction to roll back");
assert.ok(unsafe.indexOf("const settled=applyMatchResult") < unsafe.indexOf("c.leagueOpponents.push(opponent)"),
  "league-stage opponent history must only be committed after match settlement");
assert.ok(unsafe.indexOf("const settled=applyMatchResult") < unsafe.indexOf("used[opponent]=(Number(used[opponent])||0)+1"),
  "group opponent counts must only be committed after match settlement");

function makeHarness(options = {}) {
  const phase = options.phase || "knockout";
  const state = {
    retired: false, academyReserve: false, season: 1, playedToday: false, trainedToday: false,
    lastTactic: "balanced", suspensions: {}, leagueCountry: "England", leagueDivision: 1,
    calendarDay: 1, day: 1, trophies: 0, money: 100, followers: 10, cupHistory: [],
    apps: 0, careerMatchHistory: [], storyText: "before",
    cupState: {
      name: "Test Cup", createdSeason: 1, champion: false, eliminated: false, abandoned: false,
      phase, system: phase === "groups" ? "caf" : phase, teams: ["Test FC", "Opponent FC"],
      opponent: "Opponent FC", stage: 0, rounds: ["Final"], twoLegs: [], matchesPlayed: 0,
      gf: 0, gd: 0, history: [], leagueOpponents: [], groupOpponents: {},
      phasePlayed: 0, phaseGames: 1, points: 0, playerGroup: 0,
      groups: [["Test FC", "Opponent FC"]],
      standings: [
        { name: "Test FC", played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 },
        { name: "Opponent FC", played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }
      ]
    }
  };
  const events = { saves: 0, renders: 0, modals: 0, toasts: 0 };
  const result = {
    player: { minutes: 90, goals: 1, assists: 0, rating: 8 },
    score: { for: 2, against: 1 }, outcome: "فوز", tactic: "balanced",
    home: true, events: [], extraTime: { played: false }, shootout: { used: false },
    opponentName: "Opponent FC"
  };
  const sandbox = {
    state, events, console: { error: () => {}, warn: () => {} },
    CUP_COMPETITIONS: [{ name: "Test Cup", system: phase === "groups" ? "caf" : phase }],
    isYouthAcademyPlayer: () => false,
    toast: () => { events.toasts++; },
    checkAction: () => true,
    clubNameForLeague: () => "Test FC",
    rand: () => 0,
    club: () => ({ name: "Test FC" }),
    clubPowerFor: () => 60,
    buildMatchId: () => "cup|test|1",
    disciplineKey: () => "cup|England|Test Cup",
    simulateCareerMatch: () => result,
    applyMatchResult: (_result, meta) => {
      state.apps++;
      state.playedToday = true;
      state.careerMatchHistory.unshift({ id: meta.id, scope: "cup" });
      if (options.failSettlement) return false;
      return { record: { id: meta.id }, matchPay: 0, participated: true };
    },
    cupLegResultSummary: () => {
      if (options.failSummary) throw new Error("synthetic post-settlement cup failure");
      return { legText: "", aggregateText: "" };
    },
    setStory: (_title, body) => { state.storyText = body; },
    recordTrophy: () => {},
    nextAvailableMatchDay: day => day,
    advanceCalendarDays: days => { state.calendarDay += days; },
    log: () => {},
    saveGame: () => { events.saves++; },
    flushQueuedSave: () => Promise.resolve(true),
    render: () => { events.renders++; },
    openModal: () => { events.modals++; },
    currencyLabel: () => "£",
    calendarEvent: () => {},
    structuredCloneSafe: value => JSON.parse(JSON.stringify(value))
  };
  vm.createContext(sandbox);
  vm.runInContext([
    clone, restore, persistRollback, unsafe, wrapper,
    "globalThis.runCupMatch = playCupMatch;"
  ].join("\n"), sandbox, { filename: "cup-match-transaction-harness.js" });
  return { sandbox, state, events };
}

for (const phase of ["league", "groups"]) {
  const harness = makeHarness({ phase, failSettlement: true });
  const before = JSON.stringify(harness.state);
  assert.equal(harness.sandbox.runCupMatch(), false,
    phase + " cup match must report a failed settlement");
  assert.equal(JSON.stringify(harness.state), before,
    phase + " cup opponent scheduling and career data must roll back after settlement failure");
  assert.equal(harness.events.saves, 1, "rolled-back cup state must be queued for persistence");
  assert.equal(harness.events.renders, 1, "rolled-back cup state must be rendered");
}

{
  const harness = makeHarness({ phase: "knockout", failSummary: true });
  const before = JSON.stringify(harness.state);
  assert.equal(harness.sandbox.runCupMatch(), false,
    "a failure after match statistics were settled must reject the cup transaction");
  assert.equal(JSON.stringify(harness.state), before,
    "post-settlement cup failures must restore player stats, trophy state and cup progress");
}

{
  const harness = makeHarness({ phase: "league" });
  assert.equal(harness.sandbox.runCupMatch(), true, "a valid cup match must commit");
  assert.equal(harness.state.cupState.matchesPlayed, 1, "successful cup matches must advance once");
  assert.equal(JSON.stringify(harness.state.cupState.leagueOpponents), JSON.stringify(["Opponent FC"]),
    "successful league-stage matches must record the opponent exactly once");
  assert.equal(harness.state.cupState.phase, "knockout", "the completed league phase must advance normally");
  assert.equal(harness.state.apps, 1, "successful match statistics must be retained");
  assert.equal(harness.state.calendarDay, 4, "successful cup settlement must advance the calendar normally");
}

const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const publicSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
assert.equal(sw, publicSw, "root and public service workers must stay synchronized");
require("./assert-static-cache-version.cjs")(sw, 468);

console.log("PASS: cup matches commit atomically; failed settlement and post-settlement errors restore the full career.");
