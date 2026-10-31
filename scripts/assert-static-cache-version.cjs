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
  const minimumCacheVersion = 284;
  const cacheVersion = module.exports(serviceWorker, minimumCacheVersion);
  const requiredAssets = [
    ["career-state-store.js", 2],
    ["football-world-ai.js", 37],
    ["football-world-worker.js", 26],
    ["transfer-awards-engine.js", 10]
  ];
  requiredAssets.forEach(([asset, minimum]) => {
    const assetSource = asset === "football-world-worker.js"
      ? fs.readFileSync(path.join(root, "football-world-ai.js"), "utf8")
      : html;
    module.exports.assertAssetVersionAtLeast(assetSource, asset, minimum);
  });
  console.log("Static cache v" + cacheVersion + " and " + requiredAssets.length + " versioned app assets verified.");
}
