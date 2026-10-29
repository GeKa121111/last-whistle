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
