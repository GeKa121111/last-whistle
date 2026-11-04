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
assert.ok(html.includes("hasPreviousSeasonClubTitle(winners[comp.id] || [])"),
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

const start = html.indexOf("function cupParticipants(comp,count){");
const end = html.indexOf("\nfunction cupConfig", start);
assert.ok(start >= 0 && end > start, "cup participant builder must exist");
const source = html.slice(start, end) + "\nthis.cupParticipants = cupParticipants;";
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
  state: { leagueCountry: "مصر" },
  LEAGUE_ROSTERS: rosterLists,
  clubNameForLeague: () => "النادي الحالي",
  console
};
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
    state: { leagueCountry: country },
    LEAGUE_ROSTERS: scopedRosters,
    clubNameForLeague: () => clubName
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
