"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const publicHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
assert.equal(html, publicHtml, "root and public app shells must remain synchronized");

function extractFunction(source, name) {
  const marker = "function " + name + "(";
  const start = source.indexOf(marker);
  assert.ok(start >= 0, "missing function: " + name);
  const brace = source.indexOf("{", start);
  let depth = 0, quote = null, escaped = false, lineComment = false, blockComment = false;
  for (let i = brace; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (lineComment) { if (c === "\n") lineComment = false; continue; }
    if (blockComment) { if (c === "*" && n === "/") { blockComment = false; i++; } continue; }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === "\\") { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "/" && n === "/") { lineComment = true; i++; continue; }
    if (c === "/" && n === "*") { blockComment = true; i++; continue; }
    if (c === "'" || c === '"' || c === "`") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error("unterminated function: " + name);
}

const functionNames = [
  "cloneSeasonTransitionState", "restoreSeasonTransitionState",
  "applyLeagueResult", "updateLeague", "simulateOtherFixtures",
  "recordLeagueRound", "recordLeagueByeRound", "persistRollbackSnapshot", "withManualLeagueTransaction",
  "processManualLeagueBye", "commitManualLeagueMatch", "match"
];
const transactionSource = functionNames.map(name => extractFunction(html, name)).join("\n");

function makeHarness(options = {}) {
  const teams = [
    { name: "Test FC", power: 55, played: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0, pts: 0 },
    { name: "Opponent FC", power: 50, played: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0, pts: 0 },
    { name: "Third FC", power: 53, played: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0, pts: 0 },
    { name: "Fourth FC", power: 48, played: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0, pts: 0 }
  ];
  const normalRound = [["Test FC", "Opponent FC"], ["Third FC", "Fourth FC"]];
  const missingRound = [["Test FC", "Opponent FC"], ["Third FC", "Missing FC"]];
  const state = {
    academyGraduationPending: false, retired: false, winterBreakPending: false,
    season: 1, seasonApps: 0, leagueApps: 0, seasonFinished: false,
    playedToday: false, trainedToday: false, injuryDays: 0,
    lastLeagueMatchCalendarDay: 0, calendarDay: 10, day: 10,
    lastTactic: "balanced", leagueRoundIndex: 0, leagueSegmentId: "segment-1",
    fixtureSchedule: [options.bye ? [["Third FC", "Fourth FC"]] : options.failOtherFixture ? missingRound : (options.schedule || normalRound)],
    leagueCompetition: "Premier League", leagueCountry: "England",
    league: teams, suspensions: {}, recordedMatchIds: [], careerMatchHistory: [],
    leagueRoundHistory: [], seasonLog: [], apps: 0, goals: 0, assists: 0,
    totalCareerAppearances: 0, seasonGoals: 0, seasonAssists: 0,
    seasonW: 0, seasonD: 0, seasonL: 0, seasonPoints: 0,
    money: 1000, energy: 90, morale: 50, trust: 50, fatigue: 0,
    name: "Test Player", clubName: "Test FC"
  };
  const events = { saves: 0, renders: 0, modals: 0, toasts: [], logs: [], timers: 0 };
  const result = {
    player: { minutes: 90, goals: 1, assists: 0, rating: 8, shots: 2, injuryDays: 0 },
    score: { for: 2, against: 1 }, outcome: "فوز", tactic: "balanced",
    home: true, events: [], metadata: { opponentTactic: "balanced" }, opponentName: "Opponent FC"
  };
  const sandbox = {
    state, console,
    window: { LWCareer: { leagueMatchDaysRemaining: () => 0 } },
    reconcileWinterBreakState: () => false,
    ensureLeague: () => {},
    ensureFixtureSchedule: () => {},
    seasonMatchTotal: () => 3,
    seasonMatchIntervalDays: () => 5,
    clubNameForLeague: () => "Test FC",
    club: () => ({ name: "Test FC" }),
    calendarHasConflict: () => false,
    checkAction: () => true,
    buildMatchId: () => "league|segment-1|season-1|England|Premier League|Test FC|1",
    disciplineKey: () => "league|England|Premier League",
    simulateCareerMatch: () => JSON.parse(JSON.stringify(result)),
    applyMatchResult: (matchResult, meta) => {
      state.recordedMatchIds.push(meta.id);
      state.apps++; state.goals += matchResult.player.goals;
      state.totalCareerAppearances++; state.seasonGoals += matchResult.player.goals;
      state.seasonW++; state.seasonPoints += 3; state.money += 100;
      state.playedToday = true;
      const record = {
        id: meta.id, outcome: "فوز", minutes: 90, rating: 8,
        goals: 1, assists: 0, playerAvailable: true, stats: {}
      };
      state.careerMatchHistory.unshift(record);
      state.seasonLog.push(record);
      return { record: { id: meta.id }, matchPay: 100, participated: true };
    },
    randomUnit: () => 0.5,
    ensureLeagueSegmentId: () => {
      if (options.failRoundHistory) throw new Error("synthetic round-history failure");
      return state.leagueSegmentId;
    },
    structuredCloneSafe: value => JSON.parse(JSON.stringify(value)),
    advanceCalendarDays: days => {
      state.calendarDay += days; state.day += days;
      if (options.failCalendar) throw new Error("synthetic bye recovery failure");
    },
    activateMidSeasonBreakIfDue: () => false,
    formatMatchEvents: () => "",
    setStory: (title, body) => { state.storyTitle = title; state.storyText = body; },
    currencyLabel: () => "£",
    saveGame: () => { events.saves++; },
    flushQueuedSave: () => Promise.resolve(true),
    render: () => { events.renders++; },
    openModal: () => { events.modals++; },
    toast: message => { events.toasts.push(String(message)); },
    log: message => { events.logs.push(String(message)); },
    showPage: () => {},
    openAcademyGraduationDecision: () => {},
    finishSeason: () => {},
    skipSeasonTrainingAndFinish: () => {},
    startNewSeason: () => {},
    openWinterMarket: () => {},
    resumeManualSeason: () => {},
    setTimeout: () => { events.timers++; }
  };
  vm.createContext(sandbox);
  new vm.Script(transactionSource + "\nthis.runManualMatch = match; this.updateLeagueForTest = updateLeague;", {
    filename: "manual-match-transaction-harness.js"
  }).runInContext(sandbox);
  return { sandbox, state, events };
}

{
  const h = makeHarness();
  assert.equal(h.sandbox.runManualMatch("balanced"), true, "a valid manual league match must commit");
  assert.equal(h.state.recordedMatchIds.length, 1, "the match id must be recorded exactly once");
  assert.equal(h.state.apps, 1, "the player's appearance must be retained");
  assert.equal(h.state.seasonApps, 1, "season progress must advance exactly once");
  assert.equal(h.state.leagueRoundIndex, 1, "the manual match must advance the league round");
  assert.equal(h.state.league[0].pts, 3, "the player's club standings must be updated");
  assert.equal(h.state.league[1].played, 1, "the opponent standings must be updated");
  assert.equal(h.state.league[2].played, 1, "other fixtures in the same round must be simulated");
  assert.equal(h.state.leagueRoundHistory.length, 1, "the round ledger must be written");
  assert.equal(h.events.saves, 1, "a successful manual match must be saved once");
}

for (const options of [{ failOtherFixture: true }, { failRoundHistory: true }]) {
  const h = makeHarness(options);
  const before = JSON.stringify(h.state);
  assert.equal(h.sandbox.runManualMatch("attack"), false, "a post-settlement manual-match failure must abort");
  assert.equal(JSON.stringify(h.state), before, "player stats, standings, history, and progress must all roll back");
  assert.equal(h.events.renders, 1, "a rollback must refresh the restored career");
  assert.equal(h.events.saves, 1, "a rollback must queue the restored career for persistence");
  assert.ok(h.events.toasts.some(message => message.includes("تمت استعادة بيانات المسيرة")),
    "the player must be told that the manual match was rolled back");
}

{
  const h = makeHarness({ bye: true, failCalendar: true });
  const before = JSON.stringify(h.state);
  assert.equal(h.sandbox.runManualMatch("balanced"), false, "a failed manual bye-week update must abort");
  assert.equal(JSON.stringify(h.state), before, "bye-week standings, history, and calendar changes must roll back");
}

{
  const h = makeHarness();
  assert.throws(() => h.sandbox.updateLeagueForTest("Missing FC", 2, 1, 0),
    /exactly once|exactly two distinct club rows/,
    "a missing opponent or fixture must not silently advance a manual league match");
}

{
  const h = makeHarness({ schedule: [[["Test FC", "Opponent FC"], ["Test FC", "Third FC"]]] });
  const before = JSON.stringify(h.state);
  assert.equal(h.sandbox.runManualMatch("defend"), false,
    "a club appearing in two fixtures in one round must reject the whole manual transaction");
  assert.equal(JSON.stringify(h.state), before, "duplicate round fixtures must not leave partial results");
}

const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const publicSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
assert.equal(sw, publicSw, "root and public service workers must stay synchronized");
require("./assert-static-cache-version.cjs")(sw, 314);

console.log("PASS: manual league matches and bye rounds commit atomically; malformed fixtures cannot partially update standings or career history.");
