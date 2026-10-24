#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
global.window = global;
require(path.join(__dirname, "..", "public", "data", "career-engine.js"));
const career = global.LWCareer;
assert.ok(career, "career engine must export LWCareer");

const expectedPlans = {
  "حارس مرمى": { primary: "goalkeeping", secondary: ["composure", "passing", "fitness"] },
  "قلب دفاع": { primary: "defending", secondary: ["composure", "fitness", "passing"] },
  "ظهير": { primary: "speed", secondary: ["passing", "defending"] },
  "وسط دفاعي": { primary: "defending", secondary: ["vision", "fitness", "composure"] },
  "وسط مهاجم": { primary: "vision", secondary: ["composure", "dribbling", "shooting"] },
  "جناح": { primary: "dribbling", secondary: ["shooting", "vision", "fitness"] },
  "مهاجم": { primary: "shooting", secondary: ["composure", "speed", "vision"] }
};
for (const [position, expected] of Object.entries(expectedPlans)) {
  const plan = career.positionDevelopmentPlan({ pos: position });
  assert.equal(plan.position, position, "development plan must match selected position");
  assert.ok(plan.title && plan.summary, "every position must have an explanatory plan");
  assert.ok(plan.primary.includes(expected.primary), "wrong primary focus for " + position);
  for (const skill of expected.secondary) assert.ok(plan.secondary.includes(skill), "missing support skill " + skill + " for " + position);
  assert.equal(career.trainingFocusMultiplier({ pos: position }, expected.primary), 1.2, "primary focus should grant 20% bonus");
  assert.equal(career.trainingFocusMultiplier({ pos: position }, expected.secondary[0]), 1.08, "support focus should grant 8% bonus");
  assert.equal(career.trainingFocusMultiplier({ pos: position }, "not-a-skill"), 1, "off-plan skills remain trainable without a bonus");
}
assert.equal(career.trainingFocusMultiplier({ pos: "حارس مرمى" }, "goalkeeping"), 1.2);
assert.equal(career.trainingFocusMultiplier({ pos: "جناح" }, "goalkeeping"), 1);

// New-position baseline matrix: specialisms must no longer start at a universal 50.
const between = (value, min, max, label) => assert.ok(value >= min && value <= max, label + ": " + value + " is outside " + min + "-" + max);
const startRanges = {
  "مهاجم": { shooting:[55,68], dribbling:[55,68], speed:[55,68], passing:[50,60], vision:[50,60], fitness:[50,60], defending:[15,28], goalkeeping:[5,12] },
  "جناح": { shooting:[55,68], dribbling:[55,68], speed:[55,68], passing:[50,60], vision:[50,60], fitness:[50,60], defending:[15,28], goalkeeping:[5,12] },
  "وسط مهاجم": { passing:[55,65], vision:[55,65], composure:[55,65], fitness:[55,65], defending:[35,45], goalkeeping:[5,12] },
  "وسط دفاعي": { passing:[55,65], vision:[55,65], composure:[55,65], fitness:[55,65], defending:[52,62], goalkeeping:[5,12] },
  "قلب دفاع": { defending:[55,66], fitness:[55,66], speed:[55,66], passing:[45,55], composure:[45,55], shooting:[25,40], goalkeeping:[5,12] },
  "ظهير": { defending:[55,66], fitness:[55,66], speed:[55,66], passing:[45,55], composure:[45,55], shooting:[25,40], goalkeeping:[5,12] },
  "حارس مرمى": { goalkeeping:[58,68], composure:[58,68], vision:[58,68], shooting:[15,35], defending:[15,35] }
};
for (const [position, ranges] of Object.entries(startRanges)) {
  const stats = career.startingStatsForPosition(position, () => 0.5);
  assert.equal(Object.keys(stats).length, 10, "all 10 skills must be initialized for " + position);
  for (const [skill, range] of Object.entries(ranges)) between(stats[skill], range[0], range[1], position + "/" + skill);
  assert.ok(Number.isFinite(career.overall({ ...stats, pos: position, trainingXP: {}, randomSeed: 1, playerPotential: 85 })), "weighted OVR must exist for " + position);
}
const wingerStats = career.startingStatsForPosition("جناح", () => 0.5);
const keeperStats = career.startingStatsForPosition("حارس مرمى", () => 0.5);
assert.ok(keeperStats.goalkeeping > wingerStats.goalkeeping, "keeper OVR should reward goalkeeping instead of averaging all skills equally");
assert.ok(wingerStats.shooting > wingerStats.goalkeeping, "winger must not start with goalkeeper-level stats");
assert.equal(career.trainingFocusMultiplier({ pos: "قلب دفاع" }, "physical"), 1.2, "physical training is a primary defender focus");
assert.equal(career.trainingFocusMultiplier({ pos: "حارس مرمى" }, "physical"), 1);


const deduped = career.uniqueMatchRows([
  { id: "match-1", minutes: 90 }, { id: "match-1", minutes: 90 },
  { id: "match-2", minutes: 30 }
]);
assert.equal(deduped.length, 2, "match history must deduplicate explicit match IDs");
assert.equal(career.leagueMatchTarget(20), 38);
assert.equal(career.leagueMatchDaysRemaining(10, 14, 7), 3);
assert.equal(career.leagueMatchDaysRemaining(10, 14, 5), 1, "the new calendar enforces a 5-day league gap");
assert.equal(career.leagueMatchDaysRemaining(10, 15, 5), 0, "a league match is available after five elapsed days");
assert.equal(career.normalizeLeagueRoundIndex(undefined, [{ matchday: 7 }, { matchday: 9 }], 8, 30), 9);
assert.equal(career.normalizeLeagueRoundIndex(99, [], 0, 12), 12);

const onLoan = {
  name: "Test Player", clubName: "Loan Club", leagueCountry: "Hostland",
  weeklyWage: 900, contractSeasons: 3, freeAgent: false,
  loan: { parentClub: "Parent Club", parentCountry: "Egypt", parentWage: 400, parentContractSeasons: 1, parentFreeAgent: false }
};
const contractSnapshot = career.contractStateForSeasonTransition(onLoan);
assert.equal(contractSnapshot.clubName, "Parent Club");
assert.equal(contractSnapshot.leagueCountry, "Egypt");
assert.equal(contractSnapshot.weeklyWage, 400);
assert.equal(contractSnapshot.contractSeasons, 1);
assert.equal(onLoan.clubName, "Loan Club", "contract snapshot must not mutate the active loan state");
assert.equal(career.wageNegotiationStatus(contractSnapshot), "contract-expiring");

const player = {
  pos: "مهاجم", age: 24, season: 2, apps: 0, money: 1000, weeklyWage: 500,
  contractSeasons: 3, freeAgent: false, daysSinceNegotiation: 7,
  shooting: 65, dribbling: 60, passing: 58, speed: 62, fitness: 64, composure: 65,
  vision: 60, goalkeeping: 45, defending: 45, energy: 100, fatigue: 0,
  playerPotential: 88, randomSeed: 1234, careerAwards: [], seasonLog: [], careerMatchHistory: [],
  playedToday: false, trainedToday: false, injuryDays: 0, trainingIntensity: "normal", progressionMatchIds: []
};
career.ensureState(player);
const first = career.matchDevelopment(player, {
  matchId: "test-match-001", minutes: 90, rating: 8, goals: 1, assists: 1, competitionKey: "league|test"
});
const duplicate = career.matchDevelopment(player, {
  matchId: "test-match-001", minutes: 90, rating: 8, goals: 1, assists: 1, competitionKey: "league|test"
});
assert.equal(first.qualifying, true);
assert.equal(duplicate.duplicate, true);
assert.equal(player.careerAppearances, 1, "a repeated match must not grant progression twice");

const beforeMoney = player.money;
const purchase = career.purchaseItem(player, { id: "boots", price: 100 });
assert.equal(purchase.ok, true);
assert.equal(player.money, beforeMoney - 100);
assert.equal(career.purchaseItem(player, { id: "boots", price: 100 }).status, "already-owned");

const renewal = { weeklyWage: 500, contractSeasons: 1, freeAgent: false, clubName: "Test FC" };
const renewalBase = { weeklyWage: 500, contractSeasons: 1, freeAgent: false, clubName: "Test FC", trust: 70,
  shooting: 70, dribbling: 70, passing: 70, speed: 70, fitness: 70, composure: 70, vision: 70, defending: 50, goalkeeping: 45, pos: "مهاجم" };
const ordinaryOffer = career.makeContractOffer(renewalBase, false);
const legacyAgentOffer = career.makeContractOffer(renewalBase, true);
const specialistAgentOffer = career.makeContractOffer(renewalBase, { contractMultiplier: 1.16 });
assert.ok(legacyAgentOffer.wage > ordinaryOffer.wage, "legacy agent should preserve a modest boost");
assert.ok(specialistAgentOffer.wage > legacyAgentOffer.wage, "agent multiplier should affect offer");
assert.equal(career.makeContractOffer(renewalBase, { contractMultiplier: 4 }).wage, career.makeContractOffer(renewalBase, { contractMultiplier: 1.18 }).wage, "agent multiplier must be capped");
assert.equal(career.resolveContractDecision(renewal, "accept", { wage: 650, seasons: 3 }).status, "renewed");
assert.equal(renewal.weeklyWage, 650);
assert.equal(renewal.contractSeasons, 4);
assert.equal(career.shouldRetire({ age: 40 }), true);
assert.equal(career.shouldRetire({ age: 39 }), false);

const trainingState = { ...player, playedToday: true, trainedToday: false, injuryDays: 0 };
assert.equal(career.train(trainingState, "shooting").ok, false, "training must be blocked on match day");
assert.equal(career.train({ ...player, pos: "مهاجم", playedToday: false, trainedToday: false }, "unknown").ok, false);

const tournament = { nationalTournamentMatches: 0, nationalTournamentPoints: 0, nationalTournamentDone: false };
assert.equal(career.recordNationalTournamentMatch(tournament, "فوز").status, "group");
assert.equal(career.recordNationalTournamentMatch(tournament, "فوز").status, "final-qualified");
assert.equal(career.recordNationalTournamentMatch(tournament, "فوز").status, "final-complete");
assert.equal(career.recordNationalTournamentMatch(tournament, "فوز").status, "tournament-closed");

console.log("PASS: career progression, match-history deduplication, loan contracts, purchase gates, renewal, retirement, training guard, and international tournament lifecycle.");


// The career engine embedded in the deployed HTML must stay behaviorally aligned with source.
const fs = require("node:fs");
const vm = require("node:vm");
const deployedHtml = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");
const inlineScripts = deployedHtml.split("<script").slice(1).map(part => part.slice(part.indexOf(">") + 1, part.indexOf("</script>")));
const careerBundle = inlineScripts.find(script => script.includes("window.LWCareer ="));
assert.ok(careerBundle, "deployed HTML must contain the career engine");
const deployedContext = { window: {} };
vm.createContext(deployedContext);
vm.runInContext(careerBundle, deployedContext, { filename: "index.html career bundle" });
const deployedCareer = deployedContext.window.LWCareer;
assert.ok(deployedCareer && typeof deployedCareer.matchDevelopment === "function", "deployed career engine must initialise");

for (const position of Object.keys(expectedPlans)) {
  assert.equal(JSON.stringify(deployedCareer.positionDevelopmentPlan({ pos: position })),
    JSON.stringify(career.positionDevelopmentPlan({ pos: position })),
    "deployed/source development plan drift for " + position);
  for (const skill of ["goalkeeping", "defending", "speed", "fitness", "passing", "vision", "composure", "dribbling", "shooting"]) {
    assert.equal(deployedCareer.trainingFocusMultiplier({ pos: position }, skill),
      career.trainingFocusMultiplier({ pos: position }, skill),
      "deployed/source training multiplier drift for " + position + "/" + skill);
  }
}

const parityState = () => ({
  pos: "مهاجم", age: 24, season: 2, apps: 0, money: 1000, weeklyWage: 500,
  contractSeasons: 3, freeAgent: false, daysSinceNegotiation: 7,
  shooting: 65, dribbling: 60, passing: 58, speed: 62, fitness: 64, composure: 65,
  vision: 60, goalkeeping: 45, defending: 45, energy: 100, fatigue: 0,
  playerPotential: 88, randomSeed: 1234, careerAwards: [], seasonLog: [], careerMatchHistory: [],
  playedToday: false, trainedToday: false, injuryDays: 0, trainingIntensity: "normal", progressionMatchIds: []
});
const sourceParityState = parityState();
const deployedParityState = parityState();
const parityMatch = { matchId: "deployed-parity-001", minutes: 83, rating: 7.6, goals: 1, assists: 0, competitionKey: "league|parity" };
assert.equal(JSON.stringify(deployedCareer.matchDevelopment(deployedParityState, parityMatch)),
  JSON.stringify(career.matchDevelopment(sourceParityState, parityMatch)),
  "deployed/source match progression result must match");
assert.equal(JSON.stringify(deployedParityState), JSON.stringify(sourceParityState),
  "deployed/source match progression state must match");

const sourcePurchaseState = { money: 1000, retired: false, speed: 60, dribbling: 60 };
const deployedPurchaseState = { ...sourcePurchaseState };
const purchaseItem = { id: "speedBoots", price: 250 };
assert.equal(JSON.stringify(deployedCareer.purchaseItem(deployedPurchaseState, purchaseItem)),
  JSON.stringify(career.purchaseItem(sourcePurchaseState, purchaseItem)),
  "deployed/source purchase result must match");
assert.equal(JSON.stringify(deployedPurchaseState), JSON.stringify(sourcePurchaseState),
  "deployed/source purchase state must match");
