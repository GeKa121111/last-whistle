#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
global.window = global;
require(path.join(__dirname, "..", "public", "data", "match-engine.js"));

const rootEngineSource = fs.readFileSync(path.join(__dirname, "..", "..", "data", "match-engine.js"), "utf8");
const deployedEngineSource = fs.readFileSync(path.join(__dirname, "..", "..", "public", "data", "match-engine.js"), "utf8");
const sourceEngineSource = fs.readFileSync(path.join(__dirname, "..", "public", "data", "match-engine.js"), "utf8");
assert.equal(rootEngineSource, deployedEngineSource, "root and deployed match-engine source files must stay synchronized");
assert.equal(rootEngineSource, sourceEngineSource, "source/public and root match-engine files must stay synchronized");

const engine = global.LWMatch;
assert.ok(engine && typeof engine.simulateMatch === "function", "match engine must expose simulateMatch");

// Exercise the engine shipped to players inside index.html as well as the source module.
const html = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");
const inlineScripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
const matchBundle = inlineScripts.find(script => script.includes("window.LWMatch ="));
assert.ok(matchBundle, "deployed HTML must contain the match engine");
assert.ok(html.includes('"substitution-on":"دخول بديل"') && html.includes('"substitution-on","substitution"'),
  "the match report must display a late substitute's entry event");
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
assert.equal(engine.playerConcededGoals(90, [
  { type: "goal", side: "opponent", minute: 50 },
  { type: "substitution", side: "player", minute: 60 },
  { type: "goal", side: "opponent", minute: 82 }
]), 1, "an explicit substitution minute must count only concessions before the player exits");
assert.equal(engine.playerConcededGoals(90, [
  { type: "injury", side: "player", minute: 60 },
  { type: "goal", side: "opponent", minute: 82 }
]), 0, "a goal after an injury exit must not be attributed to the injured player");
assert.equal(engine.playerConcededGoals(65, lateConcessionEvent, 64), 0,
  "a goal after a red card must not be counted against the dismissed goalkeeper");
assert.equal(engine.playerConcededGoals(65, [{ type: "goal", side: "opponent", minute: 50 }]), 1,
  "a goal conceded while the goalkeeper is playing must affect their rating");
assert.equal(engine.positionPerformanceImpact("حارس مرمى", { saves: 0 }, engine.playerConcededGoals(65, lateConcessionEvent)), 0,
  "the substituted goalkeeper should not be penalized for a late concession");
assert.equal(engine.positionPerformanceImpact("حارس مرمى", { saves: 0 }, engine.playerConcededGoals(65, lateConcessionEvent, 64)), 0,
  "the sent-off goalkeeper must not be penalized for a concession after the dismissal");
assert.equal(browserEngine.playerConcededGoals(65, lateConcessionEvent), 0,
  "the browser engine must match source attribution rules");
assert.equal(browserEngine.playerConcededGoals(65, lateConcessionEvent, 64), 0,
  "the deployed engine must stop attributing concessions after a red card");

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
]), 0, "a red-card event must end responsibility for later concessions");
assert.equal(engine.playerConcededGoals(65, [
  { type: "goal", side: "opponent", minute: 64 },
  { type: "red-card", side: "player", minute: 64 }
]), 1, "a goal at the dismissal minute must still count if it occurred before the player exited");
const goalAfterEntryAtSameMinute = [
  { type: "substitution-on", side: "player", minute: 60 },
  { type: "goal", side: "opponent", minute: 60 }
];
assert.equal(engine.playerConcededGoals(30, goalAfterEntryAtSameMinute), 1,
  "a goal in the substitute's entry minute must count because substitution-on sorts first");
assert.equal(engine.playerConcededGoals(30, [...goalAfterEntryAtSameMinute].reverse()), 1,
  "same-minute attribution must follow canonical event priority, not raw insertion order");
assert.equal(engine.playerEarnsCleanSheet("قلب دفاع", 60, goalAfterEntryAtSameMinute), false,
  "a same-minute concession after entry must prevent a clean sheet");
assert.equal(engine.playerConcededGoals(90, [
  { type: "substitution", side: "player", minute: 60 },
  { type: "goal", side: "opponent", minute: 60 }
]), 1, "a goal at the exit minute must count because goals sort before exit events");
assert.equal(engine.playerConcededGoals(90, [
  { type: "goal", side: "opponent", minute: 60 },
  { type: "substitution", side: "player", minute: 60 }
]), 1, "same-minute exit attribution must not depend on raw insertion order");
assert.equal(browserEngine.playerConcededGoals(30, goalAfterEntryAtSameMinute), 1,
  "the embedded browser engine must use the same same-minute entry rule");
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

// Integration regression: this engine does not simulate player participation beyond 90 minutes.
// If extra time is played, regulation-only player stats must end at minute 90 even when the
// team concedes later. Search deterministic seeds for an actual extra-time concession.
let extraTimeRegulationExit = null;
for (let seed = 150001; seed < 151501 && !extraTimeRegulationExit; seed += 1) {
  const result = engine.simulateMatch({
    seed, knockout: true, teamPower: 65, opponentPower: 65,
    player: {
      name: "اختبار خروج اللاعب قبل الوقت الإضافي", position: "قلب دفاع", role: "أساسي",
      shooting: 65, passing: 65, vision: 65, composure: 70, fitness: 100, trust: 100,
      energy: 100, fatigue: 0, speed: 70, physical: 72, dribbling: 60
    }
  });
  const dismissedOrInjured = result.events.some(event => event.side === "player"
    && ["red-card", "injury"].includes(event.type));
  const concededInExtraTime = result.events.some(event => event.type === "goal"
    && event.side === "opponent" && Number(event.minute) > 90);
  if (result.extraTime.played && result.player.minutes === 90 && !dismissedOrInjured && concededInExtraTime) {
    extraTimeRegulationExit = result;
  }
}
assert.ok(extraTimeRegulationExit, "the deterministic knockout sample must include an extra-time concession");
assert.ok(extraTimeRegulationExit.events.some(event => event.type === "substitution"
  && event.side === "player" && Number(event.minute) === 90),
  "the simulated player must have an explicit exit at regulation time when the engine does not simulate extra-time minutes");
const regulationConcessions = extraTimeRegulationExit.events.filter(event => event.type === "goal"
  && event.side === "opponent" && Number(event.minute) <= 90).length;
assert.equal(engine.playerConcededGoals(90, extraTimeRegulationExit.events), regulationConcessions,
  "extra-time goals must not lower the simulated player's rating or remove their regulation clean sheet");
assert.equal(engine.validateResult(extraTimeRegulationExit).ok, true,
  "the extra-time exit event must keep the match ledger internally consistent");

// An aggregate lead must not turn a drawn second leg into a positive player-rating result.
// The competition outcome remains a tie win, while the fixture itself is still a draw.
let aggregateRatingProbe = null;
for (let seed = 160001; seed < 160601 && !aggregateRatingProbe; seed += 1) {
  const common = {
    seed, teamPower: 65, opponentPower: 65,
    player: { name: "اختبار نتيجة المباراة والإجمالي", position: "وسط مهاجم", role: "أساسي",
      shooting: 62, passing: 65, vision: 66, composure: 67, fitness: 80, trust: 70, energy: 85, fatigue: 12 }
  };
  const fixture = engine.simulateMatch({ ...common, knockout: false, aggregateOffset: 0 });
  if (fixture.score.for !== fixture.score.against || fixture.player.minutes <= 0) continue;
  const secondLeg = engine.simulateMatch({ ...common, knockout: true, aggregateOffset: 1 });
  if (secondLeg.extraTime.played || secondLeg.score.for !== secondLeg.score.against) continue;
  aggregateRatingProbe = { fixture, secondLeg };
}
assert.ok(aggregateRatingProbe, "a deterministic tied fixture must be found for aggregate-rating regression");
assert.equal(aggregateRatingProbe.fixture.matchOutcome, "تعادل", "the fixture result must describe its actual score");
assert.equal(aggregateRatingProbe.secondLeg.matchOutcome, "تعادل", "a lead on aggregate must not rewrite the second-leg match result");
assert.equal(aggregateRatingProbe.secondLeg.outcome, "فوز", "aggregate tie outcome must still preserve cup progression semantics");
assert.equal(aggregateRatingProbe.secondLeg.player.rating, aggregateRatingProbe.fixture.player.rating,
  "aggregate advantage must not give the player a win bonus for a drawn match");
assert.equal(engine.validateResult(aggregateRatingProbe.secondLeg).matchOutcomeConsistent, true,
  "the ledger validator must check the fixture outcome separately from aggregate progression");
assert.equal(engine.validateResult(aggregateRatingProbe.secondLeg).outcomeConsistent, true,
  "the aggregate tie result must validate independently from the individual leg result");
const corruptedAggregateOutcome = { ...aggregateRatingProbe.secondLeg, outcome: "خسارة" };
const corruptedAggregateValidation = engine.validateResult(corruptedAggregateOutcome);
assert.equal(corruptedAggregateValidation.outcomeConsistent, false,
  "the ledger validator must reject an aggregate outcome that contradicts the aggregate score");
assert.equal(corruptedAggregateValidation.ok, false,
  "a corrupted aggregate outcome must invalidate the match result");
assert.equal(browserEngine.validateResult(corruptedAggregateOutcome).outcomeConsistent, false,
  "the embedded browser validator must reject the same aggregate-outcome mismatch");

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
assert.equal(engine.playerEarnsCleanSheet("قلب دفاع", 75, lateConcededGoals, 75), true,
  "a player sent off after 60 minutes keeps a clean sheet if the only goal comes after dismissal");
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
let totalPlayerFouls = 0;
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
    const eventFouls = result.events.filter(event => event.type === "foul" && event.side === "player").length;
    assert.equal(result.player.tackles, eventTackles, "tackle totals must match the event timeline");
    assert.equal(result.player.interceptions, eventInterceptions, "interception totals must match the event timeline");
    assert.equal(result.player.fouls, eventFouls, "player foul totals must match the event timeline");
    assert.equal(engine.buildStoryReport(result, { season: 1, week: seed }).player.fouls, eventFouls,
      "story reports must preserve the foul count");
    totalPlayerFouls += eventFouls;
    defensiveTotals[position].tackles += result.player.tackles;
    defensiveTotals[position].interceptions += result.player.interceptions;
  }
}
assert.ok(totalPlayerFouls > 0, "full-match samples must record player-attributed fouls");
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
      || (event.side === "player" && ["yellow-card", "tackle", "interception", "foul"].includes(event.type)));
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
// Bench-role appearances must begin late, not be simulated as a first-half starter.
const substituteOptions = {
  seed: 24061028, teamPower: 62, opponentPower: 58,
  player: { name: "اختبار البديل", role: "بديل", position: "حارس مرمى", goalkeeping: 82,
    shooting: 25, composure: 70, trust: 55, fitness: 75, energy: 95, fatigue: 5 }
};
const substituteResult = engine.simulateMatch(substituteOptions);
const substituteEntry = substituteResult.events.find(event => event.type === "substitution-on" && event.side === "player");
assert.ok(substituteEntry && substituteEntry.minute > 0,
  "a bench-role player must have an explicit late entry event");
const substituteExit = substituteResult.events
  .filter(event => event.side === "player" && ["red-card", "injury", "substitution"].includes(event.type))
  .sort((a, b) => Number(a.minute) - Number(b.minute))[0];
const substituteEndMinute = substituteExit ? Number(substituteExit.minute) : 90;
assert.equal(substituteResult.player.minutes, substituteEndMinute - Number(substituteEntry.minute),
  "bench player's minutes must be the interval after entry, not a first-half stint");
const substituteActivity = substituteResult.events.filter(event => event.creditedToPlayer === true
  || (event.side === "player" && ["yellow-card", "tackle", "interception", "foul", "red-card", "injury"].includes(event.type)));
assert.ok(substituteActivity.every(event => Number(event.minute) >= Number(substituteEntry.minute)
  && Number(event.minute) <= substituteEndMinute),
  "bench-player stats and events must stay inside the actual on-pitch interval");
assert.equal(engine.validateResult(substituteResult).ok, true,
  "the match ledger must accept a valid late substitute appearance");
for (const [benchRole, seed] of [["ناشئ / بديل", 24061029], ["لاعب صاعد / بديل", 24061030]]) {
  const youthSubstitute = engine.simulateMatch({
    ...substituteOptions, seed,
    player: { ...substituteOptions.player, role: benchRole }
  });
  const entry = youthSubstitute.events.find(event => event.type === "substitution-on" && event.side === "player");
  assert.ok(entry && Number(entry.minute) > 0,
    benchRole + " must be treated as a real bench role");
  assert.equal(engine.validateResult(youthSubstitute).ok, true,
    benchRole + " must keep player events inside the actual playing interval");
}
const rotationStarter = engine.simulateMatch({
  ...substituteOptions, seed: 24061031,
  player: { ...substituteOptions.player, role: "بديل أساسي" }
});
assert.equal(rotationStarter.events.some(event => event.type === "substitution-on" && event.side === "player"), false,
  "the rotation-starter role must keep its existing starting appearance model");
assert.ok(rotationStarter.player.minutes < 90,
  "the rotation-starter role must retain its planned shorter duration");

const browserSubstituteResult = browserEngine.simulateMatch(substituteOptions);
assert.equal(browserEngine.validateResult(browserSubstituteResult).ok, true,
  "the inline browser engine must use the same late-substitute timing and ledger rules");

 // Same-minute activity must be allowed after the canonical substitution-on event.
 // Exercise many deterministic seeds so both outfield involvement and goalkeeper saves
 // cover an entry-minute shot; also verify the embedded HTML engine matches the source.
 let entryMinuteForwardShots = 0;
 let entryMinuteGoalkeeperSaves = 0;
 let checkedBrowserForwardEntryMinute = false;
 let checkedBrowserKeeperEntryMinute = false;
 for (let seed = 260000; seed < 261800; seed += 1) {
   const forwardOptions = {
     ...substituteOptions, seed,
     player: { ...substituteOptions.player, position: "رأس حربة", role: "بديل",
       shooting: 80, composure: 80, passing: 68, vision: 70, energy: 95, fatigue: 5 }
   };
   const forwardResult = engine.simulateMatch(forwardOptions);
   const forwardEntry = forwardResult.events.find(event => event.type === "substitution-on" && event.side === "player");
   assert.ok(forwardEntry, "forward entry-minute regression requires a substitute entry");
   const entryMinuteShots = forwardResult.events.filter(event => event.type === "shot" && event.side === "team"
     && Number(event.minute) === Number(forwardEntry.minute) && event.creditedToPlayer === true);
   entryMinuteForwardShots += entryMinuteShots.length;
   assert.equal(engine.validateResult(forwardResult).ok, true,
     "a player shot in the entry minute must pass match-ledger validation");
   if (entryMinuteShots.length && !checkedBrowserForwardEntryMinute) {
     assert.equal(JSON.stringify(browserEngine.simulateMatch(forwardOptions)), JSON.stringify(forwardResult),
       "embedded engine must credit entry-minute shots exactly like the source");
     checkedBrowserForwardEntryMinute = true;
   }

   const keeperOptions = {
     ...substituteOptions, seed: seed + 400000,
     player: { ...substituteOptions.player, position: "حارس مرمى", role: "بديل",
       shooting: 25, composure: 75, goalkeeping: 90, energy: 95, fatigue: 5 }
   };
   const keeperResult = engine.simulateMatch(keeperOptions);
   const keeperEntry = keeperResult.events.find(event => event.type === "substitution-on" && event.side === "player");
   assert.ok(keeperEntry, "goalkeeper entry-minute regression requires a substitute entry");
   const entryMinuteSaves = keeperResult.events.filter(event => event.type === "save" && event.side === "team"
     && Number(event.minute) === Number(keeperEntry.minute) && event.creditedToPlayer === true);
   entryMinuteGoalkeeperSaves += entryMinuteSaves.length;
   assert.equal(engine.validateResult(keeperResult).ok, true,
     "a goalkeeper save in the entry minute must pass match-ledger validation");
   if (entryMinuteSaves.length && !checkedBrowserKeeperEntryMinute) {
     assert.equal(JSON.stringify(browserEngine.simulateMatch(keeperOptions)), JSON.stringify(keeperResult),
       "embedded engine must credit entry-minute saves exactly like the source");
     checkedBrowserKeeperEntryMinute = true;
   }
 }
 assert.ok(entryMinuteForwardShots > 0,
   "a substitute must be able to take a credited shot in the minute they enter");
 assert.ok(entryMinuteGoalkeeperSaves > 0,
   "a substitute goalkeeper must be able to record a save in the minute they enter");
 assert.ok(checkedBrowserForwardEntryMinute && checkedBrowserKeeperEntryMinute,
   "the deployed engine must cover same-minute forward and goalkeeper activity");
 
 const lateEntryConcessions = [
  { type: "goal", side: "opponent", minute: 20 },
  { type: "substitution-on", side: "player", minute: 51 },
  { type: "goal", side: "opponent", minute: 60 },
  { type: "substitution", side: "player", minute: 90 },
  { type: "goal", side: "opponent", minute: 105 }
];
assert.equal(engine.playerConcededGoals(39, lateEntryConcessions), 1,
  "a substitute goalkeeper must only be charged for goals after entry and before exit");
assert.equal(engine.playerEarnsCleanSheet("حارس مرمى", 65, [
  { type: "goal", side: "opponent", minute: 10 },
  { type: "substitution-on", side: "player", minute: 20 },
  { type: "substitution", side: "player", minute: 85 }
]), true, "goals before a goalkeeper enters must not remove their clean sheet");


const sameMinuteEntryLedger = {
  score: { for: 0, against: 1 },
  player: { minutes: 30, goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0,
    fouls: 0, saves: 0, cleanSheet: false, redCards: 0, yellowCards: 0, injuryDays: 0 },
  events: [
    { type: "substitution-on", side: "player", minute: 60 },
    { type: "goal", side: "opponent", minute: 60 }
  ],
  outcome: "خسارة", matchOutcome: "خسارة",
  metadata: { position: "قلب دفاع", aggregateOffset: 0 }
};
assert.equal(engine.validateResult(sameMinuteEntryLedger).ok, true,
  "a same-minute opponent goal must validate when the substitute entry is ordered first");
const goalBeforeEntry = { ...sameMinuteEntryLedger, events: [...sameMinuteEntryLedger.events].reverse() };
const goalBeforeEntryValidation = engine.validateResult(goalBeforeEntry);
assert.equal(goalBeforeEntryValidation.sameMinuteOrderConsistent, false,
  "the ledger validator must detect a same-minute goal placed before the player's entry");
assert.equal(goalBeforeEntryValidation.ok, false,
  "a goal ordered before a same-minute substitute entry must invalidate the ledger");
assert.equal(browserEngine.validateResult(goalBeforeEntry).sameMinuteOrderConsistent, false,
  "the embedded browser validator must reject the same entry-order corruption");

const sameMinuteExitLedger = {
  ...sameMinuteEntryLedger,
  player: { ...sameMinuteEntryLedger.player, minutes: 60 },
  events: [
    { type: "goal", side: "opponent", minute: 60 },
    { type: "substitution", side: "player", minute: 60 }
  ]
};
assert.equal(engine.validateResult(sameMinuteExitLedger).ok, true,
  "a same-minute concession must precede the player's exit event");
const goalAfterExit = { ...sameMinuteExitLedger, events: [...sameMinuteExitLedger.events].reverse() };
assert.equal(engine.validateResult(goalAfterExit).sameMinuteOrderConsistent, false,
  "the ledger validator must detect a same-minute goal placed after the player's exit");
assert.equal(browserEngine.validateResult(goalAfterExit).ok, false,
  "the embedded browser validator must reject the same exit-order corruption");

console.log("PASS: " + tested + " deterministic position cases and defensive-action profiles, " + exitSweep + " injury/red-card exit regressions, and source/deployed-engine parity.");
