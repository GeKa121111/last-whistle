"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const output = path.join(root, "dist");
const sourceData = path.join(root, "source", "public", "data");
const rootData = path.join(root, "data");
const publicData = path.join(publicDir, "data");

// Root-level files are the canonical app entry points. Sync them into public before
// packaging so GitHub Pages and the static build cannot silently diverge.
const canonicalCopies = [
  ["index.html", "index.html"],
  ["football-world-db.js", "football-world-db.js"],
  ["football-world-rosters.js", "football-world-rosters.js"],
  ["world-roster-audit.json", "world-roster-audit.json"],
  ["sw.js", "sw.js"]
];

for (const [sourceName, publicName] of canonicalCopies) {
  const sourcePath = path.join(root, sourceName);
  if (!fs.existsSync(sourcePath)) throw new Error("Canonical source is missing: " + sourceName);
  fs.copyFileSync(sourcePath, path.join(publicDir, publicName));
}

if (!fs.existsSync(sourceData)) throw new Error("source/public/data is missing");
fs.mkdirSync(rootData, { recursive: true });
fs.cpSync(sourceData, rootData, { recursive: true, force: true });
fs.mkdirSync(publicData, { recursive: true });
fs.cpSync(sourceData, publicData, { recursive: true, force: true });

if (!fs.existsSync(path.join(publicDir, "index.html"))) {
  throw new Error("public/index.html is missing");
}

for (const [sourceName, publicName] of canonicalCopies) {
  const sourceText = fs.readFileSync(path.join(root, sourceName));
  const publicText = fs.readFileSync(path.join(publicDir, publicName));
  if (!sourceText.equals(publicText)) throw new Error("Root/public source drift: " + sourceName);
}

for (const required of [
  "global-catalog.js",
  "career-engine.js",
  "match-engine.js",
  "snapshots/fifa-global-2023.json.gz.b64",
  "snapshots/openfootball-clubs.json.gz.b64",
  "snapshots/football-reference.json.gz.b64",
  "snapshots/awards.json.gz.b64"
]) {
  if (!fs.existsSync(path.join(publicData, required))) {
    throw new Error("Required source data was not copied into public/data: " + required);
  }
}

// Only the generated output directory is recreated; source/project files are never removed.
fs.rmSync(output, { recursive: true, force: true });
fs.cpSync(publicDir, output, { recursive: true });
for (const required of ["index.html", "sw.js", "data/global-catalog.js", "data/match-engine.js"]) {
  if (!fs.existsSync(path.join(output, required))) throw new Error("Build output is incomplete: " + required);
}
console.log("Static build ready at dist/ (canonical root/public files synchronized; data snapshots included).");
