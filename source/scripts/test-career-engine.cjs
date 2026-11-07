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

assert.equal(career.normalizeCareerPosition("CM"), "وسط", "CM must normalize to the central-midfield role");
assert.equal(career.normalizeCareerPosition("central midfielder"), "وسط", "long-form English midfield positions must normalize");
assert.equal(career.normalizeCareerPosition("CDM"), "وسط دفاعي", "CDM must retain its defensive-midfield role");
assert.equal(career.normalizeCareerPosition("CAM"), "وسط مهاجم", "CAM must retain its attacking-midfield role");
const centralMidfieldPlan = career.positionDevelopmentPlan("CM");
assert.equal(centralMidfieldPlan.position, "وسط");
assert.ok(centralMidfieldPlan.primary.includes("passing") && centralMidfieldPlan.primary.includes("vision"),
  "central midfield development must prioritize passing and vision");
const centralMidfieldStats = career.startingStatsForPosition("CM", () => 0.5);
assert.equal(centralMidfieldStats.goalkeeping, 0, "central midfielders must never receive goalkeeper skill");
assert.ok(centralMidfieldStats.passing >= 56 && centralMidfieldStats.passing <= 68,
  "central midfielders must receive the dedicated passing range");
const legacyCentralMidfielder = { pos: "CM", goalkeeping: 90, age: 20 };
career.ensureState(legacyCentralMidfielder);
assert.deepEqual(legacyCentralMidfielder.recordedMatchIds, [],
  "legacy career normalization must initialize the match id ledger before the next fixture");
assert.equal(legacyCentralMidfielder.pos, "وسط", "legacy CM saves must be normalized without dropping the player");
assert.equal(legacyCentralMidfielder.goalkeeping, 0, "legacy outfield CM saves must not retain goalkeeper skill");
const loanRolePlayer = { pos: "CM", age: 22, shooting: 70, dribbling: 70, passing: 70, speed: 70, fitness: 70,
  composure: 70, defending: 70, goalkeeping: 99, vision: 70, physical: 70 };
assert.equal(career.loanSquadRole({ ...loanRolePlayer }, { power: 60 }), "أساسي",
  "a player clearly stronger than the host club should be projected as a starter");
assert.equal(career.loanSquadRole({ ...loanRolePlayer }, { power: 70 }), "بديل أساسي",
  "a player near host-club level should be projected as a rotation starter");
assert.equal(career.loanSquadRole({ ...loanRolePlayer }, { power: 80 }), "بديل",
  "a player clearly below host-club level should be projected as a substitute");

const repositoryRoot = path.resolve(__dirname, "..", "..");
const rootHtml = fs.readFileSync(path.join(repositoryRoot, "index.html"), "utf8");
const publicHtml = fs.readFileSync(path.join(repositoryRoot, "public", "index.html"), "utf8");
assert.equal(rootHtml, publicHtml, "root and public app shells must stay synchronized");

assert.ok(rootHtml.includes('if(roleDecision?.reason === "form-demotion"){'),
  "the match flow must distinguish a form-based role demotion from a promotion");
assert.ok(rootHtml.includes("الجهاز الفني خفّض دورك إلى لاعب أساسي بعد تراجع الأداء المتكرر."),
  "a star-role demotion must be described as a reduction to starter");
assert.ok(rootHtml.includes("الجهاز الفني خفّض دورك إلى بديل أساسي بعد تراجع الأداء المتكرر."),
  "a starter demotion must be described as a reduction to rotation");
assert.ok(rootHtml.includes("الجهاز الفني خفّض دورك إلى بديل بعد تراجع الأداء المتكرر."),
  "a rotation demotion must be described as a reduction to substitute");
assert.ok(rootHtml.includes("الجهاز الفني زوّد دورك في التشكيل بناءً على الأداء والإنتاج الهجومي."),
  "promotion messaging must remain available for earned role upgrades");


const loanToMatch = rootHtml.match(/function loanTo\(target\)\{[\s\S]*?\n\}\nfunction returnFromLoan/);
assert.ok(loanToMatch, "the deployed loan action must remain available for behavioral testing");
const loanToSource = loanToMatch[0].slice(0, loanToMatch[0].lastIndexOf("\nfunction returnFromLoan"));
function runLoanDivisionCase(division) {
  const target = { club: "نادي اختبار الإعارة", country: "مصر", league: division === 2 ? "الدرجة الثانية" : "الدوري الممتاز",
    division, power: 55, season: "2026/27", source: "محاكاة عالم الكرة" };
  const loanState = { clubName: "النادي الأصلي", leagueCountry: "مصر", leagueDivision: 1,
    leagueCompetition: "الدوري الممتاز", leagueSource: "بيانات الاختبار", clubPower: 62,
    clubTier: 1, clubIndex: 1, weeklyWage: 500, contractSeasons: 2, freeAgent: false,
    role: "بديل", season: 1, day: 1, calendarDay: 120, seasonApps: 10,
    seasonPhase: "firstHalf", winterBreakPending: false, trust: 50, transferHistory: [] };
  let reconciliationCalls = 0;
  let migrationCalls = 0;
  const sandbox = {
    state: loanState,
    withCareerStateTransaction: (label, operation) => operation(),
    window: { LWCareer: { loanTargetStatus: () => "ready", loanSquadRole: () => "بديل" } },
    canAccessTransferMarket: () => true,
    migrateLegacyPendingTransferOffer: () => { migrationCalls++; return null; },
    reconcileTransferNegotiation: windowInfo => { reconciliationCalls++; assert.equal(windowInfo.open, true); return false; },
    transferTargets: () => [target],
    activeCupInProgress: () => false,
    transferWindow: () => ({ open: true }),
    seasonMatchTotal: () => 30,
    archiveCupForTransfer: () => {},
    archiveLeagueSegment: () => {},
    clamp: value => Math.max(0, Math.min(100, Number(value) || 0)),
    clubPowerFor: () => 55,
    clubTierForPower: () => 1,
    transferWage: () => 700,
    createLeague: () => [],
    buildFixtureSchedule: () => [],
    seedDestinationLeagueProgress: () => 20,
    log: () => {}, setStory: () => {}, saveGame: () => {},
    render: () => {}, showPage: () => {}, toast: () => {}
  };
  vm.runInNewContext(loanToSource + "\nthis.loanTo = loanTo;", sandbox, { filename: "loanTo division regression" });
  sandbox.loanTo(target);
  assert.equal(migrationCalls, 1,
    "the final loan action must migrate legacy direct offers before validating the loan");
  assert.equal(reconciliationCalls, 1,
    "the final loan action must reconcile stale permanent-transfer negotiations before validating the loan");
  return { division: loanState.leagueDivision, source: loanState.leagueSource };
}
const secondDivisionLoan = runLoanDivisionCase(2);
assert.equal(secondDivisionLoan.division, 2,
  "a loan to a second-division club must keep the host club's actual division");
assert.equal(secondDivisionLoan.source, "محاكاة عالم الكرة • 2026/27",
  "a loan destination must preserve its actual roster/league data source instead of being mislabeled as OpenFootball");
assert.equal(runLoanDivisionCase(undefined).division, 1,
  "legacy loan destinations without a division must retain the first-division fallback");

function runLoanMetadataCase(targetOverrides = {}, helperOverrides = {}) {
  const target = {
    club: "نادي اختبار الإعارة", country: "مصر", league: "الدوري الممتاز",
    division: 2, power: 55, source: "محاكاة عالم الكرة", season: "2026/27",
    ...targetOverrides
  };
  const loanState = {
    clubName: "النادي الأصلي", leagueCountry: "مصر", leagueDivision: 1,
    leagueCompetition: "الدوري الممتاز", leagueSource: "بيانات الاختبار",
    clubPower: 62, clubTier: 1, clubIndex: 1, weeklyWage: 100,
    contractSeasons: 2, freeAgent: false, role: "بديل", season: 1,
    day: 1, calendarDay: 120, seasonApps: 10, seasonPhase: "firstHalf",
    winterBreakPending: false, trust: 50, transferHistory: []
  };
  let rolePower = null;
  let wagePower = null;
  const sandbox = {
    state: loanState,
    withCareerStateTransaction: (label, operation) => operation(),
    window: { LWCareer: {
      loanTargetStatus: () => "ready",
      loanSquadRole: (player, normalizedTarget) => { rolePower = normalizedTarget.power; return "أساسي"; }
    } },
    canAccessTransferMarket: () => true,
    migrateLegacyPendingTransferOffer: () => null,
    reconcileTransferNegotiation: () => false,
    transferTargets: () => [target],
    activeCupInProgress: () => false,
    transferWindow: () => ({ open: true }),
    seasonMatchTotal: () => 30,
    archiveCupForTransfer: () => {},
    archiveLeagueSegment: () => {},
    clamp: value => Math.max(0, Math.min(100, Number(value) || 0)),
    clubPowerFor: () => helperOverrides.clubPowerLookup === undefined ? 55 : helperOverrides.clubPowerLookup,
    clubTierForPower: power => power >= 68 ? 2 : 1,
    transferWage: normalizedTarget => {
      wagePower = normalizedTarget.power;
      return helperOverrides.transferWageResult === undefined ? 1000 : helperOverrides.transferWageResult;
    },
    createLeague: () => [],
    buildFixtureSchedule: () => [],
    seedDestinationLeagueProgress: () => 20,
    log: () => {}, setStory: () => {}, saveGame: () => {},
    render: () => {}, showPage: () => {}, toast: () => {}
  };
  vm.createContext(sandbox);
  vm.runInContext(loanToSource + "\nthis.loanTo = loanTo;", sandbox, { filename: "loanTo malformed metadata regression" });
  sandbox.loanTo(target);
  return { state: loanState, rolePower, wagePower };
}

const malformedLoanMetadata = runLoanMetadataCase({
  division: ["2"], power: "Infinity", league: ["دوري غير صالح"],
  source: ["LWWorldDB"], season: { year: 2026 }
});
assert.equal(malformedLoanMetadata.state.leagueDivision, 1,
  "array-shaped host divisions must not be coerced into a valid loan division");
assert.equal(malformedLoanMetadata.state.clubPower, 55,
  "a non-finite host power must fall back to the verified club-power lookup");
assert.equal(malformedLoanMetadata.state.clubTier, 1);
assert.equal(malformedLoanMetadata.state.clubIndex, 1);
assert.equal(malformedLoanMetadata.state.weeklyWage, 550,
  "the host wage must be calculated from the normalized destination and remain finite");
assert.equal(malformedLoanMetadata.state.leagueCompetition, "دوري محلي — محاكاة",
  "malformed league labels must not leak into the saved career");
assert.equal(malformedLoanMetadata.state.leagueSource, "بيانات اللعبة • 2026/27",
  "malformed source and season metadata must use stable legacy-safe labels");
assert.equal(malformedLoanMetadata.rolePower, 55,
  "loan squad-role projection must receive the normalized host power");
assert.equal(malformedLoanMetadata.wagePower, 55,
  "loan wage calculation must receive the normalized host power");
assert.equal(malformedLoanMetadata.state.loan.hostClub, "نادي اختبار الإعارة");
for (const key of ["leagueDivision", "clubPower", "clubTier", "clubIndex", "weeklyWage"]) {
  assert.equal(Number.isFinite(malformedLoanMetadata.state[key]), true,
    "loan confirmation must leave a finite " + key + " after malformed destination metadata");
}

const numericStringLoanMetadata = runLoanMetadataCase({
  division: "2", power: "68", league: "Premier League",
  source: "LWWorldDB", season: "2027/28"
});
assert.equal(numericStringLoanMetadata.state.leagueDivision, 2,
  "valid numeric-string host divisions must remain supported");
assert.equal(numericStringLoanMetadata.state.clubPower, 68,
  "valid numeric-string host power must remain supported");
assert.equal(numericStringLoanMetadata.state.clubTier, 2);
assert.equal(numericStringLoanMetadata.state.leagueCompetition, "Premier League");
assert.equal(numericStringLoanMetadata.state.leagueSource, "قاعدة بيانات اللعبة • 2027/28");

const invalidLoanFallbacks = runLoanMetadataCase({
  division: "NaN", power: [], league: " ", source: {}, season: ""
}, { clubPowerLookup: "Infinity", transferWageResult: Infinity });
assert.equal(invalidLoanFallbacks.state.leagueDivision, 1);
assert.equal(invalidLoanFallbacks.state.clubPower, 50,
  "invalid saved and looked-up club powers must use the bounded neutral fallback");
assert.equal(invalidLoanFallbacks.state.weeklyWage, 138,
  "a non-finite destination wage must use the safe minimum estimate");
assert.equal(invalidLoanFallbacks.state.leagueCompetition, "دوري محلي — محاكاة");
assert.equal(invalidLoanFallbacks.state.leagueSource, "بيانات اللعبة • 2026/27");

assert.ok(rootHtml.includes("state[key] = attributeValue !== null ? clamp(attributeValue, 0, 100) : 50;"),
  "the embedded browser career engine must clamp saved player attributes to the 0-100 range");
assert.ok(rootHtml.includes("const savedTrust = finiteLegacyNumber(state.trust);")
  && rootHtml.includes("const savedFollowers = finiteLegacyNumber(state.followers);"),
  "the inline browser career engine must normalize trust and follower counters before state mutations");

assert.ok(rootHtml.includes("normalizeNationalTournamentCounter(state.nationalTournamentMatches,4)>=3&&state.nationalTournamentQualified!==true"),
  "an unqualified national team must not be offered a final match");
assert.ok(rootHtml.includes("const normalizeNationalTournamentCounter = (value, maximum) => {")
  && rootHtml.includes('typeof value === "string" && value.trim() !== "" ? Number(value) : NaN'),
  "the inline UI counter reader must reject coercible non-primitive values while preserving numeric strings");
assert.equal(rootHtml.includes("Number(state.nationalTournamentMatches)"), false,
  "national match counters must not be coerced directly in UI guards or labels");
assert.equal(rootHtml.includes("Number(state.nationalTournamentPoints)"), false,
  "national tournament points must not be coerced directly in UI labels");
const serviceWorkerCopies = ["sw.js", "public/sw.js"]
  .map(file => fs.readFileSync(path.join(repositoryRoot, file), "utf8"));
assert.equal(serviceWorkerCopies[0], serviceWorkerCopies[1], "root and public service workers must stay synchronized");
require("../../scripts/assert-static-cache-version.cjs")(serviceWorkerCopies[0], 557);
require("../../scripts/assert-static-cache-version.cjs").assertAssetVersionAtLeast(serviceWorkerCopies[0], "data/career-engine.js", 83);
const engineCopies = ["data/career-engine.js", "source/public/data/career-engine.js", "public/data/career-engine.js"]
  .map(file => fs.readFileSync(path.join(repositoryRoot, file), "utf8"));
assert.ok(engineCopies[0].includes("const savedTrust = finiteLegacyNumber(state.trust);")
  && engineCopies[0].includes("const savedFollowers = finiteLegacyNumber(state.followers);"),
  "all shared career-engine mirrors must normalize trust and follower counters");
assert.ok(engineCopies.every(content => content === engineCopies[0]), "all career engine copies must stay synchronized");
assert.ok(engineCopies[0].includes("state[key] = attributeValue !== null ? clamp(attributeValue, 0, 100) : 50;"),
  "the shared career engine must clamp saved player attributes to the 0-100 range");
const inlineDedupStart = rootHtml.indexOf("  function uniqueMatchRows(rows) {");
const inlineDedupEnd = rootHtml.indexOf("\n  function uniqueCareerHistory(state)", inlineDedupStart);
const sharedDedupStart = engineCopies[0].indexOf("  function uniqueMatchRows(rows) {");
const sharedDedupEnd = engineCopies[0].indexOf("\n  function uniqueCareerHistory(state)", sharedDedupStart);
assert.ok(inlineDedupStart >= 0 && inlineDedupEnd > inlineDedupStart
  && sharedDedupStart >= 0 && sharedDedupEnd > sharedDedupStart,
  "inline and shared match-history deduplication functions must remain extractable");
assert.equal(rootHtml.slice(inlineDedupStart, inlineDedupEnd),
  engineCopies[0].slice(sharedDedupStart, sharedDedupEnd),
  "inline browser and shared career engines must use identical match-history deduplication");
assert.equal(career.calendarGameDateISO({ calendarDay: 1 }), "2024-08-01T00:00:00.000Z",
  "career award dates must start on the in-game season date, not the machine clock");
assert.equal(career.calendarGameDateISO({ calendarDay: 366 }), "2025-08-01T00:00:00.000Z",
  "the in-game date must advance deterministically across season boundaries");
const tournamentFlagNames = ["nationalCalled", "nationalTournamentDone", "nationalTournamentQualified", "nationalTournamentWinner", "internationalPlayed"];
const legacyCareerPerkFlagNames = ["academyCareer","academyReserve","academyGraduationPending","academyGraduated","privateCoach","xpMultiplier"];
assert.ok(rootHtml.includes('if (!state.agent || typeof state.agent !== "object") state.agent = normalizeLegacyBoolean(state.agent);'),
  "the deployed browser engine must normalize primitive legacy agent flags without replacing object profiles");
assert.ok(rootHtml.includes('if(!state.agent||typeof state.agent!=="object")state.agent=normalizeSavedBooleanFlag(state.agent);'),
  "save migration must normalize primitive legacy agent flags without replacing object profiles");
const cupTerminalFlagNames = ["champion", "eliminated", "abandoned"];
for (const flag of cupTerminalFlagNames) {
  assert.ok(rootHtml.includes(`state.cupState.${flag} = normalizeLegacyBoolean(state.cupState.${flag});`),
    `the shared/browser engine must normalize saved cup ${flag} status`);
}
assert.ok(rootHtml.includes("state.cupState.champion=normalizeSavedBooleanFlag(state.cupState.champion);"),
  "the save migration must normalize cup terminal flags before rendering or closing a saved cup");
assert.ok(rootHtml.includes("state.cupHistory=normalizeSavedCupHistoryFlags(state.cupHistory);"),
  "save migration must normalize legacy cup-history status flags before title checks and competition rendering");
assert.ok(rootHtml.includes("if(!c||c.champion||c.eliminated||c.abandoned)return;"),
  "cup matches must not be playable after a legacy cup has been abandoned");
assert.ok(rootHtml.includes("!c.champion&&!c.eliminated&&!c.abandoned?"),
  "the active cup UI must not offer a match button for an abandoned cup");
assert.ok(rootHtml.includes("c.abandoned?'أُغلقت البطولة دون اكتمالها'"),
  "the active cup panel must clearly label an abandoned cup as closed");
assert.ok(rootHtml.includes('else if(!history&&state.cupState&&state.cupState.name===comp.name&&state.cupState.abandoned&&Number(state.cupState.createdSeason||state.season)===Number(state.season))status="أُغلقت البطولة دون اكتمالها";'),
  "the competition overview must not label an abandoned legacy cup as merely scheduled");
assert.ok(rootHtml.includes("if(c.champion||c.eliminated||c.abandoned){"),
  "transfer archival must treat abandoned cup states as terminal");
const activeCupHelper = rootHtml.match(/function activeCupInProgress\(\)\s*\{[\s\S]*?\}/);
assert.ok(activeCupHelper, "active cup guard must exist");
const cupActivitySandbox = { state: { season: 7, cupState: {
  champion: false, eliminated: false, abandoned: true, createdSeason: 7
} } };
vm.runInNewContext(activeCupHelper[0] + "\nglobalThis.isCupActive = activeCupInProgress;", cupActivitySandbox);
assert.equal(cupActivitySandbox.isCupActive(), false,
  "an abandoned but not eliminated legacy cup must not block entry to another cup");
cupActivitySandbox.state.cupState.abandoned = false;
assert.equal(cupActivitySandbox.isCupActive(), true,
  "a non-abandoned cup in the current season should remain active");

const legacyInventoryFlagNames = ["careerStarted","leagueSegmentIsPartial","boots","diet","speedBoots","strengthProgram","videoAnalyst","homeGym","sleepCoach","physio","recoveryRoom","privateChef","homeUpgrade","sportsPsych","mediaTraining","creatorStudio","stylist","charityFoundation"];
for (const flag of legacyInventoryFlagNames) {
  assert.ok(rootHtml.includes(`state.${flag} = normalizeLegacyBoolean(state.${flag});`),
    `the deployed browser career engine must normalize saved ${flag} flags`);
}
const legacyInventoryMigrationNormalize = rootHtml.indexOf("state.careerStarted=normalizeSavedBooleanFlag(state.careerStarted);");
const legacySegmentMigrationNormalize = rootHtml.indexOf("state.leagueSegmentIsPartial=normalizeSavedBooleanFlag(state.leagueSegmentIsPartial);");
assert.ok(legacyInventoryMigrationNormalize >= 0,
  "career-started status must normalize inside the save-migration scope");
assert.ok(legacySegmentMigrationNormalize >= 0,
  "legacy league-segment flag must normalize inside the save-migration scope");

assert.ok(rootHtml.includes("savedLeagueApps>0||legacySeasonApps===0||normalizeSavedBooleanFlag(clean.leagueSegmentIsPartial)"),
  "backup import must normalize legacy partial-season flags before trusting league counters");
assert.ok(rootHtml.includes("savedLeagueApps>0||legacySeasonApps===0||normalizeSavedBooleanFlag(saved.leagueSegmentIsPartial)"),
  "save migration must normalize legacy partial-season flags before trusting league counters");
assert.ok(!rootHtml.includes("restored.leagueSegmentIsPartial=!!clean.leagueSegmentIsPartial"),
  "backup import must not treat string false as a true partial-season flag");
const backupCareerStartedFallback = rootHtml.indexOf("if(clean.careerStarted===undefined)restored.careerStarted=true;");
const backupCareerEnsureState = rootHtml.indexOf("if(window.LWCareer)window.LWCareer.ensureState(restored);", backupCareerStartedFallback);
assert.ok(backupCareerStartedFallback >= 0 && backupCareerEnsureState > backupCareerStartedFallback,
  "legacy career backups without careerStarted must remain playable after restore");

for (const flag of legacyCareerPerkFlagNames) {
  assert.ok(rootHtml.includes(`state.${flag} = normalizeLegacyBoolean(state.${flag});`),
    `the deployed browser career engine must normalize saved ${flag} flags`);
}
const legacyCareerMigrationNormalize = rootHtml.indexOf("state.academyCareer=normalizeSavedBooleanFlag(state.academyCareer);");
const legacyCareerMigrationFollowing = rootHtml.indexOf("state.academyReserve=normalizeSavedBooleanFlag(state.academyReserve);", legacyCareerMigrationNormalize);
assert.ok(legacyCareerMigrationNormalize >= 0 && legacyCareerMigrationFollowing > legacyCareerMigrationNormalize,
  "academy and perk flags must normalize inside the save-migration scope");

for (const flag of tournamentFlagNames) {
  assert.ok(rootHtml.includes(`state.${flag} = normalizeLegacyBoolean(state.${flag});`),
    `the deployed browser career engine must normalize saved ${flag} flags`);
}
const tournamentMigrationNormalize = rootHtml.indexOf("state.nationalCalled=normalizeSavedBooleanFlag(state.nationalCalled);");
const tournamentFormatMigration = rootHtml.indexOf("if(Number(state.nationalTournamentFormat||0)<2)", tournamentMigrationNormalize);
assert.ok(tournamentMigrationNormalize >= 0 && tournamentFormatMigration > tournamentMigrationNormalize,
  "international tournament flags must normalize before the legacy format migration");
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
assert.equal(inlineDateContext.calendarGameDateISO({ calendarDay: Symbol("calendar-day") }), "2024-08-01T00:00:00.000Z",
  "the standalone browser date helper must safely default malformed saved calendar days");
assert.ok(rootHtml.includes("const log = currentSeasonLeagueMatchRows(state);"),
  "the inline browser award engine must use the unified current-season league history");
assert.ok(rootHtml.includes("function currentSeasonLeagueMatchRows(state)"),
  "the inline browser award engine must keep the current-season history filter deployed");
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


const inlineRangesStart = rootHtml.indexOf("  const POSITION_ALIASES = {");
const inlineStatsStart = rootHtml.indexOf("  function startingStatsForPosition(position", inlineRangesStart);
const inlineStatsEnd = rootHtml.indexOf("\n\n  function uniqueMatchRows", inlineStatsStart);
assert.ok(inlineRangesStart >= 0 && inlineStatsStart > inlineRangesStart && inlineStatsEnd > inlineStatsStart,
  "inline career starting-stat source must remain extractable for regression testing");
const inlineContext = { Math };
vm.createContext(inlineContext);
vm.runInContext(rootHtml.slice(inlineRangesStart, inlineStatsEnd) +
  "\nthis.startingStatsForPosition = startingStatsForPosition;", inlineContext);
for (const position of ["قلب دفاع", "ظهير", "وسط", "وسط دفاعي", "وسط مهاجم", "جناح", "مهاجم", "رأس حربة", "CM"]) {
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
for (const [savedCount, expectedSuspension, expectedBookings] of [
  [Infinity, 0, 0], ["Infinity", 0, 0], [NaN, 0, 0], [-3, 0, 0],
  [1.9, 1, 1], [2, 2, 2], [9, 2, 4]
]) {
  const repaired = {
    pos: "جناح", suspensions: { league: savedCount },
    bookings: { league: savedCount }, trainingXP: {}
  };
  career.ensureState(repaired);
  assert.equal(repaired.suspensions.league, expectedSuspension,
    "legacy suspension counters must be finite, non-negative whole numbers capped at two");
  assert.equal(repaired.bookings.league, expectedBookings,
    "legacy booking counters must be finite, non-negative whole numbers capped at four");
}
assert.ok(rootHtml.includes("state.suspensions[suspensionKey] = Math.min(2, finiteCount(state.suspensions[suspensionKey]));"),
  "the inline browser career engine must normalize suspension counters");
assert.ok(rootHtml.includes("state.bookings[bookingKey] = Math.min(4, finiteCount(state.bookings[bookingKey]));"),
  "the inline browser career engine must normalize booking counters");

const malformedMoneyCases = [
  [Infinity, 0], ["Infinity", 0], [NaN, 0], [-250, 0],
  [0, 0], [1250, 1250], [1.5, 1.5],
  [Number.MAX_SAFE_INTEGER + 1000, Number.MAX_SAFE_INTEGER]
];
for (const [savedMoney, expectedMoney] of malformedMoneyCases) {
  const repairedMoney = { pos: "جناح", age: 24, money: savedMoney, trainingXP: {}, randomSeed: 1 };
  career.ensureState(repairedMoney);
  assert.equal(repairedMoney.money, expectedMoney,
    "legacy career balance must be finite, non-negative, and capped at the safe integer limit");
  assert.ok(Number.isFinite(repairedMoney.money) && repairedMoney.money >= 0
    && repairedMoney.money <= Number.MAX_SAFE_INTEGER,
    "career balance normalization must leave a safe finite amount");
}

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
const legacyLeagueFixture = {
  id: "legacy-reused-fixture-id", scope: "league", competition: "Premier League",
  season: 4, segmentId: "season-4", club: "Test FC", opponent: "League Opponent",
  day: 12, matchday: 8, minutes: 90, rating: 7, goals: 0, assists: 0
};
const legacyCupFixture = {
  ...legacyLeagueFixture, scope: "cup", competition: "National Cup",
  opponent: "Cup Opponent", matchday: 2, goals: 1, rating: 8
};
const reusedLegacyIdRows = [legacyLeagueFixture, legacyCupFixture];
assert.equal(career.uniqueMatchRows(reusedLegacyIdRows).length, 2,
  "legacy IDs reused across league and cup scopes must not collapse distinct fixtures");
assert.equal(career.uniqueMatchRows([legacyLeagueFixture, { ...legacyLeagueFixture }]).length, 1,
  "the same fixture copied into multiple history arrays must still be counted once");
const sparseLegacyLeagueFixture = {
  id: "legacy-sparse-reused-id", scope: "league", season: 4,
  segmentId: "season-4", club: "Test FC", minutes: 90, rating: 7, goals: 0, assists: 0
};
const sparseLegacyCupFixture = {
  id: "legacy-sparse-reused-id", competition: "National Cup", season: 4,
  segmentId: "season-4", club: "Test FC", opponent: "Cup Opponent",
  day: 12, matchday: 2, minutes: 90, rating: 8, goals: 1, assists: 0
};
assert.equal(career.uniqueMatchRows([sparseLegacyLeagueFixture, sparseLegacyCupFixture]).length, 2,
  "a sparse legacy row must not swallow a distinct fixture with the same reused ID");
assert.equal(career.uniqueMatchRows([sparseLegacyLeagueFixture, { ...sparseLegacyLeagueFixture }]).length, 1,
  "exactly repeated sparse legacy rows must still be deduplicated");
const partialLegacyDuplicate = { ...legacyLeagueFixture };
delete partialLegacyDuplicate.day;
delete partialLegacyDuplicate.matchday;
assert.equal(career.uniqueMatchRows([legacyLeagueFixture, partialLegacyDuplicate]).length, 1,
  "a partially enriched copy with matching opponent and competition identity must still be deduplicated");
const whitespaceCompetitionLeagueFixture = {
  id: "legacy-whitespace-competition-id", scope: "league", competition: "   ",
  leagueCompetition: "Premier League", season: 4, segmentId: "season-4",
  club: "Test FC", opponent: "Shared Opponent", day: 13, matchday: 9,
  minutes: 90, rating: 7, goals: 0, assists: 0
};
const whitespaceCompetitionCupFixture = {
  ...whitespaceCompetitionLeagueFixture,
  competition: "National Cup", leagueCompetition: "National Cup", goals: 1, rating: 8
};
assert.equal(career.uniqueMatchRows([
  whitespaceCompetitionLeagueFixture, whitespaceCompetitionCupFixture
]).length, 2,
  "a whitespace competition field must not hide the legacy leagueCompetition and collapse another competition");
const normalizedCompetitionCopy = {
  ...whitespaceCompetitionLeagueFixture, competition: "Premier League"
};
assert.equal(career.uniqueMatchRows([
  whitespaceCompetitionLeagueFixture, normalizedCompetitionCopy
]).length, 1,
  "a whitespace competition field with a matching legacy leagueCompetition must still deduplicate its copied fixture");


const crossCompetitionHistory = {
  apps: 2, seasonLog: [legacyLeagueFixture], careerMatchHistory: [legacyCupFixture]
};
career.rebuildLegacyCareerStats(crossCompetitionHistory);
assert.equal(crossCompetitionHistory.careerMinutes, 180,
  "legacy career-stat rebuilding must preserve minutes from distinct competitions that reused an ID");
assert.equal(crossCompetitionHistory.qualifyingAppearances, 2,
  "legacy career-stat rebuilding must retain both real fixtures across competition scopes");

const malformedLegacyHistory = {
  apps: Symbol("legacy-apps"),
  careerAppearances: Symbol("legacy-career-appearances"),
  seasonLog: [
    { matchId: "symbol-minutes", scope: "league", minutes: Symbol("minutes"), rating: 8 },
    { matchId: "numeric-string-minutes", scope: "league", minutes: "90", rating: "8.5" }
  ]
};
assert.doesNotThrow(() => career.rebuildLegacyCareerStats(malformedLegacyHistory),
  "legacy stat rebuilding must reject Symbol values without crashing");
assert.equal(malformedLegacyHistory.careerMinutes, 90,
  "valid numeric-string minutes must remain usable beside malformed legacy rows");
assert.equal(malformedLegacyHistory.qualifyingAppearances, 1,
  "malformed minutes must not count as a qualifying appearance");
assert.equal(malformedLegacyHistory.careerAppearances, 0,
  "malformed saved appearance totals must safely fall back to zero");

const malformedLegacyRatings = {
  seasonLog: [
    { matchId: "symbol-rating", scope: "league", minutes: 90, rating: Symbol("rating") },
    { matchId: "numeric-string-rating", scope: "league", minutes: "90", rating: "8.5" }
  ]
};
assert.doesNotThrow(() => career.deriveLeagueRatingStats(malformedLegacyRatings),
  "league rating rebuilding must ignore Symbol ratings without crashing");
assert.deepEqual(career.deriveLeagueRatingStats(malformedLegacyRatings), { sum: 8.5, count: 1 },
  "valid numeric-string ratings must remain in the league average");

const malformedSavedCareer = {
  pos: "CM", age: Symbol("age"), apps: Symbol("apps"),
  careerAppearances: Symbol("careerAppearances"), careerMinutes: Symbol("careerMinutes"),
  money: Symbol("money"), weeklyWage: Symbol("weeklyWage"), contractSeasons: Symbol("contractSeasons"),
  randomSeed: Symbol("randomSeed"), careerXP: Symbol("careerXP"), careerLevel: Symbol("careerLevel"),
  levelXP: Symbol("levelXP"), leagueRatingSum: Symbol("leagueRatingSum"),
  leagueRatingCount: Symbol("leagueRatingCount"), trainingXP: { passing: Symbol("trainingXP") },
  passing: Symbol("passing"), fatigue: Symbol("fatigue"), playerPotential: Symbol("potential"),
  trust: Symbol("trust"), followers: Symbol("followers"),
  seasonLog: [
    { matchId: "saved-symbol-minutes", scope: "league", minutes: Symbol("minutes"), rating: 8 },
    { matchId: "saved-valid-minutes", scope: "league", minutes: "90", rating: "8.5" }
  ]
};
assert.doesNotThrow(() => career.ensureState(malformedSavedCareer),
  "save hydration must survive malformed Symbol values in legacy numeric fields");
assert.equal(malformedSavedCareer.age, 18, "an invalid explicit saved age must receive a safe fallback");
assert.equal(malformedSavedCareer.apps, 0, "invalid legacy apps must normalize to zero");
assert.equal(malformedSavedCareer.careerAppearances, 0, "invalid career appearances must normalize to zero");
assert.equal(malformedSavedCareer.careerMinutes, 0, "invalid career minutes must normalize to zero");
assert.equal(malformedSavedCareer.qualifyingAppearances, 1,
  "save hydration must count only valid numeric-string match minutes");
assert.equal(malformedSavedCareer.money, 0);
assert.equal(malformedSavedCareer.weeklyWage, 0);
assert.equal(malformedSavedCareer.contractSeasons, 2);
assert.equal(malformedSavedCareer.randomSeed, 0x6d2b79f5);
assert.equal(malformedSavedCareer.careerXP, 0);
assert.equal(malformedSavedCareer.careerLevel, 1);
assert.equal(malformedSavedCareer.levelXP, 0);
assert.equal(malformedSavedCareer.leagueRatingSum, 0);
assert.equal(malformedSavedCareer.leagueRatingCount, 0);
assert.equal(malformedSavedCareer.trainingXP.passing, 0);
assert.equal(malformedSavedCareer.passing, 50);
assert.equal(malformedSavedCareer.playerPotential, 82);
assert.equal(malformedSavedCareer.fatigue, 0);
assert.equal(malformedSavedCareer.trust, 25, "malformed legacy trust must fall back to the original career default");
assert.equal(malformedSavedCareer.followers, 120, "malformed follower totals must fall back to the original career default");

const legacyNumericSocialCounters = { pos: "CM", age: 22, trust: "63", followers: "1200" };
career.ensureState(legacyNumericSocialCounters);
assert.equal(legacyNumericSocialCounters.trust, 63,
  "numeric-string trust from older saves must be normalized before arithmetic");
assert.equal(legacyNumericSocialCounters.followers, 1200,
  "numeric-string follower totals from older saves must remain numeric");
legacyNumericSocialCounters.trust += 2;
legacyNumericSocialCounters.followers += 5;
assert.equal(legacyNumericSocialCounters.trust, 65,
  "post-normalization trust rewards must add numerically rather than concatenate strings");
assert.equal(legacyNumericSocialCounters.followers, 1205,
  "post-normalization audience gains must add numerically rather than concatenate strings");

const malformedMatchState = {
  pos: "CM", age: Symbol("match-age"), apps: Symbol("match-apps"),
  careerAppearances: Symbol("match-career-appearances")
};
assert.doesNotThrow(() => career.matchDevelopment(malformedMatchState, {
  matchId: "symbol-match-inputs", minutes: 90, rating: Symbol("match-rating"),
  goals: Symbol("match-goals"), assists: Symbol("match-assists")
}), "match development must safely ignore malformed numeric match inputs");
assert.equal(malformedMatchState.apps, 0);
assert.equal(malformedMatchState.age, 18);
assert.equal(malformedMatchState.competitionStats["club|unknown"].goals, 0);
assert.equal(malformedMatchState.competitionStats["club|unknown"].assists, 0);

const symbolRoleDecision = career.evaluateSquadRole({
  pos: "ST", role: "بديل", apps: Symbol("role-apps"),
  goals: Symbol("role-goals"), assists: Symbol("role-assists"), trust: 50
}, [{ matchId: "symbol-role-minutes", minutes: Symbol("role-minutes"), rating: 8 }]);
assert.equal(symbolRoleDecision.reason, "no-appearances",
  "malformed saved minutes must not crash squad-role evaluation or create a recent appearance");

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
const inlineNumberStart = rootHtml.indexOf("const finiteLegacyNumber = value => {");
const inlineNumberEnd = rootHtml.indexOf("\n  };", inlineNumberStart) + 5;
const inlineRoundStart = rootHtml.indexOf("const toNonNegativeInteger = value => {", inlineNumberEnd);
const inlineNormalizeStart = rootHtml.indexOf("function normalizeLeagueRoundIndex(", inlineRoundStart);
const inlineRoundEnd = rootHtml.indexOf("\n  function ", inlineNormalizeStart + 10);
assert.ok(inlineNumberStart >= 0 && inlineNumberEnd > inlineNumberStart
  && inlineRoundStart > inlineNumberEnd && inlineNormalizeStart > inlineRoundStart
  && inlineRoundEnd > inlineNormalizeStart,
  "the inline browser engine must expose its strict number parser and league-round helpers for regression testing");
const inlineRoundContext = {};
vm.createContext(inlineRoundContext);
vm.runInContext(rootHtml.slice(inlineNumberStart, inlineNumberEnd) + "\n"
  + rootHtml.slice(inlineRoundStart, inlineRoundEnd)
  + "\nthis.normalizeLeagueRoundIndex = normalizeLeagueRoundIndex;", inlineRoundContext);
assert.equal(inlineRoundContext.normalizeLeagueRoundIndex(undefined, [{ matchday: Infinity }], 0, 34), 0,
  "the inline browser engine must ignore non-finite matchday values");
assert.equal(inlineRoundContext.normalizeLeagueRoundIndex(undefined, [], Infinity, 34), 0,
  "the inline browser engine must ignore non-finite legacy appearance counts");
const inlineCareerXPStart = rootHtml.indexOf("function addCareerXP(state, amount)");
const inlineCareerXPEnd = rootHtml.indexOf("\n  function train(", inlineCareerXPStart + 10);
assert.ok(inlineCareerXPStart >= 0 && inlineCareerXPEnd > inlineCareerXPStart,
  "the inline career XP function must remain extractable for regression testing");
const inlineFiniteLegacyNumberStart = rootHtml.indexOf("const finiteLegacyNumber = value =>");
const inlineFiniteLegacyNumberEnd = rootHtml.indexOf("\n\n  const CONFIG", inlineFiniteLegacyNumberStart);
assert.ok(inlineFiniteLegacyNumberStart >= 0 && inlineFiniteLegacyNumberEnd > inlineFiniteLegacyNumberStart,
  "the inline career XP regression must load the same strict numeric parser as the engine");
const inlineCareerXPContext = {};
vm.createContext(inlineCareerXPContext);
vm.runInContext(rootHtml.slice(inlineFiniteLegacyNumberStart, inlineFiniteLegacyNumberEnd)
  + "\n" + rootHtml.slice(inlineCareerXPStart, inlineCareerXPEnd)
  + "\nthis.addCareerXP = addCareerXP;", inlineCareerXPContext);
const inlineCorruptedXPState = { careerXP: Infinity, levelXP: Infinity, careerLevel: Infinity };
inlineCareerXPContext.addCareerXP(inlineCorruptedXPState, Infinity);
assert.ok(Number.isFinite(inlineCorruptedXPState.careerXP)
  && Number.isFinite(inlineCorruptedXPState.levelXP)
  && Number.isFinite(inlineCorruptedXPState.careerLevel),
  "the inline career XP function must recover safely from non-finite progression values");
const inlineMalformedXPState = { careerXP: [20], levelXP: [5], careerLevel: [2] };
assert.doesNotThrow(() => inlineCareerXPContext.addCareerXP(inlineMalformedXPState, Symbol("invalid-xp")),
  "symbol and array progression values must not throw during career XP updates");
assert.equal(inlineMalformedXPState.careerXP, 0);
assert.equal(inlineMalformedXPState.levelXP, 0);
assert.equal(inlineMalformedXPState.careerLevel, 1);
const inlineArrayAmountState = { careerXP: 20, levelXP: 5, careerLevel: 2 };
inlineCareerXPContext.addCareerXP(inlineArrayAmountState, [10]);
assert.equal(inlineArrayAmountState.careerXP, 20, "array-shaped XP awards must not grant progression");
assert.equal(inlineArrayAmountState.levelXP, 5);
const inlineNumericStringXPState = { careerXP: "20", levelXP: "5", careerLevel: "2" };
inlineCareerXPContext.addCareerXP(inlineNumericStringXPState, "10");
assert.equal(inlineNumericStringXPState.careerXP, 30, "valid numeric-string XP must remain compatible");
assert.equal(inlineNumericStringXPState.levelXP, 15);
assert.equal(inlineNumericStringXPState.careerLevel, 2);
assert.ok(rootHtml.includes("trainingXPValue !== null")
  && rootHtml.includes("trainingXPThreshold - 0.01"),
  "the inline engine must sanitize malformed training XP before applying progression");
assert.ok(rootHtml.includes("minutesValue === null ? 0")
  && rootHtml.includes("const safeMatchCount = (value, maximum = 100)"),
  "the inline engine must reject non-finite match minutes and action totals");

const onLoan = {
  name: "Test Player", clubName: "Loan Club", leagueCountry: "Hostland",
  weeklyWage: 900, contractSeasons: 3, freeAgent: false,
  loan: { parentClub: "Parent Club", parentCountry: "Egypt", parentWage: 400, parentContractSeasons: 1, parentFreeAgent: false, parentContractType: "professional" }
};
const contractSnapshot = career.contractStateForSeasonTransition(onLoan);
assert.equal(contractSnapshot.clubName, "Parent Club");
assert.equal(contractSnapshot.leagueCountry, "Egypt");
assert.equal(contractSnapshot.weeklyWage, 400);
assert.equal(contractSnapshot.contractSeasons, 1);
assert.equal(contractSnapshot.contractType, "professional");
const legacyLoanWage = {
  pos: "مهاجم", age: 24, freeAgent: true, contractType: "professional",
  weeklyWage: 900, contractSeasons: 0, trainingXP: {}, randomSeed: 1,
  loan: { parentClub: "Parent Club", parentCountry: "Egypt", parentWage: 400,
    parentContractSeasons: 1, parentFreeAgent: false, parentContractType: "professional" }
};
career.ensureState(legacyLoanWage);
assert.equal(legacyLoanWage.weeklyWage, 900,
  "a loan with a live parent contract must retain its host wage even if legacy top-level flags are stale");
assert.equal(career.wageNegotiationStatus(legacyLoanWage), "loaned");

assert.equal(contractSnapshot.loan, null, "the parent-contract snapshot must not carry the active loan state");

const directLoanTransitionState = {
  retired: false, seasonFinished: true, season: 4, contractDecisionSeason: 3,
  freeAgent: false, contractSeasons: 3, age: 24,
  loan: { parentClub: "Parent Club", parentCountry: "Egypt", parentWage: 400,
    parentContractSeasons: 1, parentFreeAgent: false }
};
let directLoanTransitionCalls = 0;
let directLoanReturnCalls = 0;
const directLoanTransitionContext = {
  state: directLoanTransitionState,
  window: { LWCareer: {
    shouldRetire: () => false,
    contractStateForSeasonTransition: current => ({
      ...current, loan: null, clubName: current.loan.parentClub,
      contractSeasons: current.loan.parentContractSeasons,
      freeAgent: current.loan.parentFreeAgent
    })
  } },
  isYouthAcademyPlayer: () => false,
  proceedSeasonTransition: () => { directLoanTransitionCalls++; },
  returnFromLoan: () => { directLoanReturnCalls++; },
  toast: () => {}
};
const startNewSeasonStart = rootHtml.indexOf("function createSingleFlightGate(){");
const startNewSeasonEnd = rootHtml.indexOf("\nfunction nextDay()", startNewSeasonStart);
assert.ok(startNewSeasonStart >= 0 && startNewSeasonEnd > startNewSeasonStart,
  "the deployed season-start function must be available for loan-contract regression coverage");
vm.createContext(directLoanTransitionContext);
vm.runInContext(rootHtml.slice(startNewSeasonStart, startNewSeasonEnd)
  + "\nthis.startNewSeasonForTest = startNewSeason;", directLoanTransitionContext);
directLoanTransitionContext.startNewSeasonForTest(false).then(() => {
  assert.equal(directLoanTransitionCalls, 1,
    "starting a new season directly during a loan must still prompt for an expiring parent-club contract");
  assert.equal(directLoanReturnCalls, 0,
    "a loan must not be returned before the parent-club renewal decision is presented");
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
assert.equal(career.wageNegotiationStatus(onLoan), "loaned", "active loan must block parent-contract wage negotiations");
assert.equal(career.canNegotiateInSeason(onLoan), false, "an on-loan player cannot negotiate the parent contract from the host club");
const loanWageBeforeNegotiation = onLoan.weeklyWage;
assert.deepEqual(career.resolveWageNegotiation(onLoan, 95, 1), { ok: false, status: "loaned" });
assert.equal(onLoan.weeklyWage, loanWageBeforeNegotiation, "a blocked loan negotiation must not change the temporary wage");
for (const decision of ["accept", "decline"]) {
  const beforeDecision = { weeklyWage: onLoan.weeklyWage, contractSeasons: onLoan.contractSeasons, freeAgent: onLoan.freeAgent };
  assert.deepEqual(career.resolveContractDecision(onLoan, decision, { wage: 1500, seasons: 3 }),
    { ok: false, status: "loaned" }, "contract decisions must be rejected while the parent contract is on loan");
  assert.deepEqual({ weeklyWage: onLoan.weeklyWage, contractSeasons: onLoan.contractSeasons, freeAgent: onLoan.freeAgent },
    beforeDecision, "a blocked loan contract decision must not mutate the temporary or parent contract");
}
assert.equal(onLoan.clubName, "Loan Club", "contract snapshot must not mutate the active loan state");
assert.equal(career.wageNegotiationStatus(contractSnapshot), "contract-expiring");

const legacyFalseLoan = {
  ...onLoan,
  loan: { ...onLoan.loan, parentFreeAgent: "false" }
};
assert.equal(career.contractStateForSeasonTransition(legacyFalseLoan).freeAgent, false,
  "a legacy string false parentFreeAgent must not mark a returned player as a free agent");
const legacyTrueLoan = {
  ...onLoan,
  loan: { ...onLoan.loan, parentFreeAgent: "true" }
};
assert.equal(career.contractStateForSeasonTransition(legacyTrueLoan).freeAgent, true,
  "a legacy string true parentFreeAgent must preserve a parent's free-agent state");
assert.equal(career.contractStateForSeasonTransition(legacyTrueLoan).contractType, "free-agent",
  "a free-agent parent contract must retain its type when a loan ends");
assert.equal(career.contractStateForSeasonTransition(legacyTrueLoan).contractSeasons, 0,
  "a legacy free-agent parent must not retain a positive professional contract term");
assert.equal(career.contractStateForSeasonTransition(legacyTrueLoan).weeklyWage, 0,
  "a legacy free-agent parent must not regain a professional wage on loan return");
assert.ok(rootHtml.includes("parentContractType:state.contractType"),
  "browser loan snapshots must preserve the parent contract type");
assert.ok(rootHtml.includes('state.contractType=parentHasNoContract?"free-agent":parentContractType;'),
  "browser loan return must restore the normalized parent contract type");
assert.ok(rootHtml.includes('const parentFreeAgent=normalizeSavedBooleanFlag(l.parentFreeAgent);')
  && rootHtml.includes('const parentIsFreeAgent=parentFreeAgent||parentContractType.toLowerCase()==="free-agent";')
  && rootHtml.includes('const parentHasNoContract=parentIsFreeAgent||restoredParentContractSeasons<=0;')
  && rootHtml.includes('state.weeklyWage=parentHasNoContract?0:restoredParentWage;')
  && rootHtml.includes('state.contractSeasons=parentHasNoContract?0:restoredParentContractSeasons;')
  && rootHtml.includes('state.freeAgent=parentHasNoContract;'),
  "browser loan return must normalize legacy parentFreeAgent values and restore the parent contract consistently");
assert.ok(rootHtml.includes('state.role=safeParentText(l.parentRole,safeParentText(state.role,"بديل"));'),
  "browser loan return must restore the parent club role while preserving legacy saves without it");
assert.ok(rootHtml.includes('negotiationButton.disabled=!!state.loan||negotiationStatus!=="ready";'),
  "the contract screen must disable wage negotiation while the player is on loan");
assert.ok(rootHtml.includes('state.loan?"العقد الأصلي مع "+String(state.loan.parentClub||"النادي الأصلي")'),
  "the contract screen must identify the parent club as the contract owner during a loan");
assert.ok(!rootHtml.includes("state.freeAgent=!!l.parentFreeAgent;"),
  "browser loan return must not coerce string false to true");

const loanReturnMatch = rootHtml.match(/function returnFromLoan\(\)\{[\s\S]*?\n\}\n\nfunction renderContract/);
assert.ok(loanReturnMatch, "the deployed loan-return action must remain available for behavioral testing");
const loanReturnSource = loanReturnMatch[0].slice(0, loanReturnMatch[0].lastIndexOf("\n\nfunction renderContract"));
function runBrowserLoanReturnCase(loanOverrides, stateOverrides = {}) {
  const current = {
    clubName: "Host Club", leagueCountry: "Hostland", leagueDivision: 1,
    leagueCompetition: "Host League", leagueSource: "Host source", clubPower: 68,
    clubTier: 2, clubIndex: 2, weeklyWage: 900, contractSeasons: 3,
    freeAgent: false, contractType: "professional", role: "بديل",
    season: 4, day: 90, transferHistory: [], daysSinceNegotiation: 0,
    contractNegotiationWait: 4, transferCooldown: 0,
    loan: {
      parentClub: "Parent Club", parentCountry: "Egypt", parentDivision: 2,
      parentCompetition: "Parent League", parentSource: "Parent source",
      parentPower: 73, parentTier: 2, parentIndex: 2, parentWage: 450,
      parentContractSeasons: 2, parentFreeAgent: false,
      parentContractType: "professional", parentRole: "أساسي",
      ...loanOverrides
    },
    ...stateOverrides
  };
  const archiveReasons = [], messages = [];
  const sandbox = {
    state: current,
    withCareerStateTransaction: (_label, operation) => operation(),
    archiveCupForTransfer: () => {},
    archiveLeagueSegment: reason => archiveReasons.push(reason),
    normalizeSavedBooleanFlag: value => value === true || value === 1
      || String(value).trim().toLowerCase() === "true" || String(value).trim() === "1",
    clubPowerFor: () => 55,
    clubTierForPower: () => 1,
    log: message => messages.push(String(message))
  };
  vm.createContext(sandbox);
  vm.runInContext(loanReturnSource + "\nthis.returnLoanForTest = returnFromLoan;", sandbox,
    { filename: "browser loan-return integration" });
  const result = sandbox.returnLoanForTest();
  return { state: current, result, archiveReasons, messages };
}

const restoredLoan = runBrowserLoanReturnCase({});
assert.equal(restoredLoan.result, true);
assert.equal(restoredLoan.state.loan, null);
assert.equal(restoredLoan.state.clubName, "Parent Club");
assert.equal(restoredLoan.state.leagueCountry, "Egypt");
assert.equal(restoredLoan.state.leagueDivision, 2);
assert.equal(restoredLoan.state.weeklyWage, 450);
assert.equal(restoredLoan.state.contractSeasons, 2);
assert.equal(restoredLoan.state.contractType, "professional");
assert.equal(restoredLoan.state.freeAgent, false);
assert.equal(restoredLoan.state.role, "أساسي");
assert.deepEqual(restoredLoan.archiveReasons, ["loan-return"]);

const expiredParentLoan = runBrowserLoanReturnCase({ parentContractSeasons: 0 });
assert.equal(expiredParentLoan.result, true);
assert.equal(expiredParentLoan.state.loan, null);
assert.equal(expiredParentLoan.state.weeklyWage, 0,
  "an expired parent contract must not restore the temporary host-club wage");
assert.equal(expiredParentLoan.state.contractSeasons, 0);
assert.equal(expiredParentLoan.state.contractType, "free-agent");
assert.equal(expiredParentLoan.state.freeAgent, true,
  "a player whose parent contract expired during a loan must return as a free agent");

const malformedParentLoan = runBrowserLoanReturnCase({
  parentClub: "", parentCountry: "", parentWage: 450,
  parentContractSeasons: 2, parentFreeAgent: false, parentContractType: "professional"
});
assert.equal(malformedParentLoan.result, true,
  "a malformed legacy loan is a committed free-agent recovery, not a failed transaction");
assert.equal(malformedParentLoan.state.loan, null);
assert.equal(malformedParentLoan.state.weeklyWage, 0,
  "an un-restorable legacy loan must never leave the temporary host wage active");
assert.equal(malformedParentLoan.state.contractSeasons, 0,
  "an un-restorable legacy loan must not leave a phantom host contract");
assert.equal(malformedParentLoan.state.contractType, "free-agent");
assert.equal(malformedParentLoan.state.freeAgent, true);
assert.deepEqual(malformedParentLoan.archiveReasons, ["loan-return-invalid"]);
assert.ok(malformedParentLoan.state.transferHistory[0].text.includes("سوق اللاعبين الأحرار"),
  "the fallback must explain that the player was safely moved to the free-agent market");

const malformedContractSnapshot = career.contractStateForSeasonTransition({
  clubName: "Host Club", leagueCountry: "Hostland", weeklyWage: 900,
  contractSeasons: 3, freeAgent: false, contractType: "professional",
  loan: { parentClub: "", parentCountry: "", parentWage: 900,
    parentContractSeasons: 3, parentFreeAgent: false, parentContractType: "professional" }
});
assert.equal(malformedContractSnapshot.loan, null);
assert.equal(malformedContractSnapshot.weeklyWage, 0);
assert.equal(malformedContractSnapshot.contractSeasons, 0);
assert.equal(malformedContractSnapshot.contractType, "free-agent");
assert.equal(malformedContractSnapshot.freeAgent, true,
  "season transition checks must not offer a fake host-club renewal for a malformed legacy loan");

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
assert.equal(renewal.contractType, "professional", "renewing a contract must keep the player professionally signed");

const malformedWageCases = [
  [Infinity, 0], ["Infinity", 0], [NaN, 0], [-250, 0], [3.9, 3], [700, 700],
  [Number.MAX_SAFE_INTEGER + 1000, Number.MAX_SAFE_INTEGER]
];
for (const [savedWage, expectedWage] of malformedWageCases) {
  const wageState = { pos: "مهاجم", age: 24, weeklyWage: savedWage,
    agentCommissionPaid: Infinity, trainingXP: {}, randomSeed: 1, freeAgent: false };
  career.ensureState(wageState);
  assert.equal(wageState.weeklyWage, expectedWage,
    "legacy weekly wages must be finite, non-negative whole amounts capped at the safe integer limit");
  assert.equal(wageState.agentCommissionPaid, 0,
    "legacy agent commission totals must be normalized to finite non-negative values");
}
const missingActiveWage = { pos: "مهاجم", age: 24, freeAgent: false, trainingXP: {}, randomSeed: 1 };
career.ensureState(missingActiveWage);
assert.equal(missingActiveWage.weeklyWage, 250, "legacy active careers missing a wage must keep the standard fallback");
const missingFreeAgentWage = { pos: "مهاجم", age: 24, freeAgent: true, trainingXP: {}, randomSeed: 1 };
career.ensureState(missingFreeAgentWage);
assert.equal(missingFreeAgentWage.weeklyWage, 0, "legacy free agents missing a wage must not receive a phantom salary");

const legacyCareerFlagCases = [
  { freeAgent: false, retired: false, expectedFreeAgent: false, expectedRetired: false, wage: 250, seasons: 2, status: "ready" },
  { freeAgent: "false", retired: "false", expectedFreeAgent: false, expectedRetired: false, wage: 250, seasons: 2, status: "ready" },
  { freeAgent: "0", retired: "off", expectedFreeAgent: false, expectedRetired: false, wage: 250, seasons: 2, status: "ready" },
  { freeAgent: "true", retired: "false", expectedFreeAgent: true, expectedRetired: false, wage: 0, seasons: 0, status: "free-agent" },
  { freeAgent: "false", retired: "true", expectedFreeAgent: false, expectedRetired: true, wage: 0, seasons: 0, status: "retired" },
  { freeAgent: "malformed", retired: "malformed", expectedFreeAgent: false, expectedRetired: false, wage: 250, seasons: 2, status: "ready" }
];
for (const testCase of legacyCareerFlagCases) {
  const legacyFlags = {
    pos: "مهاجم", age: 24, freeAgent: testCase.freeAgent, retired: testCase.retired,
    daysSinceNegotiation: 99, trainingXP: {}, randomSeed: 1
  };
  career.ensureState(legacyFlags);
  assert.equal(legacyFlags.freeAgent, testCase.expectedFreeAgent,
    "legacy freeAgent strings must be parsed as booleans before contract defaults are applied");
  assert.equal(legacyFlags.retired, testCase.expectedRetired,
    "legacy retired strings must be parsed as booleans before contract defaults are applied");
  assert.equal(legacyFlags.weeklyWage, testCase.wage,
    "legacy string flags must not assign a phantom salary to active players or a salary to free agents/retired players");
  assert.equal(legacyFlags.contractSeasons, testCase.seasons,
    "legacy string flags must not create or erase a contract incorrectly");
  assert.equal(career.wageNegotiationStatus(legacyFlags), testCase.status,
    "wage negotiation must respect normalized legacy career flags");
  assert.equal(career.shouldRetire({ age: 24, retired: testCase.retired }), testCase.expectedRetired,
    "the retirement predicate must parse legacy string flags safely");
  assert.equal(career.loanRequestStatus({ ...legacyFlags, apps: 2 }, { windowOpen: true }),
    testCase.status === "ready" ? "ready" : testCase.status,
    "loan eligibility must respect normalized legacy career flags");
  assert.equal(career.evaluateSquadRole({ role: "بديل", retired: testCase.retired }, []).reason,
    testCase.expectedRetired ? "protected-career" : "no-appearances",
    "legacy retired flags must not incorrectly freeze squad-role evaluation");
  const purchaseState = { retired: testCase.retired, money: 100, shooting: 50, dribbling: 50 };
  assert.equal(career.purchaseItem(purchaseState, { id: "boots", price: 20 }).status,
    testCase.expectedRetired ? "retired" : "purchased",
    "legacy retired flags must not incorrectly block store purchases");
}
assert.ok(rootHtml.includes("state.freeAgent = normalizeLegacyBoolean(state.freeAgent);"),
  "the inline browser career engine must normalize saved free-agent flags");
assert.ok(rootHtml.includes("state.retired = normalizeLegacyBoolean(state.retired);"),
  "the deployed browser career engine must normalize saved retirement flags");
assert.ok(rootHtml.includes("state.playedToday = normalizeLegacyBoolean(state.playedToday);"),
  "the deployed browser career engine must normalize saved match-day flags");
assert.ok(rootHtml.includes("state.trainedToday = normalizeLegacyBoolean(state.trainedToday);"),
  "the deployed browser career engine must normalize saved training-day flags");
assert.ok(rootHtml.includes("state.nightToday = normalizeLegacyBoolean(state.nightToday);"),
  "the deployed browser career engine must normalize saved night-action flags");
assert.ok(rootHtml.includes("state.dailyActionUsed = normalizeLegacyBoolean(state.dailyActionUsed);"),
  "the deployed browser career engine must normalize saved daily-action usage flags");
for (const flag of ["journeyTransferReviewed", "journeyEventSeen", "journeySeasonReviewed", "seasonFinished", "winterBreakPending"]) {
  assert.ok(rootHtml.includes(`state.${flag} = normalizeLegacyBoolean(state.${flag});`),
    `the browser career engine must normalize saved ${flag} flags`);
  assert.ok(!rootHtml.includes(`state.${flag}=!!state.${flag};`),
    `save migration must not re-coerce normalized ${flag} with JavaScript truthiness`);
}
assert.ok(!rootHtml.includes("state.retired=!!state.retired;"),
  "save migration must not re-coerce a normalized legacy retirement flag with JavaScript truthiness");

const corruptedNegotiation = { ...renewalBase, weeklyWage: Infinity, contractSeasons: 3,
  freeAgent: false, daysSinceNegotiation: 7, randomSeed: 1 };
career.resolveWageNegotiation(corruptedNegotiation, 100, 2);
assert.equal(corruptedNegotiation.weeklyWage, 0,
  "wage negotiation must normalize a non-finite existing wage before applying a raise");
assert.ok(Number.isFinite(corruptedNegotiation.weeklyWage),
  "wage negotiation must never produce an infinite salary");
const invalidWageOffer = career.makeContractOffer({ ...renewalBase, weeklyWage: Infinity, trust: Infinity }, false);
assert.ok(Number.isFinite(invalidWageOffer.wage) && invalidWageOffer.wage <= Number.MAX_SAFE_INTEGER,
  "contract offers must remain finite when saved wage or trust values are invalid");
const oversizedRenewal = { weeklyWage: 500, contractSeasons: 1, freeAgent: false };
assert.equal(career.resolveContractDecision(oversizedRenewal, "accept",
  { wage: Number.MAX_VALUE, seasons: 3 }).status, "renewed");
assert.equal(oversizedRenewal.weeklyWage, Number.MAX_SAFE_INTEGER,
  "accepting a very large finite contract offer must cap the saved wage");

const corruptedContract = { pos: "مهاجم", age: 24, freeAgent: false, retired: false,
  contractSeasons: Infinity, daysSinceNegotiation: Infinity, weeklyWage: 500, trainingXP: {}, randomSeed: 1 };
career.ensureState(corruptedContract);
assert.equal(corruptedContract.contractSeasons, 2,
  "non-finite saved contract duration must fall back to a finite active contract");
assert.equal(corruptedContract.daysSinceNegotiation, 0,
  "non-finite negotiation history must not bypass the cooldown");
assert.equal(career.wageNegotiationStatus(corruptedContract), "cooldown");
assert.equal(career.wageNegotiationStatus({
  contractSeasons: Infinity, freeAgent: false, daysSinceNegotiation: 99
}), "contract-expiring", "an unvalidated infinite contract must not allow negotiation");
assert.equal(career.wageNegotiationStatus({
  contractSeasons: 3, freeAgent: false, daysSinceNegotiation: Infinity
}), "cooldown", "an infinite cooldown counter must not make negotiation immediately ready");
const missingContract = { pos: "مهاجم", age: 24, freeAgent: false, trainingXP: {}, randomSeed: 1 };
career.ensureState(missingContract);
assert.equal(missingContract.contractSeasons, 2, "legacy active saves missing a contract duration must get the standard fallback");
assert.equal(missingContract.daysSinceNegotiation, 99, "legacy saves missing negotiation history must preserve the ready-by-default behavior");
const missingFreeAgentContract = { pos: "مهاجم", age: 24, freeAgent: true, trainingXP: {}, randomSeed: 1 };
career.ensureState(missingFreeAgentContract);
assert.equal(missingFreeAgentContract.contractSeasons, 0, "legacy free agents must not receive a phantom contract");

for (const engine of [career]) {
  const staleFreeAgentType = {
    pos: "مهاجم", age: 24, freeAgent: false, contractType: "free-agent",
    weeklyWage: 900, contractSeasons: 3, apps: 12, trainingXP: {}, randomSeed: 1
  };
  engine.ensureState(staleFreeAgentType);
  assert.equal(staleFreeAgentType.freeAgent, true, "a saved free-agent contract type must normalize the legacy boolean flag");
  assert.equal(staleFreeAgentType.contractSeasons, 0, "a legacy free-agent type must not retain a phantom contract term");
  assert.equal(staleFreeAgentType.weeklyWage, 0, "a legacy free-agent type must not retain a club salary");
  assert.equal(engine.wageNegotiationStatus(staleFreeAgentType), "free-agent");
  assert.equal(engine.loanRequestStatus({ ...staleFreeAgentType, apps: 12 }, { windowOpen: true }), "free-agent");
  assert.equal(engine.resolveContractDecision(staleFreeAgentType, "accept",
    { club: "Test FC", wage: 1200, seasons: 3 }).status, "free-agent",
    "a legacy free-agent must not renew a contract it no longer owns");
}

const infiniteTerm = { weeklyWage: 500, contractSeasons: 1, freeAgent: false };
career.resolveContractDecision(infiniteTerm, "accept", { wage: 650, seasons: Infinity });
assert.equal(infiniteTerm.contractSeasons, 4, "an infinite offered term must fall back to the standard three-season offer");
const oversizedTerm = { weeklyWage: 500, contractSeasons: 1, freeAgent: false };
career.resolveContractDecision(oversizedTerm, "accept", { wage: 650, seasons: Number.MAX_VALUE });
assert.equal(oversizedTerm.contractSeasons, 6, "accepted contract terms must be capped at five offered seasons plus the current season");
assert.equal(career.shouldRetire({ age: 40 }), true);
assert.equal(career.shouldRetire({ age: 39 }), false);

const rotationHistory = Array.from({ length: 8 }, (_, index) => ({
  id: "rotation-form-" + index, scope: "league", minutes: 70, rating: 6.8,
  goals: 0, assists: 0
}));
const rotationPromotion = career.evaluateSquadRole({
  role: "تناوب", apps: 16, goals: 0, assists: 0, trust: 55, pos: "وسط دفاعي"
}, rotationHistory);
assert.equal(rotationPromotion.role, "أساسي",
  "a rotation-contract player who sustains strong recent performances should earn a starter role");
assert.equal(rotationPromotion.changed, true);
const reservePromotion = career.evaluateSquadRole({
  role: "لاعب بديل", apps: 10, goals: 0, assists: 0, trust: 55, pos: "وسط دفاعي"
}, rotationHistory);
assert.equal(reservePromotion.role, "بديل أساسي",
  "a substitute contract label should use the same evidence-based promotion path as legacy substitute saves");
const prospectPromotion = career.evaluateSquadRole({
  role: "لاعب ناشئ", apps: 3, goals: 0, assists: 0, trust: 25, pos: "جناح"
}, rotationHistory.slice(0, 2));
assert.equal(prospectPromotion.role, "بديل",
  "a prospect label should become a normal substitute role after recording real appearances");

const poorFormHistory = Array.from({ length: 8 }, (_, index) => ({
  id: "poor-form-" + index, scope: "league", minutes: 70, rating: 5.2,
  goals: 0, assists: 0
}));
const poorStarterDecision = career.evaluateSquadRole({
  role: "أساسي", apps: 20, goals: 0, assists: 0, trust: 20, pos: "وسط"
}, poorFormHistory);
assert.equal(poorStarterDecision.role, "بديل أساسي",
  "a starter with sustained poor ratings and low trust must lose the automatic starter role");
assert.equal(poorStarterDecision.reason, "form-demotion",
  "role demotions must be identifiable separately from promotions");
const shortCameoHistory = Array.from({ length: 6 }, (_, index) => ({
  id: "short-cameo-" + index, scope: "league", minutes: 5, rating: 4.4, goals: 0, assists: 0
}));
const cameoOnlyDecision = career.evaluateSquadRole({
  role: "أساسي", apps: 20, goals: 0, assists: 0, trust: 20, pos: "وسط"
}, shortCameoHistory);
assert.equal(cameoOnlyDecision.role, "أساسي",
  "six five-minute cameos are not enough evidence to demote a starter");
const mixedMinuteHistory = [
  ...Array.from({ length: 2 }, (_, index) => ({
    id: "full-start-" + index, scope: "league", minutes: 90, rating: 7.5, goals: 0, assists: 0
  })),
  ...Array.from({ length: 6 }, (_, index) => ({
    id: "short-poor-cameo-" + index, scope: "league", minutes: 5, rating: 4.5, goals: 0, assists: 0
  }))
];
const mixedMinuteDecision = career.evaluateSquadRole({
  role: "أساسي", apps: 20, goals: 0, assists: 0, trust: 20, pos: "وسط"
}, mixedMinuteHistory);
assert.equal(mixedMinuteDecision.role, "أساسي",
  "short poor cameos must not outweigh two strong full-match performances");
assert.ok(mixedMinuteDecision.recentAverageRating > 7,
  "recent squad-form rating must be weighted by minutes played");
const strongCameoHistory = Array.from({ length: 8 }, (_, index) => ({
  id: "strong-cameo-" + index, scope: "league", minutes: 5, rating: 8.5, goals: 1, assists: 1
}));
const cameoRotationPromotion = career.evaluateSquadRole({
  role: "بديل", apps: 16, goals: 8, assists: 8, trust: 55, pos: "وسط"
}, strongCameoHistory);
assert.equal(cameoRotationPromotion.role, "بديل",
  "high ratings and contributions in five-minute cameos must not trigger a rotation promotion");
const cameoStarterPromotion = career.evaluateSquadRole({
  role: "تناوب", apps: 16, goals: 8, assists: 8, trust: 55, pos: "وسط"
}, strongCameoHistory);
assert.equal(cameoStarterPromotion.role, "تناوب",
  "short cameos alone must not promote a rotation player to the starting eleven");


const poorRotationDecision = career.evaluateSquadRole({
  role: "تناوب", apps: 20, goals: 0, assists: 0, trust: 15, pos: "وسط"
}, poorFormHistory);
assert.equal(poorRotationDecision.role, "بديل",
  "a rotation player with sustained poor form must move to a substitute role");
const poorStarDecision = career.evaluateSquadRole({
  role: "نجم الفريق", apps: 20, goals: 0, assists: 0, trust: 15, pos: "وسط"
}, poorFormHistory);
assert.equal(poorStarDecision.role, "أساسي",
  "a star-player role must step down to starter after a long poor run, not remain protected forever");
const shortPoorRunDecision = career.evaluateSquadRole({
  role: "أساسي", apps: 20, goals: 0, assists: 0, trust: 10, pos: "وسط"
}, poorFormHistory.slice(0, 3));
assert.equal(shortPoorRunDecision.role, "أساسي",
  "a small poor-form sample must not demote a player after only three rated matches");
assert.equal(career.normalizeCareerPosition("ST"), "رأس حربة",
  "legacy English striker positions must normalize to the centre-forward career role");
for (const [alias, expected] of [
  ["left back", "ظهير"], ["right back", "ظهير"], ["left wing back", "ظهير"],
  ["right wing back", "ظهير"], ["wingback", "ظهير"], ["central midfield", "وسط"],
  ["left midfielder", "جناح"], ["right midfielder", "جناح"]
]) {
  assert.equal(career.normalizeCareerPosition(alias), expected,
    "career engine must normalize the same English position alias: " + alias);
}
const forwardAliasHistory = Array.from({ length: 8 }, (_, index) => ({
  id: "forward-alias-" + index, scope: "league", minutes: 60, rating: 6.0, goals: 1, assists: 0
}));
const englishForwardPromotion = career.evaluateSquadRole({
  role: "بديل", apps: 35, goals: 20, assists: 0, trust: 0, pos: "ST"
}, forwardAliasHistory);
const arabicForwardPromotion = career.evaluateSquadRole({
  role: "بديل", apps: 35, goals: 20, assists: 0, trust: 0, pos: "رأس حربة"
}, forwardAliasHistory);
assert.equal(englishForwardPromotion.role, arabicForwardPromotion.role,
  "a legacy ST save must receive the same evidence-based forward promotion as an Arabic position");
assert.equal(englishForwardPromotion.role, "أساسي",
  "the high-output forward fixture should complete both promotion thresholds in one evaluation");
const englishMidfieldControl = career.evaluateSquadRole({
  role: "بديل", apps: 35, goals: 20, assists: 0, trust: 0, pos: "CM"
}, forwardAliasHistory);
assert.equal(englishMidfieldControl.role, "بديل",
  "central midfield aliases must not accidentally use the forward-only promotion shortcut");

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
const legacyDailyTraining = makeProgressionFixture(false);
legacyDailyTraining.playedToday = "false";
legacyDailyTraining.trainedToday = "false";
const legacyTrainingResult = career.train(legacyDailyTraining, "shooting", { random: () => 0.99 });
assert.equal(legacyTrainingResult.ok, true,
  "legacy string false flags must not block a valid training session");
assert.equal(legacyDailyTraining.playedToday, false,
  "legacy match-day flag must be normalized to a boolean before training");
assert.equal(legacyDailyTraining.trainedToday, true,
  "a successful training session must still set the normalized daily training flag");
const legacySideActionFlags = makeProgressionFixture(false);
legacySideActionFlags.dailyActionUsed = "false";
legacySideActionFlags.nightToday = "false";
career.ensureState(legacySideActionFlags);
assert.equal(legacySideActionFlags.dailyActionUsed, false,
  "legacy string false must not consume the daily side-action slot");
assert.equal(legacySideActionFlags.nightToday, false,
  "legacy string false must not masquerade as a night action");
legacySideActionFlags.dailyActionUsed = "true";
legacySideActionFlags.nightToday = "true";
career.ensureState(legacySideActionFlags);
assert.equal(legacySideActionFlags.dailyActionUsed, true,
  "legacy string true must preserve an already-used side-action slot");
assert.equal(legacySideActionFlags.nightToday, true,
  "legacy string true must preserve the saved night-action state");
const legacySeasonFlowFlags = makeProgressionFixture(false);
const seasonFlowFlagNames = ["journeyTransferReviewed", "journeyEventSeen", "journeySeasonReviewed", "seasonFinished", "winterBreakPending"];
Object.assign(legacySeasonFlowFlags, Object.fromEntries(seasonFlowFlagNames.map(flag => [flag, "false"])));
career.ensureState(legacySeasonFlowFlags);
for (const flag of seasonFlowFlagNames) {
  assert.equal(legacySeasonFlowFlags[flag], false, `legacy string false must not set ${flag}`);
}
Object.assign(legacySeasonFlowFlags, Object.fromEntries(seasonFlowFlagNames.map(flag => [flag, "true"])));
career.ensureState(legacySeasonFlowFlags);
for (const flag of seasonFlowFlagNames) {
  assert.equal(legacySeasonFlowFlags[flag], true, `legacy string true must preserve ${flag}`);
}
const legacyMatchDay = makeProgressionFixture(false);
legacyMatchDay.playedToday = "true";
assert.equal(career.train(legacyMatchDay, "shooting", { random: () => 0.99 }).ok, false,
  "legacy string true must continue to block training on match day");
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


const advancedDefender = makeProgressionFixture(false);
advancedDefender.pos = "قلب دفاع";
const advancedDefenderProgress = career.matchDevelopment(advancedDefender, {
  matchId: "extended-defensive-actions", minutes: 90, rating: 8, goals: 0, assists: 0,
  stats: { tacklesWon: 4, interceptions: 3, clearances: 4, ballRecoveries: 3, cleanSheet: true }
});
assert.ok(advancedDefenderProgress.positionActionXP > 0 && advancedDefenderProgress.defensiveXP > 0);
const penaltyKeeper = makeProgressionFixture(false);
penaltyKeeper.pos = "حارس مرمى";
const penaltyKeeperProgress = career.matchDevelopment(penaltyKeeper, {
  matchId: "penalty-save-xp", minutes: 120, rating: 8, goals: 0, assists: 0,
  stats: { penaltiesSaved: 1, saves: 2, cleanSheet: false }
});
assert.ok(penaltyKeeperProgress.positionActionXP >= 9);

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

const highProfessionalismCurve = { pos: "جناح", age: 33, fitness: 75, speed: 80, physical: 70, professionalism: 90 };
career.applySeasonAging(highProfessionalismCurve);
assert.equal(highProfessionalismCurve.fitness, 75);
assert.equal(highProfessionalismCurve.speed, 80);
const evenProfessionalismCurve = { pos: "جناح", age: 34, fitness: 75, speed: 80, physical: 70, professionalism: 90 };
career.applySeasonAging(evenProfessionalismCurve);
assert.equal(evenProfessionalismCurve.fitness, 74);


const legacyInventoryFlags = makeProgressionFixture(false);
Object.assign(legacyInventoryFlags, Object.fromEntries(legacyInventoryFlagNames.map(flag => [flag, "false"])));
career.ensureState(legacyInventoryFlags);
for (const flag of legacyInventoryFlagNames) {
  assert.equal(legacyInventoryFlags[flag], false, `legacy string false must not activate ${flag}`);
}
Object.assign(legacyInventoryFlags, Object.fromEntries(legacyInventoryFlagNames.map(flag => [flag, "true"])));
career.ensureState(legacyInventoryFlags);
for (const flag of legacyInventoryFlagNames) {
  assert.equal(legacyInventoryFlags[flag], true, `legacy string true must preserve ${flag}`);
}

const legacyCupStatus = makeProgressionFixture(false);
legacyCupStatus.cupState = { champion: "false", eliminated: "false", abandoned: "false", history: [], teams: [] };
career.ensureState(legacyCupStatus);
for (const flag of cupTerminalFlagNames) {
  assert.equal(legacyCupStatus.cupState[flag], false, `legacy string false must not mark cup ${flag}`);
}
Object.assign(legacyCupStatus.cupState, { champion: "true", eliminated: "true", abandoned: "true" });
career.ensureState(legacyCupStatus);
for (const flag of cupTerminalFlagNames) {
  assert.equal(legacyCupStatus.cupState[flag], true, `legacy string true must preserve cup ${flag}`);
}

const legacyCupHistoryState = makeProgressionFixture(false);
legacyCupHistoryState.cupHistory = [
  { name: "Legacy false flags", champion: "false", eliminated: "false", abandoned: "false", leftByTransfer: "false" },
  { name: "Legacy true flags", champion: "true", eliminated: "true", abandoned: "true", leftByTransfer: "true" },
  { name: "Legacy missing flags" }
];
career.ensureState(legacyCupHistoryState);
assert.equal(legacyCupHistoryState.cupHistory[0].champion, false,
  "legacy string false cup-history champions must not be treated as titles");
assert.equal(legacyCupHistoryState.cupHistory[0].eliminated, false,
  "legacy string false cup-history elimination must remain false");
assert.equal(legacyCupHistoryState.cupHistory[0].abandoned, false,
  "legacy string false cup-history abandonment must remain false");
assert.equal(legacyCupHistoryState.cupHistory[0].leftByTransfer, false,
  "legacy string false transfer flags must remain false");
assert.equal(legacyCupHistoryState.cupHistory[1].champion, true,
  "legacy string true cup-history champions must preserve recorded titles");
assert.equal(legacyCupHistoryState.cupHistory[1].eliminated, true,
  "legacy string true cup-history elimination must be preserved");
assert.equal(legacyCupHistoryState.cupHistory[1].abandoned, true,
  "legacy string true cup-history abandonment must be preserved");
assert.equal(legacyCupHistoryState.cupHistory[1].leftByTransfer, true,
  "legacy string true transfer flags must be preserved");
assert.equal(Object.prototype.hasOwnProperty.call(legacyCupHistoryState.cupHistory[2], "champion"), false,
  "normalization must preserve missing historical fields instead of fabricating status");
const legacyStringFalseAgent = makeProgressionFixture(false);
legacyStringFalseAgent.agent = "false";
career.ensureState(legacyStringFalseAgent);
assert.equal(legacyStringFalseAgent.agent, false, "legacy string false agent state must not grant agent benefits");
const legacyStringTrueAgent = makeProgressionFixture(false);
legacyStringTrueAgent.agent = "true";
career.ensureState(legacyStringTrueAgent);
assert.equal(legacyStringTrueAgent.agent, true, "legacy string true agent state must preserve a valid contract flag");

const polymorphicAgentState = makeProgressionFixture(false);
const agentProfile = { id: "legacy-agent-profile" };
polymorphicAgentState.agent = agentProfile;
career.ensureState(polymorphicAgentState);
assert.equal(polymorphicAgentState.agent, agentProfile,
  "legacy-state normalization must preserve object-valued agent profiles");

const legacyCareerPerkFlags = makeProgressionFixture(false);
Object.assign(legacyCareerPerkFlags, Object.fromEntries(legacyCareerPerkFlagNames.map(flag => [flag, "false"])));
career.ensureState(legacyCareerPerkFlags);
for (const flag of legacyCareerPerkFlagNames) {
  assert.equal(legacyCareerPerkFlags[flag], false, `legacy string false must not activate ${flag}`);
}
Object.assign(legacyCareerPerkFlags, Object.fromEntries(legacyCareerPerkFlagNames.map(flag => [flag, "true"])));
career.ensureState(legacyCareerPerkFlags);
for (const flag of legacyCareerPerkFlagNames) {
  assert.equal(legacyCareerPerkFlags[flag], true, `legacy string true must preserve ${flag}`);
}

const legacyTournamentFlags = makeProgressionFixture(false);
Object.assign(legacyTournamentFlags, {
  nationalCalled: "false", nationalTournamentDone: "false", nationalTournamentQualified: "false",
  nationalTournamentWinner: "false", internationalPlayed: "false",
  nationalTournamentMatches: 0, nationalTournamentPoints: 0, nationalTournamentFinalOutcome: ""
});
career.ensureState(legacyTournamentFlags);
for (const flag of tournamentFlagNames) {
  assert.equal(legacyTournamentFlags[flag], false, `legacy string false must not set ${flag}`);
}

const legacyFalseDoneTournament = makeProgressionFixture(false);
Object.assign(legacyFalseDoneTournament, {
  nationalTournamentDone: "false", nationalTournamentQualified: "false",
  nationalTournamentWinner: "false", internationalPlayed: "false",
  nationalTournamentMatches: 0, nationalTournamentPoints: 0
});
assert.equal(career.recordNationalTournamentMatch(legacyFalseDoneTournament, "فوز").status, "group",
  "a legacy string false must not close an in-progress international tournament");

const legacyQualifiedFinal = makeProgressionFixture(false);
Object.assign(legacyQualifiedFinal, {
  nationalTournamentDone: "false", nationalTournamentQualified: "true",
  nationalTournamentWinner: "false", internationalPlayed: "false",
  nationalTournamentMatches: 3, nationalTournamentPoints: 4
});
assert.equal(career.recordNationalTournamentMatch(legacyQualifiedFinal, "فوز").status, "champion",
  "a legacy string true qualification must allow a qualified team to play the final");

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

const hostileTournamentNumber = {
  valueOf() { throw new Error("unsafe-tournament-counter-coercion"); },
  toString() { throw new Error("unsafe-tournament-counter-coercion"); }
};
const malformedTournamentCounterCases = [
  { matches: [2], points: [3], label: "single-item arrays" },
  { matches: Object(2), points: Object(3), label: "boxed numbers" },
  { matches: Symbol("matches"), points: hostileTournamentNumber, label: "Symbols and hostile coercion objects" }
];
for (const malformed of malformedTournamentCounterCases) {
  const state = {
    nationalTournamentMatches: malformed.matches,
    nationalTournamentPoints: malformed.points,
    nationalTournamentDone: false,
    nationalTournamentQualified: false,
    nationalTournamentWinner: false,
    nationalTournamentFinalOutcome: "",
    internationalPlayed: false
  };
  const result = career.recordNationalTournamentMatch(state, "تعادل");
  assert.equal(result.status, "group",
    malformed.label + " must not be interpreted as valid tournament counters");
  assert.equal(state.nationalTournamentMatches, 1,
    malformed.label + " must recover the match counter from zero");
  assert.equal(state.nationalTournamentPoints, 1,
    malformed.label + " must recover the points counter from zero");
}
const numericStringTournamentCounters = {
  nationalTournamentMatches: "2", nationalTournamentPoints: "3", nationalTournamentDone: false,
  nationalTournamentQualified: false, nationalTournamentWinner: false,
  nationalTournamentFinalOutcome: "", internationalPlayed: false
};
assert.equal(career.recordNationalTournamentMatch(numericStringTournamentCounters, "تعادل").status, "final-qualified",
  "numeric-string legacy tournament counters must remain compatible");
assert.equal(numericStringTournamentCounters.nationalTournamentMatches, 3);
assert.equal(numericStringTournamentCounters.nationalTournamentPoints, 4);

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

const malformedScopeValue = Symbol("malformed-scope");
function makeLegacyScopeHistoryState() {
  const duplicateIdentity = {
    id: "scope-shared-fixture", competition: "Test League", leagueCompetition: "Test League",
    season: 9, segmentId: "season-9", club: "Test FC", opponent: "Rival FC", day: 1,
    scope: " LEAGUE ", minutes: 90, goals: 1, assists: 0, rating: 6
  };
  return {
    apps: 6,
    seasonLog: [
      duplicateIdentity,
      { id: "scope-uppercase-only", scope: " LEAGUE ", season: 9, competition: "Test League",
        leagueCompetition: "Test League", club: "Test FC", opponent: "Rival 2", day: 2,
        minutes: 90, goals: 0, assists: 1, rating: 8.1 },
      { id: "scope-blank-legacy", scope: "   ", season: 9, competition: "Test League",
        leagueCompetition: "Test League", club: "Test FC", opponent: "Rival 3", day: 3,
        minutes: 90, goals: 0, assists: 0, rating: 7.4 },
      { id: "scope-cup", scope: " CUP ", season: 9, competition: "National Cup",
        leagueCompetition: "National Cup", club: "Test FC", opponent: "Cup Rival", day: 4,
        minutes: 90, goals: 1, assists: 0, rating: 9.9 },
      { id: "scope-international", scope: " International ", season: 9, competition: "International",
        leagueCompetition: "International", club: "Egypt", opponent: "Other Country", day: 5,
        minutes: 90, goals: 1, assists: 1, rating: 10 },
      { id: "scope-malformed", scope: malformedScopeValue, season: 9, competition: "Unknown",
        club: "Test FC", opponent: "Rival 4", day: 6,
        minutes: 90, goals: 0, assists: 0, rating: 10 },
      ["invalid-season-log-array-row"]
    ],
    careerMatchHistory: [{
      ...duplicateIdentity, scope: " league ", minutes: 75, goals: 2, assists: 1, rating: 8.6
    }]
  };
}
for (const [engineName, engine] of [["shared", career], ["deployed", deployedCareer]]) {
  const scopeState = makeLegacyScopeHistoryState();
  const rebuilt = engine.rebuildLegacyCareerStats(scopeState);
  assert.equal(rebuilt.length, 6,
    engineName + " legacy history rebuilding must ignore array rows and deduplicate normalized legacy league scope copies");
  assert.equal(JSON.stringify(rebuilt.map(row => row.scope)),
    JSON.stringify(["league", "league", "league", "cup", "international", ""]),
    engineName + " history scopes must be normalized without collapsing cup, international, or malformed scopes");
  assert.equal(scopeState.careerMinutes, 525,
    engineName + " career minutes must retain the latest 75-minute snapshot and five other unique fixtures");
  assert.equal(scopeState.qualifyingAppearances, 6,
    engineName + " all unique official competition rows must retain their qualifying appearances");
  const scopeRatings = engine.deriveLeagueRatingStats(scopeState);
  assert.equal(JSON.stringify(scopeRatings), JSON.stringify({ sum: 24.1, count: 3 }),
    engineName + " league averages must include uppercase/whitespace legacy league scopes and exclude cup/international scopes");
  assert.equal(scopeState.seasonLog[0].scope, " LEAGUE ",
    engineName + " normalization must not mutate the original legacy season-log row");
  assert.equal(scopeState.seasonLog[5].scope, malformedScopeValue,
    engineName + " normalization must leave malformed saved scope fields untouched");
  assert.equal(Array.isArray(scopeState.seasonLog[6]), true,
    engineName + " migration must not rewrite the original malformed array row");
}

// Current-season award qualification must use the same canonical league-scope rules.
function makeNormalizedScopeAwardState() {
  return {
    age: 24, pos: "مهاجم", clubName: "Test FC", leagueCountry: "England",
    leagueCompetition: "Test League", season: 4, calendarDay: 120, money: 0,
    topScorerAwards: 0, careerAwards: [], seasonLog: [],
    careerMatchHistory: Array.from({ length: 3 }, (_, index) => ({
      id: "normalized-scope-award-" + index, scope: index === 0 ? " LEAGUE " : "League ",
      season: 4, competition: "Test League", leagueCompetition: "Test League",
      leagueCountry: "England", club: "Test FC", opponent: "Award Rival " + index,
      day: index + 1, minutes: 90, rating: 8.2, goals: 1, assists: 0
    }))
  };
}
for (const [engineName, engine] of [["shared", career], ["deployed", deployedCareer]]) {
  const scopeAwardState = makeNormalizedScopeAwardState();
  engine.seasonAwards(scopeAwardState, [{ name: "Test FC", power: 50 }], 1);
  const scopeGoldenBoot = scopeAwardState.careerAwards.find(award => award.id === "golden-boot");
  assert.ok(scopeGoldenBoot,
    engineName + " season awards must count case/whitespace-normalized legacy league fixtures");
  assert.equal(scopeGoldenBoot.note, "3 هدف في 3 مشاركة",
    engineName + " season award appearances and goals must be rebuilt from normalized league scopes");
}



function makeCurrentMatchPriorityState() {
  const legacyRows = [];
  const currentRows = [];
  for (let index = 0; index < 3; index++) {
    const identity = {
      id: "priority-fixture-" + index, season: 1,
      competition: "Test League", leagueCompetition: "Test League",
      leagueCountry: "England", club: "Test FC", opponent: "Opponent " + index,
      day: index + 1
    };
    legacyRows.push({ ...identity, scope: "league", minutes: 90, goals: 0, assists: 0, rating: 6.1 });
    currentRows.push({ ...identity, minutes: 75, goals: 1, assists: 1, rating: 8.6 });
  }
  return {
    age: 24, pos: "مهاجم", clubName: "Test FC", leagueCountry: "England",
    leagueCompetition: "Test League", season: 1, calendarDay: 120,
    money: 0, topScorerAwards: 0, careerAwards: [], apps: 3,
    seasonLog: legacyRows, careerMatchHistory: currentRows
  };
}

for (const [engineName, engine] of [["shared", career], ["deployed", deployedCareer]]) {
  const historyState = makeCurrentMatchPriorityState();
  const rebuiltRows = engine.rebuildLegacyCareerStats(historyState);
  assert.equal(rebuiltRows.length, 3,
    engineName + " history migration must count each overlapping fixture only once");
  assert.equal(rebuiltRows[0].goals, 1,
    engineName + " history migration must prefer the current match snapshot over stale seasonLog data");
  assert.equal(rebuiltRows[0].minutes, 75,
    engineName + " career minutes must use the current match snapshot when duplicate stores disagree");
  assert.equal(rebuiltRows[0].scope, "league",
    engineName + " current snapshots without an explicit scope must retain the legacy default league classification");
  assert.equal(historyState.careerMinutes, 225,
    engineName + " rebuilt career minutes must reflect the three current 75-minute appearances");
  assert.equal(historyState.qualifyingAppearances, 3,
    engineName + " qualifying appearances must remain single-counted after snapshot precedence");
  const ratingStats = engine.deriveLeagueRatingStats(historyState);
  assert.equal(ratingStats.count, 3,
    engineName + " league rating reconstruction must count each current fixture once");
  assert.ok(Math.abs(ratingStats.sum - 25.8) < 0.001,
    engineName + " league rating reconstruction must use the latest 8.6 ratings");

  const awardState = makeCurrentMatchPriorityState();
  engine.seasonAwards(awardState, [{ name: "Test FC", power: 50 }], 1);
  const currentBoot = awardState.careerAwards.find(award => award.id === "golden-boot");
  assert.ok(currentBoot,
    engineName + " season awards must calculate goals from current match snapshots, not stale legacy duplicates");
  assert.equal(currentBoot.note, "3 هدف في 3 مشاركة",
    engineName + " golden boot totals must use current goals and count overlapping fixtures once");
  const playerOfSeason = awardState.careerAwards.find(award => award.id === "league-player");
  assert.ok(playerOfSeason && playerOfSeason.note.includes("تقييم 8.60"),
    engineName + " season award ratings must use the latest saved match ratings");
}

function makeSegmentScopedAwardState() {
  const makeRow = (matchId, segmentId, goals, extra = {}) => ({
    matchId, segmentId, scope: "league", leagueCountry: "England",
    leagueCompetition: "Test League", minutes: 90, rating: 8, goals, assists: 0, ...extra
  });
  return {
    age: 24, pos: "مهاجم", clubName: "Test FC", leagueCountry: "England",
    leagueCompetition: "Test League", season: 1, calendarDay: 120, money: 0,
    topScorerAwards: 0, careerAwards: [], seasonLog: [],
    leagueSegmentId: "active-segment-1",
    leagueArchives: [
      { season: 1, segmentId: "archived-segment-1" },
      { season: 2, segmentId: "archived-segment-2" }
    ],
    careerMatchHistory: [
      makeRow("archived-segment-match-1", "archived-segment-1", 1),
      makeRow("archived-segment-match-2", "archived-segment-1", 1),
      makeRow("active-segment-match-3", "active-segment-1", 1),
      makeRow("unknown-season-match", "", 20),
      makeRow("prior-season-segment-match", "archived-segment-2", 20),
      makeRow("explicit-prior-season-match", "archived-segment-1", 20, { season: 2 })
    ]
  };
}

for (const [engineName, engine] of [["shared", career], ["deployed", deployedCareer]]) {
  const segmentScopedState = makeSegmentScopedAwardState();
  engine.seasonAwards(segmentScopedState, [{ name: "Test FC", power: 50 }], 1);
  const segmentScopedBoot = segmentScopedState.careerAwards.find(award => award.id === "golden-boot");
  assert.ok(segmentScopedBoot,
    engineName + " awards must recover season-less career rows whose segment is archived in the current season");
  assert.equal(segmentScopedBoot.note, "3 هدف في 3 مشاركة",
    engineName + " awards must include current archived/active segments but exclude unknown and prior-season rows");
}

const unidentifiedLegacyRepeat = {
  scope: "league", competition: "Premier League", season: 4, club: "Test FC",
  opponent: "Repeat Opponent", teamGoals: 1, oppGoals: 0, minutes: 90, goals: 0, assists: 0
};
const unidentifiedLegacyRows = [unidentifiedLegacyRepeat, { ...unidentifiedLegacyRepeat }];
const identifiedLegacyRepeat = { ...unidentifiedLegacyRepeat, day: 24, matchday: 12 };
const identifiedLegacyRows = [identifiedLegacyRepeat, { ...identifiedLegacyRepeat }];
for (const engine of [career, deployedCareer]) {
  assert.equal(engine.uniqueMatchRows(unidentifiedLegacyRows).length, 2,
    "two no-ID legacy fixtures with identical stats but no date/round must not collapse into one appearance");
  assert.equal(engine.uniqueMatchRows(identifiedLegacyRows).length, 1,
    "no-ID legacy copies with matching competition context and a temporal key must still deduplicate");
  const scopeOnlyLegacyRepeat = { scope: "league", day: 24, minutes: 90, goals: 0, assists: 0 };
  assert.equal(engine.uniqueMatchRows([scopeOnlyLegacyRepeat, { ...scopeOnlyLegacyRepeat }]).length, 2,
    "a scope and date alone are not enough identity to collapse two legacy fixtures");
  const incompleteFallbackContexts = [
    { scope: "league", competition: "Premier League", opponent: "Repeat Opponent", day: 24, matchday: 12, teamGoals: 1, oppGoals: 0, minutes: 90, goals: 0, assists: 0 },
    { scope: "league", competition: "Premier League", season: 4, opponent: "Repeat Opponent", day: 24, matchday: 12, teamGoals: 1, oppGoals: 0, minutes: 90, goals: 0, assists: 0 },
    { scope: "league", competition: "Premier League", club: "Test FC", opponent: "Repeat Opponent", day: 24, matchday: 12, teamGoals: 1, oppGoals: 0, minutes: 90, goals: 0, assists: 0 }
  ];
  incompleteFallbackContexts.forEach((row, index) => {
    assert.equal(engine.uniqueMatchRows([row, { ...row }]).length, 2,
      "no-ID fixtures need competition, club, and season/segment context before deduplication (" + index + ")");
  });
  const segmentScopedLegacyRepeat = { ...identifiedLegacyRepeat, segmentId: "season-4" };
  delete segmentScopedLegacyRepeat.season;
  assert.equal(engine.uniqueMatchRows([segmentScopedLegacyRepeat, { ...segmentScopedLegacyRepeat }]).length, 1,
    "a stable segment ID may substitute for a missing season when deduplicating legacy fixtures");
  const sparseHistory = {
    apps: 2,
    seasonLog: [unidentifiedLegacyRepeat],
    careerMatchHistory: [{ ...unidentifiedLegacyRepeat }]
  };
  engine.rebuildLegacyCareerStats(sparseHistory);
  assert.equal(sparseHistory.careerMinutes, 180,
    "legacy stat rebuilding must preserve both no-ID appearances when no temporal identity exists");
  assert.equal(sparseHistory.qualifyingAppearances, 2,
    "legacy stat rebuilding must not erase a qualifying appearance from a sparse no-ID history");
}

const whitespaceCompetitionParityRows = [
  {
    id: "legacy-whitespace-competition-id", scope: "league", competition: "   ",
    leagueCompetition: "Premier League", season: 4, segmentId: "season-4",
    club: "Test FC", opponent: "Shared Opponent", day: 13, matchday: 9,
    minutes: 90, rating: 7, goals: 0, assists: 0
  },
  {
    id: "legacy-whitespace-competition-id", scope: "league", competition: "National Cup",
    leagueCompetition: "National Cup", season: 4, segmentId: "season-4",
    club: "Test FC", opponent: "Shared Opponent", day: 13, matchday: 9,
    minutes: 90, rating: 8, goals: 1, assists: 0
  }
];
assert.equal(deployedCareer.uniqueMatchRows(whitespaceCompetitionParityRows).length, 2,
  "the deployed browser engine must preserve competition identity when the primary legacy field is whitespace");
assert.equal(JSON.stringify(deployedCareer.uniqueMatchRows(whitespaceCompetitionParityRows)),
  JSON.stringify(career.uniqueMatchRows(whitespaceCompetitionParityRows)),
  "source and embedded history deduplication must stay identical for whitespace competition values");

const incompleteCompetitionReuseRows = [
  {
    id: "legacy-incomplete-competition-reused-id", scope: "league", season: 4,
    segmentId: "season-4", club: "Test FC", opponent: "Shared Opponent",
    day: 13, matchday: 9, minutes: 90, rating: 7, goals: 0, assists: 0
  },
  {
    id: "legacy-incomplete-competition-reused-id", competition: "National Cup",
    leagueCompetition: "National Cup", season: 4, segmentId: "season-4",
    club: "Test FC", opponent: "Shared Opponent", day: 13, matchday: 9,
    minutes: 90, rating: 8, goals: 1, assists: 0
  }
];
for (const engine of [career, deployedCareer]) {
  assert.equal(engine.uniqueMatchRows(incompleteCompetitionReuseRows).length, 2,
    "a row missing competition metadata must not swallow a same-ID cup fixture on the same date");
  const incompleteCompetitionHistory = {
    apps: 2,
    seasonLog: [incompleteCompetitionReuseRows[0]],
    careerMatchHistory: [incompleteCompetitionReuseRows[1]]
  };
  engine.rebuildLegacyCareerStats(incompleteCompetitionHistory);
  assert.equal(incompleteCompetitionHistory.careerMinutes, 180,
    "legacy career-stat rebuilding must preserve both same-day fixtures when one competition is missing");
  assert.equal(incompleteCompetitionHistory.qualifyingAppearances, 2,
    "both fixtures with incomplete competition identity must remain qualifying appearances");
}

const browserPoorStarterDecision = deployedCareer.evaluateSquadRole({
  role: "أساسي", apps: 20, goals: 0, assists: 0, trust: 20, pos: "وسط"
}, poorFormHistory);
assert.equal(JSON.stringify(browserPoorStarterDecision), JSON.stringify(poorStarterDecision),
  "the embedded browser career engine must apply the same evidence-based starter demotion");
const browserCameoOnlyDecision = deployedCareer.evaluateSquadRole({
  role: "أساسي", apps: 20, goals: 0, assists: 0, trust: 20, pos: "وسط"
}, shortCameoHistory);
assert.equal(JSON.stringify(browserCameoOnlyDecision), JSON.stringify(cameoOnlyDecision),
  "the embedded browser career engine must use the same minimum-minute demotion evidence");
const browserMixedMinuteDecision = deployedCareer.evaluateSquadRole({
  role: "أساسي", apps: 20, goals: 0, assists: 0, trust: 20, pos: "وسط"
}, mixedMinuteHistory);
assert.equal(JSON.stringify(browserMixedMinuteDecision), JSON.stringify(mixedMinuteDecision),
  "the embedded browser career engine must use the same minute-weighted recent rating");
const browserCameoRotationPromotion = deployedCareer.evaluateSquadRole({
  role: "بديل", apps: 16, goals: 8, assists: 8, trust: 55, pos: "وسط"
}, strongCameoHistory);
assert.equal(JSON.stringify(browserCameoRotationPromotion), JSON.stringify(cameoRotationPromotion),
  "the embedded engine must require sufficient minutes before a rotation promotion");


const browserPoorStarDecision = deployedCareer.evaluateSquadRole({
  role: "نجم الفريق", apps: 20, goals: 0, assists: 0, trust: 15, pos: "وسط"
}, poorFormHistory);
assert.equal(JSON.stringify(browserPoorStarDecision), JSON.stringify(poorStarDecision),
  "the embedded browser career engine must apply the same evidence-based star demotion");
assert.equal(deployedCareer.normalizeCareerPosition("CM"), "وسط", "the embedded career engine must normalize CM aliases");
assert.equal(deployedCareer.positionDevelopmentPlan("CM").position, "وسط", "the embedded career engine must expose the CM development plan");
assert.equal(deployedCareer.loanSquadRole({ pos: "CM", age: 22, shooting: 70, dribbling: 70, passing: 70, speed: 70, fitness: 70, composure: 70, defending: 70, goalkeeping: 90, vision: 70, physical: 70 }, { power: 60 }), "أساسي", "the embedded career engine must calculate a realistic loan role");

const browserLoanReturnFunction = deployedHtml.match(/function returnFromLoan\(\)\s*\{[\s\S]*?\n\}/);
assert.ok(browserLoanReturnFunction, "the deployed browser loan-return function must exist for runtime regression coverage");
const parseSavedBooleanForLoanReturn = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value !== 0 : fallback;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off", ""].includes(normalized)) return false;
  }
  return fallback;
};
function runBrowserLoanReturn(parentWage, parentContractSeasons, parentRole = "أساسي", fallbackContractSeasons = 3, parentFreeAgent = false, parentContractType = "professional") {
  const state = {
    clubName: "Loan Club", leagueCountry: "Spain", season: 4, day: 12,
    role: "بديل أساسي", transferCooldown: 0, transferHistory: [], contractSeasons: fallbackContractSeasons,
    loan: {
      parentClub: "Parent Club", parentCountry: "Egypt", parentDivision: 1,
      parentCompetition: "Parent League", parentSource: "test fixture",
      parentPower: 52, parentTier: 1, parentIndex: 1,
      parentWage, parentContractSeasons, parentFreeAgent, parentContractType,
      ...(parentRole ? { parentRole } : {})
    }
  };
  const sandbox = {
    state,
    withCareerStateTransaction: (_label, operation) => operation(),
    archiveCupForTransfer: () => {},
    archiveLeagueSegment: () => {},
    clubPowerFor: () => 52,
    clubTierForPower: () => 1,
    normalizeSavedBooleanFlag: parseSavedBooleanForLoanReturn,
    log: () => {}
  };
  vm.runInNewContext(`${browserLoanReturnFunction[0]}\nglobalThis.runReturnFromLoan = returnFromLoan;`, sandbox);
  return { state, result: sandbox.runReturnFromLoan() };
}
const parentLoanContractCases = [
  [Infinity, 1, 0, 1],
  [400, 0, 0, 0],
  [400, null, 400, 3],
  [400, "", 400, 3],
  [400, "   ", 400, 3],
  ["Infinity", "Infinity", 0, 0],
  [NaN, NaN, 0, 0],
  [-400, -2, 0, 0],
  [400.9, 2.9, 400, 2],
  [Number.MAX_SAFE_INTEGER + 1000, 99, Number.MAX_SAFE_INTEGER, 10]
];
for (const [savedParentWage, savedParentSeasons, expectedWage, expectedSeasons] of parentLoanContractCases) {
  const loanState = {
    ...onLoan,
    loan: {
      ...onLoan.loan,
      parentWage: savedParentWage,
      parentContractSeasons: savedParentSeasons
    }
  };
  const originalLoan = { ...loanState.loan };
  const sharedSnapshot = career.contractStateForSeasonTransition(loanState);
  const browserSnapshot = deployedCareer.contractStateForSeasonTransition({
    ...loanState,
    loan: { ...loanState.loan }
  });
  assert.equal(sharedSnapshot.weeklyWage, expectedWage,
    "parent-club wages restored after a loan must be finite, non-negative, integral, and safe");
  assert.equal(sharedSnapshot.contractSeasons, expectedSeasons,
    "parent-club contract duration restored after a loan must be finite and bounded");
  const expectedFreeAgent = expectedSeasons <= 0;
  assert.equal(sharedSnapshot.freeAgent, expectedFreeAgent,
    "an expired parent contract must restore as a free agent, not as a renewable contract");
  assert.equal(sharedSnapshot.contractType, expectedFreeAgent ? "free-agent" : "professional",
    "the restored contract type must agree with the remaining parent-contract term");
  assert.equal(browserSnapshot.weeklyWage, expectedWage,
    "embedded browser engine must sanitize parent-club wages like the shared engine");
  assert.equal(browserSnapshot.contractSeasons, expectedSeasons,
    "embedded browser engine must sanitize parent-club contract duration like the shared engine");
  assert.equal(browserSnapshot.freeAgent, expectedFreeAgent,
    "embedded browser engine must mark an expired parent contract as free agency");
  assert.equal(browserSnapshot.contractType, expectedFreeAgent ? "free-agent" : "professional",
    "embedded browser contract type must agree with the parent-contract term");
  assert.equal(JSON.stringify(browserSnapshot), JSON.stringify(sharedSnapshot),
    "embedded and shared loan-contract restoration must stay behaviorally identical");
  assert.equal(loanState.weeklyWage, 900, "restoring the parent contract must not mutate active loan wages");
  assert.equal(loanState.contractSeasons, 3, "restoring the parent contract must not mutate active loan duration");
  assert.deepEqual(loanState.loan, originalLoan, "restoring the parent contract must not mutate loan metadata");
  const browserReturn = runBrowserLoanReturn(savedParentWage, savedParentSeasons);
  assert.equal(browserReturn.result, true, "a valid legacy loan record must return to its parent club");
  assert.equal(browserReturn.state.weeklyWage, expectedWage,
    "browser loan return must restore only a finite, bounded, integral parent wage");
  assert.equal(browserReturn.state.contractSeasons, expectedSeasons,
    "browser loan return must restore only a finite, bounded parent contract duration");
  assert.equal(browserReturn.state.freeAgent, expectedFreeAgent,
    "browser loan return must mark an expired parent contract as free agency");
  assert.equal(browserReturn.state.contractType, expectedFreeAgent ? "free-agent" : "professional",
    "browser loan return must not leave an expired professional contract active");
  assert.equal(browserReturn.state.loan, null, "a successful loan return must clear the active loan");
  assert.equal(browserReturn.state.clubName, "Parent Club", "a successful loan return must restore the parent club");
  assert.equal(browserReturn.state.role, "أساسي", "a successful loan return must restore the parent club squad role");
}
const legacyLoanRoleReturn = runBrowserLoanReturn(400, 2, null);
assert.equal(legacyLoanRoleReturn.result, true, "legacy loan records without a parent role must still return safely");
assert.equal(legacyLoanRoleReturn.state.role, "بديل أساسي", "legacy loan records without a parent role must preserve the current role");
const legacyTrueBrowserReturn = runBrowserLoanReturn(400, 1, "أساسي", 3, true, "professional");
assert.equal(legacyTrueBrowserReturn.state.freeAgent, true);
assert.equal(legacyTrueBrowserReturn.state.contractType, "free-agent");
assert.equal(legacyTrueBrowserReturn.state.contractSeasons, 0);
assert.equal(legacyTrueBrowserReturn.state.weeklyWage, 0);

const archiveSeasonRecordStart = rootHtml.indexOf("function archiveSeasonRecord()");
const archiveSeasonRecordEnd = rootHtml.indexOf(String.fromCharCode(10) + "function ", archiveSeasonRecordStart + 30);
assert.ok(archiveSeasonRecordStart >= 0 && archiveSeasonRecordEnd > archiveSeasonRecordStart,
  "the deployed season-history archive function must remain extractable");
const archiveSeasonRecordSource = rootHtml.slice(archiveSeasonRecordStart, archiveSeasonRecordEnd);
const allCareerMatchRowsStart = rootHtml.indexOf("function allCareerMatchRowsForHistory()");
const allCareerMatchRowsEnd = rootHtml.indexOf(String.fromCharCode(10) + "function ", allCareerMatchRowsStart + 30);
assert.ok(allCareerMatchRowsStart >= 0 && allCareerMatchRowsEnd > allCareerMatchRowsStart,
  "the deployed career-history union helper must remain extractable");
const allCareerMatchRowsSource = rootHtml.slice(allCareerMatchRowsStart, allCareerMatchRowsEnd);
const seasonArchiveState = {
  season: 4, age: 23, seasonApps: 12, leagueApps: 10, seasonGoals: 4, seasonAssists: 3,
  seasonW: 7, seasonD: 2, seasonL: 1, seasonPoints: 23, seasonSummary: "test",
  careerAwards: [], seasonHistory: [],
  leagueArchives: [
    { archiveId: "parent-segment|loan", segmentId: "parent-segment", season: 4 },
    { archiveId: "host-segment|loan-return", segmentId: "host-segment", season: 4 },
    { archiveId: "old-segment|season-end", segmentId: "old-segment", season: 3 }
  ],
  careerMatchHistory: [
    { id: "season-explicit", season: 4, segmentId: "parent-segment", competition: "Premier League", club: "Parent FC", opponent: "A", day: 1, minutes: 90 },
    { id: "season-string", season: "2026/27", segmentId: "host-segment", competition: "Second Division", club: "Host FC", opponent: "B", day: 2, minutes: 90 },
    { id: "season-missing", segmentId: "host-segment", competition: "Second Division", club: "Host FC", opponent: "C", day: 3, minutes: 90 },
    { id: "season-string", season: "2026/27", segmentId: "host-segment", competition: "Second Division", club: "Host FC", opponent: "B", day: 2, minutes: 90 },
    { id: "prior-season", season: 3, segmentId: "old-segment", competition: "Premier League", club: "Old FC", opponent: "D", day: 4, minutes: 90 },
    { id: "unknown-season", minutes: 90 }
  ]
};
const archiveSeasonSandbox = {
  state: seasonArchiveState, window: { LWCareer: career },
  archiveLeagueSegment: () => {}, club: () => ({ name: "Host FC" }),
  structuredCloneSafe: value => JSON.parse(JSON.stringify(value))
};
vm.runInNewContext(allCareerMatchRowsSource + String.fromCharCode(10) +
  archiveSeasonRecordSource + String.fromCharCode(10) +
  "this.archiveSeasonRecord = archiveSeasonRecord;", archiveSeasonSandbox);
archiveSeasonSandbox.archiveSeasonRecord();
assert.equal(seasonArchiveState.seasonHistory[0].matchCount, 3,
  "season history must include explicit, string-season and segment-linked loan fixtures exactly once");
assert.deepEqual(seasonArchiveState.seasonHistory[0].segments,
  ["parent-segment|loan", "host-segment|loan-return"],
  "season history must list every archived club segment from the current season");

const extractArchiveBrowserFunction = name => {
  const start = rootHtml.indexOf("function " + name + "(");
  const end = rootHtml.indexOf(String.fromCharCode(10) + "function ", start + 20);
  assert.ok(start >= 0 && end > start, "the deployed " + name + " function must remain extractable");
  return rootHtml.slice(start, end);
};
const legacySeasonRow = {
  id: "legacy-season-log-1", season: 4, segmentId: "host-segment",
  club: "Host FC", country: "Egypt", competition: "Premier League",
  opponent: "League A", day: 1, minutes: 90, rating: 8, goals: 1, assists: 0
};
const legacyNoSeasonRow = {
  id: "legacy-season-log-2", segmentId: "host-segment",
  club: "Host FC", country: "Egypt", competition: "Premier League",
  opponent: "League B", day: 2, minutes: 90, rating: 7, goals: 0, assists: 0
};
const legacyArchiveState = {
  season: 4, age: 23, day: 30, clubName: "Host FC", leagueSegmentId: "host-segment",
  leagueArchiveSequence: 0, leagueCountry: "Egypt", leagueCompetition: "Premier League",
  leagueSource: "legacy fixture", leagueDivision: 1, leagueApps: 2,
  league: [{ name: "Host FC", pts: 30, gf: 20, ga: 10 }],
  fixtureSchedule: [], leagueRoundHistory: [], leagueArchives: [],
  seasonHistory: [], careerAwards: [], seasonApps: 2, seasonGoals: 1,
  seasonAssists: 0, seasonW: 1, seasonD: 0, seasonL: 1, seasonPoints: 3,
  seasonSummary: "legacy archive",
  seasonLog: [legacySeasonRow, legacyNoSeasonRow],
  careerMatchHistory: [{ ...legacySeasonRow }]
};
const legacyArchiveSandbox = {
  state: legacyArchiveState, window: { LWCareer: career },
  club: () => ({ name: "Host FC" }), clubNameForLeague: () => "Host FC",
  structuredCloneSafe: value => JSON.parse(JSON.stringify(value))
};
const archiveFunctions = [
  "ensureLeagueSegmentId", "allCareerMatchRowsForHistory",
  "archiveLeagueSegment", "archiveSeasonRecord"
].map(extractArchiveBrowserFunction).join(String.fromCharCode(10));
vm.runInNewContext(archiveFunctions + String.fromCharCode(10) +
  "this.archiveLeagueSegment = archiveLeagueSegment; this.archiveSeasonRecord = archiveSeasonRecord;",
  legacyArchiveSandbox);
const legacyLeagueArchive = legacyArchiveSandbox.archiveLeagueSegment("season-end");
assert.equal(legacyLeagueArchive.matches.length, 2,
  "league archives must include legacy seasonLog rows and deduplicate their career-history copies");
assert.equal(legacyLeagueArchive.stats.minutes, 180,
  "legacy seasonLog minutes must remain in the archived league segment");
assert.equal(legacyLeagueArchive.stats.goals, 1,
  "legacy seasonLog goals must remain in the archived league segment");
legacyArchiveSandbox.archiveSeasonRecord();
assert.equal(legacyArchiveState.seasonHistory[0].matchCount, 2,
  "season history must include legacy seasonLog-only rows and segment-linked rows exactly once");

const legacyLoanWithoutParentTerm = {
  ...onLoan,
  contractSeasons: 2,
  loan: { ...onLoan.loan }
};
delete legacyLoanWithoutParentTerm.loan.parentContractSeasons;
const sharedLegacyLoanTerm = career.contractStateForSeasonTransition(legacyLoanWithoutParentTerm);
const browserLegacyLoanTerm = deployedCareer.contractStateForSeasonTransition({
  ...legacyLoanWithoutParentTerm,
  loan: { ...legacyLoanWithoutParentTerm.loan }
});
assert.equal(sharedLegacyLoanTerm.contractSeasons, 2,
  "a legacy loan without a parent-term snapshot must preserve the unchanged top-level parent contract duration");
assert.equal(browserLegacyLoanTerm.contractSeasons, 2,
  "the embedded career engine must restore the top-level parent term when old loan metadata omitted it");
assert.equal(JSON.stringify(browserLegacyLoanTerm), JSON.stringify(sharedLegacyLoanTerm),
  "shared and embedded legacy loan-term fallback must remain identical");
const browserLegacyLoanTermReturn = runBrowserLoanReturn(400, undefined, "أساسي", 2);
assert.equal(browserLegacyLoanTermReturn.result, true, "a legacy loan without parentContractSeasons must still return");
assert.equal(browserLegacyLoanTermReturn.state.contractSeasons, 2,
  "browser loan return must retain the top-level parent contract duration when the legacy snapshot is missing");
for (const missingParentTerm of [null, "", "   "]) {
  const legacyLoanWithBlankTerm = {
    ...onLoan,
    contractSeasons: 2,
    loan: { ...onLoan.loan, parentContractSeasons: missingParentTerm }
  };
  const sharedBlankTerm = career.contractStateForSeasonTransition(legacyLoanWithBlankTerm);
  const browserBlankTerm = deployedCareer.contractStateForSeasonTransition({
    ...legacyLoanWithBlankTerm,
    loan: { ...legacyLoanWithBlankTerm.loan }
  });
  assert.equal(sharedBlankTerm.contractSeasons, 2,
    "null or blank parent-term snapshots must fall back to the unchanged top-level parent contract");
  assert.equal(browserBlankTerm.contractSeasons, 2,
    "the embedded browser engine must treat null or blank parent terms as missing legacy metadata");
  assert.equal(JSON.stringify(browserBlankTerm), JSON.stringify(sharedBlankTerm),
    "shared and embedded null/blank parent-term fallback must stay identical");

  const browserBlankTermReturn = runBrowserLoanReturn(400, missingParentTerm, "أساسي", 2);
  assert.equal(browserBlankTermReturn.result, true);
  assert.equal(browserBlankTermReturn.state.contractSeasons, 2,
    "browser loan return must preserve the parent term when the legacy snapshot is null or blank");

  const staleFlagsLoan = {
    ...legacyLoanWage,
    freeAgent: true,
    contractType: "professional",
    weeklyWage: 900,
    contractSeasons: 2,
    loan: { ...legacyLoanWage.loan, parentContractSeasons: missingParentTerm }
  };
  const browserStaleFlagsLoan = { ...staleFlagsLoan, loan: { ...staleFlagsLoan.loan } };
  career.ensureState(staleFlagsLoan);
  deployedCareer.ensureState(browserStaleFlagsLoan);
  assert.equal(staleFlagsLoan.weeklyWage, 900,
    "a null/blank parent term must not zero a live loan wage when the unchanged parent term is still active");
  assert.equal(browserStaleFlagsLoan.weeklyWage, 900,
    "embedded state normalization must preserve the live host wage for a null/blank legacy parent term");
  assert.equal(staleFlagsLoan.contractSeasons, 2);
  assert.equal(browserStaleFlagsLoan.contractSeasons, 2);
}
const eligibilityFunction = rootHtml.match(/function careerMatchPlayerEligible\(state,scope="league"\)\s*\{[\s\S]*?\n\}/);
assert.ok(eligibilityFunction, "career match eligibility must be available for parent-contract regression tests");
const eligibilityContext = {};
vm.runInNewContext(eligibilityFunction[0] + "\nglobalThis.isCareerMatchEligible = careerMatchPlayerEligible;", eligibilityContext);
for (const savedParentTerm of [null, "", "   "]) {
  const expiredLoan = {
    retired: false, freeAgent: false, contractType: "professional", contractSeasons: 0,
    loan: { parentFreeAgent: false, parentContractType: "professional", parentContractSeasons: savedParentTerm }
  };
  assert.equal(eligibilityContext.isCareerMatchEligible(expiredLoan, "league"), false,
    "blank parent-term snapshots must fall back to an expired top-level contract and block club appearances");
  const activeLoan = { ...expiredLoan, contractSeasons: 2 };
  assert.equal(eligibilityContext.isCareerMatchEligible(activeLoan, "league"), true,
    "blank parent-term snapshots must preserve a still-active top-level parent contract");
}
const staleFreeAgentLoan = {
  retired: false, freeAgent: true, contractType: "professional", contractSeasons: 2,
  loan: { parentContractType: "professional", parentContractSeasons: 2 }
};
assert.equal(eligibilityContext.isCareerMatchEligible(staleFreeAgentLoan, "league"), true,
  "a legacy top-level free-agent flag must not override an explicit professional parent contract");
for (const malformedParentTerm of ["Infinity", "not-a-number", Infinity, NaN]) {
  const malformedParentLoan = {
    ...legacyLoanWage,
    freeAgent: false, contractType: "professional", weeklyWage: 900, contractSeasons: 2,
    loan: {
      ...legacyLoanWage.loan,
      parentFreeAgent: false, parentContractType: "professional",
      parentContractSeasons: malformedParentTerm
    }
  };
  const browserMalformedParentLoan = {
    ...malformedParentLoan, loan: { ...malformedParentLoan.loan }
  };
  career.ensureState(malformedParentLoan);
  deployedCareer.ensureState(browserMalformedParentLoan);
  assert.equal(malformedParentLoan.weeklyWage, 0,
    "a malformed saved parent term must not keep a loan wage active in the shared engine");
  assert.equal(browserMalformedParentLoan.weeklyWage, 0,
    "the embedded engine must also stop payroll for a malformed parent contract term");
  const sharedMalformedSnapshot = career.contractStateForSeasonTransition(malformedParentLoan);
  const browserMalformedSnapshot = deployedCareer.contractStateForSeasonTransition(browserMalformedParentLoan);
  assert.equal(sharedMalformedSnapshot.freeAgent, true,
    "a non-finite parent contract term must restore as free agency");
  assert.equal(browserMalformedSnapshot.freeAgent, true,
    "the embedded engine must restore a non-finite parent term as free agency");
  assert.equal(JSON.stringify(browserMalformedSnapshot), JSON.stringify(sharedMalformedSnapshot),
    "shared and embedded malformed parent-term recovery must remain identical");
  assert.equal(eligibilityContext.isCareerMatchEligible(malformedParentLoan, "league"), false,
    "a malformed parent term must block club appearances before the loan is returned");
}

for (const blankParentContractType of [null, "", "   "]) {
  const blankTypeLoan = {
    ...legacyLoanWage,
    freeAgent: true, contractType: "professional", weeklyWage: 900, contractSeasons: 2,
    loan: {
      ...legacyLoanWage.loan,
      parentContractSeasons: 2,
      parentContractType: blankParentContractType
    }
  };
  delete blankTypeLoan.loan.parentFreeAgent;
  const browserBlankTypeLoan = { ...blankTypeLoan, loan: { ...blankTypeLoan.loan } };
  career.ensureState(blankTypeLoan);
  deployedCareer.ensureState(browserBlankTypeLoan);
  assert.equal(blankTypeLoan.weeklyWage, 900,
    "a blank legacy parent contract type must fall back to the saved professional contract, not a stale free-agent flag");
  assert.equal(browserBlankTypeLoan.weeklyWage, 900,
    "embedded loan normalization must fall back from a blank parent contract type");
  const sharedBlankTypeSnapshot = career.contractStateForSeasonTransition(blankTypeLoan);
  const browserBlankTypeSnapshot = deployedCareer.contractStateForSeasonTransition(browserBlankTypeLoan);
  assert.equal(sharedBlankTypeSnapshot.freeAgent, false);
  assert.equal(sharedBlankTypeSnapshot.contractType, "professional");
  assert.equal(eligibilityContext.isCareerMatchEligible(blankTypeLoan, "league"), true,
    "a blank parent contract type must not override a valid professional parent contract");
  assert.equal(JSON.stringify(browserBlankTypeSnapshot), JSON.stringify(sharedBlankTypeSnapshot),
    "shared and embedded blank parent contract type fallback must remain identical");
  const browserBlankTypeReturn = runBrowserLoanReturn(400, 2, "أساسي", 2, false, blankParentContractType);
  assert.equal(browserBlankTypeReturn.result, true);
  assert.equal(browserBlankTypeReturn.state.contractType, "professional",
    "loan return must restore a professional contract when the saved parent type is blank or whitespace");
  assert.equal(browserBlankTypeReturn.state.freeAgent, false);

}


const missingTopLevelLoanTerm = {
  pos: "مهاجم", age: 24, freeAgent: true, contractType: "professional", weeklyWage: 900,
  trainingXP: {}, randomSeed: 1,
  loan: { parentClub: "Parent Club", parentCountry: "Egypt", parentWage: 400,
    parentContractSeasons: null, parentContractType: "professional" }
};
const browserMissingTopLevelLoanTerm = {
  ...missingTopLevelLoanTerm, loan: { ...missingTopLevelLoanTerm.loan }
};
const rawMissingTopLevelSnapshot = career.contractStateForSeasonTransition({
  ...missingTopLevelLoanTerm, loan: { ...missingTopLevelLoanTerm.loan }
});
assert.equal(rawMissingTopLevelSnapshot.contractSeasons, 2,
  "a legacy professional loan with no usable term snapshot or top-level term must receive the safe active-contract default");
career.ensureState(missingTopLevelLoanTerm);
deployedCareer.ensureState(browserMissingTopLevelLoanTerm);
assert.equal(missingTopLevelLoanTerm.contractSeasons, 2,
  "loan migration must infer the default parent term from the saved professional parent contract, not a stale free-agent flag");
assert.equal(browserMissingTopLevelLoanTerm.contractSeasons, 2,
  "embedded loan migration must use the same parent-contract default");
assert.equal(missingTopLevelLoanTerm.weeklyWage, 900);
assert.equal(browserMissingTopLevelLoanTerm.weeklyWage, 900);
const browserMissingTopLevelReturn = runBrowserLoanReturn(400, null, "أساسي", null, false, "professional");
assert.equal(browserMissingTopLevelReturn.result, true);
assert.equal(browserMissingTopLevelReturn.state.contractSeasons, 2,
  "loan return must restore the safe active-contract default when both legacy term fields are missing");

const freeAgentParentWithoutTerm = {
  pos: "مهاجم", age: 24, freeAgent: false, contractType: "professional", weeklyWage: 900,
  trainingXP: {}, randomSeed: 1,
  loan: { parentClub: "Parent Club", parentCountry: "Egypt", parentWage: 400,
    parentContractSeasons: null, parentFreeAgent: true, parentContractType: "free-agent" }
};
career.ensureState(freeAgentParentWithoutTerm);
assert.equal(freeAgentParentWithoutTerm.contractSeasons, 0);
assert.equal(freeAgentParentWithoutTerm.weeklyWage, 0);
const browserFreeAgentParentReturn = runBrowserLoanReturn(0, null, "أساسي", null, true, "free-agent");
assert.equal(browserFreeAgentParentReturn.state.contractSeasons, 0);
assert.equal(browserFreeAgentParentReturn.state.freeAgent, true);

assert.ok(rootHtml.includes('const contractDisplayState=window.LWCareer?.contractStateForSeasonTransition(state)||state;'),
  "the contract panel must read the parent-club contract while a legacy save is on loan");
assert.ok(rootHtml.includes('setText("contractYears",contractDisplayState.freeAgent?0:contractDisplayState.contractSeasons);'),
  "the contract panel must not display a stale top-level free-agent flag during a loan");
assert.ok(rootHtml.includes('setText("contractPill",state.retired?"معتزل":contractDisplayState.freeAgent?'),
  "the contract pill must reflect the parent contract snapshot while on loan");

const parentFreeAgentCases = [
  [true, true], [false, false],
  ["true", true], ["TRUE", true], ["1", true], ["yes", true], ["on", true],
  ["false", false], ["FALSE", false], ["0", false], ["no", false], ["off", false],
  ["", false], ["malformed", false]
];
for (const [savedFlag, expectedFreeAgent] of parentFreeAgentCases) {
  const loanState = {
    ...onLoan,
    loan: { ...onLoan.loan, parentFreeAgent: savedFlag }
  };
  const sharedSnapshot = career.contractStateForSeasonTransition(loanState);
  const browserSnapshot = deployedCareer.contractStateForSeasonTransition({
    ...loanState,
    loan: { ...loanState.loan }
  });
  assert.equal(sharedSnapshot.freeAgent, expectedFreeAgent,
    "legacy parent free-agent flags must parse explicit string booleans instead of treating every non-empty string as true");
  assert.equal(browserSnapshot.freeAgent, expectedFreeAgent,
    "embedded browser engine must parse parent free-agent flags like the shared engine");
  assert.equal(JSON.stringify(browserSnapshot), JSON.stringify(sharedSnapshot),
    "embedded and shared parent free-agent normalization must stay identical");
}
assert.ok(deployedHtml.includes("state.weeklyWage = weeklyWageValue !== null"),
  "embedded browser career engine must normalize saved weekly wages");
assert.ok(deployedHtml.includes("const contractSeasonsMissing ="),
  "embedded browser career engine must normalize saved contract durations");
const sharedContractState = { pos: "مهاجم", age: 24, freeAgent: false,
  contractSeasons: Infinity, daysSinceNegotiation: Infinity, trainingXP: {}, randomSeed: 1 };
const browserContractState = { ...sharedContractState };
career.ensureState(sharedContractState);
deployedCareer.ensureState(browserContractState);
assert.equal(browserContractState.contractSeasons, sharedContractState.contractSeasons,
  "embedded browser contract duration normalization must match the shared engine");
assert.equal(browserContractState.daysSinceNegotiation, sharedContractState.daysSinceNegotiation,
  "embedded browser negotiation cooldown normalization must match the shared engine");
for (const [savedWage, expectedWage] of malformedWageCases) {
  const sharedWageState = { pos: "مهاجم", age: 24, weeklyWage: savedWage, trainingXP: {}, randomSeed: 1 };
  const browserWageState = { ...sharedWageState };
  career.ensureState(sharedWageState);
  deployedCareer.ensureState(browserWageState);
  assert.equal(sharedWageState.weeklyWage, expectedWage);
  assert.equal(browserWageState.weeklyWage, expectedWage,
    "embedded browser wage normalization must match the shared engine");
}
assert.ok(deployedHtml.includes("state.money = moneyValue !== null"),
  "embedded browser career engine must normalize saved money balances");
for (const [savedMoney, expectedMoney] of malformedMoneyCases) {
  const sourceMoneyState = { pos: "جناح", age: 24, money: savedMoney, trainingXP: {}, randomSeed: 1 };
  const browserMoneyState = { ...sourceMoneyState };
  career.ensureState(sourceMoneyState);
  deployedCareer.ensureState(browserMoneyState);
  assert.equal(sourceMoneyState.money, expectedMoney);
  assert.equal(browserMoneyState.money, expectedMoney,
    "embedded browser balance normalization must match the shared engine");
}


const malformedAttributeCases = [
  { pos: "جناح", key: "shooting", saved: -25, expected: 0 },
  { pos: "جناح", key: "dribbling", saved: 140, expected: 100 },
  { pos: "جناح", key: "passing", saved: "88", expected: 88 },
  { pos: "جناح", key: "speed", saved: 64.6, expected: 65 },
  { pos: "جناح", key: "fitness", saved: Infinity, expected: 50 },
  { pos: "جناح", key: "vision", saved: "Infinity", expected: 50 },
  { pos: "جناح", key: "composure", saved: NaN, expected: 50 },
  { pos: "جناح", key: "physical", saved: "", expected: 50 },
  { pos: "حارس مرمى", key: "goalkeeping", saved: 140, expected: 100 }
];
for (const { pos, key, saved, expected } of malformedAttributeCases) {
  const sourceState = { pos, [key]: saved, trainingXP: {}, randomSeed: 1 };
  const browserState = { ...sourceState };
  career.ensureState(sourceState);
  deployedCareer.ensureState(browserState);
  assert.equal(sourceState[key], expected,
    `shared engine must normalize ${key} from ${String(saved)} to ${expected}`);
  assert.equal(browserState[key], expected,
    `embedded browser engine must normalize ${key} from ${String(saved)} to ${expected}`);
  assert.equal(browserState[key], sourceState[key],
    `shared and embedded player-attribute normalization must match for ${key}`);
}
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
assert.equal(JSON.stringify(deployedCareer.uniqueMatchRows(reusedLegacyIdRows)),
  JSON.stringify(career.uniqueMatchRows(reusedLegacyIdRows)),
  "embedded and shared match-history deduplication must preserve the same cross-competition fixtures");
const browserCrossCompetitionHistory = {
  apps: 2, seasonLog: [legacyLeagueFixture], careerMatchHistory: [legacyCupFixture]
};
deployedCareer.rebuildLegacyCareerStats(browserCrossCompetitionHistory);
assert.equal(JSON.stringify(browserCrossCompetitionHistory), JSON.stringify(crossCompetitionHistory),
  "embedded legacy career-stat rebuilding must preserve cross-competition fixtures identically");

const incompleteLegacyRatings = {
  seasonLog: [
    { id: "rating-number", scope: "league", minutes: 90, rating: 8 },
    { id: "rating-string", scope: "league", minutes: 75, rating: "7.5" },
    { id: "rating-zero", scope: "league", minutes: 90, rating: 0 },
    { id: "rating-null", scope: "league", minutes: 90, rating: null },
    { id: "rating-empty", scope: "league", minutes: 90, rating: "" },
    { id: "rating-whitespace", scope: "league", minutes: 90, rating: "   " },
    { id: "rating-boolean", scope: "league", minutes: 90, rating: true },
    { id: "rating-missing", scope: "league", minutes: 90 }
  ],
  careerMatchHistory: []
};
const expectedIncompleteRatingStats = { sum: 15.5, count: 3 };
assert.deepEqual(career.deriveLeagueRatingStats(incompleteLegacyRatings), expectedIncompleteRatingStats,
  "legacy rating migration must exclude null, blank, and boolean ratings while preserving numeric zero and numeric strings");
const browserIncompleteLegacyRatings = JSON.parse(JSON.stringify(incompleteLegacyRatings));
const browserIncompleteRatingStats = deployedCareer.deriveLeagueRatingStats(browserIncompleteLegacyRatings);
assert.equal(browserIncompleteRatingStats.sum, expectedIncompleteRatingStats.sum,
  "the embedded career engine must reconstruct the same legacy rating sum");
assert.equal(browserIncompleteRatingStats.count, expectedIncompleteRatingStats.count,
  "the embedded career engine must exclude invalid legacy ratings from its count");

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

const careerEngineCases = [["shared", career], ["deployed", deployedCareer]];
for (const [engineName, engine] of careerEngineCases) {
  for (const invalidPrice of [[100], true, Symbol("price"), Object.create(null), Infinity, -1]) {
    const state = { money: 1000 };
    const result = engine.purchaseItem(state, { id: "speedBoots", price: invalidPrice });
    assert.equal(result.status, "invalid-item", engineName + " store must reject non-primitive or invalid prices");
    assert.equal(state.money, 1000, engineName + " invalid price must not debit the wallet");
    assert.equal(state.speedBoots, undefined, engineName + " invalid price must not grant an item");
  }
  for (const invalidBalance of [[1000], true, Symbol("money"), Object.create(null), Infinity, -1, "bad"]) {
    const state = { money: invalidBalance };
    const originalBalance = state.money;
    const result = engine.purchaseItem(state, { id: "speedBoots", price: 100 });
    assert.equal(result.status, "insufficient-funds", engineName + " store must reject malformed balances");
    assert.strictEqual(state.money, originalBalance, engineName + " rejected balance must remain untouched");
    assert.equal(state.speedBoots, undefined, engineName + " rejected balance must not grant an item");
  }
  const legacyNumericStrings = { money: "1000", shooting: "60", dribbling: "61" };
  const legacyPurchase = engine.purchaseItem(legacyNumericStrings, { id: "boots", price: "100" });
  assert.equal(legacyPurchase.ok, true, engineName + " store must preserve legacy numeric-string saves");
  assert.equal(legacyNumericStrings.money, 900);
  assert.equal(legacyNumericStrings.shooting, 63);
  assert.equal(legacyNumericStrings.dribbling, 64);

  const malformedBootSkills = { money: 1000, shooting: Symbol("shooting"), dribbling: [61] };
  let malformedBootPurchase;
  assert.doesNotThrow(() => {
    malformedBootPurchase = engine.purchaseItem(malformedBootSkills, { id: "boots", price: 100 });
  }, engineName + " boot purchase must tolerate malformed saved skills");
  assert.equal(malformedBootPurchase.ok, true);
  assert.equal(malformedBootSkills.money, 900);
  assert.equal(malformedBootSkills.boots, true);
  assert.equal(malformedBootSkills.shooting, 3);
  assert.equal(malformedBootSkills.dribbling, 3);

  for (const invalidAge of [[37], true, Symbol("age"), Object.create(null), Infinity, "bad"]) {
    const state = { pos: "جناح", age: invalidAge, fitness: 75, speed: 80, physical: 70 };
    assert.doesNotThrow(() => engine.applySeasonAging(state),
      engineName + " season aging must ignore malformed age values without throwing");
    assert.equal(state.fitness, 75);
    assert.equal(state.speed, 80);
    assert.equal(state.physical, 70);
  }
  const malformedAgeingSkills = {
    pos: "حارس مرمى", age: 37, professionalism: 0,
    fitness: Symbol("fitness"), physical: [72]
  };
  const originalFitness = malformedAgeingSkills.fitness;
  const originalPhysical = malformedAgeingSkills.physical;
  assert.doesNotThrow(() => engine.applySeasonAging(malformedAgeingSkills),
    engineName + " season aging must skip malformed skill fields safely");
  assert.strictEqual(malformedAgeingSkills.fitness, originalFitness);
  assert.strictEqual(malformedAgeingSkills.physical, originalPhysical);

  const legacyAgeing = { pos: "حارس مرمى", age: "38", professionalism: "90", fitness: 75, physical: 72 };
  engine.applySeasonAging(legacyAgeing);
  assert.equal(legacyAgeing.fitness, 74, engineName + " season aging must retain numeric-string compatibility");
  assert.equal(legacyAgeing.physical, 71);
}




for (const [engineName, engine] of careerEngineCases) {
  const negotiationBase = {
    retired: false, freeAgent: false, contractType: "professional", contractSeasons: 2,
    daysSinceNegotiation: 7, apps: 10, weeklyWage: 500, trust: 70, randomSeed: 1,
    season: 1, clubName: "Test FC"
  };
  assert.equal(engine.wageNegotiationStatus({ ...negotiationBase, daysSinceNegotiation: [7] }), "cooldown",
    engineName + " wage negotiation must not treat array cooldowns as seven elapsed days");
  assert.equal(engine.wageNegotiationStatus({ ...negotiationBase, contractSeasons: [2] }), "contract-expiring",
    engineName + " wage negotiation must reject coercible array contract lengths");
  assert.equal(engine.wageNegotiationStatus({ ...negotiationBase, contractSeasons: "2", daysSinceNegotiation: "7" }), "ready",
    engineName + " wage negotiation must preserve numeric-string legacy counters");
  assert.equal(engine.loanRequestStatus({ ...negotiationBase, apps: [2] }, { windowOpen: true }), "appearances-required",
    engineName + " loan eligibility must not count array values as official appearances");
  assert.equal(engine.loanRequestStatus({ ...negotiationBase, contractSeasons: [2] }, { windowOpen: true }), "free-agent",
    engineName + " loan eligibility must reject malformed contract terms");
  assert.equal(engine.loanRequestStatus({ ...negotiationBase, contractSeasons: "2", apps: "2" }, { windowOpen: true }), "ready",
    engineName + " loan eligibility must preserve numeric-string legacy counters");
  assert.equal(engine.loanSquadRole(renewalBase, { power: [80] }),
    engine.loanSquadRole(renewalBase, { power: 50 }),
    engineName + " loan squad projections must use the neutral fallback for malformed club power");

  assert.equal(engine.shouldRetire({ age: [41] }), false,
    engineName + " retirement must not coerce array ages");
  assert.equal(engine.shouldRetire({ age: Symbol("age") }), false,
    engineName + " retirement must not throw or retire a player for a malformed age");
  assert.equal(engine.shouldRetire({ age: "41" }), true,
    engineName + " retirement must preserve numeric-string legacy ages");

  const malformedOfferState = {
    ...renewalBase, weeklyWage: Symbol("wage"), trust: Symbol("trust"), season: Symbol("season")
  };
  let safeOffer;
  assert.doesNotThrow(() => {
    safeOffer = engine.makeContractOffer(malformedOfferState, { contractMultiplier: Symbol("agent") });
  }, engineName + " contract offer generation must tolerate malformed saved wage, trust, season, and agent data");
  assert.ok(Number.isFinite(safeOffer.wage));
  assert.equal(safeOffer.season, 1);

  const invalidLevelState = { ...negotiationBase, randomSeed: 123 };
  const invalidLevelBefore = { ...invalidLevelState };
  assert.equal(engine.resolveWageNegotiation(invalidLevelState, 95, [1]).status, "invalid-level",
    engineName + " wage negotiation must reject coercible array levels");
  assert.deepEqual(invalidLevelState, invalidLevelBefore,
    engineName + " rejected wage negotiation must not reset cooldown, wage, trust, or random seed");

  const malformedNegotiationState = {
    ...negotiationBase, weeklyWage: Symbol("wage"), trust: Symbol("trust"), randomSeed: Symbol("seed")
  };
  let negotiationResult;
  assert.doesNotThrow(() => {
    negotiationResult = engine.resolveWageNegotiation(malformedNegotiationState, Symbol("chance"), "1");
  }, engineName + " wage negotiation must safely handle malformed legacy values");
  assert.equal(negotiationResult.ok, true);
  assert.ok(["success", "failed"].includes(negotiationResult.status));
  assert.ok(Number.isFinite(malformedNegotiationState.weeklyWage));
  assert.ok(Number.isFinite(malformedNegotiationState.trust));
  assert.ok(Number.isFinite(malformedNegotiationState.randomSeed));
  assert.equal(malformedNegotiationState.daysSinceNegotiation, 0);

  const invalidContractState = {
    clubName: "Test FC", season: 1, contractSeasons: [1], weeklyWage: 500,
    freeAgent: false, contractType: "professional"
  };
  const invalidContractBefore = { ...invalidContractState };
  assert.equal(engine.resolveContractDecision(invalidContractState, "accept",
    { club: "Test FC", season: 1, wage: 650, seasons: 3 }).status, "invalid-contract",
    engineName + " contract renewal must reject coercible array contract lengths");
  assert.deepEqual(invalidContractState, invalidContractBefore,
    engineName + " rejected contract state must remain unchanged");

  const invalidWageState = {
    clubName: "Test FC", season: 1, contractSeasons: 1, weeklyWage: 500,
    freeAgent: false, contractType: "professional"
  };
  const invalidWageBefore = { ...invalidWageState };
  assert.equal(engine.resolveContractDecision(invalidWageState, "accept",
    { club: "Test FC", season: 1, wage: [650], seasons: 3 }).status, "invalid-offer",
    engineName + " contract renewal must reject array wages");
  assert.deepEqual(invalidWageState, invalidWageBefore,
    engineName + " invalid wage offers must not partially mutate the contract");

  const invalidTermLengthState = {
    clubName: "Test FC", season: 1, contractSeasons: 1, weeklyWage: 500,
    freeAgent: false, contractType: "professional"
  };
  const invalidTermLengthBefore = { ...invalidTermLengthState };
  assert.equal(engine.resolveContractDecision(invalidTermLengthState, "accept",
    { club: "Test FC", season: 1, wage: 650, seasons: [3] }).status, "invalid-offer",
    engineName + " contract renewal must reject array-valued term lengths");
  assert.deepEqual(invalidTermLengthState, invalidTermLengthBefore,
    engineName + " malformed term lengths must not mutate the contract");

  const invalidSeasonState = {
    clubName: "Test FC", season: 1, contractSeasons: 1, weeklyWage: 500,
    freeAgent: false, contractType: "professional"
  };
  const invalidSeasonBefore = { ...invalidSeasonState };
  assert.equal(engine.resolveContractDecision(invalidSeasonState, "accept",
    { club: "Test FC", season: [1], wage: 650, seasons: 3 }).status, "stale-offer",
    engineName + " contract renewal must reject array offer seasons");
  assert.deepEqual(invalidSeasonState, invalidSeasonBefore);

  const malformedPendingState = {
    clubName: "Test FC", season: 1, contractSeasons: 1, weeklyWage: 500,
    freeAgent: false, contractType: "professional",
    contractOffer: { club: "Test FC", season: [1], wage: 650, seasons: 3 }
  };
  assert.equal(engine.resolveContractDecision(malformedPendingState, "accept",
    { club: "Test FC", season: 1, wage: 650, seasons: 3 }).status, "stale-offer",
    engineName + " pending offer comparison must not coerce malformed saved terms");

  const numericStringRenewal = {
    clubName: "Test FC", season: "1", contractSeasons: "1", weeklyWage: "500",
    freeAgent: false, contractType: "professional"
  };
  const numericStringResult = engine.resolveContractDecision(numericStringRenewal, "accept",
    { club: "Test FC", season: "1", wage: "650", seasons: "3" });
  assert.equal(numericStringResult.status, "renewed",
    engineName + " contract renewal must preserve numeric-string legacy offer fields");
  assert.equal(numericStringRenewal.weeklyWage, 650);
  assert.equal(numericStringRenewal.contractSeasons, 4);
}

// Loan return must validate the saved parent-contract snapshot, not coerce arrays or throw on Symbols.
for (const [engineName, engine] of careerEngineCases) {
  const loanBase = {
    clubName: "Host Club", leagueCountry: "Hostland", weeklyWage: 900,
    contractSeasons: 3, contractType: "professional", freeAgent: false,
    loan: {
      parentClub: "Parent Club", parentCountry: "Egypt", parentWage: 400,
      parentContractSeasons: 1, parentFreeAgent: false, parentContractType: "professional"
    }
  };
  const malformedParentWage = {
    ...loanBase, loan: { ...loanBase.loan, parentWage: [400] }
  };
  let wageRestored;
  assert.doesNotThrow(() => {
    wageRestored = engine.contractStateForSeasonTransition(malformedParentWage);
  }, engineName + " loan return must not coerce an array-valued parent wage");
  assert.equal(wageRestored.clubName, "Parent Club");
  assert.equal(wageRestored.weeklyWage, 0,
    engineName + " an invalid parent wage must not restore the temporary host wage");
  assert.equal(wageRestored.contractSeasons, 1,
    engineName + " an invalid wage must not erase an otherwise valid parent contract");
  assert.equal(wageRestored.freeAgent, false);
  assert.deepEqual(malformedParentWage.loan.parentWage, [400],
    engineName + " loan return must leave the saved parent snapshot untouched");

  for (const invalidParentTerm of [[1], true, Symbol("parent term"), Object.create(null), Infinity, "bad"]) {
    const malformedParentTerm = {
      ...loanBase, loan: { ...loanBase.loan, parentContractSeasons: invalidParentTerm }
    };
    let termRestored;
    assert.doesNotThrow(() => {
      termRestored = engine.contractStateForSeasonTransition(malformedParentTerm);
    }, engineName + " loan return must safely reject malformed parent contract terms");
    assert.equal(termRestored.clubName, "Parent Club");
    assert.equal(termRestored.contractSeasons, 0,
      engineName + " an invalid parent term must not borrow the host club's contract duration");
    assert.equal(termRestored.weeklyWage, 0,
      engineName + " an invalid parent term must not restore a professional wage");
    assert.equal(termRestored.freeAgent, true);
    assert.strictEqual(malformedParentTerm.loan.parentContractSeasons, invalidParentTerm,
      engineName + " rejected parent contract snapshots must remain unchanged");
  }

  const legacyParentFallback = {
    ...loanBase, contractSeasons: "2",
    loan: { ...loanBase.loan, parentWage: "400", parentContractSeasons: undefined }
  };
  const fallbackRestored = engine.contractStateForSeasonTransition(legacyParentFallback);
  assert.equal(fallbackRestored.weeklyWage, 400,
    engineName + " legacy numeric-string parent wages must remain supported");
  assert.equal(fallbackRestored.contractSeasons, 2,
    engineName + " a genuinely missing parent-term snapshot must retain the legacy state fallback");

  const malformedFallback = {
    ...loanBase, contractSeasons: Symbol("host term"),
    loan: { ...loanBase.loan, parentContractSeasons: undefined }
  };
  let safeFallback;
  assert.doesNotThrow(() => {
    safeFallback = engine.contractStateForSeasonTransition(malformedFallback);
  }, engineName + " loan return must not throw when a legacy fallback term is malformed");
  assert.equal(safeFallback.freeAgent, true);
  assert.equal(safeFallback.contractSeasons, 0);

  const malformedType = {
    ...loanBase,
    loan: { ...loanBase.loan, parentContractType: Symbol("parent contract type") }
  };
  assert.equal(engine.contractStateForSeasonTransition(malformedType).contractType, "professional",
    engineName + " a malformed parent contract type must fall back to the valid saved contract type");

  // JSON can preserve own toString/valueOf properties that make String(object) throw.
  const hostileParentContractType = JSON.parse('{"toString":1,"valueOf":1}');
  const hostileParentContract = {
    ...loanBase,
    pos: "مهاجم",
    age: 24,
    loan: { ...loanBase.loan, parentContractType: hostileParentContractType }
  };
  assert.doesNotThrow(() => engine.ensureState(hostileParentContract),
    engineName + " ensureState must not invoke object coercion on malformed loan contract metadata");
  assert.equal(engine.contractStateForSeasonTransition(hostileParentContract).contractType, "professional",
    engineName + " a non-string parent type must fall back to the valid saved contract type");
  assert.equal(hostileParentContract.loan.parentContractType.toString, 1,
    engineName + " normalization must leave the malformed source snapshot untouched");
}

// Career role selection must react to sustained output without bypassing academy graduation.
const roleHistory = Array.from({ length: 8 }, (_, index) => ({
  id: "role-history-" + index, scope: "league", minutes: 39, rating: 6.35,
  goals: index % 3 === 0 ? 1 : 0, assists: index % 5 === 0 ? 1 : 0
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



// Legacy saved match rows can store playerAvailable as a string. A string "false"
// must not let an unavailable player's stats manufacture individual season awards.
assert.ok(rootHtml.includes("normalizeLegacyBoolean(row.playerAvailable, true)"),
  "inline browser awards must normalize legacy player-availability flags");
function makeAvailabilityAwardState(playerAvailable) {
  return {
    age: 24, pos: "مهاجم", clubName: "Test FC", leagueCountry: "England",
    leagueCompetition: "Test League", season: 1, calendarDay: 120, money: 500,
    topScorerAwards: 0, careerAwards: [],
    seasonLog: [
      { matchId: "availability-1", leagueCountry: "England", leagueCompetition: "Test League", minutes: 90, rating: 8, goals: 1, assists: 0, playerAvailable: true },
      { matchId: "availability-2", leagueCountry: "England", leagueCompetition: "Test League", minutes: 90, rating: 8, goals: 1, assists: 0, playerAvailable: true },
      { matchId: "availability-legacy", leagueCountry: "England", leagueCompetition: "Test League", minutes: 90, rating: 10, goals: 20, assists: 10, playerAvailable }
    ]
  };
}
const unavailableAwardState = makeAvailabilityAwardState("false");
const browserUnavailableAwardState = makeAvailabilityAwardState("false");
const unavailableAwards = career.seasonAwards(unavailableAwardState, [{ name: "Test FC", power: 50 }], 1);
const browserUnavailableAwards = deployedCareer.seasonAwards(browserUnavailableAwardState, [{ name: "Test FC", power: 50 }], 1);
assert.equal(JSON.stringify(unavailableAwards), "[]",
  "a legacy string-false unavailable match must not count toward award eligibility");
assert.equal(JSON.stringify(browserUnavailableAwards), "[]",
  "the deployed browser engine must exclude legacy string-false unavailable matches");
assert.equal(unavailableAwardState.money, 500,
  "an unavailable legacy match must not trigger award payouts");
assert.equal(browserUnavailableAwardState.money, 500,
  "browser award processing must not pay out for unavailable legacy matches");
assert.equal(unavailableAwardState.topScorerAwards, 0,
  "unavailable legacy goals must not increment the golden-boot counter");
assert.equal(browserUnavailableAwardState.topScorerAwards, 0,
  "the browser must not increment golden-boot count for unavailable legacy goals");

const stringTrueAwardState = makeAvailabilityAwardState("true");
const booleanTrueAwardState = makeAvailabilityAwardState(true);
career.seasonAwards(stringTrueAwardState, [{ name: "Test FC", power: 50 }], 1);
career.seasonAwards(booleanTrueAwardState, [{ name: "Test FC", power: 50 }], 1);
assert.equal(JSON.stringify(stringTrueAwardState.careerAwards), JSON.stringify(booleanTrueAwardState.careerAwards),
  "legacy string-true availability must remain equivalent to boolean true");
assert.equal(stringTrueAwardState.money, booleanTrueAwardState.money,
  "legacy string-true availability must preserve valid award rewards");

// Current-season awards must merge current career history with legacy seasonLog,
// deduplicate the overlap, and exclude older seasons and non-league competitions.
function makeUnifiedAwardHistoryState() {
  const common = {
    leagueCountry: "England", leagueCompetition: "Test League", competition: "Test League",
    club: "Test FC", minutes: 90, rating: 8, goals: 1, assists: 0, playerAvailable: true
  };
  return {
    age: 24, pos: "مهاجم", clubName: "Test FC", leagueCountry: "England",
    leagueCompetition: "Test League", leagueDivision: 1, season: 4, calendarDay: 120,
    money: 0, topScorerAwards: 0, careerAwards: [],
    seasonLog: [
      { ...common, matchId: "unified-award-1", opponent: "Opponent 1", day: 1 }
    ],
    careerMatchHistory: [
      { ...common, matchId: "unified-award-1", season: 4, scope: "league", opponent: "Opponent 1", day: 1 },
      { ...common, matchId: "unified-award-2", season: 4, scope: "league", opponent: "Opponent 2", day: 2 },
      { ...common, matchId: "unified-award-3", season: 4, scope: "league", opponent: "Opponent 3", day: 3, assists: 1 },
      { ...common, matchId: "unified-award-old", season: 3, scope: "league", opponent: "Old Opponent", day: 4, goals: 99, assists: 99, rating: 10 },
      { ...common, matchId: "unified-award-cup", season: 4, scope: "cup", competition: "Test Cup", leagueCompetition: "Test Cup", opponent: "Cup Opponent", day: 5, goals: 99, assists: 99, rating: 10 },
      { ...common, matchId: "unified-award-international", season: 4, scope: "international", competition: "International", leagueCompetition: "International", club: "Egypt", opponent: "Other Country", day: 6, goals: 99, assists: 99, rating: 10 },
      { ...common, matchId: "unified-award-unknown-season", scope: "league", opponent: "Unknown Season", day: 7, goals: 99, assists: 99, rating: 10 },
      { ...common, matchId: "unified-award-other-country", season: 4, scope: "league", leagueCountry: "Spain", opponent: "Spain Opponent", day: 8, goals: 99, assists: 99, rating: 10 },
      { ...common, matchId: "unified-award-other-competition", season: 4, scope: "league", leagueCompetition: "Other League", competition: "Other League", opponent: "Other Competition", day: 9, goals: 99, assists: 99, rating: 10 }
    ]
  };
}
const sourceUnifiedAwardState = makeUnifiedAwardHistoryState();
const browserUnifiedAwardState = makeUnifiedAwardHistoryState();
career.seasonAwards(sourceUnifiedAwardState, [{ name: "Test FC", power: 50 }], 1);
deployedCareer.seasonAwards(browserUnifiedAwardState, [{ name: "Test FC", power: 50 }], 1);
const sourceUnifiedBoot = sourceUnifiedAwardState.careerAwards.find(award => award.id === "golden-boot");
const browserUnifiedBoot = browserUnifiedAwardState.careerAwards.find(award => award.id === "golden-boot");
assert.ok(sourceUnifiedBoot, "three current-season league goals from careerMatchHistory must qualify for the simulated golden boot");
assert.ok(browserUnifiedBoot, "the deployed browser engine must include current-season career history in awards");
assert.equal(sourceUnifiedBoot.note, "3 هدف في 3 مشاركة",
  "award totals must deduplicate seasonLog overlap and exclude older/cup/international/unknown-season rows");
assert.equal(browserUnifiedBoot.note, sourceUnifiedBoot.note,
  "deployed and shared award calculations must use identical current-season rows");
assert.equal(sourceUnifiedAwardState.money, 1100,
  "only the current-season league player and golden-boot awards may pay out");
assert.equal(browserUnifiedAwardState.money, sourceUnifiedAwardState.money,
  "deployed and shared award payouts must remain identical");

// Corrupt saved match values must never crash season-award calculation.
function makeSymbolAwardStatsState() {
  return {
    age: 24, pos: "مهاجم", clubName: "Test FC", leagueCountry: "England",
    leagueCompetition: "Test League", season: 1, calendarDay: 120, money: 500,
    topScorerAwards: 0, careerAwards: [],
    seasonLog: [
      { matchId: "symbol-award-minute", leagueCountry: "England", leagueCompetition: "Test League",
        minutes: Symbol("minutes"), rating: 10, goals: 20, assists: 20 },
      { scope: "league", competition: "Test League", season: 1, club: "Test FC",
        opponent: "Legacy Symbol Row", day: 99, leagueCountry: "England", leagueCompetition: "Test League",
        minutes: Symbol("legacy-minutes"), rating: 8, goals: 30, assists: 30 },
      { matchId: "symbol-award-stats", leagueCountry: "England", leagueCompetition: "Test League",
        minutes: 90, rating: Symbol("rating"), goals: Symbol("goals"), assists: Symbol("assists") },
      { matchId: "symbol-award-valid-1", leagueCountry: "England", leagueCompetition: "Test League",
        minutes: 90, rating: 8, goals: 1, assists: 1 },
      { matchId: "symbol-award-valid-2", leagueCountry: "England", leagueCompetition: "Test League",
        minutes: 90, rating: 8, goals: 1, assists: 1 },
      { matchId: "symbol-award-valid-3", leagueCountry: "England", leagueCompetition: "Test League",
        minutes: 90, rating: 8, goals: 1, assists: 1 }
    ]
  };
}
for (const [engineName, engine] of [["shared", career], ["deployed", deployedCareer]]) {
  const symbolStatsState = makeSymbolAwardStatsState();
  assert.doesNotThrow(() => engine.seasonAwards(symbolStatsState, [], 1),
    engineName + " award processing must ignore Symbol minutes, goals, assists and ratings");
  const symbolStatsBoot = symbolStatsState.careerAwards.find(award => award.id === "golden-boot");
  assert.ok(symbolStatsBoot, engineName + " valid match rows must still qualify after malformed rows are sanitized");
  assert.equal(symbolStatsBoot.note, "3 هدف في 4 مشاركة",
    engineName + " must exclude malformed minutes and count Symbol performance fields as zero");
  assert.equal(symbolStatsState.topScorerAwards, 1);
}

const previousWorldDatabase = global.LWWorldDB;
const previousTransferAwards = global.LWTransferAwards;
const previousDeployedWorldDatabase = deployedContext.window.LWWorldDB;
const previousDeployedTransferAwards = deployedContext.window.LWTransferAwards;
let resolvedAwardDivision = null;
let resolvedAwardLeagueStrength = null;
global.LWWorldDB = {
  leagueFor(country, division) {
    resolvedAwardDivision = division;
    return { strength: Symbol("league-strength") };
  },
  clubs() {
    return [{
      id: "symbol-division-club", name: "Symbol Division Club", country: "England",
      division: Symbol("club-division"), leagueId: "symbol-league",
      players: [{ id: "symbol-roster-player", name: "Roster Test", position: "ST" }]
    }];
  },
  leagueById() { return { confederation: "UEFA" }; }
};
global.LWTransferAwards = {
  simulatePlayerSeason(player) {
    resolvedAwardLeagueStrength = player.leagueStrength;
    return null;
  }
};
deployedContext.window.LWWorldDB = global.LWWorldDB;
deployedContext.window.LWTransferAwards = global.LWTransferAwards;
try {
  for (const [engineName, engine] of [["shared", career], ["deployed", deployedCareer]]) {
    const malformedState = {
      age: Symbol("age"), pos: "مهاجم", clubName: "Test FC", leagueCountry: "England",
      leagueCompetition: "Test League", season: Symbol("season"), calendarDay: Symbol("calendar-day"),
      leagueDivision: Symbol("league-division"), money: Symbol("money"),
      topScorerAwards: Symbol("top-scorer-awards"), careerAwards: [],
      seasonLog: [
        { matchId: "malformed-state-1", leagueCountry: "England", leagueCompetition: "Test League", minutes: 90, rating: 8, goals: 1, assists: 1 },
        { matchId: "malformed-state-2", leagueCountry: "England", leagueCompetition: "Test League", minutes: 90, rating: 8, goals: 1, assists: 1 },
        { matchId: "malformed-state-3", leagueCountry: "England", leagueCompetition: "Test League", minutes: 90, rating: 8, goals: 1, assists: 1 }
      ]
    };
    assert.doesNotThrow(() => engine.seasonAwards(malformedState, [], Symbol("team-rank")),
      engineName + " awards must tolerate malformed saved season, division, date, age, balance and counters");
    assert.equal(resolvedAwardDivision, 1, engineName + " must use a safe default league division");
    assert.equal(resolvedAwardLeagueStrength, 60, engineName + " must use safe league strength for sourced clubs");
    assert.equal(malformedState.topScorerAwards, 1, engineName + " must recover a malformed scorer-award counter");
    assert.equal(malformedState.money, 2000, engineName + " must preserve valid award rewards after save recovery");
    assert.equal(malformedState.careerAwards.length, 4, engineName + " must still calculate all eligible season awards");
    assert.ok(malformedState.careerAwards.every(award => award.season === 1
      && award.date === "2024-08-01T00:00:00.000Z"),
      engineName + " must use safe season and calendar defaults in award records");
  }
  for (const [engineName, engine] of [["shared", career], ["deployed", deployedCareer]]) {
    const noAppearanceState = {
      age: 24, pos: "مهاجم", season: 1, money: 0, topScorerAwards: 0,
      careerAwards: [], seasonLog: []
    };
    assert.doesNotThrow(() => engine.seasonAwards(noAppearanceState,
      [{ name: "Opponent", power: Symbol("club-power") }], 1),
      engineName + " must ignore malformed opponent club strength");
  }
} finally {
  if (previousWorldDatabase === undefined) delete global.LWWorldDB;
  else global.LWWorldDB = previousWorldDatabase;
  if (previousTransferAwards === undefined) delete global.LWTransferAwards;
  else global.LWTransferAwards = previousTransferAwards;
  if (previousDeployedWorldDatabase === undefined) delete deployedContext.window.LWWorldDB;
  else deployedContext.window.LWWorldDB = previousDeployedWorldDatabase;
  if (previousDeployedTransferAwards === undefined) delete deployedContext.window.LWTransferAwards;
  else deployedContext.window.LWTransferAwards = previousDeployedTransferAwards;
}

// Contract dialogs can become stale if retirement happens after they were opened.
// Neither accepting nor declining may mutate a retired career.
assert.ok(rootHtml.includes('const decision=window.LWCareer?.resolveContractDecision(state,"decline",o);if(!decision?.ok)return;state.transferHistory.unshift'),
  "the browser decline handler must stop when contract resolution is rejected");
for (const decisionName of ["accept", "decline"]) {
  const retiredContractState = {
    retired: true, freeAgent: false, weeklyWage: 900, contractSeasons: 2,
    contractOffer: { wage: 1200, seasons: 3, season: 4 }, transferHistory: [{ text: "prior" }]
  };
  const browserRetiredContractState = JSON.parse(JSON.stringify(retiredContractState));
  const before = JSON.stringify(retiredContractState);
  const sharedDecision = career.resolveContractDecision(retiredContractState, decisionName,
    { wage: 1200, seasons: 3 });
  const browserDecision = deployedCareer.resolveContractDecision(browserRetiredContractState, decisionName,
    { wage: 1200, seasons: 3 });
  assert.equal(sharedDecision.ok, false, "retired careers must reject " + decisionName + " decisions");
  assert.equal(sharedDecision.status, "retired", "retired contract actions must report a terminal career");
  assert.equal(JSON.stringify(retiredContractState), before,
    "a rejected " + decisionName + " action must not mutate the retired career");
  assert.equal(JSON.stringify(browserDecision), JSON.stringify(sharedDecision),
    "browser and shared contract guards must return the same result");
  assert.equal(JSON.stringify(browserRetiredContractState), before,
    "the browser engine must preserve retired contract state after " + decisionName);
}
const legacyRetiredContractState = {
  retired: "true", freeAgent: false, weeklyWage: 900, contractSeasons: 2
};
assert.equal(career.resolveContractDecision(legacyRetiredContractState, "accept",
  { wage: 1200, seasons: 3 }).status, "retired",
  "legacy string-true retirement flags must also block contract renewal");
assert.equal(legacyRetiredContractState.weeklyWage, 900,
  "legacy retired saves must keep their existing wage when renewal is rejected");

// Contract decisions must be bound to the active expiring contract and its current offer.
const contractDecisionCases = [
  {
    name: "decline without an offer",
    expected: "invalid-offer",
    state: { freeAgent: false, retired: false, contractSeasons: 1, weeklyWage: 500, clubName: "Test FC", season: 5 },
    decision: "decline",
    offer: null
  },
  {
    name: "early renewal",
    expected: "not-expiring",
    state: { freeAgent: false, retired: false, contractSeasons: 2, weeklyWage: 500, clubName: "Test FC", season: 5,
      contractOffer: { club: "Test FC", season: 5, wage: 650, seasons: 3 } },
    decision: "accept",
    offer: { club: "Test FC", season: 5, wage: 650, seasons: 3 }
  },
  {
    name: "offer from a previous club",
    expected: "club-mismatch",
    state: { freeAgent: false, retired: false, contractSeasons: 1, weeklyWage: 500, clubName: "Current FC", season: 5,
      contractOffer: { club: "Previous FC", season: 5, wage: 650, seasons: 3 } },
    decision: "accept",
    offer: { club: "Previous FC", season: 5, wage: 650, seasons: 3 }
  },
  {
    name: "offer from a previous season",
    expected: "stale-offer",
    state: { freeAgent: false, retired: false, contractSeasons: 1, weeklyWage: 500, clubName: "Test FC", season: 5,
      contractOffer: { club: "Test FC", season: 4, wage: 650, seasons: 3 } },
    decision: "accept",
    offer: { club: "Test FC", season: 4, wage: 650, seasons: 3 }
  },
  {
    name: "superseded offer",
    expected: "stale-offer",
    state: { freeAgent: false, retired: false, contractSeasons: 1, weeklyWage: 500, clubName: "Test FC", season: 5,
      contractOffer: { club: "Test FC", season: 5, wage: 700, seasons: 3 } },
    decision: "accept",
    offer: { club: "Test FC", season: 5, wage: 650, seasons: 3 }
  },
  {
    name: "partial offer missing pending season",
    expected: "stale-offer",
    state: { freeAgent: false, retired: false, contractSeasons: 1, weeklyWage: 500, clubName: "Test FC", season: 5,
      contractOffer: { club: "Test FC", season: 5, wage: 650, seasons: 3 } },
    decision: "accept",
    offer: { club: "Test FC", wage: 650, seasons: 3 }
  },
  {
    name: "partial offer missing pending duration",
    expected: "stale-offer",
    state: { freeAgent: false, retired: false, contractSeasons: 1, weeklyWage: 500, clubName: "Test FC", season: 5,
      contractOffer: { club: "Test FC", season: 5, wage: 650, seasons: 5 } },
    decision: "accept",
    offer: { club: "Test FC", season: 5, wage: 650 }
  },
  {
    name: "partial offer missing pending wage",
    expected: "stale-offer",
    state: { freeAgent: false, retired: false, contractSeasons: 1, weeklyWage: 500, clubName: "Test FC", season: 5,
      contractOffer: { club: "Test FC", season: 5, wage: 650, seasons: 3 } },
    decision: "accept",
    offer: { club: "Test FC", season: 5, seasons: 3 }
  },
  {
    name: "partial offer missing pending club",
    expected: "stale-offer",
    state: { freeAgent: false, retired: false, contractSeasons: 1, weeklyWage: 500, clubName: "Test FC", season: 5,
      contractOffer: { club: "Test FC", season: 5, wage: 650, seasons: 3 } },
    decision: "accept",
    offer: { season: 5, wage: 650, seasons: 3 }
  },
  {
    name: "missing accepted wage",
    expected: "invalid-offer",
    state: { freeAgent: false, retired: false, contractSeasons: 1, weeklyWage: 500, clubName: "Test FC", season: 5 },
    decision: "accept",
    offer: { club: "Test FC", season: 5, wage: null, seasons: 3 }
  }
];
for (const engine of [career, deployedCareer]) {
  for (const testCase of contractDecisionCases) {
    const state = JSON.parse(JSON.stringify(testCase.state));
    const offer = testCase.offer === null ? null : JSON.parse(JSON.stringify(testCase.offer));
    const before = JSON.stringify(state);
    const result = engine.resolveContractDecision(state, testCase.decision, offer);
    assert.equal(result.status, testCase.expected, testCase.name + " must be rejected by both engines");
    assert.equal(result.ok, false, testCase.name + " must not be accepted");
    assert.equal(JSON.stringify(state), before, testCase.name + " must not mutate the saved contract");
  }
}
for (const engine of [career, deployedCareer]) {
  const savedOffer = { club: "Test FC", season: 5, wage: 650, seasons: 3 };
  const clonedOfferState = {
    freeAgent: false, retired: false, contractSeasons: 1, weeklyWage: 500,
    clubName: "Test FC", season: 5, contractOffer: savedOffer
  };
  const clonedOfferResult = engine.resolveContractDecision(clonedOfferState, "accept", { ...savedOffer });
  assert.equal(clonedOfferResult.status, "renewed",
    "a complete cloned copy of the current saved contract offer must remain acceptable");
  assert.equal(clonedOfferState.weeklyWage, 650);
  assert.equal(clonedOfferState.contractSeasons, 4);
}
for (const engine of [career, deployedCareer]) {
  const zeroTermRenewal = { weeklyWage: 500, contractSeasons: 0, freeAgent: false, clubName: "Test FC" };
  const zeroTermDecision = engine.resolveContractDecision(zeroTermRenewal, "accept",
    { club: "Test FC", wage: 650, seasons: 3 });
  assert.equal(zeroTermDecision.status, "renewed",
    "an active contract at zero remaining seasons must still be renewable before free-agent status is committed");
  assert.equal(zeroTermRenewal.contractSeasons, 4);
  const validDecline = { weeklyWage: 500, contractSeasons: 1, freeAgent: false, clubName: "Test FC" };
  const declineDecision = engine.resolveContractDecision(validDecline, "decline",
    { club: "Test FC", wage: 650, seasons: 3 });
  assert.equal(declineDecision.status, "free-agent", "a valid current offer must still be rejectable");
  assert.equal(validDecline.freeAgent, true);
  assert.equal(validDecline.contractType, "free-agent", "declining a renewal must set the canonical free-agent contract type");
}



// A loan requires a finite, positive active contract. NaN/Infinity used to pass
// the <= 0 check because comparisons against NaN and positive Infinity are false.
assert.ok(rootHtml.includes("contractSeasons === null || contractSeasons <= 0"),
  "inline loan eligibility must reject invalid contract durations");
assert.ok(rootHtml.includes("appearances === null || appearances < 2"),
  "inline loan eligibility must reject non-finite appearance totals");
for (const invalidLoanTerm of [undefined, NaN, Infinity, "Infinity"]) {
  const sharedLoanState = { retired: false, freeAgent: false, apps: 12 };
  if (invalidLoanTerm !== undefined) sharedLoanState.contractSeasons = invalidLoanTerm;
  const browserLoanState = { ...sharedLoanState };
  const sharedStatus = career.loanRequestStatus(sharedLoanState, { windowOpen: true });
  const browserStatus = deployedCareer.loanRequestStatus(browserLoanState, { windowOpen: true });
  assert.equal(sharedStatus, "free-agent",
    "an absent or non-finite contract duration must not authorize a loan request");
  assert.equal(browserStatus, sharedStatus,
    "browser and shared loan eligibility must reject the same invalid contract duration");
}
const validLoanContract = { retired: false, freeAgent: false, contractSeasons: 2, apps: 12 };
assert.equal(career.loanRequestStatus(validLoanContract, { windowOpen: true }), "ready",
  "a player with a valid active contract must retain normal loan eligibility");
assert.equal(deployedCareer.loanRequestStatus({ ...validLoanContract }, { windowOpen: true }), "ready",
  "the deployed browser engine must preserve valid loan eligibility");
const loanEligibilityTarget = { club: "Loan Target FC", country: "Egypt" };
const transferBlockedLoanCases = [
  ["pending permanent transfer", { pendingTransfer: { club: "Next FC", country: "Spain" } }, "transfer-pending"],
  ["open transfer negotiation", { transferNegotiation: { offerId: "offer-1" } }, "transfer-negotiation"]
];
for (const [label, overrides, expected] of transferBlockedLoanCases) {
  const sharedLoanState = { ...validLoanContract, ...overrides };
  const browserLoanState = { ...validLoanContract, ...overrides };
  assert.equal(career.loanRequestStatus(sharedLoanState, { windowOpen: true }), expected,
    label + " must block a new loan request");
  assert.equal(deployedCareer.loanRequestStatus(browserLoanState, { windowOpen: true }), expected,
    "the deployed browser engine must apply the same " + label + " guard");
  assert.equal(career.loanTargetStatus(sharedLoanState, loanEligibilityTarget,
    { windowOpen: true, isListed: true }), expected,
    label + " must block the final loan-target confirmation");
  assert.equal(deployedCareer.loanTargetStatus({ ...validLoanContract, ...overrides }, loanEligibilityTarget,
    { windowOpen: true, isListed: true }), expected,
    "the deployed browser engine must reject " + label + " at final loan confirmation");
}
const pendingOfferWithoutNegotiation = {
  ...validLoanContract,
  transferOffers: [{ id: "offer-2", status: "pending" }]
};
assert.equal(career.loanRequestStatus(pendingOfferWithoutNegotiation, { windowOpen: true }), "ready",
  "an unaccepted transfer offer alone must not block a player from requesting a loan");
assert.equal(deployedCareer.loanRequestStatus({ ...pendingOfferWithoutNegotiation }, { windowOpen: true }), "ready",
  "the browser engine must preserve loan eligibility when no permanent transfer is agreed or negotiated");
assert.ok(rootHtml.includes('"transfer-pending":"عندك انتقال متفق عليه ولسه ما اكتملش؛ احسمه الأول قبل الإعارة."')
  && rootHtml.includes('"transfer-negotiation":"عندك مفاوضات انتقال مفتوحة؛ أنهِها أو ارفض العرض قبل طلب الإعارة."'),
  "loan request and confirmation UI must explain why an active permanent transfer blocks the loan");

const invalidLoanAppearances = [undefined, NaN, Infinity, -Infinity, "Infinity", "-Infinity", "not-a-number", null, ""];
for (const invalidApps of invalidLoanAppearances) {
  const sharedLoanState = { retired: false, freeAgent: false, contractSeasons: 2 };
  if (invalidApps !== undefined) sharedLoanState.apps = invalidApps;
  const browserLoanState = { ...sharedLoanState };
  const sharedStatus = career.loanRequestStatus(sharedLoanState, { windowOpen: true });
  const browserStatus = deployedCareer.loanRequestStatus(browserLoanState, { windowOpen: true });
  assert.equal(sharedStatus, "appearances-required",
    "missing, malformed, or non-finite appearances must not authorize a loan request");
  assert.equal(browserStatus, sharedStatus,
    "browser and shared loan eligibility must reject the same invalid appearance totals");
}
const legacyNumericLoanApps = { retired: false, freeAgent: false, contractSeasons: 2, apps: "2" };
assert.equal(career.loanRequestStatus(legacyNumericLoanApps, { windowOpen: true }), "ready",
  "valid numeric-string appearance totals from older saves must remain supported");
assert.equal(deployedCareer.loanRequestStatus({ ...legacyNumericLoanApps }, { windowOpen: true }), "ready",
  "the browser engine must preserve valid legacy numeric-string loan eligibility");


// Energy and morale must be normalized before the training engine reads or mutates them.
function makeTrainingConditionState(overrides = {}) {
  return { ...makeProgressionFixture(false), energy:80, morale:65, fatigue:0, injuryDays:0,
    playedToday:false, trainedToday:false, trainingIntensity:"normal", ...overrides };
}
for (const [engineName, engine] of [["shared", career], ["deployed", deployedCareer]]) {
  const missing = makeTrainingConditionState();
  delete missing.energy; delete missing.morale;
  const result = engine.train(missing, "passing", {random:()=>0.99});
  assert.equal(result.ok,true,engineName+" must support legacy saves missing condition fields");
  assert.equal(result.cost,14);
  assert.equal(missing.energy,66,engineName+" must default missing energy to 80 before the normal cost");
  assert.equal(missing.morale,67,engineName+" must default missing morale to 65 before training reward");

  const malformed = makeTrainingConditionState({energy:Symbol("energy"),morale:Symbol("morale")});
  let malformedResult;
  assert.doesNotThrow(()=>{malformedResult=engine.train(malformed,"passing");},
    engineName+" must not throw on Symbol condition fields");
  assert.equal(malformed.energy,0);
  assert.equal(malformed.morale,65);
  assert.equal(malformedResult.ok,false,engineName+" must not grant free training when explicit energy is corrupt");
  assert.equal(malformed.trainingSessions,0);
  assert.equal(malformed.trainedToday,false);

  const numericStrings = makeTrainingConditionState({energy:"80",morale:"65"});
  const stringResult=engine.train(numericStrings,"passing",{random:()=>0.99});
  assert.equal(stringResult.ok,true);
  assert.equal(numericStrings.energy,66);
  assert.equal(numericStrings.morale,67);

  const bounded=makeTrainingConditionState({energy:150,morale:-10});
  engine.ensureState(bounded);
  assert.equal(bounded.energy,100);
  assert.equal(bounded.morale,0);

  for(const invalid of [NaN,Infinity,-Infinity,Symbol("energy"),true,{},[80],"bad",""]){
    const s=makeTrainingConditionState({energy:invalid});
    assert.doesNotThrow(()=>engine.ensureState(s));
    assert.equal(s.energy,0,engineName+" must fail closed for invalid explicit energy");
  }
  for(const invalid of [NaN,Infinity,-Infinity,Symbol("morale"),true,{},[65],"bad"]){
    const s=makeTrainingConditionState({morale:invalid});
    assert.doesNotThrow(()=>engine.ensureState(s));
    assert.equal(s.morale,65,engineName+" must default invalid morale safely");
  }
}
assert.ok(rootHtml.includes("const savedEnergy = finiteLegacyNumber(state.energy);")
 && rootHtml.includes("const savedMorale = finiteLegacyNumber(state.morale);"),
 "inline engine must normalize energy and morale");
assert.ok(engineCopies[0].includes("const savedEnergy = finiteLegacyNumber(state.energy);")
 && engineCopies[0].includes("const savedMorale = finiteLegacyNumber(state.morale);"),
 "shared engine mirrors must normalize energy and morale");
assert.ok(serviceWorkerCopies[0].includes("last-whistle-static-v627"),
 "service worker cache must be refreshed");
