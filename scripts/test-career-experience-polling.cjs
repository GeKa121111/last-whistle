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
  assert.match(html, /career-experience\.js\?v=9/, "page should load the updated life-system script");
  assert.match(html, /id="lifePageGrid"/, "career experience must have a dedicated life-page mount point");
  assert.match(source, /host\.insertBefore\(panel, host\.firstElementChild\)/, "career experience must lead the life-page content grid");
  require("./assert-static-cache-version.cjs")(sw, 436);
  assert.match(sw, /career-experience\.js\?v=9/, "service worker shell should cache the updated life-system script");

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
    getAttribute(name) { return name === "data-lwcx-action" ? action : null; }
  }));
  const host = {
    firstElementChild: null,
    insertBefore(child) {
      child.parentElement = this;
      this.firstElementChild = child;
    }
  };
  const panel = {
    parentElement: null,
    className: "",
    setAttribute() {},
    querySelectorAll(selector) {
      if (selector === "button[data-lwcx-action]") {
        panelRefreshes++;
        return actions;
      }
      return [];
    }
  };
  nodes["lifePageGrid"] = host;
  nodes["lw-career-experience"] = panel;
  for (const id of ["lwcx-wins", "lwcx-attempts", "lwcx-investments", "lwcx-investment-note",
    "lwcx-mentors", "lwcx-stories", "lwcx-status"]) {
    nodes[id] = { textContent: "" };
  }

  const investments = [{
    id: 1, kind: "safe", label: "ادخار آمن قديم", amount: 100, payout: 118,
    dueDay: 30, settled: false, successful: true
  }, null, {
    id: 2, kind: "safe", label: "ادخار آمن جديد", amount: 100, payout: 120,
    dueDay: 60, settled: false, successful: true
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
      investments, history: [], investmentSequence: 3
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
    flushQueuedSave() { return Promise.resolve(true); },
    setInterval(callback, ms) { intervalCallback = callback; intervalMs = ms; return 1; },
    clearInterval() {},
    setTimeout() { return 1; },
    clearTimeout() {},
    addEventListener(name, callback) { (windowListeners[name] ||= []).push(callback); }
  };

  vm.runInNewContext(source, { window, document, Math, Number, String, JSON, Array, Promise, console }, {
    filename: "career-experience.js"
  });

  async function settleAsyncWork() {
    for (let i = 0; i < 8; i++) await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  assert.equal(panel.parentElement, host, "an existing career panel should be moved into the life-page grid");
  assert.equal(host.firstElementChild, panel, "the career panel should be first in the life-page grid");
  assert.equal(panel.className, "lwcx-panel span12", "the career panel should span the full life-page grid");
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
  await settleAsyncWork();
  assert.equal(panelRefreshes, 2, "duplicate state notifications should coalesce into one render");
  assert.equal(nodes["lwcx-status"].textContent, "إنجازاتك واستثماراتك محفوظة مع بيانات مسيرتك على نفس الجهاز.", "wallet changes should not duplicate the header balance in the life panel");
  assert.equal(reduceCalls, initialReduceCalls, "a visible-value update should reuse the existing world summary");

  document.hidden = true;
  state.energy = 22;
  subscriber({ source: "save" });
  await settleAsyncWork();
  assert.equal(panelRefreshes, 2, "background state updates should not mutate the panel DOM");
  document.hidden = false;
  documentListeners.visibilitychange[0]();
  assert.equal(panelRefreshes, 3, "returning to the foreground should refresh the panel immediately");
  assert.doesNotMatch(nodes["lwcx-status"].textContent, /الطاقة|الرصيد|1250 جنيه/, "the life panel must not repeat energy or wallet metrics owned by the header");
  assert.equal(nodes["lwcx-investments"].textContent, "2", "both investments should be counted before their due dates");

  const beforeFirstSettlementScans = reduceCalls;
  state.calendarDay = 30;
  subscriber({ source: "save" });
  await settleAsyncWork();
  assert.equal(investments[0].settled, true, "the older investment should settle when its due day arrives");
  assert.equal(investments[1].settled, false, "the newest investment should remain open until its own due day");
  assert.equal(state.money, 1368, "settling the first due investment must credit its payout exactly once");
  assert.equal(saveCalls, 1, "the first due investment should persist exactly once");
  assert.equal(reduceCalls, beforeFirstSettlementScans + 2,
    "a day change should normalize the world once and recompute the cached open count once");
  assert.equal(nodes["lwcx-investments"].textContent, "1",
    "the open-investment count must update when an older investment settles even if the newest item is unchanged");

  const beforeSecondSettlementScans = reduceCalls;
  state.calendarDay = 60;
  subscriber({ source: "save" });
  await settleAsyncWork();
  assert.equal(investments[1].settled, true, "the newest investment should settle at its own due day");
  assert.equal(state.money, 1488, "each due investment payout should be applied exactly once");
  assert.equal(saveCalls, 2, "each settlement day should persist one payout batch");
  assert.equal(reduceCalls, beforeSecondSettlementScans + 2,
    "the next day change should normalize and recount only once each");
  assert.equal(nodes["lwcx-investments"].textContent, "0", "the panel should remove settled investments immediately");

  console.log("PASS: life-system panel refreshes on state events, skips unchanged polls, and tracks older/newer investment settlements.");
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
