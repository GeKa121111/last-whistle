"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "index.html"), "utf8");
const deployedApp = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
assert.equal(app, deployedApp, "root and public app shells must remain synchronized");

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
      recordNationalTournamentMatch(currentState) {
        currentState.nationalTournamentMatches++;
        return { ok: true, status: "group" };
      }
    }
  },
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
vm.runInContext(nationalMatchSource + "\nglobalThis.playNationalFixture = nationalMatch;", sandbox,
  { filename: "national-match-id-regression.js" });

sandbox.playNationalFixture();
sandbox.playNationalFixture();

assert.equal(state.nationalCaps, 0, "the fixture counter must advance even when the player does not appear");
assert.equal(state.nationalTournamentMatches, 2, "both non-appearance fixtures must advance the tournament");
assert.deepEqual(built.map(row => row.sequence), [1, 2],
  "sequential national fixtures must receive different IDs when caps remain unchanged");
assert.notEqual(built[0].id, built[1].id, "a second non-appearance must not collide with the first fixture ID");
assert.deepEqual(settled.map(row => row.matchday), [1, 2],
  "international matchday metadata must advance independently of caps");
assert.deepEqual(simulated.map(row => row.matchId), built.map(row => row.id),
  "the simulator and settlement must use the same unique fixture IDs");

console.log("PASS: international fixtures remain uniquely identifiable when the player is an unused substitute.");
