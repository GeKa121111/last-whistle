const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "lz-string.min.js"), "utf8");
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "lz-string.min.js" });
const codec = sandbox.LZString;
assert.ok(codec && typeof codec.compressToUTF16 === "function" && typeof codec.decompressFromUTF16 === "function",
  "LZ-String UTF-16 codec must be available for local save compression");

const sample = JSON.stringify({
  game: "LAST WHISTLE",
  career: Array.from({ length: 2500 }, (_, i) => ({
    id: "player-" + i, name: i % 3 ? "Mohamed Salah" : "محمد صلاح",
    club: "Liverpool FC", country: "England", season: 1,
    appearances: i % 35, goals: i % 12, assists: i % 9,
    rating: 6.7 + (i % 20) / 10, realPlayer: true
  }))
});
const compressed = codec.compressToUTF16(sample);
assert.ok(compressed.length + 5 < sample.length * 0.55,
  "compression must materially reduce repeated world-simulation JSON (" + compressed.length + " vs " + sample.length + ")");
assert.equal(codec.decompressFromUTF16(compressed), sample,
  "compressed saves must round-trip exactly, including Unicode text");
console.log("Save-compression test passed: " + sample.length + " JSON chars -> " + compressed.length + " compressed chars.");
