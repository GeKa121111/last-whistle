"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const rootHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.equal(rootHtml, html, "root and public app shells must stay synchronized");

const start = html.indexOf("function compactSnapshotForStorage(");
const end = html.indexOf("\nfunction encodeStoredSave(", start);
assert.ok(start >= 0 && end > start, "storage compaction function must exist in the deployed app shell");

const sandbox = {};
vm.createContext(sandbox);
new vm.Script(html.slice(start, end), { filename: "compactSnapshotForStorage" }).runInContext(sandbox);
assert.equal(typeof sandbox.compactSnapshotForStorage, "function", "storage compaction must be callable");

const newestFirst = Array.from({ length: 15 }, (_, index) => ({
  season: 15 - index,
  moves: [{ promoted: "Club " + (15 - index), relegated: "Club " + index }]
}));
const input = {
  name: "Storage compaction regression",
  schemaVersion: 10,
  worldSimulation: {
    clubs: { club1: { id: "club1" } },
    players: { player1: { id: "player1", clubId: "club1" } },
    promotionHistory: newestFirst
  }
};

const compacted = sandbox.compactSnapshotForStorage(input);
assert.deepEqual(
  Array.from(compacted.worldSimulation.promotionHistory, row => row.season),
  [15, 14, 13, 12, 11, 10, 9, 8, 7, 6],
  "save compaction must preserve the newest ten promotion/relegation records"
);
assert.equal(
  JSON.stringify(input.worldSimulation.promotionHistory),
  JSON.stringify(newestFirst),
  "compaction must not mutate the live career's promotion history"
);
assert.equal(compacted.worldSimulation.clubs.club1.id, "club1");
assert.equal(compacted.worldSimulation.players.player1.id, "player1");

console.log("PASS: save compaction preserves the newest promotion/relegation records without mutating the live save.");
