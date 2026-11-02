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
    if (lineComment) { if (c.charCodeAt(0) === 10) lineComment = false; continue; }
    if (blockComment) { if (c === "*" && n === "/") { blockComment = false; i++; } continue; }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c.charCodeAt(0) === 92) { escaped = true; continue; }
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

const transactionSource = [
  extractFunction(html, "cloneSeasonTransitionState"),
  extractFunction(html, "restoreSeasonTransitionState"),
  extractFunction(html, "simulateSeasonBlock")
].join("\n");

function makeSandbox(failRecovery) {
  const initial = {
    retired: false, seasonFinished: false, seasonApps: 0, leagueApps: 0,
    leagueRoundIndex: 0, fixtureSchedule: [[["Test FC", "Opponent FC"]]],
    league: [{ name: "Test FC", points: 0, played: 0 }, { name: "Opponent FC", points: 0, played: 0 }],
    leagueCompetition: "Premier League", leagueCountry: "England",
    calendarDay: 10, lastLeagueMatchCalendarDay: 10, trainedToday: false,
    suspensions: {}, lastTactic: "balanced", recordedMatchIds: [],
    careerMatchHistory: [], seasonLog: [], leagueRoundHistory: [],
    apps: 0, goals: 0, assists: 0, totalCareerAppearances: 0,
    seasonW: 0, seasonD: 0, seasonL: 0, seasonPoints: 0,
    seasonGoals: 0, seasonAssists: 0, money: 1000, energy: 90,
    seasonPhase: "firstHalf", winterBreakPending: false, stateMarker: "before-round"
  };
  const events = { logs: [], toasts: [], saves: 0, renders: 0, modals: [], finishes: 0, rounds: 0 };
  const sandbox = {
    state: initial, events, console,
    window: { LWCareer: { leagueMatchDaysRemaining: () => 0 } },
    reconcileWinterBreakState: () => false,
    ensureLeague: () => {},
    ensureFixtureSchedule: () => {},
    ensureSeasonDevelopmentSnapshot: () => {},
    seasonMatchTotal: () => 1,
    clubNameForLeague: () => "Test FC",
    calendarHasConflict: () => false,
    buildMatchId: () => "league|segment-1|season-1|Premier League|Test FC|1",
    disciplineKey: () => "league|England|Premier League",
    simulateCareerMatch: () => ({
      score: { for: 2, against: 1 },
      player: { minutes: 90, goals: 1, assists: 0, rating: 8, injuryDays: 0 }
    }),
    applyMatchResult: (result, meta) => {
      initial.recordedMatchIds.push(meta.id);
      initial.apps++;
      initial.goals++;
      initial.totalCareerAppearances++;
      initial.money += 100;
      initial.seasonW++;
      initial.seasonPoints += 3;
      initial.careerMatchHistory.push({ id: meta.id, minutes: 90, goals: 1, assists: 0 });
      return { record: { id: meta.id }, matchPay: 100, participated: true };
    },
    updateLeague: opponent => {
      const team = initial.league.find(row => row.name === opponent);
      team.points += 3;
      team.played++;
    },
    simulateOtherFixtures: () => { initial.league[1].played++; },
    recordLeagueRound: (...args) => {
      events.rounds++;
      initial.leagueRoundHistory.push({ matchId: args[4]?.record?.id || "league-round-1" });
    },
    advanceCalendarDays: days => {
      initial.calendarDay += days;
      if (failRecovery) throw new Error("synthetic recovery calendar failure");
    },
    seasonMatchIntervalDays: () => 5,
    activateMidSeasonBreakIfDue: () => false,
    setStory: () => {},
    log: message => events.logs.push(String(message)),
    toast: message => events.toasts.push(String(message)),
    saveGame: () => { events.saves++; },
    render: () => { events.renders++; },
    openModal: (title, message) => { events.modals.push({ title, message }); },
    finishSeason: () => { events.finishes++; },
    structuredCloneSafe: value => JSON.parse(JSON.stringify(value))
  };
  vm.createContext(sandbox);
  new vm.Script(transactionSource + "\nthis.runSeasonBlock = simulateSeasonBlock;", {
    filename: "league-round-transaction.js"
  }).runInContext(sandbox);
  return { sandbox, initial, events };
}

const failed = makeSandbox(true);
failed.sandbox.runSeasonBlock(1);
assert.equal(failed.sandbox.state, failed.initial, "a failed fixture must preserve the live career-state object");
assert.deepEqual(Array.from(failed.initial.recordedMatchIds), [],
  "a failed post-match recovery must roll back the idempotency marker");
assert.equal(failed.initial.apps, 0, "a failed fixture must not retain an appearance");
assert.equal(failed.initial.goals, 0, "a failed fixture must not retain goals");
assert.equal(failed.initial.totalCareerAppearances, 0, "career appearances must roll back");
assert.equal(failed.initial.money, 1000, "match pay must roll back with the fixture");
assert.equal(failed.initial.seasonW, 0, "league result points must roll back");
assert.equal(failed.initial.seasonPoints, 0, "league points must roll back");
assert.equal(failed.initial.seasonApps, 0, "season progress must roll back");
assert.equal(failed.initial.leagueApps, 0, "league progress must roll back");
assert.equal(failed.initial.leagueRoundIndex, 0, "the round pointer must remain retryable");
assert.equal(failed.initial.league[1].points, 0, "standings changes must roll back");
assert.equal(failed.initial.league[1].played, 0, "other-fixture simulation must roll back");
assert.equal(failed.initial.leagueRoundHistory.length, 0, "the round ledger must roll back");
assert.equal(failed.initial.careerMatchHistory.length, 0, "career match history must roll back");
assert.equal(failed.initial.calendarDay, 10, "partial recovery-day advancement must roll back");
assert.equal(failed.events.rounds, 1, "the test must fail after the round ledger has been written");
assert.ok(failed.events.logs.some(message => message.includes("تمت استعادة حالة المسيرة بالكامل")),
  "the failure must be recorded after rollback");
assert.ok(failed.events.toasts.some(message => message.includes("تمت استعادة بيانات المسيرة")),
  "the player must be told the fixture was rolled back");
assert.equal(failed.events.modals.length, 1, "the game should return to a usable season summary");
assert.ok(failed.events.modals[0].message.includes("حاكت اللعبة 0 جولة"),
  "the summary must not count a rolled-back round");
assert.equal(failed.events.finishes, 0, "a rolled-back fixture must not finish the season");

const successful = makeSandbox(false);
successful.sandbox.runSeasonBlock(1);
assert.deepEqual(Array.from(successful.initial.recordedMatchIds),
  ["league|segment-1|season-1|Premier League|Test FC|1"],
  "a successful fixture must retain its unique match ID");
assert.equal(successful.initial.apps, 1, "a successful fixture must retain the player appearance");
assert.equal(successful.initial.seasonApps, 1, "a successful fixture must advance the season");
assert.equal(successful.initial.leagueRoundIndex, 1, "a successful fixture must advance the round pointer");
assert.equal(successful.initial.league[1].points, 3, "a successful fixture must retain standings changes");
assert.equal(successful.initial.leagueRoundHistory.length, 1, "a successful fixture must retain its round ledger");
assert.equal(successful.events.finishes, 1, "a completed season must still finish normally");

console.log("PASS: league fixture settlement, standings, history and recovery are atomic and retryable.");
