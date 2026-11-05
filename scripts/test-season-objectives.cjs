"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "season-objectives.js"), "utf8");
const deployed = fs.readFileSync(path.join(root, "public", "season-objectives.js"), "utf8");
assert.equal(source, deployed, "root/public season objectives scripts must remain byte-identical");

let saveCount = 0, renderCount = 0, toastCount = 0, saveResult = true;
let runtimeState = null;
const window = {
  LWCareer: {
    uniqueMatchRows(rows) {
      const seen = new Set();
      return rows.filter(row => {
        const key = String(row.id || row.matchId || [
          row.season, row.scope, row.competition, row.matchday, row.day,
          row.club, row.opponent, row.minutes, row.goals, row.assists
        ].join("|"));
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
  },
  LWStoryRuntime: {
    getState: () => runtimeState,
    save() { saveCount++; return saveResult; },
    render() { renderCount++; },
    toast() { toastCount++; }
  },
  addEventListener() {},
  setInterval() { return 1; }
};
const documentListeners = Object.create(null);
const document = {
  readyState:"loading",
  addEventListener(name, callback) { documentListeners[name] = callback; },
  getElementById() { return null; }
};
const context = { window, document, console, Math, Number, String, Array, Object, JSON, Promise, Set };
vm.createContext(context);
vm.runInContext(source, context, { filename:"season-objectives.js" });
const objectives = window.LWSeasonObjectives;
assert.ok(objectives, "season objectives API must be exposed");

function ids(position) {
  return Array.from(objectives.catalogForPosition(position), item => item.id);
}
assert.deepEqual(ids("حارس مرمى"), ["keeper-clean-sheets", "keeper-saves", "keeper-rating"]);
assert.deepEqual(ids("قلب دفاع"), ["defender-clean-sheets", "defender-tackles", "defender-rating"]);
assert.deepEqual(ids("وسط"), ["midfield-assists", "midfield-key-passes", "midfield-rating"]);
assert.deepEqual(ids("رأس حربة"), ["attacker-goals", "attacker-contributions", "attacker-rating"]);

const leagueOne = { id:"league-s3-1", season:3, scope:"league", minutes:90, goals:4, assists:1, rating:7.4, keyPasses:5 };
const leagueTwo = { id:"league-s3-2", season:3, scope:"league", minutes:90, goals:3, assists:0, rating:7.2, keyPasses:6, cleanSheet:true };
const cupOne = { id:"cup-s3-1", season:3, scope:"cup", minutes:90, goals:2, assists:1, rating:7.5, keyPasses:7 };
const international = { id:"international-s3-1", season:3, scope:"international", minutes:90, goals:99, assists:99, rating:10 };
const oldSeason = { id:"league-s2-1", season:2, scope:"league", minutes:90, goals:99, assists:99, rating:10 };
const state = {
  careerStarted:true, season:3, pos:"رأس حربة", day:15, money:1000, morale:60,
  seasonLog:[leagueOne, leagueTwo],
  careerMatchHistory:[{...leagueOne},{...leagueTwo},cupOne,international,oldSeason]
};
const beforeMeasure = JSON.stringify(state);
const goals = objectives.measure(state, "attacker-goals");
assert.equal(goals.value, 9, "goal progress must include league and cup goals exactly once");
assert.equal(goals.appearances, 3, "duplicate seasonLog rows must not double-count appearances");
assert.equal(goals.complete, false);
assert.equal(objectives.measure(state, "attacker-contributions").value, 11);
assert.ok(Math.abs(objectives.measure(state, "attacker-rating").value - 7.3666666667) < 0.000001);
assert.equal(objectives.measure(state, "attacker-rating").complete, false,
  "rating objectives require the minimum number of official appearances");
assert.equal(JSON.stringify(state), beforeMeasure, "measuring progress must not mutate a saved career");

const currentMatchWins = {
  season:6, pos:"رأس حربة",
  seasonLog:[{
    id:"same-fixture",season:6,scope:"league",competition:"League",club:"Test FC",
    opponent:"Rivals",day:12,minutes:90,goals:0,assists:0,rating:6.1
  }],
  careerMatchHistory:[{
    id:"same-fixture",season:6,scope:"league",competition:"League",club:"Test FC",
    opponent:"Rivals",day:12,minutes:90,goals:2,assists:1,rating:8.6
  }]
};
assert.equal(objectives.measure(currentMatchWins, "attacker-goals").value, 2,
  "the current career history snapshot must win over a stale legacy duplicate");
assert.equal(objectives.measure(currentMatchWins, "attacker-rating").value, 8.6,
  "objective ratings must use the latest saved match snapshot, not the stale legacy copy");
assert.equal(objectives.measure(currentMatchWins, "attacker-goals").appearances, 1,
  "a fixture present in both history stores must count only once");

// Explicit malformed minutes must never count as an official appearance.
// This also guards against coercion of booleans, arrays, boxed numbers, and Symbols.
const malformedMinuteValues = [
  NaN, Infinity, -Infinity, "NaN", "Infinity", "-Infinity", "1e309",
  "not-a-number", true, false, {}, [], [90], new Number(90),
  Symbol("90"), 0, -1, "", "   ", null, undefined
];
const malformedMinuteState = {
  season:7,
  pos:"رأس حربة",
  careerMatchHistory: malformedMinuteValues.map((minutes, index) => ({
    id:"malformed-minute-" + index, season:7, scope:"league",
    minutes:minutes, goals:10, assists:5, rating:9.9
  })).concat([
    { id:"valid-number-minutes", season:7, scope:"league", minutes:90, goals:1, assists:0, rating:7.1 },
    { id:"valid-string-minutes", season:7, scope:"league", minutes:"90", goals:2, assists:0, rating:7.2 }
  ])
};
const malformedMinuteProgress = objectives.measure(malformedMinuteState, "attacker-goals");
assert.equal(malformedMinuteProgress.value, 3,
  "only finite positive numeric minutes and numeric strings may contribute to objectives");
assert.equal(malformedMinuteProgress.appearances, 2,
  "malformed, zero, negative, and non-numeric minute values must not count as appearances");

// A valid appearance can still contain corrupt statistical fields. These must
// be ignored safely by both objective measurement and the live UI signature.
const symbolStatState = {
  season:8, pos:"رأس حربة",
  careerMatchHistory:[{
    id:"symbol-stat-row", season:8, scope:"league", minutes:90,
    goals:Symbol("goals"), assists:Symbol("assists"),
    rating:Symbol("rating"), keyPasses:Symbol("key-passes")
  }]
};
assert.equal(objectives.measure(symbolStatState, "attacker-goals").value, 0,
  "Symbol goal and assist values must be ignored instead of throwing");
assert.equal(objectives.measure(symbolStatState, "attacker-rating").value, 0,
  "a Symbol rating must not crash average-rating objectives");
const symbolSeasonState = {
  season:8, pos:"رأس حربة",
  careerMatchHistory:[{
    id:"symbol-season-row", season:Symbol("season"), scope:"league",
    minutes:90, goals:50, assists:20, rating:9.9
  }]
};
assert.equal(objectives.measure(symbolSeasonState, "attacker-goals").value, 0,
  "a malformed season marker must be excluded without throwing");
runtimeState = symbolStatState;
assert.doesNotThrow(() => {
  assert.equal(typeof documentListeners.DOMContentLoaded, "function");
  documentListeners.DOMContentLoaded();
}, "the live season panel signature must tolerate corrupt numeric fields");

const keeperState = {
  season:1, pos:"حارس مرمى",
  careerMatchHistory:[
    { id:"gk-1", season:1, scope:"league", minutes:90, saves:20, cleanSheet:true, rating:7.5 },
    { id:"gk-2", season:1, scope:"league", minutes:90, stats:{saves:25,cleanSheet:true}, rating:7.2 }
  ]
};
assert.equal(objectives.measure(keeperState, "keeper-saves").value, 45);
assert.equal(objectives.measure(keeperState, "keeper-clean-sheets").value, 2);

runtimeState = state;
assert.equal(objectives.choose(state, "keeper-saves").reason, "objective-not-for-position");
assert.equal(saveCount, 0);
assert.equal(objectives.choose(state, "attacker-goals").ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(state.seasonObjective)), {
  id:"attacker-goals", season:3, claimed:false, createdDay:15
});
assert.equal(objectives.choose(state, "attacker-contributions").reason, "objective-already-selected");
assert.equal(saveCount, 1, "choosing an objective must save once");

const nextSeason = {
  careerStarted:true, season:4, pos:"وسط", day:1, money:500, morale:80,
  seasonObjective:{id:"attacker-goals",season:3,claimed:false,createdDay:15},
  careerMatchHistory:[]
};
runtimeState = nextSeason;
assert.equal(objectives.choose(nextSeason, "midfield-assists").ok, true);
assert.equal(nextSeason.seasonObjectiveHistory.length, 1);
assert.equal(nextSeason.seasonObjectiveHistory[0].id, "attacker-goals");

const completedState = {
  careerStarted:true, season:5, pos:"رأس حربة", day:25, money:200, morale:98,
  seasonObjective:{id:"attacker-goals",season:5,claimed:false,createdDay:1},
  careerMatchHistory:Array.from({length:12}, (_,index)=>({
    id:"scoring-"+index, season:5, scope:"league", minutes:90, goals:1, assists:0, rating:7.1
  }))
};
runtimeState = completedState;
const previousSaveCount = saveCount;
assert.equal(objectives.claim(completedState).ok, true);
assert.equal(completedState.money, 700);
assert.equal(completedState.morale, 100);
assert.equal(completedState.seasonObjective.claimed, true);
assert.equal(completedState.seasonObjective.claimedDay, 25);
assert.equal(completedState.diary[0].type, "هدف موسمي");
assert.equal(saveCount, previousSaveCount + 1);
assert.equal(objectives.claim(completedState).reason, "already-claimed");
assert.equal(completedState.money, 700, "a claimed objective must never pay twice");

const incomplete = {
  season:1, pos:"رأس حربة", money:900,
  seasonObjective:{id:"attacker-goals",season:1,claimed:false},
  careerMatchHistory:[{id:"few",season:1,scope:"league",minutes:90,goals:2}]
};
runtimeState = incomplete;
assert.equal(objectives.claim(incomplete).reason, "not-complete");
assert.equal(incomplete.money, 900);

const archived = {
  season:2, pos:"وسط", day:5, money:300, morale:50,
  seasonObjectiveHistory:[{id:"attacker-goals",season:1,claimed:false}],
  careerMatchHistory:Array.from({length:12}, (_,index)=>({
    id:"old-goal-"+index, season:1, scope:"league", minutes:90, goals:1
  }))
};
runtimeState = archived;
assert.equal(objectives.claim(archived, 1).ok, true,
  "completed objectives archived from a previous season must still be claimable once");
assert.equal(archived.money, 800);
assert.equal(archived.seasonObjectiveHistory[0].claimed, true);

const malformedCurrentObjective = {
  careerStarted:true, season:4, pos:"رأس حربة", day:10,
  seasonObjective:{id:"attacker-goals",season:Symbol("saved-season"),claimed:false}
};
runtimeState = malformedCurrentObjective;
let malformedChoose;
assert.doesNotThrow(() => { malformedChoose = objectives.choose(malformedCurrentObjective, "attacker-goals"); },
  "a malformed current objective season must not throw");
assert.equal(malformedChoose.reason, "invalid-current-objective");
assert.equal(typeof malformedCurrentObjective.seasonObjective.season, "symbol",
  "a malformed saved objective must remain untouched rather than being overwritten");

const malformedHistoryObjective = {
  careerStarted:true, season:5, pos:"رأس حربة", day:10,
  seasonObjectiveHistory:[{id:"attacker-goals",season:Symbol("archive-season"),claimed:false}]
};
runtimeState = malformedHistoryObjective;
let malformedHistoryClaim;
assert.doesNotThrow(() => { malformedHistoryClaim = objectives.claim(malformedHistoryObjective, 1); },
  "malformed archived objective seasons must be ignored safely");
assert.equal(malformedHistoryClaim.reason, "no-objective");

const malformedRewardState = {
  careerStarted:true, season:6, pos:"رأس حربة",
  day:Symbol("day"), money:Symbol("money"), morale:Symbol("morale"),
  seasonObjective:{id:"attacker-goals",season:6,claimed:false},
  careerMatchHistory:Array.from({length:12}, (_,index)=>({
    id:"safe-reward-"+index,season:6,scope:"league",minutes:90,goals:1,assists:0,rating:7.1
  }))
};
runtimeState = malformedRewardState;
let malformedReward;
assert.doesNotThrow(() => { malformedReward = objectives.claim(malformedRewardState); },
  "malformed reward balance, morale and day fields must not crash a completed objective claim");
assert.equal(malformedReward.ok,true);
assert.equal(malformedRewardState.money,500);
assert.equal(malformedRewardState.morale,5);
assert.equal(malformedRewardState.seasonObjective.claimedDay,1);
assert.equal(malformedRewardState.diary[0].day,1);

const retired = { season:1, pos:"رأس حربة", retired:true };
runtimeState = retired;
assert.equal(objectives.choose(retired, "attacker-goals").reason, "retired");
assert.equal(objectives.claim(retired).reason, "no-objective");
const retiredCompleted = {
  season:1, pos:"رأس حربة", retired:true, day:80, money:5, morale:40,
  seasonObjective:{id:"attacker-goals",season:1,claimed:false},
  careerMatchHistory:Array.from({length:12}, (_,index)=>({
    id:"retired-goal-"+index,season:1,scope:"league",minutes:90,goals:1
  }))
};
runtimeState = retiredCompleted;
assert.equal(objectives.claim(retiredCompleted).ok,true,
  "a retired player must still be able to collect an already completed season reward");
assert.equal(retiredCompleted.money,505);
assert.equal(objectives.claim(retiredCompleted).reason,"already-claimed");

const failedSaveState = { season:1, pos:"رأس حربة", day:1, money:50, morale:40 };
runtimeState = failedSaveState;
saveResult = false;
assert.equal(objectives.choose(failedSaveState, "attacker-goals").reason, "save-failed");
assert.equal(failedSaveState.seasonObjective, undefined,
  "a rejected save must roll back a new in-memory objective");
saveResult = true;

console.log("PASS: position-aware season objectives, official-match progress, archived rewards, one-time claims and save rollback.");
