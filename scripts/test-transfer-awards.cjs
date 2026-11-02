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
assert.ok(appHtml.includes('"id":"golden-glove","name":"القفاز الذهبي"'),
  "the award catalogue must list Golden Glove for the season award UI");
assert.ok(appHtml.includes('"golden-glove":1200'),
  "winning the Golden Glove must grant the configured in-game reward");
const sandbox = { window: {}, console, Date, Math, Number, String, Array, Object, Set };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "transfer-awards-engine.js" });
const engine = sandbox.window.LWTransferAwards;
assert.ok(engine, "transfer and awards engine must be exported");
assert.equal(engine.version, 5);

// Estimated ages for players without a sourced age must be deterministic and
// advance one year per simulated season instead of jumping randomly each season.
const zeroAppearanceSeason = engine.simulatePlayerSeason({
  name: "لاعب بلا ظهور", clubName: "نادي اختبار", position: "مهاجم",
  ovr: 99, prestige: 100, leagueStrength: 98,
  seasonStats: { season: 4, appearances: 0, goals: 50, assists: 25, averageRating: 9.8 }
}, 4, 1);
assert.equal(zeroAppearanceSeason.appearances, 0);
assert.equal(zeroAppearanceSeason.goals, 0,
  "saved goals must be discarded when a season records zero appearances");
assert.equal(zeroAppearanceSeason.assists, 0,
  "saved assists must be discarded when a season records zero appearances");
assert.equal(zeroAppearanceSeason.averageRating, 0);
assert.equal(zeroAppearanceSeason.score, 0,
  "a zero-appearance season must not earn leaderboard performance points from OVR or league strength");
assert.equal(zeroAppearanceSeason.weightedGoals, 0);

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
  ...sameForward, position: "مهاجم"
}, 3, 1);
const centreStrikerLine = engine.simulatePlayerSeason({
  ...sameForward, position: "رأس حربة"
}, 3, 1);
assert.ok(centreStrikerLine.goals > mobileForwardLine.goals,
  "a high-rated centre striker should produce more goals than an otherwise identical mobile forward");
assert.ok(centreStrikerLine.assists < mobileForwardLine.assists,
  "a mobile forward should produce more assists than an otherwise identical centre striker");

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
