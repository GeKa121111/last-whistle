#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "../..");
const htmlPath = path.join(repoRoot, "public", "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .map(([full, attrs, body], index) => ({ full, attrs, body, index }))
  .filter(item => !/\bsrc\s*=/.test(item.attrs) && item.body.trim());
const engineBlocks = blocks.filter(item =>
  /window\.LW(?:Career|Match)\s*=/.test(item.body)
);

assert.ok(engineBlocks.some(item => /window\.LWCareer\s*=/.test(item.body)),
  "published HTML must contain its career-engine module");
assert.ok(engineBlocks.some(item => /window\.LWMatch\s*=/.test(item.body)),
  "published HTML must contain its match-engine module");

const sandbox = { console };
sandbox.window = sandbox;
const context = vm.createContext(sandbox);
for (const block of engineBlocks) {
  new vm.Script(block.body, { filename: "public/index.html:inline-script-" + block.index })
    .runInContext(context);
}

const match = context.window.LWMatch;
const career = context.window.LWCareer;
assert.ok(match && typeof match.simulateMatch === "function",
  "published match engine must expose simulateMatch");
assert.ok(career && typeof career.matchDevelopment === "function",
  "published career engine must expose matchDevelopment");
assert.ok(typeof career.ensureState === "function",
  "published career engine must expose ensureState");

const positions = ["حارس مرمى", "قلب دفاع", "ظهير", "وسط دفاعي", "وسط مهاجم", "جناح", "مهاجم"];
let matchCases = 0;
for (const position of positions) {
  for (let seed = 1; seed <= 50; seed += 1) {
    const options = {
      seed,
      home: seed % 2 === 0,
      tactic: ["balanced", "attack", "defend", "counter"][seed % 4],
      teamName: "فريق اللاعب",
      opponentName: "المنافس",
      teamPower: 40 + (seed % 45),
      opponentPower: 35 + ((seed * 3) % 50),
      player: {
        position,
        role: "أساسي",
        name: "اللاعب",
        shooting: 65,
        passing: 62,
        vision: 61,
        composure: 66,
        fitness: 70,
        trust: 62,
        energy: 85,
        fatigue: 15
      }
    };
    const first = match.simulateMatch(options);
    const second = match.simulateMatch(options);
    assert.deepEqual(first, second,
      "published match engine must remain deterministic for fixed seed, position=" + position + ", seed=" + seed);
    assert.ok(first && first.score && first.player && Array.isArray(first.events),
      "published match engine returned malformed match result");
    const teamGoals = first.events.filter(event => event.type === "goal" && event.side === "team").length;
    const opponentGoals = first.events.filter(event => event.type === "goal" && event.side === "opponent").length;
    const playerGoals = first.events.filter(event =>
      event.type === "goal" && event.side === "team" && event.creditedToPlayer).length;
    assert.equal(teamGoals, first.score.for, "team goal events must reconcile with published score");
    assert.equal(opponentGoals, first.score.against, "opponent goal events must reconcile with published score");
    assert.equal(playerGoals, first.player.goals, "player goals must reconcile with published events");
    assert.ok(first.player.minutes >= 0 && first.player.minutes <= 90,
      "published player minutes must stay within regulation");
    if (typeof match.validateResult === "function") {
      assert.equal(match.validateResult(first).ok, true,
        "published engine validator rejected a simulated match");
    }
    matchCases += 1;
  }
}

const state = {
  pos: "مهاجم",
  age: 24,
  season: 2,
  apps: 0,
  money: 1000,
  weeklyWage: 500,
  contractSeasons: 3,
  freeAgent: false,
  daysSinceNegotiation: 7,
  shooting: 65,
  dribbling: 60,
  passing: 58,
  speed: 62,
  fitness: 64,
  composure: 65,
  vision: 60,
  goalkeeping: 45,
  defending: 45,
  energy: 100,
  fatigue: 0,
  playerPotential: 88,
  randomSeed: 1234,
  careerAwards: [],
  seasonLog: [],
  careerMatchHistory: [],
  playedToday: false,
  trainedToday: false,
  injuryDays: 0,
  trainingIntensity: "normal",
  progressionMatchIds: []
};
career.ensureState(state);
const record = {
  matchId: "published-integration-test-001",
  minutes: 75,
  rating: 7.8,
  goals: 1,
  assists: 0,
  competitionKey: "league|published-integration-test"
};
const firstDevelopment = career.matchDevelopment(state, record);
const appearancesAfterFirst = state.careerAppearances;
const secondDevelopment = career.matchDevelopment(state, record);
assert.equal(firstDevelopment.duplicate, undefined,
  "first published career progression event must not be considered duplicate");
assert.equal(secondDevelopment.duplicate, true,
  "published career engine must reject duplicate match progression");
assert.equal(state.careerAppearances, appearancesAfterFirst,
  "duplicate match progression must not increase career appearances twice");

console.log("PASS: published inline engines executed from public/index.html; " +
  matchCases + " deterministic match cases passed, score/event ledgers reconciled, " +
  "and career progression rejected duplicate match IDs.");
