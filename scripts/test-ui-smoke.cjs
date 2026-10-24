const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "public", "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const required = [
  'id="startName"',
  'id="page-home"',
  'id="page-life"',
  'id="page-league"',
  'id="page-contract"',
  'id="page-national"',
  'id="page-diary"',
  'id="pressHumble"',
  "function professionalLifeAction",
  "function startCareerFromSetup",
  "function simulateCareerMatch",
  "story-ui.css?v=1",
  "story-mode.js?v=1",
  "storyPendingId"
];
const missing = required.filter((token) => !html.includes(token));
if (missing.length) {
  console.error("UI smoke test failed. Missing markers:", missing.join(", "));
  process.exit(1);
}

const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
let inlineCount = 0;
for (const [, attrs, body] of scripts) {
  if (/\bsrc\s*=/.test(attrs) || !body.trim()) continue;
  inlineCount++;
  try {
    new vm.Script(body, { filename: "public/index.html:inline-script" });
  } catch (error) {
    console.error("Inline JavaScript syntax error:", error.message);
    process.exit(1);
  }
}
if (!inlineCount) {
  console.error("UI smoke test failed: no inline application script found.");
  process.exit(1);
}
for (const asset of ["sw.js", "manifest.webmanifest", "app-icon.svg", "story-ui.css", "story-mode.js"]) {
  if (!fs.existsSync(path.join(root, "public", asset))) {
    console.error("Missing public asset:", asset);
    process.exit(1);
  }
}
const storySource = fs.readFileSync(path.join(root, "public", "story-mode.js"), "utf8");
try {
  new vm.Script(storySource, { filename: "public/story-mode.js" });
} catch (error) {
  console.error("Story JavaScript syntax error:", error.message);
  process.exit(1);
}
console.log("UI smoke test passed: career setup, redesigned story UI assets, main pages, professional-life UI, and JavaScript syntax.");
