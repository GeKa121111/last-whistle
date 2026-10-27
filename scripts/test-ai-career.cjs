"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "public", "ai-career-engine.js"), "utf8");
const sandbox = { window: {}, console };
vm.createContext(sandbox);
new vm.Script(source, { filename: "public/ai-career-engine.js" }).runInContext(sandbox);
const ai = sandbox.window.LWCareerAI;
assert.ok(ai && ai.version === 1, "career AI module must initialize");

const injured = ai.coachAdvice({
  pos: "مهاجم", injuryDays: 4, energy: 90, fatigue: 10, trust: 70, morale: 70,
  shooting: 65, seasonGoals: 2, lastRating: 7.2
}, 70);
assert.equal(injured.page, "wellness", "injury must override performance and trigger a recovery recommendation");
assert.ok(injured.summary.includes("4 يوم"));

const tired = ai.coachAdvice({
  pos: "جناح", injuryDays: 0, energy: 22, fatigue: 81, trust: 50, morale: 55,
  speed: 70, dribbling: 68, lastRating: 7
}, 68);
assert.equal(tired.page, "wellness", "low energy and high fatigue must recommend recovery");
assert.ok(tired.score >= 0 && tired.score <= 100, "career readiness score must be bounded");

const winger = ai.coachAdvice({
  pos: "جناح", injuryDays: 0, energy: 85, fatigue: 20, trust: 65, morale: 72,
  speed: 59, dribbling: 55, lastRating: 7.4
}, 68);
assert.equal(winger.focus, "speed", "a winger must receive a position-specific primary focus");

const mobileForwardAdvice = ai.coachAdvice({
  pos: "مهاجم", injuryDays: 0, energy: 85, fatigue: 20, trust: 65, morale: 72,
  dribbling: 59, speed: 55, shooting: 64, lastRating: 7.4
}, 68);
assert.equal(mobileForwardAdvice.focus, "dribbling",
  "a mobile forward should be coached first on dribbling and movement");
const centreStrikerAdvice = ai.coachAdvice({
  pos: "رأس حربة", injuryDays: 0, energy: 85, fatigue: 20, trust: 65, morale: 72,
  shooting: 59, composure: 55, physical: 58, lastRating: 7.4
}, 68);
assert.equal(centreStrikerAdvice.focus, "shooting",
  "a centre striker should be coached first on finishing/shooting");

const newestForm = ai.formRating({
  careerMatchHistory: [
    ...Array.from({ length: 5 }, (_, i) => ({ scope: "league", rating: 8.8 - i * 0.1, matchId: "new-" + i })),
    ...Array.from({ length: 5 }, (_, i) => ({ scope: "league", rating: 4.8 + i * 0.1, matchId: "old-" + i }))
  ],
  lastRating: 6.0
});
assert.ok(newestForm > 8.4 && newestForm < 8.8,
  "adaptive coaching must prioritize the newest five matches, not the oldest rows in newest-first match history");

const playedForm = ai.formRating({
  careerMatchHistory: [
    { scope: "league", minutes: 0, rating: 0, matchId: "bench-1" },
    { scope: "league", minutes: 0, rating: 0, matchId: "suspension-1" },
    { scope: "league", minutes: 90, rating: 7.6, matchId: "played-1" },
    { scope: "league", minutes: 85, rating: 7.4, matchId: "played-2" }
  ],
  lastRating: 6.0
});
assert.equal(playedForm, 7.5,
  "bench or suspended appearances with zero minutes must not count as poor performance");

const strongPlan = ai.recommendPlayerTactic({
  pos: "مهاجم", energy: 90, fatigue: 15, trust: 72, morale: 80, clubPower: 76,
  seasonGoals: 8
}, 84, { name: "منافس أضعف", power: 54 });
assert.equal(strongPlan.tactic, "attack", "a strong team should be advised to attack a substantially weaker opponent");
const underdogPlan = ai.recommendPlayerTactic({
  pos: "جناح", energy: 80, fatigue: 15, trust: 55, morale: 55, clubPower: 48
}, 58, { name: "منافس قوي", power: 83 });
assert.equal(underdogPlan.tactic, "counter", "an underdog should be advised to use counter attacks");

assert.equal(ai.chooseOpponentTactic({
  state: { pos: "مهاجم", energy: 80, fatigue: 15, trust: 70, morale: 70, seasonGoals: 2, lastRating: 7 },
  ourTactic: "attack", teamPower: 70, opponentPower: 70, overall: 70
}).tactic, "counter", "the opponent should adapt with counter-attacks to an aggressive player tactic");
assert.equal(ai.chooseOpponentTactic({
  state: { pos: "مهاجم", energy: 80, fatigue: 15, trust: 70, morale: 70, seasonGoals: 8, lastRating: 8.2 },
  ourTactic: "balanced", teamPower: 80, opponentPower: 66, overall: 86
}).tactic, "compact", "a dangerous player should provoke a compact defensive response");
assert.equal(ai.chooseOpponentTactic({
  state: { pos: "وسط دفاعي", energy: 80, fatigue: 15 }, ourTactic: "balanced",
  teamPower: 58, opponentPower: 78, overall: 60
}).tactic, "press", "a stronger opponent should be able to choose high pressure");

const clubs = [
  { name: "النادي الحالي", country: "مصر", ovr: 61, prestige: 55 },
  { name: "نادي قريب", country: "مصر", ovr: 65, prestige: 72 },
  { name: "نادي طموح", country: "إسبانيا", ovr: 72, prestige: 90 },
  { name: "نادي غير مناسب", country: "إنجلترا", ovr: 99, prestige: 100 }
];
const recommendations = ai.recommendTransfers({
  clubName: "النادي الحالي", leagueCountry: "مصر", age: 21
}, clubs, 61);
assert.ok(recommendations.length > 0 && recommendations.length <= 3, "the agent must return up to three recommendations");
assert.ok(recommendations.every(row => row.name !== "النادي الحالي"), "the current club must not be recommended as a transfer destination");
assert.ok(recommendations.every(row => Number.isFinite(row.score) === false), "recommendation internals must not leak into UI result objects");
assert.ok(recommendations.every(row => row.gap <= 18), "unrealistic elite jumps must be filtered out");

const life = ai.lifestyleAdvice({ energy: 88, fatigue: 12, money: 500, weeklyWage: 300, contractSeasons: 1 });
assert.equal(life.page, "contract", "an expiring contract should surface a contract review");

const academyState = {
  age: 16, season: 2, calendarDay: 80, role: "ناشئ", youthAcademy: true,
  clubName: "الأهلي", pos: "جناح", ovr: 58, energy: 84, fatigue: 15, trust: 57,
  coachRelationship: 57, contractSeasons: 2, careerMatchHistory: [
    { matchId: "academy-1", minutes: 72, rating: 7.6, goals: 1, assists: 1, teamGoals: 2, oppGoals: 1 },
    { matchId: "academy-2", minutes: 50, rating: 7.1, goals: 0, assists: 0, teamGoals: 1, oppGoals: 1 }
  ], league: [{ name: "الأهلي", pts: 31, rank: 3 }]
};
const academyAdvice = ai.coachAdvice(academyState, 58);
assert.equal(academyAdvice.id, "academy-development", "academy players must receive age-stage-specific advice");
assert.equal(academyAdvice.context.stage, "academy");
assert.equal(academyAdvice.context.lastResult.outcome, "win", "context must read the latest match result");
assert.equal(academyAdvice.context.goalsLastFive, 1, "context must aggregate recent goals");
assert.equal(academyAdvice.context.assistsLastFive, 1, "context must aggregate recent assists");
assert.equal(academyAdvice.context.leaguePosition, 3, "context must read the player's team position");
assert.ok(academyAdvice.utilities.development > 0, "the advice must include transparent utility scores");
const highFormRows = [{ scope: "league", minutes: 90, rating: 8.1, goals: 0, assists: 0, teamGoals: 0, oppGoals: 1, matchId: "loss-high-form" }];
const highFormLoss = ai.utilityScores({ pos: "وسط دفاعي", age: 25, energy: 85, fatigue: 15, trust: 65,
  contractSeasons: 3, careerMatchHistory: highFormRows }, 70);
const highFormWin = ai.utilityScores({ pos: "وسط دفاعي", age: 25, energy: 85, fatigue: 15, trust: 65,
  contractSeasons: 3, careerMatchHistory: [{ ...highFormRows[0], teamGoals: 2, oppGoals: 0, matchId: "win-high-form" }] }, 70);
assert.equal(highFormLoss.form, highFormWin.form,
  "a strong individual rating must not receive a poor-form penalty just because the team lost");
const poorFormLoss = ai.utilityScores({ pos: "وسط دفاعي", age: 25, energy: 85, fatigue: 15, trust: 65,
  contractSeasons: 3, careerMatchHistory: [{ ...highFormRows[0], rating: 5.2, teamGoals: 0, oppGoals: 2 }] }, 70);
const poorFormWin = ai.utilityScores({ pos: "وسط دفاعي", age: 25, energy: 85, fatigue: 15, trust: 65,
  contractSeasons: 3, careerMatchHistory: [{ ...highFormRows[0], rating: 5.2, teamGoals: 2, oppGoals: 0 }] }, 70);
assert.equal(poorFormLoss.form, poorFormWin.form + 2,
  "team result may contextualize genuinely poor recent individual form, not replace it");
const defensiveLoss = ai.utilityScores({ pos: "قلب دفاع", age: 25, energy: 85, fatigue: 15, trust: 65,
  contractSeasons: 3, careerMatchHistory: [{ ...highFormRows[0], rating: 5.8, tackles: 5, interceptions: 3,
    teamGoals: 0, oppGoals: 2, matchId: "defender-loss-with-actions" }] }, 70);
const defensiveWin = ai.utilityScores({ pos: "قلب دفاع", age: 25, energy: 85, fatigue: 15, trust: 65,
  contractSeasons: 3, careerMatchHistory: [{ ...highFormRows[0], rating: 5.8, tackles: 5, interceptions: 3,
    teamGoals: 2, oppGoals: 0, matchId: "defender-win-with-actions" }] }, 70);
assert.equal(defensiveLoss.form, defensiveWin.form,
  "a defender with meaningful tackles and interceptions must not receive an extra loss penalty");
const defensiveContext = ai.contextSnapshot({ pos: "قلب دفاع", careerMatchHistory: [{ minutes: 90, rating: 5.8,
  tackles: 5, interceptions: 3, teamGoals: 0, oppGoals: 2 }] }, 70);
assert.equal(defensiveContext.tacklesLastFive, 5);
assert.equal(defensiveContext.interceptionsLastFive, 3);
const goalkeeperContext = ai.contextSnapshot({ pos: "حارس مرمى", careerMatchHistory: [{ minutes: 90, rating: 5.9,
  saves: 4, cleanSheet: true, teamGoals: 0, oppGoals: 0 }] }, 70);
assert.equal(goalkeeperContext.roleContributionLastFive, true,
  "goalkeeper saves and a clean sheet count as individual contribution");
assert.equal(ai.recordRecommendation(academyState, academyAdvice), true, "the AI must persist a new recommendation into its seasonal ledger");
assert.equal(ai.recordRecommendation(academyState, academyAdvice), false, "the same recommendation must not be recorded twice in a season");
const changedAdvice = ai.coachAdvice(academyState, 58);
assert.notEqual(changedAdvice.id, academyAdvice.id, "repeated same-season advice should rotate to a distinct non-repeated recommendation");
const beforeRelationship = academyState.coachRelationship;
const decision = ai.recordDecision(academyState, { type: "criticize-coach", followUpDays: 14 });
assert.ok(decision && decision.consequence === "coach-trust-risk");
assert.ok(academyState.coachRelationship < beforeRelationship, "a remembered decision must affect the player-coach relationship");
academyState.calendarDay += 15;
assert.ok(ai.decisionConsequences(academyState).some(row => row.decisionId === decision.id),
  "the memory ledger must surface a consequence after its follow-up date");

console.log("PASS: local career AI covers position-aware coaching, match tactics, adaptive opponents, transfer fit, and life/contract recommendations.");
