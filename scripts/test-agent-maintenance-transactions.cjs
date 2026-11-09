
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
const previewStart = source.indexOf("  function cloneAgentMaintenancePreview(state){");
const previewEnd = source.indexOf("  function tick(force){", previewStart);
const helperStart = source.indexOf("  var postRetirementMutationPending = false;");
const helperEnd = source.indexOf("  async function startPostRetirementAgency", helperStart);
assert.ok(previewStart >= 0 && previewEnd > previewStart, "lightweight maintenance preview must exist");
assert.ok(helperStart >= 0 && helperEnd > helperStart, "shared agent transaction helpers must exist");
const runtimeSource = safeFieldSource + "\n" + source.slice(previewStart, previewEnd) + "\n" + source.slice(helperStart, helperEnd);
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
  assert.notEqual(preview.agentHistory, largeState.agentHistory, "agent history must be isolated in the preview");
  assert.equal(preview.worldSimulation, largeState.worldSimulation,
    "maintenance preview must not clone the large world/player database");
  preview.agentProfile.relationship = 99;
  assert.equal(largeState.agentProfile.relationship, 52);

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
