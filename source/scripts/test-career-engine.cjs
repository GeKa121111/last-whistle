#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
global.window = global;
require(path.join(__dirname, "..", "public", "data", "career-engine.js"));
const career = global.LWCareer;
assert.ok(career, "career engine must export LWCareer");

const deduped = career.uniqueMatchRows([
  { id: "match-1", minutes: 90 }, { id: "match-1", minutes: 90 },
  { id: "match-2", minutes: 30 }
]);
assert.equal(deduped.length, 2, "match history must deduplicate explicit match IDs");
assert.equal(career.leagueMatchTarget(20), 38);
assert.equal(career.leagueMatchDaysRemaining(10, 14, 7), 3);
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
