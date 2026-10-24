const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "public", "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const required = [
  'id="startName"',
  'id="page-home"',
  'id="page-training"',
  'id="page-stats"',
  'id="page-wellness"',
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
  "career-experience.js?v=1",
  "career-experience.css?v=1",
  "agent-system.js?v=1",
  "agent-system.css?v=1",
  "career-hub.js?v=1",
  "career-hub.css?v=1",
  "player-store.css?v=2",
  'id="shopFilters"',
  'id="storeBalance"',
  'function applyStorePurchaseBonus',
  'id:"creatorStudio"',
  'id:"sleepCoach"',
  "storyPendingId",
  "window.LWStoryRuntime =",
  'class="page active"'
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
for (const asset of ["sw.js", "manifest.webmanifest", "app-icon.svg", "story-ui.css", "story-mode.js", "career-experience.css", "career-experience.js", "agent-system.css", "agent-system.js", "career-hub.css", "career-hub.js", "player-store.css"]) {
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

const agentSource = fs.readFileSync(path.join(root, "public", "agent-system.js"), "utf8");
try { new vm.Script(agentSource, { filename: "public/agent-system.js" }); } catch (error) { console.error("Agent system JavaScript syntax error:", error.message); process.exit(1); }
for (const marker of ["حسام الجندي", "نادين فريد", "سيف مراد", "كريم منصور", "رامي رأفت", "سليم فوزي", "currentChapter", "contractTerms", "prioritizeTargets", "chargeFee"]) { if (!agentSource.includes(marker)) { console.error("Agent-system smoke test failed. Missing marker:", marker); process.exit(1); } }
const hubSource = fs.readFileSync(path.join(root, "public", "career-hub.js"), "utf8");
try { new vm.Script(hubSource, { filename: "public/career-hub.js" }); } catch (error) { console.error("Career hub JavaScript syntax error:", error.message); process.exit(1); }
for (const marker of ["wellnessReadinessScore", "wellnessTrustBar", "homeReadinessHint", "coachRelationship", "wellnessDailyActionLabel"]) { if (!hubSource.includes(marker)) { console.error("Career hub smoke test failed. Missing marker:", marker); process.exit(1); } }
const experienceSource = fs.readFileSync(path.join(root, "public", "career-experience.js"), "utf8");
try {
  new vm.Script(experienceSource, { filename: "public/career-experience.js" });
} catch (error) {
  console.error("Career experience JavaScript syntax error:", error.message);
  process.exit(1);
}
for (const marker of ["data-lwcx-action", "careerWorld", "open-penalty", "open-timing", "open-memory", "invest-safe", "invest-risky", "mentor-coach", "open-legacy", "settleInvestments"]) {
  if (!experienceSource.includes(marker)) {
    console.error("Career experience test failed. Missing marker:", marker);
    process.exit(1);
  }
}

for (const marker of ["id:\"speedBoots\"", "id:\"strengthProgram\"", "id:\"videoAnalyst\"", "id:\"homeGym\"", "id:\"physio\"", "id:\"recoveryRoom\"", "id:\"privateChef\"", "id:\"homeUpgrade\"", "id:\"sportsPsych\"", "id:\"mediaTraining\"", "id:\"stylist\"", "id:\"charityFoundation\"", "data-shop-category=\"field\"", "data-shop-category=\"development\"", "data-shop-category=\"recovery\"", "data-shop-category=\"life\""]) {
  if (!html.includes(marker)) { console.error("Player store smoke test failed. Missing marker:", marker); process.exit(1); }
}
const storeCssPath = path.join(root, "public", "player-store.css");
if (!fs.existsSync(storeCssPath) || fs.statSync(storeCssPath).size < 1000) {
  console.error("Player store smoke test failed: player-store.css is missing or unexpectedly small.");
  process.exit(1);
}

console.log("UI smoke test passed: career setup, redesigned story UI assets, main pages, professional-life and interactive career systems, and JavaScript syntax.");
