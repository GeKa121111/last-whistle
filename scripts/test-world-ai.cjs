"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const scotlandFixtureSnapshot = {
  schemaVersion: 1, refreshRevision: 3, season: "2026/27", source: "Synthetic Scottish roster fixture for schedule tests",
  leagues: [{
    leagueId: "scotland", country: "اسكتلندا", division: 1, expectedTeams: 12,
    sourceUrl: "https://footballsquads.co.uk/scots/2026-2027/scotsp.htm", sourceSeason: "2026/27",
    clubs: Array.from({ length: 12 }, (_, clubIndex) => ({
      name: "Scotland Test Club " + String(clubIndex + 1).padStart(2, "0"), aliases: [],
      leagueId: "scotland", country: "اسكتلندا", division: 1,
      sourceUrl: "https://footballsquads.co.uk/scots/2026-2027/scotprm/test" + (clubIndex + 1) + ".htm",
      players: Array.from({ length: 16 }, (_, playerIndex) => ({
        name: "Scotland Test Player " + (clubIndex + 1) + "-" + (playerIndex + 1),
        position: playerIndex < 3 ? "حارس مرمى" : playerIndex < 8 ? "قلب دفاع" : playerIndex < 13 ? "وسط مهاجم" : "مهاجم",
        age: 19 + playerIndex % 11, number: playerIndex + 1, nationality: "SCO", isRealPlayer: true
      }))
    }))
  }, {
    leagueId: "scotland", country: "اسكتلندا", division: 2, expectedTeams: 10,
    sourceUrl: "https://footballsquads.co.uk/scots/2026-2027/scotcham.htm", sourceSeason: "2026/27",
    clubs: Array.from({ length: 10 }, (_, clubIndex) => ({
      name: "Scotland Division 2 Test Club " + String(clubIndex + 1).padStart(2, "0"), aliases: [],
      leagueId: "scotland", country: "اسكتلندا", division: 2,
      sourceUrl: "https://footballsquads.co.uk/scots/2026-2027/scotcham/test" + (clubIndex + 1) + ".htm",
      players: Array.from({ length: 16 }, (_, playerIndex) => ({
        name: "Scotland Division 2 Test Player " + (clubIndex + 1) + "-" + (playerIndex + 1),
        position: playerIndex < 3 ? "حارس مرمى" : playerIndex < 8 ? "قلب دفاع" : playerIndex < 13 ? "وسط مهاجم" : "مهاجم",
        age: 19 + playerIndex % 11, number: playerIndex + 1, nationality: "SCO", isRealPlayer: true
      }))
    }))
  }, {
    leagueId: "greece", country: "اليونان", division: 1, expectedTeams: 14,
    sourceUrl: "https://www.slgr.gr/", sourceSeason: "2026/27",
    clubs: Array.from({ length: 14 }, (_, clubIndex) => ({
      name: "Greece Test Club " + String(clubIndex + 1).padStart(2, "0"), aliases: [],
      leagueId: "greece", country: "اليونان", division: 1,
      sourceUrl: "https://www.slgr.gr/test-club-" + (clubIndex + 1),
      players: Array.from({ length: 16 }, (_, playerIndex) => ({
        name: "Greece Test Player " + (clubIndex + 1) + "-" + (playerIndex + 1),
        position: playerIndex < 3 ? "حارس مرمى" : playerIndex < 8 ? "قلب دفاع" : playerIndex < 13 ? "وسط مهاجم" : "مهاجم",
        age: 19 + playerIndex % 11, number: playerIndex + 1, nationality: "GRE", isRealPlayer: true
      }))
    }))
  }]
};
const sandbox = { window: { LWFootballSquadData: scotlandFixtureSnapshot }, console };
vm.createContext(sandbox);
const dbSource = fs.readFileSync(path.join(root, "public", "football-world-db.js"), "utf8");
const aiSource = fs.readFileSync(path.join(root, "public", "football-world-ai.js"), "utf8");
new vm.Script(dbSource, { filename: "public/football-world-db.js" }).runInContext(sandbox);
new vm.Script(aiSource, { filename: "public/football-world-ai.js" }).runInContext(sandbox);
const db = sandbox.window.LWWorldDB;
const ai = sandbox.window.LWWorldAI;
assert.ok(db && ai, "world database and autonomous AI engine must initialize");

const save = {
  season: 1, age: 20, name: "لاعب اختبار", pos: "جناح",
  clubName: "الأهلي", leagueCountry: "مصر", leagueDivision: 1,
  seasonApps: 0, seasonAppsTarget: 34, careerMatchHistory: []
};
const world = ai.ensureState(save, db);
const clubCount = Object.keys(world.clubs).length;
const playerCount = Object.keys(world.players).length;
assert.ok(clubCount >= 50, "the AI world must cover at least 50 clubs");
assert.ok(playerCount >= clubCount * 12, "each club must have a multi-player squad");
assert.equal(world.schemaVersion, ai.version);
assert.equal(ai.ensureState(save, db), world, "loading the same save must preserve its existing world simulation");
assert.equal(Object.keys(world.players).length, playerCount, "reconciliation must not duplicate the saved player database");

// Older saved worlds may still contain Japan/AFC data. Reconciliation must purge it
// while retaining the supported league database and its normal career state.
const legacyClubId = "legacy-japan-club";
const legacyPlayerId = "legacy-japan-player";
world.clubs[legacyClubId] = {
  id: legacyClubId, name: "Legacy Japan Club", leagueId: "japan", division: 1,
  country: "اليابان", roster: [legacyPlayerId]
};
world.players[legacyPlayerId] = {
  id: legacyPlayerId, name: "Legacy Japan Test Player", clubId: legacyClubId,
  leagueId: "japan", country: "اليابان", position: "وسط مهاجم", group: "midfielder"
};
world.matchesBySeason = world.matchesBySeason || {};
world.competitionsBySeason = world.competitionsBySeason || {};
world.seasonStats["0"] = [{ id: legacyPlayerId, leagueId: "japan", goals: 1 }];
world.leagueTables["0"] = { japan: [{ leagueId: "japan", club: "Legacy Japan Club" }] };
world.matchesBySeason["0"] = [{ homeClubId: legacyClubId, awayClubId: "some-supported-club" }];
world.competitionsBySeason["0"] = [{ id: "afc-cl", confederation: "AFC" }];
ai.ensureState(save, db);
assert.equal(world.clubs[legacyClubId], undefined, "clubs from removed continental pathways must be purged from existing saves");
assert.equal(world.players[legacyPlayerId], undefined, "players owned by removed-league clubs must be purged from existing saves");
assert.equal(world.leagueTables["0"].japan, undefined, "stale standings for removed leagues must be purged");
assert.equal(world.seasonStats["0"].length, 0, "stale stats for removed-league players must be purged");
assert.equal(world.matchesBySeason["0"].length, 0, "fixtures involving removed-league clubs must be purged");
assert.equal(world.competitionsBySeason["0"].length, 0, "AFC competition results must be purged from existing saves");


const firstSeason = ai.completeSeason(save, 1, db);
assert.equal(firstSeason.season, 1);
assert.equal(firstSeason.alreadyCompleted, false);
assert.ok(firstSeason.rows.length >= playerCount - 2, "season completion must save statistics for the world player pool");
assert.ok(Object.keys(firstSeason.tables).length >= 8, "world league tables must be simulated for multiple leagues");
assert.ok(world.completedSeasons.includes(1));

// All table totals must reconcile to one shared set of actual simulated fixtures.
const fixtures = world.matchesBySeason && world.matchesBySeason["1"];
assert.ok(Array.isArray(fixtures) && fixtures.length > 20, "a season must persist its shared fixtures");
assert.ok(Array.isArray(world.competitionsBySeason["1"]) && world.competitionsBySeason["1"].length > 0,
  "domestic and continental competitions should have saved simulation results");
const totalFixtureGoals = fixtures.reduce((sum, match) => sum + match.homeGoals + match.awayGoals, 0);
const totalPlayerGoals = world.seasonStats["1"].reduce((sum, row) => sum + Number(row.goals || 0), 0);
assert.equal(totalPlayerGoals, totalFixtureGoals, "player goals must come from the same goals recorded in fixtures");
const allTableRows = Object.values(world.leagueTables["1"]).flat();
assert.equal(allTableRows.reduce((sum, row) => sum + row.gf, 0), totalFixtureGoals,
  "total goals for must equal total fixture goals");
assert.equal(allTableRows.reduce((sum, row) => sum + row.ga, 0), totalFixtureGoals,
  "total goals against must equal total fixture goals");
const fixtureTallies = new Map();
for (const match of fixtures) {
  const homeClub = world.clubs[match.homeClubId], awayClub = world.clubs[match.awayClubId];
  assert.ok(homeClub && awayClub && homeClub.id !== awayClub.id, "each fixture must contain two distinct real clubs");
  const homeKey = match.division === 1 ? homeClub.leagueId : homeClub.leagueId + ":" + match.division;
  const awayKey = match.division === 1 ? awayClub.leagueId : awayClub.leagueId + ":" + match.division;
  assert.equal(homeKey, awayKey, "fixture opponents must belong to the same league and division");
  for (const [club, scored, conceded, key] of [
    [homeClub, match.homeGoals, match.awayGoals, homeKey],
    [awayClub, match.awayGoals, match.homeGoals, awayKey]
  ]) {
    const tallyKey = key + "|" + club.id;
    const tally = fixtureTallies.get(tallyKey) || { played: 0, gf: 0, ga: 0 };
    tally.played++; tally.gf += scored; tally.ga += conceded; fixtureTallies.set(tallyKey, tally);
  }
}
for (const [tableKey, rows] of Object.entries(world.leagueTables["1"])) {
  for (const row of rows) {
    const tally = fixtureTallies.get(tableKey + "|" + row.clubId) || { played: 0, gf: 0, ga: 0 };
    assert.equal(row.played, tally.played, "played count must reconcile for " + row.club);
    assert.equal(row.gf, tally.gf, "goals for must reconcile for " + row.club);
    assert.equal(row.ga, tally.ga, "goals against must reconcile for " + row.club);
    assert.equal(row.gd, row.gf - row.ga, "goal difference must be derived from match scores");
    assert.equal(row.pts, row.w * 3 + row.d + Number(row.pointsAdjustment || 0), "points must reconcile with results and explicit league-format adjustments");
  }
}
// The Scottish Premiership plays 33 matches before splitting into top and bottom six,
// then each half plays five more. The shared saved fixture set must reflect all 38.
const scotlandClubs = Object.values(world.clubs).filter(club => club.leagueId === "scotland" && Number(club.division) === 1);
assert.equal(scotlandClubs.length, 12, "the schedule test must seed all 12 Scottish top-flight clubs");
const scotlandIds = new Set(scotlandClubs.map(club => club.id));
const scotlandFixtures = fixtures.filter(match => scotlandIds.has(match.homeClubId) && scotlandIds.has(match.awayClubId));
assert.equal(scotlandFixtures.length, 228, "12 Scottish clubs must produce exactly 228 league fixtures for 38 games each");
for (const club of scotlandClubs) {
  assert.equal(scotlandFixtures.filter(match => match.homeClubId === club.id || match.awayClubId === club.id).length, 38,
    "each Scottish club must play exactly 38 league matches: " + club.name);
}
const splitRows = new Map(scotlandClubs.map(club => [club.id, { clubId: club.id, club: club.name, power: club.power, pts: 0, gf: 0, ga: 0 }]));
for (const match of scotlandFixtures.filter(row => row.matchday <= 33)) {
  const home = splitRows.get(match.homeClubId), away = splitRows.get(match.awayClubId);
  home.gf += match.homeGoals; home.ga += match.awayGoals;
  away.gf += match.awayGoals; away.ga += match.homeGoals;
  if (match.homeGoals > match.awayGoals) home.pts += 3;
  else if (match.homeGoals < match.awayGoals) away.pts += 3;
  else { home.pts++; away.pts++; }
}
const splitRanked = Array.from(splitRows.values()).map(row => ({ ...row, gd: row.gf - row.ga }))
  .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.power - a.power || a.club.localeCompare(b.club, "ar"));
const scottishTopSix = new Set(splitRanked.slice(0, 6).map(row => row.clubId));
const splitFixtures = scotlandFixtures.filter(match => match.matchday >= 34);
assert.equal(splitFixtures.length, 30, "the final split should contain 30 fixtures across the two six-team groups");
assert.ok(splitFixtures.every(match => scottishTopSix.has(match.homeClubId) === scottishTopSix.has(match.awayClubId)),
  "Scottish split fixtures must not cross between the top six and bottom six");
assert.ok(world.leagueTables["1"].scotland.every(row => row.played === 38), "the saved Scottish table must show 38 games per club");

 // Greece: regular season followed by championship, conference, and play-out groups.
 const greekClubs = Object.values(world.clubs).filter(club => club.leagueId === "greece" && Number(club.division) === 1);
 assert.equal(greekClubs.length, 14, "the Greek Super League must contain all 14 clubs");
 const greekIds = new Set(greekClubs.map(club => club.id));
 const greekFixtures = fixtures.filter(match => greekIds.has(match.homeClubId) && greekIds.has(match.awayClubId));
 assert.equal(greekFixtures.length, 236, "Greek league should contain 182 regular-season plus 54 post-season fixtures");
 const greekRegularFixtures = greekFixtures.filter(match => match.matchday <= 26);
 const greekPostSeasonFixtures = greekFixtures.filter(match => match.matchday > 26);
 assert.equal(greekRegularFixtures.length, 182, "14 clubs should play 13 opponents twice across 26 regular-season matchdays");
 assert.equal(greekPostSeasonFixtures.length, 54, "post-season groups should add 12 + 12 + 30 fixtures");
 const greekRegular = new Map(greekClubs.map(club => [club.id, {
   clubId: club.id, club: club.name, power: club.power, pts: 0, gf: 0, ga: 0
 }]));
 for (const match of greekRegularFixtures) {
   const home = greekRegular.get(match.homeClubId), away = greekRegular.get(match.awayClubId);
   home.gf += match.homeGoals; home.ga += match.awayGoals;
   away.gf += match.awayGoals; away.ga += match.homeGoals;
   if (match.homeGoals > match.awayGoals) home.pts += 3;
   else if (match.homeGoals < match.awayGoals) away.pts += 3;
   else { home.pts++; away.pts++; }
 }
 const greekRanked = Array.from(greekRegular.values()).map(row => ({ ...row, gd: row.gf - row.ga }))
   .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.power - a.power || a.club.localeCompare(b.club, "ar"));
 const greekGroupByClub = new Map();
 greekRanked.forEach((row, index) => greekGroupByClub.set(row.clubId,
   index < 4 ? "championship" : index < 8 ? "conference" : "playout"));
 const greekTable = new Map((world.leagueTables["1"].greece || []).map(row => [row.clubId, row]));
 assert.equal(greekTable.size, 14, "Greek final table must retain all clubs");
 for (const club of greekClubs) {
   const row = greekTable.get(club.id);
   const expectedGroup = greekGroupByClub.get(club.id);
   assert.equal(row.postSeasonGroup, expectedGroup, "club must remain in its regular-season-ranked post-season group: " + club.name);
   assert.equal(row.regularSeasonPoints, greekRegular.get(club.id).pts, "regular-season points must be archived before post-season adjustments");
   assert.equal(row.pointsAdjustment, expectedGroup === "conference" ? Math.ceil(row.regularSeasonPoints / 2) - row.regularSeasonPoints : 0,
     "only the 5th-8th group halves regular-season points, rounded up");
   const clubFixtures = greekFixtures.filter(match => match.homeClubId === club.id || match.awayClubId === club.id);
   assert.equal(clubFixtures.filter(match => match.matchday <= 26).length, 26, "every Greek club plays 26 regular-season matches");
   assert.equal(clubFixtures.length, expectedGroup === "playout" ? 36 : 32,
     "Greek post-season group format determines the final match count for " + club.name);
 }
 assert.ok(greekPostSeasonFixtures.every(match => {
   const homeGroup = greekGroupByClub.get(match.homeClubId);
   return homeGroup === greekGroupByClub.get(match.awayClubId)
     && ((match.matchday >= 27 && match.matchday <= 32 && homeGroup !== "playout")
       || (match.matchday >= 27 && match.matchday <= 36 && homeGroup === "playout"));
 }), "post-season fixtures must stay inside the correct group and matchday window");
 assert.equal(greekTable.get(greekRanked[0].clubId).rank, 1, "the championship-group leader should be ranked first");
 assert.ok((world.leagueTables["1"].greece || []).slice(0, 4).every(row => row.postSeasonGroup === "championship"));
 assert.ok((world.leagueTables["1"].greece || []).slice(4, 8).every(row => row.postSeasonGroup === "conference"));
 assert.ok((world.leagueTables["1"].greece || []).slice(8, 14).every(row => row.postSeasonGroup === "playout"));

const duplicateCompletion = ai.completeSeason(save, 1, db);
assert.equal(duplicateCompletion.alreadyCompleted, true, "the same global season cannot be recorded twice");
assert.equal(world.seasonStats["1"].length, firstSeason.rows.length, "idempotent season completion must not duplicate stat rows");

const halfSeasonRows = ai.getSeasonLines(save, 1, 0.5, db);
assert.ok(halfSeasonRows.length > 0);
assert.ok(halfSeasonRows.every(row => Number.isFinite(row.goals) && Number.isFinite(row.assists)
  && Number.isFinite(row.appearances) && row.season === 1), "season lines must have coherent numeric stats");
const egyptLeaders = ai.leaderboard(save, { season: 1, progress: 1, country: "مصر", leagueId: "egypt", division: 1 }, db);
assert.ok(egyptLeaders.length > 0, "persistent stats must feed league leaderboards");
assert.ok(egyptLeaders.some(row => row.goals > 0 || row.assists > 0), "the simulation should generate real statistical variation");
const table = ai.getLeagueTable(save, "egypt", 1, db);
assert.ok(table.length >= 3, "league table must include the available clubs for the selected league");
assert.equal(table[0].rank, 1);
assert.ok(table.every((row, index) => row.rank === index + 1 && row.played > 0 && Number.isFinite(row.pts)));

const oldTransferCount = world.transfers.length;
const totalClubBudgetBeforeWindow = Object.values(world.clubs)
  .reduce((sum, club) => sum + (Number(club.budget) || 0), 0);
const transition = ai.advanceToSeason(save, 2, db);
assert.equal(transition.season, 2);
assert.equal(transition.alreadyAdvanced, false);
assert.ok(world.completedSeasons.includes(1));
assert.equal(world.currentSeason, 2);
assert.equal(save.season, 1, "global simulation must not mutate the player's career-season counter");
assert.ok(Array.isArray(transition.moves));
const expectedSeasonalIncome = Object.values(world.clubs).reduce((sum, club) =>
  sum + Math.round(50 + (Number(club.power) || 55) * 1.8 + (Number(club.prestige) || 50) * 0.7), 0);
const totalClubBudgetAfterWindow = Object.values(world.clubs)
  .reduce((sum, club) => sum + (Number(club.budget) || 0), 0);
assert.equal(totalClubBudgetAfterWindow, totalClubBudgetBeforeWindow + expectedSeasonalIncome,
  "club budgets must preserve transfer fees as cash flows and include the modeled seasonal income");
assert.ok(transition.moves.length > 0, "a global market window should generate suitable moves when clubs have recruitment needs");
assert.equal(world.transfers.length, oldTransferCount + transition.moves.length);
assert.ok(world.marketReports.some(row => row.season === 2 && row.moves === transition.moves.length));
assert.ok(Array.isArray(world.promotionHistory), "promotion/relegation history must be persisted");
const promotionMoves = transition.promotions || [];
assert.ok(promotionMoves.length > 0, "the two-division test world should produce promotion/relegation moves");
for (const move of promotionMoves) {
  const promotedClub = Object.values(world.clubs).find(club => club.leagueId === move.leagueId && club.name === move.promoted);
  const relegatedClub = Object.values(world.clubs).find(club => club.leagueId === move.leagueId && club.name === move.relegated);
  assert.ok(promotedClub && relegatedClub, "promotion history must refer to clubs that remain in the world");
  assert.equal(promotedClub.division, 1, "promoted club must stay in division 1 after the season transition: " + move.promoted);
  assert.equal(relegatedClub.division, 2, "relegated club must stay in division 2 after the season transition: " + move.relegated);
}
ai.ensureState(save, db);
for (const move of promotionMoves) {
  const promotedClub = Object.values(world.clubs).find(club => club.leagueId === move.leagueId && club.name === move.promoted);
  const relegatedClub = Object.values(world.clubs).find(club => club.leagueId === move.leagueId && club.name === move.relegated);
  assert.equal(promotedClub.division, 1, "world reload must preserve promotion for " + move.promoted);
  assert.equal(relegatedClub.division, 2, "world reload must preserve relegation for " + move.relegated);
}
assert.ok(Object.values(world.players).some(player => player.freeAgent)
  || transition.moves.some(move => String(move.kind).includes("حر")),
  "expired contracts must create free agents and/or free-agent signings");
assert.ok(Object.values(world.players).some(player => Number(player.contractSeasons) > 0),
  "renewed and newly signed contracts must have a positive remaining term");
for (const move of transition.moves) {
  assert.ok(move.player && move.from && move.to && move.from !== move.to);
  assert.ok(move.playerOvr >= 35 && move.playerOvr <= 99);
  assert.ok(move.fee >= 0);
  if (move.fee === 0) assert.ok(String(move.kind).includes("حر"), "zero-fee deals must be free-agent signings");
  assert.ok(move.reason);
  const player = world.players[move.playerId];
  assert.ok(player, "every transfer must map to a persistent player record");
  assert.equal(world.clubs[player.clubId].name, move.to, "the player's new club must be changed in the active world");
}

 // A transfer must not rewrite the season that just ended; next-season stats must
 // follow the player's new club. Check the actual persistent rows, not just the log.
 const previousSeasonSnapshot = JSON.stringify(world.seasonStats["1"] || []);
 const previousSeasonRows = new Map((world.seasonStats["1"] || []).map(row => [row.id, { ...row }]));
 const nextSeasonRows = new Map(ai.getSeasonLines(save, 2, 1, db).map(row => [row.id, row]));
 // Regression: domestic supercups must use the previous season's domestic champions,
// while continental supercups must use their exact qualifying competitions.
const priorCompetitions = world.competitionsBySeason["1"] || [];
const currentCompetitions = world.competitionsBySeason["2"] || [];
const currentCompetitionById = new Map(currentCompetitions.map(row => [row.id, row]));
const domesticSupercups = db.simulationCupDefinitions().filter(row =>
  row && row.kind === "supercup" && Array.isArray(row.countries) && row.countries.length);
assert.ok(domesticSupercups.length >= 10, "domestic supercup definitions must exist across the supported football world");
for (const definition of domesticSupercups) {
  const leagueId = definition.countries[0];
  const previousTable = (world.leagueTables["1"] || {})[leagueId] || [];
  // This AI test uses a compact synthetic squad snapshot. Only assert competitions for
  // leagues represented by at least two playable clubs in that fixture.
  if (previousTable.length < 2) continue;
  const result = currentCompetitionById.get(definition.id);
  assert.ok(result, "season 2 should include domestic supercup when the league is simulated: " + definition.id);
  assert.equal(result.participants.length, 2, "domestic supercup must contain exactly two distinct teams: " + definition.id);
  assert.equal(new Set(result.participants).size, 2, "domestic supercup participants must not be duplicated: " + definition.id);
  const participantClubs = result.participants.map(id => world.clubs[id]);
  assert.ok(participantClubs.every(club => club && club.leagueId === leagueId),
    "domestic supercup must not accidentally invite continental winners from another league: " + definition.id);
  assert.ok(previousTable.length > 1, "previous-season league table must be available for " + leagueId);
  assert.ok(result.participants.includes(previousTable[0].clubId),
    "domestic league champion must qualify for " + definition.id);
  const priorCup = priorCompetitions.find(row => row && row.kind === "domestic-cup" && row.championId
    && (world.clubs[row.championId] || {}).leagueId === leagueId);
  if (priorCup && priorCup.championId !== previousTable[0].clubId) {
    assert.ok(result.participants.includes(priorCup.championId),
      "domestic cup champion must qualify for " + definition.id);
  } else if (priorCup) {
    assert.ok(result.participants.includes(priorCup.runnerUpId) || result.participants.includes(previousTable[1].clubId),
      "a league/cup double winner must be paired with a runner-up in " + definition.id);
  }
}
const uefaSuperCup = currentCompetitionById.get("uefa-super-cup");
const previousUcl = priorCompetitions.find(row => row && row.id === "ucl");
const previousUel = priorCompetitions.find(row => row && row.id === "uel");
assert.ok(uefaSuperCup && previousUcl && previousUel, "UEFA Super Cup and its qualifying competitions must be simulated");
assert.ok(uefaSuperCup.participants.includes(previousUcl.championId), "UEFA Super Cup must include the Champions League winner");
assert.ok(uefaSuperCup.participants.includes(previousUel.championId)
  || (previousUcl.championId === previousUel.championId && uefaSuperCup.participants.includes(previousUel.runnerUpId)),
  "UEFA Super Cup must use the Europa League winner, or its runner-up if a simulated double winner occurs");
const cafSuperCup = currentCompetitionById.get("caf-super-cup");
const previousCafCl = priorCompetitions.find(row => row && row.id === "caf-cl");
const previousCafConfed = priorCompetitions.find(row => row && row.id === "caf-confed");
assert.ok(cafSuperCup && previousCafCl && previousCafConfed, "CAF Super Cup and its qualifying competitions must be simulated");
assert.ok(cafSuperCup.participants.includes(previousCafCl.championId), "CAF Super Cup must include the CAF Champions League winner");
assert.ok(cafSuperCup.participants.includes(previousCafConfed.championId)
  || (previousCafCl.championId === previousCafConfed.championId && cafSuperCup.participants.includes(previousCafConfed.runnerUpId)),
  "CAF Super Cup must use the Confederation Cup winner, or its runner-up if a simulated double winner occurs");

assert.equal(JSON.stringify(world.seasonStats["1"] || []), previousSeasonSnapshot,
   "simulating season 2 must not rewrite season 1 player-stat attribution");
 const regularTransfers = transition.moves.filter(move => String(move.kind).includes("انتقال — محاكاة"));
 assert.ok(regularTransfers.length > 0, "the test scenario must contain ordinary club-to-club transfers");
 for (const move of regularTransfers) {
   const previousRow = previousSeasonRows.get(move.playerId);
   assert.ok(previousRow, "the player's completed-season row must survive the transfer: " + move.player);
   assert.equal(previousRow.club, move.from,
     "season 1 stats must remain attributed to the selling club for " + move.player);
   const player = world.players[move.playerId];
   const destination = world.clubs[player.clubId];
   assert.ok(destination, "transferred player must have a valid destination club");
   assert.equal(destination.name, move.to, "transfer log and current player club must agree");
   const history = world.playerHistory[move.playerId] || [];
   assert.ok(history.length > 0, "every transfer must create persistent player history");
   assert.equal(history[0].type, "transfer-in", "the newest history event must describe the completed transfer");
   assert.equal(history[0].season, move.season);
   assert.equal(history[0].from, move.from);
   assert.equal(history[0].club, move.to);
   const nextRow = nextSeasonRows.get(move.playerId);
   assert.ok(nextRow, "the transferred player must have a row in the following season: " + move.player);
   assert.equal(nextRow.club, move.to,
     "season 2 stats must be attributed to the receiving club for " + move.player);
   assert.equal(nextRow.clubId, destination.id);
 }
const rosterOwner = new Map();
for (const club of Object.values(world.clubs)) {
  assert.ok(club.roster.length >= 16 && club.roster.length <= 18, "club squads must remain inside the intended size band");
  for (const playerId of club.roster) {
    assert.ok(!rosterOwner.has(playerId), "a player cannot belong to two clubs at the same time");
    rosterOwner.set(playerId, club.id);
    assert.equal(world.players[playerId].clubId, club.id, "roster membership and player club must agree");
  }
}
const freeAgentPlayers = Object.values(world.players).filter(player => player.freeAgent);
assert.equal(rosterOwner.size + freeAgentPlayers.length, Object.keys(world.players).length,
  "every world player must belong to exactly one club or be explicitly marked as a free agent");
for (const player of Object.values(world.players)) {
  if (player.freeAgent) assert.equal(player.clubId, "", "free agents must not retain an active club");
  else assert.equal(rosterOwner.get(player.id), player.clubId, "every contracted player must match a roster owner");
}

const transferTargets = ai.transferTargets(save, db);
assert.ok(transferTargets.length >= clubCount);
assert.ok(transferTargets.some(row => row.players.length >= 16), "the market should expose current simulated squads, not only static club names");
const completedSeasonSnapshotBeforeDashboard = JSON.stringify(world.seasonStats["1"] || []);
const dashboard = ai.dashboard(save, db);
assert.equal(dashboard.season, world.currentSeason,
  "world dashboard must follow its persisted world season rather than a stale player-career season");
assert.equal(JSON.stringify(world.seasonStats["1"] || []), completedSeasonSnapshotBeforeDashboard,
  "opening the dashboard must not rewrite a completed season with players' current clubs");
assert.equal(dashboard.matchesSimulated, (world.matchesBySeason[String(world.currentSeason)] || []).length,
  "dashboard match count must come from the current world season");
assert.equal(dashboard.playerCount, Object.keys(world.players).length, "recruitment can introduce academy replacements and the dashboard must count them");
assert.equal(dashboard.totalTransfers, world.transfers.length);
assert.ok(dashboard.lastMarket.moves > 0);
const duplicateAdvance = ai.advanceToSeason(save, 2, db);
assert.equal(duplicateAdvance.alreadyAdvanced, true, "the same season transition must be idempotent");
assert.equal(duplicateAdvance.moves.length, 0);
assert.equal(world.transfers.length, oldTransferCount + transition.moves.length, "reopening the same market must not duplicate deals");

// LocalStorage round-trip must preserve transfer logs, player history, and both
// season snapshots. Re-opening the same season after reload must remain idempotent.
const reloadedSave = JSON.parse(JSON.stringify(save));
const reloadedWorld = ai.ensureState(reloadedSave, db);
for (const season of ["1", "2"]) {
  const rows = reloadedWorld.seasonStats[season] || [];
  const seenIds = new Set();
  const duplicateIds = new Set();
  for (const row of rows) {
    if (seenIds.has(row.id)) duplicateIds.add(row.id);
    seenIds.add(row.id);
  }
  assert.equal(duplicateIds.size, 0,
    "each player must have exactly one saved season-stat row; duplicate ids in season " + season + ": "
      + Array.from(duplicateIds).slice(0, 5).join(", "));
}
assert.equal(reloadedWorld.transfers.length, world.transfers.length,
  "transfer history must survive JSON save/reload");
assert.equal(JSON.stringify(reloadedWorld.completedSeasons), JSON.stringify(world.completedSeasons),
  "completed-season markers must survive JSON save/reload");
assert.equal(JSON.stringify(reloadedWorld.seasonStats["1"]), JSON.stringify(world.seasonStats["1"]),
  "season 1 rows must remain unchanged after JSON save/reload");
assert.equal(JSON.stringify(reloadedWorld.seasonStats["2"]), JSON.stringify(world.seasonStats["2"]),
  "season 2 rows must remain unchanged after JSON save/reload");
for (const move of regularTransfers) {
  assert.equal(reloadedWorld.players[move.playerId].clubId, world.players[move.playerId].clubId,
    "current club must survive JSON save/reload for " + move.player);
  assert.equal(JSON.stringify(reloadedWorld.playerHistory[move.playerId]),
    JSON.stringify(world.playerHistory[move.playerId]),
    "player transfer history must survive JSON save/reload for " + move.player);
  assert.equal(reloadedWorld.seasonStats["1"].find(row => row.id === move.playerId).club, move.from,
    "previous-season attribution must survive JSON save/reload for " + move.player);
  assert.equal(reloadedWorld.seasonStats["2"].find(row => row.id === move.playerId).club, move.to,
    "next-season attribution must survive JSON save/reload for " + move.player);
}
// Player nationality and continental award origin must survive transfer to another confederation.
const originSave = {
  season: 1, age: 22, name: "Origin Confed Test", pos: "جناح",
  clubName: "الأهلي", leagueCountry: "مصر", leagueDivision: 1,
  seasonApps: 0, seasonAppsTarget: 34, careerMatchHistory: []
};
const originWorld = ai.ensureState(originSave, db);
const migrant = Object.values(originWorld.players).find(player =>
  !player.isGenerated && player.clubId && (originWorld.clubs[player.clubId] || {}).confederation === "CAF");
assert.ok(migrant, "a real CAF-club player must be present in the simulated world");
migrant.originConfederation = "CAF";
migrant.nationality = migrant.nationality || "EGY";
const sourceClub = originWorld.clubs[migrant.clubId];
const destinationClub = Object.values(originWorld.clubs).find(club =>
  club.leagueId === "spain" && Number(club.division) === 1 && club.roster.length < 18);
assert.ok(sourceClub && destinationClub && sourceClub.id !== destinationClub.id,
  "the origin-confederation regression must have source and destination clubs in different confederations");
sourceClub.roster = sourceClub.roster.filter(id => id !== migrant.id);
destinationClub.roster.push(migrant.id);
migrant.clubId = destinationClub.id;
migrant.country = destinationClub.country;
migrant.leagueId = destinationClub.leagueId;
migrant.division = destinationClub.division;
const originSeason = ai.completeSeason(originSave, 1, db);
const migrantSeasonRow = originSeason.rows.find(row => row.id === migrant.id);
assert.ok(migrantSeasonRow, "a transferred player must still receive a season row");
assert.equal(migrantSeasonRow.confederation, "UEFA", "current competition confederation must follow the new club");
assert.equal(migrantSeasonRow.originConfederation, "CAF", "continental origin must survive a transfer and support CAF awards");
assert.equal(migrantSeasonRow.nationality, migrant.nationality, "the world simulation must retain sourced player nationality metadata");

const reloadedRepeat = ai.advanceToSeason(reloadedSave, 2, db);
assert.equal(reloadedRepeat.alreadyAdvanced, true,
  "replaying a market transition after reload must not create a second market");
assert.equal(reloadedWorld.transfers.length, world.transfers.length,
  "reloading and replaying the same season must not duplicate transfer deals");

// The promotion/relegation guard must be keyed to the target season, not the source
// season; otherwise the second transition (season 3) is skipped forever.
const promotionHistoryBeforeSeason3 = world.promotionHistory.length;
const thirdSeasonTransition = ai.advanceToSeason(save, 3, db);
assert.equal(thirdSeasonTransition.season, 3);
assert.equal(thirdSeasonTransition.alreadyAdvanced, false);
assert.ok(thirdSeasonTransition.promotions && thirdSeasonTransition.promotions.length > 0,
  "promotion and relegation must be evaluated again for season 3");
assert.ok(world.promotionHistory.some(row => Number(row.season) === 3),
  "season 3 promotion history must be recorded under its target season");
const promotionHistoryAfterSeason3 = world.promotionHistory.length;
assert.ok(promotionHistoryAfterSeason3 >= promotionHistoryBeforeSeason3);
const thirdSeasonReplay = ai.advanceToSeason(save, 3, db);
assert.equal(thirdSeasonReplay.alreadyAdvanced, true, "repeating season 3 must be idempotent");
assert.equal(world.promotionHistory.length, promotionHistoryAfterSeason3,
  "replaying the same target season must not duplicate promotion history");


console.log("PASS: persistent football world has " + clubCount + " clubs and " + playerCount
  + " players; " + transition.moves.length + " needs-based AI transfers; season stats, tables, and one-time progression all reconcile.");
