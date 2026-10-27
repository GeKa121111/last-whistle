"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const worldDbSource = fs.readFileSync(path.join(root, "public", "football-world-db.js"), "utf8");
const start = html.indexOf("function cupParticipants(comp,count){");
const end = html.indexOf("\nfunction cupConfig", start);
assert.ok(start >= 0 && end > start, "cup participant builder must exist");
const source = html.slice(start, end) + "\nthis.cupParticipants = cupParticipants;";
assert.ok(!source.includes("نادي مشارك"), "cup generation must not invent placeholder clubs");
assert.ok(html.includes('if(teams.length<cfg.teams){toast("بيانات الأندية الحقيقية المتاحة لا تكفي لإطلاق البطولة. لم تتم إضافة أندية وهمية.");return;}'),
  "a cup must be blocked rather than started with fabricated participants");

const rosterLists = {
  "مصر": { 1: ["النادي الحالي", "فريق محلي 1"], 2: ["فريق محلي 2"] },
  "إنجلترا": { 1: ["فريق إنجليزي"], 2: [] }
};
const sandbox = {
  window: {},
  state: { leagueCountry: "مصر" },
  LEAGUE_ROSTERS: rosterLists,
  clubNameForLeague: () => "النادي الحالي",
  console
};
vm.createContext(sandbox);
vm.runInContext(worldDbSource, sandbox, { filename: "football-world-db.js" });
const db = sandbox.window.LWWorldDB;
assert.ok(db && typeof db.clubs === "function", "real world club database must be available");
const worldClubs = db.clubNames();
assert.ok(worldClubs.every(club => club && club.name && !Object.prototype.hasOwnProperty.call(club, "players")),
  "the cup selector must use lightweight club metadata without generating or copying player lists");
assert.ok(worldClubs.length >= 32, "the world database must provide enough real clubs for supported cups");
vm.runInContext(source, sandbox, { filename: "cup-participants" });

const count = 32;
const currentClub = "النادي الحالي";
const cupTeam = "فريق الكأس";
const worldOnly = worldClubs.find(club => club && club.name
  && ![currentClub, cupTeam, "فريق محلي 1", "فريق محلي 2", "فريق إنجليزي"].includes(club.name));
assert.ok(worldOnly, "world database should contain a real club beyond the local fixture");
const participants = Array.from(sandbox.cupParticipants({ teams: [currentClub, cupTeam] }, count));
assert.equal(participants.length, count, "a cup should be filled from real clubs to its configured size");
assert.equal(participants[0], currentClub, "the player's club must remain the first participant");
assert.ok(participants.includes(cupTeam), "official competition participants must be retained");
assert.ok(participants.includes("فريق محلي 1"), "local league clubs must remain eligible");
assert.ok(participants.includes(worldOnly.name), "the real world club database must fill missing participants");
assert.equal(new Set(participants).size, participants.length, "cup participants must be unique");
assert.ok(!participants.some(name => /^نادي مشارك \d+$/.test(name)), "no placeholder club may enter the cup");

const sparse = {
  window: { LWWorldDB: { clubNames: () => [] } },
  state: { leagueCountry: "مصر" },
  LEAGUE_ROSTERS: { "مصر": { 1: [currentClub, "نادي حقيقي 2"], 2: [] } },
  clubNameForLeague: () => currentClub
};
vm.createContext(sparse);
vm.runInContext(source, sparse, { filename: "cup-participants-sparse" });
const sparseParticipants = Array.from(sparse.cupParticipants({ teams: [currentClub, "نادي حقيقي 3"] }, 10));
assert.deepEqual(sparseParticipants, [currentClub, "نادي حقيقي 3", "نادي حقيقي 2"],
  "if source data is insufficient, return only real clubs and let startCup block the tournament");
console.log("PASS: cup participants use real world clubs, preserve configured teams, and never fabricate placeholder clubs.");
