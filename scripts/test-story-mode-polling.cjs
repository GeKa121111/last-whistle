"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

(async function run() {
  const root = path.resolve(__dirname, "..");
  const source = fs.readFileSync(path.join(root, "story-mode.js"), "utf8");
  const deployed = fs.readFileSync(path.join(root, "public", "story-mode.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const publicHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const publicSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");

  assert.equal(source, deployed, "root and public story runtimes must match");
  assert.equal(html, publicHtml, "root and public HTML must match");
  assert.equal(sw, publicSw, "root and public service workers must match");
  assert.match(html, /story-mode\.js\?v=12/, "page should load the updated story runtime");
  require("./assert-static-cache-version.cjs")(sw, 175);
  assert.match(sw, /story-mode\.js\?v=12/, "offline shell should cache the current story runtime");
  assert.match(source, /store&&typeof store\.subscribe==="function"/);
  assert.match(source, /store\.subscribe\(function\(\)\{scheduleTick\(\);\}\)/);
  assert.match(source, /window\.setInterval\(tick,5000\)/);
  assert.match(source, /window\.setInterval\(tick,2500\)/);

  const tickStart = source.indexOf("function tick(){");
  const scheduleStart = source.indexOf("function scheduleTick(){", tickStart);
  const startStart = source.indexOf("function start(){", scheduleStart);
  const startEnd = source.indexOf("\nwindow.LWStoryContext", startStart);
  assert.ok(tickStart >= 0 && scheduleStart > tickStart, "story tick and scheduler must exist");
  assert.ok(startStart > scheduleStart && startEnd > startStart, "story startup block must be extractable");
  const tickSource = source.slice(tickStart, scheduleStart);
  const scheduleSource = source.slice(scheduleStart, startStart);
  const startSource = source.slice(startStart, startEnd);

  function makeHarness(withStore) {
    const state = {
      careerStarted: true, apps: 1, goals: 0, assists: 0, nationalCalled: false,
      nationalCaps: 0, injuryDays: 0, injuryName: "", contractSeasons: 2,
      freeAgent: false, seasonFinished: false, trophies: 0, trust: 50,
      mediaReputation: 0, professionalism: 50, seasonApps: 1, day: 1,
      season: 1, storyPendingId: ""
    };
    let subscriber = null;
    let overviewRenders = 0;
    const intervals = [];
    const documentListeners = Object.create(null);
    const windowListeners = Object.create(null);
    const api = { getState: () => state };
    const document = {
      hidden: false,
      readyState: "complete",
      addEventListener(name, callback) { (documentListeners[name] ||= []).push(callback); }
    };
    const window = {
      LWStoryRuntime: api,
      LWStateStore: withStore ? {
        subscribe(callback) { subscriber = callback; return () => { subscriber = null; }; }
      } : null,
      setInterval(callback, ms) { intervals.push({ callback, ms }); return intervals.length; },
      setTimeout(callback, ms) { return { callback, ms }; },
      addEventListener(name, callback) { (windowListeners[name] ||= []).push(callback); }
    };
    const sandbox = {
      window, document, Promise, console,
      API: () => api,
      ensureShell() {},
      checkTriggers() {},
      renderOverview() { overviewRenders++; },
      renderStoryPanel() {},
      stateRef: null, previousSnapshot: "", lastPending: "", storyTickScheduled: false
    };
    vm.createContext(sandbox);
    vm.runInContext(tickSource, sandbox, { filename: "story-mode.tick" });
    vm.runInContext(scheduleSource, sandbox, { filename: "story-mode.scheduleTick" });
    vm.runInContext(startSource, sandbox, { filename: "story-mode.start" });
    return {
      sandbox, state, intervals, document, documentListeners, windowListeners,
      get subscriber() { return subscriber; },
      get overviewRenders() { return overviewRenders; }
    };
  }

  const current = makeHarness(true);
  current.sandbox.start();
  assert.equal(current.overviewRenders, 1, "startup should render the overview once");
  assert.equal(current.intervals.length, 1);
  assert.equal(current.intervals[0].ms, 5000, "state-store mode should use a low-frequency safety poll");
  assert.equal(typeof current.subscriber, "function", "story mode should subscribe to state changes");

  current.subscriber();
  current.subscriber();
  await Promise.resolve();
  assert.equal(current.overviewRenders, 2, "duplicate synchronous state events should coalesce into one refresh");

  current.document.hidden = true;
  current.subscriber();
  await Promise.resolve();
  assert.equal(current.overviewRenders, 2, "background updates should not render the story UI");

  current.document.hidden = false;
  current.documentListeners.visibilitychange[0]();
  assert.equal(current.overviewRenders, 3, "returning to the foreground should refresh immediately");

  const fallback = makeHarness(false);
  fallback.sandbox.start();
  assert.equal(fallback.intervals[0].ms, 2500, "legacy environments should use a slower compatibility poll");
  assert.equal(fallback.overviewRenders, 1);
  console.log("PASS: story mode refreshes from state events, coalesces duplicate notifications, pauses in background, and keeps a slower fallback.");
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
