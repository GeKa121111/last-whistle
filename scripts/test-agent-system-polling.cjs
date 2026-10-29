"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "agent-system.js"), "utf8");
const publicSource = fs.readFileSync(path.join(root, "public", "agent-system.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const publicHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const publicSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
assert.equal(source, publicSource, "agent root/public runtimes must match");
assert.equal(html, publicHtml, "root/public HTML must match");
assert.equal(sw, publicSw, "root/public service workers must match");
assert.match(html, /agent-system\.js\?v=5/);
assert.match(sw, /last-whistle-static-v153/);
assert.match(sw, /agent-system\.js\?v=5/);
assert.doesNotMatch(source, /window\.setInterval\(tick,1000\)/);

const tickStart = source.indexOf("  function tick(force){");
const tickEnd = source.indexOf('\n  document.addEventListener("click"', tickStart);
const startStart = source.indexOf("  function start(){", tickEnd);
const startEnd = source.indexOf("\n\n  // Stage 2: post-retirement career paths", startStart);
assert.ok(tickStart >= 0 && tickEnd > tickStart, "event-driven tick block must exist");
assert.ok(startStart > tickEnd && startEnd > startStart, "start block must be extractable");
const tickSource = source.slice(tickStart, tickEnd);
const startSource = source.slice(startStart, startEnd);

function makeHarness(withStore = true) {
  const state = {
    careerStarted: true, agent: false, agentLead: null, retired: false, agentProfile: null,
    agentHistory: [], apps: 0, season: 1, seasonFinished: false, money: 1000, weeklyWage: 100,
    day: 1
  };
  let renders = 0, saves = 0, subscriber = null;
  const intervals = [];
  const windowListeners = Object.create(null), documentListeners = Object.create(null);
  const api = { getState: () => state, save() { saves++; } };
  const window = {
    LWStoryRuntime: api,
    LWStateStore: withStore ? {
      getRevision: () => 1,
      subscribe(callback) { subscriber = callback; return () => { subscriber = null; }; }
    } : null,
    setInterval(callback, ms) { intervals.push({ callback, ms }); return intervals.length; },
    addEventListener(name, callback) { (windowListeners[name] ||= []).push(callback); }
  };
  const document = {
    hidden: false,
    addEventListener(name, callback) { (documentListeners[name] ||= []).push(callback); }
  };
  const sandbox = {
    API: () => api, ensureState: () => false, renewRelationship: () => false,
    ensurePanel: () => true, renderPanel: () => { renders++; },
    lastSnapshot: "", panelWasRendered: false, tickScheduled: false, tickForceQueued: false, window, document, Promise
  };
  vm.createContext(sandbox);
  vm.runInContext(tickSource, sandbox, { filename: "agent-system.tick" });
  vm.runInContext(startSource, sandbox, { filename: "agent-system.start" });
  return {
    state, sandbox, window, document, intervals, windowListeners, documentListeners,
    get renders() { return renders; }, get saves() { return saves; }, get subscriber() { return subscriber; }
  };
}

(async function run() {
  const current = makeHarness(true);
  current.sandbox.start();
  assert.equal(current.renders, 1, "startup should render the agent panel once");
  assert.equal(current.intervals.length, 1);
  assert.equal(current.intervals[0].ms, 5000, "state-store mode should use a low-frequency safety poll");
  assert.equal(typeof current.subscriber, "function", "agent system should subscribe to state changes");
  current.intervals[0].callback();
  assert.equal(current.renders, 1, "unchanged safety polls must not rerender");

  current.state.money = 950;
  current.subscriber({ revision: 2, meta: { source: "save" } });
  current.subscriber({ revision: 3, meta: { source: "publish" } });
  await Promise.resolve();
  assert.equal(current.renders, 2, "duplicate synchronous state events should coalesce into one refresh");

  current.document.hidden = true;
  current.state.weeklyWage = 125;
  current.subscriber({ revision: 4, meta: { source: "save" } });
  await Promise.resolve();
  assert.equal(current.renders, 2, "background updates must not rebuild the panel DOM");
  current.document.hidden = false;
  current.documentListeners.visibilitychange[0]();
  assert.equal(current.renders, 3, "visible-tab return should refresh immediately");

  current.windowListeners.pageshow[0]();
  assert.equal(current.renders, 4, "pageshow should force refresh even if snapshot matches");
  assert.equal(current.saves, 0, "event-driven rendering must not create saves without a migration");

  const fallback = makeHarness(false);
  fallback.sandbox.start();
  assert.equal(fallback.intervals[0].ms, 2500, "legacy environments should use a slower fallback");
  fallback.intervals[0].callback();
  assert.equal(fallback.renders, 1, "fallback polling must skip unchanged snapshots");
  assert.equal(fallback.saves, 0);
  console.log("PASS: agent system renders from state events, skips unchanged/background renders, and keeps a compatibility fallback.");
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
