"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const auditPath = path.join(root, "world-roster-audit.json");
const snapshotPath = path.join(root, "football-world-rosters.js");
const scriptPath = path.join(__dirname, "refresh-world-squads.cjs");

const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
const source = fs.readFileSync(scriptPath, "utf8");
const configBlock = source.match(/const LEAGUES = \[([\s\S]*?)\n\];/);
assert.ok(configBlock, "roster source configuration must be discoverable");

const configuredLeagues = configBlock[1].split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => line.startsWith("{ id:") && line.includes("expectedTeams:"))
  .map(line => {
    const match = line.match(/\{\s*id:\s*"([^"]+)",\s*country:\s*"([^"]+)",\s*division:\s*(\d+),\s*url:\s*"([^"]+)".*?expectedTeams:\s*(\d+)(?:,\s*sourceSeason:\s*"([^"]+)")?/);
    assert.ok(match, "could not parse roster source configuration line: " + line);
    return {
      leagueId: match[1],
      country: match[2],
      division: Number(match[3]),
      sourceUrl: new URL(match[4], "https://footballsquads.co.uk").href,
      expectedTeams: Number(match[5]),
      sourceSeason: match[6] || audit.season
    };
  });

assert.ok(configuredLeagues.length > 0, "at least one roster source must be configured");
const expectedTeamsTotal = configuredLeagues.reduce((sum, league) => sum + league.expectedTeams, 0);
assert.equal(audit.status, "complete", "roster audit cannot remain a placeholder");
assert.equal(audit.allLeagueMinimumsMet, true, "every configured league must pass minimum squad coverage");
const supplementalCoverage = audit.supplementalCoverage || {};
const supplementalTeamCount = Object.values(supplementalCoverage).reduce((sum, row) => sum + Number(row.availablePagesConfigured || row.importedClubs || 0), 0);
assert.equal(audit.expectedTeamsTotal, expectedTeamsTotal + supplementalTeamCount,
  "roster audit must include configured source leagues and supplemental league sources");
assert.equal(audit.leagues.length, configuredLeagues.length + Object.keys(supplementalCoverage).length,
  "roster audit must include every configured and supplemental source league");

for (const expected of configuredLeagues) {
  const actual = audit.leagues.find(league =>
    league.leagueId === expected.leagueId && Number(league.division) === expected.division);
  assert.ok(actual, "missing source league in audit: " + expected.leagueId + " division " + expected.division);
  assert.equal(actual.sourceUrl, expected.sourceUrl, "stale source URL for " + expected.leagueId + " division " + expected.division);
  assert.equal(actual.sourceSeason || audit.season, expected.sourceSeason, "stale source season for " + expected.leagueId + " division " + expected.division);
  assert.equal(Number(actual.expectedTeams), expected.expectedTeams, "expected club count changed for " + expected.leagueId);
  assert.equal(Number(actual.clubs), expected.expectedTeams, "incomplete club coverage for " + expected.leagueId);
  assert.ok(Number(actual.players) >= Number(actual.clubs) * 12, "insufficient roster coverage for " + expected.leagueId);
}

assert.equal(audit.totalTeams, audit.leagues.reduce((sum, league) => sum + Number(league.clubs), 0),
  "audit totalTeams must reconcile with the league totals");
assert.equal(audit.totalPlayers, audit.leagues.reduce((sum, league) => sum + Number(league.players), 0),
  "audit totalPlayers must reconcile with the league totals");
for (const [key, supplement] of Object.entries(supplementalCoverage)) {
  const row = audit.leagues.find(league => league.leagueId === key && Number(league.division) === 1);
  assert.ok(row, "missing supplemental source league in audit: " + key);
  assert.equal(Number(row.clubs), Number(supplement.importedClubs), "supplemental club count does not reconcile for " + key);
  assert.equal(Number(row.players), Number(supplement.importedPlayers), "supplemental player count does not reconcile for " + key);
}
assert.ok(audit.totalTeams >= 360, "sourced roster snapshot must include at least 360 clubs across eligible UEFA, CAF and CONMEBOL leagues");
assert.ok(audit.totalPlayers >= 11000, "sourced roster snapshot must include at least 11000 player records across expanded current leagues");

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(snapshotPath, "utf8"), sandbox, { filename: "football-world-rosters.js" });
const snapshot = sandbox.window.LWFootballSquadData;
assert.ok(snapshot, "checked-in world-roster JavaScript must initialize");
assert.equal(snapshot.season, audit.season, "snapshot and audit seasons must agree");
assert.equal(snapshot.leagues.length, audit.leagues.length, "snapshot and audit league counts must agree");
assert.ok(!(audit.leagues || []).some(league => league.leagueId === "japan"),
  "AFC leagues must not remain in the roster audit");
assert.ok(!(snapshot.leagues || []).some(league => league.leagueId === "japan"),
  "AFC leagues must not remain in the checked-in roster snapshot");


const snapshotClubs = snapshot.leagues.flatMap(league => league.clubs || []);
const snapshotPlayers = snapshotClubs.reduce((sum, club) => sum + (club.players || []).length, 0);
assert.equal(snapshotClubs.length, audit.totalTeams, "snapshot club count must match the audit");
assert.equal(snapshotPlayers, audit.totalPlayers, "snapshot player count must match the audit");

for (const expected of configuredLeagues) {
  const actual = snapshot.leagues.find(league =>
    league.leagueId === expected.leagueId && Number(league.division) === expected.division);
  assert.ok(actual, "snapshot missing source league: " + expected.leagueId);
  assert.equal(actual.sourceUrl, expected.sourceUrl, "snapshot source URL must match current config");
  assert.equal(actual.sourceSeason || audit.season, expected.sourceSeason, "snapshot source season must match current config");
  assert.equal((actual.clubs || []).length, expected.expectedTeams,
    "snapshot must include every expected club for " + expected.leagueId);
}

console.log("Roster source audit passed: " + audit.totalTeams + " clubs / " + audit.totalPlayers
  + " sourced player records across " + configuredLeagues.length + " divisions.");
