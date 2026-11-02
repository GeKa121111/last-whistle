"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const rootHtml = read("index.html");
const publicHtml = read("public/index.html");
assert.equal(rootHtml, publicHtml, "root and public app shells must be byte-identical after the static build");

function extractInlineEngine(html, marker, label) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, label + " inline engine marker must exist");
  assert.equal(html.indexOf(marker, start + marker.length), -1, label + " marker must occur exactly once");
  const openEnd = html.indexOf(">", start) + 1;
  const close = html.indexOf("</script>", openEnd);
  assert.ok(openEnd > start && close > openEnd, label + " inline script block must be well-formed");
  return html.slice(openEnd, close).trim();
}

const engines = [
  {
    file: "career-engine.js",
    marker: "<script>\n/* Shared career progression and award engine for LAST WHISTLE. */",
    label: "career"
  },
  {
    file: "match-engine.js",
    marker: "<script>\n/* Deterministic, shared event-based match simulation for LAST WHISTLE. No DOM or storage. */",
    label: "match"
  }
];

for (const engine of engines) {
  const canonical = read("source/public/data/" + engine.file).trim();
  assert.equal(read("data/" + engine.file).trim(), canonical,
    engine.file + " root data copy must match its canonical source");
  assert.equal(read("public/data/" + engine.file).trim(), canonical,
    engine.file + " public data copy must match its canonical source");
  assert.equal(extractInlineEngine(rootHtml, engine.marker, engine.label), canonical,
    engine.file + " inline runtime must match the canonical source byte-for-byte");
}

const careerSource = read("source/public/data/career-engine.js");
assert.match(careerSource, /const realLeagueClubs\s*=/,
  "season awards must consider real clubs in the player's current division");
assert.match(careerSource, /LWTransferAwards\?\.simulatePlayerSeason/,
  "real-player award candidates must use the shared transfer-awards simulator");

console.log("PASS: canonical career/match engines, inline app runtime, generated data copies, and public shell stay synchronized.");
