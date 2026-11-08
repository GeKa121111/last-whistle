"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

(async function run() {
  const root = path.resolve(__dirname, "..");
  const source = fs.readFileSync(path.join(root, "career-hub.js"), "utf8");
  const deployed = fs.readFileSync(path.join(root, "public", "career-hub.js"), "utf8");
  assert.equal(source, deployed, "root and public career hub scripts must stay synchronized");

  let intervalCallback = null;
  let intervalMs = 0;
  let queryCalls = 0;
  let stateChangeListener = null;
  let revision = 1;
  let oldRowGoalReads = 0;
  const listeners = Object.create(null);
  const nodes = new Map();
  const makeNode = () => ({
    textContent: "", title: "", disabled: false, className: "",
    style: { width: "" },
    classList: { toggle() {} }
  });
  const firstRow = {
    minutes: 90, scope: "league", assists: 0,
    get goals() { oldRowGoalReads++; return 1; }
  };
  const state = {
    careerStarted: true, retired: false, winterBreakPending: false,
    energy: 65, morale: 60, fatigue: 25, trust: 55, coachRelationship: 50,
    injuryDays: 0, injuryName: "", playedToday: false, trainedToday: false,
    dailyActionUsed: false, dailyActionDay: 1, dailyActionType: "",
    day: 1, season: 1, apps: 1, totalCareerAppearances: 1,
    goals: 1, assists: 0, seasonApps: 1, pos: "رأس حربة",
    careerMatchHistory: [
      firstRow,
      { minutes: 90, scope: "international", goals: 0, assists: 0 }
    ],
    seasonLog: []
  };
  const coachButton = { disabled: false };
  const document = {
    readyState: "complete",
    hidden: false,
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, makeNode()); return nodes.get(id); },
    querySelectorAll(selector) { queryCalls++; return selector.includes('data-action="coach"') ? [coachButton] : []; },
    addEventListener(name, callback) { (listeners[name] ||= []).push(callback); }
  };
  const store = {
    getRevision: () => revision,
    subscribe(callback) { stateChangeListener = callback; return () => { stateChangeListener = null; }; }
  };
  const window = {
    LWStoryRuntime: { getState: () => state },
    LWStateStore: store,
    setInterval(callback, ms) { intervalCallback = callback; intervalMs = ms; return 1; },
    addEventListener(name, callback) { (listeners["window:" + name] ||= []).push(callback); }
  };
  const context = { window, document, console, Math, Number, String, JSON, Array };
  vm.createContext(context);
  const careerEngine = fs.readFileSync(path.join(root, "public", "data", "career-engine.js"), "utf8");
  vm.runInContext(careerEngine, context, { filename: "career-engine.js" });
  assert.equal(typeof window.LWCareer.uniqueMatchRows, "function",
    "career hub must have the shared career-history deduplication helper available");
  vm.runInContext(source, context, { filename: "career-hub.js" });

  assert.equal(intervalMs, 5000, "state-store mode should use only a low-frequency safety poll");
  assert.equal(queryCalls, 1, "initial render should mount wellness controls once");
  oldRowGoalReads = 0;
  intervalCallback();
  assert.equal(queryCalls, 1, "unchanged state must not rebuild the wellness UI");
  assert.equal(oldRowGoalReads, 0, "unchanged polling must not rescan historical match rows");

  state.energy = 20;
  revision++;
  stateChangeListener({ revision });
  stateChangeListener({ revision });
  await Promise.resolve();
  assert.equal(queryCalls, 2, "state-store notifications should refresh the UI and coalesce duplicate saves");
  assert.equal(nodes.get("wellnessEnergyValue").textContent, "20/100");

  document.hidden = true;
  state.energy = 80;
  revision++;
  stateChangeListener({ revision });
  await Promise.resolve();
  assert.equal(queryCalls, 2, "background tabs must skip state-store rendering");
  assert.equal(nodes.get("wellnessEnergyValue").textContent, "20/100");

  document.hidden = false;
  listeners.visibilitychange[0]();
  assert.equal(queryCalls, 3, "returning to a visible tab must refresh immediately");
  assert.equal(nodes.get("wellnessEnergyValue").textContent, "80/100");

  state.careerMatchHistory.push({ minutes: 120, scope: "cup", goals: 1, assists: 1 });
  const duplicateLeagueRow = {
    id: "league|segment-1|season-1|premier-league|test-fc|2",
    scope: "league", competition: "Premier League", season: 1, segmentId: "segment-1",
    club: "Test FC", opponent: "Opponent FC", day: 10, calendarDay: 10, matchday: 2,
    minutes: 90, goals: 1, assists: 0
  };
  state.careerMatchHistory.push(duplicateLeagueRow, { ...duplicateLeagueRow });
  state.apps = 2; state.totalCareerAppearances = 2; state.goals = 2; state.assists = 1;
  revision++;
  stateChangeListener({ revision });
  await Promise.resolve();
  assert.equal(queryCalls, 4, "new career history must invalidate the cached history signature");
  assert.equal(nodes.get("statsGoalsPer90").textContent, "0.90",
    "duplicate legacy match rows must not inflate goals per 90 minutes");
  assert.equal(nodes.get("statsAssistsPer90").textContent, "0.30",
    "duplicate legacy match rows must not dilute assists per 90 minutes");
  assert.equal(nodes.get("statsMinutesPerAppearance").textContent, "100",
    "minutes per appearance must use the deduplicated career match count");

  state.pos = "وسط";
  revision++;
  stateChangeListener({ revision });
  await Promise.resolve();
  assert.equal(queryCalls, 5, "changing to central midfield must refresh the position context");
  const centralMidfieldContext = nodes.get("statsPositionContext").textContent;
  assert.match(centralMidfieldContext, /مركزك الحالي: وسط —/,
    "central midfield must be shown as the current career role");
  assert.match(centralMidfieldContext, /ربط الدفاع بالهجوم/,
    "central midfield must receive role-specific performance guidance");

  const legacySeasonRow = {
    id: "legacy-season-match-1", competition: "Premier League", season: 1,
    club: "Test FC", opponent: "Opponent FC", day: 10, matchday: 1,
    minutes: 90, goals: 1, assists: 1
  };
  state.careerMatchHistory = [];
  state.seasonLog = [legacySeasonRow];
  state.apps = 1; state.totalCareerAppearances = 1; state.goals = 1; state.assists = 1;
  revision++;
  stateChangeListener({ revision });
  await Promise.resolve();
  assert.equal(queryCalls, 6, "legacy season-log changes must invalidate the cached career statistics");
  assert.equal(nodes.get("statsGoalsPer90").textContent, "1.00",
    "legacy saves with seasonLog but no careerMatchHistory must still show their recorded goal rate");
  assert.equal(nodes.get("statsAssistsPer90").textContent, "1.00",
    "legacy season-log assists must be included in career rates");
  assert.equal(nodes.get("statsMinutesPerAppearance").textContent, "90",
    "legacy season-log minutes must be used when the newer career ledger is absent");

  state.careerMatchHistory = [{ ...legacySeasonRow, scope: "league" }];
  revision++;
  stateChangeListener({ revision });
  await Promise.resolve();
  assert.equal(queryCalls, 7, "the career hub must refresh when the canonical history ledger is restored");
  assert.equal(nodes.get("statsGoalsPer90").textContent, "1.00",
    "the same fixture in seasonLog and careerMatchHistory must be counted only once");
  assert.equal(nodes.get("statsMinutesPerAppearance").textContent, "90",
    "merging legacy and canonical histories must not double-count appearances");

  const sparseLegacyRow = {
    id: "legacy-sparse-match-1", minutes: 90, goals: 1, assists: 1
  };
  state.seasonLog = [sparseLegacyRow];
  state.careerMatchHistory = [{ ...sparseLegacyRow }];
  revision++;
  stateChangeListener({ revision });
  await Promise.resolve();
  assert.equal(queryCalls, 8, "sparse legacy history updates must refresh career statistics");
  assert.equal(nodes.get("statsGoalsPer90").textContent, "1.00",
    "matching sparse legacy/canonical rows without an explicit scope must be counted once");
  assert.equal(nodes.get("statsAssistsPer90").textContent, "1.00",
    "missing legacy scope metadata must not duplicate assists in per-90 rates");
  assert.equal(nodes.get("statsMinutesPerAppearance").textContent, "90",
    "sparse duplicate rows must represent one appearance, not two");

  // Match identity changes can alter deduplication without changing the four
  // numeric fields used by the old history signature.
  const sharedIdentityRows = [
    { id: "shared-fixture", scope: "league", competition: "Premier League", season: 1,
      segmentId: "segment-1", club: "Test FC", opponent: "Opponent FC", day: 11,
      calendarDay: 11, matchday: 1, minutes: 90, goals: 1, assists: 0 },
    { id: "shared-fixture", scope: "league", competition: "Premier League", season: 1,
      segmentId: "segment-1", club: "Test FC", opponent: "Opponent FC", day: 11,
      calendarDay: 11, matchday: 1, minutes: 60, goals: 1, assists: 0 }
  ];
  state.seasonLog = [];
  state.careerMatchHistory = sharedIdentityRows;
  revision++;
  stateChangeListener({ revision });
  await Promise.resolve();
  assert.equal(nodes.get("statsGoalsPer90").textContent, "1.00",
    "same-ID duplicate fixtures with matching identity must count once");
  assert.equal(nodes.get("statsMinutesPerAppearance").textContent, "90");

  const beforeIdentityRefresh = queryCalls;
  sharedIdentityRows[0].competition = "National Cup";
  revision++;
  stateChangeListener({ revision });
  await Promise.resolve();
  assert.equal(queryCalls, beforeIdentityRefresh + 1,
    "a match identity change must invalidate cached career statistics even when its numeric metrics are unchanged");
  assert.equal(nodes.get("statsGoalsPer90").textContent, "1.20",
    "a reused match ID across different competitions must remain two appearances after identity changes");
  assert.equal(nodes.get("statsMinutesPerAppearance").textContent, "75",
    "career minutes per appearance must refresh when competition metadata changes");

  state.seasonLog = [];
  state.careerMatchHistory = [
    { id: "career-valid-league", minutes: 90, scope: "league", goals: 2, assists: 1 },
    { id: "career-valid-cup", minutes: "90", scope: "cup", goals: "1", assists: "0" },
    { id: "career-symbol-goals", minutes: 90, scope: "league", goals: Symbol("invalid-goals"), assists: 0 },
    { id: "career-infinite-minutes", minutes: Infinity, scope: "league", goals: 50, assists: 50 },
    { id: "career-array-minutes", minutes: [90], scope: "league", goals: [8], assists: true },
    { id: "career-symbol-minutes", minutes: Symbol("invalid-minutes"), scope: "league", goals: 50, assists: 50 },
    { id: "career-overlong-minutes", minutes: 121, scope: "league", goals: 50, assists: 50 },
    { id: "career-international-case", minutes: 90, scope: " INTERNATIONAL ", goals: 9, assists: 9 }
  ];
  state.apps = [99]; state.totalCareerAppearances = Infinity;
  state.goals = Infinity; state.assists = [6]; state.seasonApps = true;
  revision++;
  assert.doesNotThrow(() => stateChangeListener({ revision }),
    "career statistics and history signatures must tolerate malformed primitive and container values");
  await Promise.resolve();
  assert.equal(nodes.get("statsGoalsPer90").textContent, "1.00",
    "career rates must ignore invalid minutes, cap match metrics, and normalize international scope");
  assert.equal(nodes.get("statsAssistsPer90").textContent, "0.33",
    "career assist rates must use only finite valid match metrics");
  assert.equal(nodes.get("statsMinutesPerAppearance").textContent, "90",
    "career minutes per appearance must reject invalid and overlong match rows");
  assert.equal(nodes.get("statsCareerApps").textContent, "0",
    "malformed saved career appearance counters must render as zero");
  assert.equal(nodes.get("statsCareerGoals").textContent, "0",
    "malformed saved career goal counters must render as zero");
  assert.equal(nodes.get("statsCareerAssists").textContent, "0",
    "malformed saved career assist counters must render as zero");
  assert.equal(nodes.get("statsSeasonApps").textContent, "0",
    "malformed saved season appearance counters must render as zero");

  state.apps = "4"; state.totalCareerAppearances = "3";
  state.goals = "6"; state.assists = "2"; state.seasonApps = "5";
  revision++;
  stateChangeListener({ revision });
  await Promise.resolve();
  assert.equal(nodes.get("statsCareerApps").textContent, "4",
    "valid numeric-string career appearance counters must remain backward compatible");
  assert.equal(nodes.get("statsCareerGoals").textContent, "6");
  assert.equal(nodes.get("statsCareerAssists").textContent, "2");
  assert.equal(nodes.get("statsSeasonApps").textContent, "5");

  state.dailyActionUsed = true;
  delete state.dailyActionDay;
  revision++;
  stateChangeListener({ revision });
  await Promise.resolve();
  assert.match(nodes.get("wellnessDailyActionLabel").textContent, /استخدمت نشاطك الجانبي اليوم/,
    "legacy saves with a used action flag but no day marker must fail closed in the wellness UI");
  assert.equal(coachButton.disabled, true,
    "a legacy used daily action must disable the coach action until the next day reset");

  state.dailyActionDay = Symbol("invalid-action-day");
  revision++;
  assert.doesNotThrow(() => stateChangeListener({ revision }),
    "a malformed daily action day must not crash the career hub signature or renderer");
  await Promise.resolve();
  assert.match(nodes.get("wellnessDailyActionLabel").textContent, /استخدمت نشاطك الجانبي اليوم/);
  assert.equal(coachButton.disabled, true);

  state.day = Symbol("invalid-current-day");
  state.dailyActionDay = 2;
  revision++;
  stateChangeListener({ revision });
  await Promise.resolve();
  assert.match(nodes.get("wellnessDailyActionLabel").textContent, /استخدمت نشاطك الجانبي اليوم/,
    "an invalid current day must not make a previously used activity available");
  assert.equal(coachButton.disabled, true);

  state.day = 2;
  state.dailyActionDay = 1;
  revision++;
  stateChangeListener({ revision });
  await Promise.resolve();
  assert.equal(nodes.get("wellnessDailyActionLabel").textContent, "النشاط الجانبي متاح النهارده",
    "a valid prior-day action marker must unlock the next day even when the legacy used flag remains set");
  assert.equal(coachButton.disabled, false);

  state.energy = Symbol("invalid-energy");
  revision++;
  assert.doesNotThrow(() => stateChangeListener({ revision }),
    "the wellness dashboard must not throw when a saved energy value is malformed");
  await Promise.resolve();
  assert.equal(nodes.get("wellnessEnergyValue").textContent, "0/100",
    "invalid energy must be displayed as a safe zero instead of breaking the wellness panel");

  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const publicSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
  assert.equal(sw, publicSw, "root and public service workers must stay synchronized");
  require("./assert-static-cache-version.cjs")(sw, 553);
  assert.match(sw, /career-hub\.js\?v=5/, "PWA must cache the hardened career statistics UI");
  const careerHubCacheVersionMatch = sw.match(/last-whistle-static-v(\d+)/);
  assert.ok(careerHubCacheVersionMatch && Number(careerHubCacheVersionMatch[1]) >= 553,
    "legacy-history rendering must invalidate the PWA shell cache");
  assert.match(sw, /url\.indexOf\("career-hub\.js\?"\) >= 0/,
    "the updated career hub must be fetched fresh during service-worker installation");
  console.log("PASS: career hub responds to state events, coalesces duplicate saves, caches history summaries, and skips unchanged work.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
