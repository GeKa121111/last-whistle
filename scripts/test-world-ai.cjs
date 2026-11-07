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

const lineupMarker = "  function makeLineup(world, club, playerKeyByObject) {";
const rosterPlayersMarker = "  function rosterPlayers(world, club) {";
const playersForClubMarker = "  function playersForClub(world, club) {";
const normalizeRosterMembershipMarker = "  function normalizeRosterMembership(world) {";
const activeRosterIdsMarker = "  function activeRosterIds(world, club, fallbackClubId) {";
assert.ok(aiSourceRaw.includes(lineupMarker), "AI engine must retain the lineup builder for the regression guard");
assert.ok(aiSourceRaw.includes(rosterPlayersMarker), "AI engine must retain the active-roster helper for free-agent regression coverage");
assert.ok(aiSourceRaw.includes(playersForClubMarker), "AI engine must retain the club-player filter for retired-roster regression coverage");
assert.ok(aiSourceRaw.includes(normalizeRosterMembershipMarker), "AI engine must retain the legacy roster-membership migration");
assert.ok(aiSourceRaw.includes(activeRosterIdsMarker), "AI engine must retain safe active-roster ID filtering");
const advanceMarker = "  function advanceToSeason(save, nextSeason, db) {";
assert.ok(aiSourceRaw.includes(advanceMarker), "AI engine must retain the season-advance entry point for the contract regression guard");
const promotionMarker = "  function applyPromotionRelegation(world, season, db) {";
const competitionsMarker = "  function simulateCompetitions(world, season, db, tables) {";
const reconcileMarker = "  function reconcileDatabase(world, db) {";
const transferMarker = "  function runTransferWindow(world, season) {";
const freeAgentMarker = "  function signFreeAgents(world, season, existingMoves) {";
const fillRosterMarker = "  function fillRoster(world, club) {";
const baseSeasonLinesMarker = "  function getSeasonLines(save, season, progress = 1, db) {";
const baseCompleteSeasonMarker = "  function completeSeason(save, season, db) {";
const matchSeasonMarker = "  function simulateLeagueSeason(save, season, db) {";
const expandMatchesMarker = "  function expandWorldMatches(world, matches, expectedSeason) {";
const competitionHistoryMarker = "  function retainCompetitionHistory(world, limit = WORLD_CLUB_CUP_CYCLE_YEARS) {";
const knockoutMarker = "  function knockout(world, season, def, participants) {";
const buildLeagueStrengthLookupMarker = "  function buildLeagueStrengthLookup(world) {";
const buildPlayerRowsMarker = "  function buildPlayerRows(world, season, accumulators) {";
const buildBalancedLeagueScheduleMarker = "  function buildBalancedLeagueSchedule(clubs, matchesPerClub, seed) {";
const generatePlayerSeasonMarker = "  function generatePlayerSeason(world, player, season, progress = 1, strengthByLeague, matchesByClub, playerMapKey) {";
const normalizedClubPowerMarker = "  function normalizedClubPower(club) {";
const marketClubPowerMarker = "  function marketClubPower(club, fallback = 55) {";
const inferArchetypeMarker = "  function inferArchetype(club) {";
const weightedPickMarker = "  function weightedPick(rows, rng, purpose) {";
const playMatchMarker = "  function playMatch(world, home, away, season, division, matchday, sequence, accumulators, competitionId, lineupCache, playerKeyByObject) {";
const tableRowMarker = "  function tableRow(club, season, leagueId, division) {";
const projectionCacheMarker = "  function getProjectedSeasonRows(world, targetSeason, db) {";
const divisionNormalizerMarker = "  function normalizeClubDivision(value, missingFallback = 1) {";
const safeWorldIdentifierMarker = "  function safeWorldIdentifier(value) {";
const matchLookupMarker = "  function buildLeagueMatchCountLookup(world, db) {";
const ensureStateMarker = "  function ensureState(save, db) {";
const leagueStrengthMarker = "  function leagueStrength(world, leagueId, division, strengthByLeague) {";
const leagueTablesMarker = "  function simulateLeagueTables(world, season, progress = 1, db, suppliedMatchesByClub) {";
const projectedRowsMarker = "  function getProjectedSeasonRows(world, targetSeason, db) {";
const groupRowsMarker = "  function groupRows(world) {";
assert.ok(aiSourceRaw.includes(promotionMarker), "AI engine must retain the promotion/relegation entry point for the season-history regression guard");
assert.ok(aiSourceRaw.includes(competitionsMarker), "AI engine must retain the continental competition selector for qualification regression coverage");
assert.ok(aiSourceRaw.includes(reconcileMarker), "AI engine must retain reconciliation for the division-persistence regression guard");
assert.ok(aiSourceRaw.includes(transferMarker), "AI engine must retain the transfer-window entry point for all-division market coverage");
assert.ok(aiSourceRaw.includes(freeAgentMarker), "AI engine must retain the free-agent entry point for all-division market coverage");
assert.ok(aiSourceRaw.includes(fillRosterMarker), "AI engine must retain the roster filler for roster-integrity regression coverage");
assert.ok(aiSourceRaw.includes(baseSeasonLinesMarker), "AI engine must retain projected season lines for retired-player regression coverage");
assert.ok(aiSourceRaw.includes(baseCompleteSeasonMarker), "AI engine must retain the legacy season completion path for retired-player regression coverage");
assert.ok(aiSourceRaw.includes(matchSeasonMarker), "AI engine must retain the match-based season simulator for division-status regression coverage");
assert.ok(aiSourceRaw.includes(expandMatchesMarker), "AI engine must retain safe saved-match expansion for corrupted season snapshot regression coverage");
assert.ok(aiSourceRaw.includes(competitionHistoryMarker), "AI engine must retain four seasons of continental qualification history");
assert.ok(aiSourceRaw.includes(knockoutMarker), "AI engine must retain the knockout resolver for fair cup tiebreak regression coverage");
assert.ok(aiSourceRaw.includes(buildLeagueStrengthLookupMarker), "AI engine must retain the season league-strength lookup");
assert.ok(aiSourceRaw.includes(buildPlayerRowsMarker), "AI engine must retain the shared season row builder for retired-player regression coverage");
assert.ok(aiSourceRaw.includes(buildBalancedLeagueScheduleMarker), "AI engine must retain the balanced schedule builder for fixture regression coverage");
assert.ok(aiSourceRaw.includes(projectionCacheMarker), "AI engine must retain cached projection generation for performance regression coverage");
assert.ok(aiSourceRaw.includes(divisionNormalizerMarker), "AI engine must validate explicit club divisions without coercion");
assert.ok(aiSourceRaw.includes(safeWorldIdentifierMarker), "AI engine must read saved world identifiers without coercion");
assert.ok(aiSourceRaw.includes(matchLookupMarker), "AI engine must retain the league match-count index");
assert.ok(aiSourceRaw.includes(ensureStateMarker), "AI engine must validate saved-state league IDs safely");
assert.ok(aiSourceRaw.includes(leagueStrengthMarker), "AI engine must retain safe league-strength lookup");
assert.ok(aiSourceRaw.includes(leagueTablesMarker), "AI engine must retain league table simulation for strict division regression coverage");
assert.ok(aiSourceRaw.includes(projectedRowsMarker), "AI engine must retain projected season generation for strict division regression coverage");
assert.ok(aiSourceRaw.includes(groupRowsMarker), "AI engine must retain world match grouping for strict division regression coverage");
const aiSource = aiSourceRaw
  .replace(safeWorldIdentifierMarker, "  global.__lwTestSafeWorldIdentifier = safeWorldIdentifier;\n" + safeWorldIdentifierMarker)
  .replace(matchLookupMarker, "  global.__lwTestBuildLeagueMatchCountLookup = buildLeagueMatchCountLookup;\n" + matchLookupMarker)
  .replace(ensureStateMarker, "  global.__lwTestEnsureState = ensureState;\n" + ensureStateMarker)
  .replace(leagueStrengthMarker, "  global.__lwTestLeagueStrength = leagueStrength;\n" + leagueStrengthMarker)
  .replace(divisionNormalizerMarker, "  global.__lwTestNormalizeClubDivision = normalizeClubDivision;\n" + divisionNormalizerMarker)
  .replace(leagueTablesMarker, "  global.__lwTestSimulateLeagueTables = simulateLeagueTables;\n" + leagueTablesMarker)
  .replace(projectedRowsMarker, "  global.__lwTestGetProjectedSeasonRows = getProjectedSeasonRows;\n" + projectedRowsMarker)
  .replace(groupRowsMarker, "  global.__lwTestGroupRows = groupRows;\n" + groupRowsMarker)
  .replace(rosterPlayersMarker, "  global.__lwTestRosterPlayers = rosterPlayers;\n" + rosterPlayersMarker)
  .replace(playersForClubMarker, "  global.__lwTestPlayersForClub = playersForClub;\n" + playersForClubMarker)
  .replace(normalizeRosterMembershipMarker, "  global.__lwTestNormalizeRosterMembership = normalizeRosterMembership;\n" + normalizeRosterMembershipMarker)
  .replace(activeRosterIdsMarker, "  global.__lwTestActiveRosterIds = activeRosterIds;\n" + activeRosterIdsMarker)
  .replace(lineupMarker, "  global.__lwTestMakeLineup = makeLineup;\n" + lineupMarker + `
    global.__lwLineupBuildsByClub = global.__lwLineupBuildsByClub || {};
    global.__lwLineupBuildsByClub[club.id] = (global.__lwLineupBuildsByClub[club.id] || 0) + 1;`)
  .replace(advanceMarker, "  global.__lwTestDevelopPlayers = developPlayers;\n" + advanceMarker)
  .replace(promotionMarker, "  global.__lwTestApplyPromotionRelegation = applyPromotionRelegation;\n" + promotionMarker)
  .replace(competitionsMarker, "  global.__lwTestSimulateCompetitions = simulateCompetitions;\n" + competitionsMarker)
  .replace(reconcileMarker, "  global.__lwTestReconcileDatabase = reconcileDatabase;\n  global.__lwTestRememberTransferClubEndpoints = rememberTransferClubEndpoints;\n" + reconcileMarker)
  .replace(transferMarker, "  global.__lwTestRunTransferWindow = runTransferWindow;\n" + transferMarker)
  .replace(freeAgentMarker, "  global.__lwTestSignFreeAgents = signFreeAgents;\n" + freeAgentMarker)
  .replace(fillRosterMarker, "  global.__lwTestFillRoster = fillRoster;\n" + fillRosterMarker)
  .replace(baseSeasonLinesMarker, "  global.__lwTestBaseGetSeasonLines = getSeasonLines;\n" + baseSeasonLinesMarker)
  .replace(baseCompleteSeasonMarker, "  global.__lwTestBaseCompleteSeason = completeSeason;\n" + baseCompleteSeasonMarker)
  .replace(matchSeasonMarker, "  global.__lwTestSimulateLeagueSeason = simulateLeagueSeason;\n" + matchSeasonMarker)
  .replace(expandMatchesMarker, "  global.__lwTestExpandWorldMatches = expandWorldMatches;\n" + expandMatchesMarker)
  .replace(competitionHistoryMarker, "  global.__lwTestRetainCompetitionHistory = retainCompetitionHistory;\n" + competitionHistoryMarker)
  .replace(knockoutMarker, "  global.__lwTestKnockout = knockout;\n" + knockoutMarker)
  .replace(buildLeagueStrengthLookupMarker, "  global.__lwTestBuildLeagueStrengthLookup = buildLeagueStrengthLookup;\n" + buildLeagueStrengthLookupMarker)
  .replace(buildPlayerRowsMarker, "  global.__lwTestBuildPlayerRows = buildPlayerRows;\n" + buildPlayerRowsMarker)
  .replace(buildBalancedLeagueScheduleMarker, "  global.__lwTestBuildBalancedLeagueSchedule = buildBalancedLeagueSchedule;\n" + buildBalancedLeagueScheduleMarker)
  .replace(marketClubPowerMarker, "  global.__lwTestMarketClubPower = marketClubPower;\n" + marketClubPowerMarker)
  .replace(inferArchetypeMarker, "  global.__lwTestInferArchetype = inferArchetype;\n" + inferArchetypeMarker)
  .replace(generatePlayerSeasonMarker, "  global.__lwTestGeneratePlayerSeason = generatePlayerSeason;\n" + generatePlayerSeasonMarker)
  .replace(normalizedClubPowerMarker, "  global.__lwTestNormalizedClubPower = normalizedClubPower;\n" + normalizedClubPowerMarker)
  .replace(weightedPickMarker, "  global.__lwTestWeightedPick = weightedPick;\n" + weightedPickMarker)
  .replace(playMatchMarker, "  global.__lwTestPlayWorldMatch = playMatch;\n" + playMatchMarker)
  .replace(tableRowMarker, "  global.__lwTestTableRow = tableRow;\n" + tableRowMarker)
  .replace(projectionCacheMarker, projectionCacheMarker)
  .replace("    if (!cached.rows.has(targetSeason)) {", "    if (!cached.rows.has(targetSeason)) {\n      global.__lwSeasonProjectionBuilds = (global.__lwSeasonProjectionBuilds || 0) + 1;");
new vm.Script(dbSource, { filename: "public/football-world-db.js" }).runInContext(sandbox);
new vm.Script(aiSource, { filename: "public/football-world-ai.js" }).runInContext(sandbox);
const db = sandbox.window.LWWorldDB;
const ai = sandbox.window.LWWorldAI;
assert.ok(db && ai, "world database and autonomous AI engine must initialize");
assert.equal(typeof ai.rosterPlayers, "function",
  "the shared active-roster reader must be available to the world-simulation extension");
assert.equal(typeof ai.withTransferMarketTransaction, "function",
  "the transfer transaction helper must be exported across the world-simulation IIFE boundary");

// Legacy saves can retain a retired player ID in a club roster after an interrupted migration.
// The matchday lineup must never select that player, even if their old OVR is the highest.
const retiredLineupWorld = { players: {
  active: { id: "active", name: "Active player", group: "attacker", ovr: 70, freeAgent: false, retired: false },
  retired: { id: "retired", name: "Retired player", group: "attacker", ovr: 99, freeAgent: false, retired: true },
  free: { id: "free", name: "Free agent", group: "attacker", ovr: 95, freeAgent: true, retired: false }
} };
const retiredLineup = sandbox.window.__lwTestMakeLineup(retiredLineupWorld, {
  id: "legacy-retired-roster", roster: ["active", "retired", "free"]
});
assert.equal(retiredLineup.map(player => player.id).join(","), "active",
  "AI match lineups must exclude retired and free-agent players even when stale roster IDs remain");

const hostileSavedNumber = {
  valueOf() { throw new Error("hostile saved OVR conversion"); },
  toString() { throw new Error("hostile saved OVR conversion"); }
};
const malformedMatchWorld = { players: {}, clubs: {} };
function addMalformedMatchClub(id, power, basePower) {
  const club = {
    id, name: id, country: "Testland", leagueId: "malformed-match-test",
    division: 1, power, basePower, roster: []
  };
  const roles = [["goalkeeper", 1], ["defender", 4], ["midfielder", 4], ["attacker", 3]];
  roles.forEach(([group, count]) => {
    for (let index = 0; index < count; index++) {
      const playerId = id + "-" + group + "-" + index;
      let ovr = 70 + (index % 4);
      if (group === "attacker" && index === 0) ovr = hostileSavedNumber;
      if (group === "attacker" && index === 1) ovr = [99, 100];
      const player = {
        id: playerId, name: playerId, clubId: id, group,
        position: group === "goalkeeper" ? "حارس مرمى"
          : group === "defender" ? "قلب دفاع"
            : group === "midfielder" ? "وسط" : "مهاجم",
        ovr, freeAgent: false, retired: false
      };
      if (group === "goalkeeper") player.goalkeeping = hostileSavedNumber;
      malformedMatchWorld.players[playerId] = player;
      club.roster.push(playerId);
    }
  });
  malformedMatchWorld.clubs[id] = club;
  return club;
}
const malformedHomeClub = addMalformedMatchClub("malformed-home", hostileSavedNumber, 64);
const malformedAwayClub = addMalformedMatchClub("malformed-away", [90, 95], 60);
const malformedHomeLineup = sandbox.window.__lwTestMakeLineup(malformedMatchWorld, malformedHomeClub);
const malformedAwayLineup = sandbox.window.__lwTestMakeLineup(malformedMatchWorld, malformedAwayClub);
assert.equal(malformedHomeLineup.length, 11);
assert.equal(malformedAwayLineup.length, 11);
assert.ok(malformedHomeLineup.some(player => player.id === "malformed-home-attacker-2"),
  "a valid attacker rating must outrank malformed array/object ratings in the matchday lineup");
const malformedLineupCache = new Map([
  [malformedHomeClub.id, malformedHomeLineup],
  [malformedAwayClub.id, malformedAwayLineup]
]);
const malformedWeightedPick = sandbox.window.__lwTestWeightedPick([
  malformedMatchWorld.players["malformed-home-attacker-0"],
  malformedMatchWorld.players["malformed-home-attacker-2"]
], () => 0.5, "goal");
assert.ok(malformedWeightedPick,
  "goal-contributor weighting must fall back safely when a saved OVR is an object");
const malformedMatchAccumulators = new Map(Object.values(malformedMatchWorld.players).map(player => [
  player.id, { appearances: 0, goals: 0, assists: 0, ratingTotal: 0, clubId: "", leagueId: "", division: 0 }
]));
let malformedWorldMatch;
assert.doesNotThrow(() => {
  malformedWorldMatch = sandbox.window.__lwTestPlayWorldMatch(
    malformedMatchWorld, malformedHomeClub, malformedAwayClub,
    1, 1, 1, 1, malformedMatchAccumulators, "league", malformedLineupCache
  );
}, "world match simulation must tolerate malformed saved player OVR and club power values");
assert.ok(Number.isInteger(malformedWorldMatch.homeGoals) && malformedWorldMatch.homeGoals >= 0);
assert.ok(Number.isInteger(malformedWorldMatch.awayGoals) && malformedWorldMatch.awayGoals >= 0);
assert.ok([...malformedMatchAccumulators.values()].every(row => Number.isFinite(row.ratingTotal)),
  "malformed ratings must never poison generated season rating totals");
const malformedPowerTableRow = sandbox.window.__lwTestTableRow(malformedHomeClub, 1, "test", 1);
assert.equal(malformedPowerTableRow.power, 64,
  "league-table tie-break power must fall back to the club's safe base power");

const malformedSeasonRatingWorld = { players: {}, clubs: {} };
const malformedSeasonRatingClub = {
  id: "malformed-season-rating-club", name: "Malformed Season Rating Club",
  country: "Testland", leagueId: "malformed-season-rating", division: 1,
  power: hostileSavedNumber, basePower: 64, prestige: 50, confederation: "CAF",
  matchesPerSeason: 34, roster: []
};
[
  { id: "malformed-season-rating-hostile", ovr: hostileSavedNumber },
  { id: "malformed-season-rating-array", ovr: [99, 100] },
  { id: "malformed-season-rating-valid", ovr: 74 }
].forEach(row => {
  malformedSeasonRatingWorld.players[row.id] = {
    id: row.id, name: row.id, clubId: malformedSeasonRatingClub.id,
    leagueId: malformedSeasonRatingClub.leagueId, division: 1, country: "Testland",
    group: "attacker", position: "مهاجم", age: 24, potential: 82,
    freeAgent: false, retired: false, isGenerated: false, ...row
  };
  malformedSeasonRatingClub.roster.push(row.id);
});
malformedSeasonRatingWorld.clubs[malformedSeasonRatingClub.id] = malformedSeasonRatingClub;
assert.equal(sandbox.window.__lwTestNormalizedClubPower(malformedSeasonRatingClub), 64,
  "season projections must use safe base power when the saved club power is malformed");
let malformedSeasonRatingRow;
assert.doesNotThrow(() => {
  malformedSeasonRatingRow = sandbox.window.__lwTestGeneratePlayerSeason(
    malformedSeasonRatingWorld,
    malformedSeasonRatingWorld.players["malformed-season-rating-hostile"],
    1, 1, new Map([["malformed-season-rating|1", 64]]),
    new Map([[malformedSeasonRatingClub.id, 34]])
  );
}, "season role ranking must tolerate malformed saved OVR values");
assert.ok(Number.isFinite(malformedSeasonRatingRow.averageRating));
assert.equal(malformedSeasonRatingRow.ovr, 55,
  "malformed player OVR must use the legacy neutral rating without rewriting the source player");
const malformedSeasonPowerRows = sandbox.window.__lwTestBuildPlayerRows(
  malformedSeasonRatingWorld, 1, new Map()
);
assert.equal(malformedSeasonPowerRows.length, 3);
assert.ok(malformedSeasonPowerRows.every(row => row.leagueStrength === 64),
  "season-stat rows must use a valid basePower when the saved current power is malformed");

// League-strength and player-stat paths must ignore hostile IDs and duplicate aliases
// without dropping the canonical club or rewriting any persisted source values.
const hostileSeasonClubIdentifier = {
  toString() { throw new Error("unsafe season-stat club ID coercion"); },
  valueOf() { throw new Error("unsafe season-stat club ID conversion"); }
};
const hostileSeasonLeagueIdentifier = {
  toString() { throw new Error("unsafe season-stat league ID coercion"); },
  valueOf() { throw new Error("unsafe season-stat league ID conversion"); }
};
const safeSeasonStatsWorld = {
  clubs: {
    "safe-season-stats-club-alias": {
      id: "safe-season-stats-club", name: "Stale Alias Club", country: "Testland",
      leagueId: "safe-season-stats-league", division: 1, power: 100, prestige: 10
    },
    "safe-season-stats-club": {
      id: "safe-season-stats-club", name: "Canonical Stats Club", country: "Testland",
      leagueId: "safe-season-stats-league", division: 1, power: 72, prestige: 60
    },
    "hostile-season-league-club": {
      id: "hostile-season-league-club", name: "Hostile League Club", country: "Testland",
      leagueId: hostileSeasonLeagueIdentifier, division: 1, power: 99
    },
    "hostile-season-club-id-key": {
      id: hostileSeasonClubIdentifier, name: "Hostile Club ID", country: "Testland",
      leagueId: "safe-season-stats-league", division: 1, power: 99
    }
  },
  players: {
    "safe-season-stats-player": {
      id: "safe-season-stats-player", name: "Safe Season Stats Player",
      clubId: "safe-season-stats-club", leagueId: "safe-season-stats-league", division: 1,
      position: "مهاجم", group: "attacker", age: 25, ovr: 72, potential: 80,
      retired: false, freeAgent: false, isGenerated: false
    },
    "hostile-season-club-player": {
      id: "hostile-season-club-player", name: "Hostile Club Player",
      clubId: "hostile-season-club-id-key", leagueId: "safe-season-stats-league", division: 1,
      position: "مهاجم", group: "attacker", age: 24, ovr: 75, potential: 82,
      retired: false, freeAgent: false, isGenerated: false
    }
  }
};
let safeSeasonStrengths, safeSeasonRows;
assert.doesNotThrow(() => {
  safeSeasonStrengths = sandbox.window.__lwTestBuildLeagueStrengthLookup(safeSeasonStatsWorld);
  safeSeasonRows = sandbox.window.__lwTestBuildPlayerRows(safeSeasonStatsWorld, 5, new Map([
    ["safe-season-stats-player", {
      appearances: 4, goals: 2, assists: 1, ratingTotal: 28,
      clubId: hostileSeasonClubIdentifier, leagueId: hostileSeasonLeagueIdentifier, division: 1
    }]
  ]));
}, "season-stat strength and player-row builders must not coerce hostile club or league identifiers");
assert.equal(safeSeasonStrengths.get("safe-season-stats-league|1"), 72,
  "league strength must count only the canonical club with a valid identifier");
assert.equal(safeSeasonStrengths.has("[object Object]|1"), false,
  "a malformed league identifier must never become a synthetic map key");
assert.equal(safeSeasonRows.length, 1,
  "players attached to clubs with malformed IDs must not receive misleading season rows");
assert.equal(safeSeasonRows[0].club, "Canonical Stats Club",
  "a stale dictionary alias must resolve to the canonical club record");
assert.equal(safeSeasonRows[0].clubId, "safe-season-stats-club",
  "a malformed accumulator club ID must fall back to the player's valid current club");
assert.equal(safeSeasonRows[0].leagueId, "safe-season-stats-league",
  "a malformed accumulator league ID must fall back to the player's valid league");
assert.equal(safeSeasonRows[0].leagueStrength, 72,
  "player performance weighting must use only the valid canonical club");
assert.strictEqual(safeSeasonStatsWorld.clubs["hostile-season-club-id-key"].id,
  hostileSeasonClubIdentifier, "season-stat validation must preserve malformed source club IDs");
assert.strictEqual(safeSeasonStatsWorld.clubs["hostile-season-league-club"].leagueId,
  hostileSeasonLeagueIdentifier, "season-stat validation must preserve malformed source league IDs");

// A malformed saved club ID must be ignored by unfinished-season projection, not coerced.
const hostileProjectionWorld = {
  projectionRevision: 0, dbVersion: 0, rosterSchemaVersion: 3, currentSeason: 1,
  lastAdvancedTo: 0, lastCompletedSeason: 0, transferSequence: 0,
  clubs: {
    "hostile-projection-club": {
      id: hostileSeasonClubIdentifier, name: "Hostile Projection Club",
      leagueId: "safe-projection-league", division: 1, power: 90, roster: []
    }
  },
  players: {
    "hostile-projection-player": {
      id: "hostile-projection-player", name: "Hostile Projection Player",
      clubId: "hostile-projection-club", leagueId: "safe-projection-league", division: 1,
      position: "ST", group: "attacker", age: 24, ovr: 70, potential: 75,
      retired: false, freeAgent: false
    }
  }
};
let hostileProjectionRows;
assert.doesNotThrow(() => {
  hostileProjectionRows = sandbox.window.__lwTestGetProjectedSeasonRows(hostileProjectionWorld, 1, db);
}, "unfinished-season projections must skip a club with an invalid persisted ID");
assert.equal(hostileProjectionRows.length, 0,
  "players attached to a club with a malformed ID must not receive projected appearances");

// Balanced fixture generation must ignore invalid and duplicate club IDs without
// changing the identities of valid home/away club records.
const hostileScheduleIdentifier = {
  toString() { throw new Error("unsafe balanced-schedule club ID coercion"); }
};
const hostileScheduleClub = {};
Object.defineProperty(hostileScheduleClub, "id", {
  enumerable: true, get() { throw new Error("unsafe balanced-schedule club ID getter"); }
});
let safeBalancedFixtures;
assert.doesNotThrow(() => {
  safeBalancedFixtures = sandbox.window.__lwTestBuildBalancedLeagueSchedule([
    { id: "safe-schedule-home", name: "Schedule Home" },
    { id: "safe-schedule-away", name: "Schedule Away" },
    { id: "safe-schedule-home", name: "Duplicate Schedule Alias" },
    { id: hostileScheduleIdentifier, name: "Hostile Schedule Club" },
    hostileScheduleClub,
    { name: "Missing Schedule ID" }
  ], 2, "safe-schedule-regression");
}, "balanced fixture generation must ignore malformed, throwing, and duplicate club IDs");
assert.equal(safeBalancedFixtures.length, 2,
  "the two valid unique clubs must still receive the configured two-match schedule");
assert.ok(safeBalancedFixtures.every(fixture =>
  ["safe-schedule-home", "safe-schedule-away"].includes(fixture.home.id)
  && ["safe-schedule-home", "safe-schedule-away"].includes(fixture.away.id)),
  "balanced fixtures must contain only valid unique clubs");
assert.equal(new Set(safeBalancedFixtures.flatMap(fixture => [fixture.home.id, fixture.away.id])).size, 2,
  "malformed aliases must not create extra fixture participants");
assert.equal(sandbox.window.__lwTestMarketClubPower(malformedSeasonRatingClub), 64,
  "shared club-power normalization must fall back to a valid basePower");
assert.equal(sandbox.window.__lwTestMarketClubPower({ power: 0, basePower: 90 }), 90,
  "a zero current power must not mask a valid basePower");
const highPowerFallbackClub = { power: hostileSavedNumber, basePower: 90, prestige: 90 };
assert.equal(sandbox.window.__lwTestInferArchetype(highPowerFallbackClub), "title-chaser",
  "paid-market club strategy must use basePower when current power is malformed");
assert.equal(ai.archetypeForClub(highPowerFallbackClub).id, "title-chaser",
  "the recruitment AI must classify a club from its valid basePower fallback");

// A stale free-agent ID must not occupy a squad slot or count toward recruitment needs.
const staleFreeAgentRosterWorld = { players: {
  active: { id: "active", group: "attacker", ovr: 70, freeAgent: false, retired: false },
  free: { id: "free", group: "attacker", ovr: 99, freeAgent: true, retired: false },
  retired: { id: "retired", group: "attacker", ovr: 98, freeAgent: false, retired: true }
}, nextGeneratedPlayer: 1, dbVersion: 0 };
const staleFreeAgentRosterClub = {
  id: "stale-free-agent-club", name: "Stale Free Agent Club", country: "Testland",
  leagueId: "test", division: 1, power: 60, basePower: 60, prestige: 50,
  roster: ["active", "free", "retired"]
};
assert.equal(sandbox.window.__lwTestRosterPlayers(staleFreeAgentRosterWorld, staleFreeAgentRosterClub)
  .map(player => player.id).join(","), "active",
  "free agents and retired players must not count toward an active club's roster needs");
sandbox.window.__lwTestFillRoster(staleFreeAgentRosterWorld, staleFreeAgentRosterClub);
assert.ok(!staleFreeAgentRosterClub.roster.includes("free"),
  "roster repair must remove stale free-agent IDs before filling vacancies");
assert.ok(!staleFreeAgentRosterClub.roster.includes("retired"),
  "roster repair must keep retired players out of active squads");
assert.equal(staleFreeAgentRosterClub.roster.length, 16,
  "roster repair must refill the squad after removing unattached players");

// Legacy transfers can leave the same player ID in both the old and new club rosters.
// The player's current clubId is authoritative; ambiguous legacy rows remain stored as
// player records but are removed from both squads rather than being counted twice.
const rosterMigrationLeague = db.leagues().find(row => row && row.id) || {};
const rosterMigrationLeagueId = String(rosterMigrationLeague.id || "legacy-roster-test");
const rosterMigrationSave = { season: 1, worldSimulation: {
  schemaVersion: 1, dbVersion: Number(db.version) || 0, currentSeason: 1,
  lastCompletedSeason: 0, lastAdvancedTo: 0, rosterSchemaVersion: 3,
  rosterMembershipSchemaVersion: 0, completedSeasons: [], seasonStats: {}, leagueTables: {},
  transfers: [], marketReports: [], playerHistory: {}, notes: [], nextGeneratedPlayer: 1,
  transferSequence: 0, projectionRevision: 0,
  clubs: {
    "membership-origin": { id: "membership-origin", name: "Origin Club", country: "Testland",
      leagueId: rosterMigrationLeagueId, division: 1,
      roster: ["membership-transferred", "membership-origin-player", "membership-origin-player",
        "membership-legacy-unique", "membership-legacy-ambiguous"] },
    "membership-destination": { id: "membership-destination", name: "Destination Club", country: "Testland",
      leagueId: rosterMigrationLeagueId, division: 1,
      roster: ["membership-transferred", "membership-destination-player", "membership-transferred",
        "membership-legacy-ambiguous"] }
  },
  players: {
    "membership-transferred": { id: "membership-transferred", name: "Transferred", clubId: "membership-destination",
      group: "midfielder", ovr: 90, retired: false, freeAgent: false },
    "membership-origin-player": { id: "membership-origin-player", name: "Origin Player", clubId: "membership-origin",
      group: "defender", ovr: 70, retired: false, freeAgent: false },
    "membership-destination-player": { id: "membership-destination-player", name: "Destination Player",
      clubId: "membership-destination", group: "attacker", ovr: 72, retired: false, freeAgent: false },
    "membership-legacy-unique": { id: "membership-legacy-unique", name: "Legacy Unique",
      clubId: "", group: "goalkeeper", ovr: 68, retired: false, freeAgent: false },
    "membership-legacy-ambiguous": { id: "membership-legacy-ambiguous", name: "Legacy Ambiguous",
      clubId: "", group: "midfielder", ovr: 85, retired: false, freeAgent: false }
  }
} };
const rosterMigrationWorld = ai.ensureState(rosterMigrationSave, db);
assert.equal(rosterMigrationWorld.rosterMembershipSchemaVersion, 6,
  "legacy saves must run the one-time roster ownership migration");
assert.equal(rosterMigrationWorld.transferClubHistorySchemaVersion, 1,
  "legacy saves must migrate the compact per-player transfer-club history");
assert.deepEqual(rosterMigrationWorld.clubs["membership-origin"].roster,
  ["membership-origin-player", "membership-legacy-unique"],
  "the former club must drop transferred and duplicate IDs while retaining its unique legacy player");
assert.deepEqual(rosterMigrationWorld.clubs["membership-destination"].roster,
  ["membership-transferred", "membership-destination-player"],
  "the destination club must retain the transferred player exactly once");
assert.equal(rosterMigrationWorld.players["membership-legacy-unique"].clubId, "membership-origin",
  "a legacy player with exactly one roster membership can safely recover the owning club");
assert.ok(rosterMigrationWorld.players["membership-legacy-ambiguous"],
  "ambiguous legacy player data must be preserved even when no safe club can be inferred");
assert.ok(!rosterMigrationWorld.clubs["membership-origin"].roster.includes("membership-legacy-ambiguous")
  && !rosterMigrationWorld.clubs["membership-destination"].roster.includes("membership-legacy-ambiguous"),
  "an ambiguous legacy player must not be counted in two clubs");
assert.ok(!sandbox.window.__lwTestRosterPlayers(rosterMigrationWorld, rosterMigrationWorld.clubs["membership-origin"])
  .some(player => player.id === "membership-transferred"),
  "old-club squad calculations must ignore a player whose canonical clubId points elsewhere");
assert.ok(!sandbox.window.__lwTestPlayersForClub(rosterMigrationWorld, rosterMigrationWorld.clubs["membership-origin"])
  .some(player => player.id === "membership-transferred"),
  "matchday player selection must not include a stale cross-club roster reference");
assert.ok(sandbox.window.__lwTestMakeLineup(rosterMigrationWorld, rosterMigrationWorld.clubs["membership-origin"])
  .every(player => player.id !== "membership-transferred"),
  "the former club must never field a transferred player from a stale roster ID");
assert.ok(sandbox.window.__lwTestMakeLineup(rosterMigrationWorld, rosterMigrationWorld.clubs["membership-destination"])
  .some(player => player.id === "membership-transferred"),
  "the destination club must continue to field the transferred player");


// Legacy boolean-like strings must not make active players look retired/free agents.
const legacyFlagClubId = "legacy-string-flag-club";
const legacyFlagSave = { season: 1, worldSimulation: {
  schemaVersion: 1, dbVersion: Number(db.version) || 0, currentSeason: 1,
  lastCompletedSeason: 0, lastAdvancedTo: 0, seasonStats: {}, leagueTables: {},
  completedSeasons: [], transfers: [], marketReports: [], playerHistory: {},
  nextGeneratedPlayer: 1, transferSequence: 0, projectionRevision: 0,
  rosterSchemaVersion: 3, rosterMembershipSchemaVersion: 3,
  clubs: {
    [legacyFlagClubId]: { id: legacyFlagClubId, name: "Legacy Flag Club", country: "Testland",
      leagueId: rosterMigrationLeagueId, division: 1, power: 70, basePower: 70,
      roster: ["legacy-flag-false", "legacy-flag-zero", "legacy-flag-retired", "legacy-flag-free"] }
  },
  players: {
    "legacy-flag-false": { id: "legacy-flag-false", name: "False String", clubId: legacyFlagClubId,
      group: "attacker", position: "ST", ovr: 70, potential: 75, age: 24, contractSeasons: 2,
      retired: "false", freeAgent: "false" },
    "legacy-flag-zero": { id: "legacy-flag-zero", name: "Zero String", clubId: legacyFlagClubId,
      group: "attacker", position: "ST", ovr: 68, potential: 73, age: 25, contractSeasons: 2,
      retired: "0", freeAgent: "0" },
    "legacy-flag-retired": { id: "legacy-flag-retired", name: "Retired String", clubId: legacyFlagClubId,
      group: "attacker", position: "ST", ovr: 80, potential: 80, age: 40, contractSeasons: 0,
      retired: "true", freeAgent: "false" },
    "legacy-flag-free": { id: "legacy-flag-free", name: "Free String", clubId: legacyFlagClubId,
      group: "midfielder", position: "CM", ovr: 72, potential: 77, age: 26, contractSeasons: 0,
      retired: "false", freeAgent: "true" }
  }
} };
const legacyFlagWorld = ai.ensureState(legacyFlagSave, db);
const legacyFlagClub = legacyFlagWorld.clubs[legacyFlagClubId];
assert.equal(legacyFlagWorld.rosterMembershipSchemaVersion, 6,
  "v3 saves must normalize legacy string-valued player status flags once");
assert.deepEqual(ai.rosterPlayers(legacyFlagWorld, legacyFlagClub).map(player => player.id).sort(),
  ["legacy-flag-false", "legacy-flag-zero"],
  "string false/zero flags must keep active players while true flags detach retired/free agents");
assert.equal(legacyFlagWorld.players["legacy-flag-false"].retired, false);
assert.equal(legacyFlagWorld.players["legacy-flag-false"].freeAgent, false);
assert.equal(legacyFlagWorld.players["legacy-flag-zero"].retired, false);
assert.equal(legacyFlagWorld.players["legacy-flag-zero"].freeAgent, false);
assert.equal(legacyFlagWorld.players["legacy-flag-retired"].retired, true);
assert.equal(legacyFlagWorld.players["legacy-flag-retired"].freeAgent, false);
assert.equal(legacyFlagWorld.players["legacy-flag-retired"].previousClubId, legacyFlagClubId);
assert.equal(legacyFlagWorld.players["legacy-flag-free"].retired, false);
assert.equal(legacyFlagWorld.players["legacy-flag-free"].freeAgent, true);
assert.equal(legacyFlagWorld.players["legacy-flag-free"].previousClubId, legacyFlagClubId);
assert.ok(!legacyFlagClub.roster.includes("legacy-flag-retired")
  && !legacyFlagClub.roster.includes("legacy-flag-free"),
  "true retirement/free-agent flags must remove stale squad membership without deleting player records");

const missingMembershipSave = { season: 1, worldSimulation: {
  schemaVersion: 1, dbVersion: Number(db.version) || 0, currentSeason: 1,
  lastCompletedSeason: 0, lastAdvancedTo: 0, rosterSchemaVersion: 3,
  rosterMembershipSchemaVersion: 2, completedSeasons: [], seasonStats: {}, leagueTables: {},
  transfers: [], marketReports: [], playerHistory: {}, notes: [], nextGeneratedPlayer: 77,
  transferSequence: 0, projectionRevision: 4,
  clubs: {
    "membership-gap-origin": { id: "membership-gap-origin", name: "Membership Gap Origin", country: "Testland",
      leagueId: rosterMigrationLeagueId, division: 1,
      roster: ["membership-gap-existing", "membership-gap-existing", "membership-gap-transferred", "membership-gap-retired", "membership-gap-free", "membership-gap-retired-unowned", "membership-gap-free-unowned"] },
    "membership-gap-destination": { id: "membership-gap-destination", name: "Membership Gap Destination", country: "Testland",
      leagueId: rosterMigrationLeagueId, division: 1, roster: ["membership-gap-transferred"] }
  },
  players: {
    "membership-gap-existing": { id: "membership-gap-existing", name: "Existing Member",
      clubId: "membership-gap-origin", group: "attacker", ovr: 71, retired: false, freeAgent: false },
    "membership-gap-unlisted": { id: "membership-gap-unlisted", name: "Missing Roster Reference",
      clubId: "membership-gap-origin", group: "defender", ovr: 83, retired: false, freeAgent: false },
    "membership-gap-transferred": { id: "membership-gap-transferred", name: "Transferred Member",
      clubId: "membership-gap-destination", group: "midfielder", ovr: 79, retired: false, freeAgent: false },
    "membership-gap-retired": { id: "membership-gap-retired", name: "Retired Member",
      clubId: "membership-gap-origin", leagueId: rosterMigrationLeagueId, division: 1,
      group: "goalkeeper", ovr: 66, retired: true, freeAgent: false },
    "membership-gap-free": { id: "membership-gap-free", name: "Free Member",
      clubId: "membership-gap-origin", leagueId: rosterMigrationLeagueId, division: 1,
      group: "midfielder", ovr: 69, retired: false, freeAgent: true },
    "membership-gap-retired-unowned": { id: "membership-gap-retired-unowned", name: "Retired Unowned",
      clubId: "", leagueId: "", division: 0, group: "defender", ovr: 64, retired: true, freeAgent: false },
    "membership-gap-free-unowned": { id: "membership-gap-free-unowned", name: "Free Unowned",
      clubId: "", leagueId: "", division: 0, group: "midfielder", ovr: 67, retired: false, freeAgent: true }
  }
} };
const missingMembershipPlayerCount = Object.keys(missingMembershipSave.worldSimulation.players).length;
const missingMembershipNextGenerated = missingMembershipSave.worldSimulation.nextGeneratedPlayer;
const missingMembershipWorld = ai.ensureState(missingMembershipSave, db);
assert.equal(missingMembershipWorld.rosterMembershipSchemaVersion, 6,
  "version-one saves must receive the missing-membership repair migration");
assert.deepEqual(missingMembershipWorld.clubs["membership-gap-origin"].roster,
  ["membership-gap-existing", "membership-gap-unlisted"],
  "a canonical owner missing from every roster must be restored without keeping stale transfers or duplicate IDs");
assert.deepEqual(missingMembershipWorld.clubs["membership-gap-destination"].roster,
  ["membership-gap-transferred"],
  "the transferred player must remain attached only to the canonical destination club");
assert.ok(missingMembershipWorld.clubs["membership-gap-origin"].roster.includes("membership-gap-unlisted"),
  "a player with a valid clubId but no roster reference must be restored to that club");
assert.ok(["membership-gap-retired", "membership-gap-free", "membership-gap-retired-unowned", "membership-gap-free-unowned"]
  .every(id => !missingMembershipWorld.clubs["membership-gap-origin"].roster.includes(id)),
  "retired players and free agents must be detached from every active squad");
for (const id of ["membership-gap-retired", "membership-gap-free", "membership-gap-retired-unowned", "membership-gap-free-unowned"]) {
  const player = missingMembershipWorld.players[id];
  assert.ok(player, "inactive player records must be preserved during roster migration");
  assert.equal(player.clubId, "", "retired players and free agents must not regain a current club");
  assert.equal(player.leagueId, "", "unattached players must not retain an active league");
  assert.equal(player.division, 0, "unattached players must not retain an active division");
  assert.equal(player.contractSeasons, 0, "unattached players must not retain an active contract");
  assert.equal(player.previousClubId, "membership-gap-origin",
    "the former club must be preserved separately from current club ownership");
}
assert.equal(missingMembershipWorld.players["membership-gap-retired"].freeAgent, false,
  "retired players must not be reclassified as free agents");
assert.equal(missingMembershipWorld.players["membership-gap-free"].freeAgent, true,
  "free-agent status must remain authoritative after migration");
assert.equal(Object.keys(missingMembershipWorld.players).length, missingMembershipPlayerCount,
  "roster repair must preserve every existing player record without generating replacements");
assert.equal(missingMembershipWorld.nextGeneratedPlayer, missingMembershipNextGenerated,
  "roster membership migration must not allocate synthetic replacement players");
assert.equal(missingMembershipWorld.projectionRevision, 5,
  "roster membership migration must invalidate cached squad-strength projections");
assert.ok(ai.rosterPlayers(missingMembershipWorld, missingMembershipWorld.clubs["membership-gap-origin"])
  .some(player => player.id === "membership-gap-unlisted"),
  "restored players must count in squad-strength calculations");
assert.ok(sandbox.window.__lwTestMakeLineup(missingMembershipWorld, missingMembershipWorld.clubs["membership-gap-origin"])
  .some(player => player.id === "membership-gap-unlisted"),
  "restored players must be eligible for their club's matchday lineup");

// Roster migration must never coerce untrusted saved identifiers or drop player records.
const hostileRosterValue = {
  toString() { throw new Error("hostile roster player ID coercion"); },
  valueOf() { throw new Error("hostile roster player ID conversion"); }
};
const hostileClubValue = {
  toString() { throw new Error("hostile club ID coercion"); },
  valueOf() { throw new Error("hostile club ID conversion"); }
};
const hostilePreviousClubValue = {
  toString() { throw new Error("hostile previous club ID coercion"); },
  valueOf() { throw new Error("hostile previous club ID conversion"); }
};
const hostileMetadataValue = {
  toString() { throw new Error("hostile club metadata coercion"); },
  valueOf() { throw new Error("hostile club metadata conversion"); }
};
const hostileRosterSave = { season: 4, worldSimulation: {
  schemaVersion: ai.version, dbVersion: Number(db.version) || 0, currentSeason: 4,
  lastCompletedSeason: 3, lastAdvancedTo: 4, rosterSchemaVersion: 3,
  rosterMembershipSchemaVersion: 5, completedSeasons: [1, 2, 3],
  seasonStats: {}, leagueTables: {}, transfers: [], marketReports: [], playerHistory: {},
  notes: [], nextGeneratedPlayer: 91, transferSequence: 0, projectionRevision: 12,
  clubs: {
    "safe-roster-club": {
      id: "safe-roster-club", name: "Safe Roster Club", country: hostileMetadataValue,
      leagueId: hostileMetadataValue, division: 1,
      roster: ["safe-roster-player", hostileRosterValue, 7002, "7002",
        "hostile-owner-player", "retired-hostile-player", Symbol("invalid-roster-id")]
    },
    "fallback-roster-club": {
      name: "Fallback Roster Club", country: "Testland",
      leagueId: rosterMigrationLeagueId, division: 1, roster: ["fallback-roster-player"]
    },
    "malformed-roster-club": {
      id: hostileClubValue, name: "Malformed ID Club", country: "Testland",
      leagueId: rosterMigrationLeagueId, division: 1, roster: ["malformed-owner-player"]
    }
  },
  players: {
    "safe-roster-player": {
      id: "safe-roster-player", name: "Safe Player", clubId: "safe-roster-club",
      country: "Legacy Country", leagueId: "legacy-league", division: 1,
      retired: false, freeAgent: false
    },
    "7002": {
      id: "7002", name: "Numeric Legacy Player", clubId: "safe-roster-club",
      retired: false, freeAgent: false
    },
    "hostile-owner-player": {
      id: "hostile-owner-player", name: "Recoverable Legacy Owner", clubId: hostileClubValue,
      country: "Legacy Country", leagueId: "legacy-league", division: 1,
      retired: false, freeAgent: false
    },
    "retired-hostile-player": {
      id: "retired-hostile-player", name: "Retired Legacy Player", clubId: "safe-roster-club",
      previousClubId: hostilePreviousClubValue, retired: true, freeAgent: false
    },
    "fallback-roster-player": {
      id: "fallback-roster-player", name: "Fallback Owner", clubId: "fallback-roster-club",
      retired: false, freeAgent: false
    },
    "malformed-owner-player": {
      id: "malformed-owner-player", name: "Malformed Club Owner", clubId: "malformed-roster-club",
      retired: false, freeAgent: false
    }
  }
} };
const hostileRosterPlayerCount = Object.keys(hostileRosterSave.worldSimulation.players).length;
const hostileRosterNextGenerated = hostileRosterSave.worldSimulation.nextGeneratedPlayer;
let hostileRosterWorld;
assert.doesNotThrow(() => {
  hostileRosterWorld = ai.ensureState(hostileRosterSave, db);
}, "legacy roster migration must ignore hostile IDs without aborting save hydration");
assert.equal(hostileRosterWorld.rosterMembershipSchemaVersion, 6,
  "v5 saves must receive the safe roster-identifier migration exactly once");
assert.deepEqual(hostileRosterWorld.clubs["safe-roster-club"].roster,
  ["safe-roster-player", 7002, "hostile-owner-player"],
  "safe string/numeric IDs must survive in their original saved representation, duplicate numeric aliases must collapse, and hostile IDs must be skipped");
assert.deepEqual(hostileRosterWorld.clubs["fallback-roster-club"].roster,
  ["fallback-roster-player"],
  "legacy clubs without an explicit ID must use their saved object key as the canonical ID");
assert.equal(hostileRosterWorld.players["hostile-owner-player"].clubId, "safe-roster-club",
  "a player with a malformed legacy owner ID must recover from one safe roster membership");
assert.equal(hostileRosterWorld.players["safe-roster-player"].country, "Legacy Country",
  "malformed club country metadata must not overwrite a player's last known country");
assert.equal(hostileRosterWorld.players["safe-roster-player"].leagueId, "legacy-league",
  "malformed club league IDs must not overwrite a player's last known league");
assert.equal(hostileRosterWorld.players["retired-hostile-player"].previousClubId, "safe-roster-club",
  "a hostile previous-club ID must be safely replaced by the known former club");
assert.equal(hostileRosterWorld.players["retired-hostile-player"].clubId, "",
  "retired players must remain unattached after hostile-ID migration");
assert.ok(hostileRosterWorld.players["malformed-owner-player"],
  "players referenced only by a club with an invalid ID must remain stored");
assert.equal(hostileRosterWorld.players["malformed-owner-player"].clubId, "malformed-roster-club",
  "an invalid club ID must not be silently rewritten to the object's storage key");
assert.deepEqual(hostileRosterWorld.clubs["malformed-roster-club"].roster, ["malformed-owner-player"],
  "a malformed club's stored roster references must be preserved even though the club is excluded from active squads");
assert.equal(ai.rosterPlayers(hostileRosterWorld, hostileRosterWorld.clubs["malformed-roster-club"]).length, 0,
  "a club with an invalid explicit ID must not expose stale roster members as active players");
assert.deepEqual(Array.from(ai.rosterPlayers(hostileRosterWorld, hostileRosterWorld.clubs["fallback-roster-club"]),
  player => player.id), ["fallback-roster-player"],
  "active roster reads must resolve a missing legacy club ID from its world-map key");
assert.equal(Object.keys(hostileRosterWorld.players).length, hostileRosterPlayerCount,
  "hostile roster migration must preserve every original player record");
assert.equal(hostileRosterWorld.nextGeneratedPlayer, hostileRosterNextGenerated,
  "identifier repair must not fabricate replacement players");
assert.equal(hostileRosterWorld.projectionRevision, 13,
  "the new roster migration must invalidate unfinished season projections once");
// Transfer-history hydration runs before roster migration and must also reject hostile saved IDs safely.
const hostileTransferPlayerValue = {
  toString() { throw new Error("hostile transfer player ID coercion"); },
  valueOf() { throw new Error("hostile transfer player ID conversion"); }
};
const hostileTransferClubValue = {
  toString() { throw new Error("hostile transfer club ID coercion"); },
  valueOf() { throw new Error("hostile transfer club ID conversion"); }
};
const hostileTransferTextValue = {
  toString() { throw new Error("hostile transfer name coercion"); },
  valueOf() { throw new Error("hostile transfer name conversion"); }
};
const throwingTransferRecord = {};
Object.defineProperty(throwingTransferRecord, "playerId", {
  enumerable: true,
  get() { throw new Error("hostile transfer playerId getter"); }
});
const transferHistoryPlayerHistory = {
  "safe-transfer-player": [{
    fromClubId: "old-club-id", from: "Old Club", fromCountry: "Egypt",
    clubId: "safe-transfer-club", club: "Safe Club", country: "Egypt"
  }]
};
Object.defineProperty(transferHistoryPlayerHistory, "__proto__", {
  value: [{ clubId: "proto-club", club: "Proto Club", country: "Egypt" }],
  enumerable: true, configurable: true, writable: true
});
const transferHistorySave = { season: 1, worldSimulation: {
  schemaVersion: ai.version, dbVersion: Number(db.version) || 0, currentSeason: 1,
  lastCompletedSeason: 0, lastAdvancedTo: 1, rosterSchemaVersion: 3,
  rosterMembershipSchemaVersion: 6, transferClubHistorySchemaVersion: 0,
  seasonStats: {}, leagueTables: {}, completedSeasons: [], marketReports: [],
  transfers: [
    { playerId: hostileTransferPlayerValue, fromClubId: hostileTransferClubValue,
      from: hostileTransferTextValue, toClubId: "ignored-hostile-player", to: "Ignored Club" },
    { playerId: "safe-transfer-player", fromClubId: hostileTransferClubValue,
      from: "Old Club", fromCountry: "Egypt", toClubId: "safe-transfer-club",
      to: "Safe Club", toCountry: "Egypt" },
    throwingTransferRecord,
    { playerId: 7002, fromClubId: "numeric-old-club", from: "Numeric Old Club", fromCountry: "Egypt" },
    { playerId: "__proto__", fromClubId: "proto-transfer-club", from: "Proto Transfer Club", fromCountry: "Egypt" }
  ],
  playerHistory: transferHistoryPlayerHistory,
  archive: { playerHistory: {
    "safe-transfer-player": [{ fromClubId: "old-club-id", from: "Old Club", fromCountry: "Egypt" }]
  } },
  clubs: {}, players: {}, nextGeneratedPlayer: 1, transferSequence: 0, projectionRevision: 0
} };
const originalTransferCount = transferHistorySave.worldSimulation.transfers.length;
const originalPlayerHistoryKeys = Object.keys(transferHistoryPlayerHistory);
let transferHistoryWorld;
assert.doesNotThrow(() => {
  transferHistoryWorld = ai.ensureState(transferHistorySave, db);
}, "transfer-history migration must safely ignore hostile IDs and throwing property getters");
const transferHistory = transferHistoryWorld.transferClubHistoryByPlayer;
assert.equal(transferHistoryWorld.transferClubHistorySchemaVersion, 1,
  "safe transfer-history migration must retain the existing schema version");
assert.deepEqual(Array.from(transferHistory["safe-transfer-player"], row => row.clubId),
  ["old-club-id", "safe-transfer-club"],
  "legacy transfer and player-history endpoints must merge without duplicate club records");
assert.deepEqual(Array.from(transferHistory["safe-transfer-player"], row => row.name),
  ["Old Club", "Safe Club"],
  "safe club names must survive while hostile transfer text is ignored");
assert.equal(transferHistory["7002"].length, 1,
  "numeric legacy player IDs must be preserved as stable string keys");
assert.equal(transferHistory["7002"][0].clubId, "numeric-old-club");
assert.ok(Object.prototype.hasOwnProperty.call(transferHistory, "__proto__"),
  "a literal __proto__ player ID must be stored as an own history key, not mutate the history prototype");
assert.equal(transferHistory["__proto__"][0].clubId, "proto-transfer-club");
assert.equal(Object.getPrototypeOf(transferHistory).clubId, undefined,
  "transfer-history keys must not alter the history map prototype");
assert.equal(Object.keys(transferHistory).includes("ignored-hostile-player"), false,
  "a transfer with an invalid player ID must not create a fabricated history entry");
assert.equal(transferHistorySave.worldSimulation.transfers.length, originalTransferCount,
  "transfer-history migration must not delete or rewrite source transfer records");
assert.deepEqual(Object.keys(transferHistoryPlayerHistory), originalPlayerHistoryKeys,
  "transfer-history migration must preserve the source player-history map");
assert.equal(Object.keys(transferHistoryWorld.players).length, 0,
  "transfer-history migration must not generate player records");

const hostileLineupPlayer = {
  id: hostileRosterValue, name: "Hostile lineup identity", clubId: "hostile-lineup-club",
  group: "attacker", position: "ST", ovr: 70, retired: false, freeAgent: false
};
const hostileLineupWorld = {
  players: { "hostile-lineup-player": hostileLineupPlayer },
  clubs: { "hostile-lineup-club": {
    id: "hostile-lineup-club", name: "Hostile Lineup Club",
    roster: ["hostile-lineup-player"]
  } }
};
assert.doesNotThrow(() => sandbox.window.__lwTestMakeLineup(
  hostileLineupWorld, hostileLineupWorld.clubs["hostile-lineup-club"]
), "lineup tie-breaking must not coerce a malformed saved player ID");

// A v4 save can already have a canonical clubId while retaining stale league metadata.
// The one-time v6 migration must overwrite stale values from the canonical club in both
// ownership paths: direct clubId ownership and a single unambiguous legacy roster link.
const metadataSyncClubId = "metadata-sync-club";
const metadataSyncSave = { season: 6, worldSimulation: {
  schemaVersion: 1, dbVersion: Number(db.version) || 0, currentSeason: 6,
  lastCompletedSeason: 5, lastAdvancedTo: 6, rosterSchemaVersion: 3,
  rosterMembershipSchemaVersion: 4, completedSeasons: [], seasonStats: {}, leagueTables: {},
  transfers: [], marketReports: [], playerHistory: {}, notes: [], nextGeneratedPlayer: 1,
  transferSequence: 0, projectionRevision: 9,
  clubs: {
    [metadataSyncClubId]: { id: metadataSyncClubId, name: "Metadata Sync Club",
      country: "Canonical Country", leagueId: rosterMigrationLeagueId, division: 2,
      roster: ["metadata-stale-owner", "metadata-stale-inferred"] }
  },
  players: {
    "metadata-stale-owner": { id: "metadata-stale-owner", name: "Stale Owner Metadata",
      clubId: metadataSyncClubId, country: "Old Country", leagueId: "old-league", division: 1,
      group: "attacker", position: "ST", ovr: 78, potential: 84, age: 24,
      contractSeasons: 2, retired: false, freeAgent: false },
    "metadata-stale-inferred": { id: "metadata-stale-inferred", name: "Stale Inferred Metadata",
      clubId: "", country: "Wrong Country", leagueId: "wrong-league", division: 8,
      group: "midfielder", position: "CM", ovr: 72, potential: 79, age: 25,
      contractSeasons: 2, retired: false, freeAgent: false }
  }
} };
const metadataSyncWorld = ai.ensureState(metadataSyncSave, db);
const metadataSyncClub = metadataSyncWorld.clubs[metadataSyncClubId];
assert.equal(metadataSyncWorld.rosterMembershipSchemaVersion, 6,
  "v4 saves must run the new canonical player-club metadata migration");
for (const id of ["metadata-stale-owner", "metadata-stale-inferred"]) {
  const player = metadataSyncWorld.players[id];
  assert.equal(player.clubId, metadataSyncClubId,
    "canonical club ownership must be retained or recovered during metadata migration");
  assert.equal(player.country, metadataSyncClub.country,
    "player country metadata must be synchronized from the canonical owning club");
  assert.equal(player.leagueId, metadataSyncClub.leagueId,
    "stale player league IDs must be replaced with the canonical owning club league");
  assert.equal(player.division, 2,
    "stale player divisions must be replaced with the canonical owning club division");
}
assert.deepEqual(metadataSyncClub.roster, ["metadata-stale-owner", "metadata-stale-inferred"],
  "metadata migration must retain each existing player exactly once in the owning club");
assert.equal(Object.keys(metadataSyncWorld.players).length, 2,
  "metadata migration must not delete or generate player records");
assert.equal(metadataSyncWorld.nextGeneratedPlayer, 1,
  "metadata migration must not allocate generated players");
assert.equal(metadataSyncWorld.projectionRevision, 10,
  "the metadata migration must invalidate cached season projections once");

const duplicateFillWorld = { players: {
  "fill-transferred": { id: "fill-transferred", clubId: "fill-destination", group: "attacker", ovr: 95 },
  "fill-active": { id: "fill-active", clubId: "fill-origin", group: "midfielder", ovr: 70 }
}, nextGeneratedPlayer: 1, dbVersion: 1 };
const duplicateFillClub = { id: "fill-origin", name: "Fill Origin", country: "Testland",
  basePower: 60, power: 60, roster: ["fill-transferred", "fill-active", "fill-active"] };
sandbox.window.__lwTestFillRoster(duplicateFillWorld, duplicateFillClub);
assert.deepEqual(duplicateFillClub.roster.filter(id => id === "fill-active"), ["fill-active"],
  "roster refill must collapse duplicate IDs without deleting the player record");
assert.ok(!duplicateFillClub.roster.includes("fill-transferred"),
  "roster refill must remove a player who now belongs to another club");
assert.ok(duplicateFillWorld.players["fill-transferred"],
  "cross-club cleanup must preserve the transferred player's career record");


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
const unlistedDivisionPlayer = {
  id: "division-reconcile-unlisted-player", name: "Division Reconcile Unlisted Player",
  clubId: transferCompetitionWorldClub.id, division: 1, position: "وسط", group: "midfielder"
};
transferCompetitionWorld.players[unlistedDivisionPlayer.id] = unlistedDivisionPlayer;
sandbox.window.__lwTestReconcileDatabase(transferCompetitionWorld, db);
assert.equal(transferCompetitionWorldClub.leagueName, secondTierProfile.name,
  "database reconciliation must retain the simulated second-tier local competition label");
assert.equal(transferCompetitionWorldClub.leagueEnglish, secondTierProfile.englishName,
  "database reconciliation must retain the simulated second-tier English competition label");
assert.equal(transferCompetitionWorldClub.matchesPerSeason, secondTierProfile.matchesPerSeason,
  "database reconciliation must retain the current division's season length");
assert.ok(Object.values(transferCompetitionWorld.players).filter(player => player.clubId === transferCompetitionWorldClub.id)
  .every(player => Number(player.division) === 2),
  "database reconciliation must synchronize every attached player's dynamic division");
const secondTierTarget = ai.transferTargets(transferCompetitionSave, db).find(target =>
  target.club === transferCompetitionSeed.name && target.country === transferCompetitionSeed.country);
assert.equal(secondTierTarget.division, 2, "the transfer target must preserve the simulated second-tier division");
assert.equal(secondTierTarget.league, secondTierProfile.name,
  "a relegated club must advertise the second-tier competition instead of its seed-time first-tier league");
assert.equal(secondTierTarget.leagueEnglish, secondTierProfile.englishName,
  "the English competition label must also follow the current division");
transferCompetitionWorldClub.division = 1;
sandbox.window.__lwTestReconcileDatabase(transferCompetitionWorld, db);
const firstTierProfile = db.leagueFor(transferCompetitionSeed.country, 1);
assert.equal(transferCompetitionWorldClub.leagueName, firstTierProfile.name,
  "database reconciliation must restore first-tier labels after promotion");
assert.equal(transferCompetitionWorldClub.matchesPerSeason, firstTierProfile.matchesPerSeason,
  "database reconciliation must restore first-tier season length after promotion");
assert.ok(Object.values(transferCompetitionWorld.players).filter(player => player.clubId === transferCompetitionWorldClub.id)
  .every(player => Number(player.division) === 1),
  "database reconciliation must synchronize attached players after promotion");
const firstTierTarget = ai.transferTargets(transferCompetitionSave, db).find(target =>
  target.club === transferCompetitionSeed.name && target.country === transferCompetitionSeed.country);
assert.equal(firstTierTarget.league, db.leagueFor(transferCompetitionSeed.country, 1).name,
  "a promoted club must return to the first-tier competition label without rewriting its roster");

// Transfer windows must include lower divisions and schedule buyers fairly by division.
assert.equal(typeof sandbox.window.__lwTestRunTransferWindow, "function", "the world transfer-window simulator must be available to the regression guard");
assert.equal(typeof sandbox.window.__lwTestSignFreeAgents, "function", "the free-agent signing simulator must be available to the regression guard");
assert.equal(typeof sandbox.window.__lwTestFillRoster, "function", "the roster filler must be available to the regression guard");
assert.equal(typeof sandbox.window.__lwTestRosterPlayers, "function", "active roster players must be available to the free-agent regression guard");
assert.equal(typeof sandbox.window.__lwTestBaseGetSeasonLines, "function", "projected season lines must be available to the regression guard");
assert.equal(typeof sandbox.window.__lwTestBaseCompleteSeason, "function", "legacy season completion must be available to the regression guard");
assert.equal(typeof sandbox.window.__lwTestBuildPlayerRows, "function", "shared season rows must be available to the regression guard");
assert.equal(typeof sandbox.window.__lwTestBuildLeagueStrengthLookup, "function",
  "season league-strength lookup must be available to the malformed-identifier regression guard");
assert.equal(typeof sandbox.window.__lwTestBuildBalancedLeagueSchedule, "function",
  "balanced schedule builder must be available to the malformed-identifier regression guard");
assert.equal(typeof sandbox.window.__lwTestGetProjectedSeasonRows, "function",
  "projected season rows must be available to the malformed-identifier regression guard");
 
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

 // Unattached free agents must not receive invented appearances or production in later seasons.
 const freeAgentSeasonPlayer = Object.values(retiredSeasonWorld.players).find(player =>
   player && !player.retired && player.clubId);
 assert.ok(freeAgentSeasonPlayer, "the free-agent projection fixture must start from an attached player");
 const freeAgentSeasonClub = retiredSeasonWorld.clubs[freeAgentSeasonPlayer.clubId];
 freeAgentSeasonClub.roster = freeAgentSeasonClub.roster.filter(id => id !== freeAgentSeasonPlayer.id);
 freeAgentSeasonPlayer.previousClubId = freeAgentSeasonPlayer.clubId;
 freeAgentSeasonPlayer.clubId = "";
 freeAgentSeasonPlayer.leagueId = "";
 freeAgentSeasonPlayer.division = 0;
 freeAgentSeasonPlayer.freeAgent = true;
 const freeAgentProjectedRows = sandbox.window.__lwTestBaseGetSeasonLines(retiredSeasonSave, 3, 1, db);
 assert.ok(!freeAgentProjectedRows.some(row => row.id === freeAgentSeasonPlayer.id),
   "free agents without a club must be omitted from unfinished-season projections");
 const freeAgentCompletedRows = sandbox.window.__lwTestBaseCompleteSeason(retiredSeasonSave, 3, db);
 assert.ok(!freeAgentCompletedRows.rows.some(row => row.id === freeAgentSeasonPlayer.id),
   "free agents without a club must not receive legacy completed-season statistics");
 const freeAgentSharedRows = sandbox.window.__lwTestBuildPlayerRows(retiredSeasonWorld, 3, new Map());
 assert.ok(!freeAgentSharedRows.some(row => row.id === freeAgentSeasonPlayer.id),
   "free agents without a club must be omitted from shared match-based season statistics");

// Season projections and match simulation must use canonical player-map keys throughout.
const canonicalSeasonSeed = db.clubs().find(club =>
  club && club.leagueId && Number(club.division) === 1);
assert.ok(canonicalSeasonSeed, "canonical season identity fixture needs a supported first-tier league");
const canonicalSeasonSave = { season: 1 };
const canonicalSeasonWorld = ai.ensureState(canonicalSeasonSave, db);
const canonicalMembershipVersion = canonicalSeasonWorld.rosterMembershipSchemaVersion;
canonicalSeasonWorld.clubs = {};
canonicalSeasonWorld.players = {};
canonicalSeasonWorld.dbVersion = Number.isSafeInteger(db.version)
  ? db.version : canonicalSeasonWorld.dbVersion;
canonicalSeasonWorld.schemaVersion = ai.version;
canonicalSeasonWorld.rosterSchemaVersion = 3;
canonicalSeasonWorld.rosterMembershipSchemaVersion = canonicalMembershipVersion;
canonicalSeasonWorld.currentSeason = 1;
canonicalSeasonWorld.lastAdvancedTo = 0;
canonicalSeasonWorld.lastCompletedSeason = 0;
canonicalSeasonWorld.lastDevelopedSeason = 0;
canonicalSeasonWorld.lastFreeAgentMarketSeason = 0;
canonicalSeasonWorld.completedSeasons = [];
canonicalSeasonWorld.matchesBySeason = {};
canonicalSeasonWorld.seasonStats = {};
canonicalSeasonWorld.leagueTables = {};
canonicalSeasonWorld.competitionsBySeason = {};
canonicalSeasonWorld.transfers = [];
canonicalSeasonWorld.marketReports = [];
canonicalSeasonWorld.playerHistory = {};
canonicalSeasonWorld.transferClubHistoryByPlayer = {};
canonicalSeasonWorld.promotionHistory = [];
canonicalSeasonWorld.notes = [];
canonicalSeasonWorld.nextGeneratedPlayer = 1;
canonicalSeasonWorld.transferSequence = 0;
const canonicalSeasonGroups = [
  "goalkeeper",
  "defender", "defender", "defender", "defender",
  "midfielder", "midfielder", "midfielder", "midfielder",
  "attacker", "attacker"
];
const canonicalSeasonKeys = [];
const canonicalSeasonPlayersByInternalId = new Map();
for (const suffix of ["a", "b"]) {
  const clubId = "canonical-season-club-" + suffix;
  const club = {
    id: clubId, name: "Canonical Season Club " + suffix.toUpperCase(),
    country: canonicalSeasonSeed.country, leagueId: canonicalSeasonSeed.leagueId,
    division: 1, power: 70, basePower: 70, prestige: 50, matchesPerSeason: 2, roster: []
  };
  canonicalSeasonWorld.clubs[clubId] = club;
  canonicalSeasonGroups.forEach((group, index) => {
    const playerMapKey = "canonical-season-" + suffix + "-player-" + String(index + 1).padStart(2, "0");
    const sharedInternalId = (suffix === "a" && (index === 1 || index === 2))
      || (suffix === "b" && index === 1);
    const internalId = sharedInternalId ? "shared-stale-season-internal-id" : "legacy-" + suffix + "-" + index;
    const position = group === "goalkeeper" ? "GK"
      : group === "defender" ? "CB" : group === "midfielder" ? "CM" : "ST";
    const player = {
      id: internalId, name: "Canonical Season Player " + suffix + " " + index,
      clubId, country: club.country, leagueId: club.leagueId, division: 1,
      position, group, age: 25, ovr: 68 + index, potential: 78,
      contractSeasons: 2, isGenerated: false, retired: false, freeAgent: false
    };
    canonicalSeasonWorld.players[playerMapKey] = player;
    club.roster.push(playerMapKey);
    canonicalSeasonKeys.push(playerMapKey);
    if (!canonicalSeasonPlayersByInternalId.has(internalId)) canonicalSeasonPlayersByInternalId.set(internalId, []);
    canonicalSeasonPlayersByInternalId.get(internalId).push(playerMapKey);
  });
}
const canonicalMatchSeason = sandbox.window.__lwTestSimulateLeagueSeason(canonicalSeasonSave, 1, db);
assert.equal(canonicalMatchSeason.rows.length, canonicalSeasonKeys.length,
  "match-based season simulation must retain every player-map entry even when internal IDs collide");
assert.equal(new Set(canonicalMatchSeason.rows.map(row => row.id)).size, canonicalSeasonKeys.length,
  "match-based season rows must use unique canonical player-map keys");
assert.ok(canonicalMatchSeason.rows.every(row => canonicalSeasonWorld.players[row.id]),
  "every match-based season row must resolve through the canonical players map");
for (const playerMapKeys of canonicalSeasonPlayersByInternalId.values()) {
  if (playerMapKeys.length < 2) continue;
  for (const playerMapKey of playerMapKeys) {
    const row = canonicalMatchSeason.rows.find(entry => entry.id === playerMapKey);
    assert.ok(row && row.appearances === 2,
      "players sharing a stale internal ID must retain independent match appearances");
    assert.equal(canonicalSeasonWorld.players[playerMapKey].id, "shared-stale-season-internal-id",
      "season simulation must not rewrite the source player's internal ID");
  }
}
assert.ok(canonicalMatchSeason.matches.every(match =>
  (match.scorers || []).every(playerMapKey => !!canonicalSeasonWorld.players[playerMapKey])),
  "match scorer references must resolve through canonical player-map keys");

const canonicalProjectedSeasonRows = sandbox.window.__lwTestGetProjectedSeasonRows(
  canonicalSeasonWorld, 2, db
);
assert.equal(canonicalProjectedSeasonRows.length, canonicalSeasonKeys.length);
assert.deepEqual(new Set(canonicalProjectedSeasonRows.map(row => row.id)), new Set(canonicalSeasonKeys),
  "unfinished-season projections must use canonical player-map keys");
const canonicalCompletedSeason = sandbox.window.__lwTestBaseCompleteSeason(canonicalSeasonSave, 2, db);
assert.equal(canonicalCompletedSeason.rows.length, canonicalSeasonKeys.length);
assert.deepEqual(new Set(canonicalCompletedSeason.rows.map(row => row.id)), new Set(canonicalSeasonKeys),
  "legacy season completion must persist canonical player-map keys");
assert.ok(canonicalSeasonKeys.every(playerMapKey =>
  canonicalSeasonWorld.players[playerMapKey] && canonicalSeasonWorld.players[playerMapKey].id),
  "completed-season generation must preserve every original player record");

const canonicalSeasonTarget = ai.transferTargets(canonicalSeasonSave, db).find(row =>
  row.club === "Canonical Season Club A");
assert.ok(canonicalSeasonTarget);
assert.deepEqual(new Set(canonicalSeasonTarget.players.map(player => player.id)),
  new Set(canonicalSeasonWorld.clubs["canonical-season-club-a"].roster),
  "transfer-target snapshots must expose canonical roster keys");
const canonicalSeasonFreeAgentKey = canonicalSeasonKeys[0];
const canonicalSeasonFreeAgentPlayer = canonicalSeasonWorld.players[canonicalSeasonFreeAgentKey];
canonicalSeasonFreeAgentPlayer.freeAgent = true;
canonicalSeasonFreeAgentPlayer.clubId = "";
canonicalSeasonFreeAgentPlayer.leagueId = "";
canonicalSeasonFreeAgentPlayer.division = 0;
const canonicalSeasonFreeAgentRows = sandbox.window.LWWorldAI.freeAgents(canonicalSeasonSave, db);
assert.ok(canonicalSeasonFreeAgentRows.some(row => row.id === canonicalSeasonFreeAgentKey),
  "free-agent snapshots must expose the canonical player-map key");

const legacyDivisionStatsClubId = "legacy-stats-club";
const legacyDivisionStatsWorld = {
  clubs: {
    [legacyDivisionStatsClubId]: {
      id: legacyDivisionStatsClubId, name: "Legacy Stats Club", country: "Testland",
      leagueId: "legacy-stats-league", power: 87, prestige: 58, confederation: "CAF"
    }
  },
  players: {
    "legacy-stats-player": {
      id: "legacy-stats-player", name: "Legacy Stats Player", clubId: legacyDivisionStatsClubId,
      country: "Testland", leagueId: "legacy-stats-league", division: 1,
      position: "مهاجم", group: "attacker", age: 25, ovr: 72, potential: 80, isGenerated: false
    }
  }
};
const legacyDivisionStatsRows = sandbox.window.__lwTestBuildPlayerRows(
  legacyDivisionStatsWorld, 5,
  new Map([["legacy-stats-player", {
    appearances: 3, goals: 2, assists: 1, ratingTotal: 21,
    clubId: legacyDivisionStatsClubId, leagueId: "legacy-stats-league", division: 1
  }]])
);
assert.equal(legacyDivisionStatsRows[0].leagueStrength, 87,
  "player performance weighting must group a legacy club without division under the first tier");

// Malformed saved player and accumulator numerics must not abort season-row generation.
const malformedSeasonRowsWorld = {
  clubs: {
    "malformed-season-stats-club": {
      id: "malformed-season-stats-club", name: "Malformed Stats Club",
      country: "Testland", leagueId: "malformed-season-stats-league", division: [1],
      power: [91], prestige: [80], confederation: "CAF"
    }
  },
  players: {
    "malformed-season-stats-player": {
      id: "malformed-season-stats-player", name: "Malformed Stats Player",
      clubId: "malformed-season-stats-club", country: "Testland",
      leagueId: "malformed-season-stats-league", division: 1,
      position: "مهاجم", group: "attacker", age: [24], ovr: [88],
      potential: [95], prestige: [70], isGenerated: false
    }
  }
};
const malformedSeasonAccumulator = new Map([["malformed-season-stats-player", {
  appearances: 10, goals: [3], assists: Symbol("invalid-assists"),
  ratingTotal: Symbol("invalid-rating-total"), clubId: "malformed-season-stats-club",
  leagueId: "malformed-season-stats-league", division: [1]
}]]);
let malformedSeasonRows;
assert.doesNotThrow(() => {
  malformedSeasonRows = sandbox.window.__lwTestBuildPlayerRows(
    malformedSeasonRowsWorld, 5, malformedSeasonAccumulator
  );
}, "malformed player and accumulator values must not abort season leaderboard generation");
assert.equal(malformedSeasonRows.length, 1);
assert.equal(malformedSeasonRows[0].season, 5);
assert.equal(malformedSeasonRows[0].appearances, 10);
assert.equal(malformedSeasonRows[0].goals, 0,
  "array-shaped goal totals must not be coerced into valid production");
assert.equal(malformedSeasonRows[0].assists, 0);
assert.equal(malformedSeasonRows[0].averageRating, 0,
  "a malformed rating total must not throw or inflate a player's average");
assert.equal(malformedSeasonRows[0].leagueStrength, 55,
  "array-shaped club power must fall back to the neutral league-strength baseline");
assert.equal(malformedSeasonRows[0].age, 18);
assert.equal(malformedSeasonRows[0].ovr, 50);
assert.equal(malformedSeasonRows[0].potential, 50);
assert.equal(malformedSeasonRows[0].prestige, 0);
assert.equal(
  sandbox.window.__lwTestBuildPlayerRows(malformedSeasonRowsWorld, [5], malformedSeasonAccumulator).length,
  0,
  "array-shaped season identifiers must not create malformed season rows"
);


// Finite but absurd saved numbers must be bounded before scoring and weighted goals are built.
const extremeSeasonRowsWorld = {
  clubs: {
    "extreme-season-stats-club": {
      id: "extreme-season-stats-club", name: "Extreme Stats Club",
      country: "Testland", leagueId: "extreme-season-stats-league", division: 1,
      power: Number.MAX_VALUE, prestige: Number.MAX_VALUE, confederation: "CAF"
    }
  },
  players: {
    "extreme-season-stats-player": {
      id: "extreme-season-stats-player", name: "Extreme Stats Player",
      clubId: "extreme-season-stats-club", country: "Testland",
      leagueId: "extreme-season-stats-league", division: 1,
      position: "مهاجم", group: "attacker", age: 999, ovr: 999,
      potential: -1, isGenerated: false
    }
  }
};
const extremeSeasonAccumulator = new Map([["extreme-season-stats-player", {
  appearances: Number.MAX_VALUE, goals: Number.MAX_VALUE, assists: Number.MAX_VALUE,
  ratingTotal: Number.MAX_VALUE, clubId: "extreme-season-stats-club",
  leagueId: "extreme-season-stats-league", division: 1
}]]);
const extremeSeasonRows = sandbox.window.__lwTestBuildPlayerRows(
  extremeSeasonRowsWorld, 5, extremeSeasonAccumulator
);
assert.equal(extremeSeasonRows.length, 1);
assert.equal(extremeSeasonRows[0].appearances, 1000,
  "absurd appearance totals must be capped before rating aggregation");
assert.equal(extremeSeasonRows[0].goals, 1000000);
assert.equal(extremeSeasonRows[0].assists, 1000000);
assert.equal(extremeSeasonRows[0].averageRating, 10,
  "rating totals must be bounded by the maximum rating for the saved appearances");
assert.equal(extremeSeasonRows[0].leagueStrength, 100,
  "club power must stay inside the game-strength range");
assert.equal(extremeSeasonRows[0].age, 60);
assert.equal(extremeSeasonRows[0].ovr, 99);
assert.equal(extremeSeasonRows[0].potential, 1);
assert.equal(extremeSeasonRows[0].prestige, 100);
assert.ok(Number.isFinite(extremeSeasonRows[0].score),
  "extreme finite stats must not overflow the season ranking score");
assert.ok(Number.isFinite(extremeSeasonRows[0].weightedGoals),
  "extreme finite stats must not overflow weighted goals");

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
delete transferWorld.clubs["D2 Buyer A"].division;
delete transferWorld.clubs["D2 Buyer B"].division;
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
assert.ok(simulatedTransfers.some(move => move.to === "D2 Buyer A" || move.to === "D2 Buyer B"), "legacy clubs without a persisted division must remain eligible in the paid transfer market");
const legacyPaidTransfer = simulatedTransfers.find(move => move.toClubId === "D2 Buyer A" || move.toClubId === "D2 Buyer B");
assert.ok(legacyPaidTransfer, "a legacy club must receive a paid transfer when it has a compatible vacancy");
assert.equal(transferWorld.players[legacyPaidTransfer.playerId].division, 1,
  "a player joining a legacy club without a persisted division must inherit the shared first-tier fallback");
const budgetedTransfer = simulatedTransfers[0];
const budgetBuyer = transferWorld.clubs[String(budgetedTransfer.toClubId || "")];
const budgetSeller = transferWorld.clubs[String(budgetedTransfer.fromClubId || "")];
assert.ok(budgetBuyer && budgetSeller, "the transfer must identify its actual buyer and seller");
assert.equal(String(budgetedTransfer.toClubId), String(budgetBuyer.id),
  "paid transfer records must preserve the exact destination club ID");
assert.equal(String(budgetedTransfer.fromClubId), String(budgetSeller.id),
  "paid transfer records must preserve the exact selling club ID");
assert.equal(budgetBuyer.budget, Math.max(0, expectedSeasonBudget(budgetBuyer.id) - budgetedTransfer.fee),
  "the buyer must retain the transfer-fee deduction in its persisted cash balance");
assert.ok(budgetedTransfer.fee > Math.round(marketBudgetBefore[budgetSeller.id].power * 8),
  "the fixture must exercise a transfer fee above the old seller-income cap");
assert.equal(budgetSeller.budget, expectedSeasonBudget(budgetSeller.id) + budgetedTransfer.fee,
  "the seller must receive the full recorded transfer fee after the market refreshes squad strength");

// Paid transfer deals must carry the canonical player-map key through roster membership,
// transfer records, career history, and compact transfer-club history.
const canonicalTransferIdentityWorld = {
  clubs: {}, players: {}, transfers: [], marketReports: [], playerHistory: {},
  notes: [], nextGeneratedPlayer: 1, dbVersion: 0, transferSequence: 0
};
const canonicalTransferSellerA = makeMarketTestClub(canonicalTransferIdentityWorld, "Canonical Transfer Seller A", 1, null);
const canonicalTransferSellerB = makeMarketTestClub(canonicalTransferIdentityWorld, "Canonical Transfer Seller B", 1, null);
makeMarketTestClub(canonicalTransferIdentityWorld, "Canonical Transfer Buyer A", 2, "defender");
makeMarketTestClub(canonicalTransferIdentityWorld, "Canonical Transfer Buyer B", 2, "defender");
for (const seller of [canonicalTransferSellerA, canonicalTransferSellerB]) {
  seller.power = seller.basePower = 50;
  seller.roster.filter(id => canonicalTransferIdentityWorld.players[id]?.group === "defender").forEach(id => {
    canonicalTransferIdentityWorld.players[id].id = "stale-paid-transfer-internal-" + id;
  });
}
const canonicalTransferMoves = sandbox.window.__lwTestRunTransferWindow(canonicalTransferIdentityWorld, 4);
assert.ok(canonicalTransferMoves.length > 0,
  "the canonical transfer identity fixture must complete at least one paid transfer");
for (const move of canonicalTransferMoves) {
  const movedPlayer = canonicalTransferIdentityWorld.players[move.playerId];
  const seller = canonicalTransferIdentityWorld.clubs[move.fromClubId];
  const buyer = canonicalTransferIdentityWorld.clubs[move.toClubId];
  assert.ok(movedPlayer && movedPlayer.id.startsWith("stale-paid-transfer-internal-"),
    "paid transfer records must resolve through the canonical player-map key without rewriting the internal ID");
  assert.ok(seller && buyer);
  assert.ok(!seller.roster.includes(move.playerId),
    "the selling club must release the canonical roster key");
  assert.ok(buyer.roster.includes(move.playerId),
    "the buying club must receive the canonical roster key");
  assert.ok(!buyer.roster.includes(movedPlayer.id),
    "the buying club must not receive the stale internal player ID");
  assert.ok(canonicalTransferIdentityWorld.playerHistory[move.playerId]?.some(row => row.type === "transfer-in"),
    "paid transfer history must be stored under the canonical player-map key");
  assert.ok(canonicalTransferIdentityWorld.transferClubHistoryByPlayer[move.playerId]?.length >= 2,
    "compact transfer-club endpoints must use the canonical player-map key");
  assert.ok(!Object.prototype.hasOwnProperty.call(canonicalTransferIdentityWorld.playerHistory, movedPlayer.id),
    "paid transfer history must not be written under the stale internal ID");
  assert.equal(movedPlayer.clubId, buyer.id);
}

// Free-agent signings use the same canonical identity contract as paid transfers.
const canonicalFreeAgentMarketWorld = {
  clubs: {}, players: {}, transfers: [], marketReports: [], playerHistory: {},
  notes: [], nextGeneratedPlayer: 1, dbVersion: 0, transferSequence: 0
};
makeMarketTestClub(canonicalFreeAgentMarketWorld, "Canonical Free Agent D1 Full", 1, null);
const canonicalFreeAgentBuyer = makeMarketTestClub(
  canonicalFreeAgentMarketWorld, "Canonical Free Agent D2 Keeper Vacancy", 2, "goalkeeper"
);
delete canonicalFreeAgentBuyer.division;
const canonicalExistingBuyerKey = canonicalFreeAgentBuyer.roster[0];
const canonicalExistingBuyerPlayer = canonicalFreeAgentMarketWorld.players[canonicalExistingBuyerKey];
const staleExistingBuyerInternalId = "stale-existing-buyer-internal-id";
canonicalExistingBuyerPlayer.id = staleExistingBuyerInternalId;
const canonicalFreeAgentMarketKey = "canonical-free-agent-market-map-key";
const staleFreeAgentMarketId = "stale-free-agent-market-internal-id";
const canonicalFreeAgentMarketPlayer = {
  id: staleFreeAgentMarketId, name: "Canonical Free Agent Market Player", clubId: "",
  country: "Testland", leagueId: "", division: 0, position: "حارس مرمى", group: "goalkeeper",
  ovr: 60, potential: 65, age: 26, contractSeasons: 0, freeAgent: true,
  previousClubId: "", freeAgentSince: 0, transferListed: false, retired: false
};
canonicalFreeAgentMarketWorld.players[canonicalFreeAgentMarketKey] = canonicalFreeAgentMarketPlayer;
const canonicalFreeAgentSignings = sandbox.window.__lwTestSignFreeAgents(canonicalFreeAgentMarketWorld, 3, []);
assert.equal(canonicalFreeAgentSignings.length, 1,
  "the canonical free-agent identity fixture must complete one eligible signing");
assert.equal(canonicalFreeAgentSignings[0].playerId, canonicalFreeAgentMarketKey,
  "free-agent transfer records must store the canonical player-map key");
assert.ok(canonicalFreeAgentBuyer.roster.includes(canonicalFreeAgentMarketKey),
  "free-agent recruitment must add the canonical roster key");
assert.ok(!canonicalFreeAgentBuyer.roster.includes(staleFreeAgentMarketId),
  "free-agent recruitment must not add the stale internal player ID");
assert.ok(canonicalFreeAgentBuyer.roster.includes(canonicalExistingBuyerKey),
  "free-agent recruitment must preserve existing players by their canonical roster keys");
assert.ok(!canonicalFreeAgentBuyer.roster.includes(staleExistingBuyerInternalId),
  "free-agent roster reconciliation must never replace an existing map key with its stale internal ID");
assert.equal(canonicalFreeAgentMarketPlayer.clubId, canonicalFreeAgentBuyer.id);
assert.equal(canonicalFreeAgentMarketPlayer.id, staleFreeAgentMarketId,
  "free-agent recruitment must preserve the original internal player ID");
assert.ok(canonicalFreeAgentMarketWorld.playerHistory[canonicalFreeAgentMarketKey]?.some(row => row.type === "free-agent-signing"),
  "free-agent career history must be stored under the canonical player-map key");
assert.ok(canonicalFreeAgentMarketWorld.transferClubHistoryByPlayer[canonicalFreeAgentMarketKey]?.length >= 2,
  "free-agent transfer-club endpoints must use the canonical player-map key");
assert.ok(!Object.prototype.hasOwnProperty.call(canonicalFreeAgentMarketWorld.playerHistory, staleFreeAgentMarketId),
  "free-agent history must not be written under the stale internal ID");

// Legacy saved roster ratings can be arrays or numeric strings. They must not
// concatenate into NaN role averages and silently disable otherwise valid transfers.
const staleMarketHistoryWorld = {
  clubs: {}, players: {}, transfers: [], marketReports: [], playerHistory: {},
  notes: [], nextGeneratedPlayer: 1, dbVersion: 0, transferSequence: 0
};
makeMarketTestClub(staleMarketHistoryWorld, "Malformed Market Seller", 1, null);
const malformedMarketBuyer = makeMarketTestClub(staleMarketHistoryWorld, "Malformed Market Buyer", 2, "defender");
const malformedBuyerDefenders = malformedMarketBuyer.roster
  .map(id => staleMarketHistoryWorld.players[id]).filter(player => player.group === "defender");
assert.ok(malformedBuyerDefenders.length >= 2, "the malformed-market fixture needs multiple defenders");
malformedBuyerDefenders[0].ovr = "64";
malformedBuyerDefenders[1].ovr = [64, 65];
const malformedSeller = staleMarketHistoryWorld.clubs["Malformed Market Seller"];
const malformedSellerListedPlayer = malformedSeller.roster
  .map(id => staleMarketHistoryWorld.players[id]).find(player => player.group === "defender" && player.potential === 97);
assert.ok(malformedSellerListedPlayer, "the malformed-market seller needs a known listed defender");
malformedSellerListedPlayer.ovr = [79, 80];
malformedSellerListedPlayer.potential = [97, 98];
malformedSellerListedPlayer.age = [30, 31];
const malformedBuyerArrayOvr = malformedBuyerDefenders[1].ovr.slice();
const malformedSellerArrayOvr = malformedSellerListedPlayer.ovr.slice();
let malformedMarketMoves = [];
assert.doesNotThrow(() => {
  malformedMarketMoves = sandbox.window.__lwTestRunTransferWindow(staleMarketHistoryWorld, 9);
}, "malformed legacy roster ratings must not break transfer-window evaluation");
assert.ok(malformedMarketMoves.length > 0,
  "invalid array ratings must not turn role averages into NaN and suppress a valid transfer");
assert.equal(malformedBuyerDefenders[0].ovr, "64",
  "numeric-string player ratings must remain intact after transfer evaluation");
assert.deepEqual(malformedBuyerDefenders[1].ovr, malformedBuyerArrayOvr,
  "malformed buyer ratings must be read safely without rewriting saved player data");
assert.deepEqual(malformedSellerListedPlayer.ovr, malformedSellerArrayOvr,
  "malformed seller ratings must be read safely without rewriting saved player data");
assert.deepEqual(malformedSellerListedPlayer.potential, [97, 98],
  "transfer scoring must not rewrite the saved potential field");
assert.deepEqual(malformedSellerListedPlayer.age, [30, 31],
  "transfer scoring must not rewrite the saved age field");

// Transfer-market phases are atomic: a late roster/history failure must not leave
// half-applied fees, ownership changes, generated players, or history rows behind.
const rollbackWorld = {
  clubs: {}, players: {}, transfers: [],
  marketReports: [{ season: 6, moves: 0, transferIds: [], summary: "existing report" }],
  playerHistory: {}, notes: [], nextGeneratedPlayer: 1, dbVersion: 0, transferSequence: 0
};
const rollbackSeller = makeMarketTestClub(rollbackWorld, "Rollback Seller", 1, null);
makeMarketTestClub(rollbackWorld, "Rollback Buyer", 2, "defender");
rollbackSeller.power = rollbackSeller.basePower = 50;
const rollbackGeneratedClub = makeMarketTestClub(rollbackWorld, "Rollback Generated Fill", 0, null);
rollbackGeneratedClub.roster.pop();
const rollbackFaultClub = makeMarketTestClub(rollbackWorld, "Rollback Fault Club", 0, null);
let rollbackFaultRoster = rollbackFaultClub.roster.slice();
let throwOnRollbackRosterWrite = true;
Object.defineProperty(rollbackFaultClub, "roster", {
  configurable: true,
  enumerable: true,
  get() { return rollbackFaultRoster; },
  set(value) {
    if (throwOnRollbackRosterWrite) {
      throwOnRollbackRosterWrite = false;
      throw new Error("forced transfer window failure");
    }
    rollbackFaultRoster = value;
  }
});
const rollbackControl = JSON.parse(JSON.stringify(rollbackWorld));
assert.ok(sandbox.window.__lwTestRunTransferWindow(rollbackControl, 6).length > 0,
  "the rollback fixture must complete a paid transfer when no injected failure occurs");
const rollbackBefore = JSON.stringify(rollbackWorld);
assert.throws(() => sandbox.window.__lwTestRunTransferWindow(rollbackWorld, 6),
  /forced transfer window failure/,
  "a late roster failure must abort the paid transfer window");
assert.equal(JSON.stringify(rollbackWorld), rollbackBefore,
  "a failed paid window must restore club budgets, player ownership, rosters, history, reports, transfer IDs, and generated-player counters");

// The free-agent phase has a separate mutation path and must roll back its player and roster
// changes if writing the player's history fails after the signing has been prepared.
const freeAgentRollbackWorld = {
  clubs: {}, players: {}, transfers: [],
  marketReports: [{ season: 7, moves: 0, transferIds: [], summary: "existing free-agent report" }],
  playerHistory: {}, notes: [], nextGeneratedPlayer: 1, dbVersion: 0, transferSequence: 0
};
makeMarketTestClub(freeAgentRollbackWorld, "Free Agent Rollback Buyer", 2, "goalkeeper");
freeAgentRollbackWorld.players["free-agent-rollback-player"] = {
  id: "free-agent-rollback-player", name: "Free Agent Rollback Player", clubId: "",
  country: "Testland", leagueId: "", division: 0, position: "حارس مرمى", group: "goalkeeper",
  ovr: 60, potential: 66, age: 26, contractSeasons: 0, freeAgent: true,
  previousClubId: "", freeAgentSince: 0, transferListed: false
};
let failFreeAgentHistoryWrite = true;
const freeAgentHistoryBacking = {};
freeAgentRollbackWorld.playerHistory = new Proxy(freeAgentHistoryBacking, {
  set(target, key, value) {
    if (failFreeAgentHistoryWrite) {
      failFreeAgentHistoryWrite = false;
      throw new Error("forced free-agent history failure");
    }
    target[key] = value;
    return true;
  }
});
const freeAgentRollbackBefore = JSON.stringify(freeAgentRollbackWorld);
assert.throws(() => sandbox.window.__lwTestSignFreeAgents(freeAgentRollbackWorld, 8, []),
  /forced free-agent history failure/,
  "a free-agent history write failure must abort the signing");
assert.equal(JSON.stringify(freeAgentRollbackWorld), freeAgentRollbackBefore,
  "a failed free-agent signing must restore the player, roster, history, market report, and transfer ledger");
 
// A failure after the compact former-club history is partially written must also
// roll that per-player history back, not just the transfer ledger and playerHistory.
const transferClubHistoryRollbackWorld = {
  clubs: {}, players: {}, transfers: [],
  marketReports: [{ season: 8, moves: 0, transferIds: [], summary: "existing club-history report" }],
  playerHistory: {}, notes: [], nextGeneratedPlayer: 1, dbVersion: 0, transferSequence: 0,
  transferClubHistoryByPlayer: null, transferClubHistorySchemaVersion: 1
};
makeMarketTestClub(transferClubHistoryRollbackWorld, "Club History Rollback Buyer", 2, "goalkeeper");
transferClubHistoryRollbackWorld.players["club-history-rollback-player"] = {
  id: "club-history-rollback-player", name: "Club History Rollback Player", clubId: "",
  country: "Testland", leagueId: "", division: 0, position: "حارس مرمى", group: "goalkeeper",
  ovr: 60, potential: 66, age: 26, contractSeasons: 0, freeAgent: true,
  previousClubId: "", freeAgentSince: 0, transferListed: false
};
let failTransferClubHistoryWrite = true;
const transferClubHistoryBacking = {};
transferClubHistoryRollbackWorld.transferClubHistoryByPlayer = new Proxy(transferClubHistoryBacking, {
  set(target, key, value) {
    target[key] = value;
    if (failTransferClubHistoryWrite) {
      failTransferClubHistoryWrite = false;
      throw new Error("forced transfer-club-history failure");
    }
    return true;
  }
});
const transferClubHistoryRollbackBefore = JSON.stringify(transferClubHistoryRollbackWorld);
assert.throws(() => sandbox.window.__lwTestSignFreeAgents(transferClubHistoryRollbackWorld, 8, []),
  /forced transfer-club-history failure/,
  "a partially written compact club-history row must abort the free-agent transaction");
assert.equal(JSON.stringify(transferClubHistoryRollbackWorld), transferClubHistoryRollbackBefore,
  "a failed free-agent signing must restore transferClubHistoryByPlayer and its schema marker as well as every other transaction record");


// Stale roster references must not make an otherwise eligible club look full to the transfer market.
const staleTransferWorld = { clubs: {}, players: {}, transfers: [], marketReports: [], playerHistory: {}, notes: [], nextGeneratedPlayer: 1, dbVersion: 0, transferSequence: 0 };
makeMarketTestClub(staleTransferWorld, "Stale Transfer Seller", 1, null);
const staleTransferBuyer = makeMarketTestClub(staleTransferWorld, "Stale Transfer Buyer", 2, "defender");
const staleTransferRetiredId = "stale-transfer-retired";
staleTransferWorld.players[staleTransferRetiredId] = {
  id: staleTransferRetiredId, name: "Retired stale defender", clubId: staleTransferBuyer.id,
  group: "defender", position: "قلب دفاع", ovr: 99, retired: true, freeAgent: false
};
staleTransferBuyer.roster.push(staleTransferRetiredId, "missing-transfer-roster-id");
const staleTransferMoves = sandbox.window.__lwTestRunTransferWindow(staleTransferWorld, 4);
assert.ok(staleTransferMoves.some(move => move.to === staleTransferBuyer.name),
  "a club with 16 active players must remain eligible to buy when stale IDs inflate its raw roster array");
assert.ok(!staleTransferBuyer.roster.includes(staleTransferRetiredId)
  && !staleTransferBuyer.roster.includes("missing-transfer-roster-id"),
  "transfer completion must remove stale and retired references from the buyer roster");
assert.equal(new Set(staleTransferBuyer.roster).size, staleTransferBuyer.roster.length,
  "transfer completion must not introduce duplicate roster IDs");
assert.ok(staleTransferBuyer.roster.every(id => staleTransferWorld.players[id]
  && staleTransferWorld.players[id].clubId === staleTransferBuyer.id
  && !staleTransferWorld.players[id].retired && !staleTransferWorld.players[id].freeAgent),
  "the receiving club roster must contain only active players owned by that club");

// Free agents must also be able to fill an eligible lower-tier vacancy when top-tier clubs have no need.
const freeAgentWorld = { clubs: {}, players: {}, transfers: [], marketReports: [], playerHistory: {}, notes: [], nextGeneratedPlayer: 1, dbVersion: 0, transferSequence: 0 };
makeMarketTestClub(freeAgentWorld, "D1 Full Club", 1, null);
const staleFreeAgentBuyer = makeMarketTestClub(freeAgentWorld, "D2 Keeper Vacancy", 2, "goalkeeper");
delete staleFreeAgentBuyer.division;
const staleFreeAgentRetiredId = "stale-free-agent-retired-keeper";
freeAgentWorld.players[staleFreeAgentRetiredId] = {
  id: staleFreeAgentRetiredId, name: "Retired stale keeper", clubId: staleFreeAgentBuyer.id,
  group: "goalkeeper", position: "حارس مرمى", ovr: 99, retired: true, freeAgent: false
};
staleFreeAgentBuyer.roster.push(staleFreeAgentRetiredId, "missing-free-agent-roster-id");
freeAgentWorld.players["free-agent-test-keeper"] = { id: "free-agent-test-keeper", name: "Free-agent keeper test", clubId: "", country: "Testland", leagueId: "test-market", division: 0, position: "حارس مرمى", group: "goalkeeper", ovr: 60, potential: 65, age: 26, contractSeasons: 0, freeAgent: true, previousClubId: "former-club", isGenerated: false };
const signedLowerTier = sandbox.window.__lwTestSignFreeAgents(freeAgentWorld, 3, []);
assert.equal(signedLowerTier.length, 1, "a free agent should sign when a lower-tier club has a compatible vacancy");
assert.equal(signedLowerTier[0].toClubId, staleFreeAgentBuyer.id,
  "free-agent transfer records must retain the destination club's stable ID");
assert.equal(freeAgentWorld.players["free-agent-test-keeper"].clubId, "D2 Keeper Vacancy", "free-agent recruitment must include the lower-tier club when higher-tier clubs have no matching vacancy");
assert.equal(freeAgentWorld.players["free-agent-test-keeper"].division, 1, "a missing legacy club division must use the shared first-tier fallback for the signed player");
assert.ok(!staleFreeAgentBuyer.roster.includes(staleFreeAgentRetiredId)
  && !staleFreeAgentBuyer.roster.includes("missing-free-agent-roster-id"),
  "free-agent signing must rebuild the buyer roster from active players and remove stale references");
assert.equal(staleFreeAgentBuyer.roster.filter(id => id === "free-agent-test-keeper").length, 1,
  "the signed free agent must be added exactly once even if a stale reference already existed");
assert.equal(new Set(staleFreeAgentBuyer.roster).size, staleFreeAgentBuyer.roster.length,
  "free-agent signing must preserve unique roster membership");

// The paid transfer phase reserves both clubs in a deal. The free-agent phase
// must honor that same per-window participation guard instead of signing again.
const crossMarketWorld = {
  clubs: {}, players: {}, transfers: [], marketReports: [], playerHistory: {},
  notes: [], nextGeneratedPlayer: 1, dbVersion: 0, transferSequence: 0
};
const crossMarketSeller = makeMarketTestClub(crossMarketWorld, "D1 Already Moved Seller", 1, "goalkeeper");
const crossMarketBuyer = makeMarketTestClub(crossMarketWorld, "D2 A Already Moved Buyer", 2, "goalkeeper");
const crossMarketAvailableBuyer = makeMarketTestClub(crossMarketWorld, "D2 B Remaining Buyer", 2, "goalkeeper");
crossMarketWorld.players["cross-market-free-agent"] = {
  id: "cross-market-free-agent", name: "Cross-market free agent", clubId: "",
  country: "Testland", leagueId: "", division: 0, position: "حارس مرمى",
  group: "goalkeeper", ovr: 60, potential: 66, age: 26, contractSeasons: 0,
  freeAgent: true, previousClubId: "former-club", freeAgentSince: 0
};
const paidWindowMove = {
  from: crossMarketSeller.name, fromCountry: crossMarketSeller.country,
  to: crossMarketBuyer.name, toCountry: crossMarketBuyer.country
};
const crossMarketSignings = sandbox.window.__lwTestSignFreeAgents(crossMarketWorld, 5, [paidWindowMove]);
assert.equal(crossMarketSignings.length, 1,
  "an unused club should still be allowed to sign a free agent after the paid phase");
assert.equal(crossMarketSignings[0].to, crossMarketAvailableBuyer.name,
  "the free-agent phase must skip both clubs already involved in a paid deal");
assert.ok(!crossMarketSignings.some(move => move.to === crossMarketSeller.name || move.to === crossMarketBuyer.name),
  "neither the seller nor buyer from the paid transfer may make a second move in the same window");

// Stable club IDs must disambiguate two clubs that share the same display name and country.
const duplicateNameMarketWorld = {
  clubs: {}, players: {}, transfers: [], marketReports: [], playerHistory: {},
  notes: [], nextGeneratedPlayer: 1, dbVersion: 0, transferSequence: 0
};
const duplicateNameSeller = makeMarketTestClub(duplicateNameMarketWorld, "duplicate-name-seller", 1, "goalkeeper");
const duplicateNameBuyer = makeMarketTestClub(duplicateNameMarketWorld, "duplicate-name-buyer", 2, "goalkeeper");
const duplicateNameAvailable = makeMarketTestClub(duplicateNameMarketWorld, "duplicate-name-available", 2, "goalkeeper");
duplicateNameSeller.name = "Shared FC";
duplicateNameBuyer.name = "Shared FC";
duplicateNameMarketWorld.players["duplicate-name-free-agent"] = {
  id: "duplicate-name-free-agent", name: "Duplicate-name free agent", clubId: "",
  country: "Testland", leagueId: "", division: 0, position: "حارس مرمى",
  group: "goalkeeper", ovr: 60, potential: 66, age: 26, contractSeasons: 0,
  freeAgent: true, previousClubId: "former-club", freeAgentSince: 0
};
const duplicateNamePaidMove = {
  from: duplicateNameSeller.name, fromCountry: duplicateNameSeller.country,
  fromClubId: duplicateNameSeller.id,
  to: duplicateNameBuyer.name, toCountry: duplicateNameBuyer.country,
  toClubId: duplicateNameBuyer.id
};
const duplicateNameSignings = sandbox.window.__lwTestSignFreeAgents(
  duplicateNameMarketWorld, 5, [duplicateNamePaidMove]
);
assert.equal(duplicateNameSignings.length, 1,
  "a distinct club must remain eligible after a same-name paid deal");
assert.equal(duplicateNameSignings[0].toClubId, duplicateNameAvailable.id,
  "stable paid-move IDs must reserve the exact seller and buyer when names collide");
assert.equal(duplicateNameMarketWorld.players["duplicate-name-free-agent"].clubId, duplicateNameAvailable.id,
  "a free agent must not be assigned to either same-name club already involved in the paid deal");
assert.equal(duplicateNameMarketWorld.playerHistory["duplicate-name-free-agent"][0].clubId, duplicateNameAvailable.id,
  "player history must retain the exact club ID for a free-agent signing");

// A former club cannot immediately re-sign a player it just released, but may
// bring them back after one complete free-agent season if the role vacancy remains.
const formerClubReturnWorld = {
  clubs: {}, players: {}, transfers: [], marketReports: [], playerHistory: {},
  notes: [], nextGeneratedPlayer: 1, dbVersion: 0, transferSequence: 0
};
const formerClubReturn = makeMarketTestClub(formerClubReturnWorld, "D2 Former Club", 2, "goalkeeper");
formerClubReturnWorld.players["returning-free-agent"] = {
  id: "returning-free-agent", name: "Returning free-agent keeper",
  clubId: "", country: "Testland", leagueId: "test-market", division: 0,
  position: "حارس مرمى", group: "goalkeeper", ovr: 60, potential: 65,
  age: 26, contractSeasons: 0, freeAgent: true,
  previousClubId: formerClubReturn.id, freeAgentSince: 2, isGenerated: false
};
const immediateFormerClubReturn = sandbox.window.__lwTestSignFreeAgents(formerClubReturnWorld, 2, []);
assert.equal(immediateFormerClubReturn.length, 0,
  "a club must not immediately re-sign a player in the same season their contract expires");
assert.equal(formerClubReturnWorld.players["returning-free-agent"].freeAgent, true,
  "the player must remain available to other clubs during the initial free-agent window");
const delayedFormerClubReturn = sandbox.window.__lwTestSignFreeAgents(formerClubReturnWorld, 3, []);
assert.equal(delayedFormerClubReturn.length, 1,
  "the former club must be allowed to re-sign the player after one complete free-agent season");
assert.equal(formerClubReturnWorld.players["returning-free-agent"].clubId, formerClubReturn.id,
  "a delayed return must attach the player to their former club again");
assert.equal(formerClubReturnWorld.players["returning-free-agent"].freeAgent, false,
  "a completed return must clear free-agent status");
assert.equal(formerClubReturnWorld.players["returning-free-agent"].freeAgentSince, 0,
  "a completed signing must clear the old free-agent start marker");

// Legacy saves can store a numeric previousClubId while catalogue club IDs are strings.
// The former club must still respect the one-complete-season return restriction.
const numericFormerClubReturnWorld = {
  clubs: {}, players: {}, transfers: [], marketReports: [], playerHistory: {},
  notes: [], nextGeneratedPlayer: 1, dbVersion: 0, transferSequence: 0
};
const numericFormerClub = makeMarketTestClub(numericFormerClubReturnWorld, "12345", 2, "goalkeeper");
numericFormerClubReturnWorld.players["numeric-return-free-agent"] = {
  id: "numeric-return-free-agent", name: "Numeric-ID returning keeper",
  clubId: "", country: "Testland", leagueId: "test-market", division: 0,
  position: "حارس مرمى", group: "goalkeeper", ovr: 60, potential: 65,
  age: 26, contractSeasons: 0, freeAgent: true,
  previousClubId: 12345, freeAgentSince: 2, isGenerated: false
};
const blockedNumericFormerClubReturn = sandbox.window.__lwTestSignFreeAgents(numericFormerClubReturnWorld, 2, []);
assert.equal(blockedNumericFormerClubReturn.length, 0,
  "numeric legacy previousClubId must not bypass the former-club return restriction");
assert.equal(numericFormerClubReturnWorld.players["numeric-return-free-agent"].freeAgent, true,
  "a numeric-ID player must remain a free agent during the initial free-agent season");
const delayedNumericFormerClubReturn = sandbox.window.__lwTestSignFreeAgents(numericFormerClubReturnWorld, 3, []);
assert.equal(delayedNumericFormerClubReturn.length, 1,
  "the former club may re-sign a numeric-ID legacy player after one complete free-agent season");
assert.equal(delayedNumericFormerClubReturn[0].toClubId, "12345",
  "the delayed numeric-ID return must resolve to the exact former club");

// Array-shaped legacy values must not pass Number() coercion and bypass the
// conservative one-complete-free-agent-season return restriction.
const malformedFreeAgentMarkerWorld = {
  clubs: {}, players: {}, transfers: [], marketReports: [], playerHistory: {},
  notes: [], nextGeneratedPlayer: 1, dbVersion: 0, transferSequence: 0
};
const malformedMarkerFormerClub = makeMarketTestClub(
  malformedFreeAgentMarkerWorld, "malformed-marker-former-club", 2, "goalkeeper"
);
malformedFreeAgentMarkerWorld.players["malformed-free-agent-marker"] = {
  id: "malformed-free-agent-marker", name: "Malformed free-agent marker keeper",
  clubId: "", country: "Testland", leagueId: "test-market", division: 0,
  position: "حارس مرمى", group: "goalkeeper", ovr: 60, potential: 65,
  age: 26, contractSeasons: 0, freeAgent: true,
  previousClubId: malformedMarkerFormerClub.id, freeAgentSince: [2], isGenerated: false
};
const blockedMalformedFormerClubReturn = sandbox.window.__lwTestSignFreeAgents(
  malformedFreeAgentMarkerWorld, 3, []
);
assert.equal(blockedMalformedFormerClubReturn.length, 0,
  "an array-shaped freeAgentSince value must not unlock an immediate former-club return");
assert.equal(malformedFreeAgentMarkerWorld.players["malformed-free-agent-marker"].freeAgent, true,
  "a malformed free-agent start marker must preserve the conservative return restriction");

// A season marker is an integer ordinal, not an elapsed-time decimal. Both numeric
// and numeric-string fractions used to pass Number.isFinite and unlock an early return.
for (const [index, marker] of [2.5, "2.5"].entries()) {
  const fractionalMarkerWorld = {
    clubs: {}, players: {}, transfers: [], marketReports: [], playerHistory: {},
    notes: [], nextGeneratedPlayer: 1, dbVersion: 0, transferSequence: 0
  };
  const fractionalFormerClub = makeMarketTestClub(
    fractionalMarkerWorld, "fractional-former-club-" + index, 2, "goalkeeper"
  );
  const playerId = "fractional-free-agent-" + index;
  fractionalMarkerWorld.players[playerId] = {
    id: playerId, name: "Fractional free-agent marker keeper " + index,
    clubId: "", country: "Testland", leagueId: "test-market", division: 0,
    position: "حارس مرمى", group: "goalkeeper", ovr: 60, potential: 65,
    age: 26, contractSeasons: 0, freeAgent: true,
    previousClubId: fractionalFormerClub.id, freeAgentSince: marker, isGenerated: false
  };
  const blockedFractionalReturn = sandbox.window.__lwTestSignFreeAgents(
    fractionalMarkerWorld, 3, []
  );
  assert.equal(blockedFractionalReturn.length, 0,
    "fractional freeAgentSince markers must not unlock a former-club return in season 3");
  assert.equal(fractionalMarkerWorld.players[playerId].freeAgent, true,
    "players with fractional season markers must remain free agents during the conservative waiting period");
}

// Valid numeric strings remain supported for older saves.
const numericStringMarkerWorld = {
  clubs: {}, players: {}, transfers: [], marketReports: [], playerHistory: {},
  notes: [], nextGeneratedPlayer: 1, dbVersion: 0, transferSequence: 0
};
const numericStringFormerClub = makeMarketTestClub(
  numericStringMarkerWorld, "numeric-string-former-club", 2, "goalkeeper"
);
numericStringMarkerWorld.players["numeric-string-free-agent"] = {
  id: "numeric-string-free-agent", name: "Numeric-string returning keeper",
  clubId: "", country: "Testland", leagueId: "test-market", division: 0,
  position: "حارس مرمى", group: "goalkeeper", ovr: 60, potential: 65,
  age: 26, contractSeasons: 0, freeAgent: true,
  previousClubId: numericStringFormerClub.id, freeAgentSince: "2", isGenerated: false
};
const delayedNumericStringReturn = sandbox.window.__lwTestSignFreeAgents(
  numericStringMarkerWorld, 3, []
);
assert.equal(delayedNumericStringReturn.length, 1,
  "a valid integer numeric-string marker must still allow return after one complete free-agent season");
assert.equal(delayedNumericStringReturn[0].toClubId, numericStringFormerClub.id,
  "numeric-string legacy markers must resolve to the exact former club");

// Malformed legacy values must not abort the market or be coerced into valid terms.
function makeMalformedFreeAgentMarketWorld(clubId, playerPatch) {
  const world = {
    clubs: {}, players: {}, transfers: [], marketReports: [], playerHistory: {},
    notes: [], nextGeneratedPlayer: 1, dbVersion: 0, transferSequence: 0
  };
  const club = makeMarketTestClub(world, clubId, 2, "goalkeeper");
  const player = Object.assign({
    id: "malformed-free-agent", name: "Malformed free-agent fixture",
    clubId: "", country: "Testland", leagueId: "test-market", division: 0,
    position: "حارس مرمى", group: "goalkeeper", ovr: 60, potential: 65,
    age: 26, contractSeasons: 0, freeAgent: true,
    previousClubId: "different-former-club", freeAgentSince: 2, isGenerated: false
  }, playerPatch || {});
  world.players[player.id] = player;
  return { world, club, player };
}
const malformedFreeAgentCases = [
  { label: "Symbol contract term", patch: { contractSeasons: Symbol("bad-contract") } },
  { label: "array contract term", patch: { contractSeasons: [0] } },
  { label: "Symbol player rating", patch: { ovr: Symbol("bad-rating") } },
  { label: "array player rating", patch: { ovr: [60] } },
  { label: "Symbol player age", patch: { age: Symbol("bad-age") } },
  { label: "array player age", patch: { age: [26] } }
];
for (const malformedCase of malformedFreeAgentCases) {
  const fixture = makeMalformedFreeAgentMarketWorld(
    "malformed-" + malformedCase.label.replace(/\W+/g, "-"), malformedCase.patch
  );
  let signed;
  assert.doesNotThrow(() => {
    signed = sandbox.window.__lwTestSignFreeAgents(fixture.world, 3, []);
  }, malformedCase.label + " must not throw during the free-agent window");
  assert.equal(signed.length, 0, malformedCase.label + " must not create a signing");
  assert.equal(fixture.player.freeAgent, true, malformedCase.label + " must leave the player available");
}
const malformedPreviousClub = makeMalformedFreeAgentMarketWorld("malformed-previous-club", {});
malformedPreviousClub.player.previousClubId = [malformedPreviousClub.club.id];
let malformedPreviousClubMoves;
assert.doesNotThrow(() => {
  malformedPreviousClubMoves = sandbox.window.__lwTestSignFreeAgents(malformedPreviousClub.world, 3, []);
}, "an array-shaped previousClubId must not abort free-agent recruitment");
assert.equal(malformedPreviousClubMoves.length, 0,
  "an unresolvable previousClubId must not permit a potentially immediate former-club return");
const malformedFormerSince = makeMalformedFreeAgentMarketWorld("malformed-former-since", {});
malformedFormerSince.player.previousClubId = malformedFormerSince.club.id;
malformedFormerSince.player.freeAgentSince = Symbol("bad-free-agent-season");
let malformedFormerSinceMoves;
assert.doesNotThrow(() => {
  malformedFormerSinceMoves = sandbox.window.__lwTestSignFreeAgents(malformedFormerSince.world, 3, []);
}, "a Symbol freeAgentSince marker must not abort the market");
assert.equal(malformedFormerSinceMoves.length, 0,
  "an invalid former-club date must keep the return restriction conservative");
const malformedClubPower = makeMalformedFreeAgentMarketWorld("malformed-club-power", {});
malformedClubPower.club.power = Symbol("bad-club-power");
let malformedPowerMoves;
assert.doesNotThrow(() => {
  malformedPowerMoves = sandbox.window.__lwTestSignFreeAgents(malformedClubPower.world, 3, []);
}, "a Symbol club power must not abort the free-agent market");
assert.equal(malformedPowerMoves.length, 1,
  "a club with malformed current power must remain eligible when its basePower is valid");
assert.equal(malformedClubPower.player.clubId, malformedClubPower.club.id,
  "free-agent recruitment must compare player quality against the valid basePower fallback");
const malformedMarketSeason = makeMalformedFreeAgentMarketWorld("malformed-market-season", {});
let malformedSeasonMoves;
assert.doesNotThrow(() => {
  malformedSeasonMoves = sandbox.window.__lwTestSignFreeAgents(
    malformedMarketSeason.world, Symbol("bad-season"), []
  );
}, "an invalid market season must be rejected without throwing");
assert.equal(malformedSeasonMoves.length, 0,
  "an invalid market season must not create free-agent signings");
assert.equal(malformedMarketSeason.player.freeAgent, true,
  "an invalid market season must not mutate the free agent");

// Numeric-string fields from older saves remain supported by the stricter parser.
const numericStringMarket = makeMalformedFreeAgentMarketWorld("numeric-string-market", {
  contractSeasons: "0", ovr: "60", age: "26"
});
numericStringMarket.club.power = "55";
const numericStringMarketMoves = sandbox.window.__lwTestSignFreeAgents(
  numericStringMarket.world, "3", []
);
assert.equal(numericStringMarketMoves.length, 1,
  "valid numeric-string market fields must remain compatible with legacy saves");




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
  clubs: { "renewal-club": { id: "renewal-club", name: "Role renewal test club", power: hostileSavedNumber, basePower: 80, roster: renewalPlayers.map(player => player.id) } },
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

// Legacy roster arrays can store numeric IDs while player records use string IDs.
// Contract expiry must detach the player from the old club using the same ID semantics
// as the canonical roster reconciliation, otherwise a stale membership survives.
const legacyExpiryClubId = "legacy-contract-expiry-club";
const legacyExpiryPlayerId = "7001";
const legacyExpiryPlayer = {
  id: legacyExpiryPlayerId, name: "Legacy numeric roster expiry", clubId: legacyExpiryClubId,
  group: "attacker", position: "مهاجم", age: 35, contractSeasons: 1,
  ovr: 40, potential: 40, freeAgent: false, retired: false
};
const legacyExpiryWorld = {
  players: { [legacyExpiryPlayerId]: legacyExpiryPlayer },
  clubs: { [legacyExpiryClubId]: {
    id: legacyExpiryClubId, name: "Legacy expiry club", power: 80, roster: [7001]
  } },
  seasonStats: { "1": [] },
  notes: [], lastDevelopedSeason: 0
};
sandbox.window.__lwTestDevelopPlayers(legacyExpiryWorld, 1);
assert.equal(legacyExpiryPlayer.freeAgent, true,
  "an expiring legacy player must enter the free-agent pool");
assert.equal(legacyExpiryPlayer.clubId, "",
  "an expired contract must clear current club ownership");
assert.equal(legacyExpiryPlayer.previousClubId, legacyExpiryClubId,
  "an expired contract must retain the former club ID for transfer history");
assert.ok(!legacyExpiryWorld.clubs[legacyExpiryClubId].roster.some(id => String(id) === legacyExpiryPlayerId),
  "contract expiry must remove numeric legacy roster IDs for string player IDs");

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

// End-of-season development must use the canonical player-map key when a saved player.id has drifted.
const canonicalProgressionPlayerKey = "canonical-progression-map-key";
const staleProgressionInternalId = "stale-progression-internal-id";
const canonicalProgressionPlayer = {
  id: staleProgressionInternalId, name: "Canonical progression identity",
  clubId: "canonical-progression-club", leagueId: "canonical-progression-league",
  division: 1, group: "attacker", position: "مهاجم", age: 23,
  contractSeasons: 3, ovr: 70, potential: 90, lastRating: 0, freeAgent: false, retired: false
};
const canonicalProgressionWorld = {
  players: { [canonicalProgressionPlayerKey]: canonicalProgressionPlayer },
  clubs: { "canonical-progression-club": {
    id: "canonical-progression-club", name: "Canonical Progression Club",
    division: 1, roster: [canonicalProgressionPlayerKey], power: 70
  } },
  seasonStats: { "1": [{
    id: { toString() { throw new Error("unsafe progression stat ID coercion"); } },
    playerId: canonicalProgressionPlayerKey, appearances: 10, averageRating: 7.4
  }] },
  notes: [], lastDevelopedSeason: 0
};
assert.doesNotThrow(() => sandbox.window.__lwTestDevelopPlayers(canonicalProgressionWorld, 1),
  "stale internal player IDs and hostile season-stat IDs must not interrupt development");
assert.equal(canonicalProgressionPlayer.age, 24,
  "progression must still age a player whose internal ID is stale");
assert.equal(canonicalProgressionPlayer.ovr, 72,
  "season statistics keyed by the canonical player-map key must still drive development");
assert.equal(canonicalProgressionPlayer.lastRating, 7.4,
  "the canonical season-stat row must remain attached to the correct player");
assert.equal(canonicalProgressionPlayer.contractSeasons, 2);
assert.equal(canonicalProgressionPlayer.id, staleProgressionInternalId,
  "progression must preserve the original internal ID instead of rewriting saved player data");

// A free agent can retain a former-club roster entry under the canonical map key even
// when the player's internal ID is stale. Cleanup must remove that exact membership.
const canonicalFreeAgentMapKey = "canonical-free-agent-map-key";
const staleFreeAgentInternalId = "stale-free-agent-internal-id";
const canonicalFreeAgentPlayer = {
  id: staleFreeAgentInternalId, name: "Canonical free-agent cleanup",
  clubId: "", previousClubId: "canonical-former-club", leagueId: "", division: 0,
  group: "attacker", position: "مهاجم", age: 25, contractSeasons: 0,
  ovr: 55, potential: 60, freeAgent: true, freeAgentSince: 1, transferListed: false, retired: false
};
const canonicalFreeAgentWorld = {
  players: { [canonicalFreeAgentMapKey]: canonicalFreeAgentPlayer },
  clubs: { "canonical-former-club": {
    id: "canonical-former-club", name: "Canonical Former Club", roster: [canonicalFreeAgentMapKey]
  } },
  seasonStats: { "1": [] }, notes: [], lastDevelopedSeason: 0
};
sandbox.window.__lwTestDevelopPlayers(canonicalFreeAgentWorld, 1);
assert.deepEqual(canonicalFreeAgentWorld.clubs["canonical-former-club"].roster, [],
  "free-agent cleanup must remove the canonical roster key, not the stale internal ID");
assert.equal(canonicalFreeAgentWorld.players[canonicalFreeAgentMapKey], canonicalFreeAgentPlayer,
  "free-agent cleanup must preserve the player record under its original map key");
assert.equal(canonicalFreeAgentPlayer.id, staleFreeAgentInternalId,
  "free-agent cleanup must not rewrite the saved internal ID");

// Retirement must remove the canonical roster entry and retain history under the
// canonical map key even when the internal ID cannot be coerced to a string.
const canonicalRetirementMapKey = "canonical-retirement-map-key";
const hostileRetirementInternalId = {
  toString() { throw new Error("unsafe retirement player ID coercion"); },
  valueOf() { throw new Error("unsafe retirement player numeric coercion"); }
};
const canonicalRetirementPlayer = {
  id: hostileRetirementInternalId, name: "Canonical retirement identity",
  clubId: "canonical-retirement-club", leagueId: "canonical-retirement-league", division: 1,
  group: "attacker", position: "مهاجم", age: 42, contractSeasons: 1,
  ovr: 70, potential: 75, freeAgent: false, retired: false
};
const canonicalRetirementWorld = {
  players: { [canonicalRetirementMapKey]: canonicalRetirementPlayer },
  clubs: { "canonical-retirement-club": {
    id: "canonical-retirement-club", name: "Canonical Retirement Club",
    country: "Testland", roster: [canonicalRetirementMapKey], division: 1
  } },
  seasonStats: { "1": [{ id: canonicalRetirementMapKey, appearances: 30, averageRating: 7.1 }] },
  playerHistory: { [canonicalRetirementMapKey]: [{ season: 1, type: "transfer-in", club: "Canonical Retirement Club" }] },
  notes: []
};
assert.doesNotThrow(() => sandbox.window.__lwTestDevelopPlayers(canonicalRetirementWorld, 1),
  "retirement must not coerce a hostile internal player ID");
assert.equal(canonicalRetirementPlayer.retired, true);
assert.deepEqual(canonicalRetirementWorld.clubs["canonical-retirement-club"].roster, [],
  "retirement must remove the canonical player-map key from the club roster");
assert.equal(canonicalRetirementWorld.playerHistory[canonicalRetirementMapKey][0].type, "retirement",
  "retirement history must be stored under the canonical player-map key");
assert.equal(canonicalRetirementWorld.playerHistory[canonicalRetirementMapKey][1].type, "transfer-in",
  "retirement must preserve prior history under the canonical player-map key");
assert.strictEqual(canonicalRetirementPlayer.id, hostileRetirementInternalId,
  "retirement must preserve the original malformed internal ID without coercion");

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

// A catalogue refresh must not re-import a free agent at their former club.
// Age changes alter the deterministic source ID, while roster identity ignores age.
const freeAgentReconcileClubName = "Free Agent Reconcile Club";
const freeAgentReconcileCountry = "Testland";
const freeAgentReconcileLeagueId = "free-agent-reconcile-league";
const freeAgentReconcileClubId = ai.clubKey(freeAgentReconcileClubName, freeAgentReconcileCountry);
const freeAgentReconcilePlayerId = "saved-free-agent-former-club";
const freeAgentReconcilePlayerName = "Free Agent Source Identity";
const freeAgentReconcileWorld = {
  schemaVersion: ai.version, dbVersion: 1, currentSeason: 6,
  lastCompletedSeason: 5, lastAdvancedTo: 6, rosterSchemaVersion: 3,
  rosterMembershipSchemaVersion: 6, completedSeasons: [],
  players: {
    [freeAgentReconcilePlayerId]: {
      id: freeAgentReconcilePlayerId, name: freeAgentReconcilePlayerName, clubId: "",
      country: freeAgentReconcileCountry, leagueId: "", division: 0,
      position: "جناح", group: "attacker", ovr: 66, potential: 76, age: 24,
      contractSeasons: 0, retired: false, freeAgent: true, freeAgentSince: 6,
      previousClubId: freeAgentReconcileClubId, isRealPlayer: true, isGenerated: false
    }
  },
  clubs: {
    [freeAgentReconcileClubId]: {
      id: freeAgentReconcileClubId, name: freeAgentReconcileClubName,
      country: freeAgentReconcileCountry, leagueId: freeAgentReconcileLeagueId,
      division: 1, leagueName: "Free Agent Test League",
      leagueEnglish: "Free Agent Test League", matchesPerSeason: 30,
      power: 64, basePower: 64, prestige: 50, roster: []
    }
  },
  playerHistory: { [freeAgentReconcilePlayerId]: [
    { season: 4, type: "contract-expiry", club: freeAgentReconcileClubName, country: freeAgentReconcileCountry }
  ] },
  seasonStats: { "5": [{
    id: freeAgentReconcilePlayerId, playerId: freeAgentReconcilePlayerId,
    season: 5, appearances: 18, goals: 4, assists: 2
  }] },
  leagueTables: {}, matchesBySeason: {}, competitionsBySeason: {},
  transfers: [], marketReports: [], notes: [],
  nextGeneratedPlayer: 1, transferSequence: 0, projectionRevision: 8
};
const freeAgentReconcileDb = {
  version: 2,
  leagues: () => [{ id: freeAgentReconcileLeagueId }],
  leagueFor: () => ({
    name: "Free Agent Test League", englishName: "Free Agent Test League", matchesPerSeason: 30
  }),
  clubs: () => [{
    name: freeAgentReconcileClubName, country: freeAgentReconcileCountry,
    leagueId: freeAgentReconcileLeagueId, division: 1,
    players: [{ name: freeAgentReconcilePlayerName, position: "جناح",
      age: 25, ovr: 68, potential: 79, isRealPlayer: true }]
  }]
};
sandbox.window.__lwTestReconcileDatabase(freeAgentReconcileWorld, freeAgentReconcileDb);
const savedFreeAgent = freeAgentReconcileWorld.players[freeAgentReconcilePlayerId];
const duplicateFormerClubPlayers = Object.values(freeAgentReconcileWorld.players).filter(player =>
  player && player.name === freeAgentReconcilePlayerName
  && String(player.clubId || "") === freeAgentReconcileClubId
  && !player.retired && !player.freeAgent);
assert.equal(savedFreeAgent.freeAgent, true,
  "a saved free agent must remain unattached after a catalogue refresh");
assert.equal(savedFreeAgent.clubId, "",
  "catalogue reconciliation must not silently restore the free agent's former club");
assert.equal(savedFreeAgent.previousClubId, freeAgentReconcileClubId,
  "the former club must remain available to the free-agent market");
assert.equal(duplicateFormerClubPlayers.length, 0,
  "a changed source age must not create a duplicate player at the former club");
assert.ok(!freeAgentReconcileWorld.clubs[freeAgentReconcileClubId].roster.includes(freeAgentReconcilePlayerId),
  "the detached free-agent record must stay out of the former club's active roster");
assert.equal(freeAgentReconcileWorld.playerHistory[freeAgentReconcilePlayerId].length, 1,
  "the free agent's career history must remain intact");
assert.equal(freeAgentReconcileWorld.seasonStats["5"][0].goals, 4,
  "the free agent's saved season statistics must remain intact");


// Reconciliation must resolve former-club history through the canonical map key
// even when the player's internal ID is stale and previousClubId is absent.
const canonicalHistoryReconcileMapKey = "canonical-history-reconcile-map-key";
const staleHistoryReconcileInternalId = "stale-history-reconcile-internal-id";
const canonicalHistoryReconcileWorld = {
  schemaVersion: ai.version, dbVersion: 1, currentSeason: 6,
  lastCompletedSeason: 5, lastAdvancedTo: 6, rosterSchemaVersion: 3,
  rosterMembershipSchemaVersion: 6, completedSeasons: [],
  players: {
    [canonicalHistoryReconcileMapKey]: {
      id: staleHistoryReconcileInternalId, name: freeAgentReconcilePlayerName,
      clubId: "", previousClubId: "", country: freeAgentReconcileCountry,
      leagueId: "", division: 0, position: "جناح", group: "attacker",
      ovr: 66, potential: 76, age: 24, contractSeasons: 0,
      retired: false, freeAgent: true, freeAgentSince: 6,
      isRealPlayer: true, isGenerated: false
    }
  },
  clubs: {
    [freeAgentReconcileClubId]: {
      id: freeAgentReconcileClubId, name: freeAgentReconcileClubName,
      country: freeAgentReconcileCountry, leagueId: freeAgentReconcileLeagueId,
      division: 1, leagueName: "Free Agent Test League",
      leagueEnglish: "Free Agent Test League", matchesPerSeason: 30,
      power: 64, basePower: 64, prestige: 50, roster: []
    }
  },
  playerHistory: {
    [canonicalHistoryReconcileMapKey]: [{
      season: 4, type: "contract-expiry", fromClubId: freeAgentReconcileClubId,
      from: freeAgentReconcileClubName, fromCountry: freeAgentReconcileCountry
    }]
  },
  transferClubHistoryByPlayer: {
    [canonicalHistoryReconcileMapKey]: [{
      clubId: freeAgentReconcileClubId, name: freeAgentReconcileClubName,
      country: freeAgentReconcileCountry
    }]
  },
  transferClubHistorySchemaVersion: 1,
  seasonStats: { "5": [{
    id: canonicalHistoryReconcileMapKey, playerId: canonicalHistoryReconcileMapKey,
    season: 5, appearances: 18, goals: 4, assists: 2
  }] },
  leagueTables: {}, matchesBySeason: {}, competitionsBySeason: {},
  transfers: [], marketReports: [], notes: [],
  nextGeneratedPlayer: 1, transferSequence: 0, projectionRevision: 8
};
sandbox.window.__lwTestReconcileDatabase(canonicalHistoryReconcileWorld, freeAgentReconcileDb);
const canonicalHistoryFreeAgent = canonicalHistoryReconcileWorld.players[canonicalHistoryReconcileMapKey];
const canonicalHistoryDuplicates = Object.values(canonicalHistoryReconcileWorld.players).filter(player =>
  player && player.name === freeAgentReconcilePlayerName
  && String(player.clubId || "") === freeAgentReconcileClubId
  && !player.retired && !player.freeAgent);
assert.strictEqual(canonicalHistoryFreeAgent.id, staleHistoryReconcileInternalId,
  "database reconciliation must preserve the original stale internal player ID");
assert.equal(canonicalHistoryFreeAgent.freeAgent, true);
assert.equal(canonicalHistoryFreeAgent.clubId, "",
  "canonical former-club history must keep the saved free agent unattached");
assert.equal(canonicalHistoryDuplicates.length, 0,
  "reconciliation must not re-import a free agent when canonical player history records their former club");
assert.ok(canonicalHistoryReconcileWorld.playerHistory[canonicalHistoryReconcileMapKey],
  "career history must remain stored under the canonical player-map key");
assert.ok(canonicalHistoryReconcileWorld.transferClubHistoryByPlayer[canonicalHistoryReconcileMapKey],
  "compact former-club history must remain stored under the canonical player-map key");
assert.ok(!Object.prototype.hasOwnProperty.call(canonicalHistoryReconcileWorld.playerHistory, staleHistoryReconcileInternalId),
  "reconciliation must not move career history to the stale internal ID");
assert.ok(!canonicalHistoryReconcileWorld.clubs[freeAgentReconcileClubId].roster.includes(canonicalHistoryReconcileMapKey),
  "a detached free agent must remain outside the former club's active roster");

// Unique legacy internal-ID history aliases migrate to the canonical map key.
// Ambiguous aliases are retained rather than being assigned to multiple players.
const legacyHistoryReconcileMapKey = "legacy-history-canonical-map-key";
const legacyHistoryReconcileInternalId = "legacy-history-stale-internal-id";
const legacyHistoryReconcileWorld = {
  schemaVersion: ai.version, dbVersion: 1, currentSeason: 6,
  lastCompletedSeason: 5, lastAdvancedTo: 6, rosterSchemaVersion: 3,
  rosterMembershipSchemaVersion: 6, completedSeasons: [],
  players: {
    [legacyHistoryReconcileMapKey]: {
      id: legacyHistoryReconcileInternalId, name: freeAgentReconcilePlayerName,
      clubId: "", previousClubId: "", country: freeAgentReconcileCountry,
      leagueId: "", division: 0, position: "جناح", group: "attacker",
      ovr: 66, potential: 76, age: 24, contractSeasons: 0,
      retired: false, freeAgent: true, freeAgentSince: 6,
      isRealPlayer: true, isGenerated: false
    }
  },
  clubs: {
    [freeAgentReconcileClubId]: {
      id: freeAgentReconcileClubId, name: freeAgentReconcileClubName,
      country: freeAgentReconcileCountry, leagueId: freeAgentReconcileLeagueId,
      division: 1, leagueName: "Free Agent Test League",
      leagueEnglish: "Free Agent Test League", matchesPerSeason: 30,
      power: 64, basePower: 64, prestige: 50, roster: []
    }
  },
  playerHistory: {
    [legacyHistoryReconcileInternalId]: [{
      season: 4, type: "contract-expiry", fromClubId: freeAgentReconcileClubId,
      from: freeAgentReconcileClubName, fromCountry: freeAgentReconcileCountry
    }]
  },
  transferClubHistoryByPlayer: {
    [legacyHistoryReconcileInternalId]: [{
      clubId: freeAgentReconcileClubId, name: freeAgentReconcileClubName,
      country: freeAgentReconcileCountry
    }]
  },
  transferClubHistorySchemaVersion: 1,
  archive: { playerHistory: {
    [legacyHistoryReconcileInternalId]: [{
      season: 3, type: "transfer", fromClubId: freeAgentReconcileClubId,
      from: freeAgentReconcileClubName, fromCountry: freeAgentReconcileCountry
    }]
  } },
  seasonStats: { "5": [{
    id: legacyHistoryReconcileMapKey, playerId: legacyHistoryReconcileMapKey,
    season: 5, appearances: 18, goals: 4, assists: 2
  }] },
  leagueTables: {}, matchesBySeason: {}, competitionsBySeason: {},
  transfers: [], marketReports: [], notes: [],
  nextGeneratedPlayer: 1, transferSequence: 0, projectionRevision: 8
};
sandbox.window.__lwTestReconcileDatabase(legacyHistoryReconcileWorld, freeAgentReconcileDb);
const legacyHistoryFreeAgent = legacyHistoryReconcileWorld.players[legacyHistoryReconcileMapKey];
const legacyHistoryDuplicates = Object.values(legacyHistoryReconcileWorld.players).filter(player =>
  player && player.name === freeAgentReconcilePlayerName
  && String(player.clubId || "") === freeAgentReconcileClubId
  && !player.retired && !player.freeAgent);
assert.strictEqual(legacyHistoryFreeAgent.id, legacyHistoryReconcileInternalId,
  "legacy history migration must preserve the original internal player ID");
assert.equal(legacyHistoryFreeAgent.freeAgent, true);
assert.equal(legacyHistoryFreeAgent.clubId, "",
  "legacy former-club history must keep the saved free agent unattached");
assert.equal(legacyHistoryDuplicates.length, 0,
  "legacy history keyed by a unique internal ID must prevent former-club re-import");
assert.ok(legacyHistoryReconcileWorld.playerHistory[legacyHistoryReconcileMapKey],
  "unique legacy career history must move to the canonical player-map key");
assert.ok(!Object.prototype.hasOwnProperty.call(legacyHistoryReconcileWorld.playerHistory, legacyHistoryReconcileInternalId),
  "the old unique career-history alias must be removed after migration");
assert.ok(legacyHistoryReconcileWorld.transferClubHistoryByPlayer[legacyHistoryReconcileMapKey],
  "legacy compact club history must move to the canonical player-map key");
assert.ok(!Object.prototype.hasOwnProperty.call(legacyHistoryReconcileWorld.transferClubHistoryByPlayer, legacyHistoryReconcileInternalId),
  "the old compact-history alias must be removed after migration");
assert.ok(legacyHistoryReconcileWorld.archive.playerHistory[legacyHistoryReconcileMapKey],
  "archived legacy player history must also migrate to the canonical key");
assert.ok(!Object.prototype.hasOwnProperty.call(legacyHistoryReconcileWorld.archive.playerHistory, legacyHistoryReconcileInternalId),
  "the archived legacy history alias must be removed after migration");

const ambiguousLegacyHistoryId = "shared-ambiguous-history-id";
const ambiguousLegacyHistoryWorld = {
  schemaVersion: ai.version, dbVersion: 2, currentSeason: 6,
  lastCompletedSeason: 5, lastAdvancedTo: 6, rosterSchemaVersion: 3,
  rosterMembershipSchemaVersion: 6, completedSeasons: [],
  players: {
    "ambiguous-player-map-a": {
      id: ambiguousLegacyHistoryId, name: "Ambiguous History Player A",
      clubId: "", previousClubId: "", country: "Testland", leagueId: "", division: 0,
      position: "مهاجم", group: "attacker", age: 25, ovr: 60, potential: 65,
      retired: false, freeAgent: true, freeAgentSince: 6
    },
    "ambiguous-player-map-b": {
      id: ambiguousLegacyHistoryId, name: "Ambiguous History Player B",
      clubId: "", previousClubId: "", country: "Testland", leagueId: "", division: 0,
      position: "مهاجم", group: "attacker", age: 25, ovr: 60, potential: 65,
      retired: false, freeAgent: true, freeAgentSince: 6
    }
  },
  clubs: {},
  playerHistory: {
    [ambiguousLegacyHistoryId]: [{ season: 3, type: "transfer", fromClubId: "ambiguous-former-club" }]
  },
  transferClubHistoryByPlayer: {
    [ambiguousLegacyHistoryId]: [{ clubId: "ambiguous-former-club", name: "Ambiguous Former Club", country: "Testland" }]
  },
  transferClubHistorySchemaVersion: 1,
  archive: { playerHistory: {
    [ambiguousLegacyHistoryId]: [{ season: 2, type: "transfer", fromClubId: "ambiguous-former-club" }]
  } },
  seasonStats: {}, leagueTables: {}, matchesBySeason: {}, competitionsBySeason: {},
  transfers: [], marketReports: [], notes: [], nextGeneratedPlayer: 1,
  transferSequence: 0, projectionRevision: 0
};
sandbox.window.__lwTestReconcileDatabase(ambiguousLegacyHistoryWorld, {
  version: 2, leagues: () => [], clubs: () => []
});
assert.ok(ambiguousLegacyHistoryWorld.playerHistory[ambiguousLegacyHistoryId],
  "ambiguous legacy history must remain available under its original ID");
assert.ok(!Object.prototype.hasOwnProperty.call(ambiguousLegacyHistoryWorld.playerHistory, "ambiguous-player-map-a")
  && !Object.prototype.hasOwnProperty.call(ambiguousLegacyHistoryWorld.playerHistory, "ambiguous-player-map-b"),
  "an ambiguous internal-ID history alias must never be assigned to multiple canonical players");
assert.ok(ambiguousLegacyHistoryWorld.transferClubHistoryByPlayer[ambiguousLegacyHistoryId],
  "ambiguous compact club history must remain preserved under its original ID");

const collidingCanonicalHistoryWorld = {
  schemaVersion: ai.version, dbVersion: 2, currentSeason: 6,
  lastCompletedSeason: 5, lastAdvancedTo: 6, rosterSchemaVersion: 3,
  rosterMembershipSchemaVersion: 6, completedSeasons: [],
  players: {
    "canonical-collision-player-a": {
      id: "canonical-collision-player-b", name: "Collision Player A",
      clubId: "", previousClubId: "", country: "Testland", leagueId: "", division: 0,
      position: "مهاجم", group: "attacker", age: 25, ovr: 60, potential: 65,
      retired: false, freeAgent: true, freeAgentSince: 6
    },
    "canonical-collision-player-b": {
      id: "internal-collision-player-b", name: "Collision Player B",
      clubId: "", previousClubId: "", country: "Testland", leagueId: "", division: 0,
      position: "مهاجم", group: "attacker", age: 25, ovr: 60, potential: 65,
      retired: false, freeAgent: true, freeAgentSince: 6
    }
  },
  clubs: {},
  playerHistory: {
    "canonical-collision-player-b": [{ season: 3, type: "transfer", fromClubId: "collision-former-club" }]
  },
  transferClubHistoryByPlayer: {
    "canonical-collision-player-b": [{
      clubId: "collision-former-club", name: "Collision Former Club", country: "Testland"
    }]
  },
  transferClubHistorySchemaVersion: 1,
  archive: { playerHistory: {
    "canonical-collision-player-b": [{ season: 2, type: "transfer", fromClubId: "collision-former-club" }]
  } },
  seasonStats: {}, leagueTables: {}, matchesBySeason: {}, competitionsBySeason: {},
  transfers: [], marketReports: [], notes: [], nextGeneratedPlayer: 1,
  transferSequence: 0, projectionRevision: 0
};
sandbox.window.__lwTestReconcileDatabase(collidingCanonicalHistoryWorld, {
  version: 2, leagues: () => [], clubs: () => []
});
assert.ok(collidingCanonicalHistoryWorld.playerHistory["canonical-collision-player-b"],
  "a canonical history key owned by another player must remain untouched");
assert.ok(!Object.prototype.hasOwnProperty.call(collidingCanonicalHistoryWorld.playerHistory, "canonical-collision-player-a"),
  "legacy alias migration must not steal another player's canonical history key");
assert.ok(collidingCanonicalHistoryWorld.transferClubHistoryByPlayer["canonical-collision-player-b"],
  "canonical compact history must not be reassigned to a different player");

// An active player moved by the simulation must not be imported again into the
// selling club when the source catalogue still lists them there after an age update.
const transferReconcileOriginName = "Transfer Reconcile Origin";
const transferReconcileDestinationName = "Transfer Reconcile Destination";
const transferReconcileCountry = "Testland";
const transferReconcileLeagueId = "transfer-reconcile-league";
const transferReconcileOriginId = ai.clubKey(transferReconcileOriginName, transferReconcileCountry);
const transferReconcileDestinationId = ai.clubKey(transferReconcileDestinationName, transferReconcileCountry);
const transferReconcilePlayerId = "saved-transferred-player";
const transferReconcilePlayerName = "Transferred Source Identity";
const transferReconcileWorld = {
  schemaVersion: ai.version, dbVersion: 1, currentSeason: 6,
  lastCompletedSeason: 5, lastAdvancedTo: 6, rosterSchemaVersion: 3,
  rosterMembershipSchemaVersion: 6, completedSeasons: [],
  players: {
    [transferReconcilePlayerId]: {
      id: transferReconcilePlayerId, name: transferReconcilePlayerName,
      clubId: transferReconcileDestinationId, country: transferReconcileCountry,
      leagueId: transferReconcileLeagueId, division: 1,
      position: "جناح", group: "attacker", ovr: 70, potential: 80, age: 24,
      contractSeasons: 3, retired: false, freeAgent: false, isRealPlayer: true, isGenerated: false
    }
  },
  clubs: {
    [transferReconcileOriginId]: {
      id: transferReconcileOriginId, name: transferReconcileOriginName,
      country: transferReconcileCountry, leagueId: transferReconcileLeagueId,
      division: 1, leagueName: "Transfer Test League", leagueEnglish: "Transfer Test League",
      matchesPerSeason: 30, power: 64, basePower: 64, prestige: 50, roster: []
    },
    [transferReconcileDestinationId]: {
      id: transferReconcileDestinationId, name: transferReconcileDestinationName,
      country: transferReconcileCountry, leagueId: transferReconcileLeagueId,
      division: 1, leagueName: "Transfer Test League", leagueEnglish: "Transfer Test League",
      matchesPerSeason: 30, power: 66, basePower: 66, prestige: 52, roster: [transferReconcilePlayerId]
    }
  },
  playerHistory: {
    [transferReconcilePlayerId]: [{
      season: 5, clubId: transferReconcileDestinationId,
      club: transferReconcileDestinationName, country: transferReconcileCountry,
      fromClubId: transferReconcileOriginId, from: transferReconcileOriginName,
      type: "transfer-in"
    }]
  },
  seasonStats: { "5": [{
    id: transferReconcilePlayerId, playerId: transferReconcilePlayerId,
    clubId: transferReconcileDestinationId, season: 5, appearances: 25, goals: 8, assists: 5
  }] },
  leagueTables: {}, matchesBySeason: {}, competitionsBySeason: {},
  transfers: [{ id: "transfer-reconcile-ledger", playerId: transferReconcilePlayerId,
    fromClubId: transferReconcileOriginId, toClubId: transferReconcileDestinationId, season: 5 }],
  marketReports: [], notes: [],
  nextGeneratedPlayer: 1, transferSequence: 1, projectionRevision: 9
};
const transferReconcileDb = {
  version: 2,
  leagues: () => [{ id: transferReconcileLeagueId }],
  leagueFor: () => ({
    name: "Transfer Test League", englishName: "Transfer Test League", matchesPerSeason: 30
  }),
  clubs: () => [
    {
      name: transferReconcileOriginName, country: transferReconcileCountry,
      leagueId: transferReconcileLeagueId, division: 1,
      players: [{ name: transferReconcilePlayerName, position: "جناح",
        age: 25, ovr: 70, potential: 80, isRealPlayer: true }]
    },
    {
      name: transferReconcileDestinationName, country: transferReconcileCountry,
      leagueId: transferReconcileLeagueId, division: 1, players: []
    }
  ]
};
sandbox.window.__lwTestReconcileDatabase(transferReconcileWorld, transferReconcileDb);
const duplicateOriginTransferPlayers = Object.values(transferReconcileWorld.players).filter(player =>
  player && player.name === transferReconcilePlayerName
  && String(player.clubId || "") === transferReconcileOriginId
  && !player.retired && !player.freeAgent);
assert.equal(duplicateOriginTransferPlayers.length, 0,
  "a transferred player listed by stale source data must not be recreated at the selling club");
assert.equal(transferReconcileWorld.players[transferReconcilePlayerId].clubId, transferReconcileDestinationId,
  "the player's current destination club must remain authoritative");
assert.ok(transferReconcileWorld.clubs[transferReconcileDestinationId].roster.includes(transferReconcilePlayerId),
  "the current destination club must retain the original player in its active roster");
assert.ok(!transferReconcileWorld.clubs[transferReconcileOriginId].roster.includes(transferReconcilePlayerId),
  "the former selling club must not regain the transferred player's saved ID");
assert.equal(transferReconcileWorld.playerHistory[transferReconcilePlayerId][0].fromClubId,
  transferReconcileOriginId,
  "the transfer origin must remain available as former-club identity metadata");
assert.equal(transferReconcileWorld.seasonStats["5"][0].goals, 8,
  "the transferred player's saved season statistics must remain intact");
assert.equal(transferReconcileWorld.transfers[0].id, "transfer-reconcile-ledger",
  "catalogue reconciliation must not rewrite the saved transfer ledger");

// Older active saves can retain the transfer origin as text without a fromClubId.
const legacyTransferReconcileWorld = JSON.parse(JSON.stringify(transferReconcileWorld));
legacyTransferReconcileWorld.playerHistory[transferReconcilePlayerId] = [{
  season: 5, clubId: transferReconcileDestinationId,
  club: transferReconcileDestinationName, country: transferReconcileCountry,
  from: transferReconcileOriginName, type: "transfer-in"
}];
sandbox.window.__lwTestReconcileDatabase(legacyTransferReconcileWorld, transferReconcileDb);
const legacyDuplicateOriginPlayers = Object.values(legacyTransferReconcileWorld.players).filter(player =>
  player && player.name === transferReconcilePlayerName
  && String(player.clubId || "") === transferReconcileOriginId
  && !player.retired && !player.freeAgent);
assert.equal(legacyDuplicateOriginPlayers.length, 0,
  "a legacy textual transfer origin must prevent reimporting the active player at the former club");
assert.equal(legacyTransferReconcileWorld.players[transferReconcilePlayerId].clubId, transferReconcileDestinationId,
  "legacy history reconciliation must keep the current destination club authoritative");
assert.ok(legacyTransferReconcileWorld.clubs[transferReconcileDestinationId].roster.includes(transferReconcilePlayerId),
  "the destination club must retain the original player when legacy transfer history is reconciled");
assert.ok(!legacyTransferReconcileWorld.clubs[transferReconcileOriginId].roster.includes(transferReconcilePlayerId),
  "the former club must not regain the original player's saved ID from a legacy source row");
assert.equal(legacyTransferReconcileWorld.playerHistory[transferReconcilePlayerId][0].from,
  transferReconcileOriginName, "legacy textual transfer history must remain intact");
assert.equal(legacyTransferReconcileWorld.seasonStats["5"][0].goals, 8,
  "legacy transfer reconciliation must preserve saved season statistics");
assert.equal(legacyTransferReconcileWorld.transfers[0].id, "transfer-reconcile-ledger",
  "legacy transfer reconciliation must preserve the saved transfer ledger");

// The visible player-history list is capped at 12 rows. Older transfer endpoints
// must still protect a former club when the bounded history no longer contains it.
const longHistoryTransferWorld = JSON.parse(JSON.stringify(transferReconcileWorld));
longHistoryTransferWorld.playerHistory[transferReconcilePlayerId] = Array.from({ length: 12 }, (_, index) => ({
  season: 6 + index,
  clubId: "later-club-" + index,
  club: "Later Club " + index,
  country: "Testland",
  fromClubId: "later-former-club-" + index,
  from: "Later Former Club " + index,
  type: "transfer-in"
}));
assert.equal(longHistoryTransferWorld.playerHistory[transferReconcilePlayerId].length, 12,
  "the long-career fixture must model the bounded player-history window");
assert.ok(longHistoryTransferWorld.transfers.some(row =>
  row && row.playerId === transferReconcilePlayerId && row.fromClubId === transferReconcileOriginId),
  "the older former-club endpoint must remain in the transfer ledger");
sandbox.window.__lwTestReconcileDatabase(longHistoryTransferWorld, transferReconcileDb);
const longHistoryDuplicateOriginPlayers = Object.values(longHistoryTransferWorld.players).filter(player =>
  player && player.name === transferReconcilePlayerName
  && String(player.clubId || "") === transferReconcileOriginId
  && !player.retired && !player.freeAgent);
assert.equal(longHistoryDuplicateOriginPlayers.length, 0,
  "the transfer ledger must prevent stale roster imports after an old transfer leaves the 12-row player history");
assert.equal(longHistoryTransferWorld.players[transferReconcilePlayerId].clubId, transferReconcileDestinationId,
  "long-career reconciliation must keep the player's current club authoritative");
assert.equal(longHistoryTransferWorld.playerHistory[transferReconcilePlayerId].length, 12,
  "long-career reconciliation must preserve the existing bounded player history");
assert.equal(longHistoryTransferWorld.transfers[0].fromClubId, transferReconcileOriginId,
  "long-career reconciliation must preserve the historical transfer ledger");

// The recent transfer feed is capped at 300 rows. Former-club protection must survive
// after an older player's transfer falls out of that feed and their visible history is bounded.
const prunedTransferLedgerWorld = JSON.parse(JSON.stringify(transferReconcileWorld));
prunedTransferLedgerWorld.playerHistory[transferReconcilePlayerId] = Array.from({ length: 12 }, (_, index) => ({
  season: 20 + index, clubId: "later-club-" + index, club: "Later Club " + index,
  country: "Testland", fromClubId: "later-former-club-" + index,
  from: "Later Former Club " + index, type: "transfer-in"
}));
prunedTransferLedgerWorld.transfers = [];
prunedTransferLedgerWorld.transferClubHistoryByPlayer = {};
delete prunedTransferLedgerWorld.transferClubHistorySchemaVersion;
const sameNameClubHistoryWorld = { transferClubHistoryByPlayer: {}, transferClubHistorySchemaVersion: 1 };
sandbox.window.__lwTestRememberTransferClubEndpoints(sameNameClubHistoryWorld, {
  playerId: "same-name-club-player",
  from: "Shared Club Name", fromCountry: "Testland", fromClubId: "shared-club-id-a",
  to: "Shared Club Name", toCountry: "Testland", toClubId: "shared-club-id-b"
});
assert.equal(sameNameClubHistoryWorld.transferClubHistoryByPlayer["same-name-club-player"].length, 2,
  "distinct club IDs must remain distinct even when their normalized names and countries match");
const enrichedClubHistoryWorld = {
  transferClubHistoryByPlayer: {
    "legacy-text-club-player": [{ clubId: "", name: "Legacy Text Club", country: "Testland" }]
  },
  transferClubHistorySchemaVersion: 1
};
sandbox.window.__lwTestRememberTransferClubEndpoints(enrichedClubHistoryWorld, {
  playerId: "legacy-text-club-player", from: "Legacy Text Club",
  fromCountry: "Testland", fromClubId: "legacy-text-club-stable-id"
});
assert.equal(enrichedClubHistoryWorld.transferClubHistoryByPlayer["legacy-text-club-player"][0].clubId,
  "legacy-text-club-stable-id",
  "a newly available stable club ID must enrich an existing text-only endpoint instead of being discarded");
sandbox.window.__lwTestRememberTransferClubEndpoints(prunedTransferLedgerWorld, {
  id: "old-transfer-before-pruning", playerId: transferReconcilePlayerId,
  from: transferReconcileOriginName, fromCountry: transferReconcileCountry,
  fromClubId: transferReconcileOriginId,
  to: transferReconcileDestinationName, toCountry: transferReconcileCountry,
  toClubId: transferReconcileDestinationId
});
prunedTransferLedgerWorld.transfers = Array.from({ length: 300 }, (_, index) => ({
  id: "recent-transfer-" + index, playerId: "recent-player-" + index,
  fromClubId: "recent-former-club-" + index, toClubId: "recent-current-club-" + index
}));
sandbox.window.__lwTestReconcileDatabase(prunedTransferLedgerWorld, transferReconcileDb);
const retainedFormerClubs = prunedTransferLedgerWorld.transferClubHistoryByPlayer[transferReconcilePlayerId] || [];
assert.ok(retainedFormerClubs.some(row => row.clubId === transferReconcileOriginId),
  "the compact player club history must retain a former club after its transfer row is pruned from the 300-row feed");
const prunedLedgerDuplicates = Object.values(prunedTransferLedgerWorld.players).filter(player =>
  player && player.name === transferReconcilePlayerName
  && String(player.clubId || "") === transferReconcileOriginId
  && !player.retired && !player.freeAgent);
assert.equal(prunedLedgerDuplicates.length, 0,
  "a transfer older than the rolling ledger and player-history windows must still prevent former-club re-import");
assert.equal(prunedTransferLedgerWorld.players[transferReconcilePlayerId].clubId, transferReconcileDestinationId,
  "pruned-ledger reconciliation must keep the player's current club authoritative");
assert.equal(prunedTransferLedgerWorld.playerHistory[transferReconcilePlayerId].length, 12,
  "pruned-ledger reconciliation must preserve the bounded visible history");
assert.equal(prunedTransferLedgerWorld.transfers.length, 300,
  "the compact former-club index must not require expanding the rolling transfer feed");


// Promotion history records the destination season: a record for season 2 must prevent repeating season 1, but must not suppress the independent season 2 table move.
const promotionClubs = [];
for (let index = 1; index <= 6; index++) promotionClubs.push({
  id: "promotion-first-" + index, name: "Promotion First " + index,
  leagueId: "promotion-test", country: "Testland", division: 1,
  leagueName: "Test Premier", leagueEnglish: "Test Premier League", matchesPerSeason: 34, roster: []
});
for (let index = 1; index <= 3; index++) promotionClubs.push({
  id: "promotion-second-" + index, name: "Promotion Second " + index,
  leagueId: "promotion-test", country: "Testland", division: 2,
  leagueName: "Test Second Division", leagueEnglish: "Test Championship", matchesPerSeason: 22, roster: []
});
const promotionWorld = {
  players: {
    "promotion-listed-player": { id: "promotion-listed-player", clubId: "promotion-second-1", division: 2 },
    "promotion-unlisted-player": { id: "promotion-unlisted-player", clubId: "promotion-second-1", division: 2 },
    "promotion-relegated-player": { id: "promotion-relegated-player", clubId: "promotion-first-6", division: 1 }
  },
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
const promotionDb = {
  leagueFor: (_country, division) => Number(division) >= 2
    ? { name: "Test Second Division", englishName: "Test Championship", matchesPerSeason: 22 }
    : { name: "Test Premier", englishName: "Test Premier League", matchesPerSeason: 34 }
};
promotionWorld.clubs["promotion-second-1"].roster = ["promotion-listed-player"];
promotionWorld.clubs["promotion-first-6"].roster = ["promotion-relegated-player"];
const seasonOneMoves = sandbox.window.__lwTestApplyPromotionRelegation(promotionWorld, 1, promotionDb);
assert.equal(seasonOneMoves.length, 1, "season 1 should promote and relegate one club in the fixture league");
assert.equal(promotionWorld.promotionHistory[0].season, 2,
  "promotion history should label the destination season");
assert.equal(promotionWorld.clubs["promotion-second-1"].leagueName, "Test Premier",
  "promotion must refresh the club's persisted local competition name immediately");
assert.equal(promotionWorld.clubs["promotion-second-1"].leagueEnglish, "Test Premier League",
  "promotion must refresh the club's persisted English competition name immediately");
assert.equal(promotionWorld.clubs["promotion-second-1"].matchesPerSeason, 34,
  "promotion must refresh division-dependent season length metadata");
assert.equal(promotionWorld.clubs["promotion-first-6"].leagueName, "Test Second Division",
  "relegation must refresh the club's persisted local competition name immediately");
assert.equal(promotionWorld.clubs["promotion-first-6"].matchesPerSeason, 22,
  "relegation must refresh division-dependent season length metadata");
assert.equal(promotionWorld.players["promotion-listed-player"].division, 1,
  "promotion must update listed players' division");
assert.equal(promotionWorld.players["promotion-unlisted-player"].division, 1,
  "promotion must update every player attached to the club, even if missing from its roster array");
assert.equal(promotionWorld.players["promotion-relegated-player"].division, 2,
  "relegation must update attached players' division");
const repeatedSeasonOneMoves = sandbox.window.__lwTestApplyPromotionRelegation(promotionWorld, 1, promotionDb);
assert.equal(repeatedSeasonOneMoves.length, 0,
  "replaying the same source season must not duplicate its promotion/relegation");
const seasonTwoMoves = sandbox.window.__lwTestApplyPromotionRelegation(promotionWorld, 2, promotionDb);
assert.equal(seasonTwoMoves.length, 1,
  "a season 2 promotion/relegation must not be blocked by the prior season's destination-season history row");
assert.equal(promotionWorld.promotionHistory[0].season, 3,
  "the newest history row should record the next destination season");
assert.equal(promotionWorld.clubs["promotion-first-6"].division, 1,
  "the season 2 second-tier winner must be promoted");
assert.equal(promotionWorld.clubs["promotion-first-5"].division, 2,
  "the season 2 first-tier bottom club must be relegated");
assert.equal(promotionWorld.clubs["promotion-first-6"].leagueName, "Test Premier",
  "a later promotion must refresh the club's division metadata again");
assert.equal(promotionWorld.players["promotion-relegated-player"].division, 1,
  "a later promotion must synchronize every attached player again");

const powerFallbackPromotionClubs = [];
for (let index = 1; index <= 6; index++) {
  const id = "power-fallback-first-" + index;
  powerFallbackPromotionClubs.push({
    id, name: id, leagueId: "power-fallback", country: "Testland", division: 1,
    power: index === 6 ? hostileSavedNumber : 60,
    basePower: index === 6 ? 95 : 60, roster: []
  });
}
for (let index = 1; index <= 3; index++) {
  const id = "power-fallback-second-" + index;
  powerFallbackPromotionClubs.push({
    id, name: id, leagueId: "power-fallback", country: "Testland", division: 2,
    power: 60, basePower: 60, roster: []
  });
}
const powerFallbackPromotionWorld = {
  players: {},
  clubs: Object.fromEntries(powerFallbackPromotionClubs.map(club => [club.id, club])),
  leagueTables: { "1": {
    "power-fallback": powerFallbackPromotionClubs.filter(club => club.division === 1)
      .map(club => ({ clubId: club.id, leagueId: "power-fallback", division: 1, pts: 30, gd: 0, gf: 30 })),
    "power-fallback:2": powerFallbackPromotionClubs.filter(club => club.division === 2)
      .map(club => ({ clubId: club.id, leagueId: "power-fallback", division: 2, pts: 30, gd: 0, gf: 30 }))
  } },
  promotionHistory: [], notes: []
};
const powerFallbackPromotionMoves = sandbox.window.__lwTestApplyPromotionRelegation(
  powerFallbackPromotionWorld, 1, promotionDb
);
assert.equal(powerFallbackPromotionMoves.length, 1);
assert.equal(powerFallbackPromotionWorld.clubs["power-fallback-first-6"].division, 1,
  "a club with a valid high basePower must not be relegated because its current power is malformed");
assert.equal(powerFallbackPromotionWorld.clubs["power-fallback-first-5"].division, 2,
  "promotion tie-breaks must use basePower when current power is not numeric");

// Promotion/relegation must ignore stale standings rows after a club changes tier,
// moves to another league, or appears more than once in a legacy table.
const staleDivisionClubs = [];
for (let index = 1; index <= 6; index++) staleDivisionClubs.push({
  id: "stale-first-" + index, name: "Stale First " + index, leagueId: "stale-league",
  country: "Testland", division: 1, leagueName: "Stale Premier", leagueEnglish: "Stale Premier League",
  matchesPerSeason: 34, roster: []
});
for (let index = 1; index <= 4; index++) staleDivisionClubs.push({
  id: "stale-second-" + index, name: "Stale Second " + index, leagueId: "stale-league",
  country: "Testland", division: 2, leagueName: "Stale Second Division", leagueEnglish: "Stale Championship",
  matchesPerSeason: 22, roster: []
});
staleDivisionClubs.push({
  id: "stale-foreign-1", name: "Foreign Club", leagueId: "foreign-league",
  country: "Elsewhere", division: 1, leagueName: "Foreign Premier", matchesPerSeason: 30, roster: []
});
const staleDivisionWorld = {
  players: {
    "stale-promoted-player": { id: "stale-promoted-player", clubId: "stale-second-1", division: 2 },
    "stale-relegated-player": { id: "stale-relegated-player", clubId: "stale-first-6", division: 1 }
  },
  clubs: Object.fromEntries(staleDivisionClubs.map(club => [club.id, club])),
  leagueTables: {
    "5": {
      "stale-league": [
        ...Array.from({ length: 5 }, (_, index) => ({ clubId: "stale-first-" + (index + 1), leagueId: "stale-league", division: 1 })),
        { clubId: "stale-second-3", leagueId: "stale-league", division: 2 },
        { clubId: "stale-first-6", leagueId: "stale-league", division: 1 }
      ],
      "stale-league:2": [
        { clubId: "stale-foreign-1", leagueId: "foreign-league", division: 2 },
        { clubId: "stale-first-1", leagueId: "stale-league", division: 1 },
        { clubId: "stale-second-1", leagueId: "stale-league", division: 2 },
        { clubId: "stale-second-1", leagueId: "stale-league", division: 2 },
        { clubId: "stale-second-2", leagueId: "foreign-league", division: 2 },
        { clubId: "stale-second-3", leagueId: "stale-league", division: 2 },
        { clubId: "stale-second-4", leagueId: "stale-league", division: 2 }
      ]
    }
  },
  promotionHistory: [],
  notes: []
};
const staleDivisionDb = {
  leagueFor: (_country, division) => Number(division) >= 2
    ? { name: "Stale Second Division", englishName: "Stale Championship", matchesPerSeason: 22 }
    : { name: "Stale Premier", englishName: "Stale Premier League", matchesPerSeason: 34 }
};
const staleDivisionMoves = sandbox.window.__lwTestApplyPromotionRelegation(staleDivisionWorld, 5, staleDivisionDb);
assert.equal(staleDivisionMoves.length, 1,
  "stale, duplicate and cross-league rows must not inflate promotion or relegation places");
assert.equal(staleDivisionMoves[0].promoted, "Stale Second 1",
  "the highest eligible second-tier club must be promoted after invalid rows are removed");
assert.equal(staleDivisionMoves[0].relegated, "Stale First 6",
  "the lowest eligible first-tier club must be relegated after stale rows are removed");
assert.equal(staleDivisionWorld.clubs["stale-first-1"].division, 1,
  "a first-tier club duplicated into the second-tier table must not be promoted");
assert.equal(staleDivisionWorld.clubs["stale-second-3"].division, 2,
  "a second-tier club duplicated into the first-tier table must not be relegated");
assert.equal(staleDivisionWorld.clubs["stale-second-2"].division, 2,
  "a row with a conflicting league ID must not move a club");
assert.equal(staleDivisionWorld.clubs["stale-foreign-1"].division, 1,
  "a club from another league must never be promoted by this league's table");
assert.equal(staleDivisionWorld.players["stale-promoted-player"].division, 1);
assert.equal(staleDivisionWorld.players["stale-relegated-player"].division, 2);


 
// Imported standings may be shuffled. Promotion and relegation must follow the
// explicit rank column rather than whichever club happens to appear first/last.
const rankedPromotionClubs = [];
for (let index = 1; index <= 6; index++) rankedPromotionClubs.push({
  id: "ranked-first-" + index, name: "Ranked First " + index,
  leagueId: "ranked-league", country: "Testland", division: 1,
  power: index === 6 ? 999 : 1, leagueName: "Ranked Premier",
  leagueEnglish: "Ranked Premier League", matchesPerSeason: 34, roster: []
});
for (let index = 1; index <= 3; index++) rankedPromotionClubs.push({
  id: "ranked-second-" + index, name: "Ranked Second " + index,
  leagueId: "ranked-league", country: "Testland", division: 2,
  power: index === 3 ? 999 : 1, leagueName: "Ranked Second Division",
  leagueEnglish: "Ranked Championship", matchesPerSeason: 22, roster: []
});
const rankedPromotionWorld = {
  players: {},
  clubs: Object.fromEntries(rankedPromotionClubs.map(club => [club.id, club])),
  leagueTables: {
    "6": {
      "ranked-league": [6, 2, 5, 1, 4, 3].map(rank => ({
        clubId: "ranked-first-" + rank, leagueId: "ranked-league",
        division: 1, rank, pts: 30 - rank, gd: 12 - rank, gf: 20 - rank
      })),
      "ranked-league:2": [3, 2, 1].map(rank => ({
        clubId: "ranked-second-" + rank, leagueId: "ranked-league",
        division: 2, rank, pts: 15 - rank, gd: 8 - rank, gf: 12 - rank
      }))
    }
  },
  promotionHistory: [],
  notes: []
};
const rankedPromotionDb = {
  leagueFor: (_country, division) => Number(division) >= 2
    ? { name: "Ranked Second Division", englishName: "Ranked Championship", matchesPerSeason: 22 }
    : { name: "Ranked Premier", englishName: "Ranked Premier League", matchesPerSeason: 34 }
};
// Legacy top-flight clubs without a persisted division must still be ranked and relegated.
const legacyDivisionPromotionWorld = JSON.parse(JSON.stringify(rankedPromotionWorld));
delete legacyDivisionPromotionWorld.clubs["ranked-first-6"].division;
const legacyDivisionPromotionMoves = sandbox.window.__lwTestApplyPromotionRelegation(
  legacyDivisionPromotionWorld, 6, rankedPromotionDb
);
assert.equal(legacyDivisionPromotionMoves.length, 1,
  "a missing legacy club division must use the same first-tier default as the season table");
assert.equal(legacyDivisionPromotionMoves[0].relegated, "Ranked First 6",
  "a legacy first-tier club must remain eligible for relegation by its explicit final rank");
assert.equal(legacyDivisionPromotionWorld.clubs["ranked-first-6"].division, 2,
  "a legacy club relegated from the first tier must receive the destination division");
const rankedPromotionBaseline = JSON.parse(JSON.stringify(rankedPromotionWorld));

// Corrupted identifiers must be isolated to their own saved rows and never abort
// a valid promotion/relegation batch or its player-division synchronization.
const hostilePromotionIdentifier = {
  toString() { throw new Error("hostile saved identifier coercion"); }
};
const hostileIdentifierPromotionWorld = JSON.parse(JSON.stringify(rankedPromotionBaseline));
hostileIdentifierPromotionWorld.promotionHistory = [];
hostileIdentifierPromotionWorld.notes = [];
for (let index = 1; index <= 6; index++) hostileIdentifierPromotionWorld.clubs["ranked-first-" + index].division = 1;
for (let index = 1; index <= 3; index++) hostileIdentifierPromotionWorld.clubs["ranked-second-" + index].division = 2;
const hostileIdentifierTables = hostileIdentifierPromotionWorld.leagueTables["6"];
const hostileFirstRows = hostileIdentifierTables["ranked-league"];
const hostileFirstOne = hostileFirstRows.find(row => row.clubId === "ranked-first-1");
const hostileFirstTwo = hostileFirstRows.find(row => row.clubId === "ranked-first-2");
hostileFirstOne.leagueId = hostilePromotionIdentifier;
hostileFirstTwo.division = hostilePromotionIdentifier;
for (let index = 7; index <= 8; index++) {
  const id = "hostile-extra-first-" + index;
  hostileIdentifierPromotionWorld.clubs[id] = {
    id, name: "Hostile Extra " + index, leagueId: "ranked-league",
    country: "Testland", division: 1, power: 50, roster: []
  };
  hostileFirstRows.push({
    clubId: id, leagueId: "ranked-league", division: 1,
    rank: index, pts: 30 - index, gd: 12 - index, gf: 20 - index
  });
}
hostileIdentifierPromotionWorld.clubs["hostile-league-id-club"] = {
  id: "hostile-league-id-club", name: "Hostile League ID", leagueId: hostilePromotionIdentifier,
  country: "Testland", division: 1, power: 50, roster: []
};
hostileIdentifierPromotionWorld.clubs["hostile-club-id"] = {
  id: hostilePromotionIdentifier, name: "Hostile Club ID", leagueId: "ranked-league",
  country: "Testland", division: 1, power: 50, roster: []
};
hostileFirstRows.push(
  { clubId: hostilePromotionIdentifier, leagueId: "ranked-league", division: 1 },
  { clubId: "hostile-club-id", leagueId: "ranked-league", division: 1, rank: 9 }
);
hostileIdentifierTables["ranked-league:2"].push(
  { clubId: "ranked-second-1", leagueId: hostilePromotionIdentifier, division: 2 },
  { clubId: "ranked-second-2", leagueId: "ranked-league", division: hostilePromotionIdentifier }
);
hostileIdentifierPromotionWorld.players["safe-promoted-player"] = {
  id: "safe-promoted-player", clubId: "ranked-second-1", division: 2
};
hostileIdentifierPromotionWorld.players["hostile-player-club-id"] = {
  id: "hostile-player-club-id", clubId: hostilePromotionIdentifier, division: 1
};
let hostileIdentifierMoves;
assert.doesNotThrow(() => {
  hostileIdentifierMoves = sandbox.window.__lwTestApplyPromotionRelegation(
    hostileIdentifierPromotionWorld, 6, rankedPromotionDb
  );
}, "hostile club, league, and standings identifiers must not throw during promotion/relegation");
assert.equal(hostileIdentifierMoves.length, 1,
  "malformed identifiers must not prevent otherwise valid clubs from completing promotion/relegation");
assert.equal(hostileIdentifierPromotionWorld.clubs["ranked-second-1"].division, 1,
  "a valid promoted club must still move when unrelated malformed identifiers are present");
assert.equal(hostileIdentifierPromotionWorld.players["safe-promoted-player"].division, 1,
  "player division synchronization must use the validated standings club ID");
assert.equal(hostileIdentifierPromotionWorld.players["hostile-player-club-id"].division, 1,
  "a player with a malformed club identifier must be ignored without breaking the batch");

// A null history row must not throw, and an array-wrapped season must not block
// a valid promotion batch by coercing to the same numeric destination season.
const malformedPromotionHistoryWorld = JSON.parse(JSON.stringify(rankedPromotionBaseline));
malformedPromotionHistoryWorld.promotionHistory = [null, { season: [7], moves: [] }];
let malformedPromotionHistoryMoves;
assert.doesNotThrow(() => {
  malformedPromotionHistoryMoves = sandbox.window.__lwTestApplyPromotionRelegation(
    malformedPromotionHistoryWorld, 6, rankedPromotionDb
  );
}, "malformed promotion history rows must not abort promotion/relegation");
assert.equal(malformedPromotionHistoryMoves.length, 1,
  "an array-wrapped promotion season must not suppress the real destination-season move");
assert.equal(malformedPromotionHistoryWorld.promotionHistory[0].season, 7);
assert.equal(malformedPromotionHistoryWorld.promotionHistory[1], null,
  "malformed legacy history rows must be preserved rather than silently deleted");
assert.deepEqual(malformedPromotionHistoryWorld.promotionHistory[2].season, [7]);

const numericStringPromotionHistoryWorld = JSON.parse(JSON.stringify(rankedPromotionBaseline));
numericStringPromotionHistoryWorld.promotionHistory = [{ season: "7", moves: [] }];
assert.equal(sandbox.window.__lwTestApplyPromotionRelegation(
  numericStringPromotionHistoryWorld, 6, rankedPromotionDb
).length, 0, "numeric-string promotion markers must retain idempotent legacy behavior");

const rankedPromotionMoves = sandbox.window.__lwTestApplyPromotionRelegation(
  rankedPromotionWorld, 6, rankedPromotionDb
);
assert.equal(rankedPromotionMoves.length, 1, "ranked legacy tables must still produce one valid promotion/relegation move");
assert.equal(rankedPromotionMoves[0].promoted, "Ranked Second 1",
  "promotion must use the best explicit second-tier rank, not the first array item");
assert.equal(rankedPromotionMoves[0].relegated, "Ranked First 6",
  "relegation must use the worst explicit first-tier rank, not the last array item");
assert.equal(rankedPromotionWorld.clubs["ranked-second-1"].division, 1);
assert.equal(rankedPromotionWorld.clubs["ranked-first-6"].division, 2);


// Duplicate rows for the same club must be ranked before club-ID deduplication.
// The first imported row is stale/worse; the later row has the better explicit rank.
const duplicateStandingsWorld = JSON.parse(JSON.stringify(rankedPromotionBaseline));
const duplicateStandingsTables = duplicateStandingsWorld.leagueTables["6"];
duplicateStandingsTables["ranked-league"].unshift({
  clubId: "ranked-first-1", leagueId: "ranked-league", division: 1,
  rank: 6, pts: 0, gd: -99, gf: 0
});
duplicateStandingsTables["ranked-league:2"].unshift({
  clubId: "ranked-second-1", leagueId: "ranked-league", division: 2,
  rank: 3, pts: 0, gd: -99, gf: 0
});
const duplicateStandingsMoves = sandbox.window.__lwTestApplyPromotionRelegation(
  duplicateStandingsWorld, 6, rankedPromotionDb
);
assert.equal(duplicateStandingsMoves.length, 1,
  "duplicate rows for the same clubs must not inflate promotion or relegation places");
assert.equal(duplicateStandingsMoves[0].promoted, "Ranked Second 1",
  "promotion must retain the best-ranked row for a club even when a stale duplicate appears first");
assert.equal(duplicateStandingsMoves[0].relegated, "Ranked First 6",
  "relegation must retain the worst club's best valid rank rather than an earlier duplicate row");
assert.equal(duplicateStandingsWorld.clubs["ranked-second-1"].division, 1);
assert.equal(duplicateStandingsWorld.clubs["ranked-first-6"].division, 2);

// Malformed legacy standings values must never become valid ranks or points through
// JavaScript coercion. Numeric strings remain supported for older persisted tables.
const malformedStandingWorld = JSON.parse(JSON.stringify(rankedPromotionBaseline));
const malformedStandingTables = malformedStandingWorld.leagueTables["6"];
["ranked-league", "ranked-league:2"].forEach(tableKey => {
  malformedStandingTables[tableKey].forEach(row => delete row.rank);
});
const malformedSecondThree = malformedStandingTables["ranked-league:2"]
  .find(row => row.clubId === "ranked-second-3");
malformedSecondThree.rank = [1];
malformedSecondThree.pts = [9999];
malformedSecondThree.gd = Object(9999);
malformedSecondThree.gf = [9999];
malformedSecondThree.ga = [0];
malformedStandingTables["ranked-league:2"]
  .find(row => row.clubId === "ranked-second-1").pts = "14";
const malformedStandingMoves = sandbox.window.__lwTestApplyPromotionRelegation(
  malformedStandingWorld, 6, rankedPromotionDb
);
assert.equal(malformedStandingMoves.length, 1);
assert.equal(malformedStandingMoves[0].promoted, "Ranked Second 1",
  "array ranks and boxed/array metrics must not promote a club over valid standings");
assert.equal(malformedStandingMoves[0].relegated, "Ranked First 6");

// Symbol and coercion-hostile objects in imported standings must be rejected without
// throwing or aborting the season transition.
const hostileStandingWorld = JSON.parse(JSON.stringify(rankedPromotionBaseline));
const hostileStandingTables = hostileStandingWorld.leagueTables["6"];
["ranked-league", "ranked-league:2"].forEach(tableKey => {
  hostileStandingTables[tableKey].forEach(row => delete row.rank);
});
hostileStandingTables["ranked-league:2"].forEach(row => {
  row.pts = Symbol("invalid-points");
});
const hostileMetricRow = hostileStandingTables["ranked-league:2"]
  .find(row => row.clubId === "ranked-second-3");
hostileMetricRow.gd = { valueOf() { throw new Error("unsafe goal-difference coercion"); } };
hostileMetricRow.gf = Symbol("invalid-goals-for");
hostileMetricRow.ga = { toString() { throw new Error("unsafe goals-against coercion"); } };
let hostileStandingMoves;
assert.doesNotThrow(() => {
  hostileStandingMoves = sandbox.window.__lwTestApplyPromotionRelegation(
    hostileStandingWorld, 6, rankedPromotionDb
  );
}, "malformed Symbol and hostile-object standings must not crash promotion processing");
assert.equal(hostileStandingMoves.length, 1);
assert.equal(hostileStandingMoves[0].promoted, "Ranked Second 1");

// A club with a coerced tier is not a valid second-division participant.
const malformedClubDivisionWorld = JSON.parse(JSON.stringify(rankedPromotionBaseline));
malformedClubDivisionWorld.clubs["ranked-second-1"].division = [2];
const malformedClubDivisionMoves = sandbox.window.__lwTestApplyPromotionRelegation(
  malformedClubDivisionWorld, 6, rankedPromotionDb
);
assert.equal(malformedClubDivisionMoves.length, 0,
  "an array-valued club division must not qualify as a second-tier club");
assert.equal(malformedClubDivisionWorld.clubs["ranked-second-1"].division.length, 1,
  "invalid saved division data must remain untouched rather than being silently rewritten");

// Explicit malformed first-tier club divisions must not be treated like missing legacy data.
// Otherwise [1], zero, negative, fractional, or hostile values can incorrectly enter the
// relegation pool and change the season outcome.
const invalidFirstTierDivisionCases = [
  [1],
  0,
  -1,
  1.5,
  "not-a-division",
  Symbol("invalid-division"),
  { valueOf() { throw new Error("unsafe club division coercion"); } }
];
for (const invalidDivision of invalidFirstTierDivisionCases) {
  const invalidFirstTierWorld = JSON.parse(JSON.stringify(rankedPromotionBaseline));
  const invalidFirstTierClub = invalidFirstTierWorld.clubs["ranked-first-6"];
  invalidFirstTierClub.division = invalidDivision;
  let invalidFirstTierMoves;
  assert.doesNotThrow(() => {
    invalidFirstTierMoves = sandbox.window.__lwTestApplyPromotionRelegation(
      invalidFirstTierWorld, 6, rankedPromotionDb
    );
  }, "malformed explicit first-tier divisions must not crash promotion processing");
  assert.equal(invalidFirstTierMoves.length, 0,
    "a malformed explicit first-tier club must not be silently accepted as a valid top-flight club");
  assert.strictEqual(invalidFirstTierClub.division, invalidDivision,
    "malformed saved club divisions must remain unchanged");
}

const numericStringClubDivisionWorld = JSON.parse(JSON.stringify(rankedPromotionBaseline));
numericStringClubDivisionWorld.clubs["ranked-first-6"].division = "1";
const numericStringClubDivisionMoves = sandbox.window.__lwTestApplyPromotionRelegation(
  numericStringClubDivisionWorld, 6, rankedPromotionDb
);
assert.equal(numericStringClubDivisionMoves.length, 1,
  "numeric-string club divisions must retain legacy compatibility");
assert.equal(numericStringClubDivisionMoves[0].relegated, "Ranked First 6");
assert.equal(ai.divisionForClub({}), 1,
  "clubs with genuinely absent legacy divisions must remain first-tier compatible");
assert.equal(ai.divisionForClub({ division: null }), 1,
  "null legacy divisions must retain first-tier compatibility");
assert.equal(ai.divisionForClub({ division: " " }), 1,
  "blank legacy divisions must retain first-tier compatibility");
assert.equal(ai.divisionForClub({ division: "2" }), 2,
  "numeric-string divisions must remain compatible");
const strictInvalidDivisionValues = [
  [1], 0, -1, 1.5, "not-a-division", Symbol("invalid-division"),
  { valueOf() { throw new Error("unsafe division coercion"); } }
];
strictInvalidDivisionValues.forEach(value => {
  assert.equal(sandbox.window.__lwTestNormalizeClubDivision(value, 1), 0,
    "explicit malformed club divisions must be rejected without coercion");
});
assert.equal(ai.divisionForClub(null), 0,
  "a missing club object must not be treated as a real first-tier club");

// The same strict tier rule must apply to schedules, league tables, projections and cups,
// not only at the final promotion/relegation step.
const strictDivisionWorld = { clubs: {}, players: {} };
const strictFirstTierIds = [], strictSecondTierIds = [];
const addStrictDivisionClub = (id, division, includeDivision = true) => {
  const club = {
    id, name: id, country: "Testland", leagueId: "strict-division-league",
    power: 60, basePower: 60, prestige: 50, matchesPerSeason: 10, roster: []
  };
  if (includeDivision) club.division = division;
  strictDivisionWorld.clubs[id] = club;
  return club;
};
for (let index = 1; index <= 6; index++) {
  const id = "strict-first-" + index;
  addStrictDivisionClub(id, 1);
  strictFirstTierIds.push(id);
}
for (let index = 1; index <= 3; index++) {
  const id = "strict-second-" + index;
  addStrictDivisionClub(id, 2);
  strictSecondTierIds.push(id);
}
for (const [id, division, includeDivision] of [
  ["strict-legacy-missing", undefined, false],
  ["strict-legacy-null", null, true],
  ["strict-legacy-blank", " ", true],
  ["strict-numeric-string-first", "1", true]
]) {
  addStrictDivisionClub(id, division, includeDivision);
  strictFirstTierIds.push(id);
}
addStrictDivisionClub("strict-numeric-string-second", "2", true);
strictSecondTierIds.push("strict-numeric-string-second");
strictInvalidDivisionValues.forEach((division, index) => {
  addStrictDivisionClub("strict-invalid-first-" + index, division, true);
  addStrictDivisionClub("strict-invalid-second-" + index, Array.isArray(division) ? [2] : division, true);
});
const strictDivisionDb = {
  leagueFor: () => ({ teamCount: 0, matchesPerSeason: 10 })
};
const strictDivisionTables = sandbox.window.__lwTestSimulateLeagueTables(
  strictDivisionWorld, 8, 1, strictDivisionDb
);
assert.deepEqual(Array.from(strictDivisionTables["strict-division-league"] || [], row => row.clubId).sort(),
  strictFirstTierIds.slice().sort(),
  "league simulation must exclude explicit malformed first-tier clubs while retaining legacy missing and numeric-string divisions");
assert.deepEqual(Array.from(strictDivisionTables["strict-division-league:2"] || [], row => row.clubId).sort(),
  strictSecondTierIds.slice().sort(),
  "league simulation must exclude explicit malformed second-tier clubs");
const strictDivisionGroups = sandbox.window.__lwTestGroupRows(strictDivisionWorld);
assert.deepEqual(Array.from(strictDivisionGroups.get("strict-division-league:1") || [], club => club.id).sort(),
  strictFirstTierIds.slice().sort(),
  "world match grouping must use the same strict first-tier eligibility");
assert.deepEqual(Array.from(strictDivisionGroups.get("strict-division-league:2") || [], club => club.id).sort(),
  strictSecondTierIds.slice().sort(),
  "world match grouping must use the same strict second-tier eligibility");


// Malformed world identifiers must not collapse valid clubs into duplicate map keys
// or abort league schedules, match-count indexing, strength calculations, or state validation.
const hostileWorldIdentifier = {
  toString() { throw new Error("hostile world identifier coercion"); }
};
assert.equal(sandbox.window.__lwTestSafeWorldIdentifier(hostileWorldIdentifier), "",
  "object identifiers must be rejected without invoking toString");
assert.equal(sandbox.window.__lwTestSafeWorldIdentifier(42), "42",
  "finite numeric identifiers remain compatible");
const safeWorldIdentifierFixture = { clubs: {} };
const makeSafeWorldIdClub = (id, name) => ({
  id, name, country: "Testland", leagueId: "safe-world-id-league",
  division: 1, power: 60, basePower: 60, prestige: 50,
  matchesPerSeason: 10, roster: []
});
safeWorldIdentifierFixture.clubs["alias-before-canonical"] =
  makeSafeWorldIdClub("safe-world-id-1", "Stale Alias Club 1");
safeWorldIdentifierFixture.clubs["safe-world-id-1"] =
  makeSafeWorldIdClub("safe-world-id-1", "Canonical Club 1");
for (let index = 2; index <= 6; index++) {
  const id = "safe-world-id-" + index;
  safeWorldIdentifierFixture.clubs[id] = makeSafeWorldIdClub(id, "Canonical Club " + index);
}
safeWorldIdentifierFixture.clubs["legacy-key-club"] = {
  name: "Legacy Key Club", country: "Testland", leagueId: "safe-world-id-league",
  division: 1, power: 60, basePower: 60, prestige: 50, matchesPerSeason: 10, roster: []
};
safeWorldIdentifierFixture.clubs["hostile-world-club-id"] = {
  id: hostileWorldIdentifier, name: "Hostile Club ID", country: "Testland",
  leagueId: "safe-world-id-league", division: 1, matchesPerSeason: 10, roster: []
};
safeWorldIdentifierFixture.clubs["hostile-world-league-id"] = {
  id: "hostile-world-league-id", name: "Hostile League ID", country: "Testland",
  leagueId: hostileWorldIdentifier, division: 1, matchesPerSeason: 10, roster: []
};
const safeWorldIdDb = { leagueFor: () => ({ teamCount: 0 }) };
const safeWorldIdMatchLookup = sandbox.window.__lwTestBuildLeagueMatchCountLookup(
  safeWorldIdentifierFixture, safeWorldIdDb
);
assert.equal(safeWorldIdMatchLookup.size, 7,
  "match-count lookup must index only unique clubs with safe IDs and league IDs");
assert.ok(safeWorldIdMatchLookup.has("legacy-key-club"),
  "a genuinely missing legacy club.id may safely fall back to its dictionary key");
assert.ok(!safeWorldIdMatchLookup.has("hostile-world-club-id")
  && !safeWorldIdMatchLookup.has("hostile-world-league-id"),
  "malformed club and league identifiers must not enter match-count indexes");
const safeWorldIdTables = sandbox.window.__lwTestSimulateLeagueTables(
  safeWorldIdentifierFixture, 9, 1, safeWorldIdDb, safeWorldIdMatchLookup
);
const safeWorldIdRows = safeWorldIdTables["safe-world-id-league"] || [];
assert.equal(safeWorldIdRows.length, 7,
  "league simulation must retain valid clubs while excluding malformed identifiers");
assert.equal(safeWorldIdRows.filter(row => row.clubId === "safe-world-id-1").length, 1,
  "duplicate dictionary aliases must not create duplicate standings rows");
assert.equal(safeWorldIdRows.find(row => row.clubId === "safe-world-id-1").club, "Canonical Club 1",
  "the canonical dictionary key must win over a stale alias");
assert.ok(safeWorldIdRows.every(row => row.played === 10),
  "all valid clubs must receive the same configured match count");
assert.equal(sandbox.window.__lwTestLeagueStrength(
  safeWorldIdentifierFixture, "safe-world-id-league", 1, new Map()
), 60, "league strength must average only clubs with valid identifiers");
assert.equal((sandbox.window.__lwTestGroupRows(safeWorldIdentifierFixture)
  .get("safe-world-id-league:1") || []).length, 7,
  "world match grouping must use the same safe club/league identifier index");

const hostileEnsureStateIdentifier = {
  toString() { throw new Error("hostile saved league identifier coercion"); }
};
const hostileEnsureStateWorld = {
  schemaVersion: 1, dbVersion: 1, currentSeason: 5, lastAdvancedTo: 0,
  lastCompletedSeason: 4, rosterSchemaVersion: 3, rosterMembershipSchemaVersion: 6,
  clubs: {
    "ensure-safe-club": {
      id: "ensure-safe-club", name: "Ensure Safe Club", leagueId: "ensure-safe-league",
      division: 1, roster: []
    },
    "ensure-hostile-league-club": {
      id: "ensure-hostile-league-club", name: "Ensure Hostile League Club",
      leagueId: hostileEnsureStateIdentifier, division: 1, roster: []
    }
  },
  players: {}, completedSeasons: [], seasonStats: {}, leagueTables: {},
  transfers: [], marketReports: [], playerHistory: {}, notes: [],
  nextGeneratedPlayer: 1, transferSequence: 0, projectionRevision: 0
};
const hostileEnsureStateSave = { season: 5, worldSimulation: hostileEnsureStateWorld };
const hostileEnsureStateDb = {
  version: 1,
  leagues: () => [{ id: "ensure-safe-league" }, { id: hostileEnsureStateIdentifier }]
};
assert.doesNotThrow(() => sandbox.window.__lwTestEnsureState(
  hostileEnsureStateSave, hostileEnsureStateDb
), "ensureState must ignore malformed catalogue and saved league IDs without coercion");
assert.strictEqual(hostileEnsureStateWorld.clubs["ensure-hostile-league-club"].leagueId,
  hostileEnsureStateIdentifier,
  "safe state validation must preserve malformed source values rather than rewriting saved club data");

const invalidDivisionMembershipWorld = {
  clubs: {
    "invalid-division-owner": {
      id: "invalid-division-owner", name: "Invalid Division Owner", country: "Testland",
      leagueId: "strict-division-league", division: [1], roster: ["invalid-division-player"]
    }
  },
  players: {
    "invalid-division-player": {
      id: "invalid-division-player", clubId: "invalid-division-owner",
      leagueId: "strict-division-league", division: 2, retired: false, freeAgent: false
    }
  }
};
sandbox.window.__lwTestNormalizeRosterMembership(invalidDivisionMembershipWorld);
assert.equal(invalidDivisionMembershipWorld.players["invalid-division-player"].division, 2,
  "roster normalization must preserve the player's last valid division when the owning club tier is corrupt");

const invalidDivisionProjectionWorld = {
  projectionRevision: 0, dbVersion: 1, rosterSchemaVersion: 1,
  currentSeason: 4, lastAdvancedTo: 0, lastCompletedSeason: 0, transferSequence: 0,
  clubs: {
    "valid-projection-club": {
      id: "valid-projection-club", name: "Valid Projection Club", country: "Testland",
      leagueId: "strict-projection-league", division: 1, power: 60, basePower: 60,
      matchesPerSeason: 10, roster: ["valid-projection-player"]
    },
    "invalid-projection-club": {
      id: "invalid-projection-club", name: "Invalid Projection Club", country: "Testland",
      leagueId: "strict-projection-league", division: [1], power: 60, basePower: 60,
      matchesPerSeason: 10, roster: ["invalid-projection-player"]
    }
  },
  players: {
    "valid-projection-player": {
      id: "valid-projection-player", name: "Valid Projection Player", clubId: "valid-projection-club",
      leagueId: "strict-projection-league", division: 1, country: "Testland",
      position: "مهاجم", group: "attacker", age: 24, ovr: 70, potential: 80,
      contractSeasons: 2, retired: false, freeAgent: false, isGenerated: false
    },
    "invalid-projection-player": {
      id: "invalid-projection-player", name: "Invalid Projection Player", clubId: "invalid-projection-club",
      leagueId: "strict-projection-league", division: 1, country: "Testland",
      position: "مهاجم", group: "attacker", age: 24, ovr: 70, potential: 80,
      contractSeasons: 2, retired: false, freeAgent: false, isGenerated: false
    }
  }
};
const strictProjectionRows = sandbox.window.__lwTestGetProjectedSeasonRows(
  invalidDivisionProjectionWorld, 4, strictDivisionDb
);
assert.deepEqual(Array.from(strictProjectionRows, row => row.id), ["valid-projection-player"],
  "projected season statistics must not assign an invalid-tier club to a valid league division");

const invalidDivisionStatsWorld = {
  clubs: {
    "invalid-stats-club": {
      id: "invalid-stats-club", name: "Invalid Stats Club", country: "Testland",
      leagueId: "strict-stats-league", division: [1], power: 60, prestige: 50
    }
  },
  players: {
    "invalid-stats-player": {
      id: "invalid-stats-player", name: "Invalid Stats Player", clubId: "invalid-stats-club",
      leagueId: "strict-stats-league", division: 1, country: "Testland",
      position: "مهاجم", group: "attacker", age: 24, ovr: 70, potential: 80, isGenerated: false
    }
  }
};
const invalidDivisionStatsRows = sandbox.window.__lwTestBuildPlayerRows(
  invalidDivisionStatsWorld, 4, new Map()
);
assert.equal(invalidDivisionStatsRows.length, 1);
assert.equal(invalidDivisionStatsRows[0].division, 0,
  "actual season rows for a corrupt-tier club must not be mislabeled as first division");
assert.equal(invalidDivisionStatsRows[0].leagueStrength, 55,
  "invalid-tier players must not borrow the first-division strength average");


// A malformed persisted row division must also be excluded from its table.
const malformedRowDivisionWorld = JSON.parse(JSON.stringify(rankedPromotionBaseline));
malformedRowDivisionWorld.leagueTables["6"]["ranked-league:2"]
  .find(row => row.clubId === "ranked-second-1").division = [2];
const malformedRowDivisionMoves = sandbox.window.__lwTestApplyPromotionRelegation(
  malformedRowDivisionWorld, 6, rankedPromotionDb
);
assert.equal(malformedRowDivisionMoves.length, 0,
  "an array-valued table division must not be accepted as a numeric tier");

// A metadata failure midway through a promotion batch must roll back every club and player tier.
const atomicPromotionClubs = [];
for (let index = 1; index <= 6; index++) atomicPromotionClubs.push({
  id: "atomic-first-" + index, name: "Atomic First " + index, leagueId: "atomic-league",
  country: "Testland", division: 1, leagueName: "Atomic Premier", leagueEnglish: "Atomic Premier League",
  matchesPerSeason: 34, roster: []
});
for (let index = 1; index <= 3; index++) atomicPromotionClubs.push({
  id: "atomic-second-" + index, name: "Atomic Second " + index, leagueId: "atomic-league",
  country: "Testland", division: 2, leagueName: "Atomic Second Division", leagueEnglish: "Atomic Championship",
  matchesPerSeason: 22, roster: []
});
const atomicPromotionWorld = {
  players: {
    "atomic-promoted-player": { id: "atomic-promoted-player", clubId: "atomic-second-1", division: 2 },
    "atomic-relegated-player": { id: "atomic-relegated-player", clubId: "atomic-first-6", division: 1 }
  },
  clubs: Object.fromEntries(atomicPromotionClubs.map(club => [club.id, club])),
  leagueTables: {
    "8": {
      "atomic-league": Array.from({ length: 6 }, (_, index) => ({
        clubId: "atomic-first-" + (index + 1), leagueId: "atomic-league", division: 1
      })),
      "atomic-league:2": Array.from({ length: 3 }, (_, index) => ({
        clubId: "atomic-second-" + (index + 1), leagueId: "atomic-league", division: 2
      }))
    }
  },
  promotionHistory: [],
  notes: []
};
const atomicPromotionBefore = JSON.stringify(atomicPromotionWorld);
let atomicPromotionLookups = 0;
const failingPromotionDb = {
  leagueFor: (_country, division) => {
    atomicPromotionLookups++;
    if (atomicPromotionLookups === 2) throw new Error("forced promotion metadata failure");
    return Number(division) >= 2
      ? { name: "Atomic Second Division", englishName: "Atomic Championship", matchesPerSeason: 22 }
      : { name: "Atomic Premier", englishName: "Atomic Premier League", matchesPerSeason: 34 };
  }
};
assert.throws(() => sandbox.window.__lwTestApplyPromotionRelegation(atomicPromotionWorld, 8, failingPromotionDb),
  /forced promotion metadata failure/,
  "a failed division metadata lookup must abort the complete promotion batch");
assert.equal(JSON.stringify(atomicPromotionWorld), atomicPromotionBefore,
  "failed promotion/relegation must restore club metadata, attached player divisions, history and notes");


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
assert.equal(ai.groupForPosition("GK"), "goalkeeper");
assert.equal(ai.groupForPosition("CB"), "defender");
assert.equal(ai.groupForPosition("CDM"), "midfielder");
assert.equal(ai.groupForPosition("ST"), "attacker");
assert.equal(ai.groupForPosition("RW"), "attacker");
const matchProfileSave = { season: 1, worldSimulation: JSON.parse(JSON.stringify(world)) };
const matchProfileWorld = matchProfileSave.worldSimulation;
const matchProfileClub = Object.values(matchProfileWorld.clubs).find(club =>
  Array.isArray(club.roster) && club.roster
    .map(id => matchProfileWorld.players[id])
    .filter(player => player && (String(player.position || "").trim()
      ? ai.groupForPosition(player.position) === "goalkeeper" : player.group === "goalkeeper"))
    .length >= 2);
assert.ok(matchProfileClub, "keeper-depth fixture requires two goalkeepers");
const matchProfileKeepers = matchProfileClub.roster
  .map(id => matchProfileWorld.players[id])
  .filter(player => player && (String(player.position || "").trim()
      ? ai.groupForPosition(player.position) === "goalkeeper" : player.group === "goalkeeper"))
  .sort((a, b) => Number(b.ovr || 0) - Number(a.ovr || 0));
const misclassifiedFieldPlayer = matchProfileClub.roster
  .map(id => matchProfileWorld.players[id])
  .find(player => player && ai.groupForPosition(player.position) !== "goalkeeper");
assert.ok(misclassifiedFieldPlayer, "keeper-depth fixture requires at least one outfield player");
misclassifiedFieldPlayer.group = "goalkeeper";
misclassifiedFieldPlayer.position = "مهاجم";
misclassifiedFieldPlayer.goalkeeping = 99;
matchProfileKeepers[0].group = "midfielder";
matchProfileKeepers[0].position = "حارس مرمى";
matchProfileKeepers[0].goalkeeping = 94;
matchProfileKeepers[1].group = "goalkeeper";
matchProfileKeepers[1].position = "حارس مرمى";
matchProfileKeepers[1].goalkeeping = 70;
assert.equal(typeof ai.getClubMatchProfile, "function");
const matchProfile = ai.getClubMatchProfile(matchProfileSave, matchProfileClub.name, matchProfileClub.country, db);
assert.equal(matchProfile.power, Number(matchProfileClub.power) || Number(matchProfileClub.basePower) || null);
assert.equal(matchProfile.goalkeeping, 91);

const malformedMatchProfileSave = {
  ...matchProfileSave,
  worldSimulation: JSON.parse(JSON.stringify(matchProfileSave.worldSimulation))
};
const malformedMatchProfileClub = Object.values(malformedMatchProfileSave.worldSimulation.clubs)
  .find(club => club && club.id === matchProfileClub.id);
const malformedMatchProfileKeepers = malformedMatchProfileClub.roster
  .map(id => malformedMatchProfileSave.worldSimulation.players[id])
  .filter(player => player && (player.group === "goalkeeper" || /حارس/.test(String(player.position || ""))));
malformedMatchProfileClub.power = hostileSavedNumber;
malformedMatchProfileClub.basePower = 64;
assert.ok(malformedMatchProfileKeepers.length > 0, "the malformed profile fixture must contain goalkeepers");
malformedMatchProfileKeepers.forEach(player => {
  player.goalkeeping = hostileSavedNumber;
  player.ovr = [99, 100];
});
const safeMalformedMatchProfile = ai.getClubMatchProfile(
  malformedMatchProfileSave, malformedMatchProfileClub.name, malformedMatchProfileClub.country, db
);
assert.equal(safeMalformedMatchProfile.power, 64,
  "club match profile must fall back to safe base power instead of coercing a hostile saved object");
assert.equal(safeMalformedMatchProfile.goalkeeping, 55,
  "goalkeeper profile must ignore malformed object/array ratings without inflating keeper skill");
assert.equal(ai.getClubPower(
  malformedMatchProfileSave, malformedMatchProfileClub.name, malformedMatchProfileClub.country, db
), 64, "club power lookup must use the safe base-power fallback");

const negativeClubPowerSave = {
  ...matchProfileSave,
  worldSimulation: JSON.parse(JSON.stringify(matchProfileSave.worldSimulation))
};
const negativeClubPower = Object.values(negativeClubPowerSave.worldSimulation.clubs)
  .find(club => club && club.id === matchProfileClub.id);
negativeClubPower.power = -12;
negativeClubPower.basePower = 64;
assert.equal(ai.getClubPower(
  negativeClubPowerSave, negativeClubPower.name, negativeClubPower.country, db
), 64, "negative saved club power must not mask a valid positive basePower");
assert.equal(ai.getClubMatchProfile(
  negativeClubPowerSave, negativeClubPower.name, negativeClubPower.country, db
).power, 64, "match profiles must use basePower when saved club power is non-positive");
assert.equal(negativeClubPower.power, -12,
  "reading a malformed club power must not rewrite the original saved value");

let malformedRecruitmentRows;
assert.doesNotThrow(() => {
  malformedRecruitmentRows = ai.recruitmentNeeds(malformedMatchProfileSave, db);
}, "recruitment analysis must tolerate malformed saved player and club ratings");
const malformedRecruitmentClub = malformedRecruitmentRows.find(row =>
  row.clubId === malformedMatchProfileClub.id);
assert.equal(malformedRecruitmentClub.power, 64,
  "recruitment diagnostics must expose the safe basePower instead of a malformed object");
let malformedTransferTargets;
assert.doesNotThrow(() => {
  malformedTransferTargets = ai.transferTargets(malformedMatchProfileSave, db);
}, "transfer-target sorting must tolerate malformed club power values");
assert.equal(malformedTransferTargets.find(row => row.club === malformedMatchProfileClub.name).power, 64,
  "transfer targets must expose and sort by the valid basePower fallback");

const identityCollisionSave = {
  ...matchProfileSave,
  worldSimulation: JSON.parse(JSON.stringify(matchProfileSave.worldSimulation))
};
const identityCollisionWorld = identityCollisionSave.worldSimulation;
const identityCollisionName = "Shared Match Profile FC";
function addIdentityCollisionClub(id, country, power, keeperRating) {
  const keeperId = id + "-keeper";
  identityCollisionWorld.players[keeperId] = {
    id: keeperId, name: "Keeper " + country, clubId: id,
    position: "حارس مرمى", group: "goalkeeper", ovr: keeperRating,
    goalkeeping: keeperRating, freeAgent: false, retired: false
  };
  identityCollisionWorld.clubs[ai.clubKey(identityCollisionName, country)] = {
    id, name: identityCollisionName, country, power, basePower: power, roster: [keeperId]
  };
}
addIdentityCollisionClub("identity-england", "England", 82, 90);
addIdentityCollisionClub("identity-scotland", "Scotland", 44, 55);
const englandIdentityProfile = ai.getClubMatchProfile(identityCollisionSave, identityCollisionName, "England", db);
assert.equal(englandIdentityProfile.power, 82,
  "an exact club-and-country match must use that club's strength");
assert.equal(englandIdentityProfile.goalkeeping, 90,
  "an exact club-and-country match must use that club's goalkeeper depth");
assert.equal(ai.getClubPower(identityCollisionSave, identityCollisionName, "England", db), 82);
assert.equal(ai.getClubMatchProfile(identityCollisionSave, identityCollisionName, "Wales", db), null,
  "a missing club in the requested country must not borrow a same-name club from another country");
assert.equal(ai.getClubPower(identityCollisionSave, identityCollisionName, "Wales", db), null,
  "club-power fallback must not cross country boundaries");
assert.equal(ai.getClubMatchProfile(identityCollisionSave, identityCollisionName, "", db), null,
  "a country-less lookup must reject ambiguous same-name clubs");
assert.equal(ai.getClubPower(identityCollisionSave, identityCollisionName, "", db), null,
  "legacy country-less club-power lookup must reject ambiguous names");
const uniqueLegacyProfile = ai.getClubMatchProfile(matchProfileSave, matchProfileClub.name, "", db);
assert.equal(uniqueLegacyProfile.power, Number(matchProfileClub.power) || Number(matchProfileClub.basePower) || null,
  "a country-less legacy lookup may still resolve a globally unique club name");
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
// Replacing a generated squad placeholder with a newly sourced player must archive,
// not discard, the outgoing player's record, career history, and season statistics.
const archiveReplaceClubName = "Archive Replacement Club";
const archiveReplaceCountry = "Testland";
const archiveReplaceLeagueId = "archive-replacement-league";
const archiveReplaceClubId = ai.clubKey(archiveReplaceClubName, archiveReplaceCountry);
const archiveReplaceGeneratedIds = Array.from({ length: 16 }, (_, index) =>
  "archive-generated-player-" + String(index + 1));
const archiveReplacePlayers = Object.fromEntries(archiveReplaceGeneratedIds.map((id, index) => [id, {
  id, name: "Archive Academy Placeholder " + (index + 1),
  clubId: archiveReplaceClubId, country: archiveReplaceCountry, leagueId: archiveReplaceLeagueId,
  division: 1, position: index < 2 ? "حارس مرمى" : index < 7 ? "قلب دفاع" : index < 12 ? "وسط مهاجم" : "مهاجم",
  group: index < 2 ? "goalkeeper" : index < 7 ? "defender" : index < 12 ? "midfielder" : "attacker",
  age: 18 + index, ovr: 35 + index, potential: 60 + index,
  isGenerated: true, isRealPlayer: false, contractSeasons: 2, retired: false, freeAgent: false
}]));
const archiveReplacePlayerId = archiveReplaceGeneratedIds[0];
const archiveReplaceHistory = [
  { season: 4, type: "transfer-in", club: archiveReplaceClubName, country: archiveReplaceCountry },
  { season: 5, type: "development", note: "career history must remain available" }
];
const archiveReplaceSeasonRow = {
  id: archiveReplacePlayerId, playerId: archiveReplacePlayerId,
  clubId: archiveReplaceClubId, leagueId: archiveReplaceLeagueId,
  season: 5, appearances: 24, goals: 7, assists: 3
};
const archiveReplaceStablePlayerId = archiveReplaceGeneratedIds[1];
const archiveReplaceStableSeasonRow = {
  id: archiveReplaceStablePlayerId, playerId: archiveReplaceStablePlayerId,
  clubId: archiveReplaceClubId, leagueId: archiveReplaceLeagueId,
  season: 4, appearances: 18, goals: 4, assists: 2
};
const archiveReplaceCurrentSeasonRow = {
  id: archiveReplaceStablePlayerId, playerId: archiveReplaceStablePlayerId,
  clubId: archiveReplaceClubId, leagueId: archiveReplaceLeagueId,
  season: 6, appearances: 10, goals: 2, assists: 1
};
const archiveReplaceTable = season => ({
  [archiveReplaceLeagueId]: [{
    clubId: archiveReplaceClubId, leagueId: archiveReplaceLeagueId,
    division: 1, rank: 1, pts: season === 5 ? 40 : 0
  }]
});
const archiveReplaceMatches = season => [{
  season, competitionId: "league", division: 1, matchday: 1,
  homeClubId: archiveReplaceClubId, awayClubId: "archive-replacement-opponent",
  homeGoals: 1, awayGoals: 0
}];
const archiveReplaceClub = {
  id: archiveReplaceClubId, name: archiveReplaceClubName, country: archiveReplaceCountry,
  leagueId: archiveReplaceLeagueId, division: 1, leagueName: "Archive Test League",
  leagueEnglish: "Archive Test League", matchesPerSeason: 30,
  basePower: 60, power: 60, prestige: 50, roster: archiveReplaceGeneratedIds.slice()
};
const archiveReplaceDb = {
  version: 2,
  leagues: () => [{ id: archiveReplaceLeagueId }],
  leagueFor: () => ({ name: "Archive Test League", englishName: "Archive Test League", matchesPerSeason: 30 }),
  clubs: () => [{
    name: archiveReplaceClubName, country: archiveReplaceCountry,
    leagueId: archiveReplaceLeagueId, division: 1,
    players: [{
      name: "New Officially Sourced Player", position: "مهاجم", age: 23,
      ovr: 68, potential: 79, isRealPlayer: true
    }]
  }]
};
const archiveReplaceWorld = {
  schemaVersion: ai.version, dbVersion: 1, currentSeason: 6, lastCompletedSeason: 5, lastAdvancedTo: 6,
  rosterSchemaVersion: 3, rosterMembershipSchemaVersion: 6,
  players: archiveReplacePlayers, clubs: { [archiveReplaceClubId]: archiveReplaceClub },
  playerHistory: { [archiveReplacePlayerId]: archiveReplaceHistory },
  seasonStats: {
    "4": [archiveReplaceStableSeasonRow],
    "5": [archiveReplaceSeasonRow],
    "6": [archiveReplaceCurrentSeasonRow]
  },
  transfers: [{ id: "archive-replacement-transfer", playerId: archiveReplacePlayerId,
    player: archiveReplacePlayers[archiveReplacePlayerId].name, season: 4 }],
  nextGeneratedPlayer: 41, transferSequence: 1, projectionRevision: 7,
  completedSeasons: [5],
  leagueTables: { "5": archiveReplaceTable(5), "6": archiveReplaceTable(6) },
  matchesBySeason: { "5": archiveReplaceMatches(5), "6": archiveReplaceMatches(6) },
  competitionsBySeason: {
    "5": [{ id: "archive-replacement-completed-cup", season: 5 }],
    "6": [{ id: "archive-replacement-pending-cup", season: 6 }]
  },
  marketReports: [], notes: []
};
// A missing club map in an otherwise valid save must be reconstructed in place.
// Keep its players, career history, and archived records, and do not import a second
// copy of a player that is already present under a legacy map key.
const missingClubMapWorld = JSON.parse(JSON.stringify(archiveReplaceWorld));
const missingClubMapPlayerKey = "missing-club-map-saved-player";
const missingClubMapPlayerName = "New Officially Sourced Player";
const missingClubMapPlayer = {
  id: "missing-club-map-legacy-internal-id",
  name: missingClubMapPlayerName,
  clubId: archiveReplaceClubId,
  country: archiveReplaceCountry,
  leagueId: archiveReplaceLeagueId,
  division: 1,
  position: "مهاجم",
  group: "attacker",
  age: 23,
  ovr: 68,
  potential: 79,
  isGenerated: false,
  isRealPlayer: true,
  retired: false,
  freeAgent: false
};
missingClubMapWorld.players[missingClubMapPlayerKey] = missingClubMapPlayer;
const missingClubMapHistory = [{ season: 4, type: "saved-career-history", note: "preserve missing-map career history" }];
missingClubMapWorld.playerHistory[missingClubMapPlayerKey] = missingClubMapHistory;
const preservedArchivedPlayerKey = "missing-club-map-previously-archived-player";
const preservedArchivedPlayer = {
  id: preservedArchivedPlayerKey,
  name: "Previously Archived Player",
  clubId: "missing-club-map-former-club",
  country: archiveReplaceCountry,
  leagueId: "missing-club-map-former-league",
  position: "مهاجم",
  age: 29
};
const preservedArchivedHistory = [{ season: 2, type: "archived-career-history" }];
const preservedArchivedSeasonStats = [{
  id: preservedArchivedPlayerKey,
  playerId: preservedArchivedPlayerKey,
  season: 2,
  appearances: 12,
  goals: 4,
  assists: 1
}];
missingClubMapWorld.archive = {
  clubs: {},
  players: { [preservedArchivedPlayerKey]: preservedArchivedPlayer },
  playerHistory: { [preservedArchivedPlayerKey]: preservedArchivedHistory },
  seasonStats: { "2": preservedArchivedSeasonStats },
  leagueTables: {},
  leagueTableRows: {},
  matchesBySeason: {},
  competitionsBySeason: {}
};
delete missingClubMapWorld.clubs;
const missingClubMapSave = { season: 6, worldSimulation: missingClubMapWorld };
const recoveredMissingClubMap = ai.ensureState(missingClubMapSave, archiveReplaceDb);
assert.strictEqual(recoveredMissingClubMap, missingClubMapWorld,
  "a valid save with a missing club map must be repaired in place rather than reseeded");
assert.strictEqual(missingClubMapSave.worldSimulation, missingClubMapWorld,
  "the recovered world must remain the original saved world object");
assert.ok(recoveredMissingClubMap.clubs[archiveReplaceClubId],
  "the missing club map must be rebuilt from the current catalogue");
assert.ok(recoveredMissingClubMap.clubs[archiveReplaceClubId].roster.includes(missingClubMapPlayerKey),
  "existing saved players must be relinked to the rebuilt club");
assert.strictEqual(recoveredMissingClubMap.players[missingClubMapPlayerKey], missingClubMapPlayer,
  "the saved player record must survive map recovery without replacement");
assert.deepEqual(recoveredMissingClubMap.playerHistory[missingClubMapPlayerKey], missingClubMapHistory,
  "the saved player's career history must survive missing club-map recovery");
assert.strictEqual(recoveredMissingClubMap.archive.players[preservedArchivedPlayerKey], preservedArchivedPlayer,
  "previously archived player records must survive missing club-map recovery");
assert.deepEqual(recoveredMissingClubMap.archive.playerHistory[preservedArchivedPlayerKey], preservedArchivedHistory,
  "previously archived career history must survive missing club-map recovery");
assert.deepEqual(recoveredMissingClubMap.archive.seasonStats["2"], preservedArchivedSeasonStats,
  "previously archived season statistics must survive missing club-map recovery");
assert.equal(Object.values(recoveredMissingClubMap.players).filter(player =>
  player && player.name === missingClubMapPlayerName && player.position === "مهاجم").length, 1,
  "rebuilding a missing club map must not duplicate an already saved sourced player");
assert.equal(recoveredMissingClubMap.currentSeason, 6,
  "missing club-map recovery must preserve the active world season");
assert.equal(recoveredMissingClubMap.lastCompletedSeason, 5,
  "missing club-map recovery must preserve completed-season history");

// A missing player map is also recoverable without replacing the archive or
// the saved world container; the catalogue can repopulate the active roster.
const missingPlayersMapWorld = JSON.parse(JSON.stringify(archiveReplaceWorld));
const missingPlayersMapArchivePlayerKey = "missing-players-map-archived-player";
const missingPlayersMapArchivePlayer = {
  id: missingPlayersMapArchivePlayerKey,
  name: "Archived Before Player Map Recovery",
  clubId: "missing-players-map-former-club",
  country: archiveReplaceCountry,
  leagueId: "missing-players-map-former-league",
  position: "مدافع",
  age: 31
};
missingPlayersMapWorld.archive = {
  clubs: {},
  players: { [missingPlayersMapArchivePlayerKey]: missingPlayersMapArchivePlayer },
  playerHistory: { [missingPlayersMapArchivePlayerKey]: [{ season: 1, type: "archived-before-player-map-recovery" }] },
  seasonStats: {},
  leagueTables: {},
  leagueTableRows: {},
  matchesBySeason: {},
  competitionsBySeason: {}
};
delete missingPlayersMapWorld.players;
const missingPlayersMapSave = { season: 6, worldSimulation: missingPlayersMapWorld };
const recoveredMissingPlayersMap = ai.ensureState(missingPlayersMapSave, archiveReplaceDb);
assert.strictEqual(recoveredMissingPlayersMap, missingPlayersMapWorld,
  "a valid save with a missing player map must be repaired in place rather than reseeded");
assert.ok(recoveredMissingPlayersMap.players && typeof recoveredMissingPlayersMap.players === "object",
  "missing player maps must be recreated safely");
assert.strictEqual(recoveredMissingPlayersMap.archive.players[missingPlayersMapArchivePlayerKey],
  missingPlayersMapArchivePlayer,
  "the archive must remain intact while the active player map is rebuilt");
assert.ok(Object.keys(recoveredMissingPlayersMap.players).length > 0,
  "the current roster catalogue must repopulate an absent active player map");

// Missing-map recovery must force one catalogue reconciliation even when the saved
// catalogue and roster schema versions already match the current database.
const currentVersionMissingClubMapWorld = JSON.parse(JSON.stringify(missingClubMapWorld));
currentVersionMissingClubMapWorld.dbVersion = Number(archiveReplaceDb.version);
currentVersionMissingClubMapWorld.rosterSchemaVersion = 3;
currentVersionMissingClubMapWorld.rosterMembershipSchemaVersion = 6;
delete currentVersionMissingClubMapWorld.clubs;
const currentVersionMissingClubMapSave = { season: 6, worldSimulation: currentVersionMissingClubMapWorld };
const currentVersionMissingClubMapRecovered = ai.ensureState(currentVersionMissingClubMapSave, archiveReplaceDb);
assert.ok(currentVersionMissingClubMapRecovered.clubs[archiveReplaceClubId],
  "a missing club map must trigger catalogue reconciliation even when db and roster schema versions match");
assert.ok(currentVersionMissingClubMapRecovered.clubs[archiveReplaceClubId].roster.includes(missingClubMapPlayerKey),
  "same-version club-map recovery must relink the saved player before filling the roster");

const currentVersionMissingPlayersWorld = JSON.parse(JSON.stringify(archiveReplaceWorld));
currentVersionMissingPlayersWorld.dbVersion = Number(archiveReplaceDb.version);
currentVersionMissingPlayersWorld.rosterSchemaVersion = 3;
currentVersionMissingPlayersWorld.rosterMembershipSchemaVersion = 6;
currentVersionMissingPlayersWorld.archive = JSON.parse(JSON.stringify(missingPlayersMapWorld.archive));
delete currentVersionMissingPlayersWorld.players;
const currentVersionMissingPlayersSave = { season: 6, worldSimulation: currentVersionMissingPlayersWorld };
const currentVersionMissingPlayersRecovered = ai.ensureState(currentVersionMissingPlayersSave, archiveReplaceDb);
assert.ok(Object.keys(currentVersionMissingPlayersRecovered.players).length > 0,
  "a missing player map must repopulate from the verified catalogue even when db and roster schema versions match");
assert.strictEqual(currentVersionMissingPlayersRecovered.archive.players[missingPlayersMapArchivePlayerKey].name,
  missingPlayersMapArchivePlayer.name,
  "same-version player-map recovery must preserve archived player identity");

const completedProjectionWorld = JSON.parse(JSON.stringify(archiveReplaceWorld));
completedProjectionWorld.completedSeasons = [5, 6];
completedProjectionWorld.lastCompletedSeason = 6;
const membershipProjectionSave = {
  season: 6,
  worldSimulation: JSON.parse(JSON.stringify(archiveReplaceWorld))
};
membershipProjectionSave.worldSimulation.dbVersion = Number(archiveReplaceDb.version);
membershipProjectionSave.worldSimulation.rosterMembershipSchemaVersion = 4;

// A player's object ID can drift from the key that actually owns it in world.players.
// Roster replacement must use that canonical map/roster key for deletion and archiving.
function assertArchivedReplacementUsesRosterKey(world, label) {
  const club = world.clubs[archiveReplaceClubId];
  assert.ok(club && !club.roster.includes(archiveReplacePlayerId),
    label + ": replaced placeholder must leave the active roster by its roster key");
  assert.equal(world.players[archiveReplacePlayerId], undefined,
    label + ": replaced placeholder must be removed from the active player map by its map key");
  assert.equal(world.archive.players[archiveReplacePlayerId].name, "Archive Academy Placeholder 1",
    label + ": full player record must be archived under the canonical map key");
  assert.deepEqual(world.archive.playerHistory[archiveReplacePlayerId], archiveReplaceHistory,
    label + ": career history must be archived under the canonical map key");
  assert.equal(world.archive.seasonStats["5"].length, 1,
    label + ": season statistics must be archived using the safe player identity");
  assert.equal(world.archive.seasonStats["5"][0].goals, 7,
    label + ": archived season statistics must retain their original totals");
  assert.equal(world.seasonStats["5"].length, 0,
    label + ": archived statistics must leave the active season rows");
  assert.ok(club.roster.some(id => {
    const player = world.players[id];
    return player && player.name === "New Officially Sourced Player" && player.isRealPlayer === true;
  }), label + ": the sourced player must take the released squad slot");
}
const archiveReplaceStaleIdWorld = JSON.parse(JSON.stringify(archiveReplaceWorld));
archiveReplaceStaleIdWorld.players[archiveReplacePlayerId].id = "stale-internal-player-id";
archiveReplaceStaleIdWorld.seasonStats["5"][0].id = {
  toString() { throw new Error("unsafe season-stat player ID coercion"); }
};
assert.doesNotThrow(() => sandbox.window.__lwTestReconcileDatabase(archiveReplaceStaleIdWorld, archiveReplaceDb),
  "stale player IDs and hostile season-stat IDs must not abort roster reconciliation");
assertArchivedReplacementUsesRosterKey(archiveReplaceStaleIdWorld, "stale internal ID");
assert.equal(archiveReplaceStaleIdWorld.archive.players[archiveReplacePlayerId].id, "stale-internal-player-id",
  "archiving must preserve the original player record without rewriting its stale internal ID");
assert.ok(!Object.prototype.hasOwnProperty.call(archiveReplaceStaleIdWorld.archive.players, "stale-internal-player-id"),
  "the stale internal ID must not become a second archive identity");

// A unique legacy internal ID may still be the only key in older season-stat rows.
// Archive both id and playerId aliases under the authoritative players-map key.
const archiveReplaceLegacyStatsWorld = JSON.parse(JSON.stringify(archiveReplaceWorld));
const archiveReplaceLegacyStatsId = "archive-replacement-legacy-stat-id";
archiveReplaceLegacyStatsWorld.players[archiveReplacePlayerId].id = archiveReplaceLegacyStatsId;
archiveReplaceLegacyStatsWorld.seasonStats["5"][0] = {
  id: archiveReplaceLegacyStatsId, clubId: archiveReplaceClubId, leagueId: archiveReplaceLeagueId,
  season: 5, appearances: 24, goals: 7, assists: 3
};
archiveReplaceLegacyStatsWorld.seasonStats["4"].push({
  playerId: archiveReplaceLegacyStatsId, clubId: archiveReplaceClubId, leagueId: archiveReplaceLeagueId,
  season: 4, appearances: 12, goals: 5, assists: 1
});
sandbox.window.__lwTestReconcileDatabase(archiveReplaceLegacyStatsWorld, archiveReplaceDb);
assertArchivedReplacementUsesRosterKey(archiveReplaceLegacyStatsWorld, "unique legacy season-stat ID");
assert.equal(archiveReplaceLegacyStatsWorld.archive.seasonStats["5"][0].id, archiveReplaceLegacyStatsId,
  "archived legacy season rows must retain their original internal ID");
assert.equal(archiveReplaceLegacyStatsWorld.archive.seasonStats["4"].length, 1,
  "rows using only the legacy playerId field must also be archived");
assert.equal(archiveReplaceLegacyStatsWorld.archive.seasonStats["4"][0].playerId, archiveReplaceLegacyStatsId,
  "legacy playerId aliases must be preserved verbatim in the archive");
assert.equal(archiveReplaceLegacyStatsWorld.seasonStats["4"].length, 1,
  "unrelated players' completed-season statistics must remain active");

// A shared internal ID is ambiguous and must never cause another player's stats
// to be attached to the outgoing placeholder.
const archiveReplaceAmbiguousStatsWorld = JSON.parse(JSON.stringify(archiveReplaceWorld));
const archiveReplaceAmbiguousStatsId = "archive-replacement-shared-internal-id";
archiveReplaceAmbiguousStatsWorld.players[archiveReplacePlayerId].id = archiveReplaceAmbiguousStatsId;
archiveReplaceAmbiguousStatsWorld.players[archiveReplaceStablePlayerId].id = archiveReplaceAmbiguousStatsId;
archiveReplaceAmbiguousStatsWorld.seasonStats["5"][0] = {
  id: archiveReplaceAmbiguousStatsId, clubId: archiveReplaceClubId, leagueId: archiveReplaceLeagueId,
  season: 5, appearances: 24, goals: 7, assists: 3
};
sandbox.window.__lwTestReconcileDatabase(archiveReplaceAmbiguousStatsWorld, archiveReplaceDb);
assert.equal(archiveReplaceAmbiguousStatsWorld.players[archiveReplacePlayerId], undefined,
  "the generated placeholder must still be replaced when its internal ID is ambiguous");
assert.equal(archiveReplaceAmbiguousStatsWorld.archive.players[archiveReplacePlayerId].name,
  "Archive Academy Placeholder 1");
assert.equal(archiveReplaceAmbiguousStatsWorld.seasonStats["5"].length, 1,
  "statistics under an ambiguous internal ID must remain available rather than being misattributed");
assert.equal(archiveReplaceAmbiguousStatsWorld.seasonStats["5"][0].id, archiveReplaceAmbiguousStatsId);
assert.ok(!archiveReplaceAmbiguousStatsWorld.archive.seasonStats["5"]
  || archiveReplaceAmbiguousStatsWorld.archive.seasonStats["5"].length === 0,
  "ambiguous legacy statistics must not be archived under the wrong player's canonical key");

// Removing an unsupported club must not make a colliding legacy player ID
// appear unique and transfer the removed player's history to a surviving player.
const removedClubIdentityCollisionWorld = JSON.parse(JSON.stringify(archiveReplaceWorld));
const removedClubIdentityCollisionId = "archive-replacement-unsupported-club";
const removedPlayerIdentityCollisionKey = "archive-replacement-removed-player";
const sharedLegacyPlayerIdentityId = "archive-replacement-shared-legacy-id";
const removedPlayerLegacyHistory = [{
  season: 3, type: "transfer-out", fromClubId: removedClubIdentityCollisionId,
  from: "Removed Unsupported Club", fromCountry: archiveReplaceCountry
}];
const removedPlayerLegacyTransferTrail = [{
  clubId: removedClubIdentityCollisionId, name: "Removed Unsupported Club", country: archiveReplaceCountry
}];
removedClubIdentityCollisionWorld.players[archiveReplacePlayerId].id = sharedLegacyPlayerIdentityId;
removedClubIdentityCollisionWorld.players[removedPlayerIdentityCollisionKey] = {
  id: sharedLegacyPlayerIdentityId, name: "Removed Unsupported Club Player",
  clubId: removedClubIdentityCollisionId, country: archiveReplaceCountry,
  leagueId: "unsupported-legacy-league", division: 1, position: "مهاجم",
  group: "attacker", age: 24, ovr: 60, potential: 65,
  isGenerated: false, isRealPlayer: true, retired: false, freeAgent: false
};
removedClubIdentityCollisionWorld.clubs[removedClubIdentityCollisionId] = {
  id: removedClubIdentityCollisionId, name: "Removed Unsupported Club",
  country: archiveReplaceCountry, leagueId: "unsupported-legacy-league",
  division: 1, roster: [removedPlayerIdentityCollisionKey]
};
delete removedClubIdentityCollisionWorld.playerHistory[archiveReplacePlayerId];
removedClubIdentityCollisionWorld.playerHistory[sharedLegacyPlayerIdentityId] = removedPlayerLegacyHistory;
removedClubIdentityCollisionWorld.transferClubHistoryByPlayer = {
  [sharedLegacyPlayerIdentityId]: removedPlayerLegacyTransferTrail
};
removedClubIdentityCollisionWorld.transferClubHistorySchemaVersion = 1;
removedClubIdentityCollisionWorld.archive = {
  clubs: {}, players: {}, playerHistory: { [sharedLegacyPlayerIdentityId]: removedPlayerLegacyHistory },
  seasonStats: {}, leagueTables: {}, leagueTableRows: {}, matchesBySeason: {}, competitionsBySeason: {}
};
const removedClubIdentityCollisionDb = {
  version: 2,
  leagues: () => [{ id: archiveReplaceLeagueId }],
  leagueFor: () => ({ name: "Archive Test League", englishName: "Archive Test League", matchesPerSeason: 30 }),
  clubs: () => []
};
assert.doesNotThrow(() => sandbox.window.__lwTestReconcileDatabase(
  removedClubIdentityCollisionWorld, removedClubIdentityCollisionDb
), "removing an unsupported club must not break reconciliation when legacy player IDs collide");
assert.equal(removedClubIdentityCollisionWorld.players[removedPlayerIdentityCollisionKey], undefined,
  "the unsupported-club player must leave the active player map");
assert.equal(removedClubIdentityCollisionWorld.archive.players[removedPlayerIdentityCollisionKey].name,
  "Removed Unsupported Club Player", "the removed player record must remain archived");
assert.equal(removedClubIdentityCollisionWorld.players[archiveReplacePlayerId].name,
  "Archive Academy Placeholder 1", "the supported-club player must remain active");
assert.deepEqual(removedClubIdentityCollisionWorld.playerHistory[sharedLegacyPlayerIdentityId],
  removedPlayerLegacyHistory, "ambiguous legacy career history must remain under its original key");
assert.equal(removedClubIdentityCollisionWorld.playerHistory[archiveReplacePlayerId], undefined,
  "the removed player's legacy career history must not be attributed to the surviving player");
assert.deepEqual(removedClubIdentityCollisionWorld.archive.playerHistory[sharedLegacyPlayerIdentityId],
  removedPlayerLegacyHistory, "ambiguous archived history must remain under its original key");
assert.equal(removedClubIdentityCollisionWorld.archive.playerHistory[archiveReplacePlayerId], undefined,
  "ambiguous archived history must not be merged into the surviving player's archive");
assert.deepEqual(removedClubIdentityCollisionWorld.transferClubHistoryByPlayer[sharedLegacyPlayerIdentityId],
  removedPlayerLegacyTransferTrail, "legacy transfer endpoints must remain under the ambiguous ID");
assert.equal(removedClubIdentityCollisionWorld.transferClubHistoryByPlayer[archiveReplacePlayerId], undefined,
  "legacy transfer endpoints must not migrate to the surviving player");

// Existing archive keys are authoritative: a different archived club/player must
// never be overwritten, and the live records must remain attached to their club.
function makeArchiveConflictWorld(conflictKind) {
  const world = JSON.parse(JSON.stringify(archiveReplaceWorld));
  const clubId = "archive-conflict-unsupported-club";
  const playerId = "archive-conflict-unsupported-player";
  const player = {
    id: playerId, name: "Active Unsupported Player", clubId, country: archiveReplaceCountry,
    leagueId: "unsupported-legacy-league", division: 1, position: "مهاجم",
    age: 24, ovr: 60, potential: 66, isGenerated: false, isRealPlayer: true
  };
  const club = {
    id: clubId, name: "Active Unsupported Club", country: archiveReplaceCountry,
    leagueId: "unsupported-legacy-league", division: 1, roster: [playerId]
  };
  world.players[playerId] = player;
  world.clubs[clubId] = club;
  world.playerHistory[playerId] = [{ season: 4, type: "development", note: "preserve active history" }];
  world.seasonStats["5"].push({
    id: playerId, playerId, clubId, leagueId: "unsupported-legacy-league",
    season: 5, appearances: 14, goals: 5, assists: 2
  });
  world.archive = {
    clubs: {}, players: {}, playerHistory: {}, seasonStats: {},
    leagueTables: {}, leagueTableRows: {}, matchesBySeason: {}, competitionsBySeason: {}
  };
  if (conflictKind === "club") {
    world.archive.clubs[clubId] = { ...club, name: "Older Archived Club Snapshot" };
  }
  if (conflictKind === "player") {
    world.archive.players[playerId] = { ...player, name: "Older Archived Player Snapshot" };
  }
  return { world, clubId, playerId };
}
for (const conflictKind of ["club", "player"]) {
  const fixture = makeArchiveConflictWorld(conflictKind);
  const archiveBucket = fixture.world.archive[conflictKind === "club" ? "clubs" : "players"];
  const archiveKey = conflictKind === "club" ? fixture.clubId : fixture.playerId;
  const existingArchiveSnapshot = JSON.stringify(archiveBucket[archiveKey]);
  assert.doesNotThrow(() => sandbox.window.__lwTestReconcileDatabase(
    fixture.world, removedClubIdentityCollisionDb
  ), "a conflicting archived " + conflictKind + " record must not throw");
  assert.equal(JSON.stringify(archiveBucket[archiveKey]), existingArchiveSnapshot,
    "a conflicting archived " + conflictKind + " record must not be overwritten");
  assert.ok(fixture.world.clubs[fixture.clubId],
    "the unsupported club must remain active while an archive identity conflicts");
  assert.ok(fixture.world.players[fixture.playerId],
    "the player must remain active while its archive identity conflicts");
  assert.ok(fixture.world.clubs[fixture.clubId].roster.includes(fixture.playerId),
    "the active player must remain linked to the active club");
  assert.ok(fixture.world.playerHistory[fixture.playerId].length,
    "the active player's career history must remain available");
  assert.ok(fixture.world.seasonStats["5"].some(row => row.playerId === fixture.playerId),
    "the active player's season statistics must remain available");
}

// A locked history key is not a successful archive write. Keep the player and club
// active rather than throwing or removing the only recoverable copy.
const lockedPlayerHistoryWorld = makeArchiveConflictWorld("none");
const lockedPlayerHistoryRows = [];
Object.defineProperty(lockedPlayerHistoryWorld.world.archive.playerHistory, lockedPlayerHistoryWorld.playerId, {
  value: lockedPlayerHistoryRows, enumerable: true, writable: false, configurable: false
});
assert.doesNotThrow(() => sandbox.window.__lwTestReconcileDatabase(
  lockedPlayerHistoryWorld.world, removedClubIdentityCollisionDb
), "a non-writable archived player-history key must defer player removal safely");
assert.ok(lockedPlayerHistoryWorld.world.players[lockedPlayerHistoryWorld.playerId],
  "a player must remain active when its history archive cannot be written");
assert.ok(lockedPlayerHistoryWorld.world.clubs[lockedPlayerHistoryWorld.clubId],
  "the club must remain active while one of its players cannot be archived");
assert.ok(lockedPlayerHistoryWorld.world.playerHistory[lockedPlayerHistoryWorld.playerId].length,
  "career history must remain active when its archive write fails");
assert.ok(lockedPlayerHistoryWorld.world.seasonStats["5"].some(row =>
  row.playerId === lockedPlayerHistoryWorld.playerId),
  "season statistics must remain active when player archival is incomplete");

// A unique legacy alias on a player removed with an unsupported club must be
// archived under the authoritative player-map key, without overwriting older history.
const removedClubUniqueLegacyHistoryWorld = JSON.parse(JSON.stringify(archiveReplaceWorld));
const uniqueRemovedClubId = "archive-replacement-unique-unsupported-club";
const uniqueRemovedPlayerKey = "archive-replacement-unique-removed-player";
const uniqueRemovedLegacyId = "archive-replacement-unique-legacy-id";
const uniqueRemovedCanonicalHistory = [{ season: 2, type: "canonical-active-history" }];
const uniqueRemovedLegacyHistory = [{ season: 3, type: "legacy-alias-history" }];
const uniqueRemovedArchivedHistory = [{ season: 1, type: "previously-archived-history" }];
const uniqueRemovedCanonicalTransfer = [{
  clubId: "archive-replacement-earlier-club", name: "Earlier Club", country: archiveReplaceCountry
}];
const uniqueRemovedLegacyTransfer = [{
  clubId: uniqueRemovedClubId, name: "Unique Unsupported Club", country: archiveReplaceCountry
}];
removedClubUniqueLegacyHistoryWorld.players[uniqueRemovedPlayerKey] = {
  id: uniqueRemovedLegacyId, name: "Unique Legacy Player",
  clubId: uniqueRemovedClubId, country: archiveReplaceCountry,
  leagueId: "unsupported-legacy-league", division: 1, position: "مهاجم",
  group: "attacker", age: 24, ovr: 60, potential: 65,
  isGenerated: false, isRealPlayer: true, retired: false, freeAgent: false
};
removedClubUniqueLegacyHistoryWorld.clubs[uniqueRemovedClubId] = {
  id: uniqueRemovedClubId, name: "Unique Unsupported Club",
  country: archiveReplaceCountry, leagueId: "unsupported-legacy-league",
  division: 1, roster: [uniqueRemovedPlayerKey]
};
removedClubUniqueLegacyHistoryWorld.playerHistory = {
  [uniqueRemovedPlayerKey]: uniqueRemovedCanonicalHistory,
  [uniqueRemovedLegacyId]: uniqueRemovedLegacyHistory
};
removedClubUniqueLegacyHistoryWorld.transferClubHistoryByPlayer = {
  [uniqueRemovedPlayerKey]: uniqueRemovedCanonicalTransfer,
  [uniqueRemovedLegacyId]: uniqueRemovedLegacyTransfer
};
removedClubUniqueLegacyHistoryWorld.transferClubHistorySchemaVersion = 1;
removedClubUniqueLegacyHistoryWorld.archive = {
  clubs: {}, players: {},
  playerHistory: { [uniqueRemovedPlayerKey]: uniqueRemovedArchivedHistory },
  seasonStats: {}, leagueTables: {}, leagueTableRows: {}, matchesBySeason: {}, competitionsBySeason: {}
};
assert.doesNotThrow(() => sandbox.window.__lwTestReconcileDatabase(
  removedClubUniqueLegacyHistoryWorld, removedClubIdentityCollisionDb
), "removing a player with a unique legacy ID must archive its history safely");
assert.equal(removedClubUniqueLegacyHistoryWorld.players[uniqueRemovedPlayerKey], undefined,
  "the unsupported-club player must leave the active player map");
assert.equal(removedClubUniqueLegacyHistoryWorld.archive.players[uniqueRemovedPlayerKey].id,
  uniqueRemovedLegacyId, "the archived player record must retain its original internal ID");
assert.deepEqual(removedClubUniqueLegacyHistoryWorld.archive.playerHistory[uniqueRemovedPlayerKey],
  uniqueRemovedArchivedHistory.concat(uniqueRemovedCanonicalHistory, uniqueRemovedLegacyHistory),
  "existing archived, canonical, and unique legacy career history must all be preserved");
assert.equal(removedClubUniqueLegacyHistoryWorld.playerHistory[uniqueRemovedPlayerKey], undefined,
  "canonical history must leave the active map after successful archival");
assert.equal(removedClubUniqueLegacyHistoryWorld.playerHistory[uniqueRemovedLegacyId], undefined,
  "a unique legacy history alias must leave the active map after successful archival");
assert.deepEqual(removedClubUniqueLegacyHistoryWorld.transferClubHistoryByPlayer[uniqueRemovedPlayerKey],
  uniqueRemovedCanonicalTransfer.concat(uniqueRemovedLegacyTransfer),
  "unique legacy transfer-club endpoints must follow the archived player's canonical map key");
assert.equal(removedClubUniqueLegacyHistoryWorld.transferClubHistoryByPlayer[uniqueRemovedLegacyId], undefined,
  "the unique legacy transfer-history alias must not remain orphaned");

// A shared legacy alias remains untouched; it must never be assigned to the removed
// player or to a different surviving player during unsupported-club archival.
// Season-stat rows can carry a stale id and a valid canonical playerId.
// Either identity must match the removed player so the row cannot remain active.
const stalePrimaryStatsWorld = JSON.parse(JSON.stringify(archiveReplaceWorld));
const staleStatsUnsupportedClubId = "archive-replacement-stats-unsupported-club";
const staleStatsRemovedPlayerKey = "archive-replacement-stats-removed-player";
const staleStatsRow = {
  id: "outdated-season-stat-player-id",
  playerId: staleStatsRemovedPlayerKey,
  clubId: archiveReplaceClubId,
  leagueId: archiveReplaceLeagueId,
  season: 5, appearances: 19, goals: 9, assists: 4
};
stalePrimaryStatsWorld.players[staleStatsRemovedPlayerKey] = {
  id: "stale-stats-internal-player-id", name: "Removed Player With Stale Stats ID",
  clubId: staleStatsUnsupportedClubId, country: archiveReplaceCountry,
  leagueId: "unsupported-legacy-league", division: 1, position: "مهاجم",
  group: "attacker", age: 25, ovr: 61, potential: 67,
  isGenerated: false, isRealPlayer: true, retired: false, freeAgent: false
};
stalePrimaryStatsWorld.clubs[staleStatsUnsupportedClubId] = {
  id: staleStatsUnsupportedClubId, name: "Stats Unsupported Club",
  country: archiveReplaceCountry, leagueId: "unsupported-legacy-league",
  division: 1, roster: [staleStatsRemovedPlayerKey]
};
stalePrimaryStatsWorld.seasonStats["5"].push(staleStatsRow);
stalePrimaryStatsWorld.archive = {
  clubs: {}, players: {}, playerHistory: {}, seasonStats: {},
  leagueTables: {}, leagueTableRows: {}, matchesBySeason: {}, competitionsBySeason: {}
};
assert.doesNotThrow(() => sandbox.window.__lwTestReconcileDatabase(
  stalePrimaryStatsWorld, removedClubIdentityCollisionDb
), "a stale primary stats ID must not prevent archival when playerId identifies the removed player");
assert.equal(stalePrimaryStatsWorld.players[staleStatsRemovedPlayerKey], undefined,
  "the unsupported-club player must be removed from the active player map");
assert.equal(stalePrimaryStatsWorld.seasonStats["5"].length, 1,
  "the supported player's season statistics must remain active");
assert.equal(stalePrimaryStatsWorld.seasonStats["5"][0].id, archiveReplacePlayerId,
  "the active season row must still belong to the supported player");
assert.equal(stalePrimaryStatsWorld.archive.seasonStats["5"].length, 1,
  "the row identified by its valid playerId must be archived");
assert.equal(stalePrimaryStatsWorld.archive.seasonStats["5"][0].id,
  "outdated-season-stat-player-id", "archiving must preserve the original stale id value");
assert.equal(stalePrimaryStatsWorld.archive.seasonStats["5"][0].playerId,
  staleStatsRemovedPlayerKey, "archiving must preserve the canonical playerId value");

// Archival is backup-first: a locked/malformed archive bucket must never cause
// active season data to be deleted or abort reconciliation.
const archiveWriteFailureWorld = JSON.parse(JSON.stringify(archiveReplaceWorld));
const archiveWriteFailureClubId = "archive-replacement-write-failure-club";
const archiveWriteFailurePlayerId = "archive-replacement-write-failure-player";
archiveWriteFailureWorld.players[archiveWriteFailurePlayerId] = {
  id: archiveWriteFailurePlayerId, name: "Archive Write Failure Player",
  clubId: archiveWriteFailureClubId, country: archiveReplaceCountry,
  leagueId: "unsupported-legacy-league", division: 1, position: "مهاجم",
  group: "attacker", age: 24, ovr: 60, potential: 66,
  isGenerated: false, isRealPlayer: true, retired: false, freeAgent: false
};
archiveWriteFailureWorld.clubs[archiveWriteFailureClubId] = {
  id: archiveWriteFailureClubId, name: "Archive Write Failure Club",
  country: archiveReplaceCountry, leagueId: "unsupported-legacy-league",
  division: 1, roster: [archiveWriteFailurePlayerId]
};
const archiveWriteFailureStats = {
  id: archiveWriteFailurePlayerId, playerId: archiveWriteFailurePlayerId,
  clubId: archiveWriteFailureClubId, leagueId: "unsupported-legacy-league",
  season: 5, appearances: 17, goals: 6, assists: 2
};
const archiveWriteFailureTableRow = {
  clubId: archiveWriteFailureClubId, leagueId: archiveReplaceLeagueId,
  division: 1, rank: 8, pts: 20
};
archiveWriteFailureWorld.seasonStats["5"].push(archiveWriteFailureStats);
archiveWriteFailureWorld.leagueTables["5"] = {
  "unsupported-legacy-league": [{ clubId: archiveWriteFailureClubId, leagueId: "unsupported-legacy-league", rank: 1 }],
  [archiveReplaceLeagueId]: [archiveWriteFailureTableRow]
};
archiveWriteFailureWorld.matchesBySeason["5"] = [{
  season: 5, homeClubId: archiveWriteFailureClubId, awayClubId: archiveReplaceClubId,
  homeGoals: 1, awayGoals: 0
}];
archiveWriteFailureWorld.competitionsBySeason["5"] = [{
  id: "afc-cl", confederation: "AFC", season: 5, winnerId: archiveWriteFailureClubId
}];
const lockedSeasonRows = [];
const lockedMatchRows = [];
const lockedCompetitionRows = [];
const lockedArchiveLeagueTables = Object.freeze({});
const lockedArchiveLeagueTableRows = Object.freeze({});
archiveWriteFailureWorld.archive = {
  clubs: {}, players: {}, playerHistory: {},
  seasonStats: {}, leagueTables: {}, leagueTableRows: {},
  matchesBySeason: {}, competitionsBySeason: {}
};
Object.defineProperty(archiveWriteFailureWorld.archive.seasonStats, "5", {
  value: lockedSeasonRows, enumerable: true, writable: false, configurable: false
});
Object.defineProperty(archiveWriteFailureWorld.archive.matchesBySeason, "5", {
  value: lockedMatchRows, enumerable: true, writable: false, configurable: false
});
Object.defineProperty(archiveWriteFailureWorld.archive.competitionsBySeason, "5", {
  value: lockedCompetitionRows, enumerable: true, writable: false, configurable: false
});
Object.defineProperty(archiveWriteFailureWorld.archive.leagueTables, "5", {
  value: lockedArchiveLeagueTables, enumerable: true, writable: false, configurable: false
});
Object.defineProperty(archiveWriteFailureWorld.archive.leagueTableRows, "5", {
  value: lockedArchiveLeagueTableRows, enumerable: true, writable: false, configurable: false
});
assert.doesNotThrow(() => sandbox.window.__lwTestReconcileDatabase(
  archiveWriteFailureWorld, removedClubIdentityCollisionDb
), "unwritable archive buckets must not abort world reconciliation");
assert.ok(archiveWriteFailureWorld.seasonStats["5"].includes(archiveWriteFailureStats),
  "season statistics must remain active when the archive bucket cannot be written");
assert.ok(archiveWriteFailureWorld.leagueTables["5"]["unsupported-legacy-league"],
  "unsupported league tables must remain active when their archive bucket is locked");
assert.ok(archiveWriteFailureWorld.leagueTables["5"][archiveReplaceLeagueId].includes(archiveWriteFailureTableRow),
  "table rows for removed clubs must remain active when archived-row storage is locked");
assert.equal(archiveWriteFailureWorld.matchesBySeason["5"].length, 1,
  "fixtures must remain active when their archive bucket cannot be written");
assert.equal(archiveWriteFailureWorld.competitionsBySeason["5"].length, 1,
  "unsupported competitions must remain active when their archive bucket cannot be written");
assert.equal(archiveWriteFailureWorld.archive.seasonStats["5"].length, 0,
  "a failed season-stat archive write must not overwrite the locked archive bucket");
assert.equal(archiveWriteFailureWorld.archive.matchesBySeason["5"].length, 0,
  "a failed match archive write must not overwrite the locked archive bucket");
assert.equal(archiveWriteFailureWorld.archive.competitionsBySeason["5"].length, 0,
  "a failed competition archive write must not overwrite the locked archive bucket");

// If a required archive bucket is malformed, roster replacement must stop
// before removing the generated player or clearing its live history/statistics.
const archiveReplaceBlockedWorld = JSON.parse(JSON.stringify(archiveReplaceWorld));
archiveReplaceBlockedWorld.archive = {
  clubs: {}, players: {}, playerHistory: {},
  seasonStats: { "5": { malformed: true } },
  leagueTables: {}, leagueTableRows: {}, matchesBySeason: {}, competitionsBySeason: {}
};
assert.doesNotThrow(() => sandbox.window.__lwTestReconcileDatabase(
  archiveReplaceBlockedWorld, archiveReplaceDb
), "a malformed generated-player archive bucket must not abort reconciliation");
assert.equal(archiveReplaceBlockedWorld.players[archiveReplacePlayerId].name,
  "Archive Academy Placeholder 1",
  "the generated player must remain active when its season statistics cannot be archived");
assert.ok(archiveReplaceBlockedWorld.clubs[archiveReplaceClubId].roster.includes(archiveReplacePlayerId),
  "the generated player must remain in the club roster when archival is incomplete");
assert.equal(archiveReplaceBlockedWorld.clubs[archiveReplaceClubId].roster.length, 16,
  "a failed archival must not create an empty squad slot");
assert.equal(archiveReplaceBlockedWorld.clubs[archiveReplaceClubId].roster.some(id => {
  const player = archiveReplaceBlockedWorld.players[id];
  return player && player.name === "New Officially Sourced Player";
}), false, "the sourced replacement must wait until the outgoing player is safely archived");
assert.equal(archiveReplaceBlockedWorld.archive.players[archiveReplacePlayerId], undefined,
  "preflight failure must not partially archive the player record");
assert.equal(archiveReplaceBlockedWorld.playerHistory[archiveReplacePlayerId].length,
  archiveReplaceHistory.length, "career history must remain active after a failed archive preflight");
assert.equal(archiveReplaceBlockedWorld.seasonStats["5"][0].goals, 7,
  "season statistics must remain active after a failed archive preflight");
assert.deepEqual(archiveReplaceBlockedWorld.archive.seasonStats["5"], { malformed: true },
  "the malformed archive bucket must remain untouched");

// A failed player-map deletion must leave the still-active player's live history and stats intact.
const archiveReplaceDeleteFailureWorld = JSON.parse(JSON.stringify(archiveReplaceWorld));
const lockedReplacementPlayer = archiveReplaceDeleteFailureWorld.players[archiveReplacePlayerId];
Object.defineProperty(archiveReplaceDeleteFailureWorld.players, archiveReplacePlayerId, {
  value: lockedReplacementPlayer, enumerable: true, writable: true, configurable: false
});
assert.doesNotThrow(() => sandbox.window.__lwTestReconcileDatabase(
  archiveReplaceDeleteFailureWorld, archiveReplaceDb
), "a non-configurable generated-player key must defer roster replacement without throwing");
assert.strictEqual(archiveReplaceDeleteFailureWorld.players[archiveReplacePlayerId], lockedReplacementPlayer,
  "a generated player that cannot be removed must remain active");
assert.ok(archiveReplaceDeleteFailureWorld.clubs[archiveReplaceClubId].roster.includes(archiveReplacePlayerId),
  "the roster must be restored when the generated player cannot be removed");
assert.deepEqual(archiveReplaceDeleteFailureWorld.playerHistory[archiveReplacePlayerId], archiveReplaceHistory,
  "active career history must remain available when the player deletion fails");
assert.equal(archiveReplaceDeleteFailureWorld.seasonStats["5"].length, 1,
  "active season statistics must remain available when the player deletion fails");
assert.equal(archiveReplaceDeleteFailureWorld.seasonStats["5"][0].goals, 7,
  "the still-active player's original goal total must remain unchanged");
assert.strictEqual(archiveReplaceDeleteFailureWorld.archive.players[archiveReplacePlayerId], lockedReplacementPlayer,
  "the backup copy may exist, but it must not replace the still-active player");
assert.deepEqual(archiveReplaceDeleteFailureWorld.archive.playerHistory[archiveReplacePlayerId], archiveReplaceHistory,
  "the archived backup must retain the player's career history");
assert.equal(archiveReplaceDeleteFailureWorld.archive.seasonStats["5"].length, 1,
  "the archived backup must retain the player's season statistics");

// A later legacy-transfer-history failure must not remove the canonical or alias
// career history from a player who therefore remains active.
const unsupportedAliasTransferFailureWorld = JSON.parse(JSON.stringify(archiveReplaceWorld));
const unsupportedAliasClubId = "archive-replacement-unsupported-alias-club";
const unsupportedAliasPlayerKey = "archive-replacement-unsupported-alias-player";
const unsupportedAliasInternalId = "archive-replacement-unsupported-alias-internal-id";
const unsupportedAliasCanonicalHistory = [{ season: 4, type: "canonical-live-history" }];
const unsupportedAliasLegacyHistory = [{ season: 3, type: "legacy-live-history" }];
unsupportedAliasTransferFailureWorld.players[unsupportedAliasPlayerKey] = {
  id: unsupportedAliasInternalId, name: "Unsupported Alias Transfer Player",
  clubId: unsupportedAliasClubId, country: archiveReplaceCountry,
  leagueId: "unsupported-legacy-league", division: 1, position: "مهاجم",
  group: "attacker", age: 24, ovr: 60, potential: 66,
  isGenerated: false, isRealPlayer: true, retired: false, freeAgent: false
};
unsupportedAliasTransferFailureWorld.clubs[unsupportedAliasClubId] = {
  id: unsupportedAliasClubId, name: "Unsupported Alias Transfer Club",
  country: archiveReplaceCountry, leagueId: "unsupported-legacy-league",
  division: 1, roster: [unsupportedAliasPlayerKey]
};
unsupportedAliasTransferFailureWorld.playerHistory = {
  [unsupportedAliasPlayerKey]: unsupportedAliasCanonicalHistory,
  [unsupportedAliasInternalId]: unsupportedAliasLegacyHistory
};
unsupportedAliasTransferFailureWorld.transferClubHistoryByPlayer = {
  [unsupportedAliasInternalId]: { malformed: true }
};
unsupportedAliasTransferFailureWorld.transferClubHistorySchemaVersion = 1;
unsupportedAliasTransferFailureWorld.archive = {
  clubs: {}, players: {}, playerHistory: {}, seasonStats: {},
  leagueTables: {}, leagueTableRows: {}, matchesBySeason: {}, competitionsBySeason: {}
};
assert.doesNotThrow(() => sandbox.window.__lwTestReconcileDatabase(
  unsupportedAliasTransferFailureWorld, removedClubIdentityCollisionDb
), "a malformed legacy transfer alias must defer player removal safely");
assert.ok(unsupportedAliasTransferFailureWorld.players[unsupportedAliasPlayerKey],
  "the player must remain active when legacy transfer history cannot be reconciled");
assert.ok(unsupportedAliasTransferFailureWorld.clubs[unsupportedAliasClubId].roster.includes(unsupportedAliasPlayerKey),
  "the unsupported club must remain active while its player archival is incomplete");
assert.deepEqual(unsupportedAliasTransferFailureWorld.playerHistory[unsupportedAliasPlayerKey],
  unsupportedAliasCanonicalHistory.concat(unsupportedAliasLegacyHistory),
  "canonical active history must retain both canonical and unique legacy rows when a later archive step fails");
assert.equal(unsupportedAliasTransferFailureWorld.playerHistory[unsupportedAliasInternalId], undefined,
  "the valid legacy history alias must be consolidated under the active canonical player key");
assert.deepEqual(unsupportedAliasTransferFailureWorld.archive.playerHistory[unsupportedAliasPlayerKey],
  unsupportedAliasCanonicalHistory.concat(unsupportedAliasLegacyHistory),
  "the archive may contain a safe backup while the active player remains available");

// A malformed archive category or root container may hold legacy records.
// Reconciliation must defer without replacing that data or changing the active roster.
const malformedArchiveBucketWorld = JSON.parse(JSON.stringify(archiveReplaceWorld));
const preservedMalformedArchiveBucket = [{ legacyArchiveRecord: "keep-me" }];
malformedArchiveBucketWorld.archive = {
  clubs: {}, players: {}, playerHistory: {},
  seasonStats: preservedMalformedArchiveBucket,
  leagueTables: {}, leagueTableRows: {}, matchesBySeason: {}, competitionsBySeason: {}
};
const malformedArchiveBucketBefore = JSON.stringify(malformedArchiveBucketWorld);
assert.doesNotThrow(() => sandbox.window.__lwTestReconcileDatabase(
  malformedArchiveBucketWorld, archiveReplaceDb
), "a malformed archive category must defer reconciliation safely");
assert.strictEqual(malformedArchiveBucketWorld.archive.seasonStats, preservedMalformedArchiveBucket,
  "a malformed archive category must remain intact rather than being replaced with an empty bucket");
assert.equal(JSON.stringify(malformedArchiveBucketWorld), malformedArchiveBucketBefore,
  "a malformed archive category must leave active players, statistics and rosters unchanged");

const malformedArchiveRootWorld = JSON.parse(JSON.stringify(archiveReplaceWorld));
const preservedMalformedArchiveRoot = [{ legacyArchiveRootRecord: "keep-me" }];
malformedArchiveRootWorld.archive = preservedMalformedArchiveRoot;
const malformedArchiveRootBefore = JSON.stringify(malformedArchiveRootWorld);
assert.doesNotThrow(() => sandbox.window.__lwTestReconcileDatabase(
  malformedArchiveRootWorld, archiveReplaceDb
), "a malformed archive root must defer reconciliation safely");
assert.strictEqual(malformedArchiveRootWorld.archive, preservedMalformedArchiveRoot,
  "the original malformed archive root must remain available for recovery");
assert.equal(JSON.stringify(malformedArchiveRootWorld), malformedArchiveRootBefore,
  "a malformed archive root must not trigger player replacement or destructive normalization");

// Frozen archive maps are valid objects but cannot accept new archive records.
// Defer reconciliation before any active club/player/history data is changed.
for (const bucketName of ["clubs", "players", "playerHistory"]) {
  const frozenArchiveBucketWorld = JSON.parse(JSON.stringify(archiveReplaceWorld));
  frozenArchiveBucketWorld.archive = {
    clubs: {}, players: {}, playerHistory: {}, seasonStats: {},
    leagueTables: {}, leagueTableRows: {}, matchesBySeason: {}, competitionsBySeason: {}
  };
  Object.freeze(frozenArchiveBucketWorld.archive[bucketName]);
  const frozenArchiveBucketBefore = JSON.stringify(frozenArchiveBucketWorld);
  assert.doesNotThrow(() => sandbox.window.__lwTestReconcileDatabase(
    frozenArchiveBucketWorld, archiveReplaceDb
  ), "a frozen archive bucket must defer reconciliation without throwing");
  assert.equal(JSON.stringify(frozenArchiveBucketWorld), frozenArchiveBucketBefore,
    "a frozen " + bucketName + " archive bucket must not allow partial world reconciliation");
}

const malformedArchiveStateWorld = JSON.parse(JSON.stringify(archiveReplaceWorld));
malformedArchiveStateWorld.archive = preservedMalformedArchiveRoot;
const malformedArchiveStateSnapshot = {
  players: JSON.stringify(malformedArchiveStateWorld.players),
  roster: JSON.stringify(malformedArchiveStateWorld.clubs[archiveReplaceClubId].roster),
  playerHistory: JSON.stringify(malformedArchiveStateWorld.playerHistory),
  seasonStats: JSON.stringify(malformedArchiveStateWorld.seasonStats),
  currentSeason: malformedArchiveStateWorld.currentSeason,
  dbVersion: malformedArchiveStateWorld.dbVersion
};
const malformedArchiveStateSave = { season: 5, worldSimulation: malformedArchiveStateWorld };
assert.strictEqual(ai.ensureState(malformedArchiveStateSave, db), malformedArchiveStateWorld,
  "state loading must retain the original world when its archive container is malformed");
assert.strictEqual(malformedArchiveStateWorld.archive, preservedMalformedArchiveRoot,
  "state loading must preserve the original malformed archive container");
assert.equal(JSON.stringify(malformedArchiveStateWorld.players), malformedArchiveStateSnapshot.players,
  "state loading must not replace or delete active players while the archive is malformed");
assert.equal(JSON.stringify(malformedArchiveStateWorld.clubs[archiveReplaceClubId].roster),
  malformedArchiveStateSnapshot.roster, "state loading must preserve the active roster");
assert.equal(JSON.stringify(malformedArchiveStateWorld.playerHistory), malformedArchiveStateSnapshot.playerHistory,
  "state loading must preserve career history");
assert.equal(JSON.stringify(malformedArchiveStateWorld.seasonStats), malformedArchiveStateSnapshot.seasonStats,
  "state loading must preserve active season statistics");
assert.equal(malformedArchiveStateWorld.currentSeason, malformedArchiveStateSnapshot.currentSeason,
  "state loading must not advance the world season while archive recovery is pending");
assert.equal(malformedArchiveStateWorld.dbVersion, malformedArchiveStateSnapshot.dbVersion,
  "state loading must defer catalogue reconciliation while archive recovery is pending");

// Active world-history containers can be malformed without being empty. Keep their
// exact payloads in the save before normalizing the fields used by the simulation.
const malformedActiveHistoryWorld = JSON.parse(JSON.stringify(archiveReplaceWorld));
const malformedActiveHistoryPayloads = {
  completedSeasons: { legacySeasonMarkers: [3, 4] },
  seasonStats: "legacy-season-statistics-payload",
  leagueTables: "legacy-league-table-payload",
  transfers: { legacyTransferRows: [{ id: "legacy-transfer", playerId: archiveReplacePlayerId }] },
  marketReports: { legacyMarketRows: [{ season: 4, moves: 1 }] },
  playerHistory: "legacy-player-history-payload",
  notes: { legacyNotes: ["legacy-world-note"] },
  matchesBySeason: [{ legacyMatchRows: [{ season: 4, id: "legacy-match" }] }],
  competitionsBySeason: [{ legacyCompetitionRows: [{ season: 4, id: "legacy-competition" }] }],
  promotionHistory: { legacyPromotionRows: [{ season: 4, moves: [] }] },
  aiMetadata: "legacy-ai-metadata-payload",
  transferClubHistoryByPlayer: [{ playerId: archiveReplacePlayerId, clubs: ["legacy-club"] }]
};
malformedActiveHistoryWorld.legacyRecoveryData = { priorRecoveryMarker: "keep-existing-recovery" };
Object.assign(malformedActiveHistoryWorld, malformedActiveHistoryPayloads);
const malformedActiveHistorySave = { season: 5, worldSimulation: malformedActiveHistoryWorld };
const recoveredActiveHistoryWorld = ai.ensureState(malformedActiveHistorySave, archiveReplaceDb);
assert.strictEqual(recoveredActiveHistoryWorld, malformedActiveHistoryWorld,
  "malformed active history must be repaired in place without replacing the saved world");
assert.equal(recoveredActiveHistoryWorld.legacyRecoveryData.priorRecoveryMarker, "keep-existing-recovery",
  "active-history recovery must not overwrite earlier recovery payloads");
for (const [field, payload] of Object.entries(malformedActiveHistoryPayloads)) {
  assert.deepEqual(recoveredActiveHistoryWorld.legacyRecoveryData[field], payload,
    "malformed " + field + " data must be retained in the save recovery bucket");
}
assert.ok(Array.isArray(recoveredActiveHistoryWorld.completedSeasons));
assert.ok(Array.isArray(recoveredActiveHistoryWorld.transfers));
assert.ok(Array.isArray(recoveredActiveHistoryWorld.marketReports));
assert.ok(Array.isArray(recoveredActiveHistoryWorld.notes));
assert.ok(recoveredActiveHistoryWorld.seasonStats && typeof recoveredActiveHistoryWorld.seasonStats === "object");
assert.ok(recoveredActiveHistoryWorld.leagueTables && typeof recoveredActiveHistoryWorld.leagueTables === "object");
assert.ok(recoveredActiveHistoryWorld.playerHistory && typeof recoveredActiveHistoryWorld.playerHistory === "object");
assert.ok(recoveredActiveHistoryWorld.matchesBySeason && typeof recoveredActiveHistoryWorld.matchesBySeason === "object"
  && !Array.isArray(recoveredActiveHistoryWorld.matchesBySeason));
assert.ok(recoveredActiveHistoryWorld.competitionsBySeason && typeof recoveredActiveHistoryWorld.competitionsBySeason === "object"
  && !Array.isArray(recoveredActiveHistoryWorld.competitionsBySeason));
assert.ok(Array.isArray(recoveredActiveHistoryWorld.promotionHistory));
assert.ok(recoveredActiveHistoryWorld.aiMetadata && typeof recoveredActiveHistoryWorld.aiMetadata === "object"
  && !Array.isArray(recoveredActiveHistoryWorld.aiMetadata));
assert.ok(recoveredActiveHistoryWorld.transferClubHistoryByPlayer
  && typeof recoveredActiveHistoryWorld.transferClubHistoryByPlayer === "object"
  && !Array.isArray(recoveredActiveHistoryWorld.transferClubHistoryByPlayer),
  "the compact transfer-history index must be normalized only after its original payload is retained");

const fallbackRecoveryWorld = JSON.parse(JSON.stringify(archiveReplaceWorld));
fallbackRecoveryWorld.legacyRecoveryData = ["unusable-primary-recovery"];
const fallbackTransferPayload = { legacyTransferRows: [{ id: "fallback-preserved-transfer" }] };
fallbackRecoveryWorld.transfers = fallbackTransferPayload;
const recoveredFallbackWorld = ai.ensureState({ season: 5, worldSimulation: fallbackRecoveryWorld }, archiveReplaceDb);
assert.ok(Array.isArray(recoveredFallbackWorld.legacyRecoveryData),
  "the malformed primary recovery bucket must remain untouched");
assert.deepEqual(recoveredFallbackWorld.legacyRecoveryDataFallback.previousRecoveryData,
  ["unusable-primary-recovery"], "the fallback bucket must retain the malformed primary recovery bucket");
assert.deepEqual(recoveredFallbackWorld.legacyRecoveryDataFallback.transfers, fallbackTransferPayload,
  "the fallback bucket must retain the malformed active transfer payload");
assert.ok(Array.isArray(recoveredFallbackWorld.transfers));

const blockedRecoveryWorld = JSON.parse(JSON.stringify(archiveReplaceWorld));
blockedRecoveryWorld.legacyRecoveryData = ["unusable-primary-recovery"];
blockedRecoveryWorld.legacyRecoveryDataFallback = ["unusable-fallback-recovery"];
blockedRecoveryWorld.transfers = { legacyTransferRows: [{ id: "must-not-be-dropped" }] };
const blockedTransferSnapshot = JSON.stringify(blockedRecoveryWorld.transfers);
const blockedRecoveryBucketSnapshot = JSON.stringify([
  blockedRecoveryWorld.legacyRecoveryData,
  blockedRecoveryWorld.legacyRecoveryDataFallback
]);
assert.strictEqual(ai.ensureState({ season: 5, worldSimulation: blockedRecoveryWorld }, archiveReplaceDb),
  blockedRecoveryWorld, "unusable primary and fallback recovery containers must defer active-history normalization");
assert.equal(JSON.stringify(blockedRecoveryWorld.transfers), blockedTransferSnapshot,
  "when no recovery bucket is writable, world repair must leave the original transfer payload untouched");
assert.equal(JSON.stringify([
  blockedRecoveryWorld.legacyRecoveryData,
  blockedRecoveryWorld.legacyRecoveryDataFallback
]), blockedRecoveryBucketSnapshot, "world repair must not overwrite unusable recovery buckets");

const archiveReplaceHostileIdWorld = JSON.parse(JSON.stringify(archiveReplaceWorld));
const hostileArchivePlayerId = {
  toString() { throw new Error("unsafe generated-player ID coercion"); },
  valueOf() { throw new Error("unsafe generated-player numeric coercion"); }
};
archiveReplaceHostileIdWorld.players[archiveReplacePlayerId].id = hostileArchivePlayerId;
assert.doesNotThrow(() => sandbox.window.__lwTestReconcileDatabase(archiveReplaceHostileIdWorld, archiveReplaceDb),
  "a hostile generated-player ID must not abort roster reconciliation");
assertArchivedReplacementUsesRosterKey(archiveReplaceHostileIdWorld, "hostile internal ID");
assert.strictEqual(archiveReplaceHostileIdWorld.archive.players[archiveReplacePlayerId].id, hostileArchivePlayerId,
  "archiving must preserve the original hostile ID value without coercion");

sandbox.window.__lwTestReconcileDatabase(archiveReplaceWorld, archiveReplaceDb);
const archiveReplaceClubAfter = archiveReplaceWorld.clubs[archiveReplaceClubId];
const sourcedReplacement = archiveReplaceClubAfter.roster
  .map(id => archiveReplaceWorld.players[id]).find(player => player && player.name === "New Officially Sourced Player");
assert.ok(sourcedReplacement && sourcedReplacement.isRealPlayer === true,
  "a newly sourced real player must still replace an available generated squad placeholder");
assert.equal(archiveReplaceClubAfter.roster.length, 16,
  "roster reconciliation must keep the club's active squad at its configured size");
assert.ok(!archiveReplaceClubAfter.roster.includes(archiveReplacePlayerId),
  "the replaced placeholder must leave the active squad");
assert.equal(archiveReplaceWorld.players[archiveReplacePlayerId], undefined,
  "a replaced placeholder must leave the active simulation player map");
assert.equal(archiveReplaceWorld.archive.players[archiveReplacePlayerId].name,
  "Archive Academy Placeholder 1",
  "the full outgoing generated player record must be retained in the archive");
assert.deepEqual(archiveReplaceWorld.archive.playerHistory[archiveReplacePlayerId], archiveReplaceHistory,
  "career history must be archived when its generated player is replaced");
assert.ok(!Object.prototype.hasOwnProperty.call(archiveReplaceWorld.playerHistory, archiveReplacePlayerId),
  "archived career history must not remain duplicated in the active player-history map");
assert.equal(archiveReplaceWorld.archive.seasonStats["5"].length, 1,
  "all saved season statistics for the replaced player must be archived");
assert.equal(archiveReplaceWorld.archive.seasonStats["5"][0].id, archiveReplacePlayerId,
  "the archived season row must retain its original player ID");
assert.equal(archiveReplaceWorld.archive.seasonStats["5"][0].goals, 7,
  "the archived season row must retain its original performance totals");
assert.equal(archiveReplaceWorld.seasonStats["5"].length, 0,
  "replaced-player statistics must leave the active season table after being archived");
assert.ok(archiveReplaceWorld.transfers.some(row => row.playerId === archiveReplacePlayerId),
  "the existing transfer ledger must remain intact after a generated player is archived");
assert.equal(archiveReplaceWorld.nextGeneratedPlayer, 41,
  "roster reconciliation must not allocate synthetic players while archiving a replacement");
assert.deepEqual(archiveReplaceWorld.seasonStats["4"], [archiveReplaceStableSeasonRow],
  "reconciling a roster must preserve older season statistics that are not tied to the replaced player");
for (const field of ["matchesBySeason", "seasonStats", "leagueTables", "competitionsBySeason"]) {
  assert.ok(!Object.prototype.hasOwnProperty.call(archiveReplaceWorld[field], "6"),
    "a roster catalogue refresh must invalidate the unfinished current season's " + field + " snapshot");
  assert.ok(Object.prototype.hasOwnProperty.call(archiveReplaceWorld[field], "5"),
    "a roster catalogue refresh must preserve the prior completed season's " + field + " snapshot");
}

// A completed current season is historical truth and must not be invalidated by a later catalogue refresh.
sandbox.window.__lwTestReconcileDatabase(completedProjectionWorld, archiveReplaceDb);
for (const field of ["matchesBySeason", "seasonStats", "leagueTables", "competitionsBySeason"]) {
  assert.ok(Object.prototype.hasOwnProperty.call(completedProjectionWorld[field], "6"),
    "a completed season's " + field + " snapshot must survive roster reconciliation");
}
assert.equal(completedProjectionWorld.seasonStats["6"][0].id, archiveReplaceStablePlayerId,
  "completed player-season records must remain attached to their original player identity");

// The one-time roster-membership migration also changes active squads, so it must invalidate only an unfinished projection.
const membershipProjectionWorld = ai.ensureState(membershipProjectionSave, archiveReplaceDb);
assert.equal(membershipProjectionWorld.rosterMembershipSchemaVersion, 6,
  "the pending-projection fixture must complete the current roster-membership migration");
for (const field of ["matchesBySeason", "seasonStats", "leagueTables", "competitionsBySeason"]) {
  assert.ok(!Object.prototype.hasOwnProperty.call(membershipProjectionWorld[field], "6"),
    "roster-membership migration must invalidate the unfinished current season's " + field + " snapshot");
  assert.ok(Object.prototype.hasOwnProperty.call(membershipProjectionWorld[field], "5"),
    "roster-membership migration must preserve the previous completed season's " + field + " snapshot");
}

// A legacy career save may be several seasons ahead of its world marker. Resolve the
// effective season before roster migration invalidates projections, or stale current
// season fixtures survive because the migration only sees the old world.currentSeason.
const legacyCareerSeasonProjectionSave = {
  season: 8,
  worldSimulation: JSON.parse(JSON.stringify(archiveReplaceWorld))
};
legacyCareerSeasonProjectionSave.worldSimulation.currentSeason = 6;
legacyCareerSeasonProjectionSave.worldSimulation.lastAdvancedTo = 0;
legacyCareerSeasonProjectionSave.worldSimulation.lastCompletedSeason = 5;
legacyCareerSeasonProjectionSave.worldSimulation.completedSeasons = [5, [8]];
legacyCareerSeasonProjectionSave.worldSimulation.dbVersion = Number(archiveReplaceDb.version);
legacyCareerSeasonProjectionSave.worldSimulation.rosterMembershipSchemaVersion = 4;
legacyCareerSeasonProjectionSave.worldSimulation.matchesBySeason["8"] = archiveReplaceMatches(8);
legacyCareerSeasonProjectionSave.worldSimulation.seasonStats["8"] = [{
  id: archiveReplaceStablePlayerId, playerId: archiveReplaceStablePlayerId, season: 8,
  appearances: 2, goals: 1, assists: 0
}];
legacyCareerSeasonProjectionSave.worldSimulation.leagueTables["8"] = archiveReplaceTable(8);
legacyCareerSeasonProjectionSave.worldSimulation.competitionsBySeason["8"] = [
  { id: "legacy-career-season-pending-cup", season: 8 }
];
const legacyCareerSeasonProjectionWorld = ai.ensureState(legacyCareerSeasonProjectionSave, archiveReplaceDb);
assert.equal(legacyCareerSeasonProjectionWorld.currentSeason, 8,
  "legacy saves without a world transition marker must resolve the career season before roster migration");
for (const field of ["matchesBySeason", "seasonStats", "leagueTables", "competitionsBySeason"]) {
  assert.ok(!Object.prototype.hasOwnProperty.call(legacyCareerSeasonProjectionWorld[field], "8"),
    "roster-membership migration must invalidate the effective current season rather than the stale world marker: " + field);
  assert.ok(Object.prototype.hasOwnProperty.call(legacyCareerSeasonProjectionWorld[field], "5"),
    "resolving a legacy career season must preserve completed historical projections: " + field);
}

// A malformed Symbol/array marker must stay inert during season completion: it cannot
// crash numeric ordering or consume one of the 20 retained valid-season slots.
const symbolSeasonMarkerSave = {
  season: 8,
  worldSimulation: JSON.parse(JSON.stringify(legacyCareerSeasonProjectionWorld))
};
const symbolSeasonMarkerWorld = ai.ensureState(symbolSeasonMarkerSave, archiveReplaceDb);
const malformedArraySeasonMarker = [8];
const malformedSymbolSeasonMarker = Symbol("invalid-completed-season");
symbolSeasonMarkerWorld.completedSeasons = [5, malformedArraySeasonMarker, malformedSymbolSeasonMarker];
assert.doesNotThrow(() => ai.completeSeason(symbolSeasonMarkerSave, 8, archiveReplaceDb),
  "malformed completed-season markers must not throw while finalizing a season");
assert.ok(symbolSeasonMarkerWorld.completedSeasons.includes(malformedArraySeasonMarker),
  "malformed array markers must be preserved but remain invalid");
assert.ok(symbolSeasonMarkerWorld.completedSeasons.includes(malformedSymbolSeasonMarker),
  "malformed Symbol markers must be preserved but remain invalid");
assert.ok(symbolSeasonMarkerWorld.completedSeasons.some(marker => marker === 8),
  "the newly completed numeric season must still be recorded");

// A catalogue refresh must not reset simulated promotion/relegation in an existing save.
assert.equal(typeof sandbox.window.__lwTestReconcileDatabase, "function",
  "database reconciliation must be exposed to the isolated regression test");

const malformedReconcileDivisionValues = [
  [1],
  Symbol("invalid-saved-division"),
  { valueOf() { throw new Error("unsafe saved division coercion"); } },
  0,
  -1,
  1.5
];
for (let index = 0; index < malformedReconcileDivisionValues.length; index++) {
  const clubName = "Division Reconcile Club " + index;
  const country = "Testland";
  const leagueId = "division-reconcile-league";
  const clubId = ai.clubKey(clubName, country);
  const roster = Array.from({ length: 16 }, (_, playerIndex) =>
    "division-reconcile-player-" + index + "-" + playerIndex);
  const club = {
    id: clubId, name: clubName, country, leagueId,
    division: malformedReconcileDivisionValues[index],
    power: 60, basePower: 60, prestige: 50, matchesPerSeason: 30, roster: roster.slice()
  };
  const players = Object.fromEntries(roster.map((playerId, playerIndex) => [playerId, {
    id: playerId, name: "Division Reconcile Player " + index + "-" + playerIndex,
    clubId, country, leagueId, division: 1, position: "مهاجم", group: "attacker",
    age: 24, ovr: 60, potential: 75, retired: false, freeAgent: false,
    contractSeasons: 2, isGenerated: false
  }]));
  const reconcileWorld = {
    clubs: { [clubId]: club }, players, playerHistory: {},
    seasonStats: {}, leagueTables: {}, matchesBySeason: {}, competitionsBySeason: {},
    transfers: [], marketReports: [], promotionHistory: [], notes: [],
    completedSeasons: [], currentSeason: 4, lastCompletedSeason: 3,
    nextGeneratedPlayer: 20, transferSequence: 0, projectionRevision: 0
  };
  const reconcileDb = {
    version: 1,
    leagues: () => [{ id: leagueId }],
    clubs: () => [{ name: clubName, country, leagueId, division: 2, players: [] }],
    playerRecordsForClub: () => [],
    leagueFor: (_country, division) => ({
      name: division === 2 ? "Trusted Second Division" : "Trusted First Division",
      englishName: division === 2 ? "Trusted Championship" : "Trusted Premier League",
      matchesPerSeason: 30
    })
  };
  assert.doesNotThrow(() => sandbox.window.__lwTestReconcileDatabase(reconcileWorld, reconcileDb),
    "database reconciliation must safely recover malformed saved club divisions");
  assert.equal(club.division, 2,
    "an invalid saved division must fall back to the trusted database tier, not be coerced into tier one");
  roster.forEach(playerId => assert.equal(players[playerId].division, 2,
    "players must follow the recovered authoritative club division"));
}

// Database reconciliation must preserve malformed legacy rows without coercing their IDs.
const hostileReconcileValue = {
  toString() { throw new Error("unsafe reconciliation ID coercion"); },
  valueOf() { throw new Error("unsafe reconciliation ID conversion"); }
};
function throwingReconcileFields(fields) {
  const record = {};
  fields.forEach(field => Object.defineProperty(record, field, {
    enumerable: true,
    configurable: true,
    get() { throw new Error("unsafe saved reconciliation field read: " + field); }
  }));
  return record;
}
const hostileReconcileHistoryRow = throwingReconcileFields([
  "fromClubId", "from", "clubId", "club", "country", "fromCountry"
]);
const hostileReconcileTransferEndpoint = throwingReconcileFields(["clubId", "name", "country"]);
const hostileReconcileSeasonRow = throwingReconcileFields(["leagueId", "id", "playerId", "clubId"]);
const hostileReconcileTableRow = throwingReconcileFields(["leagueId", "clubId"]);
const hostileReconcileMatch = throwingReconcileFields(["homeClubId", "awayClubId"]);
const hostileReconcileCompetition = throwingReconcileFields(["id", "competitionId", "confederation"]);
const removedReconcilePlayer = {
  id: "removed-reconcile-player", name: "Removed Reconcile Player",
  clubId: "removed-reconcile-club", country: "Testland", position: "مهاجم",
  group: "attacker", age: 24, retired: false, freeAgent: false
};
const hostileReconcilePlayer = {
  id: hostileReconcileValue, name: "Hostile Reconcile Player",
  clubId: hostileReconcileValue, previousClubId: hostileReconcileValue,
  retiredFromClubId: hostileReconcileValue, country: "Testland",
  position: "مهاجم", group: "attacker", age: 24, retired: false, freeAgent: false
};
const removedReconcileStatsRow = {
  id: "removed-reconcile-player", playerId: "removed-reconcile-player",
  clubId: "removed-reconcile-club", leagueId: "unsupported-reconcile-league", goals: 4
};
const removedReconcileTableRow = {
  clubId: "removed-reconcile-club", leagueId: "supported-reconcile-league", rank: 12
};
const removedReconcileMatch = {
  homeClubId: "removed-reconcile-club", awayClubId: "other-reconcile-club", homeGoals: 1, awayGoals: 0
};
const hostileReconcileAfcCompetition = { id: "afc-cl", confederation: "AFC" };
const hostileReconcileWorld = {
  schemaVersion: ai.version, dbVersion: 1, currentSeason: 4, lastCompletedSeason: 4,
  lastAdvancedTo: 4, completedSeasons: [4], rosterSchemaVersion: 3,
  rosterMembershipSchemaVersion: 6, transferClubHistorySchemaVersion: 1,
  clubs: {
    "removed-reconcile-club": {
      id: "removed-reconcile-club", name: "Removed Reconcile Club", country: "Testland",
      leagueId: "unsupported-reconcile-league", division: 1, roster: ["removed-reconcile-player"]
    }
  },
  players: {
    "hostile-reconcile-player": hostileReconcilePlayer,
    "removed-reconcile-player": removedReconcilePlayer
  },
  playerHistory: {
    "hostile-reconcile-player": [hostileReconcileHistoryRow],
    "removed-reconcile-player": [{ clubId: "removed-reconcile-club", club: "Removed Reconcile Club" }]
  },
  transferClubHistoryByPlayer: { "hostile-reconcile-player": [hostileReconcileTransferEndpoint] },
  seasonStats: { "4": [hostileReconcileSeasonRow, removedReconcileStatsRow] },
  leagueTables: { "4": { "supported-reconcile-league": [hostileReconcileTableRow, removedReconcileTableRow] } },
  matchesBySeason: { "4": [hostileReconcileMatch, removedReconcileMatch] },
  competitionsBySeason: { "4": [hostileReconcileCompetition, hostileReconcileAfcCompetition] },
  transfers: [], marketReports: [], notes: [], nextGeneratedPlayer: 100,
  transferSequence: 0, projectionRevision: 0
};
const hostileReconcileDb = {
  version: 2,
  leagues: () => [{ id: "supported-reconcile-league" }],
  clubs: () => [],
  playerRecordsForClub: () => [],
  leagueFor: () => ({ name: "Supported Reconcile League", englishName: "Supported Reconcile League", matchesPerSeason: 30 })
};
assert.doesNotThrow(() => sandbox.window.__lwTestReconcileDatabase(hostileReconcileWorld, hostileReconcileDb),
  "database reconciliation must not coerce hostile IDs or property getters in saved player/history/stat/match records");
assert.strictEqual(hostileReconcileWorld.players["hostile-reconcile-player"], hostileReconcilePlayer,
  "a player with an unresolvable saved club ID must remain preserved in the active player map");
assert.equal(hostileReconcilePlayer.clubId, hostileReconcileValue,
  "reconciliation must not rewrite a malformed player-to-club source value");
assert.equal(hostileReconcileWorld.players["removed-reconcile-player"], undefined,
  "a player with a valid link to a removed competition must still leave the active player map");
assert.strictEqual(hostileReconcileWorld.archive.players["removed-reconcile-player"], removedReconcilePlayer,
  "the complete removed player record must be preserved in the archive");
assert.equal(hostileReconcileWorld.archive.playerHistory["removed-reconcile-player"][0].clubId,
  "removed-reconcile-club", "removed-player career history must still be archived intact");
assert.equal(hostileReconcileWorld.seasonStats["4"].length, 1,
  "a statistics row with unreadable IDs must remain in its original saved season");
assert.strictEqual(hostileReconcileWorld.seasonStats["4"][0], hostileReconcileSeasonRow);
assert.strictEqual(hostileReconcileWorld.archive.seasonStats["4"][0], removedReconcileStatsRow,
  "valid rows linked to removed players/clubs must still be archived");
assert.equal(hostileReconcileWorld.leagueTables["4"]["supported-reconcile-league"].length, 1,
  "a table row with unreadable IDs must remain in its original league table");
assert.strictEqual(hostileReconcileWorld.leagueTables["4"]["supported-reconcile-league"][0], hostileReconcileTableRow);
assert.strictEqual(hostileReconcileWorld.archive.leagueTableRows["4"]["supported-reconcile-league"][0],
  removedReconcileTableRow, "valid removed-club table rows must be archived");
assert.strictEqual(hostileReconcileWorld.matchesBySeason["4"][0], hostileReconcileMatch,
  "a match with unreadable club IDs must be preserved rather than deleted");
assert.strictEqual(hostileReconcileWorld.archive.matchesBySeason["4"][0], removedReconcileMatch,
  "matches involving removed clubs must still be archived");
assert.strictEqual(hostileReconcileWorld.competitionsBySeason["4"][0], hostileReconcileCompetition,
  "a competition with unreadable identifiers must be preserved");
assert.strictEqual(hostileReconcileWorld.archive.competitionsBySeason["4"][0], hostileReconcileAfcCompetition,
  "known unsupported AFC competitions must still be archived");
assert.equal(hostileReconcileWorld.nextGeneratedPlayer, 100,
  "malformed reconciliation records must not trigger synthetic player generation");

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

const dashboardLeagueId = String((db.leagues().find(row => row && row.id) || {}).id || "");
assert.ok(dashboardLeagueId, "dashboard division fixture requires a supported league ID");
const dashboardIdentitySave = {
  ...save,
  clubName: "Dashboard Second Tier FC",
  leagueCountry: "Dashboard Testland",
  leagueDivision: 2,
  worldSimulation: JSON.parse(JSON.stringify(world))
};
const dashboardIdentityWorld = dashboardIdentitySave.worldSimulation;
dashboardIdentityWorld.clubs[ai.clubKey("Dashboard First Tier FC", "Dashboard Testland")] = {
  id: "dashboard-first-tier", name: "Dashboard First Tier FC", country: "Dashboard Testland",
  leagueId: dashboardLeagueId, division: 1, roster: []
};
dashboardIdentityWorld.clubs[ai.clubKey("Dashboard Second Tier FC", "Dashboard Testland")] = {
  id: "dashboard-second-tier", name: "Dashboard Second Tier FC", country: "Dashboard Testland",
  leagueId: dashboardLeagueId, division: 2, roster: []
};
const dashboardYear = String(Math.max(1, Number(dashboardIdentityWorld.currentSeason) || 1));
dashboardIdentityWorld.leagueTables[dashboardYear] = {
  ...(dashboardIdentityWorld.leagueTables[dashboardYear] || {}),
  [dashboardLeagueId]: [{ club: "DASHBOARD-FIRST-DIVISION", leagueId: dashboardLeagueId, division: 1 }],
  [dashboardLeagueId + ":2"]: [{ club: "DASHBOARD-SECOND-DIVISION", leagueId: dashboardLeagueId, division: 2 }]
};
const secondDivisionDashboard = ai.dashboard(dashboardIdentitySave, db);
assert.equal(secondDivisionDashboard.leagueTable[0]?.club, "DASHBOARD-SECOND-DIVISION",
  "the world dashboard must show the current player's actual division, not the country's first tier");
dashboardIdentitySave.clubName = "Dashboard First Tier FC";
dashboardIdentitySave.leagueDivision = 1;
const firstDivisionDashboard = ai.dashboard(dashboardIdentitySave, db);
assert.equal(firstDivisionDashboard.leagueTable[0]?.club, "DASHBOARD-FIRST-DIVISION",
  "changing clubs in the same country must refresh the dashboard table instead of reusing a stale cached league");
dashboardIdentitySave.clubName = "";
const unidentifiedClubDashboard = ai.dashboard(dashboardIdentitySave, db);
assert.equal(unidentifiedClubDashboard.leagueTable.length, 0,
  "a missing club identity must not display an arbitrary league table from the same country");

// A world mutation can change persisted dashboard rows without changing any collection
// counts. projectionRevision is the explicit invalidation signal and must be part of the
// dashboard cache key, otherwise the previous table remains visible until another field changes.
const dashboardRevisionSave = {
  ...dashboardIdentitySave,
  clubName: "Dashboard First Tier FC",
  leagueDivision: 1,
  worldSimulation: JSON.parse(JSON.stringify(dashboardIdentityWorld))
};
const dashboardRevisionWorld = dashboardRevisionSave.worldSimulation;
const dashboardRevisionRows = dashboardRevisionWorld.leagueTables[dashboardYear][dashboardLeagueId];
const firstRevisionDashboard = ai.dashboard(dashboardRevisionSave, db);
assert.equal(firstRevisionDashboard.leagueTable[0]?.club, "DASHBOARD-FIRST-DIVISION",
  "the revision-cache fixture must start with the persisted first-division row");
const dashboardRevisionBefore = Number(dashboardRevisionWorld.projectionRevision) || 0;
dashboardRevisionRows[0] = {
  ...dashboardRevisionRows[0],
  club: "DASHBOARD-FIRST-DIVISION-UPDATED"
};
dashboardRevisionWorld.projectionRevision = dashboardRevisionBefore + 1;
const updatedRevisionDashboard = ai.dashboard(dashboardRevisionSave, db);
assert.notStrictEqual(updatedRevisionDashboard, firstRevisionDashboard,
  "a changed world projection revision must rebuild the dashboard instead of returning the cached object");
assert.equal(updatedRevisionDashboard.leagueTable[0]?.club, "DASHBOARD-FIRST-DIVISION-UPDATED",
  "dashboard rows must refresh after a projection revision even when collection sizes are unchanged");

// Competition summaries are also part of the cached dashboard contract. They can be
// restored or refreshed independently of the fixture count in older persisted saves.
dashboardRevisionWorld.competitionsBySeason = dashboardRevisionWorld.competitionsBySeason || {};
dashboardRevisionWorld.competitionsBySeason[dashboardYear] = [{ id: "dashboard-competition-cache-regression" }];
const updatedCompetitionDashboard = ai.dashboard(dashboardRevisionSave, db);
assert.notStrictEqual(updatedCompetitionDashboard, updatedRevisionDashboard,
  "adding current-season competitions must invalidate the cached dashboard summary");
assert.equal(updatedCompetitionDashboard.competitionsSimulated, 1,
  "the dashboard must report newly restored current-season competitions");

dashboardRevisionWorld.competitionsBySeason[dashboardYear].push({
  id: "dashboard-competition-cache-regression-second"
});
const secondCompetitionDashboard = ai.dashboard(dashboardRevisionSave, db);
assert.notStrictEqual(secondCompetitionDashboard, updatedCompetitionDashboard,
  "a second current-season competition update must also invalidate the cached summary");
assert.equal(secondCompetitionDashboard.competitionsSimulated, 2,
  "the dashboard must report the latest current-season competition count");


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
// Isolate the season-cache assertion from the one-off lineup fixtures above.
sandbox.window.__lwLineupBuildsByClub = {};
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
const repeatedLineupBuilds = Object.entries(sandbox.window.__lwLineupBuildsByClub || {})
  .filter(([, count]) => count !== 1);
assert.deepEqual(repeatedLineupBuilds, [],
  "each club lineup should be built exactly once during a season simulation: " + JSON.stringify(repeatedLineupBuilds));
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

// Projection and archived leaderboard paths must reject coercible arrays and unsafe numeric extremes.
const boundedProjectionSave = { season: 1, name: "Bounded projection regression" };
const boundedProjectionWorld = ai.ensureState(boundedProjectionSave, db);
const boundedProjectionPlayer = Object.values(boundedProjectionWorld.players).find(player =>
  player && player.clubId && !player.retired && !player.freeAgent);
assert.ok(boundedProjectionPlayer, "the projection range fixture needs an attached player");
const boundedProjectionClub = boundedProjectionWorld.clubs[boundedProjectionPlayer.clubId];
boundedProjectionPlayer.age = 999;
boundedProjectionPlayer.ovr = 999;
boundedProjectionPlayer.potential = -1;
boundedProjectionClub.power = Number.MAX_VALUE;
boundedProjectionWorld.projectionRevision++;
const boundedProjectionRows = sandbox.window.__lwTestBaseGetSeasonLines(
  boundedProjectionSave, 2, 1, db
);
const boundedProjectionRow = boundedProjectionRows.find(row => row.id === boundedProjectionPlayer.id);
assert.ok(boundedProjectionRow, "the changed player must remain in the projected season");
assert.equal(boundedProjectionRow.age, 60);
assert.equal(boundedProjectionRow.ovr, 99);
assert.equal(boundedProjectionRow.potential, 1);
assert.ok(Number.isFinite(boundedProjectionRow.leagueStrength)
  && boundedProjectionRow.leagueStrength <= 100,
  "projected league strength must remain bounded when a club has an extreme saved power");
assert.ok(Number.isFinite(boundedProjectionRow.weightedGoals),
  "projected weighted goals must remain finite");

const malformedSavedSeasonSave = { season: 5, name: "Malformed archived leaderboard regression" };
const malformedSavedSeasonWorld = ai.ensureState(malformedSavedSeasonSave, db);
malformedSavedSeasonWorld.completedSeasons = [5];
malformedSavedSeasonWorld.seasonStats["5"] = [
  {
    id: "array-season-stat-row", season: 5, appearances: [12], goals: [7], assists: [4],
    averageRating: [8], ovr: [90], leagueStrength: [90],
    seasonStats: { season: 5, appearances: [12], goals: [7], assists: [4], averageRating: [8], ovr: [90] }
  },
  {
    id: "symbol-season-stat-row", season: 5, appearances: Symbol("bad-apps"),
    goals: Symbol("bad-goals"), assists: Symbol("bad-assists"),
    averageRating: Symbol("bad-rating"), ovr: Symbol("bad-ovr"), leagueStrength: Symbol("bad-strength"),
    seasonStats: { season: 5, appearances: Symbol("bad-saved-apps"), goals: Symbol("bad-saved-goals") }
  }
];
const malformedSavedLeaders = ai.leaderboard(malformedSavedSeasonSave, { season: 5, progress: 1 }, db);
assert.equal(malformedSavedLeaders.length, 2);
for (const row of malformedSavedLeaders) {
  assert.equal(row.appearances, 0);
  assert.equal(row.goals, 0);
  assert.equal(row.assists, 0);
  assert.equal(row.averageRating, 0);
  assert.equal(row.score, 0);
  assert.equal(row.weightedGoals, 0);
  assert.ok(Number.isFinite(row.ovr) && Number.isFinite(row.leagueStrength));
  assert.equal(row.seasonStats.appearances, 0);
  assert.equal(row.seasonStats.goals, 0);
}

const egyptLeaders = ai.leaderboard(save, { season: 1, progress: 1, country: "مصر", leagueId: "egypt", division: 1 }, db);
assert.ok(egyptLeaders.length > 0, "persistent stats must feed league leaderboards");
assert.ok(egyptLeaders.some(row => row.goals > 0 || row.assists > 0), "the simulation should generate real statistical variation");
const table = ai.getLeagueTable(save, "egypt", 1, db);
assert.ok(table.length >= 3, "league table must include the available clubs for the selected league");
assert.equal(table[0].rank, 1);
assert.ok(table.every((row, index) => row.rank === index + 1 && row.played > 0 && Number.isFinite(row.pts)));
function assertBalancedLeagueTable(rows, label) {
  const total = key => rows.reduce((sum, row) => sum + Math.max(0, Number(row[key]) || 0), 0);
  assert.ok(rows.length >= 2, label + " must contain at least two clubs");
  assert.equal(total("w"), total("l"), label + " must balance every win with a loss");
  assert.equal(total("gf"), total("ga"), label + " must balance goals scored with goals conceded");
  assert.ok(rows.every(row => Number(row.played) === Number(row.w) + Number(row.d) + Number(row.l)),
    label + " must reconcile each club's played, wins, draws and losses");
  assert.equal(new Set(rows.map(row => Number(row.played))).size, 1,
    label + " must give every club the same number of fixtures");
}
assertBalancedLeagueTable(table, "Egyptian Premier League");

const oddTable = ai.getLeagueTable(save, "tunisia", 1, db);
assert.equal(oddTable.length, 15, "the Tunisian top flight must retain its 15 real clubs");
assertBalancedLeagueTable(oddTable, "Fifteen-club Tunisian league");
assert.ok(oddTable[0].played > 0,
  "an odd-sized league must produce a complete schedule without phantom byes");

const secondTierCounts = new Map();
for (const club of Object.values(world.clubs)) {
  if (!club || Number(club.division) !== 2 || !club.leagueId) continue;
  const leagueId = String(club.leagueId);
  secondTierCounts.set(leagueId, (secondTierCounts.get(leagueId) || 0) + 1);
}
const [secondTierLeagueId, expectedSecondTierCount] =
  Array.from(secondTierCounts.entries()).sort((a, b) => b[1] - a[1])[0] || ["", 0];
assert.ok(expectedSecondTierCount >= 3,
  "the world database must expose at least three real second-tier clubs for promotion/relegation");
const baseFallbackClubs = Object.fromEntries(Object.entries(world.clubs).filter(([, club]) =>
  String(club.leagueId) === secondTierLeagueId && [1, 2].includes(Number(club.division))));
const baseFallbackWorld = {
  ...world,
  clubs: baseFallbackClubs,
  players: {}, completedSeasons: [], seasonStats: {}, leagueTables: {},
  transfers: [], marketReports: [], playerHistory: {}, currentSeason: 1,
  lastCompletedSeason: 0, lastAdvancedTo: 0, transferSequence: 0,
  projectionRevision: 0, notes: [], archive: {},
  dbVersion: Number(db.version) || Number(world.dbVersion) || 0,
  rosterSchemaVersion: 3,
  rosterMembershipSchemaVersion: Number(world.rosterMembershipSchemaVersion) || 0
};
delete baseFallbackWorld.matchesBySeason;
const baseFallbackSave = { season: 1, worldSimulation: baseFallbackWorld };
const baseFallbackSeason = ai.completeSeason(baseFallbackSave, 1, db);
const secondTierTable = baseFallbackSeason.tables[secondTierLeagueId + ":2"] || [];
assert.equal(secondTierTable.length, expectedSecondTierCount,
  "base season completion must save every available real second-division club");
assertBalancedLeagueTable(secondTierTable, "Largest available second division");
assert.ok(secondTierTable.every(row => row.leagueId === secondTierLeagueId && row.division === 2),
  "second-tier rows must retain their parent league ID and division number");
const firstTierTable = baseFallbackSeason.tables[secondTierLeagueId] || [];
assert.ok(firstTierTable.length >= 6, "promotion fixture must include a complete first-tier table");
const expectedRelegationSlots = firstTierTable.length < 6 || secondTierTable.length < 3
  ? 0
  : Math.min(2, Math.max(1, Math.floor(secondTierTable.length * 0.15)),
    Math.max(1, Math.floor(firstTierTable.length * 0.1)));
const relegatedFirstTierRows = firstTierTable.filter(row => row.status === "منطقة الهبوط — محاكاة");
const expectedRelegatedClubIds = expectedRelegationSlots > 0
  ? firstTierTable.slice(-expectedRelegationSlots).map(row => row.clubId).sort()
  : [];
assert.equal(relegatedFirstTierRows.length, expectedRelegationSlots,
  "first-tier relegation labels must match the shared promotion/relegation eligibility rule");
assert.deepEqual(relegatedFirstTierRows.map(row => row.clubId).sort(), expectedRelegatedClubIds,
  "only the eligible bottom first-tier clubs should be labelled for relegation");
assert.ok(secondTierTable.every(row => row.status !== "منطقة الهبوط — محاكاة"),
  "second-tier clubs must never be labelled as relegated when no third tier is simulated");
assert.equal(secondTierTable[1].status,
  expectedRelegationSlots > 1 ? "منافس على الصعود — محاكاة" : "مركز الدرجة الثانية",
  "the second-tier runner-up should be a promotion contender only when a second promotion slot is eligible");
const firstTierOnlyClubs = Object.fromEntries(Object.entries(baseFallbackClubs).filter(([, club]) => Number(club.division) === 1));
const firstTierOnlyWorld = {
  ...baseFallbackWorld, clubs: firstTierOnlyClubs, players: {},
  completedSeasons: [], seasonStats: {}, leagueTables: {}, matchesBySeason: {},
  currentSeason: 1, lastCompletedSeason: 0, lastAdvancedTo: 0
};
const firstTierOnlyResult = ai.completeSeason({ season: 1, worldSimulation: firstTierOnlyWorld }, 1, db);
const firstTierOnlyTable = firstTierOnlyResult.tables[secondTierLeagueId] || [];
assert.ok(firstTierOnlyTable.slice(-2).every(row => row.status === "مركز الدوري"),
  "first-tier clubs must not be labelled for relegation when no playable second division exists");

// Promotion places must not be advertised when the first tier lacks the six clubs
// required by the same rule that commits promotion/relegation at season transition.
const shortFirstTierEntries = Object.entries(baseFallbackClubs).filter(([, club]) => Number(club.division) === 1).slice(0, 5);
const shortSecondTierEntries = Object.entries(baseFallbackClubs).filter(([, club]) => Number(club.division) === 2).slice(0, 3);
assert.equal(shortFirstTierEntries.length, 5, "the incomplete-promotion fixture must contain five real first-tier clubs");
assert.equal(shortSecondTierEntries.length, 3, "the incomplete-promotion fixture must contain three real second-tier clubs");
const incompletePromotionClubs = Object.fromEntries(shortFirstTierEntries.concat(shortSecondTierEntries));
const incompletePromotionWorld = {
  ...baseFallbackWorld, clubs: incompletePromotionClubs, players: {},
  completedSeasons: [], seasonStats: {}, leagueTables: {}, matchesBySeason: {},
  competitionsBySeason: {}, currentSeason: 1, lastCompletedSeason: 0, lastAdvancedTo: 0
};
const incompletePromotionResult = ai.completeSeason({ season: 1, worldSimulation: incompletePromotionWorld }, 1, db);
const incompletePromotionFirst = incompletePromotionResult.tables[secondTierLeagueId] || [];
const incompletePromotionSecond = incompletePromotionResult.tables[secondTierLeagueId + ":2"] || [];
assert.ok(incompletePromotionFirst.every(row => row.status !== "منطقة الهبوط — محاكاة"),
  "a first tier with only five eligible clubs must not advertise relegation places");
assert.equal(incompletePromotionSecond[0].status, "بطل الدرجة الثانية",
  "a second-tier champion must not be labelled as automatically promoted when the first tier is too small");
assert.ok(incompletePromotionSecond.every(row => row.status !== "منافس على الصعود — محاكاة"),
  "an incomplete first tier must not advertise any second-tier promotion contenders");
assert.equal(typeof sandbox.window.__lwTestSimulateLeagueSeason, "function",
  "the match-based season simulator must be available for identical division-status regression coverage");
const matchPromotionWorld = JSON.parse(JSON.stringify(incompletePromotionWorld));
matchPromotionWorld.completedSeasons = [];
matchPromotionWorld.matchesBySeason = {};
matchPromotionWorld.leagueTables = {};
matchPromotionWorld.seasonStats = {};
matchPromotionWorld.competitionsBySeason = {};
const incompleteMatchPromotion = sandbox.window.__lwTestSimulateLeagueSeason(
  { season: 1, worldSimulation: matchPromotionWorld }, 1, db
);
const incompleteMatchSecond = incompleteMatchPromotion.tables[secondTierLeagueId + ":2"] || [];
assert.equal(incompleteMatchSecond[0].status, "بطل الدرجة الثانية",
  "the match-based simulator must not advertise automatic promotion without six first-tier clubs");
assert.ok(incompleteMatchSecond.every(row => row.status !== "منافس على الصعود — محاكاة"),
  "the match-based simulator must apply the same unavailable-promotion status");

// The legacy stats/table simulator defaults a missing club division to tier one.
// The match-based simulator must use that same fallback rather than silently
// dropping the club from every fixture and its final standings.
const legacyDivisionMatchWorld = JSON.parse(JSON.stringify(incompletePromotionWorld));
legacyDivisionMatchWorld.completedSeasons = [];
legacyDivisionMatchWorld.matchesBySeason = {};
legacyDivisionMatchWorld.leagueTables = {};
legacyDivisionMatchWorld.seasonStats = {};
legacyDivisionMatchWorld.competitionsBySeason = {};
const legacyMissingDivisionClubId = shortFirstTierEntries[0][0];
delete legacyDivisionMatchWorld.clubs[legacyMissingDivisionClubId].division;
const legacyDivisionMatchResult = sandbox.window.__lwTestSimulateLeagueSeason(
  { season: 1, worldSimulation: legacyDivisionMatchWorld }, 1, db
);
const legacyDivisionFirstTable = legacyDivisionMatchResult.tables[secondTierLeagueId] || [];
assert.equal(legacyDivisionFirstTable.length, shortFirstTierEntries.length,
  "match simulation must retain every first-tier club from a legacy save with a missing division");
assert.ok(legacyDivisionFirstTable.some(row => row.clubId === legacyMissingDivisionClubId),
  "a legacy club without division metadata must still appear in the first-tier standings");
const matchExpansionWorld = {
  clubs: {
    home: { id: "home", name: "Home Club" },
    away: { id: "away", name: "Away Club" }
  }
};
const expandedValidMatch = sandbox.window.__lwTestExpandWorldMatches(matchExpansionWorld, [{
  season: "5", competitionId: "league", division: "2", matchday: "7",
  homeClubId: "home", awayClubId: "away", homeGoals: "3", awayGoals: "1"
}]);
assert.equal(expandedValidMatch.length, 1,
  "valid legacy numeric-string match records must still expand");
assert.equal(expandedValidMatch[0].season, 5);
assert.equal(expandedValidMatch[0].division, 2);
assert.equal(expandedValidMatch[0].matchday, 7);
assert.equal(expandedValidMatch[0].home, "Home Club");
assert.equal(expandedValidMatch[0].away, "Away Club");
assert.equal(expandedValidMatch[0].result, "home-win");
const expandedLegacyMatch = sandbox.window.__lwTestExpandWorldMatches(matchExpansionWorld, [{
  homeClubId: "home", awayClubId: "away", homeGoals: 0, awayGoals: 0
}]);
assert.equal(expandedLegacyMatch.length, 1);
assert.equal(expandedLegacyMatch[0].division, 1,
  "legacy match records without a division must retain the first-tier fallback");

const expectedSeasonLegacyMatch = sandbox.window.__lwTestExpandWorldMatches(matchExpansionWorld, [{
  homeClubId: "home", awayClubId: "away", homeGoals: 0, awayGoals: 0
}], 8);
assert.equal(expectedSeasonLegacyMatch.length, 1);
assert.equal(expectedSeasonLegacyMatch[0].season, 8,
  "legacy match snapshots without a season must inherit their containing season key");

const invalidSavedMatchDivisions = [
  [1], 0, -1, 1.5, "not-a-division", Symbol("invalid-division"),
  { valueOf() { throw new Error("hostile saved match division"); } }
];
for (const invalidDivision of invalidSavedMatchDivisions) {
  const invalidDivisionRows = sandbox.window.__lwTestExpandWorldMatches(matchExpansionWorld, [{
    season: 5, division: invalidDivision, matchday: 1,
    homeClubId: "home", awayClubId: "away", homeGoals: 0, awayGoals: 0
  }], 5);
  assert.equal(invalidDivisionRows.length, 0,
    "explicit malformed match divisions must be rejected instead of being exposed as division zero");
}

const invalidCompetitionRows = sandbox.window.__lwTestExpandWorldMatches(matchExpansionWorld, [{
  season: 5, division: 1, matchday: 1, competitionId: [],
  homeClubId: "home", awayClubId: "away", homeGoals: 0, awayGoals: 0
}], 5);
assert.equal(invalidCompetitionRows.length, 0,
  "an explicit malformed competition identifier must not silently become a league match");
const selfFixtureRows = sandbox.window.__lwTestExpandWorldMatches(matchExpansionWorld, [{
  season: 5, division: 1, matchday: 1,
  homeClubId: "home", awayClubId: "home", homeGoals: 0, awayGoals: 0
}], 5);
assert.equal(selfFixtureRows.length, 0,
  "a club must never be expanded as both sides of the same fixture");

const seasonScopedMatches = sandbox.window.__lwTestExpandWorldMatches(matchExpansionWorld, [
  { season: 5, division: 1, matchday: 1, homeClubId: "home", awayClubId: "away", homeGoals: 1, awayGoals: 0 },
  { season: 6, division: 1, matchday: 1, homeClubId: "home", awayClubId: "away", homeGoals: 2, awayGoals: 0 }
], 5);
assert.equal(seasonScopedMatches.length, 1,
  "a season snapshot must not leak fixtures belonging to a different season");

const distinctFixtureIds = sandbox.window.__lwTestExpandWorldMatches(matchExpansionWorld, [
  { season: 5, competitionId: "league", division: 1, matchday: 7, homeClubId: "home", awayClubId: "away", homeGoals: 1, awayGoals: 0 },
  { season: 5, competitionId: "league", division: 2, matchday: 7, homeClubId: "home", awayClubId: "away", homeGoals: 1, awayGoals: 0 },
  { season: 5, competitionId: "cup", division: 1, matchday: 7, homeClubId: "home", awayClubId: "away", homeGoals: 1, awayGoals: 0 }
], 5);
assert.equal(new Set(distinctFixtureIds.map(match => match.id)).size, 3,
  "fixture IDs must distinguish season, competition, and division context");
for (const malformedContainer of [null, undefined, {}, "not-an-array", 7, Symbol("matches")]) {
  assert.equal(sandbox.window.__lwTestExpandWorldMatches(matchExpansionWorld, malformedContainer).length, 0,
    "non-array saved match containers must safely expand to an empty list");
}
const hostileMatch = {
  season: 5, matchday: 1, awayClubId: "away", homeGoals: 0, awayGoals: 0,
  get homeClubId() { throw new Error("hostile saved match getter"); }
};
const malformedMatchRows = [
  null, undefined, "not-a-match", 7, Symbol("not-a-match"), [],
  { season: Symbol("season"), matchday: 1, homeClubId: "home", awayClubId: "away" },
  { season: 5, matchday: Symbol("matchday"), homeClubId: "home", awayClubId: "away" },
  { season: 5, matchday: 1, homeClubId: Symbol("club-id"), awayClubId: "away" },
  { season: 5, matchday: 1, homeClubId: "home", awayClubId: "away", homeGoals: Symbol("goals"), awayGoals: 0 },
  { season: 5, matchday: 1, homeClubId: { toString() { throw new Error("hostile club id"); } }, awayClubId: "away" },
  hostileMatch
];
const expandedMixedMatches = sandbox.window.__lwTestExpandWorldMatches(
  matchExpansionWorld, [expandedValidMatch[0], ...malformedMatchRows]
);
assert.equal(expandedMixedMatches.length, 1,
  "malformed match rows and hostile fields must be skipped without discarding valid history");

const malformedSeasonSnapshotWorld = JSON.parse(JSON.stringify(legacyDivisionMatchWorld));
malformedSeasonSnapshotWorld.matchesBySeason["1"] = { corrupt: true };
malformedSeasonSnapshotWorld.seasonStats["1"] = { corrupt: true };
malformedSeasonSnapshotWorld.leagueTables["1"] = [];
malformedSeasonSnapshotWorld.competitionsBySeason["1"] = { corrupt: true };
const malformedSeasonSnapshot = sandbox.window.__lwTestSimulateLeagueSeason(
  { season: 1, worldSimulation: malformedSeasonSnapshotWorld }, 1, db
);
assert.deepEqual(Array.from(malformedSeasonSnapshot.rows), [],
  "a malformed saved season-stat container must not escape as a non-array");
assert.equal(Object.keys(malformedSeasonSnapshot.tables).length, 0,
  "a malformed saved league-table container must not escape as an array");
assert.deepEqual(Array.from(malformedSeasonSnapshot.matches), [],
  "a malformed saved match container must not crash completed-season loading");
assert.deepEqual(Array.from(malformedSeasonSnapshot.competitions), [],
  "a malformed saved competition container must not escape as a non-array");


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
  const retainedClubHistory = world.transferClubHistoryByPlayer[move.playerId] || [];
  assert.ok(retainedClubHistory.some(row => String(row.clubId || "") === String(move.toClubId || player.clubId)),
    "each completed transfer must persist its destination independently of the rolling ledger");
  if (move.fromClubId) assert.ok(retainedClubHistory.some(row => String(row.clubId || "") === String(move.fromClubId)),
    "each completed transfer must persist its former club independently of the rolling ledger");
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

// A failed paid market can be retried after player development has already run.
// The same season must not age players or decrement their contracts a second time.
const developmentRetryPlayerId = "development-retry-player";
const developmentRetryWorld = {
  players: {
    [developmentRetryPlayerId]: {
      id: developmentRetryPlayerId, name: "Development Retry Player",
      clubId: "development-retry-club", age: 22, contractSeasons: 3,
      ovr: 70, potential: 80, position: "ST", group: "attacker",
      retired: false, freeAgent: false, transferListed: false, lastRating: 0
    }
  },
  clubs: {
    "development-retry-club": {
      id: "development-retry-club", name: "Development Retry Club",
      power: 70, roster: [developmentRetryPlayerId]
    }
  },
  seasonStats: { "4": [{ id: developmentRetryPlayerId, appearances: 20, averageRating: 7.5 }] },
  notes: [], lastDevelopedSeason: 0
};
sandbox.window.__lwTestDevelopPlayers(developmentRetryWorld, 4);
const developmentRetryFirstResult = JSON.stringify(developmentRetryWorld);
assert.equal(developmentRetryWorld.players[developmentRetryPlayerId].age, 23);
assert.equal(developmentRetryWorld.players[developmentRetryPlayerId].contractSeasons, 2);
assert.equal(developmentRetryWorld.players[developmentRetryPlayerId].ovr, 72);
sandbox.window.__lwTestDevelopPlayers(developmentRetryWorld, 4);
assert.equal(JSON.stringify(developmentRetryWorld), developmentRetryFirstResult,
  "retrying a failed season transition must not repeat player aging, development, or contract deductions");
sandbox.window.__lwTestDevelopPlayers(developmentRetryWorld, 5);
assert.equal(developmentRetryWorld.players[developmentRetryPlayerId].age, 24,
  "the development marker must still allow the following season to progress");
assert.equal(developmentRetryWorld.players[developmentRetryPlayerId].contractSeasons, 1);

// Malformed saved player numerics must not interrupt season aging, contract expiry or retirement checks.
const malformedProgressionPlayerId = "malformed-progression-player";
const legacyNullProgressionPlayerId = "legacy-null-progression-player";
const previousClubFreeAgentId = 9101;
const malformedProgressionWorld = {
  players: {
    "previous-club-free-agent-player": {
      id: previousClubFreeAgentId, name: "Previous Club Free Agent",
      clubId: "", leagueId: "", division: 0, age: 25, contractSeasons: 0,
      ovr: 65, potential: 70, lastRating: 7, position: "ST", group: "attacker",
      retired: false, freeAgent: true, freeAgentSince: 1,
      previousClubId: "previous-free-agent-club", transferListed: false
    },
    [legacyNullProgressionPlayerId]: {
      id: legacyNullProgressionPlayerId, name: "Legacy Null Progression Player",
      clubId: "", age: null, contractSeasons: null, ovr: null, potential: null, lastRating: null,
      position: "ST", group: "attacker", retired: false, freeAgent: true
    },
    [malformedProgressionPlayerId]: {
      id: malformedProgressionPlayerId, name: "Malformed Progression Player",
      clubId: "malformed-progression-club", leagueId: "malformed-progression-league",
      division: Symbol("division"), age: Symbol("age"), contractSeasons: Symbol("contract"),
      ovr: Symbol("ovr"), potential: Symbol("potential"), lastRating: Symbol("last-rating"),
      position: "ST", group: "attacker", retired: false, freeAgent: true,
      freeAgentSince: Symbol("free-agent-since"), transferListed: true
    }
  },
  clubs: {
    "malformed-progression-club": {
      id: "malformed-progression-club", name: "Malformed Progression Club",
      country: "Testland", leagueId: "malformed-progression-league", division: 1,
      power: 60, roster: [malformedProgressionPlayerId]
    },
    "previous-free-agent-club": {
      id: "previous-free-agent-club", name: "Previous Free Agent Club",
      country: "Testland", leagueId: "previous-free-agent-league", division: 1,
      power: 60, roster: [previousClubFreeAgentId, String(previousClubFreeAgentId), "keep-player"]
    }
  },
  seasonStats: {
    "1": [
      { id: malformedProgressionPlayerId, appearances: Symbol("appearances"), averageRating: Symbol("rating") },
      { id: legacyNullProgressionPlayerId, appearances: null, averageRating: null }
    ]
  },
  notes: [], lastDevelopedSeason: Symbol("last-developed-season")
};
assert.doesNotThrow(() => sandbox.window.__lwTestDevelopPlayers(malformedProgressionWorld, 1),
  "malformed world-player age, contract, rating and free-agent fields must not crash season development");
const malformedProgressionPlayer = malformedProgressionWorld.players[malformedProgressionPlayerId];
assert.equal(malformedProgressionPlayer.age, 19);
assert.equal(malformedProgressionPlayer.contractSeasons, 0);
assert.equal(malformedProgressionPlayer.lastRating, 0);
assert.equal(malformedProgressionPlayer.ovr, 35);
assert.equal(malformedProgressionPlayer.potential, 35);
assert.equal(malformedProgressionPlayer.clubId, "");
assert.deepEqual(malformedProgressionWorld.clubs["malformed-progression-club"].roster, [], "a free agent must be removed from the former club roster");
const previousClubFreeAgent = malformedProgressionWorld.players["previous-club-free-agent-player"];
assert.equal(previousClubFreeAgent.clubId, "", "a free agent with a cleared club link must remain unattached");
assert.equal(previousClubFreeAgent.previousClubId, "previous-free-agent-club", "former-club history must be preserved");
assert.equal(previousClubFreeAgent.freeAgent, true);
assert.deepEqual(malformedProgressionWorld.clubs["previous-free-agent-club"].roster, ["keep-player"],
  "a free agent with a cleared clubId must be removed from its previous club roster, including numeric legacy roster IDs");
assert.ok(malformedProgressionWorld.players["previous-club-free-agent-player"],
  "roster cleanup must not delete the free-agent player record");
assert.equal(malformedProgressionPlayer.division, 0);
assert.equal(malformedProgressionPlayer.freeAgent, true);
assert.equal(malformedProgressionPlayer.freeAgentSince, 2);
assert.equal(malformedProgressionWorld.lastDevelopedSeason, 1);
const legacyNullProgressionPlayer = malformedProgressionWorld.players[legacyNullProgressionPlayerId];
assert.equal(legacyNullProgressionPlayer.age, 19, "null legacy ages must retain the existing 18-year fallback");
assert.equal(legacyNullProgressionPlayer.contractSeasons, 0, "null legacy contract terms must retain the existing one-season fallback");
assert.equal(legacyNullProgressionPlayer.lastRating, 0);
assert.equal(legacyNullProgressionPlayer.ovr, 35);
assert.equal(legacyNullProgressionPlayer.potential, 35);

// A free-agent history write can fail after the paid market has advanced the world.
// The failed free-agent phase must be retryable without replaying player development.
const retrySeasonClubId = "retry-season-recovery-club";
const retrySeasonCountry = String(rosterMigrationLeague.country || "Testland");
const retrySeasonPlayers = {};
const retrySeasonRoster = [];
const retrySeasonRoles = [
  { id: "retry-season-keeper", group: "goalkeeper", position: "حارس مرمى", age: 22 },
  ...Array.from({ length: 6 }, (_, i) => ({ id: "retry-season-def-" + i, group: "defender", position: "قلب دفاع", age: 24 })),
  ...Array.from({ length: 5 }, (_, i) => ({ id: "retry-season-mid-" + i, group: "midfielder", position: "وسط مهاجم", age: 24 })),
  ...Array.from({ length: 5 }, (_, i) => ({ id: "retry-season-att-" + i, group: "attacker", position: "رأس حربة", age: 24 }))
];
retrySeasonRoles.forEach((row, index) => {
  retrySeasonPlayers[row.id] = {
    id: row.id, name: "Retry Season Player " + index, clubId: retrySeasonClubId,
    country: retrySeasonCountry, leagueId: rosterMigrationLeagueId, division: 1,
    position: row.position, group: row.group, ovr: 60 + (index % 5),
    potential: 72 + (index % 5), age: row.age, contractSeasons: 3,
    retired: false, freeAgent: false, transferListed: false, isGenerated: true
  };
  retrySeasonRoster.push(row.id);
});
const retryFreeAgentId = "retry-season-free-agent";
retrySeasonPlayers[retryFreeAgentId] = {
  id: retryFreeAgentId, name: "Retry Season Free Agent", clubId: "",
  country: retrySeasonCountry, leagueId: "", division: 0,
  position: "حارس مرمى", group: "goalkeeper", ovr: 60, potential: 70,
  age: 25, contractSeasons: 0, retired: false, freeAgent: true,
  freeAgentSince: 1, previousClubId: "missing-former-club", transferListed: false
};
let failRetryFreeAgentHistoryWrite = true;
const retryTransferHistoryBacking = {};
const retryTransferHistory = new Proxy(retryTransferHistoryBacking, {
  set(target, key, value) {
    target[key] = value;
    if (failRetryFreeAgentHistoryWrite) {
      failRetryFreeAgentHistoryWrite = false;
      throw new Error("forced retry free-agent history failure");
    }
    return true;
  }
});
const retrySeasonWorld = {
  schemaVersion: ai.version, dbVersion: Number(db.version) || 0,
  currentSeason: 1, lastCompletedSeason: 0, lastAdvancedTo: 0,
  lastDevelopedSeason: 0, lastFreeAgentMarketSeason: 0,
  rosterSchemaVersion: 3, rosterMembershipSchemaVersion: 6,
  clubs: {
    [retrySeasonClubId]: {
      id: retrySeasonClubId, name: "Retry Season Recovery Club",
      country: retrySeasonCountry, leagueId: rosterMigrationLeagueId,
      division: 1, leagueName: String(rosterMigrationLeague.name || "Retry League"),
      leagueEnglish: String(rosterMigrationLeague.englishName || rosterMigrationLeague.name || "Retry League"),
      matchesPerSeason: 30, power: 60, basePower: 60, prestige: 50,
      budget: 0, currency: "€", updatedSeason: 1, roster: retrySeasonRoster
    }
  },
  players: retrySeasonPlayers, playerHistory: {},
  transferClubHistoryByPlayer: retryTransferHistory, transferClubHistorySchemaVersion: 1,
  seasonStats: {}, leagueTables: {}, completedSeasons: [],
  matchesBySeason: {}, competitionsBySeason: {}, promotionHistory: [],
  transfers: [], marketReports: [], notes: [],
  nextGeneratedPlayer: 1, transferSequence: 0, projectionRevision: 0
};
const retrySeasonSave = { season: 1, worldSimulation: retrySeasonWorld };
const retrySeasonKeeper = retrySeasonWorld.players["retry-season-keeper"];
assert.throws(() => ai.advanceToSeason(retrySeasonSave, 2, db),
  /forced retry free-agent history failure/,
  "a failed free-agent endpoint write must surface instead of silently losing the signing phase");
assert.equal(retrySeasonWorld.currentSeason, 2,
  "the paid market may already have advanced the world before free-agent recruitment fails");
assert.equal(retrySeasonWorld.lastDevelopedSeason, 1,
  "the completed player-development phase must be recorded before the market retry");
assert.equal(retrySeasonKeeper.age, 23);
assert.equal(retrySeasonKeeper.contractSeasons, 2);
assert.equal(retrySeasonWorld.lastFreeAgentMarketSeason, 0,
  "a failed free-agent phase must remain marked as pending");
assert.equal(retrySeasonWorld.players[retryFreeAgentId].clubId, "",
  "a failed free-agent transaction must restore the unattached player");
const earlyRetrySeason = sandbox.window.__lwTestSimulateLeagueSeason(retrySeasonSave, 2, db);
assert.ok(!earlyRetrySeason.rows.some(row => row.id === retryFreeAgentId),
  "an unattached free agent must not appear in a season snapshot generated before the market retry");
assert.ok(Object.prototype.hasOwnProperty.call(retrySeasonWorld.matchesBySeason, "2"),
  "the recovery fixture must materialize the pending season snapshot before retry");
const projectionRevisionBeforeFreeAgentRetry = retrySeasonWorld.projectionRevision;
const retriedSeasonTransition = ai.advanceToSeason(retrySeasonSave, 2, db);
assert.equal(retriedSeasonTransition.alreadyAdvanced, true,
  "retrying the same season must resume the unfinished free-agent phase without replaying the paid market");
assert.equal(retrySeasonWorld.lastFreeAgentMarketSeason, 2);
assert.equal(retrySeasonWorld.players[retryFreeAgentId].clubId, retrySeasonClubId,
  "the free agent must sign successfully when the failed phase is retried");
assert.ok(retrySeasonWorld.projectionRevision > projectionRevisionBeforeFreeAgentRetry,
  "a retried free-agent signing must invalidate cached world-season projections");
assert.equal(Object.prototype.hasOwnProperty.call(retrySeasonWorld.matchesBySeason, "2"), false,
  "a retried free-agent signing must discard stale fixtures from the still-uncompleted season");
assert.equal(Object.prototype.hasOwnProperty.call(retrySeasonWorld.seasonStats, "2"), false,
  "a retried free-agent signing must discard stale player statistics from the still-uncompleted season");
const refreshedRetrySeason = sandbox.window.__lwTestSimulateLeagueSeason(retrySeasonSave, 2, db);
const refreshedFreeAgentRow = refreshedRetrySeason.rows.find(row => row.id === retryFreeAgentId);
assert.ok(refreshedFreeAgentRow && refreshedFreeAgentRow.clubId === retrySeasonClubId,
  "regenerating the pending season must include the newly signed free agent at the destination club");
assert.equal(retrySeasonKeeper.age, 23,
  "retrying the free-agent phase must not age already-developed players again");
assert.equal(retrySeasonKeeper.contractSeasons, 2,
  "retrying the free-agent phase must not deduct another contract season");
assert.equal(retrySeasonWorld.transfers.filter(move => move.playerId === retryFreeAgentId).length, 1,
  "the retried free-agent signing must be recorded exactly once");
const completedRetrySeason = ai.advanceToSeason(retrySeasonSave, 2, db);
assert.equal(completedRetrySeason.alreadyAdvanced, true);
assert.equal(retrySeasonWorld.transfers.filter(move => move.playerId === retryFreeAgentId).length, 1,
  "reopening a completed market must not sign the same free agent twice");



 // A retry after the paid market committed must reconstruct its saved move IDs.
 // Both clubs from that paid deal remain reserved, so the free agent can only join
 // a third eligible club rather than making a second move for either participant.
const reservedMarketCountry = retrySeasonCountry;
const reservedMarketClubIds = ["retry-reserved-seller", "retry-reserved-buyer", "retry-unreserved-buyer"];
const reservedMarketPlayers = {};
const reservedMarketClubs = {};
reservedMarketClubIds.forEach((clubId, clubIndex) => {
  const roster = [];
  const roleRows = [
    { group: "goalkeeper", position: "حارس مرمى" },
    ...Array.from({ length: 6 }, () => ({ group: "defender", position: "قلب دفاع" })),
    ...Array.from({ length: 5 }, () => ({ group: "midfielder", position: "وسط مهاجم" })),
    ...Array.from({ length: 5 }, () => ({ group: "attacker", position: "رأس حربة" }))
  ];
  roleRows.forEach((row, playerIndex) => {
    const id = clubId + "-player-" + playerIndex;
    reservedMarketPlayers[id] = {
      id, name: clubId + " Player " + playerIndex, clubId,
      country: reservedMarketCountry, leagueId: rosterMigrationLeagueId, division: 1,
      group: row.group, position: row.position, ovr: 60 + (playerIndex % 4),
      potential: 72 + (playerIndex % 4), age: 24, contractSeasons: 3,
      retired: false, freeAgent: false, transferListed: false
    };
    roster.push(id);
  });
  reservedMarketClubs[clubId] = {
    id: clubId, name: ["Reserved Seller", "Reserved Buyer", "Unreserved Buyer"][clubIndex],
    country: reservedMarketCountry, leagueId: rosterMigrationLeagueId, division: 1,
    power: 60, basePower: 60, prestige: 50, budget: 0, currency: "€",
    roster
  };
});
const reservedPaidMoveId = "retry-reserved-paid-move";
const reservedFreeAgentId = "retry-reserved-free-agent";
reservedMarketPlayers[reservedFreeAgentId] = {
  id: reservedFreeAgentId, name: "Reserved Market Free Agent", clubId: "",
  country: reservedMarketCountry, leagueId: "", division: 0,
  position: "حارس مرمى", group: "goalkeeper", ovr: 60, potential: 70,
  age: 25, contractSeasons: 0, retired: false, freeAgent: true,
  freeAgentSince: 1, previousClubId: "missing-reserved-former-club", transferListed: false
};
let failReservedHistoryWrite = true;
const reservedHistoryBacking = {};
const reservedHistory = new Proxy(reservedHistoryBacking, {
  set(target, key, value) {
    target[key] = value;
    if (failReservedHistoryWrite) {
      failReservedHistoryWrite = false;
      throw new Error("forced reserved market history failure");
    }
    return true;
  }
});
const reservedMarketWorld = {
  schemaVersion: ai.version, dbVersion: Number(db.version) || 0,
  currentSeason: 2, lastCompletedSeason: 1, lastAdvancedTo: 2,
  lastDevelopedSeason: 1, lastFreeAgentMarketSeason: 1,
  rosterSchemaVersion: 3, rosterMembershipSchemaVersion: 6,
  clubs: reservedMarketClubs, players: reservedMarketPlayers,
  playerHistory: {}, transferClubHistoryByPlayer: reservedHistory,
  transferClubHistorySchemaVersion: 1,
  seasonStats: { "1": [] }, leagueTables: {}, completedSeasons: [1],
  matchesBySeason: {}, competitionsBySeason: {}, promotionHistory: [{ season: 2, moves: [] }],
  transfers: [{
    id: reservedPaidMoveId, season: 2, playerId: "reserved-paid-player",
    from: "Reserved Seller", fromCountry: reservedMarketCountry,
    fromClubId: "retry-reserved-seller",
    to: "Reserved Buyer", toCountry: reservedMarketCountry,
    toClubId: "retry-reserved-buyer", kind: "انتقال محاكاة"
  }],
  marketReports: [
    null,
    { season: [2], moves: [99], transferIds: ["malformed-reserved-market-id"] },
    { season: 2, moves: 1, transferIds: [reservedPaidMoveId], summary: "existing paid market report" }
  ],
  notes: [], nextGeneratedPlayer: 1, transferSequence: 1, projectionRevision: 1
};
const reservedMarketSave = { season: 2, worldSimulation: reservedMarketWorld };
assert.throws(() => ai.advanceToSeason(reservedMarketSave, 2, db),
  /forced reserved market history failure/,
  "the saved paid-market recovery fixture must fail once during the free-agent history write");
assert.equal(reservedMarketWorld.lastFreeAgentMarketSeason, 1);
const reservedMarketRetry = ai.advanceToSeason(reservedMarketSave, 2, db);
assert.equal(reservedMarketRetry.alreadyAdvanced, true);
assert.equal(reservedMarketWorld.players[reservedFreeAgentId].clubId, "retry-unreserved-buyer",
  "a retried free-agent phase must reserve both clubs from the already-committed paid deal");
assert.equal(reservedMarketWorld.players[reservedFreeAgentId].clubId === "retry-reserved-seller"
  || reservedMarketWorld.players[reservedFreeAgentId].clubId === "retry-reserved-buyer", false,
  "free-agent recovery must not allow a second move for either paid-deal participant");
const reservedMarketReport = reservedMarketWorld.marketReports.find(row => row
  && row.season === 2 && Array.isArray(row.transferIds) && row.transferIds.includes(reservedPaidMoveId));
assert.ok(reservedMarketReport, "retry must update the valid season-2 market report after skipping malformed rows");
assert.ok(reservedMarketReport.transferIds.includes(
  reservedMarketWorld.transfers.find(move => move.playerId === reservedFreeAgentId).id
));
assert.equal(reservedMarketWorld.transfers.filter(move => move.playerId === reservedFreeAgentId).length, 1,
  "reconstructed paid moves must not create duplicate free-agent signings");

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

const staleAdvanceTransferCount = projectionCacheWorld.transfers.length;
const staleAdvance = ai.advanceToSeason(projectionCacheSave, 1, db);
assert.equal(staleAdvance.alreadyAdvanced, true,
  "a stale request for an earlier season must be treated as already advanced");
assert.equal(staleAdvance.season, 2,
  "a stale season request must return the stable world season, not the requested old season");
assert.equal(projectionCacheWorld.currentSeason, 2,
  "replaying an earlier season must never move the world clock backwards");
assert.equal(projectionCacheWorld.lastAdvancedTo, 2,
  "a stale request must preserve the last applied transfer-window marker");
assert.equal(projectionCacheWorld.transfers.length, staleAdvanceTransferCount,
  "a stale season request must not create or remove transfer records");


 // The async wrapper must reject stale season requests before its own completion/promotion side effects.
 const staleWrapperSave = { season: 1, name: "Stale world-season wrapper regression" };
 const staleWrapperWorld = ai.ensureState(staleWrapperSave, db);
 const staleLeagueId = "scotland";
 assert.ok(db.leagues().some(profile => String(profile.id) === staleLeagueId),
   "the stale-season fixture must use a league supported by the current source catalogue");
 const staleFirstDivision = [], staleSecondDivision = [];
 for (let index = 0; index < 6; index++) {
   const id = "stale-season-first-" + index;
   staleWrapperWorld.clubs[id] = { id, name: id, country: "Testland", leagueId: staleLeagueId, division: 1, roster: [] };
   staleFirstDivision.push({ clubId: id, rank: index + 1 });
 }
 for (let index = 0; index < 3; index++) {
   const id = "stale-season-second-" + index;
   staleWrapperWorld.clubs[id] = { id, name: id, country: "Testland", leagueId: staleLeagueId, division: 2, roster: [] };
   staleSecondDivision.push({ clubId: id, rank: index + 1 });
 }
 staleWrapperWorld.currentSeason = 3;
 staleWrapperWorld.lastAdvancedTo = 0;
 staleWrapperWorld.lastCompletedSeason = 1;
 staleWrapperWorld.completedSeasons = [1];
 staleWrapperWorld.matchesBySeason = { "1": [] };
 staleWrapperWorld.seasonStats = { "1": [{ id: "season-one-snapshot", goals: 9 }] };
 staleWrapperWorld.leagueTables = { "1": {
   [staleLeagueId]: staleFirstDivision,
   [staleLeagueId + ":2"]: staleSecondDivision
 } };
 staleWrapperWorld.promotionHistory = [];
 staleWrapperWorld.notes = [];
 staleWrapperWorld.transfers = [];
 staleWrapperWorld.marketReports = [];
 const staleDivisionSnapshot = JSON.stringify(
   Object.values(staleWrapperWorld.clubs).filter(club => club.leagueId === staleLeagueId)
     .map(club => [club.id, club.division]).sort((a,b) => a[0].localeCompare(b[0]))
 );
 const staleTableSnapshot = JSON.stringify(staleWrapperWorld.leagueTables["1"]);
 const staleStatsSnapshot = JSON.stringify(staleWrapperWorld.seasonStats["1"]);

 // Direct completion requests must not reconstruct an older season from the current rosters.
 const staleCompletionResult = ai.completeSeason(staleWrapperSave, 2, db);
 assert.equal(staleCompletionResult.staleRequest, true, "a direct completion request for an older, unrecorded season must be rejected");
 assert.equal(staleCompletionResult.season, 3, "a stale completion must report the stable world season");
 assert.equal(staleWrapperWorld.currentSeason, 3, "a stale completion must not rewind the world clock");
 assert.deepEqual(staleWrapperWorld.completedSeasons, [1], "a stale completion must not mark the requested old season complete");
 assert.equal(Object.prototype.hasOwnProperty.call(staleWrapperWorld.matchesBySeason, "2"), false,
   "a stale completion must not generate fixtures from current rosters");
 assert.equal(Object.prototype.hasOwnProperty.call(staleWrapperWorld.seasonStats, "2"), false,
   "a stale completion must not fabricate historical player statistics");
 assert.equal(Object.prototype.hasOwnProperty.call(staleWrapperWorld.leagueTables, "2"), false,
   "a stale completion must not generate historical league tables");

 // A null report row must be skipped, an array-wrapped season must not impersonate
 // the requested year, and a numeric-string legacy report must remain readable.
 const staleRequestMarketWorld = JSON.parse(JSON.stringify(staleWrapperWorld));
 staleRequestMarketWorld.marketReports = [
   null,
   { season: [2], moves: [99], transferIds: ["malformed-market-row"] },
   { season: "2", moves: "3", transferIds: ["legacy-numeric-string-market-row"] }
 ];
 const staleRequestMarketSave = { ...staleWrapperSave, worldSimulation: staleRequestMarketWorld };
 const staleRequestMarketResult = ai.completeSeason(staleRequestMarketSave, 2, db);
 assert.equal(staleRequestMarketResult.staleRequest, true,
   "malformed market history must not turn a stale season completion into a live simulation");
 assert.equal(staleRequestMarketResult.transfers, 3,
   "market lookup must skip null/array season rows while preserving numeric-string report compatibility");

 const staleWrapperResult = ai.advanceToSeason(staleWrapperSave, 2, db);
 assert.equal(staleWrapperResult.alreadyAdvanced, true,
   "a request older than currentSeason must be rejected by the effective world wrapper");
 assert.equal(staleWrapperResult.season, 3, "a stale wrapper request must return the stable world season");
 assert.equal(staleWrapperWorld.currentSeason, 3, "a stale wrapper request must not rewind the world clock");
 assert.equal(staleWrapperWorld.lastAdvancedTo, 0, "a stale wrapper request must not rewrite a missing legacy transfer marker");
 assert.deepEqual(staleWrapperWorld.promotionHistory, [],
   "a stale wrapper request must not apply promotion/relegation to the current squads");
 assert.equal(JSON.stringify(Object.values(staleWrapperWorld.clubs)
   .filter(club => club.leagueId === staleLeagueId)
   .map(club => [club.id, club.division]).sort((a,b) => a[0].localeCompare(b[0]))), staleDivisionSnapshot,
   "a stale wrapper request must preserve every club's division");
 assert.equal(JSON.stringify(staleWrapperWorld.leagueTables["1"]), staleTableSnapshot,
   "a stale wrapper request must preserve archived league tables");
 assert.equal(JSON.stringify(staleWrapperWorld.seasonStats["1"]), staleStatsSnapshot,
   "a stale wrapper request must preserve saved player-season statistics");
 assert.deepEqual(staleWrapperWorld.notes, [], "a stale wrapper request must not append promotion or market notes");
 assert.deepEqual(staleWrapperWorld.transfers, [], "a stale wrapper request must not create transfer records");
 assert.deepEqual(staleWrapperWorld.marketReports, [], "a stale wrapper request must not create market reports");


 
// Historical league and division tables must survive the shorter fixture/stat retention window.
const retentionClubs = [];
for (let index = 1; index <= 6; index++) retentionClubs.push({
  id: "retention-first-" + index, name: "Retention First " + index, country: "Testland",
  leagueId: "retention-league", division: 1, power: 58 + index, basePower: 58 + index,
  prestige: 60, matchesPerSeason: 10, roster: []
});
for (let index = 1; index <= 3; index++) retentionClubs.push({
  id: "retention-second-" + index, name: "Retention Second " + index, country: "Testland",
  leagueId: "retention-league", division: 2, power: 48 + index, basePower: 48 + index,
  prestige: 45, matchesPerSeason: 4, roster: []
});
const retentionWorld = {
  schemaVersion: ai.version, dbVersion: 0, rosterSchemaVersion: 3, currentSeason: 1,
  lastAdvancedTo: 0, lastCompletedSeason: 0, completedSeasons: [],
  players: {}, clubs: Object.fromEntries(retentionClubs.map(club => [club.id, club])),
  playerHistory: {}, seasonStats: {}, leagueTables: {}, matchesBySeason: {},
  competitionsBySeason: {}, transfers: [], marketReports: [], notes: [],
  nextGeneratedPlayer: 1, transferSequence: 0, projectionRevision: 0
};
const retentionSave = { season: 1, worldSimulation: retentionWorld };
const retentionDb = {
  version: 0,
  clubs: () => [],
  leagues: () => [],
  leagueFor: (_country, division) => Number(division) >= 2
    ? { name: "Retention Second Division", englishName: "Retention Championship", matchesPerSeason: 4 }
    : { name: "Retention Premier", englishName: "Retention Premier League", matchesPerSeason: 10 },
  simulationCupDefinitions: () => []
};
// Advancing a new season changes player ratings/contracts, club tiers and paid-market rosters.
 // Even with no eligible transfer/free-agent moves, a precomputed future season must be rebuilt.
const advanceProjectionSave = {
  season: 1,
  worldSimulation: JSON.parse(JSON.stringify(retentionWorld))
};
advanceProjectionSave.worldSimulation.rosterMembershipSchemaVersion = 5;
ai.completeSeason(advanceProjectionSave, 1, retentionDb);
const advanceProjectionWorld = advanceProjectionSave.worldSimulation;
advanceProjectionWorld.matchesBySeason["2"] = [{
  season: 2, competitionId: "league", division: 1, matchday: 1,
  homeClubId: "retention-first-1", awayClubId: "retention-first-2",
  homeGoals: 0, awayGoals: 0
}];
advanceProjectionWorld.seasonStats["2"] = [{ id: "future-projection-sentinel", season: 2 }];
advanceProjectionWorld.leagueTables["2"] = {
  "retention-league": [{ clubId: "future-projection-sentinel", rank: 1 }]
};
advanceProjectionWorld.competitionsBySeason["2"] = [{ id: "future-projection-cup", season: 2 }];
const advanceProjectionTransition = ai.advanceToSeason(advanceProjectionSave, 2, retentionDb);
assert.equal(advanceProjectionTransition.alreadyAdvanced, false,
  "the pending-projection fixture must execute a new world-season transition");
assert.equal(advanceProjectionWorld.lastAdvancedTo, 2);
for (const field of ["matchesBySeason", "seasonStats", "leagueTables", "competitionsBySeason"]) {
  assert.ok(!Object.prototype.hasOwnProperty.call(advanceProjectionWorld[field], "2"),
    "a new season transition must invalidate a future snapshot built before development/market changes: " + field);
}

// Continue with the original retention assertions.
const retentionSeasonOne = ai.completeSeason(retentionSave, 1, retentionDb);
const retainedFirstTierIds = retentionSeasonOne.tables["retention-league"].map(row => String(row.clubId));
const retainedSecondTierIds = retentionSeasonOne.tables["retention-league:2"].map(row => String(row.clubId));
assert.equal(retainedFirstTierIds.length, 6, "the retention fixture must generate a complete first-tier table");
assert.equal(retainedSecondTierIds.length, 3, "the retention fixture must generate a complete second-tier table");
ai.completeSeason(retentionSave, 2, retentionDb);
ai.completeSeason(retentionSave, 3, retentionDb);
assert.equal(Object.prototype.hasOwnProperty.call(retentionWorld.matchesBySeason, "1"), false,
  "detailed fixtures should remain limited to the latest season");
assert.equal(Object.prototype.hasOwnProperty.call(retentionWorld.seasonStats, "1"), false,
  "player-season rows should retain their existing compact two-season window");
assert.equal(Object.prototype.hasOwnProperty.call(retentionWorld.leagueTables, "1"), true,
  "completed league tables must remain available across the 20-season history window");
retentionWorld.clubs["retention-second-1"].division = 1;
retentionWorld.clubs["retention-first-6"].division = 2;
assert.equal(JSON.stringify(ai.getLeagueTable(retentionSave, "retention-league", 1, retentionDb)
  .map(row => String(row.clubId))), JSON.stringify(retainedFirstTierIds),
  "historical first-tier standings must use the saved season snapshot, not today's club divisions");
assert.equal(JSON.stringify(ai.getDivisionTable(retentionSave, "retention-league", 2, 1, retentionDb)
  .map(row => String(row.clubId))), JSON.stringify(retainedSecondTierIds),
  "historical second-tier standings must survive fixture pruning and later promotion/relegation");

// A completed legacy season with pruned fixtures but no saved standings cannot be
// reconstructed accurately from today's club divisions. Return no fabricated table.
const missingSnapshotSave = JSON.parse(JSON.stringify(retentionSave));
delete missingSnapshotSave.worldSimulation.leagueTables["1"];
assert.equal(ai.getLeagueTable(missingSnapshotSave, "retention-league", 1, retentionDb).length, 0,
  "a completed historical league with no snapshot must not be regenerated from current club divisions");
assert.equal(ai.getDivisionTable(missingSnapshotSave, "retention-league", 2, 1, retentionDb).length, 0,
  "league and division history getters must agree when a completed snapshot is unavailable");

function makeLeagueMatchCountFixture(spec) {
  const players = {}, clubs = {};
  const roles = [
    ["goalkeeper", "حارس مرمى"], ["defender", "قلب دفاع"], ["defender", "ظهير"],
    ["defender", "قلب دفاع"], ["defender", "ظهير"], ["midfielder", "وسط دفاعي"],
    ["midfielder", "وسط"], ["midfielder", "وسط مهاجم"], ["midfielder", "وسط"],
    ["attacker", "جناح"], ["attacker", "مهاجم"]
  ];
  for (let clubIndex = 0; clubIndex < spec.clubCount; clubIndex++) {
    const clubId = spec.leagueId + "-schedule-" + String(clubIndex + 1).padStart(2, "0");
    const roster = [];
    roles.forEach(([group, position], playerIndex) => {
      const playerId = clubId + "-player-" + (playerIndex + 1);
      roster.push(playerId);
      players[playerId] = {
        id: playerId, name: "Schedule Test Player " + playerId, clubId,
        country: spec.country, leagueId: spec.leagueId, division: spec.division,
        position, group, ovr: 60 + (playerIndex % 5), potential: 70,
        age: 24, contractSeasons: 2, freeAgent: false, retired: false
      };
    });
    clubs[clubId] = {
      id: clubId, name: "Schedule Test Club " + (clubIndex + 1),
      country: spec.country, leagueId: spec.leagueId, division: spec.division,
      matchesPerSeason: spec.matchesPerSeason, power: 60 + clubIndex % 7,
      basePower: 60, prestige: 55, roster, updatedSeason: 1
    };
  }
  const world = {
    schemaVersion: 1, dbVersion: Number(db.version) || 4,
    rosterSchemaVersion: 3, rosterMembershipSchemaVersion: 3,
    currentSeason: 1, lastCompletedSeason: 0, lastAdvancedTo: 0,
    completedSeasons: [], seasonStats: {}, leagueTables: {}, matchesBySeason: {},
    competitionsBySeason: {}, transfers: [], marketReports: [], playerHistory: {},
    nextGeneratedPlayer: 1, transferSequence: 0, projectionRevision: 0,
    notes: [], archive: {}, clubs, players
  };
  const fixtureDb = {
    version: world.dbVersion,
    leagues: () => [{ id: spec.leagueId, country: spec.country }],
    leagueFor: () => ({
      name: "Schedule Test League", englishName: "Schedule Test League",
      teamCount: spec.expectedTeamCount, matchesPerSeason: spec.matchesPerSeason
    })
  };
  return { save: { season: 1, worldSimulation: world }, world, fixtureDb };
}

const negativeBasePowerFixture = makeLeagueMatchCountFixture({
  label: "Negative saved club power fallback", leagueId: "negative-base-power",
  country: "Testland", division: 1, clubCount: 2, expectedTeamCount: 2, matchesPerSeason: 2
});
const negativeBasePowerClub = negativeBasePowerFixture.world.clubs["negative-base-power-schedule-01"];
negativeBasePowerClub.power = -12;
negativeBasePowerClub.basePower = 73;
const negativeBasePowerSeason = ai.completeSeason(
  negativeBasePowerFixture.save, 1, negativeBasePowerFixture.fixtureDb
);
const negativeBasePowerRow = (negativeBasePowerSeason.tables["negative-base-power"] || [])
  .find(row => row.clubId === negativeBasePowerClub.id);
assert.equal(negativeBasePowerRow && negativeBasePowerRow.power, 73,
  "season table strength must fall back to positive basePower when saved power is negative");
assert.equal(negativeBasePowerClub.power, -12,
  "season simulation must not rewrite the original saved negative power");

function assertLeagueMatchCountCase(spec) {
  const fixture = makeLeagueMatchCountFixture(spec);
  const result = ai.completeSeason(fixture.save, 1, fixture.fixtureDb);
  const tableKey = spec.division === 1 ? spec.leagueId : spec.leagueId + ":" + spec.division;
  const rows = result.tables[tableKey] || [];
  const expectedMatches = spec.clubCount === spec.expectedTeamCount
    ? spec.matchesPerSeason : 2 * (spec.clubCount - 1);
  assert.equal(rows.length, spec.clubCount, spec.label + " must retain all available clubs");
  assert.ok(rows.every(row => row.played === expectedMatches),
    spec.label + " must use the configured season length only when the full league field exists");
  assert.equal(rows.reduce((sum, row) => sum + row.played, 0), spec.clubCount * expectedMatches,
    spec.label + " must balance every club's match count");
  assert.equal(rows.reduce((sum, row) => sum + row.w, 0), rows.reduce((sum, row) => sum + row.l, 0),
    spec.label + " must balance wins and losses");
  assert.equal(rows.reduce((sum, row) => sum + row.gf, 0), rows.reduce((sum, row) => sum + row.ga, 0),
    spec.label + " must balance goals for and against");
  assert.ok(rows.every(row => row.played === row.w + row.d + row.l),
    spec.label + " must reconcile played matches with results");
  assert.equal(result.rows.length, spec.clubCount * 11,
    spec.label + " must preserve every supplied player record");
  assert.ok(result.rows.every(row => row.appearances <= expectedMatches),
    spec.label + " player appearances must not exceed the simulated league season");
}

assertLeagueMatchCountCase({
  label: "Scottish Championship", leagueId: "scotland", country: "اسكتلندا",
  division: 2, clubCount: 10, expectedTeamCount: 10, matchesPerSeason: 36
});
assertLeagueMatchCountCase({
  label: "Argentine Primera División", leagueId: "argentina", country: "الأرجنتين",
  division: 1, clubCount: 30, expectedTeamCount: 30, matchesPerSeason: 30
});
assertLeagueMatchCountCase({
  label: "Argentine Primera Nacional", leagueId: "argentina", country: "الأرجنتين",
  division: 2, clubCount: 36, expectedTeamCount: 36, matchesPerSeason: 34
});
assertLeagueMatchCountCase({
  label: "Incomplete league catalogue", leagueId: "incomplete-test", country: "Testland",
  division: 1, clubCount: 10, expectedTeamCount: 20, matchesPerSeason: 38
});
assertLeagueMatchCountCase({
  label: "Two-club incomplete league", leagueId: "two-club-test", country: "Testland",
  division: 1, clubCount: 2, expectedTeamCount: 20, matchesPerSeason: 38
});

// Players without a valid current club must be detached and made available as free agents.
const orphanedContractPlayerId = "orphaned-contract-player";
const unattachedContractPlayerId = "unattached-contract-player";
const orphanedContractWorld = {
  players: {
    [orphanedContractPlayerId]: {
      id: orphanedContractPlayerId, name: "Orphaned Contract Player",
      clubId: "missing-club-record", leagueId: "stale-league", division: 2,
      age: 24, position: "وسط", group: "midfielder", contractSeasons: 3,
      ovr: 65, potential: 80, freeAgent: false, transferListed: true
    },
    [unattachedContractPlayerId]: {
      id: unattachedContractPlayerId, name: "Unattached Contract Player",
      clubId: "", previousClubId: "last-known-club", leagueId: "stale-league", division: 2,
      age: 25, position: "وسط", group: "midfielder", contractSeasons: 3,
      ovr: 64, potential: 78, freeAgent: false, transferListed: true
    }
  },
  clubs: {}, seasonStats: { "1": [] }, notes: [], playerHistory: {}
};
sandbox.window.__lwTestDevelopPlayers(orphanedContractWorld, 1);
const orphanedContractPlayer = orphanedContractWorld.players[orphanedContractPlayerId];
assert.equal(orphanedContractPlayer.clubId, "", "a missing club reference must be detached");
assert.equal(orphanedContractPlayer.previousClubId, "missing-club-record",
  "orphan recovery must retain the last club identifier for provenance");
assert.equal(orphanedContractPlayer.leagueId, "", "orphan recovery must clear stale league membership");
assert.equal(orphanedContractPlayer.division, 0, "orphan recovery must clear stale division membership");
assert.equal(orphanedContractPlayer.contractSeasons, 0,
  "a player cannot retain an active contract with a club that no longer exists");
assert.equal(orphanedContractPlayer.freeAgent, true, "orphaned players must enter the free-agent pool");
assert.equal(orphanedContractPlayer.freeAgentSince, 2,
  "orphaned players must receive a deterministic free-agent start season");
assert.equal(orphanedContractPlayer.transferListed, false,
  "an orphaned player must not keep a stale transfer-list flag");

const unattachedContractPlayer = orphanedContractWorld.players[unattachedContractPlayerId];
assert.equal(unattachedContractPlayer.clubId, "", "an empty club ID must remain unattached");
assert.equal(unattachedContractPlayer.previousClubId, "last-known-club",
  "releasing an unattached player must preserve their known former club");
assert.equal(unattachedContractPlayer.leagueId, "", "unattached players must lose stale league membership");
assert.equal(unattachedContractPlayer.division, 0, "unattached players must lose stale division membership");
assert.equal(unattachedContractPlayer.contractSeasons, 0,
  "an unattached player must not retain a contract with an unknown club");
assert.equal(unattachedContractPlayer.freeAgent, true,
  "an unattached player with a stale contract must enter the free-agent pool");
assert.equal(unattachedContractPlayer.freeAgentSince, 2,
  "an unattached player must receive the next-season free-agent marker");
assert.equal(unattachedContractPlayer.transferListed, false,
  "an unattached player must not retain a stale transfer-list flag");

const orphanReleaseNoticeCount = orphanedContractWorld.notes.length;
sandbox.window.__lwTestDevelopPlayers(orphanedContractWorld, 2);
assert.equal(orphanedContractWorld.notes.length, orphanReleaseNoticeCount,
  "orphan-release notes must not be duplicated after players have been detached");


// Domestic cups marked for lower-tier entry must include every eligible club,
// rather than silently truncating the field to the first 16 clubs in catalogue order.
const cupFixtureClubs = [];
for (let index = 1; index <= 12; index++) cupFixtureClubs.push({
  id: "cup-first-" + String(index).padStart(2, "0"),
  name: "Cup First Tier " + index, country: "Testland", leagueId: "test-cup-league",
  division: 1, power: 60 + index, basePower: 60 + index, prestige: 55, roster: []
});
for (let index = 1; index <= 5; index++) cupFixtureClubs.push({
  id: "cup-second-" + String(index).padStart(2, "0"),
  name: "Cup Second Tier " + index, country: "Testland", leagueId: "test-cup-league",
  division: 2, power: 45 + index, basePower: 45 + index, prestige: 40, roster: []
});
const cupWorld = {
  schemaVersion: ai.version, dbVersion: 0, rosterSchemaVersion: 3, rosterMembershipSchemaVersion: 6,
  currentSeason: 1, lastAdvancedTo: 0, lastCompletedSeason: 0, completedSeasons: [],
  players: {}, clubs: Object.fromEntries(cupFixtureClubs.map(club => [club.id, club])),
  playerHistory: {}, seasonStats: {}, leagueTables: {}, matchesBySeason: {},
  competitionsBySeason: {}, transfers: [], marketReports: [], notes: [],
  nextGeneratedPlayer: 1, transferSequence: 0, projectionRevision: 0
};
const cupSave = { season: 1, worldSimulation: cupWorld };
const cupDb = {
  version: 0, clubs: () => [], leagues: () => [],
  leagueFor: (_country, division) => ({
    teamCount: Number(division) >= 2 ? 5 : 12, matchesPerSeason: 2
  }),
  simulationCupDefinitions: () => [
    { id: "test-all-tier-cup", name: "Test All-Tier Cup", kind: "domestic-cup",
      countries: ["test-cup-league"], lower: true },
    { id: "test-first-tier-cup", name: "Test First-Tier Cup", kind: "domestic-cup",
      countries: ["test-cup-league"], lower: false }
  ]
};
const simulatedCups = ai.seasonCompetitions(cupSave, 1, cupDb);
const allTierCup = simulatedCups.find(row => row.id === "test-all-tier-cup");
const firstTierCup = simulatedCups.find(row => row.id === "test-first-tier-cup");
assert.ok(allTierCup, "the all-tier domestic cup must be simulated");
assert.equal(allTierCup.participants.length, 17,
  "a lower-tier domestic cup must include all 12 first-tier and 5 second-tier clubs");
assert.ok(allTierCup.participants.includes("cup-second-05"),
  "the last lower-tier club must not be dropped by catalogue ordering");
assert.equal(allTierCup.matches.length, 16,
  "a 17-team knockout cup must advance every participant through byes to one champion");
assert.ok(allTierCup.matches.every(match =>
  allTierCup.participants.includes(match.homeClubId) && allTierCup.participants.includes(match.awayClubId)),
  "every cup fixture must belong to the saved participant field");
assert.ok(firstTierCup, "the first-tier-only cup must be simulated");
assert.equal(firstTierCup.participants.length, 12,
  "a domestic cup without lower-tier entry must remain limited to the first division");
assert.ok(firstTierCup.participants.every(id => id.startsWith("cup-first-")),
  "first-tier-only cups must never include second-division clubs");

assert.equal(Object.keys(cupWorld.players).length, 0,
  "cup participant selection must not fabricate player records");

// A seeded 1-1 cup final (season 14) exposed a chained-random-draw bias:
// the old resolver gave the home side a 52.645% win probability (47.355% away) on tied knockout matches.
const tieBreakClubA = { id: "testland|a", name: "Tie Break A", power: 70 };
const tieBreakClubB = { id: "testland|b", name: "Tie Break B", power: 70 };
const tieBreakWorld = { clubs: {
  [tieBreakClubA.id]: tieBreakClubA,
  [tieBreakClubB.id]: tieBreakClubB
} };
const tieBreakCup = sandbox.window.__lwTestKnockout(tieBreakWorld, 14, {
  id: "test-tie-break", name: "Tie Break Cup", kind: "domestic-cup"
}, [tieBreakClubA, tieBreakClubB]);
const tieBreakFinal = tieBreakCup.matches[0];
assert.equal(tieBreakFinal.homeGoals, 1,
  "the deterministic tiebreak fixture must preserve the tied home score");
assert.equal(tieBreakFinal.awayGoals, 2,
  "one fair tiebreak draw must award the away side for the seeded 0.9366 result");
assert.equal(tieBreakFinal.winnerId, tieBreakFinal.awayClubId,
  "a tied knockout final must follow one unbiased tiebreak draw, not a home-favouring chain");

const malformedCupPowerClub = {
  id: "malformed-cup-power", name: "Malformed Cup Power", power: hostileSavedNumber, basePower: 92
};
const validCupPowerClub = {
  id: "valid-cup-power", name: "Valid Cup Power", power: 60, basePower: 60
};
const malformedCupPowerWorld = { clubs: {
  [malformedCupPowerClub.id]: malformedCupPowerClub,
  [validCupPowerClub.id]: validCupPowerClub
} };
const controlCupPowerWorld = { clubs: {
  [malformedCupPowerClub.id]: { ...malformedCupPowerClub, power: 92 },
  [validCupPowerClub.id]: { ...validCupPowerClub }
} };
let malformedPowerCup, controlPowerCup;
assert.doesNotThrow(() => {
  malformedPowerCup = sandbox.window.__lwTestKnockout(
    malformedCupPowerWorld, 14, { id: "malformed-power-cup", name: "Malformed Power Cup", kind: "domestic-cup" },
    [malformedCupPowerClub, validCupPowerClub]
  );
}, "knockout simulation must use basePower instead of coercing a malformed current club power");
controlPowerCup = sandbox.window.__lwTestKnockout(
  controlCupPowerWorld, 14, { id: "malformed-power-cup", name: "Malformed Power Cup", kind: "domestic-cup" },
  [controlCupPowerWorld.clubs[malformedCupPowerClub.id], controlCupPowerWorld.clubs[validCupPowerClub.id]]
);
assert.deepEqual(
  [malformedPowerCup.matches[0].homeGoals, malformedPowerCup.matches[0].awayGoals, malformedPowerCup.matches[0].winnerId],
  [controlPowerCup.matches[0].homeGoals, controlPowerCup.matches[0].awayGoals, controlPowerCup.matches[0].winnerId],
  "a malformed current power with valid basePower must simulate identically to the equivalent valid saved power"
);

const legacyCupWorld = JSON.parse(JSON.stringify(cupWorld));
delete legacyCupWorld.clubs["cup-first-01"].division;
const legacyCups = sandbox.window.__lwTestSimulateCompetitions(legacyCupWorld, 1, cupDb, {});
const legacyAllTierCup = legacyCups.find(row => row.id === "test-all-tier-cup");
const legacyFirstTierCup = legacyCups.find(row => row.id === "test-first-tier-cup");
assert.ok(legacyAllTierCup && legacyFirstTierCup,
  "domestic cups must still simulate when a top-tier legacy club has no persisted division");
assert.ok(legacyAllTierCup.participants.includes("cup-first-01")
  && legacyFirstTierCup.participants.includes("cup-first-01"),
  "a missing division must default to the first tier for domestic-cup eligibility");

// Domestic and continental supercups must draw from the correct previous-season winners.
cupDb.simulationCupDefinitions = () => [
  { id: "test-all-tier-cup", name: "Test All-Tier Cup", kind: "domestic-cup",
    countries: ["test-cup-league"], lower: true },
  { id: "test-first-tier-cup", name: "Test First-Tier Cup", kind: "domestic-cup",
    countries: ["test-cup-league"], lower: false },
  { id: "test-domestic-supercup", name: "Test Domestic Super Cup", kind: "supercup",
    confederation: "CAF", countries: ["test-cup-league"], qualifierCupId: "test-first-tier-cup" },
  { id: "test-domestic-all-tier-supercup", name: "Test All-Tier Domestic Super Cup", kind: "supercup",
    confederation: "CAF", countries: ["test-cup-league"], qualifierCupId: "test-all-tier-cup" },
  { id: "test-continental-supercup", name: "Test Continental Super Cup", kind: "supercup",
    confederation: "CAF", qualifierCompetitionIds: ["valid-caf-champion-1", "valid-caf-champion-2"] }
];
cupWorld.leagueTables["1"]["test-cup-league"] = [
  { clubId: "cup-first-01", rank: 1 }, { clubId: "cup-first-02", rank: 2 }
];
cupWorld.competitionsBySeason["1"] = [
  { id: "test-continental-winner", kind: "continental", confederation: "CAF",
    championId: "cup-second-05" },
  { id: "test-all-tier-cup", kind: "domestic-cup", confederation: "CAF",
    championId: "cup-first-03", runnerUpId: "cup-first-04" },
  { id: "test-first-tier-cup", kind: "domestic-cup", confederation: "CAF",
    championId: "cup-first-04", runnerUpId: "cup-first-05" }
];
const yearTwoCompetitions = ai.seasonCompetitions(cupSave, 2, cupDb);
const domesticSupercup = yearTwoCompetitions.find(row => row.id === "test-domestic-supercup");
assert.ok(domesticSupercup, "the domestic supercup must be simulated when prior domestic winners exist");
assert.deepEqual([...domesticSupercup.participants].sort(), ["cup-first-01", "cup-first-04"],
  "a domestic supercup must use its configured primary cup, not the first secondary cup in history");
assert.ok(!domesticSupercup.participants.includes("cup-second-05"),
  "a continental champion must never replace a domestic supercup participant");
assert.ok(!yearTwoCompetitions.some(row => row.id === "test-continental-supercup"),
  "a continental supercup must not borrow a domestic-cup winner when only one continental champion exists");

// If the same club wins the league and domestic cup, use the cup runner-up as opponent.
cupWorld.leagueTables["2"]["test-cup-league"] = [
  { clubId: "cup-first-01", rank: 1 }, { clubId: "cup-first-02", rank: 2 }
];
cupWorld.competitionsBySeason["2"] = [
  { id: "test-all-tier-cup", kind: "domestic-cup", confederation: "CAF",
    championId: "cup-first-03", runnerUpId: "cup-first-04" },
  { id: "test-first-tier-cup", kind: "domestic-cup", confederation: "CAF",
    championId: "cup-first-01", runnerUpId: "cup-second-05" }
];
const yearThreeCompetitions = ai.seasonCompetitions(cupSave, 3, cupDb);
const doubleWinnerSupercup = yearThreeCompetitions.find(row => row.id === "test-domestic-supercup");
assert.ok(doubleWinnerSupercup, "a domestic double winner must still produce a two-club supercup");
assert.deepEqual([...doubleWinnerSupercup.participants].sort(), ["cup-first-01", "cup-first-02"],
  "a first-tier-only cup must reject a lower-division runner-up and use the verified league runner-up instead");


// A malformed prior-season table must not inject a foreign or lower-division club into a domestic supercup.
cupWorld.clubs["cup-foreign-supercup"] = {
  id: "cup-foreign-supercup", name: "Foreign Super Cup Club", country: "Foreignland",
  leagueId: "foreign-cup-league", division: 1, power: 90, basePower: 90, prestige: 70, roster: []
};
function assertDomesticSupercupRejectsInvalidLeagueRow(season, invalidRow, label) {
  const previousSeason = String(season - 1);
  // Each request simulates a full season, so isolate this fixture to avoid pruning or
  // overwriting the later legacy/identity scenarios in the shared cup-world test save.
  const testWorld = JSON.parse(JSON.stringify(cupWorld));
  testWorld.leagueTables[previousSeason] = {
    "test-cup-league": [
      invalidRow,
      { clubId: "cup-first-02", leagueId: "test-cup-league", division: 1, rank: 2 }
    ]
  };
  testWorld.competitionsBySeason[previousSeason] = [
    { id: "test-all-tier-cup", kind: "domestic-cup", championId: "cup-first-03", runnerUpId: "cup-first-04" },
    { id: "test-first-tier-cup", kind: "domestic-cup", championId: "cup-first-04", runnerUpId: "cup-first-05" }
  ];
  const testSave = { ...cupSave, worldSimulation: testWorld };
  const supercup = ai.seasonCompetitions(testSave, season, cupDb)
    .find(row => row.id === "test-domestic-supercup");
  assert.equal(supercup, undefined,
    label + ": a domestic supercup must not be created without a verified top-flight league champion");
}
assertDomesticSupercupRejectsInvalidLeagueRow(4, {
  clubId: "cup-foreign-supercup", leagueId: "test-cup-league", division: 1, rank: 1
}, "foreign canonical club identity");
assertDomesticSupercupRejectsInvalidLeagueRow(5, {
  clubId: "cup-second-01", leagueId: "test-cup-league", division: 2, rank: 1
}, "second-division canonical club identity");
assertDomesticSupercupRejectsInvalidLeagueRow(6, {
  clubId: "cup-first-01", leagueId: "foreign-cup-league", division: 1, rank: 1
}, "mismatched saved league identity");
assertDomesticSupercupRejectsInvalidLeagueRow(7, {
  clubId: "cup-first-01", leagueId: "test-cup-league", division: 1, rank: [1]
}, "array-coerced domestic supercup rank");
assertDomesticSupercupRejectsInvalidLeagueRow(8, {
  clubId: "cup-first-01", leagueId: "test-cup-league", division: [1], rank: 1
}, "array-coerced domestic supercup division");
assertDomesticSupercupRejectsInvalidLeagueRow(9, {
  clubId: "cup-first-01", leagueId: "test-cup-league", division: 1, rank: Symbol("invalid-rank")
}, "Symbol domestic supercup rank");

// Rankless legacy tables remain supported when their canonical club membership is valid.
cupWorld.leagueTables["6"] = {
  "test-cup-league": [{ clubId: "cup-first-01" }, { clubId: "cup-first-02" }]
};
cupWorld.competitionsBySeason["6"] = [
  { id: "test-first-tier-cup", kind: "domestic-cup", championId: "cup-first-03", runnerUpId: "cup-first-04" }
];
const legacyRanklessSupercup = ai.seasonCompetitions(cupSave, 7, cupDb)
  .find(row => row.id === "test-domestic-supercup");
assert.ok(legacyRanklessSupercup && legacyRanklessSupercup.participants.includes("cup-first-01"),
  "rankless legacy tables must still resolve their first valid top-flight club");


// A domestic cup runner-up must belong to the same league; a valid lower-tier cup runner-up remains eligible.
cupWorld.clubs["cup-foreign-supercup"].confederation = "UEFA";
cupWorld.clubs["cup-caf-supercup-1"] = {
  id: "cup-caf-supercup-1", name: "CAF Super Cup Club 1", country: "CAFland",
  leagueId: "caf-test-league", confederation: "CAF", division: 1, power: 75, roster: []
};
cupWorld.clubs["cup-caf-supercup-2"] = {
  id: "cup-caf-supercup-2", name: "CAF Super Cup Club 2", country: "CAFland",
  leagueId: "caf-test-league-2", confederation: "CAF", division: 1, power: 73, roster: []
};
cupWorld.clubs["cup-caf-supercup-3"] = {
  id: "cup-caf-supercup-3", name: "CAF Secondary Competition Club", country: "CAFland",
  leagueId: "caf-test-league-3", confederation: "CAF", division: 1, power: 71, roster: []
};
cupWorld.leagueTables["8"] = {
  "test-cup-league": [
    { clubId: "cup-first-01", leagueId: "test-cup-league", division: 1, rank: 1 },
    { clubId: "cup-first-02", leagueId: "test-cup-league", division: 1, rank: 2 }
  ]
};
cupWorld.competitionsBySeason["8"] = [
  { id: "test-all-tier-cup", kind: "domestic-cup", championId: "cup-first-03", runnerUpId: "cup-first-04" },
  { id: "test-first-tier-cup", kind: "domestic-cup", championId: "cup-first-01", runnerUpId: "cup-foreign-supercup" },
  { id: "foreign-confederation-record", kind: "continental", confederation: "CAF", championId: "cup-foreign-supercup" },
  { id: "secondary-caf-competition", kind: "continental", confederation: "CAF", championId: "cup-caf-supercup-3" },
  { id: "valid-caf-champion-1", kind: "continental", confederation: "CAF", championId: "cup-caf-supercup-1" },
  { id: "valid-caf-champion-2", kind: "continental", confederation: "CAF", championId: "cup-caf-supercup-2" }
];
const identityCheckedSupercups = ai.seasonCompetitions(cupSave, 9, cupDb);
const domesticRunnerUpFallback = identityCheckedSupercups.find(row => row.id === "test-domestic-supercup");
assert.deepEqual([...domesticRunnerUpFallback.participants].sort(), ["cup-first-01", "cup-first-02"],
  "a foreign cup runner-up must be rejected and the verified league runner-up used instead");
const continentalIdentitySupercup = identityCheckedSupercups.find(row => row.id === "test-continental-supercup");
assert.ok(continentalIdentitySupercup, "two verified continental champions must still produce their supercup");
assert.deepEqual([...continentalIdentitySupercup.participants].sort(),
  ["cup-caf-supercup-1", "cup-caf-supercup-2"],
  "a continental supercup must validate each champion's canonical confederation, not trust the history row alone");

// The runner-up of a lower-tier-inclusive domestic cup may legitimately be a second-division club.
cupWorld.leagueTables["9"] = {
  "test-cup-league": [
    { clubId: "cup-first-01", leagueId: "test-cup-league", division: 1, rank: 1 },
    { clubId: "cup-first-02", leagueId: "test-cup-league", division: 1, rank: 2 }
  ]
};
cupWorld.competitionsBySeason["9"] = [
  { id: "test-first-tier-cup", kind: "domestic-cup", championId: "cup-first-01", runnerUpId: "cup-second-01" },
  { id: "test-all-tier-cup", kind: "domestic-cup", championId: "cup-first-01", runnerUpId: "cup-second-01" }
];
const tierEligibilitySupercups = ai.seasonCompetitions(cupSave, 10, cupDb);
const firstTierCupRunnerUpSupercup = tierEligibilitySupercups.find(row => row.id === "test-domestic-supercup");
assert.deepEqual([...firstTierCupRunnerUpSupercup.participants].sort(), ["cup-first-01", "cup-first-02"],
  "a first-tier-only cup must not qualify its second-division runner-up");
const lowerTierCupRunnerUpSupercup = tierEligibilitySupercups.find(row => row.id === "test-domestic-all-tier-supercup");
assert.ok(lowerTierCupRunnerUpSupercup && lowerTierCupRunnerUpSupercup.participants.includes("cup-second-01"),
  "same-league lower-tier cup runners-up remain eligible when the configured cup admits lower divisions");

// A missing domestic-cup result must not be replaced with the league runner-up.
cupWorld.leagueTables["10"] = {
  "test-cup-league": [
    { clubId: "cup-first-01", leagueId: "test-cup-league", division: 1, rank: 1 },
    { clubId: "cup-first-02", leagueId: "test-cup-league", division: 1, rank: 2 }
  ]
};
cupWorld.competitionsBySeason["10"] = [
  { id: "test-all-tier-cup", kind: "domestic-cup", championId: "cup-first-03", runnerUpId: "cup-first-04" }
];
const missingCupHistorySupercup = ai.seasonCompetitions(cupSave, 11, cupDb)
  .find(row => row.id === "test-domestic-supercup");
assert.equal(missingCupHistorySupercup, undefined,
  "a domestic supercup must not be fabricated from the league champion and runner-up when only a secondary cup result exists");

// A lower-division winner cannot qualify through a primary cup restricted to the top flight.
cupWorld.leagueTables["11"] = {
  "test-cup-league": [
    { clubId: "cup-first-01", leagueId: "test-cup-league", division: 1, rank: 1 },
    { clubId: "cup-first-02", leagueId: "test-cup-league", division: 1, rank: 2 }
  ]
};
cupWorld.competitionsBySeason["11"] = [
  { id: "test-first-tier-cup", kind: "domestic-cup", championId: "cup-second-01", runnerUpId: "cup-first-02" }
];
const invalidFirstTierCupWinnerSupercup = ai.seasonCompetitions(cupSave, 12, cupDb)
  .find(row => row.id === "test-domestic-supercup");
assert.equal(invalidFirstTierCupWinnerSupercup, undefined,
  "a second-division club must not qualify as champion of a first-tier-only primary cup");

// Cup winners and runners-up must belong to the saved participant field when it is present.
cupWorld.leagueTables["20"] = {
  "test-cup-league": [
    { clubId: "cup-first-01", leagueId: "test-cup-league", division: 1, rank: 1 },
    { clubId: "cup-first-03", leagueId: "test-cup-league", division: 1, rank: 2 }
  ]
};
cupWorld.competitionsBySeason["20"] = [
  { id: "test-first-tier-cup", kind: "domestic-cup", championId: "cup-first-01", runnerUpId: "cup-first-02",
    participants: ["cup-first-01", "cup-first-03"] }
];
const unlistedCupRunnerUpSupercup = ai.seasonCompetitions(cupSave, 21, cupDb)
  .find(row => row.id === "test-domestic-supercup");
assert.deepEqual([...unlistedCupRunnerUpSupercup.participants].sort(), ["cup-first-01", "cup-first-03"],
  "a cup runner-up absent from the recorded participant field must be rejected in favor of the verified league runner-up");

cupWorld.leagueTables["21"] = {
  "test-cup-league": [
    { clubId: "cup-first-01", leagueId: "test-cup-league", division: 1, rank: 1 },
    { clubId: "cup-first-03", leagueId: "test-cup-league", division: 1, rank: 2 }
  ]
};
cupWorld.competitionsBySeason["21"] = [
  { id: "test-first-tier-cup", kind: "domestic-cup", championId: "cup-first-02", runnerUpId: "cup-first-03",
    participants: ["cup-first-01", "cup-first-03"] }
];
const unlistedCupWinnerSupercup = ai.seasonCompetitions(cupSave, 22, cupDb)
  .find(row => row.id === "test-domestic-supercup");
assert.equal(unlistedCupWinnerSupercup, undefined,
  "a cup champion absent from the recorded participant field must not qualify even when its league and division match");

cupWorld.competitionsBySeason["22"] = [
  { id: "valid-caf-champion-1", kind: "continental", confederation: "CAF",
    championId: "cup-caf-supercup-1", participants: ["cup-caf-supercup-2"] },
  { id: "valid-caf-champion-2", kind: "continental", confederation: "CAF",
    championId: "cup-caf-supercup-2", participants: ["cup-caf-supercup-1"] }
];
const unlistedContinentalWinnerSupercup = ai.seasonCompetitions(cupSave, 23, cupDb)
  .find(row => row.id === "test-continental-supercup");
assert.equal(unlistedContinentalWinnerSupercup, undefined,
  "a continental champion absent from its recorded participant field must not qualify for a continental supercup");

// When one club wins both configured continental feeder competitions, the
// supercup must use a verified runner-up rather than collapsing to one participant.
const sharedContinentalChampionId = "cup-caf-supercup-1";
cupWorld.competitionsBySeason["23"] = [
  { id: "valid-caf-champion-1", kind: "continental", confederation: "CAF",
    championId: sharedContinentalChampionId, runnerUpId: "cup-caf-supercup-2",
    participants: [sharedContinentalChampionId] },
  { id: "valid-caf-champion-2", kind: "continental", confederation: "CAF",
    championId: sharedContinentalChampionId, runnerUpId: "cup-caf-supercup-3",
    participants: [sharedContinentalChampionId, "cup-caf-supercup-3"] }
];
const doubleContinentalWinnerSupercup = ai.seasonCompetitions(cupSave, 24, cupDb)
  .find(row => row.id === "test-continental-supercup");
assert.ok(doubleContinentalWinnerSupercup,
  "a shared continental champion must still produce a two-club supercup when a verified runner-up exists");
assert.deepEqual([...doubleContinentalWinnerSupercup.participants].sort(),
  [sharedContinentalChampionId, "cup-caf-supercup-3"].sort(),
  "the fallback must skip an unrecorded runner-up and use the next eligible feeder runner-up");

cupWorld.competitionsBySeason["24"] = [
  { id: "valid-caf-champion-1", kind: "continental", confederation: "CAF",
    championId: sharedContinentalChampionId, runnerUpId: "cup-caf-supercup-2",
    participants: [sharedContinentalChampionId] },
  { id: "valid-caf-champion-2", kind: "continental", confederation: "CAF",
    championId: sharedContinentalChampionId, runnerUpId: "cup-caf-supercup-3",
    participants: [sharedContinentalChampionId] }
];
const missingContinentalRunnerUpSupercup = ai.seasonCompetitions(cupSave, 25, cupDb)
  .find(row => row.id === "test-continental-supercup");
assert.equal(missingContinentalRunnerUpSupercup, undefined,
  "a shared continental champion must not create a one-club supercup when no recorded runner-up is eligible");






// Continental tournaments must use the previous completed domestic standings and the
// tournament's configured places, never the highest raw club power.
const qualificationClubs = [];
const qualificationStandings = {};
const currentQualificationStandings = {};
const expectedContinentalIds = [];
const expectedBootstrapIds = [];
for (let leagueIndex = 1; leagueIndex <= 4; leagueIndex++) {
  const leagueId = "qualification-league-" + leagueIndex;
  const standings = [];
  for (const rank of [4, 2, 1, 3]) {
    const id = "qualification-" + leagueIndex + "-" + rank;
    qualificationClubs.push({
      id, name: "Qualification Club " + leagueIndex + "-" + rank,
      leagueId, country: "Qualification Country " + leagueIndex,
      confederation: "CAF", division: 1,
      power: rank === 4 ? 120 : 60 - rank * 5, roster: []
    });
    standings.push({
      clubId: id, leagueId, division: 1, rank,
      pts: 100 - rank * 10, gf: 30 - rank, ga: rank
    });
    if (rank <= 3) expectedContinentalIds.push(id);
  }
  qualificationStandings[leagueId] = standings;
  currentQualificationStandings[leagueId] = standings.map(row => ({
    ...row, rank: 5 - row.rank, pts: 200 - row.pts
  }));
  currentQualificationStandings[leagueId].forEach(row => {
    if (row.rank <= 3) expectedBootstrapIds.push(row.clubId);
  });
}
qualificationClubs.push({
  id: "qualification-second-tier", name: "Qualification Second Tier",
  leagueId: "qualification-league-1", country: "Qualification Country 1",
  confederation: "CAF", division: 2, power: 999, roster: []
});
qualificationStandings["qualification-league-1"].unshift({
  clubId: "qualification-second-tier", leagueId: "qualification-league-1",
  division: 1, rank: 1, pts: 999
});
qualificationClubs.push({
  id: "qualification-foreign", name: "Foreign Qualification Club",
  leagueId: "foreign-qualification-league", country: "Foreign Country",
  confederation: "UEFA", division: 1, power: 999, roster: []
});
qualificationStandings["qualification-league-2"].unshift({
  clubId: "qualification-foreign", leagueId: "qualification-league-2",
  division: 1, rank: 1, pts: 999
});
const qualificationWorld = {
  players: {},
  clubs: Object.fromEntries(qualificationClubs.map(club => [club.id, club])),
  leagueTables: { "4": qualificationStandings },
  competitionsBySeason: {}
};
const qualificationDb = {
  leagueById: leagueId => ({
    globalTier: Number(String(leagueId).split("-").pop()),
    strength: 100 - Number(String(leagueId).split("-").pop()) * 5
  }),
  simulationCupDefinitions: () => [{
    id: "test-caf-qualification", name: "Test CAF Qualification",
    kind: "continental", confederation: "CAF", qualificationPlaces: [1, 2, 3, 4]
  }]
};
assert.equal(typeof sandbox.window.__lwTestSimulateCompetitions, "function",
  "the real continental selector must be exposed to the isolated regression test");
const qualifiedCompetitions = sandbox.window.__lwTestSimulateCompetitions(
  qualificationWorld, 5, qualificationDb, currentQualificationStandings
);
const qualifiedTournament = qualifiedCompetitions.find(row => row.id === "test-caf-qualification");
assert.ok(qualifiedTournament, "a continental tournament must be simulated when eligible standings exist");
assert.equal(qualifiedTournament.participants.length, 12,
  "the continental simulator must preserve its 12-club knockout limit");
assert.deepEqual([...qualifiedTournament.participants].sort(), expectedContinentalIds.sort(),
  "previous-season league positions must select the 12 highest eligible domestic places, not the strongest squads");
assert.ok(!qualifiedTournament.participants.includes("qualification-second-tier"),
  "a second-tier club must not take a first-tier continental place");
assert.ok(!qualifiedTournament.participants.includes("qualification-foreign"),
  "a club from another confederation or league must not enter this qualification pool");
const legacyQualificationWorld = JSON.parse(JSON.stringify(qualificationWorld));
const legacyQualifiedClubId = expectedContinentalIds[0];
delete legacyQualificationWorld.clubs[legacyQualifiedClubId].division;
const legacyQualifiedCompetitions = sandbox.window.__lwTestSimulateCompetitions(
  legacyQualificationWorld, 5, qualificationDb, currentQualificationStandings
);
const legacyQualifiedTournament = legacyQualifiedCompetitions.find(row => row.id === "test-caf-qualification");
assert.ok(legacyQualifiedTournament && legacyQualifiedTournament.participants.includes(legacyQualifiedClubId),
  "a recorded first-tier continental qualifier without a persisted division must retain its place");

// Array/boxed standings values must not become real continental ranks or points through coercion.
const malformedQualificationWorld = JSON.parse(JSON.stringify(qualificationWorld));
const malformedQualificationClubId = "qualification-1-5";
malformedQualificationWorld.clubs[malformedQualificationClubId] = {
  id: malformedQualificationClubId, name: "Malformed Qualification Club",
  leagueId: "qualification-league-1", country: "Qualification Country 1",
  confederation: "CAF", division: 1, power: 99, roster: []
};
malformedQualificationWorld.leagueTables["4"]["qualification-league-1"].unshift({
  clubId: malformedQualificationClubId, leagueId: "qualification-league-1",
  division: 1, rank: [1], pts: [9999], gd: Object(9999), gf: [9999], ga: [0]
});
const malformedQualificationDb = {
  ...qualificationDb,
  simulationCupDefinitions: () => [{
    id: "test-caf-qualification", name: "Test CAF Qualification",
    kind: "continental", confederation: "CAF", qualificationPlaces: [1, 2, 3]
  }]
};
const malformedQualificationResult = sandbox.window.__lwTestSimulateCompetitions(
  malformedQualificationWorld, 5, malformedQualificationDb, currentQualificationStandings
);
const malformedQualificationTournament = malformedQualificationResult
  .find(row => row.id === "test-caf-qualification");
assert.ok(malformedQualificationTournament, "valid continental qualification must survive malformed legacy rows");
assert.ok(!malformedQualificationTournament.participants.includes(malformedQualificationClubId),
  "array ranks and boxed/array metrics must not steal a continental place");
assert.ok(malformedQualificationTournament.participants.includes("qualification-1-3"),
  "the valid third-place club must retain its continental place when a malformed row claims rank one");

// Symbols and coercion-hostile objects in imported continental standings must fail closed, not throw.
const hostileQualificationWorld = JSON.parse(JSON.stringify(qualificationWorld));
const hostileQualificationClubId = "qualification-1-hostile";
hostileQualificationWorld.clubs[hostileQualificationClubId] = {
  id: hostileQualificationClubId, name: "Hostile Qualification Club",
  leagueId: "qualification-league-1", country: "Qualification Country 1",
  confederation: "CAF", division: 1, power: 99, roster: []
};
hostileQualificationWorld.leagueTables["4"]["qualification-league-1"].push({
  clubId: hostileQualificationClubId, leagueId: "qualification-league-1",
  division: [1], rank: Symbol("invalid-rank"), pts: Symbol("invalid-points"),
  gd: { valueOf() { throw new Error("unsafe continental goal-difference coercion"); } },
  gf: Symbol("invalid-goals-for"), ga: { toString() { throw new Error("unsafe continental goals-against coercion"); } }
});
let hostileQualificationResult;
assert.doesNotThrow(() => {
  hostileQualificationResult = sandbox.window.__lwTestSimulateCompetitions(
    hostileQualificationWorld, 5, qualificationDb, currentQualificationStandings
  );
}, "Symbol and hostile-object continental standings must not abort cup qualification");
const hostileQualificationTournament = hostileQualificationResult
  .find(row => row.id === "test-caf-qualification");
assert.ok(hostileQualificationTournament, "hostile standings must not block valid continental qualifiers");
assert.ok(!hostileQualificationTournament.participants.includes(hostileQualificationClubId),
  "hostile rank/division values must never qualify a club");

// Configured qualification places are exact ranks, not a contiguous range. Malformed
// definition values must be ignored without coercion, and duplicate eligible ranks must
// not award the same configured place twice.
const duplicateRankQualificationWorld = JSON.parse(JSON.stringify(qualificationWorld));
const duplicateRankQualificationClubId = "qualification-1-duplicate-rank-one";
duplicateRankQualificationWorld.clubs[duplicateRankQualificationClubId] = {
  id: duplicateRankQualificationClubId, name: "Duplicate Rank Qualification Club",
  leagueId: "qualification-league-1", country: "Qualification Country 1",
  confederation: "CAF", division: 1, power: 99, roster: []
};
duplicateRankQualificationWorld.leagueTables["4"]["qualification-league-1"].push({
  clubId: duplicateRankQualificationClubId, leagueId: "qualification-league-1",
  division: 1, rank: 1, pts: 10000, gf: 10000, ga: 0
});
const preciseQualificationDb = {
  ...qualificationDb,
  simulationCupDefinitions: () => [{
    id: "test-caf-qualification", name: "Test CAF Qualification",
    kind: "continental", confederation: "CAF",
    qualificationPlaces: [1, Symbol("invalid-place"), [3],
      { valueOf() { throw new Error("unsafe qualification-place coercion"); } }, 3]
  }]
};
let preciseQualificationResult;
assert.doesNotThrow(() => {
  preciseQualificationResult = sandbox.window.__lwTestSimulateCompetitions(
    duplicateRankQualificationWorld, 5, preciseQualificationDb, currentQualificationStandings
  );
}, "malformed configured qualification places must be ignored without coercion");
const preciseQualificationTournament = preciseQualificationResult
  .find(row => row.id === "test-caf-qualification");
assert.ok(preciseQualificationTournament,
  "valid exact qualification places must still produce the continental tournament");
assert.equal(preciseQualificationTournament.participants.length, 7,
  "only unique eligible rank-one/rank-three places across the four leagues should qualify");
assert.ok(preciseQualificationTournament.participants.includes("qualification-1-3"),
  "the explicitly configured third place must qualify even when second place is not configured");
assert.ok(!preciseQualificationTournament.participants.includes("qualification-1-2"),
  "an unconfigured second place must not be substituted for third place");
assert.ok(!preciseQualificationTournament.participants.includes("qualification-1-1")
  && !preciseQualificationTournament.participants.includes(duplicateRankQualificationClubId),
  "ambiguous duplicate eligible rank-one rows must not award either club the same slot");
for (const leagueIndex of [2, 3, 4]) {
  assert.ok(preciseQualificationTournament.participants.includes("qualification-" + leagueIndex + "-1"));
  assert.ok(preciseQualificationTournament.participants.includes("qualification-" + leagueIndex + "-3"));
  assert.ok(!preciseQualificationTournament.participants.includes("qualification-" + leagueIndex + "-2"));
}

assert.equal(Object.keys(qualificationWorld.players).length, 0,
  "continental qualification must not fabricate player records");
 
// The 32-team world club tournament is a four-season qualification cycle.
// Champions and runners-up of the top-tier continental championships qualify first;
// remaining places come from recorded performance in those same competitions.
const worldCupCompetitionDefs = [
  { id: "ucl", confederation: "UEFA" },
  { id: "caf-cl", confederation: "CAF" },
  { id: "libertadores", confederation: "CONMEBOL" }
];
const worldCupClubs = {};
const worldCupHistory = {};
const worldCupChampions = [];
const worldCupRunnerUps = [];
const worldCupSemifinalists = [];
for (let historySeason = 1; historySeason <= 4; historySeason++) {
  const seasonCompetitions = [];
  worldCupCompetitionDefs.forEach(def => {
    const championId = "world-cup-" + historySeason + "-" + def.id + "-champion";
    const runnerUpId = "world-cup-" + historySeason + "-" + def.id + "-runner-up";
    const semifinalistId = "world-cup-" + historySeason + "-" + def.id + "-semi";
    [championId, runnerUpId, semifinalistId].forEach((id, index) => {
      worldCupClubs[id] = {
        id, name: id, leagueId: "world-cup-league-" + def.confederation,
        confederation: def.confederation, division: 1,
        power: index === 0 ? 90 : index === 1 ? 80 : 70, roster: []
      };
    });
    worldCupChampions.push(championId);
    worldCupRunnerUps.push(runnerUpId);
    worldCupSemifinalists.push(semifinalistId);
    seasonCompetitions.push({
      id: def.id, kind: "continental", confederation: def.confederation,
      participants: [championId, runnerUpId, semifinalistId],
      championId, runnerUpId,
      matches: [
        { round: 4, homeClubId: championId, awayClubId: runnerUpId, winnerId: championId },
        { round: 3, homeClubId: semifinalistId, awayClubId: runnerUpId, winnerId: runnerUpId }
      ]
    });
  });
  worldCupHistory[String(historySeason)] = seasonCompetitions;
}
const worldCupOutsiderId = "world-cup-high-power-outsider";
worldCupClubs[worldCupOutsiderId] = {
  id: worldCupOutsiderId, name: "Unqualified High Power Club",
  leagueId: "world-cup-outsider-league", confederation: "UEFA",
  division: 1, power: 9999, roster: []
};
const worldCupForeignId = "world-cup-cross-confederation-record";
worldCupClubs[worldCupForeignId] = {
  id: worldCupForeignId, name: "Cross Confederation Club",
  leagueId: "world-cup-foreign-league", confederation: "CAF",
  division: 1, power: 9998, roster: []
};
const worldCupSecondaryId = "world-cup-secondary-cup-winner";
worldCupClubs[worldCupSecondaryId] = {
  id: worldCupSecondaryId, name: "Secondary Continental Cup Winner",
  leagueId: "world-cup-secondary-league", confederation: "UEFA",
  division: 1, power: 9997, roster: []
};
worldCupHistory["1"][0].participants.push(worldCupForeignId);
worldCupHistory["1"].push({
  id: "uel", kind: "continental", confederation: "UEFA",
  participants: [worldCupSecondaryId], championId: worldCupSecondaryId,
  runnerUpId: "", matches: []
});
const worldCupWorld = {
  clubs: worldCupClubs, players: {}, competitionsBySeason: worldCupHistory
};
const worldCupDb = {
  simulationCupDefinitions: () => [{
    id: "fifa-club-world-cup", name: "FIFA Club World Cup",
    kind: "world", confederation: "FIFA", system: "world32"
  }]
};
const legacyWorldCupWorld = {
  clubs: Object.fromEntries(Object.entries(worldCupClubs).map(([id, club]) => [id, { ...club }])),
  players: {},
  competitionsBySeason: JSON.parse(JSON.stringify(worldCupHistory))
};
const legacyWorldCupQualifier = worldCupChampions[0];
delete legacyWorldCupWorld.clubs[legacyWorldCupQualifier].division;
const legacyWorldCupResults = sandbox.window.__lwTestSimulateCompetitions(
  legacyWorldCupWorld, 5, worldCupDb, {}
);
const legacyWorldCup = legacyWorldCupResults.find(row => row.id === "fifa-club-world-cup");
assert.ok(legacyWorldCup && legacyWorldCup.participants.includes(legacyWorldCupQualifier),
  "a recorded top-tier continental champion from a legacy save must remain eligible for the world club tournament");

const worldCupResults = sandbox.window.__lwTestSimulateCompetitions(worldCupWorld, 5, worldCupDb, {});
const worldCup = worldCupResults.find(row => row.id === "fifa-club-world-cup");
assert.ok(worldCup, "the world club tournament must run when a complete four-season qualification field exists");
assert.equal(worldCup.participants.length, 32, "the world club tournament must contain exactly 32 qualified clubs");
assert.equal(worldCup.matches.length, 31, "a 32-team knockout tournament must contain 31 matches");
assert.ok(worldCupChampions.every(id => worldCup.participants.includes(id)),
  "all recorded top-tier continental champions must receive priority qualification");
assert.ok(worldCupRunnerUps.every(id => worldCup.participants.includes(id)),
  "all recorded top-tier continental runners-up must qualify before ranking places");
assert.equal(worldCup.participants.filter(id => worldCupSemifinalists.includes(id)).length, 8,
  "the remaining eight places must use performance in top-tier continental competitions");
assert.ok(!worldCup.participants.includes(worldCupOutsiderId),
  "a powerful club without continental qualification results must not enter the world tournament");
assert.ok(!worldCup.participants.includes(worldCupForeignId),
  "a club recorded under another confederation must not inherit a continental qualification place");
assert.ok(!worldCup.participants.includes(worldCupSecondaryId),
  "a secondary continental cup winner must not be treated as a top-tier world-cup qualifier");
assert.equal(Object.keys(worldCupWorld.players).length, 0,
  "world tournament qualification must not create synthetic player records");
assert.equal(sandbox.window.__lwTestSimulateCompetitions(worldCupWorld, 6, worldCupDb, {}).length, 0,
  "the 32-team world club tournament must not be simulated every season");
const incompleteWorldCupHistory = { ...worldCupWorld, competitionsBySeason: { ...worldCupHistory } };
delete incompleteWorldCupHistory.competitionsBySeason["1"];
assert.equal(sandbox.window.__lwTestSimulateCompetitions(incompleteWorldCupHistory, 5, worldCupDb, {}).length, 0,
  "a missing season in the four-year qualification window must block the tournament rather than invent entrants");
const limitedWorldCupClubs = {};
worldCupChampions.forEach(id => { limitedWorldCupClubs[id] = worldCupClubs[id]; });
worldCupRunnerUps.forEach(id => { limitedWorldCupClubs[id] = worldCupClubs[id]; });
worldCupSemifinalists.slice(0, 7).forEach(id => { limitedWorldCupClubs[id] = worldCupClubs[id]; });
const undersizedWorldCup = {
  clubs: limitedWorldCupClubs, competitionsBySeason: worldCupHistory
};
assert.equal(sandbox.window.__lwTestSimulateCompetitions(undersizedWorldCup, 5, worldCupDb, {}).length, 0,
  "the world tournament must not start with fewer than 32 real qualified clubs");
const retentionFixture = {
  competitionsBySeason: { "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] }
};
sandbox.window.__lwTestRetainCompetitionHistory(retentionFixture, 4);
assert.deepEqual(Object.keys(retentionFixture.competitionsBySeason).sort(), ["3", "4", "5", "6"],
  "the world save must retain exactly the latest four completed competition seasons");


// On the first simulated season only, use the just-completed table as the bootstrap source.
const bootstrapWorld = {
  players: {},
  clubs: qualificationWorld.clubs,
  leagueTables: {},
  competitionsBySeason: {}
};
const bootstrapCompetitions = sandbox.window.__lwTestSimulateCompetitions(
  bootstrapWorld, 1, qualificationDb, currentQualificationStandings
);
const bootstrapTournament = bootstrapCompetitions.find(row => row.id === "test-caf-qualification");
assert.ok(bootstrapTournament, "the first season must bootstrap continental entry from its completed domestic tables");
assert.deepEqual([...bootstrapTournament.participants].sort(), expectedBootstrapIds.sort(),
  "first-season continental entry must follow the current table when no previous season exists");

const noStandingsCompetitions = sandbox.window.__lwTestSimulateCompetitions(
  { players: {}, clubs: qualificationWorld.clubs, leagueTables: {}, competitionsBySeason: {} },
  5, qualificationDb, {}
);
assert.equal(noStandingsCompetitions.length, 0,
  "continental entrants must not be invented from club power when no qualifying standings exist");

const configuredContinentalPlaces = new Map(db.simulationCupDefinitions()
  .filter(def => def.kind === "continental")
  .map(def => [def.id, Array.from(def.qualificationPlaces || [])]));
assert.deepEqual(configuredContinentalPlaces.get("caf-cl"), [1, 2]);
assert.deepEqual(configuredContinentalPlaces.get("caf-confed"), [3, 4]);
assert.deepEqual(configuredContinentalPlaces.get("libertadores"), [1, 2, 3, 4]);
assert.deepEqual(configuredContinentalPlaces.get("sudamericana"), [5, 6, 7, 8, 9, 10]);


// Malformed world schema metadata must never crash loading or erase a valid saved world.
const schemaGuardDb = {
  version: 1,
  leagues: () => [],
  clubs: () => [],
  playerRecordsForClub: () => []
};
function createSchemaGuardFixture(overrides = {}) {
  const player = {
    id: "schema-guard-player", name: "Schema Guard Player", clubId: "",
    country: "Testland", position: "وسط", group: "midfielder",
    age: 24, ovr: 60, potential: 72, retired: false, freeAgent: false
  };
  const world = {
    schemaVersion: ai.version, dbVersion: 1, currentSeason: 4, lastAdvancedTo: 4,
    lastCompletedSeason: 3, lastDevelopedSeason: 3, lastFreeAgentMarketSeason: 4,
    completedSeasons: [3], clubs: {}, players: { "schema-guard-player": player },
    playerHistory: {}, transferClubHistoryByPlayer: {}, seasonStats: {}, leagueTables: {},
    matchesBySeason: {}, competitionsBySeason: {}, transfers: [], marketReports: [],
    notes: [], archive: {}, nextGeneratedPlayer: 1, transferSequence: 0,
    projectionRevision: 0, rosterSchemaVersion: 3, rosterMembershipSchemaVersion: 6,
    transferClubHistorySchemaVersion: 1
  };
  Object.assign(world, overrides);
  return { save: { season: 4, worldSimulation: world }, world, player };
}
const olderSchemaFixture = createSchemaGuardFixture({ schemaVersion: Math.max(0, ai.version - 1) });
const olderSchemaResult = ai.ensureState(olderSchemaFixture.save, schemaGuardDb);
assert.strictEqual(olderSchemaResult, olderSchemaFixture.world,
  "older world schemas must be upgraded in place instead of replacing the saved world");
assert.strictEqual(olderSchemaResult.players["schema-guard-player"], olderSchemaFixture.player,
  "in-place schema upgrades must preserve existing player records");
assert.equal(olderSchemaResult.schemaVersion, ai.version,
  "a supported older world schema must be marked with the current schema version");

const deferredOlderSchemaFixture = createSchemaGuardFixture({
  schemaVersion: Math.max(0, ai.version - 1),
  archive: ["legacy-archive-payload"]
});
const deferredOlderSchemaResult = ai.ensureState(deferredOlderSchemaFixture.save, schemaGuardDb);
assert.strictEqual(deferredOlderSchemaResult, deferredOlderSchemaFixture.world,
  "a malformed archive must defer an older-schema migration without replacing the saved world");
assert.equal(deferredOlderSchemaResult.schemaVersion, Math.max(0, ai.version - 1),
  "the schema marker must not advance when in-place migration is deferred");

const futureSchemaFixture = createSchemaGuardFixture({
  schemaVersion: ai.version + 1,
  completedSeasons: { futureSeasonMarkers: [5, 6] },
  transfers: { futureTransferRows: [{ id: "future-transfer" }] },
  matchesBySeason: ["future-match-history"],
  aiMetadata: ["future-ai-metadata"]
});
const futureSchemaSnapshot = JSON.stringify(futureSchemaFixture.world);
const futureSchemaResult = ai.ensureState(futureSchemaFixture.save, schemaGuardDb);
assert.strictEqual(futureSchemaResult, futureSchemaFixture.world,
  "a future world schema must not trigger a destructive world reseed");
assert.strictEqual(futureSchemaResult.players["schema-guard-player"], futureSchemaFixture.player,
  "loading a future world schema must preserve existing player records");
assert.equal(futureSchemaResult.schemaVersion, ai.version + 1,
  "an older client must not downgrade a future world schema marker");
assert.equal(JSON.stringify(futureSchemaResult), futureSchemaSnapshot,
  "an older client must leave every field in a future-schema world unchanged");
assert.equal(ai.isFutureWorldSchema(futureSchemaResult), true,
  "the public world API must identify a newer save format");
const futureCompletion = ai.completeSeason(futureSchemaFixture.save, 5, schemaGuardDb);
assert.equal(futureCompletion.futureSchema, true,
  "season completion must remain read-only for a future world schema");
const futureAdvance = ai.advanceToSeason(futureSchemaFixture.save, 5, schemaGuardDb);
assert.equal(futureAdvance.futureSchema, true,
  "season advancement and transfer windows must remain read-only for a future world schema");
const futureDashboard = ai.dashboard(futureSchemaFixture.save, schemaGuardDb);
assert.equal(futureDashboard.futureSchema, true,
  "the dashboard must expose a safe read-only summary for a future world schema");
assert.deepEqual(ai.recruitmentNeeds(futureSchemaFixture.save, schemaGuardDb), [],
  "recruitment analysis must not rewrite future-schema club AI metadata");
assert.deepEqual(ai.seasonMatches(futureSchemaFixture.save, 5, schemaGuardDb), [],
  "future-schema fixture reads must not generate or rewrite matches");
assert.deepEqual(ai.seasonCompetitions(futureSchemaFixture.save, 5, schemaGuardDb), [],
  "future-schema competition reads must not generate or rewrite competitions");
let futureTransferCallbackRan = false;
const futureTransaction = ai.withTransferMarketTransaction(futureSchemaFixture.world, () => {
  futureTransferCallbackRan = true;
  futureSchemaFixture.world.futureTransferMutation = true;
});
assert.equal(futureTransaction.futureSchema, true,
  "direct transfer transactions must be blocked for a future world schema");
assert.equal(futureTransferCallbackRan, false,
  "a future-schema world must never enter a transfer transaction");
ai.rememberTransferClubEndpoints(futureSchemaFixture.world, {
  playerId: "schema-guard-player", from: "Old Club", to: "New Club"
});
assert.equal(JSON.stringify(futureSchemaFixture.world), futureSchemaSnapshot,
  "all public world operations must leave a future-schema save unchanged");

const hostileSchemaVersion = {
  toString() { throw new Error("unsafe world schema string coercion"); },
  valueOf() { throw new Error("unsafe world schema numeric coercion"); }
};
const malformedSchemaFixture = createSchemaGuardFixture({
  schemaVersion: hostileSchemaVersion,
  lastAdvancedTo: Symbol("invalid-last-advanced-season"),
  rosterSchemaVersion: Symbol("invalid-roster-schema"),
  rosterMembershipSchemaVersion: Symbol("invalid-roster-membership-schema")
});
let malformedSchemaResult;
assert.doesNotThrow(() => {
  malformedSchemaResult = ai.ensureState(malformedSchemaFixture.save, schemaGuardDb);
}, "untrusted world schema metadata must not throw or force a destructive world reseed");
assert.strictEqual(malformedSchemaResult, malformedSchemaFixture.world,
  "a structurally valid saved world must survive malformed schema metadata");
assert.strictEqual(malformedSchemaResult.players["schema-guard-player"], malformedSchemaFixture.player,
  "schema metadata recovery must preserve existing player records");
assert.strictEqual(malformedSchemaResult.schemaVersion, hostileSchemaVersion,
  "unreadable schema metadata must remain untouched rather than being coerced");
assert.equal(malformedSchemaResult.currentSeason, 4,
  "an unreadable last-advanced marker must fall back to the saved career season");
assert.equal(malformedSchemaResult.lastAdvancedTo, 0,
  "an invalid last-advanced marker must normalize safely to zero");
assert.equal(malformedSchemaResult.rosterSchemaVersion, 3,
  "an invalid roster schema marker must run the existing roster reconciliation");
assert.equal(malformedSchemaResult.rosterMembershipSchemaVersion, 6,
  "an invalid roster-membership marker must run the existing membership migration");
assert.equal(malformedSchemaResult.nextGeneratedPlayer, 1,
  "schema metadata recovery with no clubs must not create replacement players");

const symbolSchemaFixture = createSchemaGuardFixture({ schemaVersion: Symbol("invalid-world-schema") });
assert.doesNotThrow(() => ai.ensureState(symbolSchemaFixture.save, schemaGuardDb),
  "a Symbol world schema version must be handled without Number(Symbol)");
assert.strictEqual(symbolSchemaFixture.save.worldSimulation, symbolSchemaFixture.world,
  "a Symbol schema marker must not replace the existing world save");
assert.strictEqual(symbolSchemaFixture.world.players["schema-guard-player"], symbolSchemaFixture.player,
  "a Symbol schema marker must not discard saved players");

const malformedStringSchemaFixture = createSchemaGuardFixture({
  schemaVersion: "unrecognized-world-schema"
});
let malformedStringSchemaResult;
assert.doesNotThrow(() => {
  malformedStringSchemaResult = ai.ensureState(malformedStringSchemaFixture.save, schemaGuardDb);
}, "an invalid primitive schema string must not trigger a destructive world reseed");
assert.strictEqual(malformedStringSchemaResult, malformedStringSchemaFixture.world,
  "an unparseable schema string must preserve the existing world object");
assert.strictEqual(malformedStringSchemaResult.players["schema-guard-player"], malformedStringSchemaFixture.player,
  "an unparseable schema string must preserve existing player records");
assert.strictEqual(malformedStringSchemaResult.schemaVersion, "unrecognized-world-schema",
  "unparseable schema metadata must remain untouched rather than being coerced");

const nonFiniteSchemaFixture = createSchemaGuardFixture({ schemaVersion: Number.NaN });
let nonFiniteSchemaResult;
assert.doesNotThrow(() => {
  nonFiniteSchemaResult = ai.ensureState(nonFiniteSchemaFixture.save, schemaGuardDb);
}, "a non-finite numeric schema marker must not trigger a destructive world reseed");
assert.strictEqual(nonFiniteSchemaResult, nonFiniteSchemaFixture.world,
  "a non-finite schema marker must preserve the existing world object");
assert.strictEqual(nonFiniteSchemaResult.players["schema-guard-player"], nonFiniteSchemaFixture.player,
  "a non-finite schema marker must preserve existing player records");
assert.ok(Number.isNaN(nonFiniteSchemaResult.schemaVersion),
  "non-finite schema metadata must remain untouched");

const throwingSchemaAccessorFixture = createSchemaGuardFixture();
function installThrowingSchemaAccessor(record, field) {
  Object.defineProperty(record, field, {
    configurable: true,
    enumerable: true,
    get() { throw new Error("unsafe saved schema getter: " + field); }
  });
}
["schemaVersion", "lastAdvancedTo", "rosterSchemaVersion", "rosterMembershipSchemaVersion"]
  .forEach(field => installThrowingSchemaAccessor(throwingSchemaAccessorFixture.world, field));
let throwingSchemaResult;
assert.doesNotThrow(() => {
  throwingSchemaResult = ai.ensureState(throwingSchemaAccessorFixture.save, schemaGuardDb);
}, "throwing schema metadata getters must not abort saved-world loading");
assert.strictEqual(throwingSchemaResult, throwingSchemaAccessorFixture.world,
  "throwing schema metadata getters must not trigger a replacement world");
assert.strictEqual(throwingSchemaResult.players["schema-guard-player"], throwingSchemaAccessorFixture.player,
  "throwing schema metadata getters must preserve existing player records");
assert.doesNotThrow(() => ai.dashboard(throwingSchemaAccessorFixture.save, schemaGuardDb),
  "dashboard and projection-cache reads must remain safe after loading getter-only schema metadata");
["schemaVersion", "lastAdvancedTo", "rosterSchemaVersion", "rosterMembershipSchemaVersion"]
  .forEach(field => {
    const descriptor = Object.getOwnPropertyDescriptor(throwingSchemaResult, field);
    assert.equal(typeof descriptor.get, "function",
      "a getter-only malformed " + field + " marker must remain intact after safe loading");
    assert.equal(descriptor.set, undefined,
      "schema recovery must not require a setter for " + field);
  });

console.log("PASS: persistent football world has " + clubCount + " clubs and " + playerCount
  + " players; " + transition.moves.length + " needs-based AI transfers; season stats, tables, and one-time progression all reconcile.");
