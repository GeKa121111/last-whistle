"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

(async function run() {
  const root = path.resolve(__dirname, "..");
  const source = fs.readFileSync(path.join(root, "career-experience.js"), "utf8");
  const deployed = fs.readFileSync(path.join(root, "public", "career-experience.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const publicHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const publicSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
  assert.equal(source, deployed, "career-experience source and deployed copies must match");
  assert.equal(html, publicHtml, "root and public HTML must match");
  assert.equal(sw, publicSw, "root and public service workers must match");
  assert.match(html, /career-experience\.js\?v=6/, "page should load the updated life-system script");
  assert.match(sw, /last-whistle-static-v119/, "service worker cache must advance with the polling optimization");
  assert.match(sw, /career-experience\.js\?v=6/, "service worker shell should cache the updated life-system script");

  let intervalCallback = null;
  let intervalMs = 0;
  let subscriber = null;
  let panelRefreshes = 0;
  let reduceCalls = 0;
  let saveCalls = 0;
  const documentListeners = Object.create(null);
  const windowListeners = Object.create(null);
  const nodes = Object.create(null);
  const actions = ["open-challenges", "open-mentor", "open-finance"].map(action => ({
    disabled: false,
    getAttribute(name) { return name === "data-lwag-action" ? action : null; }
  }));
  const panel = {
    querySelectorAll(selector) {
      if (selector === "button[data-lwcx-action]") {
        panelRefreshes++;
        return actions;
      }
      return [];
    }
  };
  nodes["lw-career-experience"] = panel;
  for (const id of ["lwcx-wins", "lwcx-attempts", "lwcx-investments", "lwcx-investment-note",
    "lwcx-mentors", "lwcx-stories", "lwcx-status"]) {
    nodes[id] = { textContent: "" };
  }

  const investments = [{
    id: 1, kind: "safe", label: "ادخار آمن", amount: 100, payout: 118,
    dueDay: 30, settled: false, successful: true
  }];
  Object.defineProperty(investments, "reduce", {
    enumerable: false,
    value: function () {
      reduceCalls++;
      return Array.prototype.reduce.apply(this, arguments);
    }
  });
  const state = {
    careerStarted: true, retired: false, energy: 60, money: 1000,
    day: 1, calendarDay: 1, season: 1, storyHistory: [],
    careerWorld: {
      version: 1, challengeCount: 1, challengeWins: 1, practiceAttempts: 2,
      memoryWins: 0, timingWins: 1, mentorSessions: 0, lastMentorDay: "",
      investments, history: [], investmentSequence: 2
    }
  };
  const api = {
    getState: () => state,
    save() { saveCalls++; },
    render() {},
    toast() {}
  };
  const store = {
    subscribe(callback) { subscriber = callback; return () => { subscriber = null; }; }
  };
  const document = {
    readyState: "complete",
    hidden: false,
    body: { appendChild() {} },
    getElementById(id) { return nodes[id] || null; },
    addEventListener(name, callback) { (documentListeners[name] ||= []).push(callback); },
    createElement() { return { id: "", className: "", setAttribute() {}, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } }; }
  };
  const window = {
    LWStoryRuntime: api,
    LWStateStore: store,
    setInterval(callback, ms) { intervalCallback = callback; intervalMs = ms; return 1; },
    clearInterval() {},
    setTimeout() { return 1; },
    clearTimeout() {},
    addEventListener(name, callback) { (windowListeners[name] ||= []).push(callback); }
  };

  vm.runInNewContext(source, { window, document, Math, Number, String, JSON, Array, Promise, console }, {
    filename: "career-experience.js"
  });

  assert.equal(intervalMs, 5000, "state-store mode should use a low-frequency safety poll");
  assert.equal(typeof subscriber, "function", "the life system should subscribe to state-store changes");
  assert.equal(panelRefreshes, 1, "the initial state should render the life-system panel once");
  const initialReduceCalls = reduceCalls;
  intervalCallback();
  assert.equal(panelRefreshes, 1, "an unchanged fallback poll must not repaint the panel");
  assert.equal(reduceCalls, initialReduceCalls, "an unchanged poll must not rescan the entire investment history");

  state.money = 1250;
  subscriber({ source: "save" });
  subscriber({ source: "publish" });
  await Promise.resolve();
  assert.equal(panelRefreshes, 2, "duplicate state notifications should coalesce into one render");
  assert.match(nodes["lwcx-status"].textContent, /1250 جنيه/, "wallet changes should refresh the life panel immediately");
  assert.equal(reduceCalls, initialReduceCalls, "a visible-value update should reuse the existing world summary");

  document.hidden = true;
  state.energy = 22;
  subscriber({ source: "save" });
  await Promise.resolve();
  assert.equal(panelRefreshes, 2, "background state updates should not mutate the panel DOM");
  document.hidden = false;
  documentListeners.visibilitychange[0]();
  assert.equal(panelRefreshes, 3, "returning to the foreground should refresh the panel immediately");
  assert.match(nodes["lwcx-status"].textContent, /الطاقة 22%/, "foreground refresh should show the latest energy");
  assert.equal(nodes["lwcx-investments"].textContent, "1", "pending investments should remain visible before their due date");

  const beforeSettlementScans = reduceCalls;
  state.calendarDay = 30;
  subscriber({ source: "save" });
  await Promise.resolve();
  assert.equal(investments[0].settled, true, "investment settlement should still run when the in-game day advances");
  assert.equal(state.money, 1368, "settling a due investment must credit its payout exactly once");
  assert.equal(saveCalls, 1, "investment settlement should persist exactly once");
  assert.equal(reduceCalls, beforeSettlementScans + 1, "day changes should normalize the world once, not multiple times");
  assert.equal(nodes["lwcx-investments"].textContent, "0", "the panel should remove settled investments immediately");

  console.log("PASS: life-system panel refreshes on state events, skips unchanged polls, and settles investments once per day.");
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
