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
    if (c === "'" || c === '"' || c.charCodeAt(0) === 96) { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error("unterminated function: " + name);
}

const names = [
  "buildFixtureSchedule", "ensureFixtureSchedule", "ensureLeagueSegmentId",
  "applyLeagueResult", "simulateOtherFixtures", "recordLeagueByeRound",
  "completeTrailingLeagueByes"
];
const source = names.map(name => extractFunction(html, name)).join("\n")
  + "\nglobalThis.buildSchedule = buildFixtureSchedule;"
  + "\nglobalThis.finishByes = completeTrailingLeagueByes;";
const finalizer = extractFunction(html, "finishSeasonTransaction");
const helperCall = finalizer.indexOf("completeTrailingLeagueByes()");
const finishCall = finalizer.indexOf("finishSeasonInternal(");
assert.ok(helperCall >= 0 && finishCall > helperCall,
  "season finalization must settle remaining bye rounds before awards and archives");

const clubNames = ["Alpha FC", "Bravo FC", "Charlie FC", "Delta FC", "Echo FC"];
const sandbox = {
  state: {},
  seasonMatchTotal: () => 8,
  clubNameForLeague: () => sandbox.state.clubName,
  club: () => ({ name: sandbox.state.clubName }),
  randomUnit: () => 0.5,
  structuredCloneSafe: value => JSON.parse(JSON.stringify(value)),
  seasonMatchIntervalDays: () => 5,
  advanceCalendarDays: days => {
    sandbox.state.calendarDay += days;
    sandbox.state.day += days;
  }
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "odd-league-final-bye-regression.js" });

const schedule = sandbox.buildSchedule(clubNames);
const finalRound = schedule[schedule.length - 1];
const finalParticipants = new Set(finalRound.flat());
const byeClub = clubNames.find(name => !finalParticipants.has(name));
assert.ok(byeClub, "the five-club double round-robin must end with one club on a bye");

sandbox.state = {
  season: 1,
  seasonApps: 8,
  seasonAppsTarget: 8,
  leagueRoundIndex: schedule.length - 1,
  leagueCountry: "England",
  leagueCompetition: "Premier League",
  leagueSegmentId: "odd-league-segment-1",
  leagueArchiveSequence: 0,
  clubName: byeClub,
  league: clubNames.map(name => ({
    name,
    played: name === byeClub ? 8 : 7,
    gf: 10, ga: 8, w: 3, d: 2, l: 2, pts: 11, power: 55
  })),
  fixtureSchedule: schedule,
  leagueRoundHistory: [],
  calendarDay: 100,
  day: 100,
  lastLeagueMatchCalendarDay: 100,
  playedToday: true
};

const completed = sandbox.finishByes();
assert.equal(completed.processed, 1, "the final bye round must be processed exactly once");
assert.equal(completed.complete, true);
assert.equal(sandbox.state.leagueRoundIndex, schedule.length,
  "the league round pointer must reach the end of the schedule");
assert.equal(sandbox.state.calendarDay, 105,
  "a manually completed final fixture must advance to the scheduled bye matchday");
assert.equal(sandbox.state.day, 105);
assert.equal(sandbox.state.playedToday, false,
  "the final bye must leave the career ready for the next season transition");
assert.equal(sandbox.state.leagueRoundHistory.length, 1);
assert.equal(sandbox.state.leagueRoundHistory[0].outcome, "bye");
assert.equal(sandbox.state.leagueRoundHistory[0].matchday, schedule.length);
assert.equal(sandbox.state.leagueRoundHistory[0].day, 105,
  "the bye ledger must record the actual final matchday, not the previous player's matchday");
assert.ok(sandbox.state.league.every(team => team.played === 8),
  "every club must complete all eight league fixtures before the season is archived");
assert.ok(sandbox.state.leagueRoundHistory[0].standings.every(team => team.played === 8),
  "the final bye snapshot must contain the completed league table");

const settledSnapshot = JSON.stringify({
  league: sandbox.state.league,
  calendarDay: sandbox.state.calendarDay,
  day: sandbox.state.day,
  history: sandbox.state.leagueRoundHistory
});
sandbox.state.leagueRoundIndex = schedule.length - 1;
const retry = sandbox.finishByes();
assert.equal(retry.processed, 1);
assert.equal(JSON.stringify({
  league: sandbox.state.league,
  calendarDay: sandbox.state.calendarDay,
  day: sandbox.state.day,
  history: sandbox.state.leagueRoundHistory
}), settledSnapshot,
  "a saved bye row with a stale round pointer must not simulate standings or advance the calendar twice");
assert.equal(sandbox.state.leagueRoundIndex, schedule.length);

sandbox.state.leagueRoundIndex = schedule.length - 2;
const beforePrematureClose = JSON.stringify(sandbox.state);
assert.throws(() => sandbox.finishByes(),
  /player fixture remains/i,
  "season finalization must refuse to skip an unresolved player fixture");
assert.equal(JSON.stringify(sandbox.state), beforePrematureClose,
  "a premature finalization attempt must not mutate the career");

console.log("PASS: odd-sized leagues settle their trailing bye before season awards; standings, matchday history, and retries remain idempotent.");
