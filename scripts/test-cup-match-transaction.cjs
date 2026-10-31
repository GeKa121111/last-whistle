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
const unsafe = extractFunction(html, "playCupMatchUnsafe");
const wrapper = extractFunction(html, "playCupMatch");
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
    render: () => { events.renders++; },
    openModal: () => { events.modals++; },
    currencyLabel: () => "£",
    calendarEvent: () => {},
    structuredCloneSafe: value => JSON.parse(JSON.stringify(value))
  };
  vm.createContext(sandbox);
  vm.runInContext([
    clone, restore, unsafe, wrapper,
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
require("./assert-static-cache-version.cjs")(sw, 313);

console.log("PASS: cup matches commit atomically; failed settlement and post-settlement errors restore the full career.");
