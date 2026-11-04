"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const worldDbSource = fs.readFileSync(path.join(root, "public", "football-world-db.js"), "utf8");
const summaryStart = html.indexOf("function cupLegResultSummary(result,opponent,isTwoLegSecondLeg=false){");
const summaryEnd = html.indexOf("\nfunction playCupMatchUnsafe()", summaryStart);
assert.ok(summaryStart >= 0 && summaryEnd > summaryStart, "cup result summary helper must exist");
const summarySource = html.slice(summaryStart, summaryEnd) + "\nthis.cupLegResultSummary = cupLegResultSummary;";
assert.ok(html.includes("cupLegResultSummary(result,opponent,isTwoLegTie&&tieLegAtKickoff===2)"),
  "the cup flow must explain the actual leg result and aggregate result separately");
const titleStart = html.indexOf("function hasPreviousSeasonClubTitle(names) {");
const titleEnd = html.indexOf("\nfunction competitionLockReason", titleStart);
assert.ok(titleStart >= 0 && titleEnd > titleStart,
  "supercup qualification identity helper must exist");
const titleSource = html.slice(titleStart, titleEnd)
  + "\nthis.hasPreviousSeasonClubTitle = hasPreviousSeasonClubTitle;";
assert.ok(html.includes("hasPreviousSeasonClubTitle(qualifierNames)"),
  "supercup eligibility must use the club-and-country-aware title identity helper");
const titleSandbox = {
  state: { season: 6, leagueCountry: "Spain", cupHistory: [] },
  clubNameForLeague: () => "United FC"
};
vm.createContext(titleSandbox);
vm.runInContext(titleSource, titleSandbox, { filename: "supercup-club-country-identity" });
const foreignCountryTitle = [
  { name: "Copa del Rey", season: 5, club: "United FC", country: "England", champion: true }
];
titleSandbox.state.cupHistory = foreignCountryTitle;
assert.equal(titleSandbox.hasPreviousSeasonClubTitle(["Copa del Rey"]), false,
  "a same-named club's English cup win must not qualify its Spanish club for a supercup");
assert.deepEqual(titleSandbox.state.cupHistory, foreignCountryTitle,
  "rejecting an ambiguous qualification must not mutate legacy cup history");
titleSandbox.state.cupHistory = [
  { name: "Copa del Rey", season: 5, club: "United FC", champion: true }
];
assert.equal(titleSandbox.hasPreviousSeasonClubTitle(["Copa del Rey"]), false,
  "a legacy trophy row without country metadata must not grant supercup qualification");
titleSandbox.state.cupHistory = [
  { name: "Copa del Rey", season: 5, country: "Spain", champion: true }
];
assert.equal(titleSandbox.hasPreviousSeasonClubTitle(["Copa del Rey"]), false,
  "a legacy trophy row without club identity must not grant supercup qualification");
titleSandbox.state.cupHistory = [
  { name: "Copa del Rey", season: 5, club: "United FC", country: "Spain", champion: true }
];
assert.equal(titleSandbox.hasPreviousSeasonClubTitle(["Copa del Rey"]), true,
  "the exact club, country, and season champion must retain supercup qualification");
assert.equal(titleSandbox.hasPreviousSeasonClubTitle(["FA Cup"]), false,
  "a different competition must not grant supercup qualification");

const worldHelperStart = html.indexOf("function hasWorldClubCupTitle(currentClub,season){");
const worldHelperEnd = html.indexOf("\nfunction competitionLockReason", worldHelperStart);
const lockStart = html.indexOf("function competitionLockReason(comp) {", worldHelperStart);
const lockEnd = html.indexOf("\n\n\nconst LEGACY_REAL_PLAYERS", lockStart);
const supercupStart = html.indexOf("function supercupParticipants(comp,currentClub){");
const start = html.indexOf("function cupParticipants(comp,count){");
const end = html.indexOf("\nfunction cupConfig", start);
assert.ok(worldHelperStart >= 0 && worldHelperEnd > worldHelperStart && lockStart > worldHelperEnd
  && lockEnd > lockStart && supercupStart > lockEnd && start > supercupStart && end > start,
  "world-cup, supercup, and cup participant builders must exist");
const source = html.slice(worldHelperStart, worldHelperEnd) + "\n" + html.slice(lockStart, lockEnd)
  + "\nthis.competitionLockReason = competitionLockReason;"
  + "\n" + html.slice(supercupStart, start) + "\n" + html.slice(start, end)
  + "\nthis.cupParticipants = cupParticipants;";
assert.ok(!source.includes("نادي مشارك"), "cup generation must not invent placeholder clubs");
assert.ok(html.includes('<script src="./football-world-db.js?v=9"></script>'), "world database script must be cache-busted when its public API changes");
assert.ok(html.includes('if(teams.length<cfg.teams){toast("بيانات الأندية الحقيقية المتاحة لا تكفي لإطلاق البطولة. لم تتم إضافة أندية وهمية.");return;}'),
  "a cup must be blocked rather than started with fabricated participants");

const rosterLists = {
  "مصر": { 1: ["النادي الحالي", "فريق محلي 1"], 2: ["فريق محلي 2"] },
  "إنجلترا": { 1: ["فريق إنجليزي"], 2: [] }
};
const sandbox = {
  window: {},
  state: { season: 2, leagueCountry: "مصر", leagueDivision: 1, cupHistory: [], previousSeasonRank: null, worldSimulation: null },
  LEAGUE_ROSTERS: rosterLists,
  clubNameForLeague: () => "النادي الحالي",
  console
};
sandbox.previousSeasonLeagueRank = () => Number(sandbox.state.previousSeasonRank) || null;
sandbox.hasPreviousSeasonClubTitle = () => false;
vm.createContext(sandbox);
vm.runInContext(worldDbSource, sandbox, { filename: "football-world-db.js" });
const db = sandbox.window.LWWorldDB;
assert.ok(db && typeof db.clubs === "function", "real world club database must be available");
const worldClubs = db.clubNames();
assert.ok(worldClubs.every(club => club && club.name && !Object.prototype.hasOwnProperty.call(club, "players")),
  "the cup selector must use lightweight club metadata without generating or copying player lists");
assert.ok(worldClubs.length >= 32, "the world database must provide enough real clubs for supported cups");
vm.runInContext(source, sandbox, { filename: "cup-participants" });
vm.runInContext(summarySource, sandbox, { filename: "cup-leg-result-summary" });
const aggregateDraw = sandbox.cupLegResultSummary({
  score: { for: 0, against: 0 }, matchOutcome: "تعادل", outcome: "فوز",
  metadata: { aggregateOffset: 1 }, shootout: { used: false }
}, "المنافس", true);
assert.match(aggregateDraw.legText, /تعادلت 0-0/, "a drawn second leg must be described as a draw");
assert.match(aggregateDraw.aggregateText, /لصالحك/, "aggregate progression should be described separately");
const lostTieDespiteWinningLeg = sandbox.cupLegResultSummary({
  score: { for: 2, against: 0 }, matchOutcome: "فوز", outcome: "خسارة",
  metadata: { aggregateOffset: -3 }, shootout: { used: false }
}, "المنافس", true);
assert.match(lostTieDespiteWinningLeg.legText, /فزت 2-0/, "the actual second-leg win must be preserved in the narrative");
assert.match(lostTieDespiteWinningLeg.aggregateText, /لصالح المنافس/, "the aggregate loss must be explicit when the player wins the leg but is eliminated");


const count = 32;
const currentClub = "النادي الحالي";
const cupTeam = "فريق الكأس";
const worldOnly = worldClubs.find(club => club && club.name
  && ![currentClub, cupTeam, "فريق محلي 1", "فريق محلي 2", "فريق إنجليزي"].includes(club.name));
assert.ok(worldOnly, "world database should contain a real club beyond the local fixture");
const participants = Array.from(sandbox.cupParticipants({ teams: [currentClub, cupTeam] }, count));
assert.equal(participants.length, count, "a cup should be filled from real clubs to its configured size");
assert.equal(participants[0], currentClub, "the player's club must remain the first participant");
assert.ok(participants.includes(cupTeam), "official competition participants must be retained");
assert.ok(participants.includes("فريق محلي 1"), "local league clubs must remain eligible");
assert.ok(participants.includes(worldOnly.name), "the real world club database must fill missing participants");
assert.equal(new Set(participants).size, participants.length, "cup participants must be unique");
assert.ok(!participants.some(name => /^نادي مشارك \d+$/.test(name)), "no placeholder club may enter the cup");

const englandProfile = db.leagueById("england");
const spainProfile = db.leagueById("spain");
const englishCurrent = worldClubs.find(club => club && club.leagueId === "england" && Number(club.division || 1) === 1);
const spanishCurrent = worldClubs.find(club => club && club.leagueId === "spain" && Number(club.division || 1) === 1);
assert.ok(englandProfile && spainProfile && englishCurrent && spanishCurrent,
  "scoped cup tests need sourced English and Spanish club metadata");
const scopedRosters = {
  "إنجلترا": { 1: ["أرسنال", "ليفربول"], 2: ["كوفنتري سيتي"] },
  "إسبانيا": { 1: ["ريال مدريد", "برشلونة"], 2: ["ديبورتيفو لاكورونيا"] },
  "مصر": { 1: ["الأهلي", "الزمالك"], 2: ["نادي مصري 2"] }
};
function scopedCupSandbox(country, clubName) {
  const context = {
    window: { LWWorldDB: db },
    state: { season: 2, leagueCountry: country, leagueDivision: 1, cupHistory: [], previousSeasonRank: null, worldSimulation: null },
    LEAGUE_ROSTERS: scopedRosters,
    clubNameForLeague: () => clubName
  };
  context.previousSeasonLeagueRank = () => Number(context.state.previousSeasonRank) || null;
  context.hasPreviousSeasonClubTitle = names => {
    const previousSeason = (Number(context.state.season) || 1) - 1;
    if (previousSeason < 1) return false;
    const currentClub = String(context.clubNameForLeague() || "").trim();
    const currentCountry = String(context.state.leagueCountry || "").trim();
    if (!currentClub || !currentCountry) return false;
    const wanted = Array.isArray(names) ? names : [];
    return context.state.cupHistory.some(row =>
      row && row.champion === true && Number(row.season) === previousSeason && wanted.includes(row.name) &&
      String(row.club || "").trim() === currentClub && String(row.country || "").trim() === currentCountry
    );
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "cup-participants-scoped" });
  return context;
}
const domesticSandbox = scopedCupSandbox(englandProfile.country, englishCurrent.name);
const domesticLower = Array.from(domesticSandbox.cupParticipants({
  kind: "domestic-cup", countries: ["england"], lower: true, teams: ["أرسنال"]
}, 12));
const englishNames = new Set([
  ...scopedRosters["إنجلترا"][1],
  ...scopedRosters["إنجلترا"][2],
  ...worldClubs.filter(club => club && club.leagueId === "england").map(club => club.name)
]);
assert.ok(domesticLower.every(name => name === englishCurrent.name || englishNames.has(name)),
  "a domestic cup must not import clubs from another country");
assert.ok(domesticLower.includes("كوفنتري سيتي"),
  "a domestic cup marked lower must include its configured second-division pool");
assert.ok(!domesticLower.includes("الأهلي"),
  "a domestic English cup must exclude Egyptian clubs even when they exist in the world database");
const domesticTopFlight = Array.from(domesticSandbox.cupParticipants({
  kind: "domestic-cup", countries: ["england"], lower: false, teams: []
}, 12));
assert.ok(!domesticTopFlight.includes("كوفنتري سيتي"),
  "a domestic cup without lower-division eligibility must exclude second-division clubs");
assert.ok(domesticTopFlight.every(name => name === englishCurrent.name || !worldClubs.some(club =>
  club && club.name === name && club.leagueId === "england" && Number(club.division || 1) > 1)),
  "top-flight-only domestic cups must not import second-division world clubs");

const continentalSandbox = scopedCupSandbox(spainProfile.country, spanishCurrent.name);
const europeanParticipants = Array.from(continentalSandbox.cupParticipants({
  kind: "continental", confederation: "UEFA", teams: []
}, 36));
const europeanRosterNames = Object.entries(scopedRosters)
  .filter(([country]) => db.leagueByCountry(country)?.confederation === "UEFA")
  .flatMap(([, divisions]) => divisions[1] || []);
const europeanDatabaseNames = worldClubs
  .filter(club => club && db.leagueById(club.leagueId)?.confederation === "UEFA"
    && Number(club.division || 1) === 1)
  .map(club => club.name);
const europeanNames = new Set([...europeanRosterNames, ...europeanDatabaseNames]);
assert.ok(europeanParticipants.every(name => name === spanishCurrent.name || europeanNames.has(name)),
  "continental cups must only draw first-division clubs from their own confederation");
assert.ok(!europeanParticipants.includes("الأهلي"),
  "a UEFA competition must not import CAF clubs");
assert.ok(!europeanParticipants.includes("كوفنتري سيتي"),
  "continental qualification pools must not import second-division clubs");

const globalSandbox = scopedCupSandbox(spainProfile.country, spanishCurrent.name);
const globalParticipants = Array.from(globalSandbox.cupParticipants({ kind: "world", teams: [] }, 100));
assert.ok(globalParticipants.includes("الأهلي") && globalParticipants.includes("كوفنتري سيتي"),
  "world competitions must retain the global first- and second-division candidate pool");

const supercupWorld = {
  clubs: {
    arsenal: { id: "arsenal", name: "أرسنال", leagueId: "england", country: "إنجلترا" },
    chelsea: { id: "chelsea", name: "تشيلسي", leagueId: "england", country: "إنجلترا" },
    liverpool: { id: "liverpool", name: "ليفربول", leagueId: "england", country: "إنجلترا" },
    madrid: { id: "madrid", name: "ريال مدريد", leagueId: "spain", country: "إسبانيا" },
    sevilla: { id: "sevilla", name: "إشبيلية", leagueId: "spain", country: "إسبانيا" },
    ahly: { id: "ahly", name: "الأهلي", leagueId: "egypt", country: "مصر" },
    berkane: { id: "berkane", name: "نهضة بركان", leagueId: "morocco", country: "المغرب" }
  },
  leagueTables: {
    "1": {
      england: [
        { clubId: "arsenal", rank: 1 },
        { clubId: "liverpool", rank: 2 }
      ]
    }
  },
  competitionsBySeason: {
    "1": [
      { kind: "domestic-cup", name: "FA Cup", championId: "chelsea", runnerUpId: "liverpool" },
      { kind: "continental", name: "UEFA Champions League", confederation: "UEFA", championId: "madrid", runnerUpId: "arsenal" },
      { kind: "continental", name: "UEFA Europa League", confederation: "UEFA", championId: "sevilla", runnerUpId: "liverpool" },
      { kind: "continental", name: "CAF Champions League", confederation: "CAF", championId: "ahly", runnerUpId: "berkane" },
      { kind: "continental", name: "CAF Confederation Cup", confederation: "CAF", championId: "berkane", runnerUpId: "ahly" }
    ]
  }
};
const leagueChampionSandbox = scopedCupSandbox("إنجلترا", "أرسنال");
leagueChampionSandbox.state.worldSimulation = supercupWorld;
leagueChampionSandbox.state.previousSeasonRank = 1;
assert.deepEqual(Array.from(leagueChampionSandbox.cupParticipants({
  id: "community-shield", kind: "supercup", countries: ["england"], teams: ["مانشستر سيتي"]
}, 2)), ["أرسنال", "تشيلسي"],
  "a league champion must face the previous-season domestic cup winner, not a static seed");

const cupWinnerSandbox = scopedCupSandbox("إنجلترا", "تشيلسي");
cupWinnerSandbox.state.worldSimulation = supercupWorld;
cupWinnerSandbox.state.previousSeasonRank = 2;
cupWinnerSandbox.state.cupHistory = [
  { name: "FA Cup", season: 1, champion: true, club: "تشيلسي", country: "إنجلترا" }
];
assert.deepEqual(Array.from(cupWinnerSandbox.cupParticipants({
  id: "community-shield", kind: "supercup", countries: ["england"], teams: ["مانشستر سيتي"]
}, 2)), ["تشيلسي", "أرسنال"],
  "a domestic cup winner must face the previous-season league champion");

const doubleWinnerSandbox = scopedCupSandbox("إنجلترا", "أرسنال");
doubleWinnerSandbox.state.worldSimulation = supercupWorld;
doubleWinnerSandbox.state.previousSeasonRank = 1;
doubleWinnerSandbox.state.cupHistory = [
  { name: "FA Cup", season: 1, champion: true, club: "أرسنال", country: "إنجلترا" }
];
assert.deepEqual(Array.from(doubleWinnerSandbox.cupParticipants({
  id: "community-shield", kind: "supercup", countries: ["england"], teams: ["مانشستر سيتي"]
}, 2)), ["أرسنال", "ليفربول"],
  "when one club wins both domestic titles, the runner-up must fill the second supercup place");

const uefaSandbox = scopedCupSandbox("إسبانيا", "ريال مدريد");
uefaSandbox.state.worldSimulation = supercupWorld;
uefaSandbox.state.cupHistory = [
  { name: "UEFA Champions League", season: 1, champion: true, club: "ريال مدريد", country: "إسبانيا" }
];
assert.deepEqual(Array.from(uefaSandbox.cupParticipants({
  id: "uefa-super-cup", kind: "supercup", confederation: "UEFA", teams: ["باريس سان جيرمان"]
}, 2)), ["ريال مدريد", "إشبيلية"],
  "the UEFA Super Cup must pair the UCL winner with the Europa League winner");

const cafSandbox = scopedCupSandbox("مصر", "الأهلي");
cafSandbox.state.worldSimulation = supercupWorld;
cafSandbox.state.cupHistory = [
  { name: "CAF Champions League", season: 1, champion: true, club: "الأهلي", country: "مصر" }
];
assert.deepEqual(Array.from(cafSandbox.cupParticipants({
  id: "caf-super-cup", kind: "supercup", confederation: "CAF", teams: ["الزمالك"]
}, 2)), ["الأهلي", "نهضة بركان"],
  "the CAF Super Cup must pair the Champions League winner with the Confederation Cup winner");

const communityShield = { id: "community-shield", kind: "supercup", countries: ["england"] };
const nonDoubleRunnerUp = scopedCupSandbox("إنجلترا", "ليفربول");
nonDoubleRunnerUp.state.careerStarted = true;
nonDoubleRunnerUp.state.previousSeasonRank = 2;
nonDoubleRunnerUp.state.worldSimulation = supercupWorld;
assert.match(nonDoubleRunnerUp.competitionLockReason(communityShield), /السوبر بطولة مشروطة/,
  "a cup runner-up must not qualify when the league champion and cup champion are different clubs");
assert.equal(Array.from(nonDoubleRunnerUp.cupParticipants(communityShield, 2)).length, 0,
  "a non-qualified domestic supercup club must not be inserted into a fallback global participant pool");

const doubleDomesticWorld = JSON.parse(JSON.stringify(supercupWorld));
doubleDomesticWorld.competitionsBySeason["1"][0].championId = "arsenal";
doubleDomesticWorld.competitionsBySeason["1"][0].runnerUpId = "liverpool";
const domesticRunnerUp = scopedCupSandbox("إنجلترا", "ليفربول");
domesticRunnerUp.state.careerStarted = true;
domesticRunnerUp.state.previousSeasonRank = 2;
domesticRunnerUp.state.worldSimulation = doubleDomesticWorld;
assert.equal(domesticRunnerUp.competitionLockReason(communityShield), "",
  "the domestic cup runner-up must qualify when the league champion also won the cup");
assert.deepEqual(Array.from(domesticRunnerUp.cupParticipants(communityShield, 2)), ["ليفربول", "أرسنال"],
  "the domestic runner-up must face the league-and-cup double winner");

const missingDomesticCupWorld = JSON.parse(JSON.stringify(supercupWorld));
missingDomesticCupWorld.competitionsBySeason["1"] = missingDomesticCupWorld.competitionsBySeason["1"]
  .filter(row => row.kind !== "domestic-cup");
const missingDomesticCup = scopedCupSandbox("إنجلترا", "أرسنال");
missingDomesticCup.state.careerStarted = true;
missingDomesticCup.state.previousSeasonRank = 1;
missingDomesticCup.state.worldSimulation = missingDomesticCupWorld;
missingDomesticCup.state.cupHistory = [
  { name: "FA Cup", season: 1, champion: true, club: "أرسنال", country: "إنجلترا" }
];
assert.match(missingDomesticCup.competitionLockReason(communityShield), /بيانات التأهل للسوبر المحلي غير مكتملة/,
  "a local title and league rank must not fabricate a supercup when the world simulation has no verified domestic-cup result");
assert.equal(Array.from(missingDomesticCup.cupParticipants(communityShield, 2)).length, 0,
  "a domestic supercup without both primary qualifiers must have no participants");

const secondaryCupWorld = JSON.parse(JSON.stringify(supercupWorld));
const otherSeasonResults = secondaryCupWorld.competitionsBySeason["1"]
  .filter(row => row.kind !== "domestic-cup");
secondaryCupWorld.competitionsBySeason["1"] = [
  { id: "primary-fa-cup", kind: "domestic-cup", name: "FA Cup", leagueId: "england", championId: "arsenal", runnerUpId: "liverpool" },
  { id: "secondary-league-cup", kind: "domestic-cup", name: "League Cup", leagueId: "england", championId: "chelsea", runnerUpId: "liverpool" },
  ...otherSeasonResults
];
const secondaryCupWinner = scopedCupSandbox("إنجلترا", "تشيلسي");
secondaryCupWinner.state.careerStarted = true;
secondaryCupWinner.state.previousSeasonRank = 3;
secondaryCupWinner.state.worldSimulation = secondaryCupWorld;
secondaryCupWinner.state.cupHistory = [
  { name: "League Cup", season: 1, champion: true, club: "تشيلسي", country: "إنجلترا" }
];
assert.match(secondaryCupWinner.competitionLockReason(communityShield), /السوبر بطولة مشروطة/,
  "winning a secondary domestic cup must not replace the configured primary supercup qualifier");
assert.equal(Array.from(secondaryCupWinner.cupParticipants(communityShield, 2)).length, 0,
  "a secondary cup winner must not be inserted into the primary domestic supercup");

const invalidLeadingRowWorld = JSON.parse(JSON.stringify(doubleDomesticWorld));
invalidLeadingRowWorld.clubs.foreign = {
  id: "foreign", name: "نادي أجنبي", leagueId: "spain", country: "إسبانيا", division: 1
};
invalidLeadingRowWorld.leagueTables["1"].england = [
  { clubId: "foreign", rank: 1, leagueId: "england", division: 1 },
  { clubId: "arsenal", rank: 1, leagueId: "england", division: 1 },
  { clubId: "liverpool", rank: 2, leagueId: "england", division: 1 }
];
const validatedRunnerUp = scopedCupSandbox("إنجلترا", "ليفربول");
validatedRunnerUp.state.careerStarted = true;
validatedRunnerUp.state.previousSeasonRank = 2;
validatedRunnerUp.state.worldSimulation = invalidLeadingRowWorld;
assert.equal(validatedRunnerUp.competitionLockReason(communityShield), "",
  "a stale foreign rank-one row must be skipped when a valid domestic champion row exists");
assert.deepEqual(Array.from(validatedRunnerUp.cupParticipants(communityShield, 2)), ["ليفربول", "أرسنال"],
  "domestic supercup participants must use the validated league champion, not a foreign table row");

const invalidOnlyWorld = JSON.parse(JSON.stringify(doubleDomesticWorld));
invalidOnlyWorld.competitionsBySeason["1"][0].championId = "chelsea";
invalidOnlyWorld.competitionsBySeason["1"][0].runnerUpId = "liverpool";
invalidOnlyWorld.clubs.foreign = invalidLeadingRowWorld.clubs.foreign;
invalidOnlyWorld.leagueTables["1"].england = [
  { clubId: "foreign", rank: 1, leagueId: "england", division: 1 },
  { clubId: "liverpool", rank: 2, leagueId: "england", division: 1 }
];
const invalidTableRunnerUp = scopedCupSandbox("إنجلترا", "ليفربول");
invalidTableRunnerUp.state.careerStarted = true;
invalidTableRunnerUp.state.previousSeasonRank = 2;
invalidTableRunnerUp.state.worldSimulation = invalidOnlyWorld;
assert.match(invalidTableRunnerUp.competitionLockReason(communityShield), /بيانات التأهل للسوبر المحلي غير مكتملة/,
  "a foreign club cannot satisfy the domestic league-champion requirement when no valid rank-one club exists");
const cupWinnerWithInvalidTable = scopedCupSandbox("إنجلترا", "تشيلسي");
cupWinnerWithInvalidTable.state.worldSimulation = invalidOnlyWorld;
assert.equal(Array.from(cupWinnerWithInvalidTable.cupParticipants(communityShield, 2)).length, 0,
  "a domestic supercup must not be generated when the league-table champion is invalid");

const wrongLeagueCupRowWorld = JSON.parse(JSON.stringify(doubleDomesticWorld));
wrongLeagueCupRowWorld.competitionsBySeason["1"][0].leagueId = "spain";
const wrongLeagueCupRowRunnerUp = scopedCupSandbox("إنجلترا", "ليفربول");
wrongLeagueCupRowRunnerUp.state.careerStarted = true;
wrongLeagueCupRowRunnerUp.state.previousSeasonRank = 2;
wrongLeagueCupRowRunnerUp.state.worldSimulation = wrongLeagueCupRowWorld;
assert.match(wrongLeagueCupRowRunnerUp.competitionLockReason(communityShield), /بيانات التأهل للسوبر المحلي غير مكتملة/,
  "a domestic cup result carrying a different league ID must not qualify its runner-up");

const foreignCupRunnerUpWorld = JSON.parse(JSON.stringify(doubleDomesticWorld));
foreignCupRunnerUpWorld.clubs.foreign = invalidLeadingRowWorld.clubs.foreign;
foreignCupRunnerUpWorld.competitionsBySeason["1"][0].runnerUpId = "foreign";
const fallbackLeagueRunnerUp = scopedCupSandbox("إنجلترا", "ليفربول");
fallbackLeagueRunnerUp.state.careerStarted = true;
fallbackLeagueRunnerUp.state.previousSeasonRank = 2;
fallbackLeagueRunnerUp.state.worldSimulation = foreignCupRunnerUpWorld;
assert.equal(fallbackLeagueRunnerUp.competitionLockReason(communityShield), "",
  "the verified league runner-up must qualify when the cup runner-up belongs to another league");
assert.deepEqual(Array.from(fallbackLeagueRunnerUp.cupParticipants(communityShield, 2)), ["ليفربول", "أرسنال"],
  "a foreign cup runner-up must be replaced by the valid same-league runner-up");

const doubleContinentalWorld = JSON.parse(JSON.stringify(supercupWorld));
const europaResult = doubleContinentalWorld.competitionsBySeason["1"]
  .find(row => row.name === "UEFA Europa League");
europaResult.championId = "madrid";
europaResult.runnerUpId = "liverpool";
const continentalRunnerUp = scopedCupSandbox("إنجلترا", "ليفربول");
continentalRunnerUp.state.careerStarted = true;
continentalRunnerUp.state.previousSeasonRank = 2;
continentalRunnerUp.state.worldSimulation = doubleContinentalWorld;
const uefaSuperCup = { id: "uefa-super-cup", kind: "supercup", confederation: "UEFA" };
assert.equal(continentalRunnerUp.competitionLockReason(uefaSuperCup), "",
  "a continental runner-up must qualify when the same club won both supercup feeder competitions");
assert.deepEqual(Array.from(continentalRunnerUp.cupParticipants(uefaSuperCup, 2)), ["ليفربول", "ريال مدريد"],
  "the continental runner-up must face the shared Champions League and Europa League winner");

const continentalNonQualifier = scopedCupSandbox("إنجلترا", "ليفربول");
continentalNonQualifier.state.careerStarted = true;
continentalNonQualifier.state.previousSeasonRank = 2;
continentalNonQualifier.state.worldSimulation = supercupWorld;
assert.match(continentalNonQualifier.competitionLockReason(uefaSuperCup), /السوبر بطولة مشروطة/,
  "a continental club without a qualifying title or valid double-winner runner-up place must remain locked");
assert.equal(Array.from(continentalNonQualifier.cupParticipants(uefaSuperCup, 2)).length, 0,
  "a non-qualified continental club must not receive an arbitrary supercup opponent");

const wrongConfederationChampionWorld = JSON.parse(JSON.stringify(supercupWorld));
wrongConfederationChampionWorld.clubs.sevilla.confederation = "CAF";
const wrongConfederationChampion = scopedCupSandbox("إسبانيا", "ريال مدريد");
wrongConfederationChampion.state.worldSimulation = wrongConfederationChampionWorld;
wrongConfederationChampion.state.cupHistory = [
  { name: "UEFA Champions League", season: 1, champion: true, club: "ريال مدريد", country: "إسبانيا" }
];
assert.match(wrongConfederationChampion.competitionLockReason(uefaSuperCup), /السوبر بطولة مشروطة/,
  "a continental supercup must remain locked when one of its primary winners belongs to another confederation");
assert.equal(Array.from(wrongConfederationChampion.cupParticipants(uefaSuperCup, 2)).length, 0,
  "a continental supercup must not substitute a runner-up from the wrong confederation");

const missingEuropaWorld = JSON.parse(JSON.stringify(supercupWorld));
missingEuropaWorld.competitionsBySeason["1"] = missingEuropaWorld.competitionsBySeason["1"]
  .filter(row => row.name !== "UEFA Europa League");
const missingEuropaWinner = scopedCupSandbox("إسبانيا", "ريال مدريد");
missingEuropaWinner.state.careerStarted = true;
missingEuropaWinner.state.worldSimulation = missingEuropaWorld;
missingEuropaWinner.state.cupHistory = [
  { name: "UEFA Champions League", season: 1, champion: true, club: "ريال مدريد", country: "إسبانيا" }
];
assert.match(missingEuropaWinner.competitionLockReason(uefaSuperCup), /السوبر بطولة مشروطة/,
  "a continental supercup must require both primary competition results");
assert.equal(Array.from(missingEuropaWinner.cupParticipants(uefaSuperCup, 2)).length, 0,
  "a missing Europa League result must not be replaced with the Champions League runner-up");

const wrongConfederationClub = scopedCupSandbox("مصر", "الأهلي");
wrongConfederationClub.state.careerStarted = true;
wrongConfederationClub.state.previousSeasonRank = 1;
assert.match(wrongConfederationClub.competitionLockReason({
  id: "ucl", kind: "continental", confederation: "UEFA", qualificationPlaces: [1, 2, 3, 4]
}), /اتحاد قاري مختلف/,
  "a CAF club must not qualify for a UEFA competition by matching the rank range");

const wrongConfederationSuperCup = scopedCupSandbox("إنجلترا", "أرسنال");
wrongConfederationSuperCup.state.careerStarted = true;
wrongConfederationSuperCup.state.previousSeasonRank = 1;
assert.match(wrongConfederationSuperCup.competitionLockReason({
  id: "caf-super-cup", kind: "supercup", confederation: "CAF"
}), /اتحاد قاري مختلف/,
  "a UEFA club must not enter the CAF Super Cup");

const worldCupDefinition = db.simulationCupDefinitions().find(item =>
  item && item.kind === "world" && item.system === "world32");
assert.ok(worldCupDefinition, "the world database must expose the 32-team club world cup definition");
const worldCupClubs = {};
const worldCupIds = Array.from({ length: 32 }, (_, index) => {
  const id = "qualified-" + (index + 1);
  worldCupClubs[id] = {
    id, name: "نادي متأهل " + (index + 1), leagueId: "england", country: "إنجلترا"
  };
  return id;
});
worldCupClubs.arsenal = { id: "arsenal", name: "أرسنال", leagueId: "england", country: "إنجلترا" };
worldCupClubs.liverpool = { id: "liverpool", name: "ليفربول", leagueId: "england", country: "إنجلترا" };
const worldCupWorld = {
  clubs: worldCupClubs,
  competitionsBySeason: {
    "5": [{ id: worldCupDefinition.id, kind: "world", participants: worldCupIds }]
  }
};
const worldCupSandbox = scopedCupSandbox("إنجلترا", "أرسنال");
worldCupSandbox.state.careerStarted = true;
worldCupSandbox.state.season = 5;
worldCupSandbox.state.worldSimulation = worldCupWorld;
worldCupSandbox.state.cupHistory = [
  { name: "UEFA Champions League", season: 4, champion: true, club: "أرسنال", country: "إنجلترا" }
];
const worldCupParticipants = Array.from(worldCupSandbox.cupParticipants(worldCupDefinition, 32));
assert.equal(worldCupParticipants.length, 32,
  "the club world cup must use the complete 32-club field from the world simulation");
assert.equal(worldCupParticipants[0], "أرسنال",
  "a current club that won a top-tier continental title in the four-season cycle must be inserted");
assert.ok(!worldCupParticipants.includes("نادي متأهل 32"),
  "inserting a locally qualified club must replace, not expand, the 32-team field");
assert.equal(worldCupSandbox.competitionLockReason(worldCupDefinition), "",
  "a top-tier continental champion in the qualification cycle must be allowed into the club world cup");

const worldCupNonQualifier = scopedCupSandbox("إنجلترا", "ليفربول");
worldCupNonQualifier.state.careerStarted = true;
worldCupNonQualifier.state.season = 5;
worldCupNonQualifier.state.worldSimulation = worldCupWorld;
assert.match(worldCupNonQualifier.competitionLockReason(worldCupDefinition), /مش ضمن قائمة الـ32/,
  "a club outside the world simulation field without a local continental title must remain locked");
worldCupNonQualifier.state.season = 6;
assert.match(worldCupNonQualifier.competitionLockReason(worldCupDefinition), /كل أربع مواسم/,
  "the club world cup must not be available in non-cycle seasons");
assert.equal(Array.from(worldCupNonQualifier.cupParticipants(worldCupDefinition, 32)).length, 0,
  "a non-cycle season must not fall back to an arbitrary global club pool");

const incompleteWorld = JSON.parse(JSON.stringify(worldCupWorld));
incompleteWorld.competitionsBySeason["5"][0].participants = worldCupIds.slice(0, 31);
worldCupNonQualifier.state.season = 5;
worldCupNonQualifier.state.worldSimulation = incompleteWorld;
assert.match(worldCupNonQualifier.competitionLockReason(worldCupDefinition), /غير مكتملة/,
  "an incomplete world-simulation field must block the tournament instead of fabricating teams");
assert.equal(Array.from(worldCupNonQualifier.cupParticipants(worldCupDefinition, 32)).length, 0,
  "an incomplete world-simulation field must not be padded with arbitrary clubs");

const sparse = {
  window: { LWWorldDB: { clubNames: () => [] } },
  state: { leagueCountry: "مصر" },
  LEAGUE_ROSTERS: { "مصر": { 1: [currentClub, "نادي حقيقي 2"], 2: [] } },
  clubNameForLeague: () => currentClub
};
vm.createContext(sparse);
vm.runInContext(source, sparse, { filename: "cup-participants-sparse" });
const sparseParticipants = Array.from(sparse.cupParticipants({ teams: [currentClub, "نادي حقيقي 3"] }, 10));
assert.deepEqual(sparseParticipants, [currentClub, "نادي حقيقي 3", "نادي حقيقي 2"],
  "if source data is insufficient, return only real clubs and let startCup block the tournament");
console.log("PASS: cup participants use real world clubs, preserve configured teams, and never fabricate placeholder clubs.");
