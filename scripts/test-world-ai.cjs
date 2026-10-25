"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const sandbox = { window: {}, console };
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
    assert.equal(row.pts, row.w * 3 + row.d, "points must be derived from results");
  }
}
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
const transition = ai.advanceToSeason(save, 2, db);
assert.equal(transition.season, 2);
assert.equal(transition.alreadyAdvanced, false);
assert.ok(world.completedSeasons.includes(1));
assert.equal(world.currentSeason, 2);
assert.ok(Array.isArray(transition.moves));
assert.ok(transition.moves.length > 0, "a global market window should generate suitable moves when clubs have recruitment needs");
assert.equal(world.transfers.length, oldTransferCount + transition.moves.length);
assert.ok(world.marketReports.some(row => row.season === 2 && row.moves === transition.moves.length));
assert.ok(Array.isArray(world.promotionHistory), "promotion/relegation history must be persisted");
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
 const previousSeasonRows = new Map((world.seasonStats["1"] || []).map(row => [row.id, row]));
 const nextSeasonRows = new Map(ai.getSeasonLines(save, 2, 1, db).map(row => [row.id, row]));
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
const dashboard = ai.dashboard(save, db);
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
const reloadedRepeat = ai.advanceToSeason(reloadedSave, 2, db);
assert.equal(reloadedRepeat.alreadyAdvanced, true,
  "replaying a market transition after reload must not create a second market");
assert.equal(reloadedWorld.transfers.length, world.transfers.length,
  "reloading and replaying the same season must not duplicate transfer deals");

console.log("PASS: persistent football world has " + clubCount + " clubs and " + playerCount
  + " players; " + transition.moves.length + " needs-based AI transfers; season stats, tables, and one-time progression all reconcile.");
