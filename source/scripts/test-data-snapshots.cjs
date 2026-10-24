#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const snapshotRoot = path.join(root, "public", "data", "snapshots");
const expected = {
  "fifa-global-2023.json.gz.b64": {
    check(data) {
      assert.equal(data.sourceYear, "2023");
      assert.equal(data.associations.length, 211);
    }
  },
  "openfootball-clubs.json.gz.b64": {
    check(data) {
      assert.equal(data.latestDomesticCompetitions.length, 18);
      assert.equal(data.coverage.distinctDomesticClubNames, 340);
      assert.equal(data.license, "CC0-1.0");
    }
  },
  "football-reference.json.gz.b64": {
    check(data) {
      assert.equal(data.officialCompetitions.length, 36);
    }
  },
  "awards.json.gz.b64": {
    check(data) {
      assert.equal(data.officialAwards.length, 57);
      assert.equal(data.careerSimulationAwards.length, 4);
    }
  }
};

for (const [filename, definition] of Object.entries(expected)) {
  const encoded = fs.readFileSync(path.join(snapshotRoot, filename), "utf8").trim();
  assert.ok(encoded.length > 0, filename + " must not be empty");
  assert.match(encoded, /^[A-Za-z0-9+/]+={0,2}$/, filename + " must be base64");
  const bytes = Buffer.from(encoded, "base64");
  const jsonText = zlib.gunzipSync(bytes).toString("utf8");
  const data = JSON.parse(jsonText);
  definition.check(data);
}

global.window = global;
global.fetch = async (pathname) => {
  const basename = String(pathname).split("/").pop();
  const content = fs.readFileSync(path.join(snapshotRoot, basename), "utf8");
  return { ok: true, status: 200, text: async () => content };
};
require(path.join(root, "public", "data", "global-catalog.js"));

(async () => {
  const summary = await global.LWCatalog.load();
  assert.equal(summary.fifaAssociations, 211);
  assert.equal(summary.sourcedLeagueRosters, 18);
  assert.equal(summary.sourcedClubs, 340);
  assert.equal(summary.officialCompetitions, 36);
  assert.equal(summary.officialAwards, 57);
  assert.equal(summary.partialData, false);
  assert.equal(global.LWCatalog.directoryRows().length, 211);
  assert.equal(global.LWCatalog.simulatedAwards().length, 4);
  console.log("PASS: all 4 gzip/base64 snapshots decompress, JSON schemas match, and LWCatalog loads 211 associations, 18 rosters, 340 club names, 36 competitions, and 57 official award records.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
