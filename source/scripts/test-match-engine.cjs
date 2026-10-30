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
const earlierDismissalBeforeRecordedSubstitution = [
  { type: "goal", side: "opponent", minute: 54 },
  { type: "goal", side: "opponent", minute: 58 },
  { type: "substitution", side: "player", minute: 60 }
];
assert.equal(engine.playerConcededGoals(90, earlierDismissalBeforeRecordedSubstitution, 55), 1,
  "an explicit earlier dismissal must stop concession attribution even when a later substitution event exists");
assert.equal(browserEngine.playerConcededGoals(90, earlierDismissalBeforeRecordedSubstitution, 55), 1,
  "the embedded engine must prefer the earliest exit minute when an explicit dismissal and later exit event are both supplied");

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

// Integration regression: a player who reaches the regulation whistle stays involved in extra time.
let extraTimeParticipation = null;
let extraTimeParticipationOptions = null;
for (let seed = 150001; seed < 151501 && !extraTimeParticipation; seed += 1) {
  const options = {
    seed, knockout: true, teamPower: 65, opponentPower: 65,
    player: {
      name: "اختبار مشاركة اللاعب في الوقت الإضافي", position: "قلب دفاع", role: "أساسي",
      shooting: 65, passing: 65, vision: 65, composure: 70, fitness: 100, trust: 100,
      energy: 100, fatigue: 0, speed: 70, physical: 72, dribbling: 60
    }
  };
  const result = engine.simulateMatch(options);
  const dismissedOrInjured = result.events.some(event => event.side === "player"
    && ["red-card", "injury"].includes(event.type));
  const extraTimeContribution = result.events.some(event => Number(event.minute) > 90
    && (event.creditedToPlayer === true
      || (event.side === "player" && ["tackle", "interception", "foul", "save"].includes(event.type))));
  if (result.extraTime.played && result.player.minutes > 90 && !dismissedOrInjured && extraTimeContribution) {
    extraTimeParticipation = result;
    extraTimeParticipationOptions = options;
  }
}
assert.ok(extraTimeParticipation, "a deterministic knockout sample must include player activity during extra time");
assert.equal(extraTimeParticipation.player.minutes, 120,
  "a player who completes regulation without dismissal or injury must receive 30 extra-time minutes");
assert.ok(!extraTimeParticipation.events.some(event => event.type === "substitution"
  && event.side === "player" && Number(event.minute) === 90),
  "an eligible player must not be recorded as substituted at the regulation whistle");
assert.ok(extraTimeParticipation.events.some(event => Number(event.minute) > 90
  && (event.creditedToPlayer === true || (event.side === "player"
    && ["tackle", "interception", "foul", "save"].includes(event.type)))),
  "player contributions must be recorded inside the extra-time periods");
assert.equal(JSON.stringify(browserEngine.simulateMatch(extraTimeParticipationOptions)), JSON.stringify(extraTimeParticipation),
  "the embedded browser engine must match extra-time player participation");
const extraTimeConcessions = extraTimeParticipation.events.filter(event => event.type === "goal"
  && event.side === "opponent").length;
assert.equal(engine.playerConcededGoals(extraTimeParticipation.player.minutes, extraTimeParticipation.events),
  extraTimeConcessions,
  "a player who stays on the pitch must be accountable for goals conceded during extra time");
assert.equal(engine.validateResult(extraTimeParticipation).ok, true,
  "extra-time player activity and extended minutes must remain internally consistent");

let extraTimePeriodLedgerProbe = null;
for (let seed = 151501; seed < 156501 && !extraTimePeriodLedgerProbe; seed += 1) {
  const result = engine.simulateMatch({
    seed, knockout: true, teamPower: 65, opponentPower: 65,
    player: { name: "اختبار توزيع أهداف الوقت الإضافي", position: "قلب دفاع", role: "أساسي",
      shooting: 65, passing: 65, vision: 65, composure: 70, fitness: 100, trust: 100,
      energy: 100, fatigue: 0, speed: 70, physical: 72, dribbling: 60 }
  });
  const periods = result.extraTime && result.extraTime.periods;
  if (result.extraTime.played && Array.isArray(periods) && periods.length === 2
    && (Number(periods[0].for) !== Number(periods[1].for)
      || Number(periods[0].against) !== Number(periods[1].against))) {
    extraTimePeriodLedgerProbe = result;
  }
}
assert.ok(extraTimePeriodLedgerProbe,
  "a deterministic knockout sample must contain an extra-time goal in only one period");
assert.equal(engine.validateResult(extraTimePeriodLedgerProbe).extraTimePeriodLedgerConsistent, true,
  "the source validator must accept correctly attributed first/second-period goal totals");
assert.equal(browserEngine.validateResult(extraTimePeriodLedgerProbe).extraTimePeriodLedgerConsistent, true,
  "the embedded validator must accept correctly attributed extra-time period totals");

const mismatchedExtraTimePeriods = JSON.parse(JSON.stringify(extraTimePeriodLedgerProbe));
const mismatchedField = ["for", "against"].find(field =>
  Number(mismatchedExtraTimePeriods.extraTime.periods[0][field])
    !== Number(mismatchedExtraTimePeriods.extraTime.periods[1][field]));
assert.ok(mismatchedField, "the period-ledger fixture must expose a side-specific period difference");
const firstPeriodValue = mismatchedExtraTimePeriods.extraTime.periods[0][mismatchedField];
mismatchedExtraTimePeriods.extraTime.periods[0][mismatchedField]
  = mismatchedExtraTimePeriods.extraTime.periods[1][mismatchedField];
mismatchedExtraTimePeriods.extraTime.periods[1][mismatchedField] = firstPeriodValue;
const sourcePeriodMismatch = engine.validateResult(mismatchedExtraTimePeriods);
assert.equal(sourcePeriodMismatch.ok, false,
  "the source validator must reject goals assigned to the wrong extra-time period");
assert.equal(sourcePeriodMismatch.extraTimePeriodLedgerConsistent, false,
  "the source validator must expose an extra-time period attribution mismatch");
const browserPeriodMismatch = browserEngine.validateResult(mismatchedExtraTimePeriods);
assert.equal(browserPeriodMismatch.ok, false,
  "the embedded validator must reject the same wrong-period goal ledger");
assert.equal(browserPeriodMismatch.extraTimePeriodLedgerConsistent, false,
  "the embedded validator must expose the same period attribution mismatch");

const legacyExtraTimeWithoutPeriods = JSON.parse(JSON.stringify(extraTimePeriodLedgerProbe));
delete legacyExtraTimeWithoutPeriods.extraTime.periods;
assert.equal(engine.validateResult(legacyExtraTimeWithoutPeriods).ok, true,
  "legacy extra-time records without per-period metadata must remain valid");
assert.equal(browserEngine.validateResult(legacyExtraTimeWithoutPeriods).ok, true,
  "the embedded validator must preserve legacy extra-time records without per-period metadata");

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
    assert.ok(first.player.minutes >= 0 && first.player.minutes <= (first.extraTime.played ? 120 : 90), "player minutes must stay within the played match periods");
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
// Contract labels must translate into believable playing-time patterns.
const starRoleRuns = [];
for (let seed = 241000; seed < 241040; seed += 1) {
  const star = engine.simulateMatch({
    ...substituteOptions, seed,
    player: { ...substituteOptions.player, role: "نجم الفريق", position: "رأس حربة",
      trust: 95, fitness: 95, energy: 95, fatigue: 0 }
  });
  assert.equal(star.events.some(event => event.type === "substitution-on" && event.side === "player"), false,
    "a star-player contract must start the player, not treat him as an impact substitute");
  assert.equal(engine.validateResult(star).ok, true, "star-player appearances must remain valid");
  starRoleRuns.push(star.player.minutes);
}
assert.ok(starRoleRuns.reduce((sum, value) => sum + value, 0) / starRoleRuns.length >= 82,
  "a star player should receive near-full-match minutes on average");

const prospectRole = engine.simulateMatch({
  ...substituteOptions, seed: 24061032,
  player: { ...substituteOptions.player, role: "لاعب ناشئ", position: "رأس حربة",
    trust: 70, fitness: 90, energy: 95, fatigue: 0 }
});
assert.ok(prospectRole.events.some(event => event.type === "substitution-on" && event.side === "player"),
  "a prospect role must be treated as a late substitute even without the word بديل");
assert.ok(engine.validateResult(prospectRole).ok, "prospect cameo must keep a valid event ledger");

let rotationBenchAppearances = 0;
let rotationStarts = 0;
for (let seed = 310000; seed < 310160; seed += 1) {
  const rotated = engine.simulateMatch({
    ...substituteOptions, seed,
    player: { ...substituteOptions.player, role: "تناوب", position: "رأس حربة",
      trust: 80, fitness: 90, energy: 95, fatigue: 0 }
  });
  const entry = rotated.events.find(event => event.type === "substitution-on" && event.side === "player");
  if (entry) rotationBenchAppearances += 1;
  else rotationStarts += 1;
  assert.equal(engine.validateResult(rotated).ok, true,
    "both rotation starts and substitute appearances must pass match validation");
}
assert.ok(rotationBenchAppearances >= 70 && rotationBenchAppearances <= 110,
  "a rotation role should produce a healthy mix, with more substitute appearances than starts");
assert.ok(rotationStarts >= 25,
  "a rotation player must still receive occasional starts");

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

// Event-minute validation must inspect the first event too and reject impossible timelines.
const minuteValidationBase = {
  score: { for: 0, against: 0 },
  player: { minutes: 0, goals: 0, assists: 0, shots: 0, tackles: 0, interceptions: 0, fouls: 0,
    saves: 0, cleanSheet: false, redCards: 0, yellowCards: 0, injuryDays: 0 },
  events: [], outcome: "تعادل", matchOutcome: "تعادل",
  extraTime: { played: false, for: 0, against: 0, periods: [] },
  shootout: { used: false, won: null, scoreFor: 0, scoreAgainst: 0 },
  metadata: { position: "مهاجم", aggregateOffset: 0 }
};

// Older saved match ledgers may store valid player counters as numeric strings.
const numericStringPlayerStats = {
  ...minuteValidationBase,
  player: { ...minuteValidationBase.player, goals: "0", assists: "0", shots: "0" }
};
for (const targetEngine of [engine, browserEngine]) {
  assert.equal(targetEngine.validateResult(numericStringPlayerStats).ok, true,
    "valid numeric-string goal, assist, and shot counters must remain compatible with legacy saves");
}

// Match scores from older saves may also be serialized as numeric strings.
const numericStringScore = { ...minuteValidationBase, score: { for: "0", against: "0" } };
for (const targetEngine of [engine, browserEngine]) {
  assert.equal(targetEngine.validateResult(numericStringScore).ok, true,
    "valid numeric-string final scores must remain compatible with legacy saves");
}
const invalidScoreValues = [
  { for: null, against: 0 }, { for: "", against: 0 }, { for: "Infinity", against: 0 },
  { for: -1, against: 0 }, { for: 0.5, against: 0 }, { for: true, against: 0 }
];
for (const score of invalidScoreValues) {
  for (const targetEngine of [engine, browserEngine]) {
    const validation = targetEngine.validateResult({ ...minuteValidationBase, score });
    assert.equal(validation.ok, false, "malformed match scores must be rejected");
    assert.equal(validation.reason, "invalid-score", "malformed match scores should report a clear reason");
  }
}

const invalidFirstMinute = { ...minuteValidationBase,
  events: [{ type: "foul", side: "opponent", minute: "not-a-minute" }] };
assert.equal(engine.validateResult(invalidFirstMinute).ok, false,
  "a malformed minute on the first event must not bypass chronological validation");
assert.equal(browserEngine.validateResult(invalidFirstMinute).ok, false,
  "the embedded validator must reject a malformed first event minute");
const emptyMinute = { ...minuteValidationBase, events: [{ type: "foul", side: "opponent", minute: "" }] };
const booleanMinute = { ...minuteValidationBase, events: [{ type: "foul", side: "opponent", minute: true }] };
const zeroMinute = { ...minuteValidationBase, events: [{ type: "foul", side: "opponent", minute: 0 }] };
for (const invalidMinute of [emptyMinute, booleanMinute, zeroMinute]) {
  assert.equal(engine.validateResult(invalidMinute).ok, false,
    "empty strings and booleans must not be coerced into valid event minutes");
  assert.equal(browserEngine.validateResult(invalidMinute).ok, false,
    "the embedded validator must reject nonnumeric minute values");
}
const regulationEventInExtraTime = { ...minuteValidationBase,
  events: [{ type: "foul", side: "opponent", minute: 105 }] };
assert.equal(engine.validateResult(regulationEventInExtraTime).ok, false,
  "events after minute 90 must be rejected when extra time was not played");
assert.equal(browserEngine.validateResult(regulationEventInExtraTime).ok, false,
  "the embedded validator must reject extra-time events without an extra-time period");
const validExtraTimeEvent = { ...minuteValidationBase,
  extraTime: { played: true, for: 0, against: 0, periods: [{ for: 0, against: 0 }, { for: 0, against: 0 }] },
  events: [{ type: "foul", side: "opponent", minute: 105 }] };
assert.equal(engine.validateResult(validExtraTimeEvent).ok, true,
  "valid extra-time events must remain accepted");
assert.equal(browserEngine.validateResult(validExtraTimeEvent).ok, true,
  "the embedded validator must accept valid extra-time events");
const beyondMaximumMinute = { ...validExtraTimeEvent,
  events: [{ type: "foul", side: "opponent", minute: 121 }] };
assert.equal(engine.validateResult(beyondMaximumMinute).ok, false,
  "the ledger must reject events beyond the 120th minute");
assert.equal(browserEngine.validateResult(beyondMaximumMinute).ok, false,
  "the embedded validator must reject events beyond the 120th minute");
const shootoutAtRegulationMinute = { ...minuteValidationBase,
  events: [{ type: "penalty-shootout", side: "team", minute: 90, won: true }],
  shootout: { used: false, won: null, scoreFor: 0, scoreAgainst: 0 }
};
assert.equal(engine.validateResult(shootoutAtRegulationMinute).ok, false,
  "a penalty-shootout event must not be accepted at a regulation-time minute");
assert.equal(browserEngine.validateResult(shootoutAtRegulationMinute).ok, false,
  "the embedded validator must reject shootout events at regulation-time minutes");
const validShootoutEvent = { ...minuteValidationBase,
  events: [{ type: "penalty-shootout", side: "team", minute: 120, won: true, scoreFor: 5, scoreAgainst: 4 }],
  outcome: "فوز", matchOutcome: "فوز",
  regulation: { for: 0, against: 0 },
  extraTime: { played: true, for: 0, against: 0,
    periods: [{ for: 0, against: 0 }, { for: 0, against: 0 }] },
  shootout: { used: true, won: true, scoreFor: 5, scoreAgainst: 4 }
};
assert.equal(engine.validateResult(validShootoutEvent).ok, true,
  "a shootout event at minute 120 must remain valid when the shootout was used");
assert.equal(browserEngine.validateResult(validShootoutEvent).ok, true,
  "the embedded validator must accept a valid shootout event");
const shootoutWithoutExtraTime = {
  ...validShootoutEvent,
  extraTime: { played: false, for: 0, against: 0, periods: [] }
};
const shootoutWithAggregateLead = {
  ...validShootoutEvent,
  metadata: { ...validShootoutEvent.metadata, aggregateOffset: 1 }
};
const shootoutWithAggregateDeficit = {
  ...validShootoutEvent,
  metadata: { ...validShootoutEvent.metadata, aggregateOffset: -1 },
  outcome: "خسارة", matchOutcome: "فوز"
};
const shootoutWithInvalidAggregateOffset = {
  ...validShootoutEvent,
  metadata: { ...validShootoutEvent.metadata, aggregateOffset: "" }
};
const shootoutCreditedToOpponent = {
  ...validShootoutEvent,
  events: [{ ...validShootoutEvent.events[0], side: "opponent" }]
};
for (const targetEngine of [engine, browserEngine]) {
  for (const invalidShootout of [
    shootoutWithoutExtraTime, shootoutWithAggregateLead, shootoutWithAggregateDeficit,
    shootoutWithInvalidAggregateOffset
  ]) {
    assert.equal(targetEngine.validateResult(invalidShootout).shootoutLedgerConsistent, false,
      "shootouts require extra time and a level aggregate");
    assert.equal(targetEngine.validateResult(invalidShootout).ok, false,
      "ineligible shootouts must be rejected");
  }
  const wrongSideValidation = targetEngine.validateResult(shootoutCreditedToOpponent);
  assert.equal(wrongSideValidation.ok, false,
    "a shootout result attributed to the opponent must be rejected");
  assert.equal(wrongSideValidation.reason, "invalid-event-side",
    "the shared event-side validator must report an invalid shootout side");
}
const legacyShootoutWithoutDeciderMetadata = { ...validShootoutEvent };
delete legacyShootoutWithoutDeciderMetadata.extraTime;
delete legacyShootoutWithoutDeciderMetadata.regulation;
for (const targetEngine of [engine, browserEngine]) {
  assert.equal(targetEngine.validateResult(legacyShootoutWithoutDeciderMetadata).ok, true,
    "legacy shootout saves without regulation/extra-time ledger fields must remain readable");
}
function makeAggregateOffsetFixture(targetEngine, seed) {
  const match = targetEngine.simulateMatch({
    seed,
    player: { name: "Aggregate Offset Regression", position: "وسط مهاجم", role: "أساسي",
      shooting: 65, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
  });
  assert.equal(match.shootout.used, false, "aggregate-offset fixture must not require a shootout");
  return match;
}
function setExpectedAggregateOutcome(match, offset) {
  match.metadata.aggregateOffset = offset;
  const margin = Number(offset) + Number(match.score.for) - Number(match.score.against);
  match.outcome = margin > 0 ? "فوز" : margin < 0 ? "خسارة" : "تعادل";
  return match;
}
for (const [targetEngine, label, seed] of [
  [engine, "source", 872001],
  [browserEngine, "browser", 872001]
]) {
  for (const numericString of ["1", "-1"]) {
    const legacyNumericStringOffset = setExpectedAggregateOutcome(
      makeAggregateOffsetFixture(targetEngine, seed), numericString);
    const numericStringValidation = targetEngine.validateResult(legacyNumericStringOffset);
    assert.equal(numericStringValidation.ok, true,
      label + " validator must preserve integer-valued numeric-string aggregate offsets");
    assert.equal(numericStringValidation.aggregateOffsetConsistent, true,
      label + " validator must report integer-valued numeric-string aggregate offsets as consistent");
  }

  const nullAggregateOffset = makeAggregateOffsetFixture(targetEngine, seed + 1);
  nullAggregateOffset.metadata.aggregateOffset = null;
  assert.equal(targetEngine.validateResult(nullAggregateOffset).ok, true,
    label + " validator must treat a null aggregate offset as absent for legacy compatibility");

  for (const invalidValue of [
    "", " ", "Infinity", "1.5", true, false, 1.5, Infinity, -Infinity, NaN,
    9007199254740992, [], {}
  ]) {
    const malformedOffset = makeAggregateOffsetFixture(targetEngine, seed + 2);
    malformedOffset.metadata.aggregateOffset = invalidValue;
    const validation = targetEngine.validateResult(malformedOffset);
    assert.equal(validation.ok, false,
      label + " validator must reject malformed aggregate offsets on non-shootout results: " + String(invalidValue));
    assert.equal(validation.reason, "invalid-aggregate-offset",
      label + " validator must return a stable invalid aggregate-offset reason");
    assert.equal(validation.aggregateOffsetConsistent, false,
      label + " validator must expose malformed aggregate offsets");
  }
}

const legacyShootoutWithUnflaggedExtraTime = {
  ...validShootoutEvent,
  metadata: { position: "مهاجم" },
  extraTime: { for: 0, against: 0 }
};
delete legacyShootoutWithUnflaggedExtraTime.regulation;
for (const targetEngine of [engine, browserEngine]) {
  assert.equal(targetEngine.validateResult(legacyShootoutWithUnflaggedExtraTime).ok, true,
    "legacy shootout saves with unflagged extra-time scores must remain readable");
}


const shootoutWinnerContradiction = {
  ...validShootoutEvent,
  shootout: { ...validShootoutEvent.shootout, won: false },
  outcome: "خسارة", matchOutcome: "خسارة"
};
const mismatchedShootoutEvent = {
  ...validShootoutEvent,
  events: [{ ...validShootoutEvent.events[0], won: false, scoreFor: 4, scoreAgainst: 5 }]
};
const missingShootoutEvent = { ...validShootoutEvent, events: [] };
const unusedShootoutWithScores = {
  ...minuteValidationBase,
  shootout: { used: false, won: null, scoreFor: 5, scoreAgainst: 4 }
};
for (const targetEngine of [engine, browserEngine]) {
  for (const invalidShootout of [
    shootoutWinnerContradiction, mismatchedShootoutEvent,
    missingShootoutEvent, unusedShootoutWithScores
  ]) {
    const validation = targetEngine.validateResult(invalidShootout);
    assert.equal(validation.shootoutLedgerConsistent, false,
      "shootout winner, score, used flag, and event record must agree");
    assert.equal(validation.ok, false,
      "contradictory shootout ledgers must be rejected by source and browser validators");
  }
}

// Extra-time metadata must reconcile with the actual event ledger and final score.
const validExtraTimeGoal = {
  ...minuteValidationBase,
  score: { for: 1, against: 0 },
  regulation: { for: 0, against: 0 },
  events: [
    { type: "shot", minute: 105, side: "team", onTarget: true,
      shooter: "teammate", creditedToPlayer: false },
    { type: "goal", goalEventId: "et-goal-1", minute: 105, side: "team",
      scorer: "teammate", creditedToPlayer: false }
  ],
  outcome: "فوز", matchOutcome: "فوز",
  extraTime: { played: true, for: 1, against: 0,
    periods: [{ for: 1, against: 0 }, { for: 0, against: 0 }] }
};
assert.equal(engine.validateResult(validExtraTimeGoal).ok, true,
  "consistent extra-time goal events, period totals, and final score must validate");
assert.equal(browserEngine.validateResult(validExtraTimeGoal).ok, true,
  "the embedded engine must accept a consistent extra-time ledger");
const malformedExtraTimePlayedFlag = {
  ...minuteValidationBase,
  extraTime: { ...minuteValidationBase.extraTime, played: "false" }
};
const malformedExtraTimeArray = { ...minuteValidationBase, extraTime: [] };
const malformedExtraTimeContainer = { ...minuteValidationBase, extraTime: "false" };
const legacyExtraTimeObjectWithoutPlayedFlag = { ...minuteValidationBase, extraTime: {} };
const nullExtraTimeLegacy = { ...minuteValidationBase, extraTime: null };
for (const targetEngine of [engine, browserEngine]) {
  for (const malformedExtraTime of [
    malformedExtraTimePlayedFlag, malformedExtraTimeArray, malformedExtraTimeContainer
  ]) {
    const validation = targetEngine.validateResult(malformedExtraTime);
    assert.equal(validation.extraTimeLedgerConsistent, false,
      "extra-time metadata must reject non-boolean played flags and non-object containers");
    assert.equal(validation.ok, false,
      "malformed extra-time flags, arrays, and primitive containers must be rejected");
  }
  assert.equal(targetEngine.validateResult(legacyExtraTimeObjectWithoutPlayedFlag).ok, true,
    "legacy extra-time objects without a played flag must remain compatible");
  assert.equal(targetEngine.validateResult(nullExtraTimeLegacy).ok, true,
    "legacy null extra-time metadata must retain its previous absent-metadata behavior");
}
const missingExtraTimePeriods = { ...validExtraTimeGoal,
  extraTime: { ...validExtraTimeGoal.extraTime, periods: [] } };
assert.equal(engine.validateResult(missingExtraTimePeriods).extraTimeLedgerConsistent, false,
  "an explicitly empty period list cannot describe a played extra time");
assert.equal(engine.validateResult(missingExtraTimePeriods).ok, false,
  "the source validator must reject missing extra-time periods");
assert.equal(browserEngine.validateResult(missingExtraTimePeriods).ok, false,
  "the embedded validator must reject missing extra-time periods");
const mismatchedExtraTimeGoals = { ...validExtraTimeGoal,
  extraTime: { played: true, for: 0, against: 0,
    periods: [{ for: 0, against: 0 }, { for: 0, against: 0 }] }
};
assert.equal(engine.validateResult(mismatchedExtraTimeGoals).ok, false,
  "extra-time score metadata must match goals recorded in the event ledger");
assert.equal(browserEngine.validateResult(mismatchedExtraTimeGoals).ok, false,
  "the embedded validator must reject extra-time score/event mismatches");
const mismatchedFinalScore = { ...validExtraTimeGoal, regulation: { for: 1, against: 0 } };
assert.equal(engine.validateResult(mismatchedFinalScore).ok, false,
  "the final score must equal regulation plus extra-time scores");
assert.equal(browserEngine.validateResult(mismatchedFinalScore).ok, false,
  "the embedded validator must reject a final score that omits or double-counts extra time");

// Regulation-only results must reconcile regulation metadata with the final score,
// whether extraTime metadata is explicitly absent or records that extra time was not played.
const validRegulationOnly = { ...minuteValidationBase, regulation: { for: 0, against: 0 } };
assert.equal(engine.validateResult(validRegulationOnly).ok, true,
  "a consistent regulation-only result must remain valid");
assert.equal(browserEngine.validateResult(validRegulationOnly).ok, true,
  "the embedded validator must accept a consistent regulation-only result");

const mismatchedRegulationWithoutExtraTime = {
  ...minuteValidationBase, regulation: { for: 1, against: 0 }
};
for (const targetEngine of [engine, browserEngine]) {
  const validation = targetEngine.validateResult(mismatchedRegulationWithoutExtraTime);
  assert.equal(validation.extraTimeLedgerConsistent, false,
    "regulation and final score mismatch must invalidate the ledger without extra time");
  assert.equal(validation.ok, false,
    "the validator must reject mismatched regulation metadata when extraTime is present but not played");
}
const mismatchedRegulationWithMissingExtraTime = { ...mismatchedRegulationWithoutExtraTime };
delete mismatchedRegulationWithMissingExtraTime.extraTime;
for (const targetEngine of [engine, browserEngine]) {
  assert.equal(targetEngine.validateResult(mismatchedRegulationWithMissingExtraTime).ok, false,
    "the validator must reject mismatched regulation metadata when extraTime metadata is absent");
}

const malformedRegulationArrayWithExtraTime = { ...validExtraTimeGoal, regulation: [] };
const malformedRegulationStringWithExtraTime = { ...validExtraTimeGoal, regulation: "0-0" };
const malformedRegulationBooleanWithoutExtraTime = { ...validRegulationOnly, regulation: false };
const malformedPartialRegulation = { ...validExtraTimeGoal, regulation: { for: 0 } };
const legacyEmptyRegulationWithExtraTime = { ...validExtraTimeGoal, regulation: {} };
const legacyMissingRegulationWithExtraTime = { ...validExtraTimeGoal };
delete legacyMissingRegulationWithExtraTime.regulation;
const legacyNullRegulationWithExtraTime = { ...validExtraTimeGoal, regulation: null };
const legacyEmptyRegulationWithoutExtraTime = { ...validRegulationOnly, regulation: {} };
for (const targetEngine of [engine, browserEngine]) {
  for (const malformedRegulation of [
    malformedRegulationArrayWithExtraTime,
    malformedRegulationStringWithExtraTime,
    malformedRegulationBooleanWithoutExtraTime,
    malformedPartialRegulation
  ]) {
    const validation = targetEngine.validateResult(malformedRegulation);
    assert.equal(validation.extraTimeLedgerConsistent, false,
      "present regulation metadata must be a non-array object with either both valid scores or neither");
    assert.equal(validation.ok, false,
      "array, primitive, and partial regulation metadata must be rejected");
  }
  assert.equal(targetEngine.validateResult(legacyEmptyRegulationWithExtraTime).ok, true,
    "legacy empty regulation objects must remain compatible with extra time");
  assert.equal(targetEngine.validateResult(legacyMissingRegulationWithExtraTime).ok, true,
    "legacy records without regulation metadata must remain compatible with extra time");
  assert.equal(targetEngine.validateResult(legacyNullRegulationWithExtraTime).ok, true,
    "legacy null regulation metadata must remain compatible with extra time");
  assert.equal(targetEngine.validateResult(legacyEmptyRegulationWithoutExtraTime).ok, true,
    "legacy empty regulation objects must remain compatible without extra time");
}

const malformedExtraTimePeriodScore = { ...validExtraTimeGoal,
  extraTime: { ...validExtraTimeGoal.extraTime,
    periods: [{ for: null, against: 0 }, { for: 1, against: 0 }] }
};
assert.equal(engine.validateResult(malformedExtraTimePeriodScore).ok, false,
  "null period scores must not be coerced to zero");
assert.equal(browserEngine.validateResult(malformedExtraTimePeriodScore).ok, false,
  "the embedded validator must reject null period scores");

const malformedStoryInput = {
  score: { for: Infinity, against: "-Infinity" },
  player: {
    minutes: Infinity, goals: -Infinity, assists: "Infinity", rating: NaN,
    averageRating: 8.2, shots: Infinity, fouls: "Infinity", redCards: Infinity,
    yellowCards: -Infinity, injuryDays: Infinity, tackles: Infinity,
    interceptions: "Infinity", saves: NaN, cleanSheet: true
  },
  events: [
    null,
    { minute: Infinity, type: "goal", side: "team" },
    { minute: "7", type: "shot", side: "player", text: "تسديدة" }
  ],
  metadata: { aggregateOffset: Infinity, nested: { bad: -Infinity }, samples: [1, NaN, Infinity] }
};
const malformedStoryReport = engine.buildStoryReport(malformedStoryInput, { season: Infinity, week: "Infinity" });
assert.equal(malformedStoryReport.season, 1, "non-finite story seasons must fall back to a safe default");
assert.equal(malformedStoryReport.week, 1, "non-finite story weeks must fall back to a safe default");
assert.deepEqual(malformedStoryReport.score, { for: 0, against: 0 },
  "non-finite score values must not leak into story reports");
assert.deepEqual(malformedStoryReport.player, {
  minutes: 0, goals: 0, assists: 0, rating: 0, shots: 0, fouls: 0,
  redCards: 0, yellowCards: 0, injuryDays: 0, tackles: 0, tacklesWon: 0,
  interceptions: 0, saves: 0, penaltiesSaved: 0, clearances: 0, ballRecoveries: 0,
  passAttempts: 0, passesCompleted: 0, passingAccuracy: 0, cleanSheet: true
}, "all player numeric fields in story reports must be finite");
assert.deepEqual(malformedStoryReport.events, [
  { minute: 0, type: "goal", side: "team", description: "" },
  { minute: 7, type: "shot", side: "player", description: "تسديدة" }
], "malformed event entries must be skipped and non-finite event minutes normalized");
assert.deepEqual(malformedStoryReport.metadata, {
  aggregateOffset: null, nested: { bad: null }, samples: [1, null, null]
}, "nested non-finite metadata values must be converted to JSON-safe nulls");
assert.equal(JSON.stringify(malformedStoryReport).includes("Infinity"), false,
  "serialized story reports must not contain non-finite numeric values");
assert.equal(JSON.stringify(browserEngine.buildStoryReport(malformedStoryInput, { season: Infinity, week: "Infinity" })),
  JSON.stringify(malformedStoryReport), "the embedded browser report must match the sanitized source report");
const validStoryReport = engine.buildStoryReport({
  score: { for: "2", against: 1 },
  player: { minutes: "90", goals: 1, averageRating: "7.4" },
  events: [{ minute: "88", type: "goal", side: "team", text: "هدف" }],
  metadata: { seed: 42, aggregateOffset: 1 }
}, { season: "3", day: "12" });
assert.equal(validStoryReport.score.for, 2, "valid numeric strings must remain compatible with saved reports");
assert.equal(validStoryReport.player.rating, 7.4, "legacy averageRating must remain supported");
assert.equal(validStoryReport.week, 12, "day remains the fallback for legacy story week values");
assert.equal(JSON.stringify(browserEngine.buildStoryReport({
  score: { for: "2", against: 1 },
  player: { minutes: "90", goals: 1, averageRating: "7.4" },
  events: [{ minute: "88", type: "goal", side: "team", text: "هدف" }],
  metadata: { seed: 42, aggregateOffset: 1 }
}, { season: "3", day: "12" })), JSON.stringify(validStoryReport),
  "the embedded browser report must preserve valid legacy report values");


const malformedEventEntryMatch = engine.simulateMatch({
  seed: 8128,
  player: { name: "Regression Player", position: "مهاجم", role: "أساسي",
    shooting: 65, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
});
malformedEventEntryMatch.events.push(null);
const malformedEventEntryValidation = engine.validateResult(malformedEventEntryMatch);
assert.equal(malformedEventEntryValidation.ok, false,
  "the validator must reject malformed event entries without throwing");
assert.equal(malformedEventEntryValidation.reason, "invalid-event-entry",
  "malformed event entries must return a specific validation reason");

const malformedBrowserEventMatch = browserEngine.simulateMatch({
  seed: 8128,
  player: { name: "Regression Player", position: "مهاجم", role: "أساسي",
    shooting: 65, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
});
malformedBrowserEventMatch.events.push(null);
const malformedBrowserEventValidation = browserEngine.validateResult(malformedBrowserEventMatch);
assert.equal(malformedBrowserEventValidation.ok, false,
  "the embedded browser validator must reject malformed event entries without throwing");
assert.equal(malformedBrowserEventValidation.reason, "invalid-event-entry",
  "the embedded browser validator must return the same malformed-entry reason");

const unsupportedEventTypeMatch = engine.simulateMatch({
  seed: 8129,
  player: { name: "Regression Player", position: "مهاجم", role: "أساسي",
    shooting: 65, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
});
unsupportedEventTypeMatch.events.push({ type: "unrecognized-event", minute: 45, side: "team" });
const unsupportedEventTypeValidation = engine.validateResult(unsupportedEventTypeMatch);
assert.equal(unsupportedEventTypeValidation.ok, false,
  "the source validator must reject event types that the match engine does not emit");
assert.equal(unsupportedEventTypeValidation.reason, "invalid-event-type",
  "unsupported event types must return a stable validation reason");

const unsupportedBrowserEventMatch = browserEngine.simulateMatch({
  seed: 8129,
  player: { name: "Regression Player", position: "مهاجم", role: "أساسي",
    shooting: 65, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
});
unsupportedBrowserEventMatch.events.push({ type: "unrecognized-event", minute: 45, side: "team" });
const unsupportedBrowserEventValidation = browserEngine.validateResult(unsupportedBrowserEventMatch);
assert.equal(unsupportedBrowserEventValidation.ok, false,
  "the embedded browser validator must reject unsupported event types");
assert.equal(unsupportedBrowserEventValidation.reason, "invalid-event-type",
  "the embedded browser validator must return the same unsupported-type reason");

const invalidEventSideMatch = engine.simulateMatch({
  seed: 8131,
  player: { name: "Regression Player", position: "مهاجم", role: "أساسي",
    shooting: 65, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
});
invalidEventSideMatch.events.push({ type: "goal", minute: 45, side: "player" });
const invalidEventSideValidation = engine.validateResult(invalidEventSideMatch);
assert.equal(invalidEventSideValidation.ok, false,
  "the source validator must reject a goal assigned to the player side");
assert.equal(invalidEventSideValidation.reason, "invalid-event-side",
  "unsupported event-side combinations must return a stable validation reason");

const invalidBrowserEventSideMatch = browserEngine.simulateMatch({
  seed: 8132,
  player: { name: "Regression Player", position: "حارس مرمى", role: "أساسي",
    shooting: 15, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
});
invalidBrowserEventSideMatch.events.push({ type: "save", minute: 45, side: "opponent" });
const invalidBrowserEventSideValidation = browserEngine.validateResult(invalidBrowserEventSideMatch);
assert.equal(invalidBrowserEventSideValidation.ok, false,
  "the embedded browser validator must reject a save credited to the opponent side");
assert.equal(invalidBrowserEventSideValidation.reason, "invalid-event-side",
  "the embedded browser validator must return the same invalid-side reason");

const invalidPlayerStatCases = [
  ["rating", Infinity],
  ["minutes", Infinity],
  ["saves", Infinity],
  ["injuryDays", Infinity],
  ["tackles", -1],
  ["rating", "not-a-number"],
  ["minutes", 121],
  ["goals", 1.5],
  ["shotsOnTarget", Infinity],
  ["chances", -1],
  ["keyPasses", 1.5],
  ["shotsOnTarget", 999]
];
for (const [field, value] of invalidPlayerStatCases) {
  const sourcePlayerStatMatch = engine.simulateMatch({
    seed: 8133,
    player: { name: "Regression Player", position: "مهاجم", role: "أساسي",
      shooting: 65, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
  });
  sourcePlayerStatMatch.player[field] = value;
  const sourcePlayerStatValidation = engine.validateResult(sourcePlayerStatMatch);
  assert.equal(sourcePlayerStatValidation.ok, false,
    "the source validator must reject malformed player stat " + field);
  assert.equal(sourcePlayerStatValidation.reason, "invalid-player-stats",
    "malformed player stats must return a stable validation reason");

  const browserPlayerStatMatch = browserEngine.simulateMatch({
    seed: 8133,
    player: { name: "Regression Player", position: "مهاجم", role: "أساسي",
      shooting: 65, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
  });
  browserPlayerStatMatch.player[field] = value;
  const browserPlayerStatValidation = browserEngine.validateResult(browserPlayerStatMatch);
  assert.equal(browserPlayerStatValidation.ok, false,
    "the embedded browser validator must reject malformed player stat " + field);
  assert.equal(browserPlayerStatValidation.reason, "invalid-player-stats",
    "the embedded browser validator must return the same invalid-stat reason");
}

function makeShotOnTargetLedgerMatch(targetEngine, seed) {
  const match = targetEngine.simulateMatch({
    seed,
    player: { name: "Shot Ledger Regression", position: "مهاجم", role: "أساسي",
      shooting: 65, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
  });
  assert.ok(match.player.minutes > 0, "shot-ledger fixture must include a player appearance");
  const entry = match.events.find(event => event.type === "substitution-on" && event.side === "player");
  const exits = match.events.filter(event => event.side === "player"
    && ["red-card", "injury", "substitution"].includes(event.type))
    .sort((a, b) => Number(a.minute) - Number(b.minute));
  const startMinute = entry ? Number(entry.minute) : 0;
  const endMinute = exits.length ? Number(exits[0].minute) : startMinute + Number(match.player.minutes);
  const occupiedMinutes = new Set(match.events.map(event => Number(event.minute)));
  let minute = 0;
  for (let candidate = Math.max(1, startMinute + 1); candidate <= Math.min(120, endMinute); candidate += 1) {
    if (!occupiedMinutes.has(candidate)) { minute = candidate; break; }
  }
  assert.ok(minute > 0, "shot-ledger fixture must have an unused minute while the player is active");
  match.events.push({ type: "shot", minute, side: "team", shooter: "player",
    creditedToPlayer: true, onTarget: true });
  match.events.sort((a, b) => Number(a.minute) - Number(b.minute));
  match.player.shots += 1;
  match.player.chances += 1;
  match.player.shotsOnTarget += 1;
  return match;
}
for (const [targetEngine, seed, label] of [[engine, 8136, "source"], [browserEngine, 8137, "browser"]]) {
  const inconsistentShotTarget = makeShotOnTargetLedgerMatch(targetEngine, seed);
  inconsistentShotTarget.player.shotsOnTarget -= 1;
  const invalidShotTargetValidation = targetEngine.validateResult(inconsistentShotTarget);
  assert.equal(invalidShotTargetValidation.ok, false,
    label + " validator must reject shots-on-target counts that disagree with shot events");
  assert.equal(invalidShotTargetValidation.reason, "inconsistent-shot-on-target-ledger",
    label + " validator must return a stable shot-ledger reason");

  const legacyShotTarget = makeShotOnTargetLedgerMatch(targetEngine, seed);
  for (const event of legacyShotTarget.events) {
    if (event.type === "shot") delete event.onTarget;
  }
  assert.equal(targetEngine.validateResult(legacyShotTarget).ok, true,
    label + " validator must preserve legacy shot events without onTarget metadata");
}

function ensureShotTargetMetadataForLedger(match) {
  if (match.events.some(event => event.type === "shot"
    && Object.prototype.hasOwnProperty.call(event, "onTarget"))) return;
  const occupiedMinutes = new Set(match.events.map(event => Number(event.minute)));
  let minute = 1;
  while (minute <= 90 && occupiedMinutes.has(minute)) minute += 1;
  assert.ok(minute <= 90, "ledger regression fixture must have a free regulation minute");
  match.events.push({ type: "shot", minute, side: "opponent", shooter: "opponent",
    creditedToPlayer: false, onTarget: false });
  match.events.sort((a, b) => Number(a.minute) - Number(b.minute));
}
for (const [targetEngine, seed, label] of [[engine, 8140, "source"], [browserEngine, 8141, "browser"]]) {
  const inconsistentKeyPasses = targetEngine.simulateMatch({
    seed,
    player: { name: "Key Pass Ledger Regression", position: "مهاجم", role: "أساسي",
      shooting: 65, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
  });
  ensureShotTargetMetadataForLedger(inconsistentKeyPasses);
  inconsistentKeyPasses.player.keyPasses += 1;
  const keyPassValidation = targetEngine.validateResult(inconsistentKeyPasses);
  assert.equal(keyPassValidation.ok, false,
    label + " validator must reject key-pass totals that disagree with credited assists");
  assert.equal(keyPassValidation.reason, "inconsistent-key-pass-ledger",
    label + " validator must return a stable key-pass ledger reason");

  const inconsistentSaves = targetEngine.simulateMatch({
    seed: seed + 10,
    player: { name: "Save Ledger Regression", position: "حارس مرمى", role: "أساسي",
      shooting: 30, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
  });
  ensureShotTargetMetadataForLedger(inconsistentSaves);
  inconsistentSaves.player.saves += 1;
  const saveValidation = targetEngine.validateResult(inconsistentSaves);
  assert.equal(saveValidation.ok, false,
    label + " validator must reject save totals that disagree with save events");
  assert.equal(saveValidation.reason, "inconsistent-save-ledger",
    label + " validator must return a stable save ledger reason");

  const legacyStatsMatch = targetEngine.simulateMatch({
    seed: seed + 20,
    player: { name: "Legacy Ledger Regression", position: "مهاجم", role: "أساسي",
      shooting: 65, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
  });
  for (const event of legacyStatsMatch.events) {
    if (event.type === "shot") delete event.onTarget;
  }
  legacyStatsMatch.player.keyPasses += 1;
  legacyStatsMatch.player.saves += 1;
  assert.equal(targetEngine.validateResult(legacyStatsMatch).ok, true,
    label + " validator must preserve legacy match records without shot-target metadata");
}

function findModernAssistFixture(targetEngine, firstSeed, label) {
  for (let seed = firstSeed; seed < firstSeed + 1000; seed += 1) {
    const match = targetEngine.simulateMatch({
      seed, teamPower: 72, opponentPower: 64, tactic: "attack", opponentTactic: "balanced",
      player: { name: "Missing Assist Link Regression", position: "وسط مهاجم", role: "أساسي",
        shooting: 45, passing: 99, vision: 99, composure: 80, fitness: 100,
        trust: 100, energy: 100, fatigue: 0 }
    });
    const assistIndex = match.events.findIndex(event => event.type === "assist"
      && event.side === "team" && event.creditedToPlayer === true);
    const hasModernShotMetadata = match.events.some(event => event.type === "shot"
      && Object.prototype.hasOwnProperty.call(event, "onTarget"));
    if (assistIndex >= 0 && hasModernShotMetadata) return { match, assistIndex };
  }
  assert.fail(label + " fixture must contain a credited assist and modern shot metadata");
}
for (const [targetEngine, seed, label] of [[engine, 620000, "source"], [browserEngine, 620000, "browser"]]) {
  const fixture = findModernAssistFixture(targetEngine, seed, label);
  const modernMissingLink = JSON.parse(JSON.stringify(fixture.match));
  delete modernMissingLink.events[fixture.assistIndex].goalEventId;
  const modernValidation = targetEngine.validateResult(modernMissingLink);
  assert.equal(modernValidation.ok, false,
    label + " validator must reject a modern assist without a goalEventId");
  assert.equal(modernValidation.assistGoalLinksValid, false,
    label + " validator must report the missing modern assist link as inconsistent");

  const legacyMissingLink = JSON.parse(JSON.stringify(fixture.match));
  delete legacyMissingLink.events[fixture.assistIndex].goalEventId;
  for (const event of legacyMissingLink.events) {
    if (event.type === "shot") delete event.onTarget;
    if (event.type === "goal") {
      delete event.goalEventId;
      delete event.scorer;
    }
    if (event.type === "assist") delete event.goalEventId;
  }
  assert.equal(targetEngine.validateResult(legacyMissingLink).ok, true,
    label + " validator must preserve fully legacy assist/goal records without modern metadata");

  const modernGoalMetadataWithoutShotFlags = JSON.parse(JSON.stringify(fixture.match));
  for (const event of modernGoalMetadataWithoutShotFlags.events) {
    if (event.type === "shot") delete event.onTarget;
  }
  delete modernGoalMetadataWithoutShotFlags.events[fixture.assistIndex].goalEventId;
  const modernGoalLinkWithoutShotFlagsValidation = targetEngine.validateResult(modernGoalMetadataWithoutShotFlags);
  assert.equal(modernGoalLinkWithoutShotFlagsValidation.ok, false,
    label + " validator must not treat missing modern assist links as legacy when goal IDs remain");
  assert.equal(modernGoalLinkWithoutShotFlagsValidation.assistGoalLinksValid, false,
    label + " validator must enforce assist links when modern goal metadata remains");

  const duplicateAssistLink = JSON.parse(JSON.stringify(fixture.match));
  const originalAssist = duplicateAssistLink.events[fixture.assistIndex];
  assert.ok(originalAssist.goalEventId,
    label + " duplicate-assist fixture must start with an exact goal link");
  duplicateAssistLink.events.splice(fixture.assistIndex + 1, 0, { ...originalAssist });
  duplicateAssistLink.player.assists += 1;
  duplicateAssistLink.player.keyPasses += 1;
  const duplicateAssistValidation = targetEngine.validateResult(duplicateAssistLink);
  assert.equal(duplicateAssistValidation.ok, false,
    label + " validator must reject two assists linked to the same goal");
  assert.equal(duplicateAssistValidation.assistGoalLinksValid, false,
    label + " validator must flag duplicate assist-to-goal links as inconsistent");

  const numericAssistGoalId = JSON.parse(JSON.stringify(fixture.match));
  const numericAssist = numericAssistGoalId.events[fixture.assistIndex];
  let numericGoalId = "1";
  while (numericAssistGoalId.events.some(event =>
    event.type === "goal" && event.goalEventId === numericGoalId)) {
    numericGoalId = String(Number(numericGoalId) + 1);
  }
  const linkedGoal = numericAssistGoalId.events.find(event =>
    event.type === "goal" && event.goalEventId === numericAssist.goalEventId);
  assert.ok(linkedGoal, label + " numeric-ID regression must retain its original linked goal");
  linkedGoal.goalEventId = numericGoalId;
  numericAssist.goalEventId = Number(numericGoalId);
  const numericAssistValidation = targetEngine.validateResult(numericAssistGoalId);
  assert.equal(numericAssistValidation.ok, false,
    label + " validator must reject numeric assist goal IDs instead of coercing them to strings");
  assert.equal(numericAssistValidation.assistGoalLinksValid, false,
    label + " validator must report non-string assist goal IDs as inconsistent");
}

function findModernGoalFixture(targetEngine, firstSeed, label) {
  for (let seed = firstSeed; seed < firstSeed + 1000; seed += 1) {
    const match = targetEngine.simulateMatch({
      seed, teamPower: 60, opponentPower: 92, tactic: "balanced", opponentTactic: "attack",
      player: { name: "Goal Attribution Regression", position: "مدافع", role: "أساسي",
        shooting: 40, passing: 65, vision: 65, composure: 65, fitness: 100,
        trust: 100, energy: 100, fatigue: 0 }
    });
    const goals = match.events.filter(event => event.type === "goal");
    const hasModernShotMetadata = match.events.some(event => event.type === "shot"
      && Object.prototype.hasOwnProperty.call(event, "onTarget"));
    if (goals.length >= 2 && goals.some(event => event.side === "opponent") && hasModernShotMetadata) return match;
  }
  assert.fail(label + " fixture must contain modern goal attribution and an opponent goal");
}
for (const [targetEngine, seed, label] of [[engine, 630000, "source"], [browserEngine, 630000, "browser"]]) {
  const fixture = findModernGoalFixture(targetEngine, seed, label);

  const wrongGoalScorer = JSON.parse(JSON.stringify(fixture));
  const opponentGoal = wrongGoalScorer.events.find(event => event.type === "goal" && event.side === "opponent");
  opponentGoal.scorer = "teammate";
  const wrongScorerValidation = targetEngine.validateResult(wrongGoalScorer);
  assert.equal(wrongScorerValidation.ok, false,
    label + " validator must reject a goal whose scorer conflicts with its side");
  assert.equal(wrongScorerValidation.goalAttributionConsistent, false,
    label + " validator must expose inconsistent goal scorer attribution");

  const duplicateGoalIds = JSON.parse(JSON.stringify(fixture));
  const duplicateGoalEvents = duplicateGoalIds.events.filter(event => event.type === "goal");
  duplicateGoalEvents[1].goalEventId = duplicateGoalEvents[0].goalEventId;
  const duplicateGoalValidation = targetEngine.validateResult(duplicateGoalIds);
  assert.equal(duplicateGoalValidation.ok, false,
    label + " validator must reject duplicate goal event IDs in a modern ledger");
  assert.equal(duplicateGoalValidation.goalAttributionConsistent, false,
    label + " validator must expose duplicate goal event IDs");

  const legacyGoalLedger = JSON.parse(JSON.stringify(fixture));
  for (const event of legacyGoalLedger.events) {
    if (event.type === "shot") delete event.onTarget;
    if (event.type === "goal") {
      delete event.goalEventId;
      delete event.scorer;
    }
    if (event.type === "assist") delete event.goalEventId;
  }
  const legacyGoalValidation = targetEngine.validateResult(legacyGoalLedger);
  assert.equal(legacyGoalValidation.goalAttributionConsistent, true,
    label + " validator must preserve legacy goal ledgers without modern shot metadata");
  assert.equal(legacyGoalValidation.ok, true,
    label + " validator must continue accepting fully legacy goal attribution records");

  const modernGoalWithoutShotFlags = JSON.parse(JSON.stringify(fixture));
  for (const event of modernGoalWithoutShotFlags.events) {
    if (event.type === "shot") delete event.onTarget;
  }
  const malformedGoal = modernGoalWithoutShotFlags.events.find(event =>
    event.type === "goal" && event.side === "opponent");
  malformedGoal.scorer = "teammate";
  const malformedGoalWithoutShotFlagsValidation = targetEngine.validateResult(modernGoalWithoutShotFlags);
  assert.equal(malformedGoalWithoutShotFlagsValidation.ok, false,
    label + " validator must validate modern goal attribution even when shot flags are absent");
  assert.equal(malformedGoalWithoutShotFlagsValidation.goalAttributionConsistent, false,
    label + " validator must expose malformed modern goal attribution without shot flags");

  const modernGoalLedgerWithoutShotFlags = JSON.parse(JSON.stringify(fixture));
  for (const event of modernGoalLedgerWithoutShotFlags.events) {
    if (event.type === "shot") delete event.onTarget;
  }
  const linkedLegacyShotValidation = targetEngine.validateResult(modernGoalLedgerWithoutShotFlags);
  assert.equal(linkedLegacyShotValidation.ok, true,
    label + " validator must accept modern goal attribution when each goal still has a linked legacy-shaped shot");
  assert.equal(linkedLegacyShotValidation.goalShotLedgerConsistent, true,
    label + " validator must verify goal-to-shot links without requiring modern onTarget flags");

  const partiallyLegacyShotLedger = JSON.parse(JSON.stringify(modernGoalLedgerWithoutShotFlags));
  const partialLegacyGoal = partiallyLegacyShotLedger.events.find(event =>
    event.type === "goal" && event.side === "opponent");
  const partialLegacyGoalIndex = partiallyLegacyShotLedger.events.indexOf(partialLegacyGoal);
  const partialLegacyShot = partiallyLegacyShotLedger.events[partialLegacyGoalIndex - 1];
  assert.equal(partialLegacyShot.type, "shot",
    label + " legacy-shaped opponent goal must retain its immediately preceding shot");
  delete partialLegacyShot.shooter;
  delete partialLegacyShot.creditedToPlayer;
  const partialLegacyShotValidation = targetEngine.validateResult(partiallyLegacyShotLedger);
  assert.equal(partialLegacyShotValidation.ok, true,
    label + " validator must preserve legacy shot attribution fields when the goal ledger itself is modern");
  assert.equal(partialLegacyShotValidation.goalShotLedgerConsistent, true,
    label + " validator must use side and minute when legacy shot attribution fields are absent");

  const nonScoringLegacyShotIndex = modernGoalLedgerWithoutShotFlags.events.findIndex((event, index) =>
    event.type === "shot" && event.creditedToPlayer !== true
      && modernGoalLedgerWithoutShotFlags.events[index + 1]?.type !== "goal");
  assert.ok(nonScoringLegacyShotIndex >= 0,
    label + " legacy attribution regression must include a non-scoring shot");

  const invalidLegacyShooter = JSON.parse(JSON.stringify(modernGoalLedgerWithoutShotFlags));
  const malformedLegacyShooterShot = invalidLegacyShooter.events[nonScoringLegacyShotIndex];
  malformedLegacyShooterShot.shooter = malformedLegacyShooterShot.side === "team" ? "opponent" : "teammate";
  const invalidLegacyShooterValidation = targetEngine.validateResult(invalidLegacyShooter);
  assert.equal(invalidLegacyShooterValidation.ok, false,
    label + " validator must reject a wrong-side shooter even when onTarget metadata is absent");
  assert.equal(invalidLegacyShooterValidation.shotAttributionConsistent, false,
    label + " validator must expose invalid legacy shot attribution");

  const invalidLegacyCredit = JSON.parse(JSON.stringify(modernGoalLedgerWithoutShotFlags));
  invalidLegacyCredit.events[nonScoringLegacyShotIndex].creditedToPlayer = "false";
  const invalidLegacyCreditValidation = targetEngine.validateResult(invalidLegacyCredit);
  assert.equal(invalidLegacyCreditValidation.ok, false,
    label + " validator must reject non-boolean legacy player-credit metadata without onTarget flags");
  assert.equal(invalidLegacyCreditValidation.shotAttributionConsistent, false,
    label + " validator must expose malformed legacy player-credit metadata");

  const omittedLegacyAttribution = JSON.parse(JSON.stringify(modernGoalLedgerWithoutShotFlags));
  delete omittedLegacyAttribution.events[nonScoringLegacyShotIndex].shooter;
  delete omittedLegacyAttribution.events[nonScoringLegacyShotIndex].creditedToPlayer;
  const omittedLegacyAttributionValidation = targetEngine.validateResult(omittedLegacyAttribution);
  assert.equal(omittedLegacyAttributionValidation.ok, true,
    label + " validator must preserve legacy shots that omit optional shooter and credit fields");

  const missingGoalShotLedger = JSON.parse(JSON.stringify(modernGoalLedgerWithoutShotFlags));
  const missingShotGoal = missingGoalShotLedger.events.find(event =>
    event.type === "goal" && event.side === "opponent");
  const missingShotGoalIndex = missingGoalShotLedger.events.indexOf(missingShotGoal);
  assert.ok(missingShotGoalIndex > 0,
    label + " missing-shot regression must retain the goal event");
  const linkedShotIndex = missingShotGoalIndex - 1;
  assert.equal(missingGoalShotLedger.events[linkedShotIndex].type, "shot",
    label + " missing-shot regression must identify the goal's original shot");
  missingGoalShotLedger.events.splice(linkedShotIndex, 1);
  const shiftedGoalIndex = missingGoalShotLedger.events.indexOf(missingShotGoal);
  const previousEvent = missingGoalShotLedger.events[shiftedGoalIndex - 1];
  if (previousEvent && previousEvent.type === "shot"
    && previousEvent.side === missingShotGoal.side
    && Number(previousEvent.minute) === Number(missingShotGoal.minute)) {
    previousEvent.type = "chance";
    delete previousEvent.shooter;
    delete previousEvent.creditedToPlayer;
  }
  const missingGoalShotValidation = targetEngine.validateResult(missingGoalShotLedger);
  assert.equal(missingGoalShotValidation.ok, false,
    label + " validator must reject modern goal metadata without a corresponding shot event");
  assert.equal(missingGoalShotValidation.goalShotLedgerConsistent, false,
    label + " validator must expose missing modern goal-to-shot links");
}

for (const [targetEngine, seed, label] of [[engine, 640000, "source"], [browserEngine, 640000, "browser"]]) {
  const fixture = findModernGoalFixture(targetEngine, seed, label);
  const opponentGoalIndex = fixture.events.findIndex(event => event.type === "goal" && event.side === "opponent");
  assert.ok(opponentGoalIndex > 0, label + " goal-shot fixture must contain a preceding opponent shot");
  const linkedShot = fixture.events[opponentGoalIndex - 1];
  assert.equal(linkedShot.type, "shot",
    label + " generated goal must immediately follow its scoring shot");
  assert.equal(linkedShot.onTarget, true,
    label + " scoring shot must be recorded on target");

  const missingScoringShot = JSON.parse(JSON.stringify(fixture));
  missingScoringShot.events.splice(opponentGoalIndex - 1, 1);
  const missingShotValidation = targetEngine.validateResult(missingScoringShot);
  assert.equal(missingShotValidation.ok, false,
    label + " validator must reject a modern goal without its preceding shot event");
  assert.equal(missingShotValidation.goalShotLedgerConsistent, false,
    label + " validator must expose a missing goal-shot link");

  const mismatchedScoringShot = JSON.parse(JSON.stringify(fixture));
  mismatchedScoringShot.events[opponentGoalIndex - 1].onTarget = false;
  const mismatchedShotValidation = targetEngine.validateResult(mismatchedScoringShot);
  assert.equal(mismatchedShotValidation.ok, false,
    label + " validator must reject a scoring shot marked off target");
  assert.equal(mismatchedShotValidation.goalShotLedgerConsistent, false,
    label + " validator must expose a scoring shot marked off target");

  const legacyGoalShotLedger = JSON.parse(JSON.stringify(fixture));
  for (const event of legacyGoalShotLedger.events) {
    if (event.type === "shot") delete event.onTarget;
  }
  const legacyGoalShotValidation = targetEngine.validateResult(legacyGoalShotLedger);
  assert.equal(legacyGoalShotValidation.goalShotLedgerConsistent, true,
    label + " validator must preserve legacy goal records without shot-target metadata");
  assert.equal(legacyGoalShotValidation.ok, true,
    label + " validator must continue accepting legacy goal/shot ledgers");
}

function findShotTargetMetadataFixture(targetEngine, seed, label) {
  const match = targetEngine.simulateMatch({
    seed,
    player: { name: "Shot Target Type Regression", position: "مهاجم", role: "أساسي",
      shooting: 65, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
  });
  assert.ok(match.events.some(event => event.type === "shot" && Object.prototype.hasOwnProperty.call(event, "onTarget")),
    label + " fixture must contain shot-target metadata");
  return match;
}
for (const [targetEngine, seed, label] of [[engine, 650000, "source"], [browserEngine, 650000, "browser"]]) {
  for (const invalidValue of ["yes", 1]) {
    const invalidShotTarget = JSON.parse(JSON.stringify(findShotTargetMetadataFixture(targetEngine, seed, label)));
    const shot = invalidShotTarget.events.find(event => event.type === "shot"
      && Object.prototype.hasOwnProperty.call(event, "onTarget"));
    shot.onTarget = invalidValue;
    const validation = targetEngine.validateResult(invalidShotTarget);
    assert.equal(validation.ok, false,
      label + " validator must reject non-boolean shot-target metadata");
    assert.equal(validation.reason, "invalid-shot-target-metadata",
      label + " validator must return a stable shot-target metadata reason");
    assert.equal(validation.shotTargetMetadataConsistent, false,
      label + " validator must expose malformed shot-target metadata");
  }

  const legacyShotTargetMetadata = findShotTargetMetadataFixture(targetEngine, seed + 1, label);
  for (const event of legacyShotTargetMetadata.events) {
    if (event.type === "shot") delete event.onTarget;
  }
  const legacyValidation = targetEngine.validateResult(legacyShotTargetMetadata);
  assert.equal(legacyValidation.shotTargetMetadataConsistent, true,
    label + " validator must allow legacy shot events with omitted onTarget metadata");
  assert.equal(legacyValidation.ok, true,
    label + " validator must preserve legacy ledgers without shot-target metadata");
}

for (const [targetEngine, seed, label] of [[engine, 660000, "source"], [browserEngine, 660000, "browser"]]) {
  const fixture = findModernGoalFixture(targetEngine, seed, label);
  const nonScoringShotIndex = fixture.events.findIndex((event, index) =>
    event.type === "shot" && fixture.events[index + 1]?.type !== "goal"
      && Object.prototype.hasOwnProperty.call(event, "onTarget"));
  assert.ok(nonScoringShotIndex >= 0,
    label + " shot-attribution fixture must contain a non-scoring modern shot");

  const partialShotTargetMetadata = JSON.parse(JSON.stringify(fixture));
  delete partialShotTargetMetadata.events[nonScoringShotIndex].onTarget;
  const partialTargetValidation = targetEngine.validateResult(partialShotTargetMetadata);
  assert.equal(partialTargetValidation.ok, false,
    label + " validator must reject a mixed modern/legacy shot-target ledger");
  assert.equal(partialTargetValidation.reason, "invalid-shot-target-metadata",
    label + " validator must identify incomplete shot-target metadata");
  assert.equal(partialTargetValidation.shotTargetMetadataConsistent, false,
    label + " validator must expose incomplete shot-target metadata");

  const scoringGoalIndex = fixture.events.findIndex(event => event.type === "goal");
  const scoringShotIndex = scoringGoalIndex - 1;
  assert.ok(scoringShotIndex >= 0 && fixture.events[scoringShotIndex].type === "shot",
    label + " modern goal fixture must have a preceding scoring shot");
  const missingScoringShotTarget = JSON.parse(JSON.stringify(fixture));
  delete missingScoringShotTarget.events[scoringShotIndex].onTarget;
  assert.ok(missingScoringShotTarget.events.some((event, index) => index !== scoringShotIndex
    && event.type === "shot" && Object.prototype.hasOwnProperty.call(event, "onTarget")),
  label + " scoring-shot regression must retain other modern target metadata");
  const missingScoringTargetValidation = targetEngine.validateResult(missingScoringShotTarget);
  assert.equal(missingScoringTargetValidation.ok, false,
    label + " validator must reject a scoring shot missing its target flag in a modern ledger");
  assert.equal(missingScoringTargetValidation.reason, "invalid-shot-target-metadata",
    label + " validator must reject missing scoring-shot target metadata");

  const invalidShooter = JSON.parse(JSON.stringify(fixture));
  const shooterProbe = invalidShooter.events[nonScoringShotIndex];
  shooterProbe.shooter = shooterProbe.side === "team" ? "opponent" : "teammate";
  const shooterValidation = targetEngine.validateResult(invalidShooter);
  assert.equal(shooterValidation.ok, false,
    label + " validator must reject a shot attributed to a shooter from the wrong side");
  assert.equal(shooterValidation.reason, "invalid-shot-attribution",
    label + " validator must return a stable shot-attribution reason");
  assert.equal(shooterValidation.shotAttributionConsistent, false,
    label + " validator must expose invalid shot attribution");

  const invalidCredit = JSON.parse(JSON.stringify(fixture));
  invalidCredit.events[nonScoringShotIndex].creditedToPlayer = "false";
  const creditValidation = targetEngine.validateResult(invalidCredit);
  assert.equal(creditValidation.ok, false,
    label + " validator must reject non-boolean shot player-credit flags");
  assert.equal(creditValidation.reason, "invalid-shot-attribution",
    label + " validator must reject malformed player-credit flags before stat reconciliation");

  const legacyShotAttribution = JSON.parse(JSON.stringify(fixture));
  for (const event of legacyShotAttribution.events) {
    if (event.type === "shot") delete event.onTarget;
  }
  const legacyShotAttributionValidation = targetEngine.validateResult(legacyShotAttribution);
  assert.equal(legacyShotAttributionValidation.shotAttributionConsistent, true,
    label + " validator must preserve legacy shot attribution records without target metadata");
  assert.equal(legacyShotAttributionValidation.ok, true,
    label + " validator must accept legacy shot ledgers without target metadata");
}

const numericStringStatsMatch = engine.simulateMatch({
  seed: 8134,
  player: { name: "Regression Player", position: "مهاجم", role: "أساسي",
    shooting: 65, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
});
numericStringStatsMatch.player.minutes = String(numericStringStatsMatch.player.minutes);
numericStringStatsMatch.player.tackles = String(numericStringStatsMatch.player.tackles);
numericStringStatsMatch.player.shotsOnTarget = String(numericStringStatsMatch.player.shotsOnTarget);
numericStringStatsMatch.player.chances = String(numericStringStatsMatch.player.chances);
numericStringStatsMatch.player.keyPasses = String(numericStringStatsMatch.player.keyPasses);
assert.equal(engine.validateResult(numericStringStatsMatch).ok, true,
  "legacy numeric strings in player stats must remain accepted");

const numericStringBrowserStatsMatch = browserEngine.simulateMatch({
  seed: 8134,
  player: { name: "Regression Player", position: "مهاجم", role: "أساسي",
    shooting: 65, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
});
numericStringBrowserStatsMatch.player.minutes = String(numericStringBrowserStatsMatch.player.minutes);
numericStringBrowserStatsMatch.player.tackles = String(numericStringBrowserStatsMatch.player.tackles);
numericStringBrowserStatsMatch.player.shotsOnTarget = String(numericStringBrowserStatsMatch.player.shotsOnTarget);
numericStringBrowserStatsMatch.player.chances = String(numericStringBrowserStatsMatch.player.chances);
numericStringBrowserStatsMatch.player.keyPasses = String(numericStringBrowserStatsMatch.player.keyPasses);
assert.equal(browserEngine.validateResult(numericStringBrowserStatsMatch).ok, true,
  "the embedded browser validator must preserve legacy numeric-string compatibility");

function assertAvailabilityMismatch(targetEngine, label, mutate) {
  const match = targetEngine.simulateMatch({
    seed: 8135,
    player: { name: "Availability Regression", position: "مهاجم", role: "أساسي",
      shooting: 65, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
  });
  assert.ok(match.player.minutes > 0, label + ": fixture must start with a played appearance");
  mutate(match);
  const validation = targetEngine.validateResult(match);
  assert.equal(validation.ok, false, label + ": inconsistent availability must be rejected");
  assert.equal(validation.reason, "invalid-player-availability",
    label + ": availability mismatches must return a stable reason");
}
assertAvailabilityMismatch(engine, "unavailable player with positive minutes", match => {
  match.player.playerAvailable = false;
});
assertAvailabilityMismatch(browserEngine, "browser unavailable player with positive minutes", match => {
  match.player.playerAvailable = false;
});
assertAvailabilityMismatch(engine, "available player with zero minutes", match => {
  match.player.minutes = 0;
  match.player.playerAvailable = true;
});
assertAvailabilityMismatch(browserEngine, "browser available player with zero minutes", match => {
  match.player.minutes = 0;
  match.player.playerAvailable = true;
});
assertAvailabilityMismatch(engine, "non-boolean availability flag", match => {
  match.player.playerAvailable = "false";
});
assertAvailabilityMismatch(browserEngine, "browser non-boolean availability flag", match => {
  match.player.playerAvailable = "false";
});

const legacyAvailabilityMatch = engine.simulateMatch({
  seed: 8136,
  player: { name: "Legacy Availability", position: "مهاجم", role: "أساسي",
    shooting: 65, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
});
delete legacyAvailabilityMatch.player.playerAvailable;
assert.equal(engine.validateResult(legacyAvailabilityMatch).ok, true,
  "legacy match records without playerAvailable must remain valid");
const legacyBrowserAvailabilityMatch = browserEngine.simulateMatch({
  seed: 8136,
  player: { name: "Legacy Availability", position: "مهاجم", role: "أساسي",
    shooting: 65, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
});
delete legacyBrowserAvailabilityMatch.player.playerAvailable;
assert.equal(browserEngine.validateResult(legacyBrowserAvailabilityMatch).ok, true,
  "the embedded validator must preserve legacy records without playerAvailable");

const sparseEventMatch = engine.simulateMatch({
  seed: 8130,
  player: { name: "Regression Player", position: "مهاجم", role: "أساسي",
    shooting: 65, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
});
assert.ok(sparseEventMatch.events.length > 0, "the sparse-event fixture must contain events");
delete sparseEventMatch.events[0];
assert.equal(0 in sparseEventMatch.events, false, "the fixture must contain a real sparse-array hole");
const sparseEventValidation = engine.validateResult(sparseEventMatch);
assert.equal(sparseEventValidation.ok, false, "the source validator must reject sparse event arrays");
assert.equal(sparseEventValidation.reason, "invalid-event-entry",
  "sparse event arrays must return the malformed-entry reason");

const sparseBrowserEventMatch = browserEngine.simulateMatch({
  seed: 8130,
  player: { name: "Regression Player", position: "مهاجم", role: "أساسي",
    shooting: 65, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
});
delete sparseBrowserEventMatch.events[0];
const sparseBrowserEventValidation = browserEngine.validateResult(sparseBrowserEventMatch);
assert.equal(sparseBrowserEventValidation.ok, false,
  "the embedded browser validator must reject sparse event arrays");
assert.equal(sparseBrowserEventValidation.reason, "invalid-event-entry",
  "the embedded browser validator must return the same malformed-entry reason");


const validAggregateOffsetCases = [
  [undefined, 0], [null, 0], [0, 0], [2, 2], [-3, -3],
  ["0", 0], ["2", 2], ["-3", -3], [" 2 ", 2]
];
for (const [value, expected] of validAggregateOffsetCases) {
  const options = { seed: 8142, knockout: true };
  if (value !== undefined) options.aggregateOffset = value;
  const sourceResult = engine.simulateMatch(options);
  const browserResult = browserEngine.simulateMatch(options);
  assert.equal(sourceResult.metadata.aggregateOffset, expected,
    "source engine must normalize valid aggregate offsets: " + String(value));
  assert.equal(browserResult.metadata.aggregateOffset, expected,
    "embedded engine must normalize valid aggregate offsets: " + String(value));
  assert.equal(engine.validateResult(sourceResult).ok, true,
    "source engine result must remain valid for aggregate offset: " + String(value));
  assert.equal(browserEngine.validateResult(browserResult).ok, true,
    "embedded engine result must remain valid for aggregate offset: " + String(value));
}
const invalidAggregateOffsets = [
  true, false, "", " ", "Infinity", "1.5", 1.5, Infinity, -Infinity, NaN,
  9007199254740992, [], {}, Object(1), Symbol("invalid")
];
for (const value of invalidAggregateOffsets) {
  assert.throws(() => engine.simulateMatch({ seed: 8143, knockout: true, aggregateOffset: value }),
    /invalid-aggregate-offset/,
    "source engine must reject invalid aggregate offset: " + String(value));
  assert.throws(() => browserEngine.simulateMatch({ seed: 8143, knockout: true, aggregateOffset: value }),
    /invalid-aggregate-offset/,
    "embedded engine must reject invalid aggregate offset: " + String(value));
}


const metadataShapeFixture = engine.simulateMatch({
  seed: 8144,
  player: { name: "Metadata Shape", position: "مهاجم", role: "أساسي",
    shooting: 65, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
});
assert.equal(engine.validateResult(metadataShapeFixture).ok, true,
  "a generated match with object metadata must remain valid");
assert.equal(browserEngine.validateResult(metadataShapeFixture).ok, true,
  "the embedded browser engine must accept valid object metadata");
for (const malformedMetadata of ["corrupt", 42, true, [], ["unexpected"]]) {
  const sourceMetadataFixture = JSON.parse(JSON.stringify(metadataShapeFixture));
  const browserMetadataFixture = JSON.parse(JSON.stringify(metadataShapeFixture));
  sourceMetadataFixture.metadata = malformedMetadata;
  browserMetadataFixture.metadata = malformedMetadata;
  const sourceMetadataValidation = engine.validateResult(sourceMetadataFixture);
  const browserMetadataValidation = browserEngine.validateResult(browserMetadataFixture);
  assert.equal(sourceMetadataValidation.ok, false,
    "the source validator must reject malformed metadata containers: " + String(malformedMetadata));
  assert.equal(sourceMetadataValidation.reason, "invalid-metadata-shape");
  assert.equal(sourceMetadataValidation.metadataShapeConsistent, false);
  assert.equal(browserMetadataValidation.ok, false,
    "the embedded validator must reject malformed metadata containers: " + String(malformedMetadata));
  assert.equal(browserMetadataValidation.reason, "invalid-metadata-shape");
  assert.equal(browserMetadataValidation.metadataShapeConsistent, false);
}
for (const legacyMetadata of ["missing", null]) {
  const sourceLegacyFixture = JSON.parse(JSON.stringify(metadataShapeFixture));
  const browserLegacyFixture = JSON.parse(JSON.stringify(metadataShapeFixture));
  if (legacyMetadata === "missing") {
    delete sourceLegacyFixture.metadata;
    delete browserLegacyFixture.metadata;
  } else {
    sourceLegacyFixture.metadata = null;
    browserLegacyFixture.metadata = null;
  }
  assert.equal(engine.validateResult(sourceLegacyFixture).ok, true,
    "legacy saves with missing/null metadata must remain valid");
  assert.equal(browserEngine.validateResult(browserLegacyFixture).ok, true,
    "the embedded engine must preserve missing/null legacy metadata");
}


const invalidMatchOptions = [null, true, false, 0, 1, "", "invalid", [], [1], Symbol("invalid")];
for (const invalidOptions of invalidMatchOptions) {
  assert.throws(() => engine.simulateMatch(invalidOptions), /invalid-match-options/,
    "the source engine must reject non-object simulation options: " + String(invalidOptions));
  assert.throws(() => browserEngine.simulateMatch(invalidOptions), /invalid-match-options/,
    "the embedded engine must reject non-object simulation options: " + String(invalidOptions));
}
assert.doesNotThrow(() => engine.simulateMatch(),
  "omitted options must continue to use the default empty options object");
assert.doesNotThrow(() => browserEngine.simulateMatch({}),
  "the embedded engine must accept a normal options object");


const seedReplayOptions = {
  teamPower: 64, opponentPower: 59, home: true, tactic: "balanced",
  player: { name: "Seed Replay", position: "وسط دفاعي", role: "أساسي",
    shooting: 58, passing: 68, vision: 66, composure: 64, fitness: 82,
    trust: 72, energy: 88, fatigue: 12, physical: 70, speed: 62, dribbling: 55 }
};
const implicitSeedResult = engine.simulateMatch(seedReplayOptions);
assert.ok(Number.isSafeInteger(implicitSeedResult.metadata.seed),
  "the generated metadata must expose the actual safe-integer seed used by the engine");
const implicitSeedReplay = engine.simulateMatch({
  ...seedReplayOptions, seed: implicitSeedResult.metadata.seed
});
assert.equal(JSON.stringify(implicitSeedReplay), JSON.stringify(implicitSeedResult),
  "a match without an explicit seed must be exactly reproducible from metadata.seed");
const browserImplicitSeedResult = browserEngine.simulateMatch(seedReplayOptions);
assert.equal(browserImplicitSeedResult.metadata.seed, implicitSeedResult.metadata.seed,
  "source and browser engines must record the same implicit seed");
assert.equal(JSON.stringify(browserEngine.simulateMatch({
  ...seedReplayOptions, seed: browserImplicitSeedResult.metadata.seed
})), JSON.stringify(browserImplicitSeedResult),
  "the embedded engine must replay an implicitly seeded match from metadata.seed");

for (const explicitSeed of [0, 42, "0042"]) {
  const first = engine.simulateMatch({ ...seedReplayOptions, seed: explicitSeed });
  assert.equal(first.metadata.seed, explicitSeed,
    "metadata must preserve the exact explicit seed value used by all RNG streams");
  assert.equal(JSON.stringify(engine.simulateMatch({ ...seedReplayOptions, seed: first.metadata.seed })),
    JSON.stringify(first), "explicit seeds must replay exactly: " + String(explicitSeed));
  const browserFirst = browserEngine.simulateMatch({ ...seedReplayOptions, seed: explicitSeed });
  assert.equal(browserFirst.metadata.seed, explicitSeed);
  assert.equal(JSON.stringify(browserEngine.simulateMatch({
    ...seedReplayOptions, seed: browserFirst.metadata.seed
  })), JSON.stringify(browserFirst), "browser explicit seed replay must remain exact");
}
for (const invalidSeed of [null, true, false, [], {}, NaN, Infinity, -Infinity, "", "  ", "not-a-number", Symbol("invalid")]) {
  assert.throws(() => engine.simulateMatch({ ...seedReplayOptions, seed: invalidSeed }),
    /invalid-match-seed/, "the source engine must reject invalid seeds: " + String(invalidSeed));
  assert.throws(() => browserEngine.simulateMatch({ ...seedReplayOptions, seed: invalidSeed }),
    /invalid-match-seed/, "the embedded engine must reject invalid seeds: " + String(invalidSeed));
}


function freeActiveMinute(match, label) {
  const entry = match.events.find(event => event.type === "substitution-on" && event.side === "player");
  const entryMinute = entry ? Number(entry.minute) : 0;
  const exit = match.events
    .filter(event => event.side === "player" && ["red-card", "injury", "substitution"].includes(event.type))
    .sort((a, b) => Number(a.minute) - Number(b.minute))[0];
  const endMinute = exit ? Number(exit.minute) : entryMinute + Number(match.player.minutes || 0);
  const occupied = new Set(match.events.map(event => Number(event.minute)));
  for (let minute = entryMinute + 1; minute < endMinute; minute += 1) {
    if (!occupied.has(minute)) return minute;
  }
  throw new Error(label + " fixture must expose an unused minute while the player is active");
}
function insertAtMinute(match, minute, events) {
  const index = match.events.findIndex(event => Number(event.minute) > minute);
  match.events.splice(index < 0 ? match.events.length : index, 0, ...events);
}
function saveLedgerOptions(seed, position) {
  return {
    seed, teamPower: 62, opponentPower: 60,
    player: { name: "Save Ledger Regression", position, role: "أساسي",
      shooting: 24, passing: 55, vision: 50, composure: 65, fitness: 85,
      trust: 70, energy: 90, fatigue: 5, physical: 60, speed: 45, dribbling: 35 }
  };
}
for (const [targetEngine, label] of [[engine, "source"], [browserEngine, "browser"]]) {
  const orphanSave = targetEngine.simulateMatch(saveLedgerOptions(91821, "حارس مرمى"));
  assert.ok(orphanSave.player.minutes > 10, label + " goalkeeper fixture must have an active interval");
  assert.equal(targetEngine.validateResult(orphanSave).ok, true,
    label + " generated goalkeeper save ledger must remain valid");
  const orphanMinute = freeActiveMinute(orphanSave, label + " orphan-save");
  orphanSave.player.saves = Number(orphanSave.player.saves || 0) + 1;
  insertAtMinute(orphanSave, orphanMinute, [{
    type: "save", minute: orphanMinute, side: "team",
    actor: "Save Ledger Regression", creditedToPlayer: true
  }]);
  const orphanValidation = targetEngine.validateResult(orphanSave);
  assert.equal(orphanValidation.ok, false,
    label + " validator must reject a credited save without a matching opponent shot");
  assert.equal(orphanValidation.reason, "invalid-save-shot-link");
  assert.equal(orphanValidation.saveShotLedgerConsistent, false);

  const outfieldSave = targetEngine.simulateMatch(saveLedgerOptions(91822, "مهاجم"));
  assert.equal(targetEngine.validateResult(outfieldSave).ok, true,
    label + " generated outfield match must remain valid before save tampering");
  const outfieldMinute = freeActiveMinute(outfieldSave, label + " outfield-save");
  outfieldSave.player.saves = Number(outfieldSave.player.saves || 0) + 1;
  insertAtMinute(outfieldSave, outfieldMinute, [
    { type: "shot", minute: outfieldMinute, side: "opponent",
      onTarget: true, shooter: "opponent", creditedToPlayer: false },
    { type: "save", minute: outfieldMinute, side: "team",
      actor: "Save Ledger Regression", creditedToPlayer: true }
  ]);
  const outfieldValidation = targetEngine.validateResult(outfieldSave);
  assert.equal(outfieldValidation.ok, false,
    label + " validator must reject a goalkeeper save credited to an outfield player");
  assert.equal(outfieldValidation.reason, "invalid-save-player-position");
  assert.equal(outfieldValidation.saveRoleConsistent, false);

  const legacySave = targetEngine.simulateMatch(saveLedgerOptions(91823, "حارس مرمى"));
  for (const event of legacySave.events) {
    if (event.type === "shot") delete event.onTarget;
  }
  assert.equal(targetEngine.validateResult(legacySave).ok, true,
    label + " validator must preserve legacy save ledgers without modern shot-target metadata");
}


for (const [label, targetEngine] of [["source", engine], ["browser", browserEngine]]) {
  const extended = targetEngine.simulateMatch({ seed: 20261030, player: { name: "لاعب اختبار الإحصائيات", position: "قلب دفاع", passing: 78, fatigue: 0, energy: 100, fitness: 85, trust: 70 }, teamPower: 72, opponentPower: 68, home: true, tactic: "balanced", knockout: false });
  assert.equal(extended.player.tacklesWon, extended.player.tackles, label + " tacklesWon must reconcile");
  assert.equal(extended.player.clearances, extended.events.filter(event => event.type === "clearance" && event.side === "player").length, label + " clearances must reconcile");
  assert.equal(extended.player.ballRecoveries, extended.events.filter(event => event.type === "recovery" && event.side === "player").length, label + " recoveries must reconcile");
  assert.ok(extended.player.passesCompleted <= extended.player.passAttempts, label + " completed passes cannot exceed attempts");
  assert.equal(extended.player.passingAccuracy, extended.player.passAttempts ? Math.round(extended.player.passesCompleted / extended.player.passAttempts * 1000) / 10 : 0, label + " passing accuracy derives from attempts");
  assert.equal(extended.officialOutcome, extended.score.for > extended.score.against ? "فوز" : extended.score.for < extended.score.against ? "خسارة" : "تعادل");
  assert.equal(targetEngine.validateResult(extended).ok, true, label + " extended match-stat ledger validates");
}


const scoringCalibrationPositions = ["حارس مرمى", "قلب دفاع", "ظهير", "وسط دفاعي", "وسط مهاجم", "جناح", "مهاجم", "رأس حربة"];
const scoringCalibration = [];
for (const position of scoringCalibrationPositions) {
  let goals = 0, assists = 0, minutes = 0, teamGoals = 0, opponentGoals = 0, shots = 0, appearances = 0;
  for (let seed = 610000; seed < 610300; seed += 1) {
    const result = engine.simulateMatch({
      seed, teamPower: 65, opponentPower: 65, tactic: "balanced", home: false,
      player: { name: "Scoring Calibration", position, role: "أساسي",
        shooting: 65, dribbling: 65, passing: 65, speed: 65, fitness: 85,
        composure: 65, vision: 65, defending: 65, goalkeeping: 65, physical: 65,
        trust: 70, energy: 95, fatigue: 5 }
    });
    goals += Number(result.player.goals) || 0;
    assists += Number(result.player.assists) || 0;
    minutes += Number(result.player.minutes) || 0;
    shots += Number(result.player.shots) || 0;
    teamGoals += Number(result.score.for) || 0;
    opponentGoals += Number(result.score.against) || 0;
    if (result.player.minutes > 0) appearances += 1;
    assert.equal(engine.validateResult(result).ok, true, "calibration result must have a valid scoring ledger");
  }
  scoringCalibration.push({
    position, goalsPer90: Number((goals * 90 / Math.max(1, minutes)).toFixed(3)),
    assistsPer90: Number((assists * 90 / Math.max(1, minutes)).toFixed(3)),
    shotsPer90: Number((shots * 90 / Math.max(1, minutes)).toFixed(2)),
    teamGoalsPerMatch: Number((teamGoals / 300).toFixed(2)),
    opponentGoalsPerMatch: Number((opponentGoals / 300).toFixed(2)),
    appearanceRate: Number((appearances / 300).toFixed(2))
  });
}
console.log("POSITION_SCORING_CALIBRATION " + JSON.stringify(scoringCalibration));
const scoringRanges = {
  "حارس مرمى": [0, 0.005], "قلب دفاع": [0.02, 0.08], "ظهير": [0.04, 0.11],
  "وسط دفاعي": [0.06, 0.15], "وسط مهاجم": [0.09, 0.19],
  "جناح": [0.18, 0.32], "مهاجم": [0.19, 0.34], "رأس حربة": [0.24, 0.40]
};
for (const row of scoringCalibration) {
  const [minimum, maximum] = scoringRanges[row.position];
  assert.ok(row.goalsPer90 >= minimum && row.goalsPer90 <= maximum,
    row.position + " goals/90 must stay in a position-appropriate range");
  assert.ok(row.appearanceRate >= 0.99, row.position + " calibration sample must record eligible minutes");
  assert.ok(row.teamGoalsPerMatch >= 0.95 && row.teamGoalsPerMatch <= 1.65,
    row.position + " must not distort the team's normal scoring rate");
  assert.ok(row.opponentGoalsPerMatch >= 0.9 && row.opponentGoalsPerMatch <= 1.6,
    row.position + " must not distort the opponent's normal scoring rate");
}
const meanAssistsPer90 = scoringCalibration.reduce((sum, row) => sum + row.assistsPer90, 0) / scoringCalibration.length;
assert.ok(meanAssistsPer90 >= 0.07 && meanAssistsPer90 <= 0.22,
  "assists per 90 must not be inflated across every position");

console.log("PASS: " + tested + " deterministic position cases and defensive-action profiles, " + exitSweep + " injury/red-card exit regressions, and source/deployed-engine parity.");
