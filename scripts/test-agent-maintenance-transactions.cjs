
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "agent-system.js"), "utf8");
const publicSource = fs.readFileSync(path.join(root, "public", "agent-system.js"), "utf8");
assert.equal(source, publicSource, "agent root/public runtimes must remain identical");

const safeFieldStart = source.indexOf("  function safeAgentField(record,key){");
const safeFieldEnd = source.indexOf("\n  function isPlainAgentRecord", safeFieldStart);
assert.ok(safeFieldStart >= 0 && safeFieldEnd > safeFieldStart, "guarded state-field reader must exist");
const safeFieldSource = source.slice(safeFieldStart, safeFieldEnd);
const debtArrayStart = source.indexOf("  function inspectAgentArrayData(");
const debtArrayEnd = source.indexOf("  function outstandingFeeDebt(", debtArrayStart);
assert.ok(debtArrayStart >= 0 && debtArrayEnd > debtArrayStart, "safe debt array inspector must exist");
const debtArraySource = source.slice(debtArrayStart, debtArrayEnd);
const historyStart = source.indexOf("  function isNormalizedAgentHistoryEntry(value,normalized){");
const historyEnd = source.indexOf("\n  function normalizeAgentFeeQuote", historyStart);
assert.ok(historyStart >= 0 && historyEnd > historyStart, "agent history normalization helpers must exist");
const historySource = source.slice(historyStart, historyEnd);
const previewStart = source.indexOf("  function cloneAgentMaintenancePreview(state){");
const previewEnd = source.indexOf("  function tick(force){", previewStart);
const helperStart = source.indexOf("  var postRetirementMutationPending = false;");
const helperEnd = source.indexOf("  async function startPostRetirementAgency", helperStart);
assert.ok(previewStart >= 0 && previewEnd > previewStart, "lightweight maintenance preview must exist");
assert.ok(helperStart >= 0 && helperEnd > helperStart, "shared agent transaction helpers must exist");
const runtimeSource = safeFieldSource + "\n" + historySource + "\n" + debtArraySource + "\n" + source.slice(previewStart, previewEnd) + "\n" + source.slice(helperStart, helperEnd);
const tickStart = source.indexOf("  function tick(force){");
const tickEnd = source.indexOf("  function scheduleTick(force){", tickStart);
const tickSource = source.slice(tickStart, tickEnd);
assert.match(tickSource, /runAgentContractMutation\(s,/);
assert.doesNotMatch(tickSource, /api\.save\(/, "periodic maintenance must never fire-and-forget persistence");

function makeHarness(flush) {
  let saves = 0, flushes = 0, renders = 0;
  const notices = [];
  const api = {
    save() { saves += 1; return true; },
    render() { renders += 1; },
    toast(message) { notices.push(String(message)); }
  };
  const window = {
    structuredClone,
    flushQueuedSave() {
      flushes += 1;
      if (typeof flush === "function") return flush(flushes);
      return Promise.resolve(Array.isArray(flush) ? flush.shift() !== false : true);
    },
    console
  };
  const sandbox = {
    API: () => api, window, console, Promise,
    safeAgentNumber: (value, fallback) => typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() && Number.isFinite(Number(value)) ? Number(value) : fallback,
    safeAgentNumber: (value, fallback) => typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() && Number.isFinite(Number(value)) ? Number(value) : fallback,
    safeAgentText: (value, fallback) => typeof value === "string" ? value
      : typeof value === "number" && Number.isFinite(value) ? String(value)
        : typeof value === "boolean" ? (value ? "true" : "false")
          : (typeof fallback === "string" ? fallback : ""),
    safeWholeAmount: value => {
      const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : 0;
      return Number.isSafeInteger(number) && number > 0 ? number : 0;
    },
    isPlainAgentRecord: value => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      try {
        const prototype = Object.getPrototypeOf(value);
        return prototype === null || (Object.getPrototypeOf(prototype) === null
          && Object.prototype.hasOwnProperty.call(prototype, "constructor")
          && typeof prototype.constructor === "function" && prototype.constructor.name === "Object");
      } catch (_) { return false; }
    },
    renderPanel() { renders += 1; }
  };
  vm.createContext(sandbox);
  vm.runInContext(runtimeSource, sandbox, { filename: "agent-system-maintenance-transactions" });
  return { sandbox, api, notices, counts: () => ({ saves, flushes, renders }) };
}

function stateFixture() {
  return {
    money: 1000, retired: true, agent: true, season: 3, day: 8, apps: 15,
    agentHistory: [],
    agentProfile: { id: "hossam", name: "حسام", relationship: 52, feeDebt: 0, lastPerformanceMilestone: 0, perks: {} }
  };
}

(async function () {
  const previewHarness = makeHarness([]);
  const largeState = Object.assign(stateFixture(), {
    worldSimulation: { players: { p1: { name: "Existing player" } }, clubs: { c1: { name: "Existing club" } } }
  });
  const preview = previewHarness.sandbox.cloneAgentMaintenancePreview(largeState);
  assert.ok(preview);
  assert.notEqual(preview.agentProfile, largeState.agentProfile, "agent profile must be cloned before preview mutation");
  assert.equal(preview.agentHistory, largeState.agentHistory, "agent history must stay by reference until descriptor-based normalization can sanitize it safely");
  assert.equal(preview.worldSimulation, largeState.worldSimulation,
    "maintenance preview must not clone the large world/player database");
  preview.agentProfile.relationship = 99;
  assert.equal(largeState.agentProfile.relationship, 52);

  const validPerksState = stateFixture();
  validPerksState.agentProfile.perks = { recovery: true, negotiation: false };
  const validPerksPreview = previewHarness.sandbox.cloneAgentMaintenancePreview(validPerksState);
  assert.ok(validPerksPreview);
  assert.notEqual(validPerksPreview.agentProfile.perks, validPerksState.agentProfile.perks,
    "maintenance preview must isolate the perks record before reading or normalizing it");
  assert.equal(validPerksPreview.agentProfile.perks.recovery, true);
  validPerksPreview.agentProfile.perks.recovery = false;
  assert.equal(validPerksState.agentProfile.perks.recovery, true,
    "preview perk changes must not mutate the saved agent profile");

  const revokedPerksState = stateFixture();
  const revokedPerksProxy = Proxy.revocable({ recovery: true }, {});
  revokedPerksProxy.revoke();
  revokedPerksState.agentProfile.perks = revokedPerksProxy.proxy;
  const revokedPerksPreview = previewHarness.sandbox.cloneAgentMaintenancePreview(revokedPerksState);
  assert.ok(revokedPerksPreview, "a revoked perks proxy must not abort maintenance preview creation");
  assert.equal(Object.keys(revokedPerksPreview.agentProfile.perks).length, 0,
    "unreadable perks should become an empty preview record without invoking proxy traps");

  const hostilePerksState = stateFixture();
  hostilePerksState.agentProfile.perks = new Proxy({ recovery: true }, {
    ownKeys() { throw new Error("hostile perks ownKeys trap"); }
  });
  const hostilePerksPreview = previewHarness.sandbox.cloneAgentMaintenancePreview(hostilePerksState);
  assert.ok(hostilePerksPreview, "a throwing perks ownKeys trap must not abort maintenance preview creation");
  assert.equal(Object.keys(hostilePerksPreview.agentProfile.perks).length, 0);

  const revokedProfileState = stateFixture();
  const revokedProfileProxy = Proxy.revocable({ id: "hossam", relationship: 52, perks: { recovery: true } }, {});
  revokedProfileProxy.revoke();
  revokedProfileState.agentProfile = revokedProfileProxy.proxy;
  const revokedProfilePreview = previewHarness.sandbox.cloneAgentMaintenancePreview(revokedProfileState);
  assert.ok(revokedProfilePreview, "a revoked top-level agent profile must fail closed instead of cancelling maintenance");
  assert.equal(typeof revokedProfilePreview.agentProfile, "object");
  assert.equal(Object.keys(revokedProfilePreview.agentProfile.perks).length, 0);

  const legacyProfileFieldsState = stateFixture();
  legacyProfileFieldsState.agentProfile.agentName = "Old Agent";
  legacyProfileFieldsState.agentProfile.exitFeeWeeks = 0.25;
  const legacyProfileFieldsPreview = previewHarness.sandbox.cloneAgentMaintenancePreview(legacyProfileFieldsState);
  assert.equal(legacyProfileFieldsPreview.agentProfile.agentName, "Old Agent",
    "maintenance previews must preserve valid legacy profile fields outside the current normalized schema");
  assert.equal(legacyProfileFieldsPreview.agentProfile.exitFeeWeeks, 0.25,
    "rollback snapshots must retain legacy agent exit-fee metadata");

  // JSON-valid legacy arrays can own a non-callable forEach property. The old
  // normalizer called value.forEach directly and crashed while hydrating the save.
  const legacyHistory = JSON.parse(JSON.stringify([
    { season: 3, day: 8, title: "تجديد العقد", text: "تم حفظ العرض القديم." },
    { season: 3, day: 9, title: "مقابلة", text: "تمت المقابلة." }
  ]));
  legacyHistory.forEach = "not-callable";
  const normalizedHistory = previewHarness.sandbox.normalizeAgentHistory(legacyHistory);
  assert.notEqual(normalizedHistory, legacyHistory, "history arrays with custom properties must be normalized");
  assert.equal(normalizedHistory.length, 2, "valid history records must be preserved");
  assert.equal(normalizedHistory[0].title, "تجديد العقد");
  assert.equal(normalizedHistory[1].text, "تمت المقابلة.");
  assert.equal(Object.prototype.hasOwnProperty.call(normalizedHistory, "forEach"), false,
    "non-index array properties must not survive history normalization");
  assert.equal(legacyHistory.forEach, "not-callable", "normalization must not mutate the original save");

  const getterHistory = [];
  Object.defineProperty(getterHistory, "0", {
    enumerable: true, configurable: true,
    get() { throw new Error("hostile history row getter"); }
  });
  getterHistory.length = 1;
  assert.doesNotThrow(() => previewHarness.sandbox.normalizeAgentHistory(getterHistory),
    "history normalization must inspect array slots without invoking getters");
  assert.equal(previewHarness.sandbox.normalizeAgentHistory(getterHistory).length, 0,
    "an unreadable history row must be skipped without losing later readable records");

  const revokedHistory = Proxy.revocable([], {});
  revokedHistory.revoke();
  assert.doesNotThrow(() => previewHarness.sandbox.normalizeAgentHistory(revokedHistory.proxy),
    "a revoked legacy history proxy must fail closed instead of aborting hydration");

  const getterLeadState = stateFixture();
  Object.defineProperty(getterLeadState, "agentLead", {
    enumerable: true,
    get() { throw new Error("hostile agentLead getter"); }
  });
  const getterLeadPreview = previewHarness.sandbox.cloneAgentMaintenancePreview(getterLeadState);
  assert.ok(getterLeadPreview, "a throwing display-only lead getter must not abort maintenance preview");
  assert.equal(getterLeadPreview.agentLead, undefined);

  const proxyLeadState = stateFixture();
  const proxyLead = new Proxy({ id: "legacy-lead" }, {
    get(target, key, receiver) {
      if (key === "id") throw new Error("hostile lead id getter");
      return Reflect.get(target, key, receiver);
    }
  });
  proxyLeadState.agentLead = proxyLead;
  const proxyLeadPreview = previewHarness.sandbox.cloneAgentMaintenancePreview(proxyLeadState);
  assert.ok(proxyLeadPreview, "a display-only proxy lead must not prevent maintenance preview");
  assert.equal(proxyLeadPreview.agentLead, proxyLead, "the lead marker should be retained without cloning unused nested fields");

  // The durable transaction snapshot must sanitize the ledger before structuredClone.
  const hostileLedgerState = stateFixture();
  const hostileLedger = [{
    id:"snapshot-debt",agentId:"former-agent",agentName:"وكيل سابق",reason:"دين محفوظ",
    amount:200,paid:50,outstanding:150,createdSeason:2,createdDay:3
  }];
  hostileLedger.forEach = "not-callable";
  hostileLedger.reduce = "not-callable";
  hostileLedgerState.agentFeeDebtLedger = hostileLedger;
  const hostileLedgerSnapshot = previewHarness.sandbox.cloneAgentContractMutationSnapshot(hostileLedgerState);
  assert.ok(hostileLedgerSnapshot,"a hostile JSON ledger must still produce a durable rollback snapshot");
  assert.equal(hostileLedgerSnapshot.agentFeeDebtLedger.length,1);
  assert.equal(hostileLedgerSnapshot.agentFeeDebtLedger[0].outstanding,150);
  assert.equal(Object.prototype.hasOwnProperty.call(hostileLedgerSnapshot.agentFeeDebtLedger,"forEach"),false);
  assert.equal(Object.prototype.hasOwnProperty.call(hostileLedgerSnapshot.agentFeeDebtLedger,"reduce"),false);

  const revokedLedgerState = stateFixture();
  const revokedLedger = Proxy.revocable([], {});
  revokedLedger.revoke();
  revokedLedgerState.agentFeeDebtLedger = revokedLedger.proxy;
  const revokedLedgerSnapshot = previewHarness.sandbox.cloneAgentContractMutationSnapshot(revokedLedgerState);
  assert.ok(revokedLedgerSnapshot,
    "a revoked debt-ledger proxy must not prevent a rollback-safe agent transaction snapshot");
  assert.equal(Array.isArray(revokedLedgerSnapshot.agentFeeDebtLedger),true);
  assert.equal(revokedLedgerSnapshot.agentFeeDebtLedger.length,0);

  const revokedTransactionHarness = makeHarness([true]);
  const revokedTransaction = await revokedTransactionHarness.sandbox.runAgentContractMutation(
    revokedLedgerState,
    function(){revokedLedgerState.agentFeeDebtLedger=[];return true;},
    null,{renderOnSuccess:false}
  );
  assert.equal(revokedTransaction.ok,true,
    "agent contract transactions must remain durable when a legacy debt ledger is a revoked proxy");

  const hostileHistoryState = stateFixture();
  const hostileHistory = [{season:2,day:4,title:"تجديد الوكيل",text:"تم تجديد العقد."}];
  hostileHistory.forEach = "not-callable";
  hostileHistory.reduce = "not-callable";
  hostileHistoryState.agentHistory = hostileHistory;
  const hostileHistorySnapshot = previewHarness.sandbox.cloneAgentContractMutationSnapshot(hostileHistoryState);
  assert.ok(hostileHistorySnapshot,"a hostile history array must still produce a durable rollback snapshot");
  assert.equal(hostileHistorySnapshot.agentHistory.length,1);
  assert.equal(hostileHistorySnapshot.agentHistory[0].title,"تجديد الوكيل");
  assert.equal(Object.prototype.hasOwnProperty.call(hostileHistorySnapshot.agentHistory,"forEach"),false);
  assert.equal(Object.prototype.hasOwnProperty.call(hostileHistorySnapshot.agentHistory,"reduce"),false);

  const revokedHistoryState = stateFixture();
  const revokedHistoryProxy = Proxy.revocable([], {});
  revokedHistoryProxy.revoke();
  revokedHistoryState.agentHistory = revokedHistoryProxy.proxy;
  const revokedHistorySnapshot = previewHarness.sandbox.cloneAgentContractMutationSnapshot(revokedHistoryState);
  assert.ok(revokedHistorySnapshot,
    "a revoked history proxy must not prevent a rollback-safe agent transaction snapshot");
  assert.equal(Array.isArray(revokedHistorySnapshot.agentHistory),true);
  assert.equal(revokedHistorySnapshot.agentHistory.length,0);

  const revokedHistoryTransactionHarness = makeHarness([true]);
  const revokedHistoryTransaction = await revokedHistoryTransactionHarness.sandbox.runAgentContractMutation(
    revokedHistoryState,
    function(){revokedHistoryState.agentHistory=[];return true;},
    null,{renderOnSuccess:false}
  );
  assert.equal(revokedHistoryTransaction.ok,true,
    "agent contract transactions must remain durable when a legacy history ledger is a revoked proxy");

  const failedState = stateFixture();
  const before = JSON.stringify(failedState);
  const failedHarness = makeHarness([false, true]);
  const failed = await failedHarness.sandbox.runAgentContractMutation(failedState, function () {
    failedState.agentProfile.relationship = 95;
    failedState.agentHistory.push({ title: "maintenance" });
    return true;
  }, null, { renderOnSuccess: false, renderOnFailure: true });
  assert.equal(failed.ok, false);
  assert.equal(failed.rollbackPersisted, true);
  assert.equal(JSON.stringify(failedState), before, "failed maintenance save must restore the full career snapshot");
  assert.deepEqual(failedHarness.counts(), { saves: 2, flushes: 2, renders: 2 });

  let releaseAgent;
  const agentFirst = makeHarness(() => new Promise(resolve => { releaseAgent = resolve; }));
  const agentState = stateFixture();
  const agentMutation = agentFirst.sandbox.runAgentContractMutation(agentState, function () {
    agentState.agentProfile.relationship += 5;
    return true;
  }, null, { renderOnSuccess: false });
  assert.equal(typeof releaseAgent, "function", "agent transaction must reach its pending durable flush");
  const blockedPostCareer = await agentFirst.sandbox.runPostRetirementMutation(agentState, function () {
    agentState.money -= 250;
    return true;
  });
  assert.equal(blockedPostCareer.ok, false, "post-retirement mutations must wait for an active agent contract transaction");
  assert.equal(agentState.money, 1000, "blocked post-retirement action must not mutate the balance");
  releaseAgent(true);
  assert.equal((await agentMutation).ok, true);

  let releaseRetirement;
  const retirementFirst = makeHarness(() => new Promise(resolve => { releaseRetirement = resolve; }));
  const retirementState = stateFixture();
  const retirementMutation = retirementFirst.sandbox.runPostRetirementMutation(retirementState, function () {
    retirementState.money -= 100;
    return true;
  });
  assert.equal(typeof releaseRetirement, "function", "post-retirement transaction must reach its pending durable flush");
  const blockedAgent = await retirementFirst.sandbox.runAgentContractMutation(retirementState, function () {
    retirementState.agentProfile.relationship += 10;
    return true;
  });
  assert.equal(blockedAgent.ok, false, "agent contract actions must wait for an active post-retirement transaction");
  assert.equal(retirementState.agentProfile.relationship, 52);
  releaseRetirement(true);
  assert.equal((await retirementMutation).ok, true);

  console.log("PASS: agent maintenance snapshots only agent-owned data, commits through durable rollback-safe transactions, and serializes contract/post-retirement writes.");
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
