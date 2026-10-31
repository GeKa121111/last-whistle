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
        name: clubIndex === 1 && playerIndex === 0 ? "Scotland Test Player 1-1" : "Scotland Test Player " + (clubIndex + 1) + "-" + (playerIndex + 1),
        position: playerIndex < 3 ? "حارس مرمى" : playerIndex < 8 ? "قلب دفاع" : playerIndex < 13 ? "وسط مهاجم" : "مهاجم",
        age: 19 + playerIndex % 11, number: playerIndex + 1, nationality: "SCO", isRealPlayer: true
      }))
    }))
  }]
};
const sandbox = { window: { LWFootballSquadData: scotlandFixtureSnapshot }, console };
vm.createContext(sandbox);
const dbSource = fs.readFileSync(path.join(root, "public", "football-world-db.js"), "utf8");
const aiSourceRaw = fs.readFileSync(path.join(root, "public", "football-world-ai.js"), "utf8");
const rootAiSource = fs.readFileSync(path.join(root, "football-world-ai.js"), "utf8");
assert.equal(aiSourceRaw, rootAiSource, "root and public world AI engines must remain synchronized");
assert.ok(aiSourceRaw.includes('if (p === "st" || p === "f" || p === "striker"'),
  "centre-striker classification must not include CF, which is the mobile-forward role");
assert.ok(aiSourceRaw.includes('if (p.includes("مهاجم") || p === "cf" || p === "ss" || p === "fw"'),
  "CF must use the mobile-forward production profile");

const lineupMarker = "  function makeLineup(world, club) {";
assert.ok(aiSourceRaw.includes(lineupMarker), "AI engine must retain the lineup builder for the regression guard");
const advanceMarker = "  function advanceToSeason(save, nextSeason, db) {";
assert.ok(aiSourceRaw.includes(advanceMarker), "AI engine must retain the season-advance entry point for the contract regression guard");
const promotionMarker = "  function applyPromotionRelegation(world, season) {";
const reconcileMarker = "  function reconcileDatabase(world, db) {";
const transferMarker = "  function runTransferWindow(world, season) {";
const freeAgentMarker = "  function signFreeAgents(world, season, existingMoves) {";
const fillRosterMarker = "  function fillRoster(world, club) {";
const baseSeasonLinesMarker = "  function getSeasonLines(save, season, progress = 1, db) {";
const baseCompleteSeasonMarker = "  function completeSeason(save, season, db) {";
const buildPlayerRowsMarker = "  function buildPlayerRows(world, season, accumulators) {";
const projectionCacheMarker = "  function getProjectedSeasonRows(world, targetSeason) {";
assert.ok(aiSourceRaw.includes(promotionMarker), "AI engine must retain the promotion/relegation entry point for the season-history regression guard");
assert.ok(aiSourceRaw.includes(reconcileMarker), "AI engine must retain reconciliation for the division-persistence regression guard");
assert.ok(aiSourceRaw.includes(transferMarker), "AI engine must retain the transfer-window entry point for all-division market coverage");
assert.ok(aiSourceRaw.includes(freeAgentMarker), "AI engine must retain the free-agent entry point for all-division market coverage");
assert.ok(aiSourceRaw.includes(fillRosterMarker), "AI engine must retain the roster filler for roster-integrity regression coverage");
assert.ok(aiSourceRaw.includes(baseSeasonLinesMarker), "AI engine must retain projected season lines for retired-player regression coverage");
assert.ok(aiSourceRaw.includes(baseCompleteSeasonMarker), "AI engine must retain the legacy season completion path for retired-player regression coverage");
assert.ok(aiSourceRaw.includes(buildPlayerRowsMarker), "AI engine must retain the shared season row builder for retired-player regression coverage");
assert.ok(aiSourceRaw.includes(projectionCacheMarker), "AI engine must retain cached projection generation for performance regression coverage");
const aiSource = aiSourceRaw
  .replace(lineupMarker, lineupMarker + `
    global.__lwLineupBuildsByClub = global.__lwLineupBuildsByClub || {};
    global.__lwLineupBuildsByClub[club.id] = (global.__lwLineupBuildsByClub[club.id] || 0) + 1;`)
  .replace(advanceMarker, "  global.__lwTestDevelopPlayers = developPlayers;\n" + advanceMarker)
  .replace(promotionMarker, "  global.__lwTestApplyPromotionRelegation = applyPromotionRelegation;\n" + promotionMarker)
  .replace(reconcileMarker, "  global.__lwTestReconcileDatabase = reconcileDatabase;\n" + reconcileMarker)
  .replace(transferMarker, "  global.__lwTestRunTransferWindow = runTransferWindow;\n" + transferMarker)
  .replace(freeAgentMarker, "  global.__lwTestSignFreeAgents = signFreeAgents;\n" + freeAgentMarker)
  .replace(fillRosterMarker, "  global.__lwTestFillRoster = fillRoster;\n" + fillRosterMarker)
  .replace(baseSeasonLinesMarker, "  global.__lwTestBaseGetSeasonLines = getSeasonLines;\n" + baseSeasonLinesMarker)
  .replace(baseCompleteSeasonMarker, "  global.__lwTestBaseCompleteSeason = completeSeason;\n" + baseCompleteSeasonMarker)
  .replace(buildPlayerRowsMarker, "  global.__lwTestBuildPlayerRows = buildPlayerRows;\n" + buildPlayerRowsMarker)
  .replace(projectionCacheMarker, projectionCacheMarker)
  .replace("    if (!cached.rows.has(targetSeason)) {", "    if (!cached.rows.has(targetSeason)) {\n      global.__lwSeasonProjectionBuilds = (global.__lwSeasonProjectionBuilds || 0) + 1;");
new vm.Script(dbSource, { filename: "public/football-world-db.js" }).runInContext(sandbox);
new vm.Script(aiSource, { filename: "public/football-world-ai.js" }).runInContext(sandbox);
const db = sandbox.window.LWWorldDB;
const ai = sandbox.window.LWWorldAI;
assert.ok(db && ai, "world database and autonomous AI engine must initialize");

// Transfer-market competition labels must follow the simulated club's current division.
// AI world clubs keep their dynamic division, while leagueFor supplies the matching
// first/second-tier competition name after relegation or promotion.
const transferCompetitionSave = { season: 1 };
const transferCompetitionWorld = ai.ensureState(transferCompetitionSave, db);
const transferCompetitionSeed = db.clubs().find(club =>
  Number(club.division) === 1 && typeof db.leagueFor(club.country, 2) === "object");
assert.ok(transferCompetitionSeed, "the sourced club database must include a first-division club with a second-tier profile");
const transferCompetitionWorldClub = transferCompetitionWorld.clubs[
  ai.clubKey(transferCompetitionSeed.name, transferCompetitionSeed.country)
];
assert.ok(transferCompetitionWorldClub, "the sourced club must exist in the simulated football world");
transferCompetitionWorldClub.division = 2;
const secondTierProfile = db.leagueFor(transferCompetitionSeed.country, 2);
const secondTierTarget = ai.transferTargets(transferCompetitionSave, db).find(target =>
  target.club === transferCompetitionSeed.name && target.country === transferCompetitionSeed.country);
assert.equal(secondTierTarget.division, 2, "the transfer target must preserve the simulated second-tier division");
assert.equal(secondTierTarget.league, secondTierProfile.name,
  "a relegated club must advertise the second-tier competition instead of its seed-time first-tier league");
assert.equal(secondTierTarget.leagueEnglish, secondTierProfile.englishName,
  "the English competition label must also follow the current division");
transferCompetitionWorldClub.division = 1;
const firstTierTarget = ai.transferTargets(transferCompetitionSave, db).find(target =>
  target.club === transferCompetitionSeed.name && target.country === transferCompetitionSeed.country);
assert.equal(firstTierTarget.league, db.leagueFor(transferCompetitionSeed.country, 1).name,
  "a promoted club must return to the first-tier competition label without rewriting its roster");

// Transfer windows must include lower divisions and schedule buyers fairly by division.
assert.equal(typeof sandbox.window.__lwTestRunTransferWindow, "function", "the world transfer-window simulator must be available to the regression guard");
assert.equal(typeof sandbox.window.__lwTestSignFreeAgents, "function", "the free-agent signing simulator must be available to the regression guard");
assert.equal(typeof sandbox.window.__lwTestFillRoster, "function", "the roster filler must be available to the regression guard");
assert.equal(typeof sandbox.window.__lwTestBaseGetSeasonLines, "function", "projected season lines must be available to the regression guard");
assert.equal(typeof sandbox.window.__lwTestBaseCompleteSeason, "function", "legacy season completion must be available to the regression guard");
assert.equal(typeof sandbox.window.__lwTestBuildPlayerRows, "function", "shared season rows must be available to the regression guard");
 
 // Retired players keep their old season record but never receive rows in a later season.
 const retiredSeasonSave = { season: 2 };
 const retiredSeasonWorld = ai.ensureState(retiredSeasonSave, db);
 const retiredSeasonPlayer = Object.values(retiredSeasonWorld.players)[0];
 const retiredSeasonPlayerId = retiredSeasonPlayer.id;
 const retiredSeasonClub = retiredSeasonWorld.clubs[retiredSeasonPlayer.clubId];
 retiredSeasonClub.roster = retiredSeasonClub.roster.filter(id => id !== retiredSeasonPlayerId);
 retiredSeasonPlayer.previousClubId = retiredSeasonPlayer.clubId;
 retiredSeasonPlayer.clubId = "";
 retiredSeasonPlayer.leagueId = "";
 retiredSeasonPlayer.division = 0;
 retiredSeasonPlayer.freeAgent = false;
 retiredSeasonPlayer.retired = true;
 retiredSeasonWorld.seasonStats["1"] = [{
   id: retiredSeasonPlayerId, season: 1, name: retiredSeasonPlayer.name,
   appearances: 28, goals: 9, assists: 4, averageRating: 7.1
 }];
 const projectedSeasonRows = sandbox.window.__lwTestBaseGetSeasonLines(retiredSeasonSave, 2, 1, db);
 assert.ok(!projectedSeasonRows.some(row => row.id === retiredSeasonPlayerId),
   "retired players must be omitted from unfinished-season projections");
 const legacyCompletedSeason = sandbox.window.__lwTestBaseCompleteSeason(retiredSeasonSave, 2, db);
 assert.ok(!legacyCompletedSeason.rows.some(row => row.id === retiredSeasonPlayerId),
   "legacy season completion must not generate new rows for retired players");
 const sharedSeasonRows = sandbox.window.__lwTestBuildPlayerRows(retiredSeasonWorld, 2, new Map());
 assert.ok(!sharedSeasonRows.some(row => row.id === retiredSeasonPlayerId),
   "shared match-based season rows must exclude retired players");
 assert.ok(retiredSeasonWorld.seasonStats["1"].some(row => row.id === retiredSeasonPlayerId && row.goals === 9),
   "excluding future rows must preserve the player's previous season statistics");

function makeMarketTestClub(world, id, division, deficitGroup) {
  const counts = { goalkeeper: 2, defender: 5, midfielder: 5, attacker: 4 };
  if (deficitGroup) { counts[deficitGroup]--; if (deficitGroup === "defender") counts.attacker++; }
  const positions = { goalkeeper: "حارس مرمى", defender: "قلب دفاع", midfielder: "وسط", attacker: "مهاجم" };
  const club = { id, name: id, country: "Testland", leagueId: "test-market", division, power: division === 1 ? 67 : 65, basePower: division === 1 ? 67 : 65, prestige: 60, budget: 1200, currency: "€", roster: [], updatedSeason: 1 };
  world.clubs[id] = club;
  for (const [group, count] of Object.entries(counts)) {
    for (let index = 0; index < count; index++) {
      const listed = !deficitGroup && group === "defender" && index === 0;
      const playerId = id + "-" + group + "-" + index;
      world.players[playerId] = { id: playerId, name: playerId, clubId: id, country: club.country, leagueId: club.leagueId, division, position: positions[group], group, ovr: listed ? 79 : 64, potential: listed ? 97 : 68, age: listed ? 30 : 25, prestige: club.prestige, contractSeasons: 3, freeAgent: false, isGenerated: false, isRealPlayer: true, transferListed: false };
      club.roster.push(playerId);
    }
  }
  return club;
}
const transferWorld = { clubs: {}, players: {}, transfers: [], marketReports: [], playerHistory: {}, notes: [], nextGeneratedPlayer: 1, dbVersion: 0, transferSequence: 0 };
makeMarketTestClub(transferWorld, "D1 Seller A", 1, null);
makeMarketTestClub(transferWorld, "D1 Seller B", 1, null);
makeMarketTestClub(transferWorld, "D2 Buyer A", 2, "defender");
makeMarketTestClub(transferWorld, "D2 Buyer B", 2, "defender");
// Keep seller caps below the high-value test transfer so the accounting assertion exercises the old bug.
transferWorld.clubs["D1 Seller A"].power = transferWorld.clubs["D1 Seller A"].basePower = 50;
transferWorld.clubs["D1 Seller B"].power = transferWorld.clubs["D1 Seller B"].basePower = 50;
const marketBudgetBefore = Object.fromEntries(Object.values(transferWorld.clubs).map(club => [club.id, {
  budget: Number(club.budget), power: Number(club.power), prestige: Number(club.prestige)
}]));
const expectedSeasonBudget = clubId => {
  const snapshot = marketBudgetBefore[clubId];
  const budgetBase = Math.max(40, Math.round(70 + (snapshot.power || 55) * 9 + (snapshot.prestige || 50) * 2.2));
  const carriedBudget = Math.min(snapshot.budget, budgetBase * 2);
  return Math.round(Math.min(budgetBase * 2, carriedBudget + Math.max(1, Math.round(budgetBase * 0.25))));
};
const simulatedTransfers = sandbox.window.__lwTestRunTransferWindow(transferWorld, 3);
assert.ok(simulatedTransfers.length > 0, "lower-division clubs with a role deficit must have access to the world transfer market");
assert.ok(simulatedTransfers.some(move => move.to === "D2 Buyer A" || move.to === "D2 Buyer B"), "the transfer buyer order must not starve second-tier clubs behind first-tier buyers");
const budgetedTransfer = simulatedTransfers[0];
const budgetBuyer = Object.values(transferWorld.clubs).find(club => club.name === budgetedTransfer.to);
const budgetSeller = Object.values(transferWorld.clubs).find(club => club.name === budgetedTransfer.from);
assert.ok(budgetBuyer && budgetSeller, "the transfer must identify its actual buyer and seller");
assert.equal(budgetBuyer.budget, Math.max(0, expectedSeasonBudget(budgetBuyer.id) - budgetedTransfer.fee),
  "the buyer must retain the transfer-fee deduction in its persisted cash balance");
assert.ok(budgetedTransfer.fee > Math.round(marketBudgetBefore[budgetSeller.id].power * 8),
  "the fixture must exercise a transfer fee above the old seller-income cap");
assert.equal(budgetSeller.budget, expectedSeasonBudget(budgetSeller.id) + budgetedTransfer.fee,
  "the seller must receive the full recorded transfer fee after the market refreshes squad strength");
// Free agents must also be able to fill an eligible lower-tier vacancy when top-tier clubs have no need.
const freeAgentWorld = { clubs: {}, players: {}, transfers: [], marketReports: [], playerHistory: {}, notes: [], nextGeneratedPlayer: 1, dbVersion: 0, transferSequence: 0 };
makeMarketTestClub(freeAgentWorld, "D1 Full Club", 1, null);
makeMarketTestClub(freeAgentWorld, "D2 Keeper Vacancy", 2, "goalkeeper");
freeAgentWorld.players["free-agent-test-keeper"] = { id: "free-agent-test-keeper", name: "Free-agent keeper test", clubId: "", country: "Testland", leagueId: "test-market", division: 0, position: "حارس مرمى", group: "goalkeeper", ovr: 60, potential: 65, age: 26, contractSeasons: 0, freeAgent: true, previousClubId: "former-club", isGenerated: false };
const signedLowerTier = sandbox.window.__lwTestSignFreeAgents(freeAgentWorld, 3, []);
assert.equal(signedLowerTier.length, 1, "a free agent should sign when a lower-tier club has a compatible vacancy");
assert.equal(freeAgentWorld.players["free-agent-test-keeper"].clubId, "D2 Keeper Vacancy", "free-agent recruitment must include the lower-tier club when higher-tier clubs have no matching vacancy");
assert.equal(freeAgentWorld.players["free-agent-test-keeper"].division, 2, "the free agent must inherit the destination club division");


// An expiring defender should receive the squad-need renewal bonus when only four
// other defenders remain. The deterministic roll sits between the old and corrected
// thresholds, so this catches the off-by-one rather than a lucky renewal.
const renewalTestPlayerId = "contract-role-need-test-2";
const renewalPlayers = [{
  id: renewalTestPlayerId, name: "Renewal role-need test", clubId: "renewal-club",
  group: "defender", position: "قلب دفاع", age: 30, contractSeasons: 1,
  ovr: 40, potential: 60, freeAgent: false
}, ...Array.from({ length: 4 }, (_, index) => ({
  id: "renewal-teammate-" + (index + 1), name: "Renewal teammate " + (index + 1),
  clubId: "renewal-club", group: "defender", position: "قلب دفاع", age: 25,
  contractSeasons: 3, ovr: 60, potential: 65, freeAgent: false
}))];
const renewalWorld = {
  players: Object.fromEntries(renewalPlayers.map(player => [player.id, player])),
  clubs: { "renewal-club": { id: "renewal-club", name: "Role renewal test club", power: 80, roster: renewalPlayers.map(player => player.id) } },
  seasonStats: { "1": [{ id: renewalTestPlayerId, averageRating: 6.0, appearances: 0 }] },
  notes: []
};
assert.equal(typeof sandbox.window.__lwTestDevelopPlayers, "function",
  "the contract development function must be exposed to the isolated regression test");
sandbox.window.__lwTestDevelopPlayers(renewalWorld, 1);
assert.ok(renewalWorld.players[renewalTestPlayerId].contractSeasons > 0,
  "an expiring defender must receive the role-need renewal bonus when only four defenders remain");
assert.equal(renewalWorld.players[renewalTestPlayerId].freeAgent, false,
  "the role-need renewal must keep the player attached to the club");
assert.ok(renewalWorld.clubs["renewal-club"].roster.includes(renewalTestPlayerId),
  "a renewed player must remain in the club roster");
// End-of-season development must use the age during the season whose stats are being evaluated.
const ageBoundaryYouthId = "season-age-youth-boundary";
const ageBoundaryVeteranId = "season-age-veteran-boundary";
const ageBoundaryPlayers = [
  { id: ageBoundaryYouthId, name: "Season-age youth", clubId: "age-boundary-club",
    group: "attacker", position: "مهاجم", age: 23, contractSeasons: 3, ovr: 70, potential: 90, freeAgent: false },
  { id: ageBoundaryVeteranId, name: "Season-age veteran", clubId: "age-boundary-club",
    group: "midfielder", position: "وسط مهاجم", age: 30, contractSeasons: 3, ovr: 70, potential: 85, freeAgent: false }
];
const ageBoundaryWorld = {
  players: Object.fromEntries(ageBoundaryPlayers.map(player => [player.id, player])),
  clubs: { "age-boundary-club": { id: "age-boundary-club", name: "Age boundary test club",
    power: 70, roster: ageBoundaryPlayers.map(player => player.id) } },
  seasonStats: { "1": [
    { id: ageBoundaryYouthId, appearances: 10, averageRating: 7.4 },
    { id: ageBoundaryVeteranId, appearances: 20, averageRating: 6.2 }
  ] },
  notes: []
};
sandbox.window.__lwTestDevelopPlayers(ageBoundaryWorld, 1);
assert.equal(ageBoundaryWorld.players[ageBoundaryYouthId].age, 24);
assert.equal(ageBoundaryWorld.players[ageBoundaryYouthId].ovr, 72,
  "a player who was 23 during a strong season must receive youth development before aging to 24");
assert.equal(ageBoundaryWorld.players[ageBoundaryVeteranId].age, 31);
assert.equal(ageBoundaryWorld.players[ageBoundaryVeteranId].ovr, 70,
  "a player who was 30 during the season must not receive age-31 decline one season early");

// Retiring players are archived, removed from active squads and never re-enter the free-agent market.
const retirementPlayerId = "retirement-boundary-player";
const retirementWorld = {
  players: {
    [retirementPlayerId]: {
      id: retirementPlayerId, name: "Retiring Test Player", clubId: "retirement-club",
      leagueId: "retirement-test", division: 1, position: "مهاجم", group: "attacker",
      age: 42, contractSeasons: 1, ovr: 70, potential: 75, freeAgent: false
    }
  },
  clubs: {
    "retirement-club": {
      id: "retirement-club", name: "Retirement Test Club", country: "Testland",
      leagueId: "retirement-test", division: 1, roster: [retirementPlayerId], power: 65
    }
  },
  seasonStats: { "1": [{ id: retirementPlayerId, appearances: 30, averageRating: 7.1 }] },
  playerHistory: {
    [retirementPlayerId]: Array.from({ length: 15 }, (_, index) => ({ season: 15 - index, type: index === 0 ? "transfer-in" : "prior-event-" + index, club: "Retirement Test Club" }))
  },
  transfers: [], marketReports: [], notes: []
};
sandbox.window.__lwTestDevelopPlayers(retirementWorld, 1);
const retiredWorldPlayer = retirementWorld.players[retirementPlayerId];
assert.equal(retiredWorldPlayer.retired, true, "players at retirement age must leave active simulation");
assert.equal(retiredWorldPlayer.retirementAge, 42);
assert.equal(retiredWorldPlayer.retiredSeason, 2);
assert.equal(retiredWorldPlayer.clubId, "");
assert.equal(retiredWorldPlayer.freeAgent, false, "retirement must not create a free agent");
 
 // A stale roster ID must not count as a real squad member or block safe squad replenishment.
 const rosterIntegrityPlayers = {};
 const rosterIntegrityActiveIds = Array.from({ length: 15 }, (_, index) => {
   const id = "roster-integrity-active-" + index;
   const groups = ["goalkeeper", "defender", "midfielder", "attacker"];
   rosterIntegrityPlayers[id] = { id, name: "Active " + index, group: groups[index % groups.length], age: 25, ovr: 60, retired: false };
   return id;
 });
 const rosterIntegrityRetiredId = "roster-integrity-retired";
 rosterIntegrityPlayers[rosterIntegrityRetiredId] = { id: rosterIntegrityRetiredId, name: "Retired Record", group: "attacker", age: 42, retired: true };
 const rosterIntegrityWorld = { players: rosterIntegrityPlayers, nextGeneratedPlayer: 1, dbVersion: 1 };
 const rosterIntegrityClub = {
   id: "roster-integrity-club", name: "Roster Integrity Club", country: "Testland",
   leagueId: "roster-integrity", division: 1, power: 60, basePower: 60, prestige: 50,
   roster: [...rosterIntegrityActiveIds, "missing-roster-player", rosterIntegrityRetiredId]
 };
 sandbox.window.__lwTestFillRoster(rosterIntegrityWorld, rosterIntegrityClub);
 assert.equal(rosterIntegrityClub.roster.length, 16, "a club should be replenished to 16 real active players");
 assert.ok(rosterIntegrityClub.roster.every(id => rosterIntegrityWorld.players[id] && !rosterIntegrityWorld.players[id].retired),
   "active rosters must not retain missing or retired player IDs");
 assert.equal(rosterIntegrityWorld.players[rosterIntegrityRetiredId].name, "Retired Record",
   "roster cleanup must preserve the retired player's historical record");

assert.ok(!retirementWorld.clubs["retirement-club"].roster.includes(retirementPlayerId),
  "retired players must be removed from the active club roster");
assert.equal(retirementWorld.seasonStats["1"].length, 1,
  "retirement must preserve the player's historical season statistics");
assert.equal(retirementWorld.playerHistory[retirementPlayerId][0].type, "retirement");
assert.equal(retirementWorld.playerHistory[retirementPlayerId][1].type, "transfer-in",
  "retirement history must be added without deleting earlier player history");
assert.equal(retirementWorld.playerHistory[retirementPlayerId].length, 16,
  "retirement must not truncate older history entries");
assert.equal(retirementWorld.playerHistory[retirementPlayerId][15].type, "prior-event-14",
  "the oldest existing history row must remain available after retirement");
assert.ok(retirementWorld.notes.some(note => note.type === "retirement"));
sandbox.window.__lwTestSignFreeAgents(retirementWorld, 2, []);
assert.equal(retirementWorld.players[retirementPlayerId].retired, true);
assert.equal(retirementWorld.players[retirementPlayerId].clubId, "",
  "retired players must never be signed as free agents");

// Database reconciliation must not recreate a retired player from the static roster catalogue.
const retiredReconcileSave = { season: 1 };
const retiredReconcileWorld = ai.ensureState(retiredReconcileSave, db);
const retiredReconcilePlayer = Object.values(retiredReconcileWorld.players)
  .find(player => player && player.isRealPlayer && player.clubId && player.name && player.position);
assert.ok(retiredReconcilePlayer, "reconciliation regression needs a real catalogue player");
const retiredReconcilePlayerId = String(retiredReconcilePlayer.id);
const retiredReconcileClubId = String(retiredReconcilePlayer.clubId);
const retiredReconcileClub = retiredReconcileWorld.clubs[retiredReconcileClubId];
const retiredReconcileDestination = Object.values(retiredReconcileWorld.clubs)
  .find(club => String(club.id) !== retiredReconcileClubId);
assert.ok(retiredReconcileDestination, "reconciliation regression needs a second club to simulate a transfer");
const retiredReconcileDestinationId = String(retiredReconcileDestination.id);
const retiredReconcileName = retiredReconcilePlayer.name;
const retiredReconcilePosition = retiredReconcilePlayer.position;
retiredReconcileClub.roster = retiredReconcileClub.roster.filter(id => String(id) !== retiredReconcilePlayerId);
retiredReconcileDestination.roster = retiredReconcileDestination.roster.filter(id => String(id) !== retiredReconcilePlayerId);
retiredReconcilePlayer.previousClubId = retiredReconcileDestinationId;
retiredReconcilePlayer.clubId = "";
retiredReconcilePlayer.leagueId = "";
retiredReconcilePlayer.division = 0;
retiredReconcilePlayer.retired = true;
retiredReconcilePlayer.retiredSeason = 3;
retiredReconcilePlayer.retirementAge = 42;
retiredReconcilePlayer.freeAgent = false;
retiredReconcilePlayer.transferListed = false;
retiredReconcileWorld.playerHistory[retiredReconcilePlayerId] = [
  { season: 1, type: "transfer-in", club: retiredReconcileClub.name, country: retiredReconcileClub.country },
  { season: 2, type: "transfer", club: retiredReconcileDestination.name, country: retiredReconcileDestination.country },
  { season: 3, type: "retirement", club: retiredReconcileDestination.name, country: retiredReconcileDestination.country }
];
sandbox.window.__lwTestReconcileDatabase(retiredReconcileWorld, db);
const reimportedRetiredPlayer = Object.values(retiredReconcileWorld.players).filter(player =>
  player && !player.retired && String(player.clubId) === retiredReconcileClubId
  && player.name === retiredReconcileName && player.position === retiredReconcilePosition);
assert.equal(reimportedRetiredPlayer.length, 0,
  "reconciliation must not recreate a transferred retiree from the original club catalogue");
assert.equal(retiredReconcileWorld.players[retiredReconcilePlayerId].retired, true);
assert.equal(retiredReconcileWorld.players[retiredReconcilePlayerId].clubId, "");
assert.ok(!retiredReconcileWorld.clubs[retiredReconcileClubId].roster.includes(retiredReconcilePlayerId));
assert.equal(retiredReconcileWorld.playerHistory[retiredReconcilePlayerId][0].type, "transfer-in",
  "reconciliation must preserve the retired player's existing career history");

// Promotion history records the destination season. A record for season 2 must
// prevent repeating season 1, but must not suppress the independent season 2 table move.
const promotionClubs = [];
for (let index = 1; index <= 6; index++) promotionClubs.push({
  id: "promotion-first-" + index, name: "Promotion First " + index,
  leagueId: "promotion-test", division: 1, roster: []
});
for (let index = 1; index <= 3; index++) promotionClubs.push({
  id: "promotion-second-" + index, name: "Promotion Second " + index,
  leagueId: "promotion-test", division: 2, roster: []
});
const promotionWorld = {
  players: {},
  clubs: Object.fromEntries(promotionClubs.map(club => [club.id, club])),
  leagueTables: {
    "1": {
      "promotion-test": Array.from({ length: 6 }, (_, index) => ({ clubId: "promotion-first-" + (index + 1) })),
      "promotion-test:2": Array.from({ length: 3 }, (_, index) => ({ clubId: "promotion-second-" + (index + 1) }))
    },
    "2": {
      "promotion-test": [
        { clubId: "promotion-second-1" }, { clubId: "promotion-first-1" },
        { clubId: "promotion-first-2" }, { clubId: "promotion-first-3" },
        { clubId: "promotion-first-4" }, { clubId: "promotion-first-5" }
      ],
      "promotion-test:2": [
        { clubId: "promotion-first-6" }, { clubId: "promotion-second-2" }, { clubId: "promotion-second-3" }
      ]
    }
  },
  promotionHistory: [],
  notes: []
};
assert.equal(typeof sandbox.window.__lwTestApplyPromotionRelegation, "function",
  "the promotion/relegation function must be exposed to the isolated regression test");
const seasonOneMoves = sandbox.window.__lwTestApplyPromotionRelegation(promotionWorld, 1);
assert.equal(seasonOneMoves.length, 1, "season 1 should promote and relegate one club in the fixture league");
assert.equal(promotionWorld.promotionHistory[0].season, 2,
  "promotion history should label the destination season");
const repeatedSeasonOneMoves = sandbox.window.__lwTestApplyPromotionRelegation(promotionWorld, 1);
assert.equal(repeatedSeasonOneMoves.length, 0,
  "replaying the same source season must not duplicate its promotion/relegation");
const seasonTwoMoves = sandbox.window.__lwTestApplyPromotionRelegation(promotionWorld, 2);
assert.equal(seasonTwoMoves.length, 1,
  "a season 2 promotion/relegation must not be blocked by the prior season's destination-season history row");
assert.equal(promotionWorld.promotionHistory[0].season, 3,
  "the newest history row should record the next destination season");
assert.equal(promotionWorld.clubs["promotion-first-6"].division, 1,
  "the season 2 second-tier winner must be promoted");
assert.equal(promotionWorld.clubs["promotion-first-5"].division, 2,
  "the season 2 first-tier bottom club must be relegated");

assert.equal(typeof ai.positionProductionProfile, "function", "world AI must expose role-specific production profiles");
assert.equal(typeof ai.playerRoleWeight, "function", "match scoring must use the same position-aware role weights");
const centreStrikerProfile = ai.positionProductionProfile("رأس حربة");
const mobileForwardProfile = ai.positionProductionProfile("مهاجم");
const wingerProfile = ai.positionProductionProfile("جناح");
assert.ok(centreStrikerProfile.attackRate > mobileForwardProfile.attackRate,
  "centre strikers must have a higher goal rate than mobile forwards");
assert.ok(centreStrikerProfile.goalWeight > mobileForwardProfile.goalWeight,
  "actual match goal selection must favour centre strikers over mobile forwards");
assert.ok(centreStrikerProfile.assistRate < mobileForwardProfile.assistRate,
  "mobile forwards must contribute more assists than centre strikers");
assert.ok(wingerProfile.assistRate > centreStrikerProfile.assistRate,
  "wingers must retain a stronger assist profile than centre strikers");
assert.ok(ai.playerRoleWeight({ position: "رأس حربة" }, "goal") > ai.playerRoleWeight({ position: "مهاجم" }, "goal"),
  "the match engine must weight centre strikers more heavily as goal scorers");
assert.ok(ai.playerRoleWeight({ position: "مهاجم" }, "assist") > ai.playerRoleWeight({ position: "رأس حربة" }, "assist"),
  "the match engine must weight mobile forwards more heavily for assists");

const save = {
  season: 1, age: 20, name: "لاعب اختبار", pos: "جناح",
  clubName: "الأهلي", leagueCountry: "مصر", leagueDivision: 1,
  seasonApps: 0, seasonAppsTarget: 34, careerMatchHistory: []
};
const world = ai.ensureState(save, db);
const duplicateSourceName = "Scotland Test Player 1-1";
const duplicateSourcePlayers = Object.values(world.players).filter(player =>
  player && player.name === duplicateSourceName && player.isRealPlayer === true && player.isGenerated !== true);
assert.equal(duplicateSourcePlayers.length, 2,
  "identical names in different clubs must both remain sourced real players");
assert.equal(new Set(duplicateSourcePlayers.map(player => player.id)).size, 2,
  "same-name players from different clubs must receive distinct stable IDs");
assert.equal(new Set(duplicateSourcePlayers.map(player => player.clubId)).size, 2,
  "same-name players must remain attached to their own source clubs");
const duplicateReconcileSave = { season: 1, worldSimulation: JSON.parse(JSON.stringify(world)) };
duplicateReconcileSave.worldSimulation.rosterSchemaVersion = 2;
const duplicateReconcileClub = Object.values(duplicateReconcileSave.worldSimulation.clubs)
  .find(club => club.name === "Scotland Test Club 02");
const missingDuplicate = duplicateReconcileClub.roster
  .map(id => duplicateReconcileSave.worldSimulation.players[id])
  .find(player => player && player.name === duplicateSourceName && player.isRealPlayer === true);
assert.ok(missingDuplicate, "the legacy migration fixture must include the duplicate real player before removal");
duplicateReconcileClub.roster = duplicateReconcileClub.roster.filter(id => id !== missingDuplicate.id);
delete duplicateReconcileSave.worldSimulation.players[missingDuplicate.id];
ai.ensureState(duplicateReconcileSave, db);
const restoredDuplicate = duplicateReconcileClub.roster
  .map(id => duplicateReconcileSave.worldSimulation.players[id])
  .find(player => player && player.name === duplicateSourceName && player.isRealPlayer === true);
assert.ok(restoredDuplicate,
  "a schema-2 saved world must restore a same-name player omitted from another club during the old global dedupe");
assert.equal(restoredDuplicate.clubId, duplicateReconcileClub.id,
  "legacy roster repair must restore the player to the correct club");
assert.equal(duplicateReconcileSave.worldSimulation.rosterSchemaVersion, 3,
  "the per-club player identity migration must be recorded once");
// A catalogue refresh must not reset simulated promotion/relegation in an existing save.
assert.equal(typeof sandbox.window.__lwTestReconcileDatabase, "function",
  "database reconciliation must be exposed to the isolated regression test");
const divisionPersistenceClub = Object.values(world.clubs).find(club => club.leagueId === "scotland");
assert.ok(divisionPersistenceClub, "the roster fixture must include a club for the division-persistence regression");
const sourceDivisionForClub = db.clubs().find(row => row.name === divisionPersistenceClub.name).division;
assert.equal(Number(sourceDivisionForClub), 1, "the fixture source club should begin in division one");
const originalPlayerDivisions = new Map((divisionPersistenceClub.roster || []).map(id => [id, world.players[id] && world.players[id].division]));
divisionPersistenceClub.division = 2;
(divisionPersistenceClub.roster || []).forEach(id => { if (world.players[id]) world.players[id].division = 2; });
sandbox.window.__lwTestReconcileDatabase(world, db);
assert.equal(divisionPersistenceClub.division, 2,
  "catalogue reconciliation must preserve a club’s saved simulation division");
// Restore the shared world fixture so subsequent season/schedule assertions stay independent.
divisionPersistenceClub.division = Number(sourceDivisionForClub);
originalPlayerDivisions.forEach((division, id) => { if (world.players[id]) world.players[id].division = division; });
const clubCount = Object.keys(world.clubs).length;
const playerCount = Object.keys(world.players).length;
assert.ok(clubCount >= 50, "the AI world must cover at least 50 clubs");
assert.ok(playerCount >= clubCount * 12, "each club must have a multi-player squad");
assert.equal(world.schemaVersion, ai.version);
assert.equal(world.rosterSchemaVersion, 3, "fresh worlds must be marked reconciled so the next render does not rescan every squad");
assert.ok(!Object.keys(world.seasonStats || {}).some(key => key === "1"),
  "opening the dashboard must not create persistent season stats as a side effect");
assert.equal(ai.ensureState(save, db), world, "loading the same save must preserve its existing world simulation");
assert.equal(Object.keys(world.players).length, playerCount, "reconciliation must not duplicate the saved player database");

// Recruitment priorities must be contextual: role deficit, squad quality, age,
// potential and club archetype all feed a stable explainable score.
assert.equal(typeof ai.recruitmentNeeds, "function", "the world AI must expose recruitment-needs analysis");
const recruitment = ai.recruitmentNeeds(save, db);
assert.ok(recruitment.length >= clubCount, "recruitment analysis must cover the full club database");
// Guard the hot path against regressions: indexed recruitment may scan the global
// player map once, not once per club. The returned recruitment priorities must stay
// exactly equal to the reference result above.
const originalPlayerMap = world.players;
let playerMapScans = 0;
world.players = new Proxy(originalPlayerMap, {
  ownKeys(target) {
    playerMapScans++;
    return Reflect.ownKeys(target);
  }
});
let indexedRecruitment;
try {
  indexedRecruitment = ai.recruitmentNeeds(save, db);
} finally {
  world.players = originalPlayerMap;
}
assert.equal(playerMapScans, 1,
  "recruitment analysis must build its player-to-club index in a single pass");
assert.equal(JSON.stringify(indexedRecruitment), JSON.stringify(recruitment),
  "indexing must preserve every club's contextual recruitment scores and ordering");
for (const clubNeed of recruitment) {
  assert.ok(Array.isArray(clubNeed.needs) && clubNeed.needs.length >= 4,
    "every club must evaluate goalkeeper, defence, midfield and attack needs");
  for (const role of clubNeed.needs) {
    assert.ok(Number.isFinite(role.priorityScore), "role recruitment priority must be a numeric contextual score");
    assert.ok(Number.isFinite(role.deficit), "role recruitment priority must include roster deficit");
    assert.ok(Number.isFinite(role.averagePotential), "role recruitment priority must consider player potential");
    assert.ok(role.averageAge === null || Number.isFinite(role.averageAge),
      "role recruitment priority must include a valid average age");
  }
}

// Merely opening or refreshing the dashboard must not synchronously simulate every
// global league's full fixture list. Repeated unchanged reads should also be cached.
const initialDashboard = ai.dashboard(save, db);
assert.equal(initialDashboard.matchesSimulated, 0, "the fresh world dashboard must remain non-blocking before a season is simulated");
assert.equal(Object.prototype.hasOwnProperty.call(world.matchesBySeason || {}, "1"), false,
  "dashboard render must not create an entire world season as a side effect");
assert.strictEqual(ai.dashboard(save, db), initialDashboard,
  "unchanged dashboard refreshes should reuse the cached result");

// Older saved worlds may still contain Japan/AFC data. Keep it out of active simulation,
// but archive the club, player history, statistics and competition records without data loss.
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
world.playerHistory = world.playerHistory || {};
world.playerHistory[legacyPlayerId] = [{ season: 0, goals: 1 }];
world.matchesBySeason = world.matchesBySeason || {};
world.competitionsBySeason = world.competitionsBySeason || {};
world.seasonStats["0"] = [{ id: legacyPlayerId, leagueId: "japan", goals: 1 }];
world.leagueTables["0"] = { japan: [{ leagueId: "japan", club: "Legacy Japan Club" }] };
world.matchesBySeason["0"] = [{ homeClubId: legacyClubId, awayClubId: "some-supported-club" }];
world.competitionsBySeason["0"] = [{ id: "afc-cl", confederation: "AFC" }];
ai.ensureState(save, db);
assert.equal(world.clubs[legacyClubId], undefined, "unsupported clubs must leave the active simulation");
assert.equal(world.players[legacyPlayerId], undefined, "unsupported players must leave the active player pool");
assert.equal(world.archive.clubs[legacyClubId].name, "Legacy Japan Club", "the full club record must be retained in the archive");
assert.equal(world.archive.players[legacyPlayerId].name, "Legacy Japan Test Player", "the full player record must be retained in the archive");
assert.deepEqual(world.archive.playerHistory[legacyPlayerId], [{ season: 0, goals: 1 }], "player career history must be archived, not deleted");
assert.equal(world.leagueTables["0"].japan, undefined, "stale standings must be removed from active tables");
assert.equal(world.archive.leagueTables["0"].japan.length, 1, "removed-league standings must remain archived");
assert.equal(world.seasonStats["0"].length, 0, "unsupported-league stats must leave active season tables");
assert.equal(world.archive.seasonStats["0"].length, 1, "unsupported-league statistics must remain archived");
assert.equal(world.matchesBySeason["0"].length, 0, "fixtures involving removed-league clubs must leave active simulation");
assert.equal(world.archive.matchesBySeason["0"].length, 1, "fixtures involving removed-league clubs must remain archived");
assert.equal(world.competitionsBySeason["0"].length, 0, "AFC results must leave active competitions");
assert.equal(world.archive.competitionsBySeason["0"].length, 1, "AFC competition results must remain archived");


const firstSeason = ai.completeSeason(save, 1, db);
const lineupBuilds = Object.values(sandbox.window.__lwLineupBuildsByClub || {});
assert.ok(lineupBuilds.length > 0, "season simulation must build lineups for clubs playing fixtures");
assert.ok(lineupBuilds.every(count => count === 1),
  "each club lineup should be built exactly once during a season simulation");
assert.ok(lineupBuilds.length < (world.matchesBySeason["1"] || []).length,
  "the lineup cache should avoid rebuilding a squad for each fixture");
assert.equal(firstSeason.season, 1);
assert.equal(firstSeason.alreadyCompleted, false);
assert.ok(firstSeason.rows.length >= playerCount - 2, "season completion must save statistics for the world player pool");
assert.ok(Object.keys(firstSeason.tables).length >= 8, "world league tables must be simulated for multiple leagues");
assert.ok(world.completedSeasons.includes(1));

// Player leaderboard strength weighting must match the average power of the player's
// league/division. This also protects the precomputed lookup used to avoid O(players × clubs)
// repeated scans when a season's player-stat rows are built.
const leaguePowerTotals = new Map();
for (const club of Object.values(world.clubs)) {
  const key = String(club.leagueId || "") + "|" + Number(club.division);
  const summary = leaguePowerTotals.get(key) || { total: 0, count: 0 };
  summary.total += Number(club.power) || 55;
  summary.count++;
  leaguePowerTotals.set(key, summary);
}
for (const row of world.seasonStats["1"]) {
  const division = Number(row.division || 1);
  const summary = leaguePowerTotals.get(String(row.leagueId || "") + "|" + division);
  if (!summary || !summary.count) continue;
  const expectedStrength = Math.round(summary.total / summary.count);
  assert.equal(row.leagueStrength, expectedStrength, "league strength must match its division's club-power average: " + row.leagueId);
  assert.equal(row.weightedGoals, Number((Number(row.goals || 0) * (0.82 + (expectedStrength || 60) / 450)).toFixed(3)),
    "weighted-goal leaderboard scores must preserve the existing formula: " + row.id);
}

// Unfinished-season projections must use the strength of the player's own division,
 // not the top tier of the same league.
const divisionTwoClubForProjection = Object.values(world.clubs).find(club => {
  if (!club || !club.leagueId || Number(club.division) !== 2) return false;
  const topTier = leaguePowerTotals.get(String(club.leagueId) + "|1");
  const secondTier = leaguePowerTotals.get(String(club.leagueId) + "|2");
  return topTier && secondTier
    && Math.round(topTier.total / topTier.count) !== Math.round(secondTier.total / secondTier.count);
});
assert.ok(divisionTwoClubForProjection,
  "the world fixture must contain a league whose top- and second-division strengths differ");
const divisionTwoPlayerForProjection = Object.values(world.players).find(player =>
  player && player.clubId === divisionTwoClubForProjection.id && Number(player.division) === 2);
assert.ok(divisionTwoPlayerForProjection, "the second division must contain a player for projection checks");
const savedSeasonRowsForProjection = world.seasonStats["1"];
delete world.seasonStats["1"];
try {
  const projectedRows = ai.getSeasonLines(save, 1, 1, db);
  const projectedPlayer = projectedRows.find(row => row.id === divisionTwoPlayerForProjection.id);
  const secondTierSummary = leaguePowerTotals.get(String(divisionTwoClubForProjection.leagueId) + "|2");
  const expectedSecondTierStrength = Math.round(secondTierSummary.total / secondTierSummary.count);
  assert.ok(projectedPlayer, "second-division players must remain in unfinished-season projections");
  assert.equal(projectedPlayer.leagueStrength, expectedSecondTierStrength,
    "unfinished-season leaderboard weighting must use the player's own division strength");
} finally {
  world.seasonStats["1"] = savedSeasonRowsForProjection;
}

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
const duplicateCompletion = ai.completeSeason(save, 1, db);
assert.equal(duplicateCompletion.alreadyCompleted, true, "the same global season cannot be recorded twice");
assert.equal(world.seasonStats["1"].length, firstSeason.rows.length, "idempotent season completion must not duplicate stat rows");

const halfSeasonRows = ai.getSeasonLines(save, 1, 0.5, db);
assert.ok(halfSeasonRows.length > 0);
assert.ok(halfSeasonRows.every(row => Number.isFinite(row.goals) && Number.isFinite(row.assists)
  && Number.isFinite(row.appearances) && row.season === 1), "season lines must have coherent numeric stats");
// Zero progress can round appearances down to zero while stale/high goal totals still round up.
const zeroAppearanceFixtureIndex = world.seasonStats["1"].findIndex(row => row && row.id);
assert.ok(zeroAppearanceFixtureIndex >= 0, "a saved player-stat row must be available for the zero-appearance regression");
const zeroAppearanceFixtureId = world.seasonStats["1"][zeroAppearanceFixtureIndex].id;
const originalZeroAppearanceFixture = world.seasonStats["1"][zeroAppearanceFixtureIndex];
world.seasonStats["1"][zeroAppearanceFixtureIndex] = {
  ...originalZeroAppearanceFixture,
  appearances: 1, goals: 50, assists: 25, averageRating: 9.8,
  seasonStats: { ...(originalZeroAppearanceFixture.seasonStats || {}),
    season: 1, appearances: 1, goals: 50, assists: 25, averageRating: 9.8 }
};
const zeroProgressRows = ai.getSeasonLines(save, 1, 0.01, db);
const zeroProgressRow = zeroProgressRows.find(row => row.id === zeroAppearanceFixtureId);
assert.ok(zeroProgressRow, "the zero-progress fixture must remain in season lines");
assert.equal(zeroProgressRow.appearances, 0);
assert.equal(zeroProgressRow.goals, 0, "goals must not survive when scaled appearances round to zero");
assert.equal(zeroProgressRow.assists, 0, "assists must not survive when scaled appearances round to zero");
assert.equal(zeroProgressRow.displayStats.goals, 0);
const zeroProgressLeader = ai.leaderboard(save, { season: 1, progress: 0.01 }, db)
  .find(row => row.id === zeroAppearanceFixtureId);
assert.ok(zeroProgressLeader, "the zero-progress player must remain visible for regression checks");
assert.equal(zeroProgressLeader.appearances, 0, "leaderboard must honor explicit zero display appearances");
assert.equal(zeroProgressLeader.goals, 0);
assert.equal(zeroProgressLeader.assists, 0);
assert.equal(zeroProgressLeader.averageRating, 0);
assert.equal(zeroProgressLeader.score, 0, "a non-appearing player must not receive OVR-only leaderboard points");
assert.equal(zeroProgressLeader.weightedGoals, 0);

world.seasonStats["1"][zeroAppearanceFixtureIndex] = {
  ...originalZeroAppearanceFixture,
  appearances: 0, goals: 50, assists: 25, averageRating: 9.8,
  seasonStats: { ...(originalZeroAppearanceFixture.seasonStats || {}),
    season: 1, appearances: 0, goals: 50, assists: 25, averageRating: 9.8 }
};
const staleZeroAppearanceLeader = ai.leaderboard(save, { season: 1, progress: 1 }, db)
  .find(row => row.id === zeroAppearanceFixtureId);
assert.ok(staleZeroAppearanceLeader);
assert.equal(staleZeroAppearanceLeader.appearances, 0);
assert.equal(staleZeroAppearanceLeader.goals, 0, "legacy saves with zero appearances must discard stale goals");
assert.equal(staleZeroAppearanceLeader.assists, 0, "legacy saves with zero appearances must discard stale assists");
assert.equal(staleZeroAppearanceLeader.score, 0);
assert.equal(staleZeroAppearanceLeader.weightedGoals, 0);
world.seasonStats["1"][zeroAppearanceFixtureIndex] = originalZeroAppearanceFixture;

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
assert.equal(save.season, 1, "global simulation must not mutate the player's career-season counter");
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
 const previousSeasonSnapshot = JSON.stringify(world.seasonStats["1"] || []);
 const previousSeasonRows = new Map((world.seasonStats["1"] || []).map(row => [row.id, { ...row }]));
 const nextSeasonRows = new Map(ai.getSeasonLines(save, 2, 1, db).map(row => [row.id, row]));
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
const reloadedRepeat = ai.advanceToSeason(reloadedSave, 2, db);
assert.equal(reloadedRepeat.alreadyAdvanced, true,
  "replaying a market transition after reload must not create a second market");
assert.equal(reloadedWorld.transfers.length, world.transfers.length,
  "reloading and replaying the same season must not duplicate transfer deals");


// Extend the save/market integration scenario across multiple additional seasons.
// This deliberately stresses contract expiry, renewals, free agency, transfers,
// serialized histories, and season-stat immutability beyond the first transition.
function assertWorldOwnership(worldState, label) {
  const owners = new Map();
  for (const club of Object.values(worldState.clubs)) {
    assert.ok(club.roster.length >= 16 && club.roster.length <= 18,
      label + ": each club must keep a legal simulated squad size");
    for (const playerId of club.roster) {
      assert.ok(!owners.has(playerId), label + ": a player cannot belong to two clubs");
      owners.set(playerId, club.id);
      assert.equal(worldState.players[playerId].clubId, club.id,
        label + ": roster membership must match the player's active club");
    }
  }
  const freeAgents = Object.values(worldState.players).filter(player => player.freeAgent);
  assert.equal(owners.size + freeAgents.length, Object.keys(worldState.players).length,
    label + ": every player must be owned by one club or explicitly be a free agent");
  for (const player of Object.values(worldState.players)) {
    if (player.freeAgent) assert.equal(player.clubId, "", label + ": free agents must not retain a club");
    else assert.equal(owners.get(player.id), player.clubId, label + ": contracted players need one roster owner");
  }
  const transferIds = worldState.transfers.map(row => row.id);
  assert.equal(new Set(transferIds).size, transferIds.length,
    label + ": transfer identifiers must remain unique across seasons");
}
for (const nextSeason of [3, 4]) {
  const priorSeason = nextSeason - 1;
  const previousStatsSnapshot = JSON.stringify(reloadedWorld.seasonStats[String(priorSeason)] || []);
  assert.ok(JSON.parse(previousStatsSnapshot).length > 0,
    "multi-season stress test must start with saved stats for season " + priorSeason);
  const previousTransferCount = reloadedWorld.transfers.length;
  const next = ai.advanceToSeason(reloadedSave, nextSeason, db);
  assert.equal(next.season, nextSeason, "the stress save must advance to season " + nextSeason);
  assert.equal(next.alreadyAdvanced, false, "each new season transition must be applied once");
  assert.ok(reloadedWorld.completedSeasons.includes(priorSeason),
    "the previous season must be completed before season " + nextSeason + " begins");
  assert.equal(JSON.stringify(reloadedWorld.seasonStats[String(priorSeason)] || []), previousStatsSnapshot,
    "advancing season " + nextSeason + " must not rewrite season " + priorSeason + " player stats");
  assert.ok(reloadedWorld.transfers.length >= previousTransferCount,
    "transfer history must be append-only through season " + nextSeason);

  const lines = ai.getSeasonLines(reloadedSave, nextSeason, 1, db);
  assert.ok(lines.length > 0, "season " + nextSeason + " must generate player-stat lines");
  const seasonRows = reloadedWorld.seasonStats[String(nextSeason)] || [];
  const seasonIds = seasonRows.map(row => row.id);
  assert.equal(new Set(seasonIds).size, seasonIds.length,
    "season " + nextSeason + " must not persist duplicate player-stat rows");
  assertWorldOwnership(reloadedWorld, "season " + nextSeason);

  const roundTripSave = JSON.parse(JSON.stringify(reloadedSave));
  const roundTripWorld = ai.ensureState(roundTripSave, db);
  assert.equal(JSON.stringify(roundTripWorld.seasonStats[String(priorSeason)] || []), previousStatsSnapshot,
    "save/reload must preserve the completed prior-season stats");
  assert.equal(JSON.stringify(roundTripWorld.seasonStats[String(nextSeason)] || []), JSON.stringify(seasonRows),
    "save/reload must preserve the active season's generated stats");
  assert.equal(roundTripWorld.transfers.length, reloadedWorld.transfers.length,
    "save/reload must preserve every accumulated transfer");

  const repeat = ai.advanceToSeason(roundTripSave, nextSeason, db);
  assert.equal(repeat.alreadyAdvanced, true,
    "replaying the season " + nextSeason + " transition after reload must be idempotent");
  assert.equal(roundTripWorld.transfers.length, reloadedWorld.transfers.length,
    "replaying a saved market must not duplicate transfer records");
  assertWorldOwnership(roundTripWorld, "reloaded season " + nextSeason);
}

// A full squad must not recruit a fifth attacker or an extra goalkeeper, including from free agency.
const squadDepthSave = { season: 1, age: 24, name: "Squad depth regression", pos: "مهاجم",
  clubName: "Squad depth test", leagueCountry: "مصر", leagueDivision: 1 };
const squadDepthWorld = ai.ensureState(squadDepthSave, db);
const targetClub = Object.values(squadDepthWorld.clubs)
  .filter(club => Number(club.division) === 1 && (club.roster || []).length === 16)
  .sort((a, b) => Number(b.power || 0) - Number(a.power || 0))[0];
assert.ok(targetClub, "the squad-depth regression needs a 16-player first-division club");
const roleSequence = [
  "goalkeeper", "goalkeeper",
  "defender", "defender", "defender", "defender", "defender",
  "midfielder", "midfielder", "midfielder", "midfielder", "midfielder",
  "attacker", "attacker", "attacker", "attacker"
];
const rolePositions = { goalkeeper: "حارس مرمى", defender: "قلب دفاع", midfielder: "وسط مهاجم", attacker: "رأس حربة" };
for (const club of Object.values(squadDepthWorld.clubs)) {
  const isTarget = club.id === targetClub.id;
  club.basePower = isTarget ? 97 : 40;
  club.power = isTarget ? 97 : 40;
  club.prestige = isTarget ? 100 : 50;
  club.budget = isTarget ? 100000 : 0;
  for (const [index, id] of (club.roster || []).entries()) {
    const player = squadDepthWorld.players[id];
    if (!player) continue;
    player.ovr = isTarget ? 88 : 40;
    player.potential = isTarget ? 94 : 45;
    player.age = 25;
    player.contractSeasons = 4;
    player.freeAgent = false;
    player.clubId = club.id;
    if (isTarget) {
      const group = roleSequence[index];
      assert.ok(group, "the test club should have exactly the expected 16 roster slots");
      player.group = group;
      player.position = rolePositions[group];
    }
  }
}
assert.equal(targetClub.roster.length, 16, "the test club must start with a legal 16-player squad");
const surplusAttacker = {
  id: "squad-depth-free-agent", name: "Squad depth free agent", clubId: "", country: "مصر", leagueId: "",
  division: 0, position: "رأس حربة", group: "attacker", ovr: 88, potential: 92, age: 25,
  contractSeasons: 0, freeAgent: true, previousClubId: ""
};
squadDepthWorld.players[surplusAttacker.id] = surplusAttacker;
squadDepthWorld.playerHistory[surplusAttacker.id] = [];
const squadDepthTransition = ai.advanceToSeason(squadDepthSave, 2, db);
assert.ok(!squadDepthTransition.moves.some(move => move.to === targetClub.name),
  "a club at every positional target must not add surplus players in the normal or free-agent market");
assert.equal(squadDepthWorld.players[surplusAttacker.id].freeAgent, true,
  "a free agent must remain unattached when every eligible club already has its attacker quota");
assert.equal(targetClub.roster.filter(id => squadDepthWorld.players[id] && squadDepthWorld.players[id].group === "attacker").length, 4,
  "the AI must not turn a full four-forward group into a five-forward group");
assert.equal(targetClub.roster.filter(id => squadDepthWorld.players[id] && squadDepthWorld.players[id].group === "goalkeeper").length, 2,
  "the AI must not overfill the two-goalkeeper target");

// Division-table lookups must preserve archived standings after fixture pruning and
// select the requested division key for active seasons (not silently return the top flight).
const divisionLookupSave = { season: 1, age: 24, name: "Division table lookup regression",
  pos: "مهاجم", clubName: "Division table lookup test", leagueCountry: "مصر", leagueDivision: 1 };
const divisionLookupWorld = ai.ensureState(divisionLookupSave, db);
divisionLookupWorld.completedSeasons = [1];
divisionLookupWorld.matchesBySeason = {};
divisionLookupWorld.leagueTables = { "1": {
  "division-lookup-test": [{ clubId: "first-division", rank: 1 }],
  "division-lookup-test:2": [{ clubId: "second-division", rank: 1 }],
  "division-lookup-test:3": [{ clubId: "third-division", rank: 1 }]
} };
assert.equal(Array.from(ai.getDivisionTable(divisionLookupSave, "division-lookup-test", 2, 1, db), row => row.clubId).join(","),
  "second-division", "a completed second-division table must survive fixture pruning");
assert.equal(Array.from(ai.getDivisionTable(divisionLookupSave, "division-lookup-test", 3, 1, db), row => row.clubId).join(","),
  "third-division", "a completed third-division table must survive fixture pruning");
divisionLookupWorld.completedSeasons = [];
divisionLookupWorld.matchesBySeason = { "1": [] };
assert.equal(Array.from(ai.getDivisionTable(divisionLookupSave, "division-lookup-test", 3, 1, db), row => row.clubId).join(","),
  "third-division", "active division-three lookup must not fall back to the first-division table");

// Repeated dashboard projections should reuse the expensive full-season player rows.
const projectionCacheSave = { season: 1, name: "Season projection cache regression" };
const projectionCacheWorld = ai.ensureState(projectionCacheSave, db);
sandbox.window.__lwSeasonProjectionBuilds = 0;
const firstProjection = sandbox.window.__lwTestBaseGetSeasonLines(projectionCacheSave, 2, 0.5, db);
const firstProjectionBuilds = sandbox.window.__lwSeasonProjectionBuilds;
assert.ok(firstProjectionBuilds > 0, "an unfinished season projection must be generated once");
const fullProjection = sandbox.window.__lwTestBaseGetSeasonLines(projectionCacheSave, 2, 1, db);
assert.equal(sandbox.window.__lwSeasonProjectionBuilds, firstProjectionBuilds,
  "changing display progress must reuse the cached full-season projection");
assert.equal(firstProjection.length, fullProjection.length, "progress scaling must preserve the player row count");
const revisionBeforeAdvance = projectionCacheWorld.projectionRevision;
ai.advanceToSeason(projectionCacheSave, 2, db);
assert.ok(projectionCacheWorld.projectionRevision > revisionBeforeAdvance,
  "advancing the world season must invalidate projections built from the previous player state");
sandbox.window.__lwSeasonProjectionBuilds = 0;
sandbox.window.__lwTestBaseGetSeasonLines(projectionCacheSave, 2, 0.5, db);
const postAdvanceBuilds = sandbox.window.__lwSeasonProjectionBuilds;
assert.ok(postAdvanceBuilds > 0, "a new world season must rebuild its projected player rows");
sandbox.window.__lwTestBaseGetSeasonLines(projectionCacheSave, 2, 1, db);
assert.equal(sandbox.window.__lwSeasonProjectionBuilds, postAdvanceBuilds,
  "the rebuilt projection must also be reused until the world changes");

console.log("PASS: persistent football world has " + clubCount + " clubs and " + playerCount
  + " players; " + transition.moves.length + " needs-based AI transfers; season stats, tables, and one-time progression all reconcile.");
