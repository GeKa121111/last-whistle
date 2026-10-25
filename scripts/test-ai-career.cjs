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
console.log("PASS: local career AI covers position-aware coaching, match tactics, adaptive opponents, transfer fit, and life/contract recommendations.");
