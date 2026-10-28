"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const { parseAge, seasonReferenceDate, parseTeamLinks, fetchHtml } = require(path.join(root, "scripts", "refresh-world-squads.cjs"));
assert.equal(parseAge("01/07/2008"), 18, "league-season age should be evaluated at the 1 July season start");
assert.equal(parseAge("02/07/2008"), 17, "a birthday after season start must not age a player early");
assert.equal(parseAge("01/07/08"), 18, "two-digit birth years should use the same season reference date");
assert.equal(parseAge("01/01/2008", seasonReferenceDate("2026 Apertura")), 18,
  "calendar-year Apertura squads should use the source season's January reference date");
assert.equal(parseAge("02/01/2008", seasonReferenceDate("2026 Apertura")), 17,
  "calendar-year season birthdays must be compared against the calendar-year reference date");
assert.equal(parseAge("not-a-date"), null, "unparseable birth dates must remain unknown");
const parsedSquadLinks = parseTeamLinks([
  '<a href="/premier/club-a.htm">Club A</a>',
  '<a href="/premier/club-b.html">Club B</a>',
  '<a href="/premier/club-c.htm">Club C</a>',
  '<a href="/premier/index.html">Home</a>',
  '<a href="/outside/club-d.html">Outside Club</a>',
  '<a href="https://outside.example/premier/club-e.html">External Club</a>'
].join("\n"), "https://footballsquads.co.uk/premier/index.htm", "/premier/");
assert.deepEqual(parsedSquadLinks.map(team => team.name).sort(), ["Club A", "Club B", "Club C"],
  "squad parser must accept .htm/.html pages only from the source host and configured league directory");

for (const file of [
  "football-world-db.js",
  "public/football-world-db.js",
  "football-world-ai.js",
  "public/football-world-ai.js",
  "football-world-worker.js",
  "public/football-world-worker.js",
  "source/public/data/global-catalog.js",
  "scripts/build-static.cjs",
  "scripts/refresh-world-squads.cjs",
  "scripts/refresh-egyptian-pro-league.cjs",
  "sw.js",
  "public/sw.js"
]) {
  assert.doesNotThrow(() => new vm.Script(read(file), { filename: file }), file + " must have valid JavaScript syntax");
}

const worldWindow = {};
const sandbox = {
  window: worldWindow,
  console,
  Math,
  Number,
  String,
  Object,
  Array,
  Set,
  Map
};
vm.runInNewContext(read("public/football-world-rosters.js"), sandbox, { filename: "public/football-world-rosters.js" });
worldWindow.LWCatalog = {
  ratingProfile(country, fallback) {
    const confederation = country === "مصر" || country === "Egypt" ? "CAF" : (fallback.confederation || "UEFA");
    return { confederation, coefficient: confederation === "CAF" ? 0.955 : 1, catalogMatched: true };
  }
};
vm.runInNewContext(read("public/football-world-db.js"), sandbox, { filename: "public/football-world-db.js" });
const db = worldWindow.LWWorldDB;
assert.ok(db, "world database should initialize");
assert.equal(db.normalizeRating(80, { baseline: 60, coefficient: 1 }), 80);
assert.ok(db.normalizeRating(80, { baseline: 60, coefficient: 0.955 }) < 80, "continental coefficient should calibrate ratings toward a common baseline");
const egyptianClub = db.clubByName("الأهلي", "مصر");
assert.ok(egyptianClub, "Egyptian club should remain available");
assert.ok(Number.isFinite(egyptianClub.normalizedOvr), "club should expose a normalized rating");
assert.ok(egyptianClub.normalizedOvr <= egyptianClub.baseOvr, "CAF calibration must not inflate the base club rating");
assert.ok(egyptianClub.players.every(player => Number.isFinite(player.normalizedOvr)), "all players, including generated backups, need normalized ratings");
assert.equal(db.clubPower("الأهلي", "مصر"), egyptianClub.normalizedOvr, "clubPower should expose the normalized rating");

const build = spawnSync(process.execPath, [path.join(root, "scripts/build-static.cjs")], { cwd: root, encoding: "utf8" });
assert.equal(build.status, 0, "static build must succeed: " + (build.stderr || build.stdout));
for (const file of ["index.html", "football-world-db.js", "football-world-ai.js", "football-world-worker.js", "football-world-rosters.js", "world-roster-audit.json", "sw.js"]) {
  assert.equal(read(file), read(path.join("public", file)), "root/public canonical file drift: " + file);
}
for (const file of [
  "SNAPSHOTS_AR.md",
  "career-engine.js",
  "global-catalog.js",
  "match-engine.js",
  "snapshots/fifa-global-2023.json.gz.b64",
  "snapshots/openfootball-clubs.json.gz.b64",
  "snapshots/football-reference.json.gz.b64",
  "snapshots/awards.json.gz.b64"
]) {
  const canonical = fs.readFileSync(path.join(root, "source", "public", "data", file));
  assert.deepEqual(fs.readFileSync(path.join(root, "data", file)), canonical, "root data drift: " + file);
  assert.deepEqual(fs.readFileSync(path.join(root, "public", "data", file)), canonical, "public data drift: " + file);
}

for (const file of [
  "data/global-catalog.js",
  "data/career-engine.js",
  "data/match-engine.js",
  "data/snapshots/fifa-global-2023.json.gz.b64",
  "data/snapshots/openfootball-clubs.json.gz.b64",
  "data/snapshots/football-reference.json.gz.b64",
  "data/snapshots/awards.json.gz.b64"
]) {
  assert.ok(fs.existsSync(path.join(root, "dist", file)), "built static data missing: " + file);
}
const sw = read("public/sw.js");
const shellMatch = sw.match(/const APP_SHELL = (\[[\s\S]*?\]);/);
assert.ok(shellMatch, "service worker must declare its app shell");
const shell = vm.runInNewContext(shellMatch[1]);
for (const asset of shell) {
  const relative = asset.replace(/^\.\//, "").split("?")[0];
  assert.ok(fs.existsSync(path.join(root, "dist", relative)), "precache asset must exist in dist: " + asset);
}
console.log("PASS: continental rating normalization, generated-player coverage, canonical root/public sync, source data packaging, and service-worker precache coverage.");

const originalFetch = global.fetch;
(async () => {
  try {
    const blockedRequests = [];
    global.fetch = async (url, options = {}) => {
      blockedRequests.push({ url: String(url), redirect: options.redirect });
      return {
        status: 302,
        ok: false,
        url: String(url),
        headers: { get: name => String(name).toLowerCase() === "location" ? "https://outside.example/premier/club.html" : null },
        text: async () => ""
      };
    };
    await assert.rejects(
      fetchHtml("https://footballsquads.co.uk/premier/index.htm"),
      /blocked cross-origin roster redirect/i,
      "a trusted roster page must not redirect parsing to an external host"
    );
    assert.equal(blockedRequests.length, 1, "an external redirect must be rejected before any request to the external host");
    assert.equal(blockedRequests[0].redirect, "manual", "fetch must not automatically follow redirects");

    const safeRequests = [];
    global.fetch = async (url, options = {}) => {
      safeRequests.push({ url: String(url), redirect: options.redirect });
      if (safeRequests.length === 1) {
        return {
          status: 302,
          ok: false,
          url: String(url),
          headers: { get: name => String(name).toLowerCase() === "location" ? "/premier/final.htm" : null },
          text: async () => ""
        };
      }
      return {
        status: 200,
        ok: true,
        url: String(url),
        headers: { get: () => null },
        text: async () => "x".repeat(1500)
      };
    };
    const html = await fetchHtml("https://footballsquads.co.uk/premier/index.htm");
    assert.equal(html.length, 1500, "same-origin redirects should still load a valid roster page");
    assert.equal(safeRequests.length, 2, "a same-origin redirect should be followed exactly once");
    assert.ok(safeRequests.every(request => request.redirect === "manual"),
      "all redirect hops must remain under explicit origin validation");
    console.log("PASS: roster fetching rejects cross-origin redirects and permits safe same-origin redirects.");
  } finally {
    global.fetch = originalFetch;
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
