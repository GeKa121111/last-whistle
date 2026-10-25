"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

for (const file of [
  "football-world-db.js",
  "public/football-world-db.js",
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
for (const file of ["index.html", "football-world-db.js", "football-world-rosters.js", "world-roster-audit.json", "sw.js"]) {
  assert.equal(read(file), read(path.join("public", file)), "root/public canonical file drift: " + file);
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
