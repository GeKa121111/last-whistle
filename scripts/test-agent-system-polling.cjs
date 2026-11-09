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
assert.match(html, /agent-system\.js\?v=14/);
require("./assert-static-cache-version.cjs")(sw, 606);
assert.match(sw, /agent-system\.js\?v=14/);
assert.doesNotMatch(source, /window\.setInterval\(tick,1000\)/);

const helperStart = source.indexOf("  function inspectAgentArrayData(");
const helperEnd = source.indexOf("  function outstandingFeeDebt(", helperStart);
const previewStart = source.indexOf("  function cloneAgentProfileForMaintenance(value){");
const previewEnd = source.indexOf("\n  function tick(force)", previewStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "safe debt-ledger helpers must be extractable");
assert.ok(previewStart >= 0 && previewEnd > previewStart, "maintenance preview must be extractable");
const helperSource = source.slice(helperStart, helperEnd);
// Include the profile clone helper immediately before the maintenance preview.
const previewSource = source.slice(previewStart, previewEnd);
const tickStart = source.indexOf("  function tick(force){");
const tickEnd = source.indexOf('\n  document.addEventListener("click"', tickStart);
const startStart = source.indexOf("  function start(){", tickEnd);
const startEnd = source.indexOf("\n\n  // Stage 2: post-retirement career paths", startStart);
assert.ok(tickStart >= 0 && tickEnd > tickStart, "event-driven tick block must exist");
assert.ok(startStart > tickEnd && startEnd > startStart, "start block must be extractable");
// The polling harness extracts the profile sanitizer with the maintenance preview.
const tickSource = source.slice(tickStart, tickEnd);
assert.match(tickSource, /runAgentContractMutation\(s,/,
  "agent maintenance changes must use the durable transaction helper");
assert.doesNotMatch(tickSource, /api\.save\(/,
  "periodic agent maintenance must not fire-and-forget save");
const startSource = source.slice(startStart, startEnd);

function makeHarness(withStore = true) {
  const state = {
    careerStarted: true, agent: false, agentLead: null, retired: false, agentProfile: null,
    agentFeeDebtLedger: [], apps: 0, season: 1, seasonFinished: false, money: 1000, weeklyWage: 100,
    day: 1
  };
  let renders = 0, saves = 0, maintenanceCalls = 0, subscriber = null;
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
    API: () => api,
    safeAgentNumber: (value, fallback) => typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() && Number.isFinite(Number(value)) ? Number(value) : fallback,
    safeWholeAmount: value => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0,
    safeAgentField: (record, key) => { try { return record && (typeof record === "object" || typeof record === "function") ? record[key] : undefined; } catch (_) { return undefined; } },
    safeAgentText: (value, fallback) => typeof value === "string" ? value
      : typeof value === "number" && Number.isFinite(value) ? String(value)
        : typeof value === "boolean" ? (value ? "true" : "false")
          : (typeof fallback === "string" ? fallback : ""),
    ensureState: state => {
      let changed = false;
      const rawHistory = state.agentHistory;
      if (rawHistory == null) { state.agentHistory = []; changed = true; }
      else {
        const historyInspection = sandbox.inspectAgentArrayData(rawHistory);
        if (!historyInspection || historyInspection.changed) {
          state.agentHistory = sandbox.safeAgentHistoryRows(rawHistory);
          changed = true;
        }
      }
      const rawLedger = state.agentFeeDebtLedger;
      if (rawLedger != null) {
        const inspected = sandbox.inspectAgentArrayData(rawLedger);
        if (!inspected) { state.agentFeeDebtLedger = []; changed = true; }
        else if (inspected.changed) { state.agentFeeDebtLedger = inspected.values; changed = true; }
      }
      return changed;
    },
    renewRelationship: () => false,
    clonePostRetirementMutationState: value => {
      try { return structuredClone(value); }
      catch (_) { try { return JSON.parse(JSON.stringify(value)); } catch (_) { return null; } }
    },
    runAgentContractMutation: (state, operation) => { maintenanceCalls++; operation(); return Promise.resolve({ ok: true }); },
    agentContractMutationPending: false, postRetirementMutationPending: false,
    scheduleTick: () => {},
    ensurePanel: () => true, renderPanel: () => { renders++; },
    lastSnapshot: "", panelWasRendered: false, tickScheduled: false, tickForceQueued: false, window, document, Promise
  };
  vm.createContext(sandbox);
  vm.runInContext(helperSource, sandbox, { filename: "agent-system.debt-ledger-helpers" });
  vm.runInContext(previewSource, sandbox, { filename: "agent-system.maintenance-preview" });
  vm.runInContext(tickSource, sandbox, { filename: "agent-system.tick" });
  vm.runInContext(startSource, sandbox, { filename: "agent-system.start" });
  return {
    state, sandbox, window, document, intervals, windowListeners, documentListeners,
    get renders() { return renders; }, get saves() { return saves; }, get maintenanceCalls() { return maintenanceCalls; }, get subscriber() { return subscriber; }
  };
}

(async function run() {
  const current = makeHarness(true);
  current.sandbox.start();
  assert.equal(current.renders, 1, "startup should render the agent panel once");
  assert.equal(current.maintenanceCalls, 0, "an empty fee-debt ledger must not trigger a maintenance save for a career without an agent");
  assert.equal(current.state.agentHistory, undefined, "fresh careers should not receive an empty agent history just because the debt ledger exists");
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

  // Polling must normalize an overridden ledger without calling its own array methods.
  const hostileLedgerHarness = makeHarness(true);
  hostileLedgerHarness.state.agentHistory = [];
  const pollingLedger = [{id:"polling-debt",agentId:"legacy",agentName:"وكيل سابق",reason:"دين محفوظ",amount:120,paid:0,outstanding:120,createdSeason:1,createdDay:1}];
  pollingLedger.forEach = "not-callable";
  pollingLedger.reduce = "not-callable";
  hostileLedgerHarness.state.agentFeeDebtLedger = pollingLedger;
  await hostileLedgerHarness.sandbox.tick(true);
  assert.equal(hostileLedgerHarness.maintenanceCalls,1,
    "polling must route a hostile debt array through the durable maintenance transaction");
  assert.equal(hostileLedgerHarness.state.agentFeeDebtLedger.length,1);
  assert.equal(Object.prototype.hasOwnProperty.call(hostileLedgerHarness.state.agentFeeDebtLedger,"forEach"),false);
  assert.equal(Object.prototype.hasOwnProperty.call(hostileLedgerHarness.state.agentFeeDebtLedger,"reduce"),false);

  // Preserve an uninspectable ledger reference in the preview so ensureState can replace it safely.
  const revokedLedgerHarness = makeHarness(true);
  revokedLedgerHarness.state.agentHistory = [];
  const revokedLedgerProxy = Proxy.revocable([], {});
  revokedLedgerProxy.revoke();
  revokedLedgerHarness.state.agentFeeDebtLedger = revokedLedgerProxy.proxy;
  await assert.doesNotReject(async () => { await revokedLedgerHarness.sandbox.tick(true); },
    "agent polling must not throw while hydrating a revoked debt-ledger proxy");
  assert.equal(revokedLedgerHarness.maintenanceCalls,1);
  assert.equal(Array.isArray(revokedLedgerHarness.state.agentFeeDebtLedger),true);
  assert.equal(revokedLedgerHarness.state.agentFeeDebtLedger.length,0);

  const hostileHistoryHarness = makeHarness(true);
  hostileHistoryHarness.state.agentFeeDebtLedger = [];
  const hostileHistory = [{season:2,day:4,title:"تجديد الوكيل",text:"تم تجديد العقد."}];
  hostileHistory.forEach = "not-callable";
  hostileHistory.reduce = "not-callable";
  hostileHistoryHarness.state.agentHistory = hostileHistory;
  await hostileHistoryHarness.sandbox.tick(true);
  assert.equal(hostileHistoryHarness.maintenanceCalls,1,
    "polling must normalize an agent history array with overridden methods");
  assert.equal(hostileHistoryHarness.state.agentHistory.length,1);
  assert.equal(hostileHistoryHarness.state.agentHistory[0].title,"تجديد الوكيل");
  assert.equal(Object.prototype.hasOwnProperty.call(hostileHistoryHarness.state.agentHistory,"forEach"),false);

  const revokedHistoryHarness = makeHarness(true);
  revokedHistoryHarness.state.agentFeeDebtLedger = [];
  const revokedHistoryProxy = Proxy.revocable([], {});
  revokedHistoryProxy.revoke();
  revokedHistoryHarness.state.agentHistory = revokedHistoryProxy.proxy;
  await assert.doesNotReject(async () => { await revokedHistoryHarness.sandbox.tick(true); },
    "agent polling must not throw while hydrating a revoked history proxy");
  assert.equal(revokedHistoryHarness.maintenanceCalls,1);
  assert.equal(Array.isArray(revokedHistoryHarness.state.agentHistory),true);
  assert.equal(revokedHistoryHarness.state.agentHistory.length,0);

  const revokedPerksPollHarness = makeHarness(true);
  const revokedPerksForPoll = Proxy.revocable({ recovery: true }, {});
  revokedPerksForPoll.revoke();
  revokedPerksPollHarness.state.agentProfile = {
    id: "hossam", relationship: 52, storyStage: 0, customFeeRate: 0.05,
    strategyOverride: "", contractMultiplierDelta: 0, negotiationRaiseBonusDelta: 0,
    feeDebt: 0, perks: revokedPerksForPoll.proxy
  };
  await assert.doesNotReject(async () => { await revokedPerksPollHarness.sandbox.tick(true); },
    "polling must build a safe snapshot when agentProfile.perks is a revoked proxy");
  assert.equal(revokedPerksPollHarness.renders, 1,
    "a revoked perks proxy must not prevent the agent panel from refreshing");

  const revokedProfilePollHarness = makeHarness(true);
  const revokedProfileForPoll = Proxy.revocable({ id: "hossam", relationship: 52, perks: { recovery: true } }, {});
  revokedProfileForPoll.revoke();
  revokedProfilePollHarness.state.agentProfile = revokedProfileForPoll.proxy;
  await assert.doesNotReject(async () => { await revokedProfilePollHarness.sandbox.tick(true); },
    "polling must keep running when the saved top-level agent profile is a revoked proxy");
  assert.equal(revokedProfilePollHarness.renders, 1,
    "a revoked top-level profile must not suppress the agent panel refresh");

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
