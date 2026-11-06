"use strict";

const assert = require("node:assert/strict");

module.exports = function assertStaticCacheVersionAtLeast(serviceWorkerSource, minimumVersion) {
  const match = String(serviceWorkerSource).match(/last-whistle-static-v(\d+)/);
  assert.ok(match, "service worker must declare a versioned static cache");
  const actualVersion = Number(match[1]);
  assert.ok(Number.isSafeInteger(actualVersion) && actualVersion >= minimumVersion,
    `static cache version must be at least v${minimumVersion}; found v${match[1]}`);
  return actualVersion;
};

module.exports.assertAssetVersionAtLeast = function assertAssetVersionAtLeast(source, assetName, minimumVersion) {
  const escapedName = String(assetName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(source).match(new RegExp(escapedName + "\\?v=(\\d+)"));
  assert.ok(match, `source must reference a versioned ${assetName} asset`);
  const actualVersion = Number(match[1]);
  assert.ok(Number.isSafeInteger(actualVersion) && actualVersion >= minimumVersion,
    `${assetName} asset version must be at least v${minimumVersion}; found v${match[1]}`);
  return actualVersion;
};

if (require.main === module) {
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.resolve(__dirname, "..");
  const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const minimumCacheVersion = 550;
  assert.ok(
    /url\.indexOf\("football-world-ai\.js\?"\)\s*>=\s*0/.test(serviceWorker)
      && /url\.indexOf\("football-world-db\.js\?"\)\s*>=\s*0/.test(serviceWorker)
      && /url\.indexOf\("football-world-worker\.js\?"\)\s*>=\s*0/.test(serviceWorker)
      && /url\.indexOf\("transfer-awards-engine\.js\?"\)\s*>=\s*0/.test(serviceWorker)
      && /url\.indexOf\("season-objectives\.js\?"\)\s*>=\s*0/.test(serviceWorker)
      && /url\.indexOf\("team-dynamics\.js\?"\)\s*>=\s*0/.test(serviceWorker)
      && /url\.indexOf\("social-media\.js\?"\)\s*>=\s*0/.test(serviceWorker)
      && /url\.indexOf\("data\/match-engine\.js\?"\)\s*>=\s*0/.test(serviceWorker),
    "updated world AI, database, worker, and award engine modules must bypass the browser HTTP cache during a new static-cache install");
  const cacheVersion = module.exports(serviceWorker, minimumCacheVersion);
  const requiredAssets = [
    ["career-state-store.js", 8],
    ["ai-career-engine.js", 7],
    ["data/career-engine.js", 79],
    ["data/match-engine.js", 83],
    ["football-world-ai.js", 86],
    ["football-world-db.js", 11],
    ["football-world-worker.js", 75],
    ["transfer-awards-engine.js", 27],
    ["ui-organization.css", 5],
    ["career-experience.js", 9],
    ["career-experience.css", 2],
    ["story-mode.js", 14],
    ["agent-system.js", 9],
    ["career-hub.css", 2],
    ["season-objectives.js", 2],
    ["team-dynamics.js", 3],
    ["social-media.js", 4]
  ];
  requiredAssets.forEach(([asset, minimum]) => {
    const assetSource = asset === "football-world-worker.js"
      ? fs.readFileSync(path.join(root, "football-world-ai.js"), "utf8")
      : asset === "football-world-db.js" || asset === "data/career-engine.js" || asset === "data/match-engine.js" || asset === "social-media.js" ? serviceWorker : html;
    module.exports.assertAssetVersionAtLeast(assetSource, asset, minimum);
  });
  console.log("Static cache v" + cacheVersion + " and " + requiredAssets.length + " versioned app assets verified.");
}
