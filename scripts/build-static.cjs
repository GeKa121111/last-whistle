"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const output = path.join(root, "dist");
const sourceData = path.join(root, "source", "public", "data");
const rootData = path.join(root, "data");
const requiredSourceData = [
  "SNAPSHOTS_AR.md",
  "career-engine.js",
  "global-catalog.js",
  "match-engine.js",
  "snapshots/fifa-global-2023.json.gz.b64",
  "snapshots/openfootball-clubs.json.gz.b64",
  "snapshots/football-reference.json.gz.b64",
  "snapshots/awards.json.gz.b64"
];

for (const required of requiredSourceData) {
  const sourcePath = path.join(sourceData, required);
  if (!fs.existsSync(sourcePath)) {
    throw new Error("Canonical source data is missing: source/public/data/" + required);
  }
}
const publicData = path.join(publicDir, "data");

// Root-level files are the canonical app entry points. Sync them into public before
// packaging so GitHub Pages and the static build cannot silently diverge.
const canonicalCopies = [
  ["index.html", "index.html"],
  ["agent-system.css", "agent-system.css"],
  ["agent-system.js", "agent-system.js"],
  ["ai-career-engine.js", "ai-career-engine.js"],
  ["ai-career-ui.js", "ai-career-ui.js"],
  ["ai-career.css", "ai-career.css"],
  ["app-icon.svg", "app-icon.svg"],
  ["career-experience.css", "career-experience.css"],
  ["career-experience.js", "career-experience.js"],
  ["career-hub.css", "career-hub.css"],
  ["career-hub.js", "career-hub.js"],
  ["career-state-store.js", "career-state-store.js"],
  ["football-world-ai.css", "football-world-ai.css"],
  ["football-world-ai.js", "football-world-ai.js"],
  ["football-world-db.js", "football-world-db.js"],
  ["football-world-rosters.js", "football-world-rosters.js"],
  ["football-world-worker.js", "football-world-worker.js"],
  ["lz-string.min.js", "lz-string.min.js"],
  ["manifest.webmanifest", "manifest.webmanifest"],
  ["player-store.css", "player-store.css"],
  ["redesign.css", "redesign.css"],
  ["social-media.css", "social-media.css"],
  ["social-media.js", "social-media.js"],
  ["story-mode.js", "story-mode.js"],
  ["story-ui.css", "story-ui.css"],
  ["transfer-awards-engine.js", "transfer-awards-engine.js"],
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

for (const required of requiredSourceData) {
  const sourcePath = path.join(sourceData, required);
  const rootPath = path.join(rootData, required);
  const publicPath = path.join(publicData, required);
  if (!fs.existsSync(publicPath)) {
    throw new Error("Required source data was not copied into public/data: " + required);
  }
  const canonical = fs.readFileSync(sourcePath);
  if (!fs.readFileSync(rootPath).equals(canonical)) {
    throw new Error("Root data drift after source sync: " + required);
  }
  if (!fs.readFileSync(publicPath).equals(canonical)) {
    throw new Error("Public data drift after source sync: " + required);
  }
}

// Only the generated output directory is recreated; source/project files are never removed.
fs.rmSync(output, { recursive: true, force: true });
fs.cpSync(publicDir, output, { recursive: true });
for (const required of ["index.html", "sw.js", "data/global-catalog.js", "data/match-engine.js"]) {
  if (!fs.existsSync(path.join(output, required))) throw new Error("Build output is incomplete: " + required);
}
for (const required of requiredSourceData) {
  if (!fs.readFileSync(path.join(output, "data", required)).equals(fs.readFileSync(path.join(sourceData, required)))) {
    throw new Error("Built data does not match canonical source: " + required);
  }
}
console.log("Static build ready at dist/ (canonical root/public files synchronized; data snapshots included).");
