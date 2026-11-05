"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const careerEngineSource = fs.readFileSync(path.join(root, "source", "public", "data", "career-engine.js"), "utf8");
const careerEngineSandbox = { window: {} };
vm.createContext(careerEngineSandbox);
vm.runInContext(careerEngineSource, careerEngineSandbox, { filename: "career-engine-national-tournament.js" });
const career = careerEngineSandbox.window.LWCareer;
assert.ok(career && typeof career.recordNationalTournamentMatch === "function",
  "the shared career engine must expose the tournament progression helper");
const app = fs.readFileSync(path.join(root, "index.html"), "utf8");
const deployedApp = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
assert.equal(app, deployedApp, "root and public app shells must remain synchronized");

const counterHelperStart = app.indexOf("const normalizeNationalTournamentCounter =");
const counterHelperEnd = app.indexOf("\n};", counterHelperStart);
assert.ok(counterHelperStart >= 0 && counterHelperEnd > counterHelperStart,
  "the UI national tournament counter helper must exist");
const counterHelperSource = app.slice(counterHelperStart, counterHelperEnd + 3);

const start = app.indexOf("function nationalMatch(){");
assert.ok(start >= 0, "the international fixture action must exist");
const end = app.indexOf("\nfunction ", start + 1);
assert.ok(end > start, "the international fixture action must have a clear function boundary");
const nationalMatchSource = app.slice(start, end);
assert.ok(nationalMatchSource.includes("const nationalMatchday=tournamentMatchIndex+1;"),
  "international fixture IDs must use the tournament fixture counter");
assert.ok(nationalMatchSource.includes("buildMatchId(\"international\",competition,nationalMatchday,"),
  "international match IDs must not depend on player caps");
assert.ok(nationalMatchSource.includes("matchday:nationalMatchday"),
  "international matchday metadata must stay aligned with the tournament fixture counter");
const tournamentPreviewAt = nationalMatchSource.indexOf("const tournamentPreview=structuredCloneSafe(state);");
const tournamentPreflightAt = nationalMatchSource.indexOf("recordNationalTournamentMatch(tournamentPreview,result.outcome)");
const matchSettlementAt = nationalMatchSource.indexOf("applyMatchResult(result,{id");
assert.ok(tournamentPreviewAt >= 0 && tournamentPreflightAt > tournamentPreviewAt && matchSettlementAt > tournamentPreflightAt,
  "tournament progression must be validated on a copy before match statistics are committed");
assert.equal(nationalMatchSource.includes("(Number(state.nationalCaps)||0)+1"), false,
  "a non-appearance must not cause the next international fixture to reuse its ID");

const state = {
  retired: false, nationalCalled: true, nationalTournamentDone: false,
  nationalTournamentMatches: 0, nationalTournamentPoints: 0,
  nationalTournamentQualified: false, nationalTournamentWinner: false,
  nationalCaps: 0, nationalTeam: "مصر", season: 2, lastTactic: "balanced",
  playedToday: false, trainedToday: false, injuryDays: 0, energy: 100,
  calendarDay: 12, internationalPlayed: false
};
const built = [], simulated = [], settled = [];
const sandbox = {
  state,
  window: {
    LWCareer: {
      recordNationalTournamentMatch(currentState, outcome) {
        return career.recordNationalTournamentMatch(currentState, outcome);
      }
    }
  },
  structuredCloneSafe: value => JSON.parse(JSON.stringify(value)),
  isYouthAcademyPlayer: () => false,
  calendarHasConflict: () => false,
  checkAction: () => true,
  toast: () => {},
  clamp: (value, min, max) => Math.max(min, Math.min(max, Math.round(Number(value) || 0))),
  buildMatchId: (scope, competition, sequence, team) => {
    const id = [scope, competition, sequence, team].join("|");
    built.push({ id, sequence });
    return id;
  },
  simulateCareerMatch: options => {
    simulated.push(options);
    return {
      player: { minutes: 0, rating: 0, goals: 0, assists: 0 },
      score: { for: 0, against: 0 }, outcome: "تعادل",
      events: [], extraTime: false, shootout: null
    };
  },
  applyMatchResult: (result, meta) => {
    settled.push(meta);
    return { record: { id: meta.id }, participated: false };
  },
  setStory: () => {},
  saveGame: () => {},
  render: () => {},
  openModal: () => {},
  showPage: () => {}
};
vm.createContext(sandbox);
vm.runInContext(counterHelperSource + "\n" + nationalMatchSource + "\nglobalThis.playNationalFixture = nationalMatch;", sandbox,
  { filename: "national-match-id-regression.js" });

sandbox.playNationalFixture();
sandbox.playNationalFixture();

assert.equal(state.nationalCaps, 0, "the fixture counter must advance even when the player does not appear");
assert.equal(state.nationalTournamentMatches, 2, "both non-appearance fixtures must advance the tournament");
assert.equal(state.nationalTournamentPoints, 2, "the validated group draws must commit their points with the fixtures");
assert.deepEqual(built.map(row => row.sequence), [1, 2],
  "sequential national fixtures must receive different IDs when caps remain unchanged");
assert.notEqual(built[0].id, built[1].id, "a second non-appearance must not collide with the first fixture ID");
assert.deepEqual(settled.map(row => row.matchday), [1, 2],
  "international matchday metadata must advance independently of caps");
assert.deepEqual(simulated.map(row => row.matchId), built.map(row => row.id),
  "the simulator and settlement must use the same unique fixture IDs");

function runRejectedTournamentFixture(overrides, expectedStatus) {
  const invalidState = {
    ...state,
    nationalTournamentMatches: 3,
    nationalTournamentPoints: overrides.nationalTournamentPoints,
    nationalTournamentQualified: overrides.nationalTournamentQualified,
    nationalTournamentDone: false,
    nationalTournamentWinner: false,
    internationalPlayed: false,
    nationalCaps: 0,
    recordedMatchIds: []
  };
  const rejectedSettlements = [];
  const invalidSandbox = {
    ...sandbox,
    state: invalidState,
    window: {
      LWCareer: {
        recordNationalTournamentMatch(currentState, outcome) {
          const result = career.recordNationalTournamentMatch(currentState, outcome);
          assert.equal(result.status, expectedStatus);
          return result;
        }
      }
    },
    applyMatchResult: (result, meta) => {
      rejectedSettlements.push(meta);
      return { record: { id: meta.id }, participated: false };
    }
  };
  vm.createContext(invalidSandbox);
  vm.runInContext(counterHelperSource + "\n" + nationalMatchSource + "\nglobalThis.playNationalFixture = nationalMatch;", invalidSandbox,
    { filename: "national-match-transaction-regression.js" });
  invalidSandbox.playNationalFixture();
  assert.equal(rejectedSettlements.length, 0,
    "an invalid tournament transition must be rejected before match statistics are recorded");
  assert.equal(invalidState.nationalTournamentMatches, 3,
    "a rejected tournament transition must leave the fixture counter unchanged");
  assert.equal(invalidState.nationalTournamentPoints, overrides.nationalTournamentPoints,
    "a rejected tournament transition must leave points unchanged");
  assert.equal(invalidState.nationalCaps, 0,
    "a rejected tournament transition must not credit an international appearance");
  assert.equal(invalidState.internationalPlayed, false,
    "a rejected tournament transition must not close or advance the international record");
}
runRejectedTournamentFixture({ nationalTournamentPoints: 2, nationalTournamentQualified: false }, "not-qualified");
runRejectedTournamentFixture({ nationalTournamentPoints: 4, nationalTournamentQualified: true }, "final-winner-required");

console.log("PASS: international fixtures remain unique for unused substitutes, and rejected tournament transitions cannot partially commit match statistics.");
