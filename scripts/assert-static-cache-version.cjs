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
