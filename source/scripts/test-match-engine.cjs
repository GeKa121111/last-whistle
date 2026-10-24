#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
global.window = global;
require(path.join(__dirname, "..", "public", "data", "match-engine.js"));

const engine = global.LWMatch;
assert.ok(engine && typeof engine.simulateMatch === "function", "match engine must expose simulateMatch");
const positions = ["حارس مرمى", "قلب دفاع", "ظهير", "وسط دفاعي", "وسط مهاجم", "جناح", "مهاجم"];
let tested = 0;
for (const position of positions) {
  for (let seed = 1; seed <= 250; seed += 1) {
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
    const first = engine.simulateMatch(options);
    const second = engine.simulateMatch(options);
    assert.deepEqual(first, second, "a fixed seed must produce the same match");
    const integrity = engine.validateResult(first);
    assert.equal(integrity.ok, true, "inconsistent match for position " + position + ", seed " + seed + ": " + JSON.stringify(integrity));
    assert.ok(first.player.minutes >= 0 && first.player.minutes <= 90, "player minutes must stay within regulation");
    assert.equal(first.score.for, first.regulation.for + first.extraTime.for, "team score must reconcile");
    assert.equal(first.score.against, first.regulation.against + first.extraTime.against, "opponent score must reconcile");
    tested += 1;
  }
}
const unavailable = engine.simulateMatch({ seed: 42, playerAvailable: false, player: { position: "مهاجم", energy: 90 } });
assert.equal(unavailable.player.minutes, 0, "unavailable player cannot play");
assert.equal(unavailable.player.goals, 0, "unavailable player cannot score");
console.log("PASS: " + tested + " deterministic match-engine cases across seven positions, with ledger and score reconciliation checks.");
