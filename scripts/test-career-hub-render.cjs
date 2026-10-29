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
    ]
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
  vm.runInNewContext(source, { window, document, console, Math, Number, String, JSON, Array }, { filename: "career-hub.js" });

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
  state.apps = 2; state.totalCareerAppearances = 2; state.goals = 2; state.assists = 1;
  revision++;
  stateChangeListener({ revision });
  await Promise.resolve();
  assert.equal(queryCalls, 4, "new career history must invalidate the cached history signature");
  assert.equal(nodes.get("statsGoalsPer90").textContent, "0.86");
  assert.equal(nodes.get("statsAssistsPer90").textContent, "0.43");

  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const publicSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
  assert.equal(sw, publicSw, "root and public service workers must stay synchronized");
  assert.match(sw, /last-whistle-static-v174/, "PWA cache must advance with the event-driven career UI");
  assert.match(sw, /career-hub\.js\?v=3/, "PWA must cache the new event-driven career UI");
  console.log("PASS: career hub responds to state events, coalesces duplicate saves, caches history summaries, and skips unchanged work.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
