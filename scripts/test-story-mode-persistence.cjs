"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "story-mode.js"), "utf8");
const deployed = fs.readFileSync(path.join(root, "public", "story-mode.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const publicHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const publicSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
assert.equal(source, deployed, "root/public story runtimes must match");
assert.equal(html, publicHtml, "root/public HTML must match");
assert.equal(sw, publicSw, "root/public service workers must match");
assert.match(sw, /last-whistle-static-v463/);
assert.match(sw, /story-mode\.js\?v=14/);
require("./assert-static-cache-version.cjs")(sw, 445);

const helperStart = source.indexOf("function cloneStoryState(");
const helperEnd = source.indexOf("\nfunction actualEvent(", helperStart);
const triggerStart = source.indexOf("function applyStoryTriggers(");
const triggerEnd = source.indexOf("\nfunction renderStoryPanel(", triggerStart);
const matchStart = source.indexOf("function finiteNumber(");
const matchEnd = source.indexOf("\nfunction tick()", matchStart);
const tickStart = matchEnd;
const tickEnd = source.indexOf("\nfunction scheduleTick(", tickStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart);
assert.ok(triggerStart >= 0 && triggerEnd > triggerStart);
assert.ok(matchStart >= 0 && matchEnd > matchStart);
assert.ok(tickStart >= 0 && tickEnd > tickStart);
const helpers = source.slice(helperStart, helperEnd);
const triggers = source.slice(triggerStart, triggerEnd);
const matchFunctions = source.slice(matchStart, matchEnd);
const tickFunction = source.slice(tickStart, tickEnd);

function makeHarness(stateOverrides, flushQueue) {
  const state = Object.assign({
    careerStarted: true, apps: 1, season: 1, day: 4,
    money: 1000, energy: 50
  }, stateOverrides || {});
  const notices = [], warnings = [];
  let saveCalls = 0, flushCalls = 0, renders = 0;
  const queue = (flushQueue || []).slice();
  const api = {
    getState: () => state,
    save() { saveCalls++; return true; },
    render() { renders++; },
    toast(message) { notices.push(String(message)); },
    log() {}
  };
  const window = {
    console: { warn(message) { warnings.push(String(message)); }, error() {} },
    flushQueuedSave(options) {
      assert.equal(options && options.backupFirst, true);
      flushCalls++;
      const next = queue.length ? queue.shift() : true;
      return typeof next === "function" ? next() : Promise.resolve(next);
    }
  };
  const sandbox = {
    window, console: window.console, Promise, JSON, Number, String, Array, Object,
    storyMutationPending: false, storyTickRunning: false, lastPending: "",
    API: () => api,
    storyFlags(s) { if (!s.storyFlags || typeof s.storyFlags !== "object") s.storyFlags = {}; return s.storyFlags; },
    history(s) { if (!Array.isArray(s.storyHistory)) s.storyHistory = []; return s.storyHistory; },
    eligibleEvents(s) {
      if (Number(s.apps || 0) < 1 || s.storyFlags && s.storyFlags.debut) return [];
      return [{ id: "debut" }];
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(helpers + "\n" + triggers + "\n" + matchFunctions, sandbox, { filename: "story-mode.persistence" });
  return {
    state, notices, warnings, api, sandbox,
    checkTriggers: () => sandbox.checkTriggers(state, api),
    accept: report => sandbox.acceptMatchReport(report),
    sync: options => sandbox.syncMatchContext(state, options),
    acceptDeferred: report => sandbox.acceptMatchReport(report, { deferSave: true }),
    get saveCalls() { return saveCalls; },
    get flushCalls() { return flushCalls; },
    get renders() { return renders; }
  };
}

const report = {
  matchId: "fixture-7", competition: "league", opponent: "Harbor FC",
  season: 1, week: 4, score: { for: 2, against: 1 },
  player: { minutes: 90, rating: 8.1, goals: 1, assists: 0, tackles: 2 }
};

(async function run() {
  const rawSync = makeHarness({ lastMatchReportRaw: report }, [true]);
  const rawSyncResult = await rawSync.sync();
  assert.equal(rawSyncResult.ok, true);
  assert.equal(rawSync.state.lastStoryMatchKey, rawSyncResult.summary.key);
  assert.equal(rawSync.state.matchNarrativeLedger.length, 1);
  assert.equal(rawSync.state.inbox.length, 1);
  assert.equal(rawSync.saveCalls, 1);

  const staleRaw = Object.assign({}, report, { matchId: "fixture-6" });
  const latestMatch = Object.assign({}, report, { matchId: "fixture-8", score: { for: 0, against: 2 } });
  const staleAndLatest = makeHarness({ lastMatchReportRaw: staleRaw, matchResult: latestMatch }, [true]);
  staleAndLatest.state.lastStoryMatchKey = staleAndLatest.sandbox.matchNarrativeSummary(staleRaw).key;
  const latestSyncResult = await staleAndLatest.sync();
  assert.equal(latestSyncResult.ok, true);
  assert.equal(latestSyncResult.summary.key, staleAndLatest.sandbox.matchNarrativeSummary(latestMatch).key);
  assert.equal(staleAndLatest.state.matchNarrativeLedger.length, 1);
  assert.equal(staleAndLatest.state.inbox.length, 1);
  assert.equal(staleAndLatest.saveCalls, 1);

  const malformedRawFallback = makeHarness({ lastMatchReportRaw: { id: "malformed" }, matchResult: report }, [true]);
  const fallbackSyncResult = await malformedRawFallback.sync();
  assert.equal(fallbackSyncResult.ok, true);
  assert.equal(fallbackSyncResult.summary.key, malformedRawFallback.sandbox.matchNarrativeSummary(report).key);
  assert.equal(malformedRawFallback.state.inbox.length, 1);

  const deferredSync = makeHarness({ lastMatchReportRaw: report }, []);
  const deferredSyncResult = deferredSync.sync({ deferSave: true });
  assert.equal(deferredSyncResult.ok, true);
  assert.equal(deferredSyncResult.summary.key, deferredSync.state.lastStoryMatchKey);
  assert.equal(deferredSync.saveCalls, 0);
  assert.equal(deferredSync.flushCalls, 0);
  const triggerSuccess = makeHarness({}, [true]);
  const triggerResult = await triggerSuccess.checkTriggers();
  assert.equal(triggerResult.ok, true);
  assert.equal(triggerSuccess.state.storyPendingId, "debut");
  assert.equal(triggerSuccess.state.storyHistory.length, 0);
  assert.equal(triggerSuccess.saveCalls, 1);
  assert.equal(triggerSuccess.flushCalls, 1);
  assert.equal(triggerSuccess.notices.length, 1);

  const triggerFailure = makeHarness({}, [false, true]);
  const failedTrigger = await triggerFailure.checkTriggers();
  assert.equal(failedTrigger.ok, false);
  assert.equal(triggerFailure.state.storyPendingId, undefined);
  assert.equal(triggerFailure.state.storyFlags, undefined);
  assert.equal(triggerFailure.state.storyHistory, undefined);
  assert.equal(triggerFailure.saveCalls, 2);
  assert.equal(triggerFailure.flushCalls, 2);
  assert.equal(triggerFailure.notices.some(message => message.includes("فيه قرار مصيري جديد")), false);

  const stale = makeHarness({ apps: 0, storyPendingId: "stale-event", storyFlags: {}, storyHistory: [] }, [true]);
  const staleResult = await stale.checkTriggers();
  assert.equal(staleResult.ok, true);
  assert.equal(stale.state.storyPendingId, "");
  assert.equal(stale.saveCalls, 1);

  const deferredTrigger = makeHarness({}, []);
  const deferredTriggerResult = deferredTrigger.sandbox.checkTriggers(deferredTrigger.state, deferredTrigger.api, { deferSave: true, suppressToast: true });
  assert.equal(deferredTriggerResult.ok, true);
  assert.equal(deferredTrigger.state.storyPendingId, "debut");
  assert.equal(deferredTrigger.sandbox.lastPending, "", "outer transaction owns the pending-event notification state");
  assert.equal(deferredTrigger.saveCalls, 0);

  const unchanged = makeHarness({ storyPendingId: "debut", storyFlags: {}, storyHistory: [] }, [true]);
  const unchangedResult = await unchanged.checkTriggers();
  assert.equal(unchangedResult.ok, true);
  assert.equal(unchangedResult.changed, false);
  assert.equal(unchanged.saveCalls, 0);
  assert.equal(unchanged.flushCalls, 0);

  let releaseTrigger;
  const delayedTrigger = makeHarness({}, [() => new Promise(resolve => { releaseTrigger = resolve; })]);
  const pendingTrigger = delayedTrigger.checkTriggers();
  assert.equal(delayedTrigger.state.storyPendingId, "debut");
  assert.equal(delayedTrigger.notices.length, 0);
  releaseTrigger(true);
  assert.equal((await pendingTrigger).ok, true);
  assert.equal(delayedTrigger.notices.length, 1);

  let releaseTick;
  let overviewRenders = 0, panelRenders = 0;
  const tickState = { careerStarted: true, apps: 1, day: 4 };
  const tickSandbox = {
    document: { hidden: false },
    window: { console: { warn() {} } },
    Promise, API: () => ({ getState: () => tickState }),
    storyTickRunning: false, storyMutationPending: false,
    stateRef: null, previousSnapshot: "", lastPending: "",
    ensureShell() {},
    checkTriggers() { return new Promise(resolve => { releaseTick = resolve; }); },
    renderOverview() { overviewRenders++; },
    renderStoryPanel() {}
  };
  vm.createContext(tickSandbox);
  vm.runInContext(tickFunction, tickSandbox, { filename: "story-mode.tick.persistence" });
  const tickPromise = tickSandbox.tick();
  assert.equal(overviewRenders, 0, "the story panel must not render before trigger persistence finishes");
  releaseTick({ ok: true });
  await tickPromise;
  assert.equal(overviewRenders, 1);

  const matchSuccess = makeHarness({}, [true]);
  const accepted = await matchSuccess.accept(report);
  assert.equal(accepted.ok, true);
  assert.equal(matchSuccess.state.lastStoryMatchKey, accepted.summary.key);
  assert.equal(matchSuccess.state.matchNarrativeLedger.length, 1);
  assert.equal(matchSuccess.state.inbox.length, 1);
  assert.equal(matchSuccess.state.inbox[0].id, "match-report-" + accepted.summary.key);
  assert.equal(matchSuccess.saveCalls, 1);
  assert.equal(matchSuccess.flushCalls, 1);
  const duplicate = await matchSuccess.accept(report);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(matchSuccess.state.matchNarrativeLedger.length, 1);
  assert.equal(matchSuccess.state.inbox.length, 1);
  assert.equal(matchSuccess.saveCalls, 1);

  const legacySummary = matchSuccess.sandbox.matchNarrativeSummary(report);
  const legacy = makeHarness({ lastStoryMatchKey: legacySummary.legacyKey }, []);
  const legacyDuplicate = await legacy.accept(report);
  assert.equal(legacyDuplicate.duplicate, true);
  assert.equal(legacy.saveCalls, 0);

  const ledgerDuplicate = makeHarness({
    lastStoryMatchKey: "another-match",
    matchNarrativeLedger: [{ key: legacySummary.legacyKey }]
  }, []);
  const oldLedgerDuplicate = await ledgerDuplicate.accept(report);
  assert.equal(oldLedgerDuplicate.duplicate, true);
  assert.equal(ledgerDuplicate.saveCalls, 0);

  const matchFailure = makeHarness({}, [false, true]);
  const failedMatch = await matchFailure.accept(report);
  assert.equal(failedMatch.ok, false);
  assert.equal(matchFailure.state.lastStoryMatchKey, undefined);
  assert.equal(matchFailure.state.matchNarrativeLedger, undefined);
  assert.equal(matchFailure.state.inbox, undefined);
  assert.equal(matchFailure.saveCalls, 2);
  assert.equal(matchFailure.flushCalls, 2);

  const deferred = makeHarness({}, []);
  const deferredResult = deferred.acceptDeferred(report);
  assert.equal(deferredResult.ok, true);
  assert.equal(deferredResult.summary.key, deferred.state.lastStoryMatchKey);
  assert.equal(deferred.state.inbox.length, 1);
  assert.equal(deferred.saveCalls, 0);
  assert.equal(deferred.flushCalls, 0);

  console.log("PASS: automatic story triggers and match reports persist durably, roll back on failed saves, and remain duplicate-safe.");
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
