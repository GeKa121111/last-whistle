#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
global.window = global;
require(path.join(__dirname, "..", "public", "data", "match-engine.js"));

const engine = global.LWMatch;
assert.ok(engine && typeof engine.simulateMatch === "function", "match engine must expose simulateMatch");

// Exercise the engine shipped to players inside index.html as well as the source module.
const html = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");
const inlineScripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
const matchBundle = inlineScripts.find(script => script.includes("window.LWMatch ="));
assert.ok(matchBundle, "deployed HTML must contain the match engine");
const browserContext = { window: {} };
vm.createContext(browserContext);
vm.runInContext(matchBundle, browserContext, { filename: "index.html match bundle" });
const browserEngine = browserContext.window.LWMatch;
assert.ok(browserEngine && typeof browserEngine.simulateMatch === "function", "deployed match engine must initialise");
const positions = ["حارس مرمى", "قلب دفاع", "ظهير", "وسط دفاعي", "وسط مهاجم", "جناح", "مهاجم", "رأس حربة"];
const mobileForwardProfile = engine.positionProfile("مهاجم");
const centreStrikerProfile = engine.positionProfile("رأس حربة");
assert.ok(centreStrikerProfile.shooter > mobileForwardProfile.shooter,
  "the centre striker must have a stronger goal-threat profile than the mobile forward");
assert.ok(centreStrikerProfile.creator < mobileForwardProfile.creator,
  "the mobile forward must contribute more to chance creation than the centre striker");
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
    assert.equal(integrity.ok, true, "inconsistent source match for position " + position + ", seed " + seed + ": " + JSON.stringify(integrity));
    const deployed = browserEngine.simulateMatch(options);
    assert.equal(JSON.stringify(deployed), JSON.stringify(first), "deployed match engine must match the tested source for position " + position + ", seed " + seed);
    const deployedIntegrity = browserEngine.validateResult(deployed);
    assert.equal(deployedIntegrity.ok, true, "inconsistent deployed match for position " + position + ", seed " + seed + ": " + JSON.stringify(deployedIntegrity));
    assert.ok(first.player.minutes >= 0 && first.player.minutes <= 90, "player minutes must stay within regulation");
    assert.equal(first.score.for, first.regulation.for + first.extraTime.for, "team score must reconcile");
    assert.equal(first.score.against, first.regulation.against + first.extraTime.against, "opponent score must reconcile");
    tested += 1;
  }
}
// Regression sweep for same-minute injuries/red cards: player activity must be ordered before the exit event.
let injuryExits = 0;
let redCardExits = 0;
const exitSweep = 4000;
for (let seed = 10001; seed < 10001 + exitSweep; seed += 1) {
  const options = {
    seed, home: seed % 2 === 0, tactic: "balanced", teamPower: 68, opponentPower: 67,
    player: {
      name: "اختبار الخروج", position: seed % 2 ? "مهاجم" : "قلب دفاع", role: "أساسي",
      shooting: 68, passing: 64, vision: 63, composure: 66, fitness: 80,
      trust: 70, energy: 76, fatigue: 48
    }
  };
  const result = engine.simulateMatch(options);
  const integrity = engine.validateResult(result);
  assert.equal(integrity.ok, true, "exit regression failed at seed " + seed + ": " + JSON.stringify(integrity));
  const deployed = browserEngine.simulateMatch(options);
  assert.equal(JSON.stringify(deployed), JSON.stringify(result), "deployed/source drift at exit seed " + seed);
  const exitIndex = result.events.findIndex(event => event.side === "player"
    && ["red-card", "injury", "substitution"].includes(event.type));
  if (exitIndex >= 0) {
    const laterPlayerActivity = result.events.slice(exitIndex + 1).some(event =>
      event.creditedToPlayer === true
      || (event.side === "player" && ["yellow-card", "tackle", "interception"].includes(event.type)));
    assert.equal(laterPlayerActivity, false, "player action appeared after an exit event at seed " + seed);
  }
  if (result.events.some(event => event.type === "injury" && event.side === "player")) injuryExits += 1;
  if (result.events.some(event => event.type === "red-card" && event.side === "player")) redCardExits += 1;
}
assert.ok(injuryExits > 0, "exit regression sweep must cover at least one injury");
assert.ok(redCardExits > 0, "exit regression sweep must cover at least one red card");

// Opponent tactical styles must affect the simulation and remain in sync with the browser's embedded engine.
const tacticalSignatures = new Set();
for (const opponentTactic of ["balanced", "press", "compact", "wide", "counter"]) {
  const signatureRows = [];
  for (let seed = 21001; seed < 21031; seed += 1) {
    const options = {
      seed, opponentTactic, tactic: "attack", home: seed % 2 === 0,
      teamPower: 72, opponentPower: 69, opponentGoalkeeping: 68, teamGoalkeeping: 64,
      player: {
        name: "اختبار الذكاء التكتيكي", position: "مهاجم", role: "أساسي",
        shooting: 74, passing: 62, vision: 61, composure: 70, fitness: 75,
        trust: 65, energy: 82, fatigue: 18
      }
    };
    const result = engine.simulateMatch(options);
    const integrity = engine.validateResult(result);
    assert.equal(integrity.ok, true, "AI tactical style produced an inconsistent match: " + opponentTactic + "/" + seed);
    assert.equal(result.metadata.opponentTactic, opponentTactic, "the selected opponent tactic must be recorded");
    const deployed = browserEngine.simulateMatch(options);
    assert.equal(JSON.stringify(deployed), JSON.stringify(result), "AI tactical engine must match the published HTML: " + opponentTactic + "/" + seed);
    signatureRows.push(JSON.stringify({ score: result.score, events: result.events, shots: result.player.shots, goals: result.player.goals }));
  }
  tacticalSignatures.add(signatureRows.join("|"));
}
assert.ok(tacticalSignatures.size > 1, "different opponent tactics must change at least one simulated match trajectory");

const unavailable = engine.simulateMatch({ seed: 42, playerAvailable: false, player: { position: "مهاجم", energy: 90 } });
assert.equal(unavailable.player.minutes, 0, "unavailable player cannot play");
assert.equal(unavailable.player.goals, 0, "unavailable player cannot score");
console.log("PASS: " + tested + " deterministic position cases, " + exitSweep + " injury/red-card exit regressions, and source/deployed-engine parity.");
