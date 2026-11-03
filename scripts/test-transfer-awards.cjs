"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "public", "transfer-awards-engine.js"), "utf8");
const rootEngine = fs.readFileSync(path.join(root, "transfer-awards-engine.js"), "utf8");
assert.equal(rootEngine, source, "root and public award engines must stay synchronized");
const appHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.equal(appHtml, fs.readFileSync(path.join(root, "public", "index.html"), "utf8"),
  "root and public app shells must stay synchronized");
assert.ok(appHtml.includes("currentDate:window.LWCareer?.calendarGameDateISO?.(state)"),
  "the app must pass its in-game calendar date into the global award ceremony");
assert.ok(appHtml.includes("cleanSheets:stats.cleanSheets") && appHtml.includes("saves:stats.saves"),
  "the career award ceremony must receive the player's actual defensive season totals");
assert.ok(appHtml.includes('minutes:sum("minutes")'),
  "current-season career aggregation must total actual match minutes instead of estimating 65 per appearance");
assert.ok(appHtml.includes("minutes:stats.minutes"),
  "the award ceremony must receive the career player's actual current-season minutes");
assert.ok(appHtml.includes('"id":"golden-glove","name":"القفاز الذهبي"'),
  "the award catalogue must list Golden Glove for the season award UI");
assert.ok(appHtml.includes('"golden-glove":1200'),
  "winning the Golden Glove must grant the configured in-game reward");
const sandbox = { window: {}, console, Date, Math, Number, String, Array, Object, Set };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "transfer-awards-engine.js" });
const engine = sandbox.window.LWTransferAwards;
assert.ok(engine, "transfer and awards engine must be exported");
assert.equal(engine.version, 18);

const zeroAppearanceSeasonStats = {
  name: "لاعب بلا مشاركات هذا الموسم", position: "مهاجم", age: 24, ovr: 94,
  appearances: 0, apps: 24, minutes: 0, averageRating: 9.8,
  goals: 35, assists: 22, cleanSheets: 0, leagueStrength: 98
};
assert.equal(engine.performanceIndex(zeroAppearanceSeasonStats), 0,
  "an explicit zero current-season appearance count must not fall back to career apps or stale contributions");
const zeroAppearanceEvaluation = engine.evaluateSeasonPerformance(zeroAppearanceSeasonStats);
assert.equal(zeroAppearanceEvaluation.score, 0);
assert.equal(zeroAppearanceEvaluation.performanceSample, 0);
assert.equal(zeroAppearanceEvaluation.minutes, 0);

const zeroMinuteSeason = {
  name: "لاعب بلا دقائق", position: "مهاجم", age: 25, ovr: 80,
  appearances: 8, apps: 20, minutes: 0, averageRating: 9.4,
  goals: 14, assists: 9, leagueStrength: 75
};
assert.equal(engine.performanceIndex(zeroMinuteSeason), 0,
  "explicit zero minutes must not be replaced with the legacy 65-minute appearance estimate");
const zeroMinuteEvaluation = engine.evaluateSeasonPerformance(zeroMinuteSeason);
assert.equal(zeroMinuteEvaluation.score, 0);
assert.equal(zeroMinuteEvaluation.performanceSample, 8);
assert.equal(zeroMinuteEvaluation.minutes, 0);

const legacyPerformance = {
  name: "Legacy performance row", position: "مهاجم", age: 24, ovr: 70,
  apps: 10, averageRating: 7.2, goals: 5, assists: 3, leagueStrength: 60
};
const legacyEvaluation = engine.evaluateSeasonPerformance(legacyPerformance);
assert.equal(legacyEvaluation.performanceSample, 10);
assert.equal(legacyEvaluation.minutes, 650);
assert.ok(engine.performanceIndex(legacyPerformance) > 0);

const noAppearanceLoan = engine.buildLoanProposal({
  player: { age: 20, appearances: 0, apps: 24 }, durationMonths: 12
});
assert.equal(noAppearanceLoan.developmentPriority, true,
  "a youth with zero current-season appearances must receive a development-focused loan even if career apps are nonzero");
const legacyLoan = engine.buildLoanProposal({
  player: { age: 20, apps: 24 }, durationMonths: 12
});
assert.equal(legacyLoan.developmentPriority, false,
  "legacy loan rows without season appearances must continue to use their apps fallback");

for (const malformedAppearances of ["Infinity", "not-a-number"]) {
  const invalidSeasonPerformance = engine.evaluateSeasonPerformance({
    age: 24, appearances: malformedAppearances, apps: 25, minutes: 1625,
    goals: 12, assists: 7, averageRating: 8.1, leagueStrength: 80
  });
  assert.equal(invalidSeasonPerformance.performanceSample, 0,
    "an explicit malformed season appearance count must not fall back to career-wide apps");
  assert.equal(invalidSeasonPerformance.minutes, 0);
  assert.equal(invalidSeasonPerformance.score, 0);

  const invalidSeasonLoan = engine.buildLoanProposal({
    player: { age: 20, appearances: malformedAppearances, apps: 25 },
    durationMonths: 12
  });
  assert.equal(invalidSeasonLoan.developmentPriority, true,
    "a youth with malformed explicit season appearances must be treated as lacking current-season minutes");
}
const lowAppearanceLoan = engine.buildLoanProposal({
  player: { age: 20, appearances: 11, apps: 24 }, durationMonths: 12
});
assert.equal(lowAppearanceLoan.developmentPriority, true);
const thresholdLoan = engine.buildLoanProposal({
  player: { age: 20, appearances: 12, apps: 24 }, durationMonths: 12
});
assert.equal(thresholdLoan.developmentPriority, false);



// Estimated ages for players without a sourced age must be deterministic and
// advance one year per simulated season instead of jumping randomly each season.
const zeroAppearanceTransferRow = engine.simulatePlayerSeason({
  name: "لاعب بلا ظهور", clubName: "نادي اختبار", position: "مهاجم",
  ovr: 99, prestige: 100, leagueStrength: 98,
  seasonStats: { season: 4, appearances: 0, goals: 50, assists: 25, averageRating: 9.8 }
}, 4, 1);
assert.equal(zeroAppearanceTransferRow.appearances, 0);
assert.equal(zeroAppearanceTransferRow.goals, 0,
  "saved goals must be discarded when a season records zero appearances");
assert.equal(zeroAppearanceTransferRow.assists, 0,
  "saved assists must be discarded when a season records zero appearances");
assert.equal(zeroAppearanceTransferRow.averageRating, 0);
assert.equal(zeroAppearanceTransferRow.score, 0,
  "a zero-appearance season must not earn leaderboard performance points from OVR or league strength");
assert.equal(zeroAppearanceTransferRow.weightedGoals, 0);

const ageProgressionFixture = {
  name: "لاعب عمره ثابت", clubName: "نادي اختبار", position: "مهاجم",
  ovr: 72, prestige: 65, leagueStrength: 60
};
const ageSeason1 = engine.simulatePlayerSeason(ageProgressionFixture, 1, 1);
const ageSeason2 = engine.simulatePlayerSeason(ageProgressionFixture, 2, 1);
const ageSeason4 = engine.simulatePlayerSeason(ageProgressionFixture, 4, 1);
assert.equal(ageSeason2.age, ageSeason1.age + 1,
  "an unsourced player's estimated age must increase by one in the next season");
assert.equal(ageSeason4.age, ageSeason1.age + 3,
  "an unsourced player's estimated age must advance consistently across multiple seasons");
const youngAgeSeason1 = engine.simulatePlayerSeason({
  ...ageProgressionFixture, name: "لامين يامال"
}, 1, 1);
const youngAgeSeason2 = engine.simulatePlayerSeason({
  ...ageProgressionFixture, name: "لامين يامال"
}, 2, 1);
assert.equal(youngAgeSeason1.age, 19, "known young-player baseline ages must be preserved in season one");
assert.equal(youngAgeSeason2.age, 20, "known young players must age between world seasons");
const sourcedAgeFixture = { ...ageProgressionFixture, age: 29 };
assert.equal(engine.simulatePlayerSeason(sourcedAgeFixture, 1, 1).age, 29,
  "a sourced age must be used as the baseline in season one");
assert.equal(engine.simulatePlayerSeason(sourcedAgeFixture, 4, 1).age, 32,
  "a sourced player's age must advance one year per season");
assert.equal(engine.simulatePlayerSeason({
  ...sourcedAgeFixture,
  seasonStats: { season: 4, appearances: 20, goals: 4, assists: 2, averageRating: 7.1 }
}, 4, 1).age, 32,
  "saved season-stat rows must use the same age progression as projected rows");


// Defensive and attacking midfield labels must both use midfielder production
// rates. A deterministic same-player fixture makes role-only differences visible.
const sameMidfielder = {
  name: "لاعب وسط ثابت", clubName: "نادي اختبار", country: "مصر",
  ovr: 72, prestige: 65, leagueStrength: 60, age: 24
};
const defensiveMidfieldLine = engine.simulatePlayerSeason({
  ...sameMidfielder, position: "وسط دفاعي"
}, 2, 1);
const attackingMidfieldLine = engine.simulatePlayerSeason({
  ...sameMidfielder, position: "وسط مهاجم"
}, 2, 1);
assert.equal(defensiveMidfieldLine.appearances, attackingMidfieldLine.appearances,
  "midfield role wording must not change deterministic appearance estimates");
assert.equal(defensiveMidfieldLine.goals, attackingMidfieldLine.goals,
  "a defensive midfielder must not be assigned defender goal rates");
assert.equal(defensiveMidfieldLine.assists, attackingMidfieldLine.assists,
  "an attacking midfielder must not be assigned striker assist rates");

// English roster aliases must use the same statistical role as their canonical
// Arabic position. Otherwise GK/ST/CB/LW records are incorrectly projected as midfielders.
const aliasSeasonBase = {
  name: "اختبار توحيد مركز اللاعب", clubName: "نادي اختبار", country: "مصر",
  ovr: 76, prestige: 72, leagueStrength: 68, age: 24
};
for (const [alias, canonical] of [
  ["GK", "حارس مرمى"], ["GOALIE", "حارس مرمى"],
  ["CB", "قلب دفاع"], ["LCB", "قلب دفاع"], ["RCB", "قلب دفاع"],
  ["LB", "ظهير"], ["RB", "ظهير"], ["LWB", "ظهير"], ["RWB", "ظهير"],
  ["CDM", "وسط دفاعي"], ["DM", "وسط دفاعي"],
  ["CM", "وسط"], ["RCM", "وسط"], ["LCM", "وسط"],
  ["CAM", "وسط مهاجم"], ["AM", "وسط مهاجم"],
  ["LW", "جناح"], ["RW", "جناح"], ["LM", "جناح"], ["RM", "جناح"],
  ["CF", "مهاجم"], ["SS", "مهاجم"], ["ST", "رأس حربة"], ["FW", "رأس حربة"]
]) {
  const aliasRow = engine.simulatePlayerSeason({ ...aliasSeasonBase, position: alias }, 3, 1);
  const canonicalRow = engine.simulatePlayerSeason({ ...aliasSeasonBase, position: canonical }, 3, 1);
  for (const field of ["appearances", "goals", "assists", "averageRating", "score", "weightedGoals"]) {
    assert.equal(aliasRow[field], canonicalRow[field],
      alias + " must use the same projected " + field + " as " + canonical);
  }
}

const sameForward = {
  name: "مهاجم اختبار متطابق", clubName: "نادي اختبار", country: "مصر",
  ovr: 95, prestige: 90, leagueStrength: 70, age: 24
};
const mobileForwardLine = engine.simulatePlayerSeason({
  ...sameForward, position: "مهاجم", role: "أساسي"
}, 3, 1);
const centreStrikerLine = engine.simulatePlayerSeason({
  ...sameForward, position: "رأس حربة", role: "أساسي"
}, 3, 1);
assert.ok(centreStrikerLine.goals > mobileForwardLine.goals,
  "a high-rated centre striker should produce more goals than an otherwise identical mobile forward");
assert.ok(centreStrikerLine.assists < mobileForwardLine.assists,
  "a mobile forward should produce more assists than an otherwise identical centre striker");

// Imported English position codes must use the same production profile as Arabic positions.
const codeKeeper = engine.simulatePlayerSeason({ ...sameForward, position: "GK" }, 3, 1);
const arabicKeeper = engine.simulatePlayerSeason({ ...sameForward, position: "حارس مرمى" }, 3, 1);
assert.equal(codeKeeper.goals, arabicKeeper.goals);
assert.equal(codeKeeper.assists, arabicKeeper.assists);
const codeCentreBack = engine.simulatePlayerSeason({ ...sameForward, position: "CB" }, 3, 1);
const arabicCentreBack = engine.simulatePlayerSeason({ ...sameForward, position: "قلب دفاع" }, 3, 1);
assert.equal(codeCentreBack.goals, arabicCentreBack.goals);
assert.equal(codeCentreBack.assists, arabicCentreBack.assists);
assert.equal(engine.roleType("جناح"), "winger");
assert.equal(engine.roleType("LW"), "winger");
assert.equal(engine.roleType("مهاجم"), "attacker");

const sameStrikerStarter = engine.simulatePlayerSeason({ ...sameForward, position: "رأس حربة", role: "أساسي" }, 5, 1);
const sameStrikerSubstitute = engine.simulatePlayerSeason({ ...sameForward, position: "رأس حربة", role: "لاعب بديل" }, 5, 1);
const sameStrikerRotation = engine.simulatePlayerSeason({ ...sameForward, position: "رأس حربة", role: "تناوب" }, 5, 1);
const sameStrikerCoreSub = engine.simulatePlayerSeason({ ...sameForward, position: "رأس حربة", role: "بديل أساسي" }, 5, 1);
const sameStrikerStar = engine.simulatePlayerSeason({ ...sameForward, position: "رأس حربة", role: "نجم الفريق" }, 5, 1);
const sameStrikerProspect = engine.simulatePlayerSeason({ ...sameForward, position: "رأس حربة", role: "ناشئ" }, 5, 1);
const sameStrikerCoreSubEnglish = engine.simulatePlayerSeason({ ...sameForward, position: "رأس حربة", role: "core substitute" }, 5, 1);
const sameStrikerStarterEnglish = engine.simulatePlayerSeason({ ...sameForward, position: "رأس حربة", role: "regularstarter" }, 5, 1);
const sameStrikerStarEnglish = engine.simulatePlayerSeason({ ...sameForward, position: "رأس حربة", role: "star player" }, 5, 1);
const sameStrikerRotationEnglish = engine.simulatePlayerSeason({ ...sameForward, position: "رأس حربة", role: "squad player" }, 5, 1);
const sameStrikerProspectEnglish = engine.simulatePlayerSeason({ ...sameForward, position: "رأس حربة", role: "youngster" }, 5, 1);
const sameStrikerSubEnglish = engine.simulatePlayerSeason({ ...sameForward, position: "رأس حربة", role: "impact sub" }, 5, 1);
const sameStrikerReserveArabic = engine.simulatePlayerSeason({ ...sameForward, position: "رأس حربة", role: "فريق الرديف / لاعب تحت التقييم" }, 5, 1);
const sameStrikerReserveEnglish = engine.simulatePlayerSeason({ ...sameForward, position: "رأس حربة", role: "reserve player" }, 5, 1);
const sameStrikerMissingRole = engine.simulatePlayerSeason({ ...sameForward, position: "رأس حربة" }, 5, 1);
const sameStrikerUnknownRole = engine.simulatePlayerSeason({ ...sameForward, position: "رأس حربة", role: "unclassified squad tier" }, 5, 1);
const sameStrikerUnknownSquadRole = engine.simulatePlayerSeason({ ...sameForward, position: "رأس حربة", squadRole: "unclassified squad tier" }, 5, 1);
const sameStrikerFallbackStar = engine.simulatePlayerSeason({
  ...sameForward, position: "رأس حربة", role: "unclassified squad tier", squadRole: "نجم الفريق"
}, 5, 1);
const sameStrikerFallbackRotation = engine.simulatePlayerSeason({
  ...sameForward, position: "رأس حربة", role: "unclassified squad tier", playingTime: "تناوب"
}, 5, 1);
const sameStrikerPrimarySubstitute = engine.simulatePlayerSeason({
  ...sameForward, position: "رأس حربة", role: "لاعب بديل", squadRole: "نجم الفريق"
}, 5, 1);
assert.equal(sameStrikerStarter.minutes, sameStrikerStarter.appearances * 83,
  "starter projections must use the same 83-minute participation baseline as match simulation");
assert.equal(sameStrikerCoreSub.minutes, sameStrikerCoreSub.appearances * 66,
  "core-substitute projections must use the same 66-minute baseline as match simulation");
assert.equal(sameStrikerStar.minutes, sameStrikerStar.appearances * 88,
  "star-player projections must use the same 88-minute baseline as match simulation");
assert.equal(sameStrikerRotation.minutes, sameStrikerRotation.appearances * 43,
  "rotation projections must use the same 43-minute baseline as match simulation");
assert.equal(sameStrikerProspect.minutes, sameStrikerProspect.appearances * 20,
  "prospect projections must use the same 20-minute baseline as match simulation");
assert.equal(sameStrikerCoreSubEnglish.minutes, sameStrikerCoreSubEnglish.appearances * 66,
  "English core-substitute aliases must keep the same 66-minute match baseline");
assert.equal(sameStrikerStarterEnglish.minutes, sameStrikerStarterEnglish.appearances * 83,
  "English regular-starter aliases must keep the same 83-minute match baseline");
assert.equal(sameStrikerStarEnglish.minutes, sameStrikerStarEnglish.appearances * 88,
  "English star-player aliases must keep the same 88-minute match baseline");
assert.equal(sameStrikerRotationEnglish.minutes, sameStrikerRotationEnglish.appearances * 43,
  "English squad-player aliases must keep the same 43-minute match baseline");
assert.equal(sameStrikerProspectEnglish.minutes, sameStrikerProspectEnglish.appearances * 20,
  "English youngster aliases must keep the same 20-minute match baseline");
assert.equal(sameStrikerSubEnglish.minutes, sameStrikerSubEnglish.appearances * 28,
  "English impact-sub aliases must keep the same 28-minute match baseline");
assert.equal(sameStrikerReserveArabic.minutes, sameStrikerReserveArabic.appearances * 20,
  "academy reserve / under-evaluation roles must use the prospect 20-minute baseline");
assert.equal(sameStrikerReserveEnglish.minutes, sameStrikerReserveEnglish.appearances * 20,
  "English reserve roles must use the prospect 20-minute baseline");
assert.equal(sameStrikerMissingRole.minutes, sameStrikerMissingRole.appearances * 28,
  "missing squad roles must use the same 28-minute substitute fallback as match simulation");
assert.equal(sameStrikerUnknownRole.minutes, sameStrikerUnknownRole.appearances * 28,
  "unrecognized squad roles must not inflate award projections above the match-engine substitute fallback");
assert.equal(sameStrikerUnknownSquadRole.minutes, sameStrikerUnknownSquadRole.appearances * 28,
  "unrecognized alternate squad-role fields must use the match-engine substitute fallback");
assert.equal(sameStrikerFallbackStar.minutes, sameStrikerStar.minutes,
  "an unrecognized primary role must fall through to a recognized squadRole for award minutes");
assert.equal(sameStrikerFallbackRotation.minutes, sameStrikerRotation.minutes,
  "an unrecognized primary role must fall through to a recognized playingTime field");
assert.equal(sameStrikerPrimarySubstitute.minutes, sameStrikerSubstitute.minutes,
  "a recognized primary role must remain authoritative over a conflicting squadRole");
assert.equal(sameStrikerSubstitute.minutes, sameStrikerSubstitute.appearances * 28,
  "substitute projections must use the same 28-minute baseline as match simulation");
assert.equal(sameStrikerStarter.appearances, sameStrikerSubstitute.appearances);
assert.ok(sameStrikerStarter.minutes > sameStrikerRotation.minutes && sameStrikerRotation.minutes > sameStrikerSubstitute.minutes);
assert.ok(sameStrikerStarter.goals > sameStrikerSubstitute.goals);
assert.ok(sameStrikerStarter.assists > sameStrikerSubstitute.assists);
assert.ok(sameStrikerStarter.goals * 90 / Math.max(1, sameStrikerStarter.minutes) <= 0.55);
assert.equal(engine.simulatePlayerSeason({ ...sameForward, position: "حارس مرمى" }, 5, 1).goals, 0);
const noProjectionProgress = engine.simulatePlayerSeason({ ...sameForward, position: "رأس حربة", role: "أساسي" }, 5, 0);
assert.equal(noProjectionProgress.minutes, 0);
assert.equal(noProjectionProgress.goals, 0);
assert.equal(noProjectionProgress.assists, 0);
const sameStrikerHalfSeason = engine.simulatePlayerSeason({ ...sameForward, position: "رأس حربة", role: "أساسي" }, 5, 0.5);
assert.equal(sameStrikerHalfSeason.minutes, Math.round(sameStrikerStarter.minutes * 0.5));
assert.equal(sameStrikerHalfSeason.goals, Math.round(sameStrikerStarter.goals * 0.5));
assert.equal(sameStrikerHalfSeason.assists, Math.round(sameStrikerStarter.assists * 0.5));
const savedSeasonStatsRemainAuthoritative = engine.simulatePlayerSeason({
  ...sameForward, position: "رأس حربة", role: "لاعب بديل",
  seasonStats: { season: 5, appearances: 20, minutes: 560, goals: 8, assists: 3, averageRating: 7.2 }
}, 5, 1);
assert.equal(savedSeasonStatsRemainAuthoritative.goals, 8);
assert.equal(savedSeasonStatsRemainAuthoritative.assists, 3);
assert.equal(savedSeasonStatsRemainAuthoritative.minutes, 560,
  "saved current-season match minutes must be preserved for real roster players");
const savedSeasonHalfProgress = engine.simulatePlayerSeason({
  ...sameForward, position: "رأس حربة", role: "لاعب بديل",
  seasonStats: { season: 5, appearances: 20, minutes: 560, goals: 8, assists: 3, averageRating: 7.2 }
}, 5, 0.5);
assert.equal(savedSeasonHalfProgress.minutes, 280,
  "saved minutes must scale once with the same season progress as appearances and contributions");
const legacySavedMinutes = engine.simulatePlayerSeason({
  ...sameForward, position: "رأس حربة", role: "لاعب بديل",
  seasonStats: { season: 5, appearances: 20, goals: 8, assists: 3, averageRating: 7.2 }
}, 5, 1);
assert.equal(legacySavedMinutes.minutes, 560,
  "legacy saved seasons without a minutes field must use the role-based substitute estimate");
const explicitZeroSavedMinutes = engine.simulatePlayerSeason({
  ...sameForward, position: "رأس حربة", role: "لاعب بديل",
  seasonStats: { season: 5, appearances: 20, minutes: 0, goals: 8, assists: 3, averageRating: 7.2 }
}, 5, 1);
assert.equal(explicitZeroSavedMinutes.minutes, 0,
  "an explicit zero-minute season must not be replaced with an estimated appearance duration");
assert.equal(explicitZeroSavedMinutes.goals, 0,
  "a saved season with zero actual minutes must not retain goal contributions in award projections");
assert.equal(explicitZeroSavedMinutes.assists, 0,
  "a saved season with zero actual minutes must not retain assist contributions in award projections");
assert.equal(explicitZeroSavedMinutes.averageRating, 0,
  "a saved season with zero actual minutes must not retain an appearance rating in award projections");
assert.equal(explicitZeroSavedMinutes.score, 0,
  "a saved season with zero actual minutes must not earn performance points");

const malformedSavedSeason = engine.simulatePlayerSeason({
  ...sameForward, position: "رأس حربة", leagueStrength: "Infinity",
  seasonStats: { season: 6, appearances: "Infinity", goals: "Infinity", assists: "NaN", averageRating: "Infinity" }
}, 6, 1);
assert.equal(malformedSavedSeason.appearances, 0,
  "non-finite saved appearances must not enter award eligibility or ranking");
assert.equal(malformedSavedSeason.goals, 0);
assert.equal(malformedSavedSeason.assists, 0);
assert.equal(malformedSavedSeason.averageRating, 0);
assert.equal(malformedSavedSeason.score, 0);
assert.equal(malformedSavedSeason.weightedGoals, 0,
  "malformed league strength must not turn a zero-goal row into NaN weighted goals");

const malformedEligibleSeason = engine.simulatePlayerSeason({
  ...sameForward, position: "رأس حربة", leagueStrength: "Infinity",
  seasonStats: { season: 6, appearances: 12, goals: "Infinity", assists: -4, averageRating: 12 }
}, 6, 1);
assert.equal(malformedEligibleSeason.appearances, 12);
assert.equal(malformedEligibleSeason.goals, 0);
assert.equal(malformedEligibleSeason.assists, 0);
assert.equal(malformedEligibleSeason.averageRating, 10);
assert.equal(malformedEligibleSeason.leagueStrength, 60);
assert.ok(Number.isFinite(malformedEligibleSeason.score));
assert.ok(Number.isFinite(malformedEligibleSeason.weightedGoals));

const youthPlayer = {
  name: "لاعب أكاديمية", age: 17, position: "جناح", ovr: 58, potential: 82,
  country: "مصر", currentClub: "مركز شباب النور", currentClubPower: 52,
  form: 6.5, appearances: 5, goals: 1, assists: 1
};
const targets = [
  { club: "ريال مدريد", country: "إسبانيا", league: "الدوري الإسباني الدرجة الأولى", power: 93, prestige: 100, division: 1, currency: "€", stars: ["كيليان مبابي"] },
  { club: "نادي محلي متوسط", country: "مصر", league: "الدوري المصري الممتاز", power: 60, prestige: 65, division: 1, currency: "ج.م", stars: ["لاعب وسط"] },
  { club: "نادي متواضع", country: "المغرب", league: "الدوري المغربي", power: 59, prestige: 62, division: 1, currency: "€", stars: ["مهاجم محلي"] },
  { club: "نادي قوي", country: "مصر", league: "الدوري المصري الممتاز", power: 75, prestige: 80, division: 1, currency: "ج.م", stars: ["لاعب أساسي"] }
];
const youthOffers = engine.generateOffers({ player: youthPlayer, targets, windowId: "summer-test", currentClubPower: 52 });
assert.ok(youthOffers.length > 0, "a youth player with match history should receive realistic step-up offers");
assert.ok(youthOffers.every(offer => offer.power < 70), "a 58 OVR academy player must not receive elite-club offers");
assert.ok(!youthOffers.some(offer => offer.club === "ريال مدريد" || offer.club === "نادي قوي"));
assert.ok(youthOffers.every(offer => offer.role && offer.stars && offer.signingBonus >= 0 && offer.goalBonus >= 0 && offer.cleanSheetBonus >= 0));
assert.ok(youthOffers.every(offer => ["نجم الفريق", "أساسي", "تناوب", "لاعب بديل", "لاعب ناشئ"].includes(offer.role)));

const normalizedIdentityPlayer = {
  ...youthPlayer, name: "حارس انتقالات", age: 24, position: "GK",
  currentClub: "Real Madrid", country: "Spain", currentClubPower: 70,
  ovr: 80, potential: 82, form: 7.2, appearances: 10, goals: 2, assists: 1
};
const normalizedIdentityOffers = engine.generateOffers({
  player: normalizedIdentityPlayer,
  windowId: "normalized-transfer-identity",
  currentClubPower: 70,
  targets: [{
    club: "REAL MADRID", country: "spain", power: 70, prestige: 80, division: 1,
    players: [{ name: "حارس النادي الحالي", position: "حارس مرمى", ovr: 90 }]
  }, {
    club: "نادي جديد", country: "Spain", power: 72, prestige: 80, division: 1,
    players: [
      { name: "حارس منافس", position: "حارس مرمى", ovr: 88 },
      { name: "مهاجم منافس", position: "مهاجم", ovr: 95 }
    ]
  }]
});
assert.equal(normalizedIdentityOffers.length, 1,
  "a case/spacing variant of the player's current club must not generate a self-transfer offer");
assert.equal(normalizedIdentityOffers[0].club, "نادي جديد");
assert.deepEqual(normalizedIdentityOffers[0].positionRivals, ["حارس منافس"],
  "English position codes must match Arabic roster positions through the shared role mapping");
const unknownRoleOffers = engine.generateOffers({
  player: { ...normalizedIdentityPlayer, position: "unmapped role" },
  windowId: "unknown-role-transfer",
  currentClubPower: 70,
  targets: [{
    club: "نادي جديد", country: "Spain", power: 72, prestige: 80, division: 1,
    players: [{ name: "لاعب بمركز آخر", position: "different unmapped role" }]
  }]
});
assert.deepEqual(unknownRoleOffers[0].positionRivals, [],
  "unknown position labels must not all collapse into the default midfielder role when discovering rivals");

const fallbackCurrencyOffers = engine.generateOffers({
  player: normalizedIdentityPlayer,
  windowId: "fallback-currency",
  currentClubPower: 70,
  targets: [{ club: "نادي بلا عملة", country: "مصر", power: 72, prestige: 80, division: 1 }]
});
assert.equal(fallbackCurrencyOffers.length, 1,
  "a transfer target with no currency metadata must still produce an offer");
assert.equal(fallbackCurrencyOffers[0].currency, "ج.م",
  "a missing target currency must use the Egyptian-pound display fallback");
assert.equal(fallbackCurrencyOffers[0].wage, 350 + 72 * 28 + 80 * 12,
  "the wage formula must use the same Egyptian-pound fallback as the displayed currency");

const invalidOfferCases = [
  { label: "positive-infinite appearances", player: { ...youthPlayer, appearances: Infinity } },
  { label: "infinite-string appearances", player: { ...youthPlayer, appearances: "Infinity" } },
  { label: "NaN appearances", player: { ...youthPlayer, appearances: NaN } },
  { label: "malformed appearances", player: { ...youthPlayer, appearances: "not-a-number" } },
  { label: "missing appearances", player: { ...youthPlayer, appearances: undefined } },
  { label: "insufficient appearances", player: { ...youthPlayer, appearances: 1 } },
  { label: "positive-infinite form", player: { ...youthPlayer, form: Infinity } },
  { label: "infinite-string form", player: { ...youthPlayer, form: "Infinity" } },
  { label: "NaN form", player: { ...youthPlayer, form: NaN } },
  { label: "malformed form", player: { ...youthPlayer, form: "not-a-number" } },
  { label: "form below minimum", player: { ...youthPlayer, form: 5.7 } }
];
for (const testCase of invalidOfferCases) {
  assert.equal(engine.generateOffers({
    player: testCase.player, targets, windowId: "invalid-" + testCase.label, currentClubPower: 52
  }).length, 0, `invalid transfer eligibility should reject ${testCase.label}`);
}
assert.ok(engine.generateOffers({
  player: { ...youthPlayer, appearances: "5", form: "6.5" },
  targets, windowId: "numeric-string-test", currentClubPower: 52
}).length > 0, "finite numeric strings should remain accepted for legacy saves");

const offer = youthOffers[0];
const normalTerms = {
  weeklyWage: offer.wage,
  signingBonus: offer.signingBonus,
  goalBonus: offer.goalBonus,
  cleanSheetBonus: offer.cleanSheetBonus,
  contractSeasons: 3,
  releaseClause: offer.releaseClause
};
const accepted = engine.evaluateNegotiation(offer, normalTerms, 100, 0);
assert.equal(accepted.status, "accepted", "reasonable initial requests should be accepted");
assert.equal(accepted.terms.weeklyWage, offer.wage);

const counter = engine.evaluateNegotiation(offer, {
  weeklyWage: offer.wage * 2,
  signingBonus: offer.signingBonus * 3,
  goalBonus: offer.goalBonus * 2,
  cleanSheetBonus: offer.cleanSheetBonus * 2,
  contractSeasons: 2,
  releaseClause: offer.releaseClause * 2
}, 100, 0);
assert.equal(counter.status, "counter", "an excessive first request should trigger a counter-offer");
assert.ok(counter.patience < 100);

const withdrawn = engine.evaluateNegotiation(offer, {
  weeklyWage: offer.wage * 10,
  signingBonus: offer.signingBonus * 10,
  goalBonus: offer.goalBonus * 10,
  cleanSheetBonus: offer.cleanSheetBonus * 10,
  contractSeasons: 1,
  releaseClause: offer.releaseClause * 5
}, 1, 0);
assert.equal(withdrawn.status, "withdrawn", "the club must withdraw when its patience is exhausted");

const leaderboard = engine.buildLeagueLeaderboard({
  season: 3,
  progress: 0.5,
  players: [
    { name: "مهاجم حقيقي", clubName: "نادي نجوم", position: "مهاجم", ovr: 88, prestige: 85, leagueStrength: 82, age: 25 },
    { name: "صانع ألعاب", clubName: "نادي نجوم", position: "وسط مهاجم", ovr: 82, prestige: 85, leagueStrength: 82, age: 24 }
  ],
  userLine: { name: "أنا", club: "فريقي", country: "مصر", ovr: 79, age: 22, appearances: 10, goals: 9, assists: 4, averageRating: 7.7, leagueStrength: 70 }
});
assert.ok(leaderboard.some(row => row.isUser && row.name === "أنا"));
assert.ok(leaderboard.some(row => row.name === "مهاجم حقيقي"));
assert.ok(leaderboard.every(row => Number.isFinite(row.goals) && Number.isFinite(row.assists)));
const zeroAppearanceLeaderboard = engine.buildLeagueLeaderboard({
  season: 4,
  progress: 1,
  players: [{
    name: "لاعب بلا ظهور", clubName: "نادي اختبار", position: "مهاجم",
    ovr: 99, prestige: 100, leagueStrength: 98,
    seasonStats: { season: 4, appearances: 0, goals: 50, assists: 25, averageRating: 9.8 }
  }],
  userLine: {
    name: "مسيرة بلا ظهور", club: "فريقي", ovr: 99, appearances: 0,
    goals: 20, assists: 10, averageRating: 9.5, leagueStrength: 98
  }
});
const zeroAppearanceWorldRow = zeroAppearanceLeaderboard.find(row => row.name === "لاعب بلا ظهور");
const zeroAppearanceUserRow = zeroAppearanceLeaderboard.find(row => row.name === "مسيرة بلا ظهور");
assert.equal(zeroAppearanceWorldRow.goals, 0);
assert.equal(zeroAppearanceWorldRow.assists, 0);
assert.equal(zeroAppearanceWorldRow.score, 0);
assert.equal(zeroAppearanceWorldRow.weightedGoals, 0);
assert.equal(zeroAppearanceUserRow.goals, 0);
assert.equal(zeroAppearanceUserRow.assists, 0);
assert.equal(zeroAppearanceUserRow.score, 0);
assert.equal(zeroAppearanceUserRow.weightedGoals, 0,
  "leaderboard rows with no appearances must not retain stale season contributions");

const malformedCareerLeaderboard = engine.buildLeagueLeaderboard({
  season: 5,
  progress: 1,
  players: [],
  userLine: {
    name: "مسيرة بإحصائيات تالفة", club: "فريق الاختبار", position: "مهاجم",
    ovr: 88, appearances: "Infinity", apps: 25, goals: "Infinity",
    assists: "NaN", averageRating: "Infinity", leagueStrength: "Infinity"
  }
});
const malformedCareerRow = malformedCareerLeaderboard.find(row => row.isUser);
assert.ok(malformedCareerRow, "the career player must remain present in the leaderboard");
assert.equal(malformedCareerRow.appearances, 0,
  "an explicit invalid appearance value must not fall through to a stale apps alias");
assert.equal(malformedCareerRow.goals, 0);
assert.equal(malformedCareerRow.assists, 0);
assert.equal(malformedCareerRow.averageRating, 0);
assert.equal(malformedCareerRow.score, 0);
assert.equal(malformedCareerRow.weightedGoals, 0);
assert.equal(malformedCareerRow.leagueStrength, 60);

const boundedCareerLeaderboard = engine.buildLeagueLeaderboard({
  season: 5,
  progress: 1,
  players: [],
  userLine: {
    name: "مسيرة بقيم خارج النطاق", club: "فريق الاختبار", position: "مهاجم",
    ovr: 88, appearances: 12, goals: "Infinity", assists: -3,
    averageRating: 12, leagueStrength: "Infinity"
  }
});
const boundedCareerRow = boundedCareerLeaderboard.find(row => row.isUser);
assert.equal(boundedCareerRow.appearances, 12);
assert.equal(boundedCareerRow.goals, 0);
assert.equal(boundedCareerRow.assists, 0);
assert.equal(boundedCareerRow.averageRating, 10);
assert.equal(boundedCareerRow.leagueStrength, 60);
assert.ok(Number.isFinite(boundedCareerRow.score) && Number.isFinite(boundedCareerRow.weightedGoals),
  "malformed career leaderboard values must never produce non-finite ranking scores");

const realPlayers = [
  { name: "كيليان مبابي", clubName: "ريال مدريد", country: "إسبانيا", position: "مهاجم", ovr: 93, prestige: 100, leagueStrength: 96, age: 27, confederation: "UEFA", originConfederation: "UEFA" },
  { name: "لامين يامال", clubName: "برشلونة", country: "إسبانيا", position: "جناح", ovr: 91, prestige: 99, leagueStrength: 96, age: 19, confederation: "UEFA", originConfederation: "UEFA" },
  { name: "محمد صلاح", clubName: "ليفربول", country: "إنجلترا", position: "جناح", ovr: 90, prestige: 97, leagueStrength: 98, age: 34, confederation: "UEFA", originConfederation: "CAF" },
  { name: "إمام عاشور", clubName: "الأهلي", country: "مصر", position: "وسط مهاجم", ovr: 82, prestige: 94, leagueStrength: 72, age: 28, confederation: "CAF", originConfederation: "CAF" },
  { name: "إيرلينغ هالاند", clubName: "مانشستر سيتي", country: "إنجلترا", position: "مهاجم", ovr: 92, prestige: 99, leagueStrength: 98, age: 26, confederation: "UEFA", originConfederation: "UEFA" },
  { name: "فيتور روكي", clubName: "بالميراس", country: "البرازيل", position: "مهاجم", ovr: 84, prestige: 90, leagueStrength: 84, age: 21, confederation: "CONMEBOL", originConfederation: "CONMEBOL" },
  { name: "حارس الاختبار", clubName: "نادي الحارس", country: "مصر", position: "حارس مرمى", ovr: 88, prestige: 80, leagueStrength: 70, age: 28,
    seasonStats: { season: 4, appearances: 30, goals: 0, assists: 0, averageRating: 7.7, cleanSheets: 22, saves: 94, penaltiesSaved: 2, club: "نادي الحارس" } },
  { name: "حارس منافس", clubName: "نادي المنافس", country: "مصر", position: "حارس مرمى", ovr: 82, prestige: 75, leagueStrength: 68, age: 29,
    seasonStats: { season: 4, appearances: 30, goals: 0, assists: 0, averageRating: 7.5, cleanSheets: 12, saves: 120, penaltiesSaved: 0, club: "نادي المنافس" } },
  { name: "موهبة شابة", clubName: "نادي الشباب", country: "إسبانيا", position: "جناح", ovr: 81, prestige: 75, leagueStrength: 70, age: 17, confederation: "UEFA", originConfederation: "UEFA",
    seasonStats: { season: 4, appearances: 28, goals: 9, assists: 6, averageRating: 7.8, club: "نادي الشباب" } }
];
const ceremony = engine.buildSeasonAwardCeremony({
  season: 4,
  currentDate: "2028-02-14T00:00:00.000Z",
  player: { name: "أنا", club: "فريقي", country: "مصر", position: "مهاجم", ovr: 99, age: 23, appearances: 38, goals: 52, assists: 28, averageRating: 9.4, trophies: 3, professionalism: 90, confederation: "CAF", originConfederation: "CAF", leagueStrength: 78 },
  realPlayers
});
const zeroMinuteCeremony = engine.buildSeasonAwardCeremony({
  season: 9,
  player: {
    name: "لاعب بلا دقائق", club: "فريق الاختبار", country: "مصر", position: "حارس مرمى",
    age: 25, ovr: 99, appearances: 20, minutes: 0, goals: 30, assists: 20,
    averageRating: 10, cleanSheets: 20, saves: 100, penaltiesSaved: 4
  },
  realPlayers: [{
    name: "حارس بلا دقائق", clubName: "نادي الحارس", country: "مصر", position: "حارس مرمى",
    age: 28, ovr: 99, prestige: 100, leagueStrength: 90,
    seasonStats: { season: 9, appearances: 30, minutes: 0, goals: 0, assists: 0,
      averageRating: 10, cleanSheets: 30, saves: 200, penaltiesSaved: 10 }
  }, {
    name: "مهاجم بلا دقائق", clubName: "نادي المهاجم", country: "مصر", position: "مهاجم",
    age: 25, ovr: 99, prestige: 100, leagueStrength: 90,
    seasonStats: { season: 9, appearances: 30, minutes: 0, goals: 50, assists: 20, averageRating: 10 }
  }]
});
assert.equal(zeroMinuteCeremony.ballonDor.topFive.length, 0,
  "players with appearances but zero actual minutes must not enter the Ballon d'Or shortlist");
assert.equal(zeroMinuteCeremony.awards.length, 0,
  "zero-minute players must not win any season award, including goalkeeper-only awards");
assert.equal(zeroMinuteCeremony.playerAwards.length, 0,
  "zero-minute career players must not receive season award records");

const malformedCeremony = engine.buildSeasonAwardCeremony({
  season: 8,
  currentDate: "2032-02-14T00:00:00.000Z",
  player: {
    name: "لاعب بيانات تالفة", club: "نادي الاختبار", country: "مصر", position: "حارس مرمى",
    age: "Infinity", ovr: 80, appearances: 12, goals: "Infinity", assists: "NaN",
    averageRating: "Infinity", trophies: "Infinity", professionalism: "Infinity",
    leagueStrength: "Infinity", cleanSheets: "Infinity", saves: "Infinity", penaltiesSaved: "Infinity"
  },
  realPlayers: [{
    name: "حارس بيانات تالفة", clubName: "نادي اختبار آخر", country: "مصر", position: "حارس مرمى",
    age: 25, ovr: 80, prestige: "Infinity", leagueStrength: "Infinity",
    confederation: "CAF", originConfederation: "CAF",
    seasonStats: {
      season: 8, appearances: 12, goals: "Infinity", assists: "NaN", averageRating: "Infinity",
      cleanSheets: "Infinity", saves: "Infinity", penaltiesSaved: "Infinity"
    }
  }, {
    name: "لامين يامال", clubName: "نادي موهبة", country: "إسبانيا", position: "جناح",
    age: "Infinity", ovr: 90, prestige: 90, leagueStrength: 80,
    confederation: "UEFA", originConfederation: "UEFA",
    seasonStats: { season: 8, appearances: 25, goals: 10, assists: 8, averageRating: 8.1 }
  }, {
    name: "موهبة بلا عمر موثق", clubName: "نادي ناشئين", country: "مصر", position: "مهاجم",
    ovr: 80, prestige: 75, leagueStrength: 65,
    seasonStats: { season: 8, appearances: 20, goals: 7, assists: 4, averageRating: 7.4 }
  }]
});
assert.ok(malformedCeremony.ballonDor.topFive.length > 0,
  "finite appearance counts must remain eligible even when malformed performance fields are sanitized");
assert.equal(malformedCeremony.awards.some(award => award.id === "golden-boy"), false,
  "an invalid age must not be converted into an under-21 Golden Boy candidate");
assert.ok(!malformedCeremony.awards.some(award => award.id === "golden-boy"),
  "a known young player with a malformed saved age must not qualify through a name-based fallback");
assert.ok(malformedCeremony.ballonDor.topFive.every(row =>
  Number.isFinite(row.score) && Number.isFinite(row.goals) && Number.isFinite(row.assists)
    && Number.isFinite(row.averageRating)),
  "Ballon d'Or ranking must never expose non-finite player scores or statistics");
assert.ok(malformedCeremony.awards.every(award =>
  Number.isFinite(award.winner.goals) && Number.isFinite(award.winner.assists)
    && Number.isFinite(award.winner.averageRating) && Number.isFinite(award.winner.cleanSheets)
    && Number.isFinite(award.winner.saves) && Number.isFinite(award.winner.penaltiesSaved)
    && award.topThree.every(row => Number.isFinite(row.score))),
  "all award winners and shortlists must remain finite when saved player stats are malformed");

const estimatedYouthCeremony = engine.buildSeasonAwardCeremony({
  season: 2,
  currentDate: "2026-07-31T00:00:00.000Z",
  player: {
    name: "لاعب مخضرم", club: "فريقه", country: "مصر", position: "وسط",
    age: 30, appearances: 0, goals: 0, assists: 0, averageRating: 0
  },
  realPlayers: [{
    name: "لامين يامال", clubName: "برشلونة", country: "إسبانيا", position: "جناح",
    ovr: 90, prestige: 90, leagueStrength: 90, confederation: "UEFA",
    originConfederation: "UEFA",
    seasonStats: { season: 2, appearances: 15, goals: 4, assists: 3, averageRating: 8.1 }
  }]
});
const estimatedYouthAward = estimatedYouthCeremony.awards.find(row => row.id === "golden-boy");
assert.ok(estimatedYouthAward,
  "a player with no sourced age must retain the simulator's existing estimated-age youth eligibility");
assert.equal(estimatedYouthAward.winner.name, "لامين يامال");
assert.equal(estimatedYouthAward.winner.age, 20);

const defaultAgeCareerCeremony = engine.buildSeasonAwardCeremony({
  season: 1,
  currentDate: "2026-07-31T00:00:00.000Z",
  player: {
    name: "لاعب مسيرة جديد", club: "فريقه", country: "مصر", position: "مهاجم",
    appearances: 12, goals: 5, assists: 3, averageRating: 7.2
  },
  realPlayers: []
});
const defaultAgeGoldenBoy = defaultAgeCareerCeremony.awards.find(row => row.id === "golden-boy");
assert.ok(defaultAgeGoldenBoy,
  "a career player whose age uses the engine's existing 18-year default must remain Golden Boy eligible");
assert.equal(defaultAgeGoldenBoy.winner.name, "لاعب مسيرة جديد");
assert.equal(defaultAgeGoldenBoy.winner.age, 18);

const noYouthCeremony = engine.buildSeasonAwardCeremony({
  season: 4,
  currentDate: "2028-02-14T00:00:00.000Z",
  player: {
    name: "لاعب مخضرم", club: "فريقي", country: "مصر", position: "وسط مهاجم",
    ovr: 78, age: 30, appearances: 25, goals: 5, assists: 8, averageRating: 7.1,
    confederation: "CAF", originConfederation: "CAF", leagueStrength: 70
  },
  realPlayers: realPlayers.filter(row => Number(row.age) >= 22)
});
assert.equal(noYouthCeremony.awards.some(row => row.id === "golden-boy"), false,
  "Golden Boy must be omitted when no eligible under-21 player exists instead of falling back to older players");
assert.equal(ceremony.createdAt, "2028-02-14T00:00:00.000Z",
  "award ceremony timestamps must use the supplied in-game calendar date");
assert.equal(ceremony.ballonDor.topFive.length, 5, "the Ballon d'Or ceremony must show exactly five nominees");
assert.ok(ceremony.ballonDor.topFive.some(row => row.isUser), "a standout career player must be eligible for the global shortlist");
assert.ok(ceremony.awards.some(row => row.id === "fifa-the-best"));
assert.ok(ceremony.awards.some(row => row.id === "world-golden-shoe"));
assert.ok(ceremony.awards.some(row => row.id === "golden-boy"));
assert.ok(ceremony.awards.some(row => row.id === "caf-player"));
assert.ok(ceremony.awards.some(row => row.id === "uefa-player"));
assert.ok(ceremony.awards.some(row => row.id === "conmebol-player"));
const goldenGlove = ceremony.awards.find(row => row.id === "golden-glove");
assert.ok(goldenGlove, "the season ceremony must include a Golden Glove when eligible keepers exist");
assert.equal(goldenGlove.winner.name, "حارس الاختبار",
  "Golden Glove must rank goalkeeper clean sheets, saves, and keeper rating instead of attacker goals");
assert.equal(goldenGlove.topThree[0].cleanSheets, 22,
  "the Golden Glove shortlist should expose the leading keeper's clean-sheet total");
assert.equal(goldenGlove.topThree[0].saves, 94,
  "the Golden Glove shortlist should expose the leading keeper's save total");
assert.equal(ceremony.playerAwards.some(row => row.id === "golden-glove"), false,
  "an outfield player must not receive the goalkeeper-only award");

const keeperCareer = engine.buildSeasonAwardCeremony({
  season: 4,
  player: { name: "حارس مسيرتي", club: "فريقي", country: "مصر", position: "حارس مرمى", ovr: 88,
    age: 25, appearances: 38, goals: 0, assists: 0, averageRating: 8.2, cleanSheets: 25,
    saves: 105, penaltiesSaved: 3, trophies: 2, professionalism: 85, confederation: "CAF",
    originConfederation: "CAF", leagueStrength: 78 },
  realPlayers
});
const userGoldenGlove = keeperCareer.awards.find(row => row.id === "golden-glove");
assert.equal(userGoldenGlove.winner.name, "حارس مسيرتي",
  "a goalkeeper's actual career clean sheets and saves must be considered for Golden Glove");
assert.ok(keeperCareer.playerAwards.some(row => row.id === "golden-glove"),
  "winning Golden Glove should be recorded in the player's end-of-season awards");
const keeperAliasCareer = engine.buildSeasonAwardCeremony({
  season: 4,
  player: { name: "حارس باختصار إنجليزي", club: "فريقي", country: "مصر", position: "GK",
    ovr: 88, age: 25, appearances: 38, goals: 0, assists: 0, averageRating: 8.2,
    professionalism: 85, leagueStrength: 78 },
  realPlayers: []
});
const keeperAliasGlove = keeperAliasCareer.awards.find(row => row.id === "golden-glove");
assert.ok(keeperAliasGlove,
  "an English GK alias must receive goalkeeper defensive projections and qualify for Golden Glove");
assert.equal(keeperAliasGlove.winner.name, "حارس باختصار إنجليزي",
  "the GK alias must be ranked as a goalkeeper rather than an outfield midfielder");
assert.ok(keeperAliasCareer.playerAwards.some(row => row.id === "golden-glove"),
  "a GK alias Golden Glove win must be recorded in the career awards");
const outfieldOnlyCeremony = engine.buildSeasonAwardCeremony({
  season: 4,
  player: { name: "لاعب ميداني", club: "فريقي", country: "مصر", position: "جناح", ovr: 80,
    age: 24, appearances: 30, goals: 12, assists: 9, averageRating: 7.2, leagueStrength: 65 },
  realPlayers: realPlayers.filter(row => row.position !== "حارس مرمى")
});
assert.equal(outfieldOnlyCeremony.awards.some(row => row.id === "golden-glove"), false,
  "the Golden Glove must be omitted instead of falling back to an ineligible outfield player");

const noAppearanceStar = {
  ...realPlayers[0],
  name: "نجم بلا مشاركات",
  ovr: 99,
  prestige: 100,
  leagueStrength: 98,
  seasonStats: {
    season: 4, appearances: 0, goals: 0, assists: 0, averageRating: 0,
    cleanSheets: 0, saves: 0, penaltiesSaved: 0, club: "نادي بلا مشاركات"
  }
};
const noAppearanceCeremony = engine.buildSeasonAwardCeremony({
  season: 4,
  currentDate: "2028-02-14T00:00:00.000Z",
  player: {
    name: "لاعب بلا مشاركات", club: "فريقي", country: "مصر", position: "مهاجم",
    ovr: 99, age: 24, appearances: 0, goals: 0, assists: 0, averageRating: 0,
    trophies: 20, professionalism: 100, confederation: "UEFA",
    originConfederation: "UEFA", leagueStrength: 98
  },
  realPlayers: [...realPlayers, noAppearanceStar]
});
assert.equal(noAppearanceCeremony.playerAwards.length, 0,
  "a career player with no appearances must not receive season awards based on OVR or trophy bonuses");
assert.ok(!noAppearanceCeremony.ballonDor.topFive.some(row =>
  row.name === "لاعب بلا مشاركات" || row.name === "نجم بلا مشاركات"),
  "players with zero appearances must not enter the Ballon d'Or shortlist");
assert.ok(noAppearanceCeremony.awards.every(row =>
  row.winner.name !== "لاعب بلا مشاركات" && row.winner.name !== "نجم بلا مشاركات"),
  "zero-appearance players must be ineligible for every season award");

console.log("PASS: realistic offer tiers, contract negotiation patience, league leaderboards and season award ceremony.");
