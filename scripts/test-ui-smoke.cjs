const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "public", "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const rootHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
if (rootHtml !== html) { console.error("Root index.html and public/index.html are out of sync."); process.exit(1); }
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
  "career-hub.css?v=1",
  "career-hub.js?v=1",
  "player-store.css?v=2",
  "agent-system.js?v=1",
  "agent-system.css?v=1",
  'id="shopFilters"',
  'id="storeBalance"',
  "function applyStorePurchaseBonus",
  'id:"creatorStudio"',
  'id:"sleepCoach"',
  "storyPendingId",
  "window.LWStoryRuntime =",
  'class="page active"',
  "saved.calendarDay",
  "restored.schemaVersion=8;",
  "state.schemaVersion=8;",
  "state.dailyActionDay=Math.max(1,Number(state.day)||1);"
];
const missing = required.filter((token) => !html.includes(token));
const staticMarkupForRefs = html.replace(/<script\b[\s\S]*?<\/script>/gi, "")
  .replace(/<style\b[\s\S]*?<\/style>/gi, "")
  .replace(/<!--[\s\S]*?-->/g, "");
const staticIdsForRefs = new Set([...staticMarkupForRefs.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]));
const literalDomRefs = new Set();
for (const pattern of [
  /\$\(["']([^"']+)["']\)/g,
  /setText\(["']([^"']+)["']/g,
  /setBar\(["']([^"']+)["']/g
]) {
  for (const match of html.matchAll(pattern)) literalDomRefs.add(match[1]);
}
const runtimeGeneratedIds = new Set(["realPlayerTeam", "realPlayerNames"]);
const dynamicIdPrefixes = ["skill-", "val-"];
const missingDomRefs = [...literalDomRefs].filter((id) =>
  !staticIdsForRefs.has(id) && !runtimeGeneratedIds.has(id) && !dynamicIdPrefixes.some((prefix) => id.startsWith(prefix))
);
if (missingDomRefs.length) {
  console.error("JavaScript references missing static DOM IDs:", missingDomRefs.join(", "));
  process.exit(1);
}

const staticMarkup = html.replace(/<script\b[\s\S]*?<\/script>/gi, "")
  .replace(/<style\b[\s\S]*?<\/style>/gi, "")
  .replace(/<!--[\s\S]*?-->/g, "");
const staticIds = [...staticMarkup.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
const duplicateIds = [...new Set(staticIds.filter((id, index) => staticIds.indexOf(id) !== index))];
if (duplicateIds.length) { console.error("Duplicate static HTML IDs:", duplicateIds.join(", ")); process.exit(1); }
for (const page of ["home", "training", "stats", "wellness", "league", "europe", "contract", "national", "shop", "life", "diary"]) {
  if (!html.includes('data-page="' + page + '"') || !html.includes('id="page-' + page + '"')) {
    console.error("Navigation target is missing or unlinked:", page); process.exit(1);
  }
}
if (!html.includes('Math.floor((Math.max(1,oldDay)-1)/7)') || !html.includes('Math.floor((Math.max(1,newDay)-1)/7)')) {
  console.error("Weekly wage must be paid after seven full elapsed days."); process.exit(1);
}
if (!html.includes('if(state.winterBreakPending){openWinterMarket();return;}')) {
  console.error("Recovery must respect the pending winter-break decision."); process.exit(1);
}
const weeklyCrossings = (startDay, days) =>
  Math.floor((Math.max(1, startDay + days) - 1) / 7) -
  Math.floor((Math.max(1, startDay) - 1) / 7);
if (weeklyCrossings(1, 6) !== 0 || weeklyCrossings(1, 7) !== 1 ||
    weeklyCrossings(8, 6) !== 0 || weeklyCrossings(8, 7) !== 1) {
  console.error("Weekly wage boundary regression check failed."); process.exit(1);
}
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
const careerHubSource = fs.readFileSync(path.join(root, "public", "career-hub.js"), "utf8");
try { new vm.Script(careerHubSource, { filename: "public/career-hub.js" }); }
catch (error) { console.error("Career hub JavaScript syntax error:", error.message); process.exit(1); }
for (const marker of ["wellnessReadinessScore", "statusTrust", "statusRelation", "winterBreakPending", "dailyActionDay"]) {
  if (!careerHubSource.includes(marker)) { console.error("Career hub integration test failed. Missing marker:", marker); process.exit(1); }
}
for (const asset of ["story-ui.css", "story-mode.js", "career-experience.css", "career-experience.js", "agent-system.css", "agent-system.js", "career-hub.css", "career-hub.js", "player-store.css", "sw.js"]) {
  const rootAsset = fs.readFileSync(path.join(root, asset), "utf8");
  const publicAsset = fs.readFileSync(path.join(root, "public", asset), "utf8");
  if (rootAsset !== publicAsset) { console.error("Root/public asset mirror mismatch:", asset); process.exit(1); }
}
const workerSource = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
for (const assetUrl of ["story-ui.css?v=1", "story-mode.js?v=1", "career-experience.css?v=1", "career-experience.js?v=1", "agent-system.css?v=1", "agent-system.js?v=1", "career-hub.css?v=1", "career-hub.js?v=1", "player-store.css?v=2"]) {
  if (!workerSource.includes(assetUrl)) { console.error("Offline app shell is missing cache-busted asset:", assetUrl); process.exit(1); }
}
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



const pageIds = [...html.matchAll(/<section class="page(?: active)?" id="page-([^"]+)"/g)].map((match) => match[1]);
const routeBlockStart = html.indexOf("function showPage(page){");
const routeBlockEnd = html.indexOf("\nfunction openDrawer", routeBlockStart);
if (routeBlockStart < 0 || routeBlockEnd < 0) { console.error("Navigation test failed: showPage route handler is missing."); process.exit(1); }
const routeBlock = html.slice(routeBlockStart, routeBlockEnd);
const routeMatch = routeBlock.match(/const valid=\[(.*?)\]\.includes\(page\)/);
if (!routeMatch) { console.error("Navigation test failed: allowed-page list could not be read."); process.exit(1); }
const allowedPages = [...routeMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
for (const page of pageIds) {
  if (!allowedPages.includes(page)) { console.error("Navigation test failed: page is not accepted by showPage:", page); process.exit(1); }
}
for (const page of new Set([...html.matchAll(/data-page=["']([^"']+)["']/g)].map((match) => match[1]))) {
  if (!pageIds.includes(page)) { console.error("Navigation test failed: data-page button points to missing page:", page); process.exit(1); }
}

const transferWindowStart = html.indexOf("function transferWindow(){");
const transferWindowEnd = html.indexOf("\nfunction cupParticipants", transferWindowStart);
if (transferWindowStart < 0 || transferWindowEnd < 0) { console.error("Transfer test failed: transferWindow function is missing."); process.exit(1); }
const transferWindowSource = html.slice(transferWindowStart, transferWindowEnd).trim();
function evaluateTransferWindow(state) {
  const sandbox = { state, seasonMatchTotal: () => 38 };
  vm.createContext(sandbox);
  vm.runInContext(transferWindowSource, sandbox, { filename: "transferWindow" });
  return sandbox.transferWindow();
}
const summerAfterAppearances = evaluateTransferWindow({ calendarDay: 15, season: 1, seasonApps: 2, winterBreakPending: false, freeAgent: false });
if (!summerAfterAppearances.open || summerAfterAppearances.name !== "الانتقالات الصيفية") {
  console.error("Transfer test failed: summer window must remain open after the first appearances.", JSON.stringify(summerAfterAppearances)); process.exit(1);
}
const closedWindow = evaluateTransferWindow({ calendarDay: 100, season: 1, seasonApps: 12, winterBreakPending: false, freeAgent: false });
if (closedWindow.open || closedWindow.days !== 54) { console.error("Transfer test failed: closed-window countdown is incorrect.", JSON.stringify(closedWindow)); process.exit(1); }
const winterPause = evaluateTransferWindow({ calendarDay: 100, season: 2, seasonApps: 19, winterBreakPending: true, freeAgent: false });
if (!winterPause.open || winterPause.id !== "winter-season-2") { console.error("Transfer test failed: a pending winter break must open the transfer window.", JSON.stringify(winterPause)); process.exit(1); }

const journeyStart = html.indexOf("function renderSeasonJourney(){");
const journeyEnd = html.indexOf("\nfunction renderPerformanceInsights", journeyStart);
const journeySource = html.slice(journeyStart, journeyEnd);
if (journeyStart < 0 || journeyEnd < 0 || journeySource.includes("if(false)")) {
  console.error("Journey test failed: journey renderer is missing or dead CTA code remains."); process.exit(1);
}
for (const marker of ['btn.onclick=()=>openWinterMarket()', 'transferBtn.disabled=!!state.retired', 'btn.textContent="راجع الانتقالات"']) {
  if (!journeySource.includes(marker)) { console.error("Journey test failed: missing transfer CTA behavior:", marker); process.exit(1); }
}
if (!html.includes("function transferEligibilityReason(target){") || !html.includes("transferMarketNotice")) {
  console.error("Transfer test failed: actionable eligibility reasons or market status are missing."); process.exit(1);
}
if (!html.includes('else if(action==="coach")b.disabled=!!state.retired||!canUseDailyAction();') || !html.includes("else b.disabled=!!state.retired;")) {
  console.error("Action reset test failed: non-match actions must be re-enabled after starting a new career."); process.exit(1);
}


const favoriteClickBindings = [...html.matchAll(/\$\("leagueCatalog"\)\.addEventListener\("click"/g)].length;
if (favoriteClickBindings !== 1) {
  console.error("Listener regression failed: leagueCatalog must have one delegated click listener, found", favoriteClickBindings);
  process.exit(1);
}

// Exercise transfer gating with controlled state instead of merely searching for function names.
const eligibilityStart = html.indexOf("function transferEligibilityReason(target){");
const eligibilityEnd = html.indexOf("\nfunction transferChance(target){", eligibilityStart);
if (eligibilityStart < 0 || eligibilityEnd < 0) {
  console.error("Transfer integration test failed: transfer eligibility helper boundaries missing.");
  process.exit(1);
}
const eligibilitySource = html.slice(eligibilityStart, eligibilityEnd);
function evaluateTransferEligibility(state, options = {}) {
  const sandbox = {
    state,
    activeCupInProgress: () => !!options.cupActive,
    transferWindow: () => options.window || { open: true, name: "الانتقالات الصيفية", days: 0 },
    transferAverageRating: () => options.average == null ? 6.5 : options.average,
    transferFactors: () => options.factors || { ageAdjustment: 0, contractAdjustment: 0, currentRoleAdjustment: 0, positionAdjustment: 0, targetRoleAdjustment: 0 },
    overall: () => options.overall == null ? 70 : options.overall
  };
  vm.createContext(sandbox);
  vm.runInContext(eligibilitySource, sandbox, { filename: "transferEligibility" });
  return sandbox.transferEligibilityReason({ club: "Next FC", country: "Egypt", power: 75 });
}
const transferReadyState = {
  retired: false, careerStarted: true, loan: null, clubName: "Current FC", leagueCountry: "Egypt",
  apps: 2, daysSinceTransfer: 9, transferCooldown: 0, trust: 50, freeAgent: false
};
if (evaluateTransferEligibility({ ...transferReadyState }) !== "") {
  console.error("Transfer integration test failed: eligible player should pass gating.");
  process.exit(1);
}
if (!evaluateTransferEligibility({ ...transferReadyState, apps: 1 }).includes("مباراتين")) {
  console.error("Transfer integration test failed: appearance gate should explain the two-match requirement.");
  process.exit(1);
}
if (!evaluateTransferEligibility({ ...transferReadyState }, { window: { open: false, name: "السوق مغلق", days: 17 } }).includes("17 يوم")) {
  console.error("Transfer integration test failed: closed market should explain the opening countdown.");
  process.exit(1);
}
if (!evaluateTransferEligibility({ ...transferReadyState, loan: { parentClub: "Parent FC" } }).includes("معار")) {
  console.error("Transfer integration test failed: active loan should block permanent transfer with a clear reason.");
  process.exit(1);
}
if (!evaluateTransferEligibility({ ...transferReadyState, trust: 10 }).includes("20/100")) {
  console.error("Transfer integration test failed: low trust should explain the threshold.");
  process.exit(1);
}

// Execute the actual transfer-review modal action and prove that the review routes to contracts.
const reviewStart = html.indexOf("function openWinterMarket(){");
const reviewEnd = html.indexOf("\nfunction resumeManualSeason(){", reviewStart);
if (reviewStart < 0 || reviewEnd < 0) {
  console.error("Transfer review integration test failed: modal function boundaries missing.");
  process.exit(1);
}
const reviewSource = html.slice(reviewStart, reviewEnd);
function exerciseTransferReview(winterBreak) {
  const sandbox = {
    state: { retired: false, freeAgent: false, weeklyWage: 400, contractSeasons: 2, apps: 5, winterBreakPending: winterBreak, journeyTransferReviewed: false, season: 1, day: 10 },
    transferWindow: () => ({ open: !winterBreak, name: winterBreak ? "السوق مغلق" : "الانتقالات الصيفية", days: 0 }),
    seasonMatchTotal: () => 38,
    log: () => {},
    saveGame: () => {},
    render: () => {},
    showPage: (page) => { sandbox.lastPage = page; },
    openModal: (title, message, choices) => { sandbox.lastModal = { title, message, choices }; },
    resumeManualSeason: () => { sandbox.resumed = true; },
    simulateSeasonBlock: () => { sandbox.simulated = true; },
    toast: (message) => { sandbox.lastToast = message; }
  };
  vm.createContext(sandbox);
  vm.runInContext(reviewSource, sandbox, { filename: "openWinterMarket" });
  sandbox.openWinterMarket();
  return sandbox;
}
const normalReview = exerciseTransferReview(false);
if (!normalReview.lastModal || normalReview.lastModal.choices[0].label !== "مراجعة العقد والسوق") {
  console.error("Transfer review integration test failed: normal market review action missing.");
  process.exit(1);
}
normalReview.lastModal.choices[0].action();
if (normalReview.lastPage !== "contract" || normalReview.state.journeyTransferReviewed !== true) {
  console.error("Transfer review integration test failed: review action must mark the milestone and open contracts.");
  process.exit(1);
}
const winterReview = exerciseTransferReview(true);
if (!winterReview.lastModal || !winterReview.lastModal.choices.some(choice => choice.label === "أكمل بالمباريات اليدوية")
    || !winterReview.lastModal.choices.some(choice => choice.label.startsWith("حاكي آخر"))) {
  console.error("Transfer review integration test failed: winter pause must expose continuation paths.");
  process.exit(1);
}

console.log("UI smoke test passed: career setup, redesigned story UI assets, main pages, professional-life and interactive career systems, and JavaScript syntax.");
