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
assert.ok(centreStrikerProfile.finishingBonus > mobileForwardProfile.finishingBonus,
  "the centre striker must receive a distinct finishing advantage");
assert.equal(typeof engine.positionPerformanceImpact, "function", "role-aware match impact must be exposed for regression tests");

assert.equal(typeof engine.playerEarnsCleanSheet, "function", "clean-sheet eligibility must be testable independently");

assert.equal(typeof engine.playerConcededGoals, "function", "goalkeeper rating must use individually attributed concessions");
assert.equal(typeof browserEngine.playerConcededGoals, "function", "deployed goal attribution must remain in sync");
const lateConcessionEvent = [{ type: "goal", side: "opponent", minute: 82 }];
assert.equal(engine.playerConcededGoals(65, lateConcessionEvent), 0,
  "a goal after substitution must not be counted against the replaced goalkeeper");
assert.equal(engine.playerConcededGoals(65, lateConcessionEvent, 64), 1,
  "a goal after a red card must still be counted against the dismissed goalkeeper");
assert.equal(engine.playerConcededGoals(65, [{ type: "goal", side: "opponent", minute: 50 }]), 1,
  "a goal conceded while the goalkeeper is playing must affect their rating");
assert.equal(engine.positionPerformanceImpact("حارس مرمى", { saves: 0 }, engine.playerConcededGoals(65, lateConcessionEvent)), 0,
  "the substituted goalkeeper should not be penalized for a late concession");
assert.equal(engine.positionPerformanceImpact("حارس مرمى", { saves: 0 }, engine.playerConcededGoals(65, lateConcessionEvent, 64)), -0.06,
  "the sent-off goalkeeper should be penalized for a concession after the dismissal");
assert.equal(browserEngine.playerConcededGoals(65, lateConcessionEvent), 0,
  "the browser engine must match source attribution rules");

assert.equal(engine.playerConcededGoals(90, [{ type: "goal", side: "opponent", minute: 105 }]), 1,
  "a player who remains on the pitch through extra time must be accountable for an extra-time concession");
assert.equal(engine.playerConcededGoals(90, [
  { type: "substitution", side: "player", minute: 90 },
  { type: "goal", side: "opponent", minute: 105 }
]), 0, "a player substituted at the end of regulation must not be penalized for extra-time goals");

assert.equal(engine.playerConcededGoals(90, [
  { type: "goal", side: "opponent", minute: 100 },
  { type: "substitution", side: "player", minute: 105 }
]), 1, "a goal conceded during extra time before a late extra-time substitution must count against the player");
assert.equal(engine.playerConcededGoals(90, [
  { type: "substitution", side: "player", minute: 105 },
  { type: "goal", side: "opponent", minute: 110 }
]), 0, "a goal after an extra-time substitution must not count against the replaced player");
assert.equal(engine.playerEarnsCleanSheet("قلب دفاع", 90, [
  { type: "goal", side: "opponent", minute: 100 },
  { type: "substitution", side: "player", minute: 105 }
]), false, "an extra-time concession before substitution must prevent a clean sheet");
assert.equal(engine.playerEarnsCleanSheet("قلب دفاع", 90, [
  { type: "substitution", side: "player", minute: 105 },
  { type: "goal", side: "opponent", minute: 110 }
]), true, "an extra-time concession after substitution must not remove the clean sheet");
assert.equal(engine.playerConcededGoals(65, [
  { type: "red-card", side: "player", minute: 64 },
  { type: "goal", side: "opponent", minute: 82 }
]), 1, "a red-card event itself must preserve accountability for later concessions");
assert.equal(browserEngine.playerConcededGoals(90, [{ type: "goal", side: "opponent", minute: 105 }]), 1,
  "the deployed engine must attribute extra-time concessions exactly like the source");

assert.equal(engine.playerEarnsCleanSheet("قلب دفاع", 90, [{ type: "goal", side: "opponent", minute: 105 }]), false,
  "a defender who stays on the pitch into extra time must not receive a clean sheet after conceding");
assert.equal(engine.playerEarnsCleanSheet("قلب دفاع", 90, [
  { type: "substitution", side: "player", minute: 90 },
  { type: "goal", side: "opponent", minute: 105 }
]), true, "a defender substituted before extra time should retain the clean sheet");
assert.equal(browserEngine.playerEarnsCleanSheet("قلب دفاع", 90, [{ type: "goal", side: "opponent", minute: 105 }]), false,
  "the deployed engine must not credit a false extra-time clean sheet");

const cleanSheetValidationProbe = engine.simulateMatch({
  seed: 942771, teamPower: 65, opponentPower: 65,
  player: { position: "قلب دفاع", role: "أساسي", shooting: 55, passing: 65, vision: 60,
    composure: 65, fitness: 80, speed: 65, physical: 72, dribbling: 55,
    trust: 70, energy: 85, fatigue: 15 }
});
const corruptedCleanSheetProbe = {
  ...cleanSheetValidationProbe,
  player: { ...cleanSheetValidationProbe.player, cleanSheet: !cleanSheetValidationProbe.player.cleanSheet }
};
const corruptedCleanSheetValidation = engine.validateResult(corruptedCleanSheetProbe);
assert.equal(corruptedCleanSheetValidation.ok, false,
  "the match-ledger validator must reject a clean-sheet flag that contradicts the event timeline");
assert.equal(corruptedCleanSheetValidation.cleanSheetConsistent, false,
  "the validator should identify clean-sheet metadata drift explicitly");
assert.equal(typeof browserEngine.playerEarnsCleanSheet, "function", "deployed clean-sheet logic must stay exposed and synchronized");
const lateConcededGoals = [{ type: "goal", side: "opponent", minute: 82 }];
assert.equal(engine.playerEarnsCleanSheet("قلب دفاع", 65, lateConcededGoals), true,
  "a substituted defender who played 60+ minutes keeps a clean sheet after a later concession");
assert.equal(engine.playerEarnsCleanSheet("قلب دفاع", 65, [{ type: "goal", side: "opponent", minute: 40 }]), false,
  "a goal conceded while the defender is on the pitch prevents a clean sheet");
assert.equal(engine.playerEarnsCleanSheet("قلب دفاع", 75, lateConcededGoals, 75), false,
  "a player sent off remains accountable for goals conceded after the red card");
assert.equal(engine.playerEarnsCleanSheet("قلب دفاع", 59, []), false,
  "a defender must play at least 60 minutes to earn a clean sheet");
assert.equal(engine.playerEarnsCleanSheet("رأس حربة", 90, []), false,
  "a centre-forward should not receive a defensive clean-sheet stat");
assert.equal(browserEngine.playerEarnsCleanSheet("قلب دفاع", 65, lateConcededGoals), true,
  "the deployed engine must use the same clean-sheet rules as the source");
const goalkeeperImpact = engine.positionPerformanceImpact("حارس مرمى", { saves: 4, cleanSheet: true }, 0);
const centreBackImpact = engine.positionPerformanceImpact("قلب دفاع", { tackles: 4, interceptions: 3 }, 2);
const wingerDefensiveImpact = engine.positionPerformanceImpact("جناح", { tackles: 4, interceptions: 3 }, 2);
assert.ok(goalkeeperImpact > 1.4, "multiple saves and a clean sheet must meaningfully improve a goalkeeper rating");
assert.ok(centreBackImpact > wingerDefensiveImpact, "tackles and interceptions must matter more for defenders than for forwards");
assert.equal(engine.positionPerformanceImpact("قلب دفاع", { tackles: 0, interceptions: 0, cleanSheet: false }, 4), 0,
  "goals conceded by the team must not directly subtract defensive-player impact");
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
// Season-level sanity check: the match model must not collapse into near-constant 0-0 scores.
let totalGoals = 0;
const scoringSamples = 1200;
for (let seed = 70001; seed < 70001 + scoringSamples; seed++) {
  const sample = engine.simulateMatch({
    seed, tactic: "balanced", teamPower: 65, opponentPower: 65,
    player: { position: "رأس حربة", role: "أساسي", shooting: 65, composure: 65,
      passing: 60, vision: 60, fitness: 75, trust: 70, energy: 85, fatigue: 12 }
  });
  assert.equal(engine.validateResult(sample).ok, true, "season-level scoring sample must remain internally valid");
  totalGoals += sample.score.for + sample.score.against;
}
const averageMatchGoals = totalGoals / scoringSamples;
assert.ok(averageMatchGoals >= 1.45 && averageMatchGoals <= 3.4,
  "average full-match scoring should stay plausible: " + averageMatchGoals.toFixed(2));

// A striker should turn more of the shared match opportunity into personal goals than a mobile forward.
let mobileForwardGoals = 0, centreStrikerGoals = 0, mobileForwardAssists = 0, centreStrikerAssists = 0;
for (let seed = 81001; seed < 82001; seed++) {
  const base = {
    seed, tactic: "balanced", teamPower: 66, opponentPower: 65,
    player: { role: "أساسي", shooting: 68, composure: 70, passing: 72, vision: 70,
      fitness: 78, speed: 70, physical: 68, dribbling: 66, trust: 72, energy: 88, fatigue: 10 }
  };
  const mobile = engine.simulateMatch({ ...base, player: { ...base.player, position: "مهاجم" } });
  const striker = engine.simulateMatch({ ...base, player: { ...base.player, position: "رأس حربة" } });
  mobileForwardGoals += mobile.player.goals; centreStrikerGoals += striker.player.goals;
  mobileForwardAssists += mobile.player.assists; centreStrikerAssists += striker.player.assists;
}
assert.ok(centreStrikerGoals > mobileForwardGoals * 1.12,
  "centre-striker role should produce measurably more goals in a season-length sample");
assert.ok(mobileForwardAssists > centreStrikerAssists,
  "mobile forwards should create more assists than centre strikers over the same sample");

// Defensive actions must be represented at a plausible rate and match the event ledger.
const defensivePositions = ["حارس مرمى", "قلب دفاع", "ظهير", "وسط دفاعي", "وسط مهاجم", "جناح", "مهاجم", "رأس حربة"];
const defensiveTotals = Object.fromEntries(defensivePositions.map(position => [position, { tackles: 0, interceptions: 0 }]));
const defensiveSampleCount = 250;
for (const position of defensivePositions) {
  for (let seed = 30001; seed < 30001 + defensiveSampleCount; seed += 1) {
    const result = engine.simulateMatch({
      seed, tactic: "balanced", teamPower: 65, opponentPower: 65,
      player: {
        name: "اختبار الإحصاءات الدفاعية", position, role: "أساسي",
        shooting: 65, passing: 65, vision: 64, composure: 66, fitness: 80,
        speed: 70, physical: 68, dribbling: 66, trust: 70, energy: 85, fatigue: 15
      }
    });
    const integrity = engine.validateResult(result);
    assert.equal(integrity.ok, true, "defensive-action ledger failed for " + position + "/" + seed + ": " + JSON.stringify(integrity));
    const eventTackles = result.events.filter(event => event.type === "tackle" && event.side === "player").length;
    const eventInterceptions = result.events.filter(event => event.type === "interception" && event.side === "player").length;
    assert.equal(result.player.tackles, eventTackles, "tackle totals must match the event timeline");
    assert.equal(result.player.interceptions, eventInterceptions, "interception totals must match the event timeline");
    defensiveTotals[position].tackles += result.player.tackles;
    defensiveTotals[position].interceptions += result.player.interceptions;
  }
}
const defensiveAverages = Object.fromEntries(defensivePositions.map(position => [position, {
  tackles: defensiveTotals[position].tackles / defensiveSampleCount,
  interceptions: defensiveTotals[position].interceptions / defensiveSampleCount
}]));
assert.ok(defensiveAverages["قلب دفاع"].tackles > 1.8,
  "centre-backs should average multiple tackles per full match: " + defensiveAverages["قلب دفاع"].tackles.toFixed(2));
assert.ok(defensiveAverages["قلب دفاع"].interceptions > 1.1,
  "centre-backs should register interceptions across a full match: " + defensiveAverages["قلب دفاع"].interceptions.toFixed(2));
assert.ok(defensiveAverages["قلب دفاع"].tackles > defensiveAverages["رأس حربة"].tackles * 1.5,
  "centre-backs must perform more tackles than centre strikers");
assert.ok(defensiveAverages["قلب دفاع"].interceptions > defensiveAverages["رأس حربة"].interceptions * 1.5,
  "centre-backs must perform more interceptions than centre strikers");
assert.equal(defensiveAverages["حارس مرمى"].tackles, 0, "goalkeepers must not inherit outfield tackle events");
assert.equal(defensiveAverages["حارس مرمى"].interceptions, 0, "goalkeepers must not inherit outfield interception events");

 
// A personal clean sheet is assessed only over the player's own on-pitch minutes.
// A defensive player who leaves before a late concession keeps the clean sheet;
// an attacker is not given a goalkeeper/defender clean-sheet stat.
let lateConcessionCase = null;
for (let seed = 92001; seed < 95001 && !lateConcessionCase; seed += 1) {
  const options = {
    seed, tactic: "balanced", teamPower: 65, opponentPower: 65,
    player: {
      name: "اختبار الشباك النظيفة", position: "قلب دفاع", role: "بديل أساسي",
      shooting: 54, passing: 65, vision: 61, composure: 62, fitness: 80,
      speed: 66, physical: 72, dribbling: 55, trust: 70, energy: 85, fatigue: 15
    }
  };
  const result = engine.simulateMatch(options);
  const opponentGoals = result.events.filter(event => event.type === "goal" && event.side === "opponent");
  if (result.player.minutes >= 60 && result.player.minutes < 90
      && opponentGoals.some(event => event.minute > result.player.minutes)
      && !opponentGoals.some(event => event.minute <= result.player.minutes)) {
    lateConcessionCase = { options, result };
  }
}
assert.ok(lateConcessionCase, "clean-sheet test must find a defensive player subbed before a late concession");
assert.equal(lateConcessionCase.result.player.cleanSheet, true,
  "a defender who played at least 60 minutes and conceded no goals while on pitch should keep the clean sheet");
const lateConcessionBrowser = browserEngine.simulateMatch(lateConcessionCase.options);
assert.deepEqual(JSON.parse(JSON.stringify(lateConcessionBrowser)), lateConcessionCase.result,
  "the deployed engine must credit the same on-pitch clean sheet as the source engine");
const attackerCleanSheet = engine.simulateMatch({
  seed: 888, teamPower: 80, opponentPower: 40,
  player: { position: "رأس حربة", role: "أساسي", shooting: 70, composure: 70,
    passing: 60, vision: 60, fitness: 80, trust: 65, energy: 85, fatigue: 10 }
});
assert.equal(attackerCleanSheet.player.cleanSheet, false,
  "clean-sheet player stats should be limited to goalkeepers and defensive roles");

// A starting role should mean more minutes on the pitch than a substitute role.
const starterMinutesProbe = engine.simulateMatch({
  seed: 91001, player: { position: "رأس حربة", role: "أساسي", shooting: 68, composure: 70,
    fitness: 78, speed: 70, physical: 68, trust: 55, energy: 85, fatigue: 10 }
});
const substituteMinutesProbe = engine.simulateMatch({
  seed: 91001, player: { position: "رأس حربة", role: "بديل", shooting: 68, composure: 70,
    fitness: 78, speed: 70, physical: 68, trust: 55, energy: 85, fatigue: 10 }
});
assert.ok(starterMinutesProbe.player.minutes > substituteMinutesProbe.player.minutes,
  "a promoted striker must receive more match minutes than a substitute");

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
console.log("PASS: " + tested + " deterministic position cases and defensive-action profiles, " + exitSweep + " injury/red-card exit regressions, and source/deployed-engine parity.");
