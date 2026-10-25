"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const rosterSource = fs.readFileSync(path.join(root, "public", "football-world-rosters.js"), "utf8");
const audit = JSON.parse(fs.readFileSync(path.join(root, "public", "world-roster-audit.json"), "utf8"));
const source = fs.readFileSync(path.join(root, "public", "football-world-db.js"), "utf8");
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(rosterSource, sandbox, { filename: "football-world-rosters.js" });
vm.runInContext(source, sandbox, { filename: "football-world-db.js" });
const snapshot = sandbox.window.LWFootballSquadData;
assert.ok(snapshot && snapshot.season === "2026/27", "checked-in current-season roster snapshot must load");
const snapshotClubs = (snapshot.leagues || []).flatMap(league => league.clubs || []);
const snapshotPlayers = snapshotClubs.reduce((sum, club) => sum + (club.players || []).length, 0);
assert.ok(snapshot.leagues.length >= 10, "current rosters should cover at least ten major league divisions");
assert.ok(snapshotClubs.length >= 210, "current roster snapshot should cover at least 210 clubs");
assert.ok(snapshotPlayers >= 3500, "current roster snapshot should include at least 3500 player records");
assert.equal(audit.status, "complete", "roster audit must not be a placeholder");
assert.equal(audit.refreshRevision, 2, "snapshot audit must be refreshed after source alias updates");
assert.equal(snapshot.refreshRevision, 2, "squad data payload must carry the current refresh revision");
assert.equal(audit.allLeagueMinimumsMet, true, "every source league must meet its expected coverage threshold");
assert.equal(audit.totalTeams, snapshotClubs.length, "audit and checked-in snapshot team totals must agree");
assert.equal(audit.totalPlayers, snapshotPlayers, "audit and checked-in snapshot player totals must agree");
const db = sandbox.window.LWWorldDB;
assert.ok(db);
assert.equal(db.version, 3);
assert.equal(db.season, "2026/27");
assert.equal(db.leagues().length, 15);
assert.equal(db.leagueFor("مصر", 1).matchesPerSeason, 34);
assert.equal(db.leagueFor("إنجلترا", 1).matchesPerSeason, 38);
assert.equal(db.leagueFor("ألمانيا", 1).matchesPerSeason, 34);
assert.equal(db.leagueFor("إسبانيا", 1).matchesPerSeason, 38);
assert.equal(db.leagueFor("مصر", 2).globalTier, 4);
assert.equal(db.leagueFor("مصر", 2).matchesPerSeason, 22);
assert.ok(db.clubs().length >= 65, "world database should contain first- and second-division clubs");
const allClubs = db.clubs();
assert.ok(allClubs.length >= 150, "the expanded world database should cover major first divisions");
assert.ok(allClubs.every(club => Array.isArray(club.players) && club.players.length >= 16),
  "every club must expose a playable squad of at least 16 players");
assert.ok(allClubs.some(club => club.players.some(player => player.isGenerated === true && player.isRealPlayer === false)),
  "generated backup players must be explicitly marked as generated, not real");
assert.ok(allClubs.some(club => club.players.some(player => player.isRealPlayer === true)),
  "sourced or curated real player names must remain available");
const coverage = db.rosterCoverage();
assert.ok(coverage.totalDatabasePlayers >= allClubs.length * 16, "roster coverage audit must include complete playable squads");
assert.equal(coverage.totalClubs, allClubs.length);
const clubsWithSourcedRosters = coverage.leagues.reduce((sum, league) => sum + league.clubsWithCurrentRoster, 0);
assert.equal(coverage.importedClubs, snapshotClubs.length, "all clubs in the sourced snapshot must be imported into the game database");
assert.equal(clubsWithSourcedRosters, coverage.importedClubs, "the per-league roster audit must reconcile with imported club totals");
assert.ok(coverage.importedPlayers >= 3500, "the game catalogue must retain thousands of sourced current player records");
const argentinaCoverage = coverage.leagues.find(league => league.leagueId === "argentina" && league.division === 1);
assert.ok(argentinaCoverage, "Argentina top-flight needs a dedicated roster-coverage row");
assert.equal(argentinaCoverage.clubCount, 30, "Argentina sourced rosters must merge into the existing 30-club division without duplicate clubs");
assert.equal(argentinaCoverage.clubsWithCurrentRoster, 30, "all 30 Argentine first-division clubs must load a sourced roster");
assert.equal(argentinaCoverage.clubsNeedingRealRoster.length, 0, "no Argentine top-flight club should remain on generated-only backup players");
assert.ok(argentinaCoverage.realPlayers >= 700, "Argentina should contribute at least 700 sourced player records");
console.log("ROSTER_DATABASE_AUDIT " + JSON.stringify({
  totalClubs: coverage.totalClubs,
  playableSquadPlayers: coverage.totalDatabasePlayers,
  sourcedClubs: coverage.importedClubs,
  sourcedPlayers: coverage.importedPlayers,
  totalRealPlayerEntries: coverage.totalRealPlayers,
  generatedPlayerEntries: coverage.totalGeneratedPlayers,
  leagues: coverage.leagues.map(league => ({
    leagueId: league.leagueId, division: league.division, clubCount: league.clubCount,
    sourcedRosters: league.clubsWithCurrentRoster, partialRosters: league.clubsWithPartialRoster,
    clubsNeedingSourcedRoster: league.clubsNeedingRealRoster.length,
    sourcedPlayers: league.realPlayers, generatedPlayers: league.generatedPlayers
  }))
}));
assert.ok(db.clubsForCountry("مصر", 2).some(club => club.name === "المقاولون العرب" && club.ovr === 62),
  "Egyptian second-division clubs should be queryable");
assert.ok(db.playerRecordsForClub("ليفربول", "إنجلترا").some(player => player.name === "Florian Wirtz" && player.isRealPlayer === true),
  "Liverpool squad should include sourced 2026/27 player records");
assert.ok(!db.playersForClub("ليفربول", "إنجلترا").includes("محمد صلاح"),
  "2026/27 Liverpool highlights should not retain the stale Mohamed Salah entry");
assert.equal(db.playerByName("Lamine Yamal", "إسبانيا").clubName, "برشلونة");

assert.equal(db.clubByName("Al Ahly", "مصر").ovr, 78);
assert.equal(db.clubByName("Liverpool", "إنجلترا").name, "ليفربول");
assert.ok(db.clubByName("Real Madrid", "إسبانيا").stars.includes("كيليان مبابي"));
assert.ok(db.clubByName("River Plate", "الأرجنتين").stars.length >= 3);
const egypt = db.competitionsForCountry("مصر", { division: 1, clubName: "الأهلي", clubPower: 78 });
assert.ok(egypt.some(item => item.name === "الدوري المصري الممتاز" && item.kind === "league"));
assert.ok(egypt.some(item => item.name === "كأس مصر" && item.simulationSupported));
assert.ok(egypt.some(item => item.name === "CAF Champions League" && item.status === "qualification-pending"));
assert.ok(egypt.some(item => item.name === "FIFA Club World Cup" && item.status === "locked"));
const england = db.competitionsForCountry("إنجلترا", { division: 1, clubName: "ليفربول", clubPower: 90 });
assert.ok(england.some(item => item.name === "FA Cup"));
assert.ok(england.some(item => item.name === "UEFA Champions League"));
const brazil = db.competitionsForCountry("البرازيل", { division: 1, clubName: "فلامنغو", clubPower: 84 });
assert.ok(brazil.some(item => item.name === "Copa Libertadores"));
assert.ok(db.simulationCupDefinitions().some(item => item.name === "Copa do Brasil"));
assert.ok(db.simulationCupDefinitions().some(item => item.name === "Copa Argentina"));
assert.ok(db.simulationCupDefinitions().some(item => item.id === "uefa-super-cup" && item.system === "supercup"));
assert.ok(db.simulationCupDefinitions().some(item => item.id === "caf-super-cup" && item.system === "supercup"));
assert.ok(db.competitionsForCountry("مصر", { division: 1, clubName: "الأهلي", clubPower: 78 })
  .some(item => item.id === "caf-super-cup" && item.kind === "supercup"));

assert.equal(db.clubByName("not-a-real-club", "مصر"), null);
console.log("PASS: world database loads complete playable squads, generated-player labels and country-specific competitions.");
