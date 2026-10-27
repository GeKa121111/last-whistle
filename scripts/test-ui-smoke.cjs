const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "public", "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const rootHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
if (rootHtml !== html) { console.error("Root index.html and public/index.html are out of sync."); process.exit(1); }
const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const publicServiceWorker = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
if (serviceWorker !== publicServiceWorker) { console.error("Root sw.js and public/sw.js are out of sync."); process.exit(1); }
if (html.includes("قوائم الدرجة الأولى المتاحة مأخوذة من ملفات OpenFootball مع موسم ومصدر لكل دوري")) {
  console.error("Player creation must not show the OpenFootball catalog disclaimer."); process.exit(1);
}
if (!serviceWorker.includes('const CACHE_NAME = "last-whistle-static-v65";')) {
  console.error("Service-worker cache version must change when the offline shell is updated."); process.exit(1);
}
const storySource = fs.readFileSync(path.join(root, "public", "story-mode.js"), "utf8");
if (!storySource.includes("lastRenderedStoryPanelSignature")
  || !storySource.includes("storyPanelSignature===lastRenderedStoryPanelSignature")) {
  console.error("Story panel must avoid rebuilding unchanged interactive choices on every poll."); process.exit(1);
}
const shellStart = serviceWorker.indexOf("const APP_SHELL = [");
const shellEnd = serviceWorker.indexOf("];", shellStart);
if (shellStart < 0 || shellEnd < 0) { console.error("Service-worker APP_SHELL is missing."); process.exit(1); }
const shellSource = serviceWorker.slice(shellStart, shellEnd);
const normalizeAsset = value => value.replace("./", "").split("?")[0];
const cachedAssets = [...shellSource.matchAll(/["']([^"']+)["']/g)].map(match => normalizeAsset(match[1]));
const htmlTags = html.match(/<script[^>]+>|<link[^>]+>/g) || [];
const localAssets = htmlTags
  .flatMap(tag => [...tag.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(asset => asset[1]))
  .filter(asset => asset.startsWith("./"))
  .map(normalizeAsset);
const missingOfflineAssets = [...new Set(localAssets)].filter(asset => !cachedAssets.includes(asset));
if (missingOfflineAssets.length) {
  console.error("Required local assets missing from the offline app shell:", missingOfflineAssets.join(", "));
  process.exit(1);
}
const required = [
  'id="startName"',
  '<script src="./lz-string.min.js?v=1"></script>',
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
  "function seasonTrainingPerformanceFocus()",
  "const performanceFocus=seasonTrainingPerformanceFocus();",
  "function runSeasonAITtraining()",
  "function canAccessTransferMarket()",
  "function isNaturalWinterTransferWindow()",
  'if(canAccessTransferMarket()&&isNaturalWinterTransferWindow()&&seasonMatchTotal()>=8',
  "const developmentResult=runSeasonAITtraining();",
  "report.completedSeason=currentSeason",
  "transferButton.hidden=!transferVisible",
  "ensureSeasonDevelopmentSnapshot();",
  "const academyBeforeSeason=isYouthAcademyPlayer();",
  "const academySeason=isYouthAcademyPlayer()||state.academyReserve||state.academyGraduationPending;",
  'state.fixtureSchedule=buildFixtureSchedule(state.league);ensureSeasonDevelopmentSnapshot();',
  'const agingNote=window.LWCareer?window.LWCareer.applySeasonAging(state):"";if(agingNote)log(agingNote);',
  "تقرير تطور اللاعب بالـ AI",
  "seasonDevelopmentHistory",
  "positionDevelopmentPlan",
  "trainingFocusMultiplier",
  "positionDevelopmentCard",
  "evaluateSquadRole",
  "roleDecision.role",
  'id="statsPositionContext"',
  'id="statsGoalsPer90"',
  'id="statsAssistsPer90"',
  'id="statsMinutesPerAppearance"',
  'label:"مهاجم متحرك"',
  'label:"رأس حربة"',
  "function startingStatsForPosition",
  "function positionPerformanceImpact",
  'id:"xpMultiplier"',
  "const storeXPMultiplier = state.xpMultiplier ? 1.25 : 1;",
  "renderPositionDevelopment();",
  "goalkeeperTrainingButton.hidden=!isGoalkeeper",
  "homeReadinessHint",
  'const careerWelcomeBanner=document.querySelector(".hero")',
  'careerWelcomeBanner.hidden=!!state.careerStarted',
  "rosterCoverage",
  "totalDatabasePlayers",
  "totalGeneratedPlayers",
  "function startPostCareerPath(path)",
  "function openPostCareerMenu()",
  "function performPostCareerAction(action)",
  "data-post-career-menu",
  "state.postCareer",
  "dividendsDue",
  "const OVR_WEIGHTS",
  'label:"مهاجم متحرك"',
  'id:"رأس حربة",label:"رأس حربة"',
  "function displayPositionLabel(id)",
  'case "رأس حربة": return shots>=1',
  'id="skill-physical"',
  'data-action="train-physical"',
  'id="storeCurrency"',
  'id="headCurrency"',
  'id="kpiCurrency"',
  "currency: () => currencyLabel()",
  "schemaVersion:10",
  "renderPositionDevelopment",
  "story-ui.css?v=1",
  "story-mode.js?v=8",
  "career-experience.js?v=1",
  "career-experience.css?v=1",
  "career-hub.css?v=1",
  "career-hub.js?v=1",
  "player-store.css?v=2",
  "ai-career-engine.js?v=4",
  "football-world-ai.css?v=1",
  "football-world-ai.js?v=10",
  'id="worldAIHomePanel"',
  'id="worldAISimulationDashboard"',
  "window.LWWorldAI.advanceToSeasonAsync",
  "window.LWWorldAI?.completeSeason",
  "function renderWorldAIDashboard",
  "opponentTacticalIQ:opponentPlan.iq",
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
  "restored.schemaVersion=10;",
  "state.schemaVersion=10;",
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
const runtimeGeneratedIds = new Set(["realPlayerTeam", "realPlayerNames", "transferNegotiationPanel", "negotiationPatienceBar", "negotiationPressure", "negotiationPatienceText", "negotiationMonthlyEquivalent"]);
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

const renderStart = html.indexOf("function render(){");
const renderEnd = html.indexOf("function checkAction(", renderStart);
if (renderStart < 0 || renderEnd < 0) { console.error("Render performance regression test could not locate render()."); process.exit(1); }
const renderBody = html.slice(renderStart, renderEnd);
for (const marker of [
  'switch(page)',
  'case "home":',
  'case "training":',
  'case "stats":',
  'case "league":',
  'case "contract":',
  'case "national":',
  'case "shop":',
  'case "diary":',
  'case "europe":',
  'case "life":',
  'pageRoot.querySelectorAll("[data-action]")'
]) {
  if (!renderBody.includes(marker)) { console.error("Active-page render regression test failed. Missing marker:", marker); process.exit(1); }
}
if (renderBody.includes('renderAchievements();renderLeague();renderContract();renderNational();')) {
  console.error("Render performance regression: hidden pages must not all render for every player action."); process.exit(1);
}
if (!html.includes("let lastAchievementsRenderSignature") ||
    !html.includes("let lastSeasonJourneyRenderKey") ||
    !html.includes('box&&!box.querySelector("#realPlayerTeam")') ||
    !html.includes('addEventListener("input",scheduleGlobalCatalogRender)')) {
  console.error("UI performance regression: stable widgets must be cached and catalog searches must avoid full-page rerenders.");
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
for (const asset of ["sw.js", "manifest.webmanifest", "app-icon.svg", "story-ui.css", "story-mode.js", "career-experience.css", "career-experience.js", "agent-system.css", "agent-system.js", "career-hub.css", "career-hub.js", "player-store.css", "ai-career-engine.js", "football-world-ai.css", "football-world-ai.js", "lz-string.min.js"]) {
  if (!fs.existsSync(path.join(root, "public", asset))) {
    console.error("Missing public asset:", asset);
    process.exit(1);
  }
}
const storyModeSyntaxSource = fs.readFileSync(path.join(root, "public", "story-mode.js"), "utf8");
try {
  new vm.Script(storyModeSyntaxSource, { filename: "public/story-mode.js" });
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
for (const asset of ["story-ui.css", "story-mode.js", "career-experience.css", "career-experience.js", "agent-system.css", "agent-system.js", "career-hub.css", "career-hub.js", "player-store.css", "ai-career-engine.js", "football-world-ai.css", "football-world-ai.js", "lz-string.min.js", "redesign.css", "sw.js"]) {
  const rootAsset = fs.readFileSync(path.join(root, asset), "utf8");
  const publicAsset = fs.readFileSync(path.join(root, "public", asset), "utf8");
  if (rootAsset !== publicAsset) { console.error("Root/public asset mirror mismatch:", asset); process.exit(1); }
}

for (const asset of ["ai-career-engine.js", "ai-career-ui.js", "career-state-store.js", "football-world-worker.js", "football-world-ai.js"]) {
  const source = fs.readFileSync(path.join(root, "public", asset), "utf8");
  try { new vm.Script(source, { filename: "public/" + asset }); }
  catch (error) { console.error("Career AI JavaScript syntax error in " + asset + ":", error.message); process.exit(1); }
}
const aiEngineSource = fs.readFileSync(path.join(root, "public", "ai-career-engine.js"), "utf8");
for (const marker of ["coachAdvice", "recommendPlayerTactic", "chooseOpponentTactic", "recommendTransfers", "lifestyleAdvice", '"رأس حربة": ["shooting", "composure", "physical"]', '"مهاجم": ["dribbling", "speed", "vision"]']) {
  if (!aiEngineSource.includes(marker)) { console.error("Career AI engine is missing:", marker); process.exit(1); }
}
const worldAISource = fs.readFileSync(path.join(root, "public", "football-world-ai.js"), "utf8");
for (const marker of ["runTransferWindow", "completeSeason", "advanceToSeason", "seasonStats", "marketReports", "transferTargets", 'attacker: ["جناح", "مهاجم", "رأس حربة"]']) {
  if (!worldAISource.includes(marker)) { console.error("Football world AI engine is missing:", marker); process.exit(1); }
}
const squadRefreshSource = fs.readFileSync(path.join(root, "scripts", "refresh-world-squads.cjs"), "utf8");
for (const marker of ['["ST", "LS", "RS", "F"]', '["CF", "SS", "FW", "WF"]', '["LW", "RW", "LWF", "RWF"]']) {
  if (!squadRefreshSource.includes(marker)) { console.error("Sourced squad position normalization collapsed striker roles:", marker); process.exit(1); }
}
const redesignSource = fs.readFileSync(path.join(root, "public", "redesign.css"), "utf8");
if (!redesignSource.includes("article:not(.seasonJourneyCard):not(.world-ai-home)")) { console.error("Redesigned home must keep the world AI panel visible."); process.exit(1); }
const workerSource = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
if (!workerSource.includes("last-whistle-static-v65")) { console.error("Application runtime fix must refresh the service-worker cache."); process.exit(1); }
for (const assetUrl of ["story-ui.css?v=1", "story-mode.js?v=8", "career-experience.css?v=1", "career-experience.js?v=1", "agent-system.css?v=1", "agent-system.js?v=1", "career-hub.css?v=1", "career-hub.js?v=1", "player-store.css?v=2", "ai-career-engine.js?v=4", "football-world-ai.css?v=1", "football-world-ai.js?v=10", "football-world-rosters.js?v=6", "football-world-db.js?v=7", "lz-string.min.js?v=1", "career-state-store.js?v=1", "ai-career-ui.js?v=1", "football-world-worker.js?v=2", "world-roster-audit.json", "redesign.css?v=5"]) {
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
const routeBlockStart = html.indexOf("function showPage(page, scrollTop=true){");
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
if (closedWindow.open || closedWindow.days !== 84) { console.error("Transfer test failed: closed-window countdown is incorrect.", JSON.stringify(closedWindow)); process.exit(1); }
const staleWinterPause = evaluateTransferWindow({ calendarDay: 100, season: 2, seasonApps: 19, winterBreakPending: true, freeAgent: false });
if (staleWinterPause.open) { console.error("Transfer test failed: a stale pending winter pause must not force the market open outside January.", JSON.stringify(staleWinterPause)); process.exit(1); }
const winterPause = evaluateTransferWindow({ calendarDay: 190, season: 2, seasonApps: 19, winterBreakPending: true, freeAgent: false });
if (!winterPause.open || winterPause.id !== "winter-season-2") { console.error("Transfer test failed: a pending winter break must open only inside the natural January window.", JSON.stringify(winterPause)); process.exit(1); }

const simulatorStart = html.indexOf("function simulateSeasonBlock(targetApps){");
const simulatorEnd = html.indexOf("\nfunction ", simulatorStart + 1);
const simulatorSource = html.slice(simulatorStart, simulatorEnd);
if (simulatorStart < 0 || simulatorEnd < 0 || simulatorSource.includes("runSeasonAITtraining(")) {
  console.error("Season training regression: automated AI training must run once at season end, not once per simulated fixture."); process.exit(1);
}
const journeyStart = html.indexOf("function renderSeasonJourney(){");
const journeyEnd = html.indexOf("\nfunction renderPerformanceInsights", journeyStart);
const journeySource = html.slice(journeyStart, journeyEnd);
if (journeyStart < 0 || journeyEnd < 0 || journeySource.includes("if(false)")) {
  console.error("Journey test failed: journey renderer is missing or dead CTA code remains."); process.exit(1);
}
for (const marker of [
  'setJourneyAction(stageButton,"transfer-review","راجع الانتقالات")',
  'setJourneyAction(transferButton,state.retired?"retired":winterDecisionDue?"winter":"transfer-review"',
  "transferButton.hidden=!transferVisible",
  'transferButton.style.display=transferVisible?"":"none"'
]) {
  if (!journeySource.includes(marker)) { console.error("Journey test failed: missing stable transfer CTA behavior:", marker); process.exit(1); }
}
if (!html.includes("function runSeasonJourneyAction(action)")) { console.error("Journey action router is missing."); process.exit(1); }
if (html.includes('id="seasonStageAction" onclick=') || html.includes('id="seasonTransferAction" onclick=')) {
  console.error("Journey test failed: season CTAs must use stable registered handlers, not inline/dynamic onclick properties."); process.exit(1);
}
if (!html.includes('$("seasonStageAction").addEventListener("click",()=>runSeasonJourneyAction($("seasonStageAction").dataset.seasonAction||"season-block"))')
  || !html.includes('$("seasonTransferAction").addEventListener("click",()=>runSeasonJourneyAction($("seasonTransferAction").dataset.seasonAction||"transfer-review"))')) {
  console.error("Journey interaction test failed: stable button listeners are not registered."); process.exit(1);
}
if (!html.includes("function openTransferMarketPage(){") || !html.includes('market.scrollIntoView({behavior:"smooth",block:"start"})')) {
  console.error("Transfer CTA test failed: review button must open and scroll to the transfer market."); process.exit(1);
}
if (!html.includes("function ensureTransferOffers(){")
  || !html.includes("function beginTransferNegotiation(id){")
  || !html.includes("function renderNegotiationPanel(){")
  || !html.includes("data-submit-negotiation")
  || !html.includes("data-reject-offer")
  || html.includes("قائمة مقارنة الأندية")
  || html.includes("data-watch-club")) {
  console.error("Transfer offer test failed: negotiation flow is missing or old comparison UI remains."); process.exit(1);
}
if (!html.includes("function buildSeasonAwardCeremony(place){")
  || !html.includes("function renderAwardsLeaderboards(){")
  || !html.includes("function renderTrophyCabinet(){")
  || !html.includes('id="ballonDOrCeremony"')
  || !html.includes('id="goldenBootLeaderboard"')
  || !html.includes('id="playmakerLeaderboard"')) {
  console.error("Season awards test failed: ceremony, leaderboards, or trophy cabinet is missing."); process.exit(1);
}
if (!html.includes('src="./transfer-awards-engine.js?v=1"')
  || !html.includes("transferOffersWindowId")
  || !html.includes("awardCeremonies")
  || !html.includes("currentCompetitions")) {
  console.error("Persistence/integration test failed: transfer/award engine or new save defaults are missing."); process.exit(1);
}
const favoriteBindingCount = (html.match(/\$\("leagueCatalog"\)\.addEventListener\("click",favoriteHandler\)/g) || []).length;
if (favoriteBindingCount !== 1) { console.error("Event binding test failed: league favorite handler should be registered exactly once."); process.exit(1); }
if (!html.includes("function transferEligibilityReason(target){") || !html.includes("transferMarketNotice")) {
  console.error("Transfer test failed: actionable eligibility reasons or market status are missing."); process.exit(1);
}
const actionRenderStart = html.indexOf("function render(){");
const actionRenderEnd = html.indexOf("function checkAction(", actionRenderStart);
const activePageActionRender = actionRenderStart >= 0 && actionRenderEnd > actionRenderStart
  ? html.slice(actionRenderStart, actionRenderEnd) : "";
if (!activePageActionRender.includes('pageRoot.querySelectorAll("[data-action]")')
  || !activePageActionRender.includes('else if(action==="coach")button.disabled=!!state.retired||!canUseDailyAction();')
  || !activePageActionRender.includes("else button.disabled=!!state.retired;")) {
  console.error("Action reset test failed: visible-page non-match actions must be re-enabled after starting a new career.");
  process.exit(1);
}


const extractTopLevelFunction = (source, functionName) => {
  const start = source.indexOf("function " + functionName + "(");
  if (start < 0) throw new Error("Missing function for interaction test: " + functionName);
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next < 0 ? source.length : next);
};
const transferJourneyFunctions = [
  "setJourneyAction", "canAccessTransferMarket", "runSeasonJourneyAction", "renderSeasonJourney", "openTransferMarketPage"
].map((name) => extractTopLevelFunction(html, name)).join("\n");
const interactionState = {
  careerStarted: true, retired: false, age: 19, academyCareer: false, day: 3, calendarDay: 15, season: 1, seasonApps: 2,
  seasonGoals: 0, seasonAssists: 0, seasonPoints: 3, journeyTransferReviewed: false,
  journeySeasonReviewed: false, journeyEventSeen: false, winterBreakPending: false,
  freeAgent: false, diary: [], currentPage: "home", seasonSummary: ""
};
const interactionNodes = Object.create(null);
let interactionSaveCount = 0;
let marketScrollCount = 0;
let winterModalCount = 0;
let missingMarket = false;
const interactionMessages = [];
const interactionLogs = [];
function interactionNode(id) {
  if (!interactionNodes[id]) interactionNodes[id] = {
    id, textContent: "", innerHTML: "", title: "", disabled: false, hidden: false, style: Object.create(null),
    dataset: Object.create(null), attributes: Object.create(null), scrollIntoView() { if (id === "transferMarket") marketScrollCount++; },
    setAttribute(name, value) { this.attributes[name] = String(value); }
  };
  return interactionNodes[id];
}
const interactionSandbox = {
  state: interactionState,
  isYouthAcademyPlayer: () => !!interactionSandbox.state.academyCareer,
  openAcademyGraduationDecision: () => { winterModalCount++; },
  $: (id) => id === "transferMarket" && missingMarket ? null : interactionNode(id),
  setText: (id, value) => { interactionNode(id).textContent = String(value); },
  seasonMatchTotal: () => 38,
  seasonMidpoint: () => 19,
  transferWindow: () => {
    const day = Math.max(1, Number(interactionSandbox.state.calendarDay) || 1);
    const d = ((day - 1) % 365) + 1, year = Math.floor((day - 1) / 365);
    if (d <= 62) return { open: true, id: "summer-" + year, name: "الانتقالات الصيفية", days: 62 - d };
    if (d >= 184 && d <= 214) return { open: true, id: interactionSandbox.state.winterBreakPending ? "winter-season-" + interactionSandbox.state.season : "winter-" + year, name: "الانتقالات الشتوية", days: 214 - d };
    return { open: false, id: "closed-" + year, name: "السوق مغلق", days: d < 184 ? 184 - d : 365 - d + 1 };
  },
  saveGame: () => { interactionSaveCount++; return true; },
  showPage: (page) => { interactionState.currentPage = page; },
  log: (message) => interactionLogs.push(String(message)),
  toast: (message) => interactionMessages.push(String(message)),
  openWinterMarket: () => { winterModalCount++; },
  playSeasonBlock: () => { interactionState.playSeasonBlockCalled = true; },
  nextDay: () => { interactionState.nextDayCalled = true; },
  console
};
vm.createContext(interactionSandbox);
vm.runInContext(transferJourneyFunctions, interactionSandbox, { filename: "season-journey-interactions" });
interactionSandbox.renderSeasonJourney();
const transferCta = interactionNode("seasonStageAction");
assert.equal(transferCta.textContent, "راجع الانتقالات", "the transfer CTA should be visible after the first two appearances");
assert.equal(transferCta.dataset.seasonAction, "transfer-review", "the CTA must expose the transfer route");
interactionSandbox.runSeasonJourneyAction(transferCta.dataset.seasonAction);
assert.equal(interactionState.currentPage, "contract", "pressing review transfers must route to the contract/market page");
assert.equal(interactionState.journeyTransferReviewed, true, "opening the market must persist the journey review milestone");
assert.equal(marketScrollCount, 1, "the transfer route must scroll the market into view");
assert.equal(interactionSaveCount, 1, "reviewing transfers must save the career state");
assert.ok(interactionMessages.some((message) => message.includes("فتحت سوق الانتقالات")), "the user must get visible confirmation after navigation");

interactionState.calendarDay = 190;
interactionState.winterBreakPending = true;
interactionSandbox.renderSeasonJourney();
assert.equal(transferCta.dataset.seasonAction, "winter", "the winter break must switch the action to the explicit winter-decision flow");
interactionSandbox.runSeasonJourneyAction(transferCta.dataset.seasonAction);
assert.equal(winterModalCount, 1, "the winter CTA must open the winter choices rather than silently advancing the calendar");

interactionState.winterBreakPending = false;
interactionState.journeyTransferReviewed = false;
interactionState.retired = true;
interactionSandbox.renderSeasonJourney();
assert.equal(transferCta.disabled, true, "retired careers must disable the season CTA");
assert.equal(interactionNode("seasonTransferAction").disabled, true, "retired careers must disable the transfer CTA");

interactionState.retired = false;
interactionState.careerStarted = false;
interactionSandbox.runSeasonJourneyAction("transfer-review");
assert.ok(interactionMessages.some((message) => message.includes("ابدأ مسيرتك")), "transfer actions should explain why there is no career to open");

interactionState.careerStarted = true;
missingMarket = true;
const brokenMarketState = { ...interactionState, journeyTransferReviewed: false, retired: false };
interactionSandbox.state = brokenMarketState;
const routeResult = interactionSandbox.openTransferMarketPage();
assert.equal(routeResult, false, "a missing market section must fail safely");
assert.equal(brokenMarketState.journeyTransferReviewed, false, "a missing market section must not falsely complete the transfer milestone");
assert.ok(interactionMessages.some((message) => message.includes("صفحة السوق غير متاحة")), "missing market markup must produce an actionable error message");
missingMarket = false;

interactionSandbox.state.age = 12;
interactionSandbox.state.academyCareer = true;
interactionSandbox.state.winterBreakPending = false;
interactionSandbox.state.journeyTransferReviewed = false;
interactionSandbox.renderSeasonJourney();
assert.equal(interactionNode("seasonTransferAction").hidden, true, "the transfer-market shortcut must be hidden for a 12-year-old academy player");
assert.notEqual(interactionNode("seasonStageAction").dataset.seasonAction, "transfer-review", "the main season CTA must not route academy players to professional transfers");
interactionSandbox.runSeasonJourneyAction("transfer-review");
assert.ok(interactionMessages.some(message => message.includes("سن 18")), "academy players must be told the professional market unlocks at 18");

console.log("UI smoke test passed: career setup, redesigned story UI assets, main pages, professional-life and interactive career systems, and JavaScript syntax.");
