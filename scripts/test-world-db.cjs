"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "public", "football-world-db.js"), "utf8");
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "football-world-db.js" });
const db = sandbox.window.LWWorldDB;
assert.ok(db);
assert.equal(db.version, 2);
assert.equal(db.season, "2026/27");
assert.equal(db.leagues().length, 15);
assert.equal(db.leagueFor("مصر", 1).matchesPerSeason, 34);
assert.equal(db.leagueFor("إنجلترا", 1).matchesPerSeason, 38);
assert.equal(db.leagueFor("ألمانيا", 1).matchesPerSeason, 34);
assert.equal(db.leagueFor("إسبانيا", 1).matchesPerSeason, 38);
assert.equal(db.leagueFor("مصر", 2).globalTier, 4);
assert.equal(db.leagueFor("مصر", 2).matchesPerSeason, 22);
assert.ok(db.clubs().length >= 65, "world database should contain first- and second-division clubs");
assert.ok(db.clubsForCountry("مصر", 2).some(club => club.name === "المقاولون العرب" && club.ovr === 62),
  "Egyptian second-division clubs should be queryable");
assert.ok(db.playerRecordsForClub("ليفربول", "إنجلترا").some(player => player.name === "فلوريان فيرتز"),
  "player records should be generated from curated real squad names");
assert.ok(!db.playersForClub("ليفربول", "إنجلترا").includes("محمد صلاح"),
  "2026/27 Liverpool highlights should not retain the stale Mohamed Salah entry");
assert.equal(db.playerByName("لامين يامال", "إسبانيا").clubName, "برشلونة");

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
console.log("PASS: world database loads 15 leagues, 50+ club ratings/stars and country-specific competitions.");
