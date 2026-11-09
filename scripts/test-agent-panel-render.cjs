"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "agent-system.js"), "utf8");
const publicSource = fs.readFileSync(path.join(root, "public", "agent-system.js"), "utf8");
assert.equal(source, publicSource, "root and public agent runtime must stay synchronized");

const start = source.indexOf("  function tick(force){");
const end = source.indexOf('\n  document.addEventListener("click"', start);
assert.ok(start >= 0 && end > start, "agent tick must be extractable for a focused behavior test");
const tickSource = source.slice(start, end);
const debtHelperStart = source.indexOf("  function inspectAgentArrayData(");
const debtHelperEnd = source.indexOf("  function outstandingFeeDebt(", debtHelperStart);
assert.ok(debtHelperStart >= 0 && debtHelperEnd > debtHelperStart,
  "safe debt-ledger helpers must be extractable for panel snapshot tests");
const debtHelperSource = source.slice(debtHelperStart, debtHelperEnd);
const safeTextStart = source.indexOf("  function safeAgentText(value,fallback){");
const safeTextEnd = source.indexOf("\n  function safeAgentId", safeTextStart);
assert.ok(safeTextStart >= 0 && safeTextEnd > safeTextStart, "safe persisted-text helper must exist");
const safeTextSource = source.slice(safeTextStart, safeTextEnd);
const safeFieldStart = source.indexOf("  function safeAgentField(record,key){");
const safeFieldEnd = source.indexOf("\n  function isPlainAgentRecord", safeFieldStart);
assert.ok(safeFieldStart >= 0 && safeFieldEnd > safeFieldStart, "safe persisted-field helper must exist");
const safeFieldSource = source.slice(safeFieldStart, safeFieldEnd);
const finiteNumberStart = source.indexOf("  function finiteAgentNumber(value){");
const safeNumberEnd = source.indexOf("\n  function safeWholeAmount", finiteNumberStart);
assert.ok(finiteNumberStart >= 0 && safeNumberEnd > finiteNumberStart,
  "safe persisted-number helpers must exist");
const safeNumberSource = source.slice(finiteNumberStart, safeNumberEnd);
assert.ok(tickSource.includes("panelWasRendered"), "panel render state must handle late DOM mounting");
assert.ok(!tickSource.includes("checkExpiry(s)"),
  "the render optimization must not reintroduce automatic expiry for open-ended agent contracts");
const renderPanelStart = source.indexOf("  function renderPanel(s){");
const renderPanelEnd = source.indexOf("\n  function ensureOverlay", renderPanelStart);
assert.ok(renderPanelStart >= 0 && renderPanelEnd > renderPanelStart, "agent panel renderer must be extractable");
const renderPanelSource = source.slice(renderPanelStart, renderPanelEnd);
assert.ok(renderPanelSource.includes('safeAgentField(s,"agentLead")') && !renderPanelSource.includes("s.agentLead"),
  "agent lead display must read legacy state through the guarded field helper");

const state = {
  careerStarted: true,
  agent: true,
  agentLead: null,
  retired: false,
  agentProfile: {
    id: "agent-a",
    relationship: 55,
    storyStage: 1,
    customFeeRate: 0.05,
    strategyOverride: "local",
    contractMultiplierDelta: 0,
    negotiationRaiseBonusDelta: 0,
    feeDebt: 0,
    perks: {}
  },
  agentHistory: [],
  apps: 4,
  season: 2,
  seasonFinished: false,
  money: 1200,
  weeklyWage: 600
};
let ready = true;
let renders = 0;
let saves = 0;
const api = { getState: () => state, save: () => { saves++; } };
const sandbox = {
  API: () => api,
  ensureState: () => false,
  renewRelationship: () => false,
  cloneAgentMaintenancePreview: value => {
    const preview = {};
    Object.keys(value).forEach(key => {
      let next;
      try { next = value[key]; } catch (_) { next = undefined; }
      Object.defineProperty(preview, key, { value: next, enumerable: true, writable: true, configurable: true });
    });
    return preview;
  },
  runAgentContractMutation: (value, operation) => { operation(); return Promise.resolve({ ok: true }); },
  agentContractMutationPending: false,
  postRetirementMutationPending: false,
  scheduleTick: () => {},
  ensurePanel: () => ready,
  renderPanel: () => { renders++; },
  lastSnapshot: "",
  panelWasRendered: false,
  document: { hidden: false }
};
vm.createContext(sandbox);
vm.runInContext("var agentContractMutationPending=false; var postRetirementMutationPending=false;", sandbox);
vm.runInContext(safeFieldSource + "\n" + safeTextSource + "\n" + safeNumberSource + "\n" + debtHelperSource + "\n" + tickSource, sandbox, { filename: "agent-system.tick" });

sandbox.tick();
sandbox.tick();
assert.equal(renders, 1, "an unchanged career snapshot must not rebuild the panel every tick");

state.money -= 50;
sandbox.tick();
assert.equal(renders, 2, "a display-relevant balance change must refresh the panel");

ready = false;
sandbox.tick();
assert.equal(renders, 2, "a missing panel must not trigger a render");
ready = true;
sandbox.tick();
assert.equal(renders, 3, "a panel mounted later must render even when the snapshot is unchanged");
assert.equal(saves, 0, "render optimization must not write saves for an unchanged state");

// A JSON-valid object with a non-callable toString method can occur in old saves.
// The actual production helper must keep the snapshot/panel refresh alive.
const hostileSavedText = JSON.parse('{"toString":"not-callable","valueOf":"not-callable"}');
state.agentProfile.perks = { legacyValue: hostileSavedText };
state.agentHistory = [{ title: hostileSavedText, day: 3, season: 2 }];
assert.doesNotThrow(() => sandbox.tick(),
  "malformed but valid-JSON agent text must not crash panel snapshot generation");
assert.equal(renders, 4, "a changed legacy agent snapshot must still refresh the panel");

// Legacy agentLead is display-only state. Its object details must never be serialized into the render snapshot.
state.agentLead = new Proxy({ id: "legacy-lead" }, {
  get(target, key, receiver) {
    if (key === "id") throw new Error("hostile agent lead getter");
    return Reflect.get(target, key, receiver);
  }
});
assert.doesNotThrow(() => sandbox.tick(), "a hostile legacy agent lead must not break the agent panel snapshot");
assert.equal(renders, 5, "a changed agent lead must still refresh the panel");

Object.defineProperty(state, "agentLead", {
  configurable: true, enumerable: true,
  get() { throw new Error("hostile agentLead state getter"); }
});
assert.doesNotThrow(() => sandbox.tick(), "a throwing top-level agentLead getter must fail closed");
assert.equal(renders, 6, "the panel must remain renderable when agentLead cannot be read");

console.log("PASS: agent panel rendering handles hostile legacy text and agent-lead values while remaining snapshot-driven.");
