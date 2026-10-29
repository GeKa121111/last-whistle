#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
global.window = global;
require(path.join(__dirname, "..", "public", "data", "career-engine.js"));
const career = global.LWCareer;
assert.ok(career, "career engine must export LWCareer");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const rootHtml = fs.readFileSync(path.join(repositoryRoot, "index.html"), "utf8");
const publicHtml = fs.readFileSync(path.join(repositoryRoot, "public", "index.html"), "utf8");
assert.equal(rootHtml, publicHtml, "root and public app shells must stay synchronized");
assert.ok(rootHtml.includes("Number(state.nationalTournamentMatches)>=3&&state.nationalTournamentQualified!==true"),
  "an unqualified national team must not be offered a final match");
const serviceWorkerCopies = ["sw.js", "public/sw.js"]
  .map(file => fs.readFileSync(path.join(repositoryRoot, file), "utf8"));
assert.equal(serviceWorkerCopies[0], serviceWorkerCopies[1], "root and public service workers must stay synchronized");
assert.ok(serviceWorkerCopies[0].includes("last-whistle-static-v153"), "PWA cache must advance for international tournament changes");
assert.ok(serviceWorkerCopies[0].includes("data/career-engine.js?v=20"), "the cached career engine asset version must advance");
const engineCopies = ["data/career-engine.js", "source/public/data/career-engine.js", "public/data/career-engine.js"]
  .map(file => fs.readFileSync(path.join(repositoryRoot, file), "utf8"));
assert.ok(engineCopies.every(content => content === engineCopies[0]), "all career engine copies must stay synchronized");
assert.equal(career.calendarGameDateISO({ calendarDay: 1 }), "2024-08-01T00:00:00.000Z",
  "career award dates must start on the in-game season date, not the machine clock");
assert.equal(career.calendarGameDateISO({ calendarDay: 366 }), "2025-08-01T00:00:00.000Z",
  "the in-game date must advance deterministically across season boundaries");
const inlineDateStart = rootHtml.indexOf("function calendarGameDateISO(state)");
const inlineDateEnd = rootHtml.indexOf("\nfunction ", inlineDateStart + 10);
assert.ok(inlineDateStart >= 0 && inlineDateEnd > inlineDateStart,
  "the app shell must include the same game-calendar date helper");
const inlineDateContext = {};
vm.createContext(inlineDateContext);
vm.runInContext(rootHtml.slice(inlineDateStart, inlineDateEnd)
  + "\nthis.calendarGameDateISO = calendarGameDateISO;", inlineDateContext);
assert.equal(inlineDateContext.calendarGameDateISO({ calendarDay: 1 }), "2024-08-01T00:00:00.000Z",
  "the browser career engine must use the same game-calendar date");
assert.ok(rootHtml.includes('const log = uniqueMatchRows(Array.isArray(state.seasonLog) ? state.seasonLog : []);'),
  "the inline browser award engine must deduplicate repeated match rows");
assert.ok(rootHtml.includes("const awardCount = value => {"),
  "the inline browser award engine must normalize malformed goals and assists");
assert.ok(rootHtml.includes("const awardMinutes = value => {") && rootHtml.includes("const awardRating = value => {"),
  "the inline browser award engine must reject non-finite minutes and ratings");
const duplicateAwardState = {
  age: 24, pos: "مهاجم", clubName: "Test FC", leagueCountry: "England",
  leagueCompetition: "Test League", season: 1, calendarDay: 120, money: 0,
  topScorerAwards: 0, careerAwards: [],
  seasonLog: [
    { matchId: "award-match-1", leagueCountry: "England", leagueCompetition: "Test League", minutes: 90, rating: 8, goals: 1, assists: 0 },
    { matchId: "award-match-2", leagueCountry: "England", leagueCompetition: "Test League", minutes: 90, rating: 8, goals: 1, assists: 0 },
    { matchId: "award-match-3", leagueCountry: "England", leagueCompetition: "Test League", minutes: 90, rating: 8, goals: 1, assists: 0 },
    { matchId: "award-match-1", leagueCountry: "England", leagueCompetition: "Test League", minutes: 90, rating: 8, goals: 1, assists: 0 }
  ]
};
career.seasonAwards(duplicateAwardState, [{ name: "Test FC", power: 50 }], 1);
const duplicateAwardBoot = duplicateAwardState.careerAwards.find(award => award.id === "golden-boot");
assert.ok(duplicateAwardBoot, "three unique league goals must qualify for the simulated golden boot");
assert.equal(duplicateAwardBoot.note, "3 هدف في 3 مشاركة",
  "a repeated match record must not inflate award goals or appearances");
assert.equal(duplicateAwardState.topScorerAwards, 1,
  "a duplicated match must not grant the same season's golden-boot counter twice");
assert.equal(duplicateAwardState.money, 1100,
  "award rewards must be calculated from unique match rows only");

const malformedAwardState = {
  age: 24, pos: "مهاجم", clubName: "Test FC", leagueCountry: "England",
  leagueCompetition: "Test League", season: 1, calendarDay: 120,
  money: Infinity, topScorerAwards: Infinity, careerAwards: [],
  seasonLog: [
    { matchId: "malformed-award-1", leagueCountry: "England", leagueCompetition: "Test League", minutes: 90, rating: 8, goals: 0, assists: 0 },
    { matchId: "malformed-award-2", leagueCountry: "England", leagueCompetition: "Test League", minutes: 90, rating: 8, goals: 0, assists: 0 },
    { matchId: "malformed-award-3", leagueCountry: "England", leagueCompetition: "Test League", minutes: 90, rating: 8, goals: 0, assists: 0 },
    { matchId: "malformed-award-4", leagueCountry: "England", leagueCompetition: "Test League", minutes: 90, rating: Infinity, goals: Infinity, assists: NaN }
  ]
};
career.seasonAwards(malformedAwardState, [{ name: "Test FC", power: 50 }], 1);
assert.equal(malformedAwardState.careerAwards.length, 0,
  "non-finite match stats must not manufacture season awards");
assert.equal(malformedAwardState.money, 0,
  "an invalid saved balance must be normalized before award payouts");
assert.equal(malformedAwardState.topScorerAwards, 0,
  "an invalid scorer-award counter must be normalized without granting an award");
assert.ok(Number.isFinite(malformedAwardState.money),
  "award processing must leave a finite balance after malformed match stats");


const inlineRangesStart = rootHtml.indexOf("  const STARTING_RANGES = {");
const inlineStatsStart = rootHtml.indexOf("  function startingStatsForPosition(position", inlineRangesStart);
const inlineStatsEnd = rootHtml.indexOf("\n\n  function uniqueMatchRows", inlineStatsStart);
assert.ok(inlineRangesStart >= 0 && inlineStatsStart > inlineRangesStart && inlineStatsEnd > inlineStatsStart,
  "inline career starting-stat source must remain extractable for regression testing");
const inlineContext = { Math };
vm.createContext(inlineContext);
vm.runInContext(rootHtml.slice(inlineRangesStart, inlineStatsEnd) +
  "\nthis.startingStatsForPosition = startingStatsForPosition;", inlineContext);
for (const position of ["قلب دفاع", "ظهير", "وسط دفاعي", "وسط مهاجم", "جناح", "مهاجم", "رأس حربة"]) {
  assert.equal(inlineContext.startingStatsForPosition(position, () => 0.5).goalkeeping, 0,
    "inline app must give zero goalkeeper skill to " + position);
}
assert.ok(inlineContext.startingStatsForPosition("حارس مرمى", () => 0.5).goalkeeping > 0,
  "inline app must preserve goalkeeper specialization");
assert.ok(rootHtml.includes('if (state.pos && state.pos !== "حارس مرمى") state.goalkeeping = 0;'),
  "inline app must normalize legacy outfield saves");

const expectedPlans = {
  "حارس مرمى": { primary: "goalkeeping", secondary: ["composure", "passing", "fitness"] },
  "قلب دفاع": { primary: "defending", secondary: ["composure", "fitness", "passing"] },
  "ظهير": { primary: "speed", secondary: ["passing", "defending"] },
  "وسط دفاعي": { primary: "defending", secondary: ["vision", "fitness", "composure"] },
  "وسط مهاجم": { primary: "vision", secondary: ["composure", "dribbling", "shooting"] },
  "جناح": { primary: "dribbling", secondary: ["shooting", "vision", "fitness"] },
  "مهاجم": { primary: ["dribbling", "speed"], secondary: ["shooting", "vision", "passing", "composure"] },
  "رأس حربة": { primary: "shooting", secondary: ["composure", "physical", "fitness", "speed"] }
};
for (const [position, expected] of Object.entries(expectedPlans)) {
  const plan = career.positionDevelopmentPlan({ pos: position });
  assert.equal(plan.position, position, "development plan must match selected position");
  assert.ok(plan.title && plan.summary, "every position must have an explanatory plan");
  const primarySkills = Array.isArray(expected.primary) ? expected.primary : [expected.primary];
  for (const skill of primarySkills) assert.ok(plan.primary.includes(skill), "missing primary focus " + skill + " for " + position);
  for (const skill of expected.secondary) assert.ok(plan.secondary.includes(skill), "missing support skill " + skill + " for " + position);
  assert.equal(career.trainingFocusMultiplier({ pos: position }, primarySkills[0]), 1.2, "primary focus should grant 20% bonus");
  assert.equal(career.trainingFocusMultiplier({ pos: position }, expected.secondary[0]), 1.08, "support focus should grant 8% bonus");
  assert.equal(career.trainingFocusMultiplier({ pos: position }, "not-a-skill"), 1, "off-plan skills remain trainable without a bonus");
}
assert.equal(career.trainingFocusMultiplier({ pos: "حارس مرمى" }, "goalkeeping"), 1.2);
assert.equal(career.trainingFocusMultiplier({ pos: "جناح" }, "goalkeeping"), 1);

// New-position baseline matrix: specialisms must no longer start at a universal 50.
const between = (value, min, max, label) => assert.ok(value >= min && value <= max, label + ": " + value + " is outside " + min + "-" + max);
const startRanges = {
  "مهاجم": { shooting:[53,65], dribbling:[56,68], speed:[57,69], passing:[50,61], vision:[51,62], fitness:[51,62], defending:[15,28], goalkeeping:[0,0] },
  "رأس حربة": { shooting:[60,72], dribbling:[44,57], speed:[48,61], passing:[42,54], vision:[42,54], fitness:[49,61], composure:[54,65], physical:[53,65], defending:[15,28], goalkeeping:[0,0] },
  "جناح": { shooting:[55,68], dribbling:[55,68], speed:[55,68], passing:[50,60], vision:[50,60], fitness:[50,60], defending:[15,28], goalkeeping:[0,0] },
  "وسط مهاجم": { passing:[55,65], vision:[55,65], composure:[55,65], fitness:[55,65], defending:[35,45], goalkeeping:[0,0] },
  "وسط دفاعي": { passing:[55,65], vision:[55,65], composure:[55,65], fitness:[55,65], defending:[52,62], goalkeeping:[0,0] },
  "قلب دفاع": { defending:[55,66], fitness:[55,66], speed:[55,66], passing:[45,55], composure:[45,55], shooting:[25,40], goalkeeping:[0,0] },
  "ظهير": { defending:[55,66], fitness:[55,66], speed:[55,66], passing:[45,55], composure:[45,55], shooting:[25,40], goalkeeping:[0,0] },
  "حارس مرمى": { goalkeeping:[58,68], composure:[58,68], vision:[58,68], shooting:[15,35], defending:[15,35] }
};
for (const [position, ranges] of Object.entries(startRanges)) {
  const stats = career.startingStatsForPosition(position, () => 0.5);
  assert.equal(Object.keys(stats).length, 10, "all 10 skills must be initialized for " + position);
  for (const [skill, range] of Object.entries(ranges)) between(stats[skill], range[0], range[1], position + "/" + skill);
  assert.ok(Number.isFinite(career.overall({ ...stats, pos: position, trainingXP: {}, randomSeed: 1, playerPotential: 85 })), "weighted OVR must exist for " + position);
}
for (const [savedSessions, expectedSessions] of [
  [Infinity, 0], ["Infinity", 0], [NaN, 0], [-4, 0], [3.9, 3], [7, 7]
]) {
  const repaired = { pos: "جناح", trainingSessions: savedSessions, trainingXP: {} };
  career.ensureState(repaired);
  assert.equal(repaired.trainingSessions, expectedSessions,
    "legacy training-session counters must be finite, non-negative whole numbers");
}
assert.ok(rootHtml.includes("state.trainingSessions = finiteCount(state.trainingSessions);"),
  "the inline browser career engine must normalize legacy training-session counters");
for (const [savedDays, expectedDays] of [
  [Infinity, 0], ["Infinity", 0], [NaN, 0], [-3, 0], [3.9, 3], [21, 21], [999, 60]
]) {
  const repaired = { pos: "جناح", injuryDays: savedDays, trainingXP: {} };
  career.ensureState(repaired);
  assert.equal(repaired.injuryDays, expectedDays,
    "legacy injury duration must be finite, non-negative, integral, and bounded");
}
assert.ok(rootHtml.includes("state.injuryDays = Math.min(60, finiteCount(state.injuryDays));"),
  "the inline browser career engine must normalize legacy injury durations");

const legacyOutfield = {
  pos: "جناح", goalkeeping: 73, shooting: 66, money: 5000,
  trainingXP: { goalkeeping: 12 }, playerPotential: 85, randomSeed: 1
};
career.ensureState(legacyOutfield);
assert.equal(legacyOutfield.goalkeeping, 0, "legacy outfield saves must lose invalid goalkeeper skill");
assert.equal(legacyOutfield.shooting, 66, "migration must preserve unrelated player skills");
assert.equal(legacyOutfield.money, 5000, "migration must preserve career finances");
assert.equal(legacyOutfield.trainingXP.goalkeeping, 12, "migration must not discard saved training history");
const legacyKeeper = { pos: "حارس مرمى", goalkeeping: 64, trainingXP: {}, playerPotential: 85, randomSeed: 2 };
career.ensureState(legacyKeeper);
assert.equal(legacyKeeper.goalkeeping, 64, "goalkeeper saves must retain their specialist skill");
const wingerStats = career.startingStatsForPosition("جناح", () => 0.5);
const keeperStats = career.startingStatsForPosition("حارس مرمى", () => 0.5);
assert.ok(keeperStats.goalkeeping > wingerStats.goalkeeping, "keeper OVR should reward goalkeeping instead of averaging all skills equally");
assert.ok(wingerStats.shooting > wingerStats.goalkeeping, "winger must not start with goalkeeper-level stats");

const mobileForward = career.positionDevelopmentPlan({ pos: "مهاجم" });
const centreStriker = career.positionDevelopmentPlan({ pos: "رأس حربة" });
assert.notDeepEqual(mobileForward.primary, centreStriker.primary,
  "a mobile forward and a centre striker need different development priorities");
assert.equal(mobileForward.matchSkill, "dribbling", "the mobile forward's role-defining match skill is dribbling");
assert.equal(centreStriker.matchSkill, "shooting", "the centre striker's role-defining match skill is finishing/shooting");
assert.equal(career.trainingFocusMultiplier({ pos: "مهاجم" }, "dribbling"), 1.2);
assert.equal(career.trainingFocusMultiplier({ pos: "رأس حربة" }, "shooting"), 1.2);
const positionProbe = { shooting:60, dribbling:60, passing:60, speed:60, fitness:60, composure:60,
  vision:60, defending:60, goalkeeping:60, physical:60, age:22, playerPotential:85, trainingXP:{}, randomSeed:7 };
const mobileBaselineOVR = career.overall({ ...positionProbe, pos: "مهاجم" });
const mobileHighShotOVR = career.overall({ ...positionProbe, pos: "مهاجم", shooting:80 });
const strikerBaselineOVR = career.overall({ ...positionProbe, pos: "رأس حربة" });
const strikerHighShotOVR = career.overall({ ...positionProbe, pos: "رأس حربة", shooting:80 });
const mobileHighDribbleOVR = career.overall({ ...positionProbe, pos: "مهاجم", dribbling:80 });
const strikerHighDribbleOVR = career.overall({ ...positionProbe, pos: "رأس حربة", dribbling:80 });
assert.ok(strikerHighShotOVR - strikerBaselineOVR > mobileHighShotOVR - mobileBaselineOVR,
  "shooting improvement should count more for a centre striker than for a mobile forward");
assert.ok(mobileHighDribbleOVR - mobileBaselineOVR > strikerHighDribbleOVR - strikerBaselineOVR,
  "dribbling improvement should count more for a mobile forward than for a centre striker");
const wingerBase = { ...wingerStats, pos: "جناح", trainingXP: {}, randomSeed: 1, playerPotential: 85 };
const wingerWithEliteKeeping = { ...wingerBase, goalkeeping: 99 };
assert.equal(career.overall(wingerBase), career.overall(wingerWithEliteKeeping), "irrelevant goalkeeper stats must not inflate a winger's OVR");
const keeperBase = { ...keeperStats, pos: "حارس مرمى", trainingXP: {}, randomSeed: 1, playerPotential: 85 };
const keeperWithEliteShooting = { ...keeperBase, shooting: 99 };
assert.equal(career.overall(keeperBase), career.overall(keeperWithEliteShooting), "irrelevant shooting stats must not inflate a goalkeeper's OVR");
assert.equal(career.trainingFocusMultiplier({ pos: "قلب دفاع" }, "physical"), 1.2, "physical training is a primary defender focus");
assert.equal(career.trainingFocusMultiplier({ pos: "حارس مرمى" }, "physical"), 1);


const deduped = career.uniqueMatchRows([
  { id: "match-1", minutes: 90 }, { id: "match-1", minutes: 90 },
  { id: "match-2", minutes: 30 }
]);
assert.equal(deduped.length, 2, "match history must deduplicate explicit match IDs");
assert.equal(career.leagueMatchTarget(16), 30, "a 16-team league must schedule 30 matches");
assert.equal(career.leagueMatchTarget(18), 34, "an 18-team league must schedule 34 matches");
assert.equal(career.leagueMatchTarget(20), 38, "a 20-team league must schedule 38 matches");
assert.equal(career.leagueMatchDaysRemaining(10, 14, 7), 3);
assert.equal(career.leagueMatchDaysRemaining(10, 14, 5), 1, "the new calendar enforces a 5-day league gap");
assert.equal(career.leagueMatchDaysRemaining(10, 14), 1, "the default league match gap is five days");
assert.equal(career.leagueMatchDaysRemaining(10, 15, 5), 0, "a league match is available after five elapsed days");
assert.equal(career.normalizeLeagueRoundIndex(undefined, [{ matchday: 7 }, { matchday: 9 }], 8, 30), 9);
assert.equal(career.normalizeLeagueRoundIndex(99, [], 0, 12), 12);
assert.equal(career.normalizeLeagueRoundIndex(3.8, [], 0, 30), 3,
  "a fractional saved round index must be floored instead of discarded");
assert.equal(career.normalizeLeagueRoundIndex(undefined, [{ matchday: 4.7 }], 2.2, 30), 4,
  "fractional matchday metadata must be normalized to a whole round");
assert.equal(career.normalizeLeagueRoundIndex(undefined, [], 2.7, 30), 2,
  "a fractional legacy league appearance count must be normalized to a whole round");
assert.equal(career.normalizeLeagueRoundIndex(3, [{ matchday: 7 }, { matchday: 9 }], 8, 30), 9,
  "a stale saved round index must not roll back behind persisted match history");
assert.equal(career.normalizeLeagueRoundIndex(11, [{ matchday: 9 }], 8, 30), 11,
  "a newer saved round index must still be preserved when history is compacted");
assert.equal(career.normalizeLeagueRoundIndex(undefined, [{ opponent: "A" }, { opponent: "B" }], 8, 30), 8,
  "legacy match history without matchday metadata must fall back to league appearances");
assert.equal(career.normalizeLeagueRoundIndex(3, [{ opponent: "A" }], 8, 30), 8,
  "a stale saved index must not ignore league appearances when legacy history lacks matchday metadata");
assert.equal(career.normalizeLeagueRoundIndex(undefined, [{ matchday: Infinity }], 0, 34), 0,
  "non-finite matchday metadata must not mark the league complete");
assert.equal(career.normalizeLeagueRoundIndex(undefined, [], Infinity, 34), 0,
  "non-finite legacy league appearances must not mark the league complete");
assert.equal(career.normalizeLeagueRoundIndex(Infinity, [{ matchday: 5 }], 0, 34), 5,
  "a non-finite saved index must fall back to valid persisted match history");
assert.equal(career.normalizeLeagueRoundIndex(3, [], 0, Infinity), 0,
  "a non-finite round count must not create an invalid league index");
const inlineRoundStart = rootHtml.indexOf("const toNonNegativeInteger = value => {");
const inlineNormalizeStart = rootHtml.indexOf("function normalizeLeagueRoundIndex(", inlineRoundStart);
const inlineRoundEnd = rootHtml.indexOf("\n  function ", inlineNormalizeStart + 10);
assert.ok(inlineRoundStart >= 0 && inlineNormalizeStart > inlineRoundStart && inlineRoundEnd > inlineNormalizeStart,
  "the inline browser engine must expose the integer helper and league-round normalizer for regression testing");
const inlineRoundContext = {};
vm.createContext(inlineRoundContext);
vm.runInContext(rootHtml.slice(inlineRoundStart, inlineRoundEnd)
  + "\nthis.normalizeLeagueRoundIndex = normalizeLeagueRoundIndex;", inlineRoundContext);
assert.equal(inlineRoundContext.normalizeLeagueRoundIndex(undefined, [{ matchday: Infinity }], 0, 34), 0,
  "the inline browser engine must ignore non-finite matchday values");
assert.equal(inlineRoundContext.normalizeLeagueRoundIndex(undefined, [], Infinity, 34), 0,
  "the inline browser engine must ignore non-finite legacy appearance counts");
const inlineCareerXPStart = rootHtml.indexOf("function addCareerXP(state, amount)");
const inlineCareerXPEnd = rootHtml.indexOf("\n  function train(", inlineCareerXPStart + 10);
assert.ok(inlineCareerXPStart >= 0 && inlineCareerXPEnd > inlineCareerXPStart,
  "the inline career XP function must remain extractable for regression testing");
const inlineCareerXPContext = {};
vm.createContext(inlineCareerXPContext);
vm.runInContext(rootHtml.slice(inlineCareerXPStart, inlineCareerXPEnd)
  + "\nthis.addCareerXP = addCareerXP;", inlineCareerXPContext);
const inlineCorruptedXPState = { careerXP: Infinity, levelXP: Infinity, careerLevel: Infinity };
inlineCareerXPContext.addCareerXP(inlineCorruptedXPState, Infinity);
assert.ok(Number.isFinite(inlineCorruptedXPState.careerXP)
  && Number.isFinite(inlineCorruptedXPState.levelXP)
  && Number.isFinite(inlineCorruptedXPState.careerLevel),
  "the inline career XP function must recover safely from non-finite progression values");
assert.ok(rootHtml.includes("Number.isFinite(trainingXPValue)")
  && rootHtml.includes("trainingXPThreshold - 0.01"),
  "the inline engine must sanitize malformed training XP before applying progression");
assert.ok(rootHtml.includes("Number.isFinite(minutesValue)")
  && rootHtml.includes("const safeMatchCount = (value, maximum = 100)"),
  "the inline engine must reject non-finite match minutes and action totals");

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
const blockedMoney = { pos: "جناح", age: 25, money: 1000 };
const blockedPurchase = career.purchaseItem(blockedMoney, { id: "ovrBoost", price: 100 });
assert.equal(blockedPurchase.status, "direct-rating-purchase-disabled", "OVR cannot be bought directly");
assert.equal(blockedMoney.money, 1000, "rejected OVR purchase must not consume money");
assert.equal(blockedMoney.ovrBoost, undefined, "rejected OVR purchase must not mutate the saved career");
const unknownItemState = { pos: "جناح", age: 25, money: 1000 };
const unknownItemPurchase = career.purchaseItem(unknownItemState, { id: "futureMysteryBoost", price: 100 });
assert.equal(unknownItemPurchase.status, "invalid-item", "unknown store item IDs must be rejected");
assert.equal(unknownItemState.money, 1000, "unknown store items must not consume money");
assert.equal(unknownItemState.futureMysteryBoost, undefined, "unknown store items must not mutate the saved career");

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

function makeProgressionFixture(xpMultiplier = false) {
  return {
    pos: "رأس حربة", age: 22, playerPotential: 92, shooting: 62, dribbling: 58,
    passing: 54, speed: 58, fitness: 60, composure: 60, defending: 24,
    goalkeeping: 12, vision: 52, physical: 61, energy: 100, fatigue: 0,
    trainingIntensity: "normal", trainedToday: false, playedToday: false,
    injuryDays: 0, money: 5000, randomSeed: 1234, trainingXP: {},
    careerXP: 0, levelXP: 0, careerLevel: 1, careerMilestonesEarned: [],
    progressionMatchIds: [], competitionStats: {}, qualifyingAppearances: 0,
    careerAppearances: 0, careerMinutes: 0, apps: 0, seasonLog: [],
    xpMultiplier
  };
}
const malformedProgression = makeProgressionFixture(false);
malformedProgression.careerXP = Infinity;
malformedProgression.levelXP = Infinity;
malformedProgression.careerLevel = Infinity;
malformedProgression.trainingXP = { shooting: Infinity, dribbling: 1e308, passing: NaN };
const recoveredMalformedTraining = career.train(malformedProgression, "shooting", { random: () => 0.99 });
assert.equal(recoveredMalformedTraining.ok, true, "malformed progression counters must not freeze training");
assert.ok(Number.isFinite(malformedProgression.careerXP)
  && Number.isFinite(malformedProgression.levelXP)
  && Number.isFinite(malformedProgression.careerLevel),
  "career XP, level XP, and career level must recover from non-finite legacy saves");
assert.ok(Object.values(malformedProgression.trainingXP).every(Number.isFinite),
  "every configured training XP counter must remain finite after save recovery");
assert.ok(malformedProgression.trainingXP.shooting < 108
  && malformedProgression.trainingXP.dribbling < 108,
  "training XP must stay below the age-appropriate threshold so a malformed counter cannot create an infinite loop");

const malformedCareerTotals = makeProgressionFixture(false);
malformedCareerTotals.careerAppearances = Infinity;
malformedCareerTotals.apps = 12;
malformedCareerTotals.careerMinutes = Infinity;
malformedCareerTotals.leagueRatingSum = Infinity;
malformedCareerTotals.leagueRatingCount = Infinity;
malformedCareerTotals.qualifyingAppearances = Infinity;
malformedCareerTotals.competitionStats = {
  "club|old": { appearances: Infinity, qualifyingAppearances: NaN, minutes: Infinity,
    goals: Infinity, assists: Infinity, note: "preserve" }
};
const ignoredMalformedMinutes = career.matchDevelopment(malformedCareerTotals, {
  matchId: "non-finite-minutes", minutes: Infinity, rating: 8, goals: 2, assists: 1
});
assert.equal(ignoredMalformedMinutes.gained, 0, "a match with non-finite minutes must be ignored");
assert.equal(malformedCareerTotals.careerAppearances, 12, "legacy appearances must be recovered from the finite apps counter");
assert.equal(malformedCareerTotals.careerMinutes, 0);
assert.equal(malformedCareerTotals.leagueRatingSum, 0);
assert.equal(malformedCareerTotals.leagueRatingCount, 0);
assert.equal(malformedCareerTotals.qualifyingAppearances, 0);
assert.deepEqual(
  ["appearances", "qualifyingAppearances", "minutes", "goals", "assists"]
    .map(key => malformedCareerTotals.competitionStats["club|old"][key]),
  [0, 0, 0, 0, 0],
  "non-finite competition aggregates must be normalized without dropping unrelated metadata"
);
assert.equal(malformedCareerTotals.competitionStats["club|old"].note, "preserve");

const malformedMatchStats = makeProgressionFixture(false);
malformedMatchStats.pos = "قلب دفاع";
const normalizedMatchStatsResult = career.matchDevelopment(malformedMatchStats, {
  matchId: "non-finite-match-stats", minutes: 90, rating: 8, goals: Infinity, assists: NaN,
  competitionKey: "club|normalized", stats: { tackles: Infinity, interceptions: NaN, saves: Infinity, keyPasses: Infinity }
});
const normalizedCompetition = malformedMatchStats.competitionStats["club|normalized"];
assert.ok(Number.isFinite(normalizedMatchStatsResult.xp)
  && Number.isFinite(normalizedMatchStatsResult.defensiveXP)
  && Number.isFinite(normalizedMatchStatsResult.positionActionXP),
  "malformed match actions must not produce infinite progression XP");
assert.equal(normalizedCompetition.goals, 0);
assert.equal(normalizedCompetition.assists, 0);
assert.equal(normalizedCompetition.minutes, 90);
assert.equal(malformedMatchStats.careerMinutes, 90);
assert.ok(Object.values(normalizedCompetition).filter(value => typeof value === "number").every(Number.isFinite),
  "competition totals must remain finite after malformed match stats");
const ordinaryTraining = career.train(makeProgressionFixture(false), "shooting", { random: () => 0.99 });
const boostedTraining = career.train(makeProgressionFixture(true), "shooting", { random: () => 0.99 });
assert.equal(ordinaryTraining.ok, true);
assert.equal(boostedTraining.ok, true);
assert.ok(boostedTraining.xp > ordinaryTraining.xp, "the store XP multiplier must boost training XP without directly increasing OVR");
const ordinaryMatchXP = career.matchDevelopment(makeProgressionFixture(false), {
  matchId: "ordinary-xp-match", minutes: 90, rating: 8, goals: 1, assists: 0
});
const boostedMatchXP = career.matchDevelopment(makeProgressionFixture(true), {
  matchId: "boosted-xp-match", minutes: 90, rating: 8, goals: 1, assists: 0
});
assert.ok(boostedMatchXP.xp > ordinaryMatchXP.xp, "the store XP multiplier must increase match progression XP");

const quietDefender = makeProgressionFixture(false);
quietDefender.pos = "قلب دفاع";
const activeDefender = makeProgressionFixture(false);
activeDefender.pos = "قلب دفاع";
const quietDefenderResult = career.matchDevelopment(quietDefender, {
  matchId: "quiet-defence-match", minutes: 90, rating: 7.2, goals: 0, assists: 0,
  tackles: 0, interceptions: 0, saves: 0, keyPasses: 0, cleanSheet: false
});
const activeDefenderResult = career.matchDevelopment(activeDefender, {
  matchId: "active-defence-match", minutes: 90, rating: 7.2, goals: 0, assists: 0,
  tackles: 4, interceptions: 3, saves: 0, keyPasses: 0, cleanSheet: true
});
assert.ok(activeDefenderResult.xp > quietDefenderResult.xp, "defensive actions and clean sheets must contribute to match XP");
assert.ok(activeDefenderResult.defensiveXP > 0, "defensive players must bank extra defending-skill XP from tackles and interceptions");
assert.ok(activeDefender.trainingXP.defending > quietDefender.trainingXP.defending,
  "defending skill progress must reflect actual defensive actions");
const inactiveKeeper = makeProgressionFixture(false);
inactiveKeeper.pos = "حارس مرمى";
const activeKeeper = makeProgressionFixture(false);
activeKeeper.pos = "حارس مرمى";
const inactiveKeeperResult = career.matchDevelopment(inactiveKeeper, {
  matchId: "inactive-keeper-match", minutes: 90, rating: 7.2, goals: 0, assists: 0, saves: 0, cleanSheet: false
});
const activeKeeperResult = career.matchDevelopment(activeKeeper, {
  matchId: "active-keeper-match", minutes: 90, rating: 7.2, goals: 0, assists: 0, saves: 5, cleanSheet: true
});
assert.ok(activeKeeperResult.xp > inactiveKeeperResult.xp, "goalkeeper saves and clean sheets must contribute to match XP");
assert.ok(activeKeeperResult.goalkeeperXP > 0, "goalkeeper match actions must explicitly award goalkeeper-skill XP");
assert.ok(activeKeeper.trainingXP.goalkeeping > inactiveKeeper.trainingXP.goalkeeping,
  "saves and clean sheets must advance the goalkeeper skill itself");

const fieldAgeCurve = { pos: "جناح", age: 34, fitness: 75, speed: 80, physical: 70 };
career.applySeasonAging(fieldAgeCurve);
assert.equal(fieldAgeCurve.fitness, 74, "field players should gradually lose fitness from age 30");
assert.equal(fieldAgeCurve.speed, 79, "pace-dependent field roles should start losing speed after age 31");
assert.equal(fieldAgeCurve.physical, 70, "physical decline should not start before the later-career phase");
const veteranFieldCurve = { pos: "قلب دفاع", age: 35, fitness: 75, speed: 80, physical: 70 };
career.applySeasonAging(veteranFieldCurve);
assert.equal(veteranFieldCurve.physical, 69, "older field players should begin a modest physical decline");
const veteranKeeperCurve = { pos: "حارس مرمى", age: 32, fitness: 75, physical: 72 };
career.applySeasonAging(veteranKeeperCurve);
assert.equal(veteranKeeperCurve.fitness, 75, "goalkeepers should retain fitness longer than outfield players");
career.applySeasonAging({ ...veteranKeeperCurve, age: 37, fitness: 75, physical: 72 });
const oldestKeeperCurve = { pos: "حارس مرمى", age: 37, fitness: 75, physical: 72 };
career.applySeasonAging(oldestKeeperCurve);
assert.equal(oldestKeeperCurve.fitness, 74, "goalkeeper fitness decline should begin in the later-career phase");
assert.equal(oldestKeeperCurve.physical, 71, "goalkeeper physical decline should begin later than outfield players");

const tournament = { nationalTournamentMatches: 0, nationalTournamentPoints: 0, nationalTournamentDone: false,
  nationalTournamentQualified: false, nationalTournamentWinner: false, nationalTournamentFinalOutcome: "", internationalPlayed: false };
assert.equal(career.recordNationalTournamentMatch(tournament, "فوز").status, "group");
assert.equal(career.recordNationalTournamentMatch(tournament, "تعادل").status, "group");
assert.equal(career.recordNationalTournamentMatch(tournament, "خسارة").status, "final-qualified");
assert.equal(tournament.nationalTournamentMatches, 3, "the group stage must contain three fixtures");
assert.equal(tournament.nationalTournamentPoints, 4, "group points must accumulate across all three fixtures");
assert.equal(career.recordNationalTournamentMatch(tournament, "فوز").status, "champion");
assert.equal(tournament.nationalTournamentMatches, 4, "a qualified team must play a final after the group stage");
assert.equal(tournament.nationalTournamentWinner, true, "a final win must persist the tournament winner flag");
assert.equal(tournament.nationalTournamentFinalOutcome, "فوز", "the final outcome must be saved in career state");
assert.equal(tournament.internationalPlayed, true, "the international tournament must close after the final");
assert.equal(career.recordNationalTournamentMatch(tournament, "فوز").status, "tournament-closed");

const invalidTournament = { nationalTournamentMatches: 0, nationalTournamentPoints: 0, nationalTournamentDone: false,
  nationalTournamentQualified: false, nationalTournamentWinner: false, nationalTournamentFinalOutcome: "", internationalPlayed: false };
const invalidTournamentBefore = JSON.stringify(invalidTournament);
assert.deepEqual(career.recordNationalTournamentMatch(invalidTournament, "win"), { ok: false, status: "invalid-outcome" });
assert.equal(JSON.stringify(invalidTournament), invalidTournamentBefore, "invalid outcomes must not mutate international tournament state");

const malformedTournamentPoints = {
  nationalTournamentMatches: 2, nationalTournamentPoints: Infinity, nationalTournamentDone: false,
  nationalTournamentQualified: false, nationalTournamentWinner: false,
  nationalTournamentFinalOutcome: "", internationalPlayed: false
};
const malformedPointsResult = career.recordNationalTournamentMatch(malformedTournamentPoints, "تعادل");
assert.equal(malformedPointsResult.status, "eliminated",
  "non-finite saved points must not qualify a team for the final");
assert.equal(malformedTournamentPoints.nationalTournamentMatches, 3);
assert.equal(malformedTournamentPoints.nationalTournamentPoints, 1);
assert.equal(malformedTournamentPoints.nationalTournamentQualified, false);
assert.equal(malformedTournamentPoints.nationalTournamentDone, true);
assert.equal(malformedTournamentPoints.internationalPlayed, true);

const malformedTournamentCounters = {
  nationalTournamentMatches: Infinity, nationalTournamentPoints: Infinity, nationalTournamentDone: false,
  nationalTournamentQualified: false, nationalTournamentWinner: false,
  nationalTournamentFinalOutcome: "", internationalPlayed: false
};
const recoveredTournamentResult = career.recordNationalTournamentMatch(malformedTournamentCounters, "فوز");
assert.equal(recoveredTournamentResult.status, "group",
  "a non-finite saved match counter must recover instead of permanently closing the tournament");
assert.equal(malformedTournamentCounters.nationalTournamentMatches, 1);
assert.equal(malformedTournamentCounters.nationalTournamentPoints, 3);
assert.equal(malformedTournamentCounters.nationalTournamentQualified, false);
assert.equal(malformedTournamentCounters.nationalTournamentDone, false);
assert.equal(malformedTournamentCounters.internationalPlayed, false);


const drawnFinal = { nationalTournamentMatches: 3, nationalTournamentPoints: 4, nationalTournamentDone: false,
  nationalTournamentQualified: true, nationalTournamentWinner: false, nationalTournamentFinalOutcome: "", internationalPlayed: false };
const drawnFinalBefore = JSON.stringify(drawnFinal);
assert.deepEqual(career.recordNationalTournamentMatch(drawnFinal, "تعادل"), { ok: false, status: "final-winner-required" });
assert.equal(JSON.stringify(drawnFinal), drawnFinalBefore, "a drawn knockout final must not close the tournament without a winner");

const unqualifiedFinal = { nationalTournamentMatches: 3, nationalTournamentPoints: 2, nationalTournamentDone: false,
  nationalTournamentQualified: false, nationalTournamentWinner: false, nationalTournamentFinalOutcome: "", internationalPlayed: false };
const unqualifiedFinalBefore = JSON.stringify(unqualifiedFinal);
assert.deepEqual(career.recordNationalTournamentMatch(unqualifiedFinal, "فوز"), { ok: false, status: "not-qualified" });
assert.equal(JSON.stringify(unqualifiedFinal), unqualifiedFinalBefore, "an unqualified team must not enter or mutate a final");

const losingTournament = { nationalTournamentMatches: 3, nationalTournamentPoints: 4, nationalTournamentDone: false,
  nationalTournamentQualified: true, nationalTournamentWinner: false, nationalTournamentFinalOutcome: "", internationalPlayed: false };
assert.equal(career.recordNationalTournamentMatch(losingTournament, "خسارة").status, "final-lost");
assert.equal(losingTournament.nationalTournamentWinner, false, "a final loss must not award the championship");
assert.equal(losingTournament.nationalTournamentFinalOutcome, "خسارة", "a final loss must be persisted for future screens");
assert.equal(losingTournament.nationalTournamentDone, true);
assert.equal(losingTournament.internationalPlayed, true);

console.log("PASS: career progression, match-history deduplication, loan contracts, purchase gates, renewal, retirement, training guard, and international tournament lifecycle.");


// The career engine embedded in the deployed HTML must stay behaviorally aligned with source.
const deployedHtml = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");
const inlineScripts = deployedHtml.split("<script").slice(1).map(part => part.slice(part.indexOf(">") + 1, part.indexOf("</script>")));
const careerBundle = inlineScripts.find(script => script.includes("window.LWCareer ="));
assert.ok(careerBundle, "deployed HTML must contain the career engine");
const deployedContext = { window: {} };
vm.createContext(deployedContext);
vm.runInContext(careerBundle, deployedContext, { filename: "index.html career bundle" });
const deployedCareer = deployedContext.window.LWCareer;
assert.ok(deployedCareer && typeof deployedCareer.matchDevelopment === "function", "deployed career engine must initialise");
function makeMalformedLegacyCareerStats() {
  return {
    apps: 4, careerAppearances: "Infinity", seasonLog: [
      { id: "legacy-valid", scope: "league", minutes: 90, rating: 8 },
      { id: "legacy-infinite", scope: "league", minutes: "Infinity", rating: 9 },
      { id: "legacy-nan", scope: "league", minutes: NaN, rating: 7 },
      { id: "legacy-short", scope: "league", minutes: 19, rating: 6 },
      { id: "legacy-over", scope: "league", minutes: 999, rating: 12 }
    ], careerMatchHistory: []
  };
}
const malformedLegacyStats = makeMalformedLegacyCareerStats();
const rebuiltLegacyRows = career.rebuildLegacyCareerStats(malformedLegacyStats);
assert.equal(rebuiltLegacyRows.length, 5, "legacy migration must preserve all unique match records");
assert.equal(malformedLegacyStats.qualifyingAppearances, 2,
  "non-finite minutes must not count as qualifying appearances and oversized minutes must be bounded");
assert.equal(malformedLegacyStats.careerAppearances, 4,
  "a non-finite legacy career-appearance total must recover from the finite apps counter");
assert.equal(malformedLegacyStats.careerMinutes, 229,
  "legacy career minutes must be rebuilt from finite, bounded match minutes");
assert.deepEqual(malformedLegacyStats.careerMilestonesEarned, [],
  "malformed minutes must not manufacture appearance milestones");
const rebuiltLeagueRatings = career.deriveLeagueRatingStats(malformedLegacyStats);
assert.deepEqual(rebuiltLeagueRatings, { sum: 24, count: 3 },
  "league rating reconstruction must ignore invalid minutes and clamp ratings to the valid 0-10 range");
assert.ok(Number.isFinite(malformedLegacyStats.careerAppearances)
  && Number.isFinite(malformedLegacyStats.careerMinutes)
  && Number.isFinite(malformedLegacyStats.leagueRatingSum),
  "legacy-stat reconstruction must leave finite totals");

const browserMalformedLegacyStats = makeMalformedLegacyCareerStats();
deployedCareer.rebuildLegacyCareerStats(browserMalformedLegacyStats);
const browserLegacyRatings = deployedCareer.deriveLeagueRatingStats(browserMalformedLegacyStats);
assert.equal(JSON.stringify(browserMalformedLegacyStats), JSON.stringify(malformedLegacyStats),
  "embedded browser legacy-stat migration must match the shared career engine");
assert.equal(JSON.stringify(browserLegacyRatings), JSON.stringify(rebuiltLeagueRatings),
  "embedded browser rating reconstruction must match the shared career engine");

const malformedQualificationState = {
  pos: "جناح", age: 24, apps: 0,
  seasonLog: [
    { id: "qualification-infinite-1", scope: "league", minutes: "Infinity" },
    { id: "qualification-infinite-2", scope: "league", minutes: Infinity },
    { id: "qualification-nan-1", scope: "league", minutes: NaN },
    { id: "qualification-infinite-3", scope: "league", minutes: "Infinity" },
    { id: "qualification-valid", scope: "league", minutes: 90 }
  ],
  careerMatchHistory: []
};
career.ensureState(malformedQualificationState);
assert.equal(malformedQualificationState.qualifyingAppearances, 1,
  "ensureState must not count non-finite legacy match minutes as qualifying appearances");
assert.deepEqual(malformedQualificationState.careerMilestonesEarned, [],
  "invalid legacy minutes must not manufacture appearance milestones during state repair");


for (const [label, initial, outcome] of [
  ["invalid", { nationalTournamentMatches: 0, nationalTournamentPoints: 0, nationalTournamentDone: false }, "win"],
  ["champion", { nationalTournamentMatches: 3, nationalTournamentPoints: 4, nationalTournamentQualified: true, nationalTournamentDone: false }, "فوز"],
  ["final loss", { nationalTournamentMatches: 3, nationalTournamentPoints: 4, nationalTournamentQualified: true, nationalTournamentDone: false }, "خسارة"],
  ["drawn final", { nationalTournamentMatches: 3, nationalTournamentPoints: 4, nationalTournamentQualified: true, nationalTournamentDone: false }, "تعادل"]
]) {
  const sourceState = { ...initial };
  const deployedState = { ...initial };
  assert.equal(JSON.stringify(deployedCareer.recordNationalTournamentMatch(deployedState, outcome)),
    JSON.stringify(career.recordNationalTournamentMatch(sourceState, outcome)),
    "deployed/source tournament result must match for " + label);
  assert.equal(JSON.stringify(deployedState), JSON.stringify(sourceState),
    "deployed/source tournament state must match for " + label);
}

const malformedTournamentSourceState = {
  nationalTournamentMatches: 2, nationalTournamentPoints: Infinity, nationalTournamentDone: false,
  nationalTournamentQualified: false, nationalTournamentWinner: false,
  nationalTournamentFinalOutcome: "", internationalPlayed: false
};
const malformedTournamentBrowserState = { ...malformedTournamentSourceState };
assert.equal(JSON.stringify(deployedCareer.recordNationalTournamentMatch(malformedTournamentBrowserState, "تعادل")),
  JSON.stringify(career.recordNationalTournamentMatch(malformedTournamentSourceState, "تعادل")),
  "embedded/source tournament handling must match for malformed points");
assert.equal(JSON.stringify(malformedTournamentBrowserState), JSON.stringify(malformedTournamentSourceState),
  "embedded/source tournament state must match after malformed-counter recovery");

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


// Career role selection must react to sustained output without bypassing academy graduation.
const roleHistory = Array.from({ length: 8 }, (_, index) => ({
  scope: "league", minutes: 39, rating: 6.35, goals: index % 3 === 0 ? 1 : 0,
  assists: index % 5 === 0 ? 1 : 0
}));
const roleSnapshot = {
  pos: "رأس حربة", role: "بديل", age: 25, apps: 304, goals: 39, assists: 15, trust: 25,
  academyCareer: false, academyReserve: false, retired: false
};
const roleDecision = career.evaluateSquadRole(roleSnapshot, roleHistory, {
  scope: "league", minutes: 39, rating: 6.4, goals: 0, assists: 0
});
assert.equal(roleDecision.role, "أساسي",
  "a long-serving striker with sustained career goal contributions must be eligible for a starting role");
assert.equal(roleDecision.changed, true, "role promotions must report a real change");
assert.ok(roleDecision.careerContributionsPer90 >= 0.32,
  "role decision must expose a grounded contribution rate for debugging and tests");

const duplicateRoleMatch = {
  matchId: "role-current-duplicate", scope: "league", minutes: 39, rating: 9, goals: 1, assists: 1
};
const priorRoleHistory = Array.from({ length: 7 }, (_, index) => ({
  matchId: "role-history-" + index, scope: "league", minutes: 39, rating: 5.4, goals: 0, assists: 0
}));
const roleStateForDedup = { ...roleSnapshot, role: "بديل", apps: 8, goals: 1, assists: 1, trust: 10 };
const roleWithoutDuplicate = career.evaluateSquadRole(roleStateForDedup, priorRoleHistory, duplicateRoleMatch);
const roleWithDuplicate = career.evaluateSquadRole(roleStateForDedup,
  [duplicateRoleMatch, ...priorRoleHistory], duplicateRoleMatch);
assert.equal(roleWithoutDuplicate.role, "بديل",
  "one standout match must not promote a player when the remaining recent form is weak");
assert.equal(roleWithDuplicate.role, roleWithoutDuplicate.role,
  "a current match already present in saved history must not be counted twice for squad-role promotion");
assert.equal(roleWithDuplicate.recentAverageRating, roleWithoutDuplicate.recentAverageRating,
  "duplicate match rows must not overweight recent average rating");
assert.equal(roleWithDuplicate.recentContributionsPer90, roleWithoutDuplicate.recentContributionsPer90,
  "duplicate match rows must not inflate recent contributions per 90");
assert.equal(roleWithDuplicate.careerContributionsPer90, roleWithoutDuplicate.careerContributionsPer90,
  "duplicate match rows must not distort estimated career minutes");

const browserRoleDecision = deployedCareer.evaluateSquadRole({ ...roleStateForDedup },
  [duplicateRoleMatch, ...priorRoleHistory], duplicateRoleMatch);
const sourceRoleDecision = career.evaluateSquadRole({ ...roleStateForDedup },
  [duplicateRoleMatch, ...priorRoleHistory], duplicateRoleMatch);
assert.equal(JSON.stringify(browserRoleDecision), JSON.stringify(sourceRoleDecision),
  "embedded browser and shared career engines must deduplicate squad-role match history identically");
const protectedAcademyRole = career.evaluateSquadRole({
  ...roleSnapshot, role: "ناشئ تحت 15", academyCareer: true
}, roleHistory, { scope: "league", minutes: 39, rating: 9.1, goals: 2, assists: 0 });
assert.equal(protectedAcademyRole.role, "ناشئ تحت 15",
  "academy careers must retain their academy role until their dedicated graduation flow");
const lowOutputRole = career.evaluateSquadRole({
  pos: "رأس حربة", role: "بديل", age: 19, apps: 3, goals: 0, assists: 0, trust: 10,
  academyCareer: false, academyReserve: false, retired: false
}, [{ scope: "league", minutes: 30, rating: 4.5, goals: 0, assists: 0 }], {
  scope: "league", minutes: 30, rating: 4.4, goals: 0, assists: 0
});
assert.equal(lowOutputRole.role, "بديل",
  "role progression must not promote a low-performing player after only a handful of appearances");

const malformedRoleHistory = [
  { scope: "league", minutes: 90, rating: 5, goals: 0, assists: 0 },
  { scope: "league", minutes: Infinity, rating: Infinity, goals: Infinity, assists: Infinity }
];
const malformedRoleSnapshot = {
  pos: "رأس حربة", role: "بديل", age: 25, apps: 40,
  goals: Infinity, assists: NaN, trust: Infinity,
  academyCareer: false, academyReserve: false, retired: false
};
const malformedRoleDecision = career.evaluateSquadRole(malformedRoleSnapshot, malformedRoleHistory, {
  scope: "league", minutes: Infinity, rating: Infinity, goals: Infinity, assists: Infinity
});
assert.equal(malformedRoleDecision.role, "بديل",
  "non-finite saved match metrics must not promote a player to a starting role");
assert.equal(malformedRoleDecision.recentAverageRating, 5,
  "non-finite ratings must be ignored in recent-form calculations");
assert.equal(malformedRoleDecision.recentContributionsPer90, 0,
  "non-finite match goals and assists must not inflate recent contribution rates");
assert.equal(malformedRoleDecision.careerContributionsPer90, 0,
  "non-finite career goal and assist totals must not manufacture veteran output");
assert.ok(Number.isFinite(malformedRoleDecision.recentAverageRating)
  && Number.isFinite(malformedRoleDecision.recentContributionsPer90)
  && Number.isFinite(malformedRoleDecision.careerContributionsPer90),
  "role-evaluation metrics must remain finite for corrupted legacy saves");
const deployedMalformedRoleDecision = deployedCareer.evaluateSquadRole(
  { ...malformedRoleSnapshot }, malformedRoleHistory, {
    scope: "league", minutes: Infinity, rating: Infinity, goals: Infinity, assists: Infinity
  });
assert.equal(JSON.stringify(deployedMalformedRoleDecision), JSON.stringify(malformedRoleDecision),
  "embedded browser role evaluation must match the sanitized career engine");

