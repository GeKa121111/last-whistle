"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "agent-system.js"), "utf8");
const publicSource = fs.readFileSync(path.join(root, "public", "agent-system.js"), "utf8");
assert.equal(source, publicSource, "root and public agent runtime must stay synchronized");

const start = source.indexOf("  function tick(){");
const end = source.indexOf('\n  document.addEventListener("click"', start);
assert.ok(start >= 0 && end > start, "agent tick must be extractable for a focused behavior test");
const tickSource = source.slice(start, end);
assert.ok(tickSource.includes("panelWasRendered"), "panel render state must handle late DOM mounting");
assert.ok(!tickSource.includes("checkExpiry(s)"),
  "the render optimization must not reintroduce automatic expiry for open-ended agent contracts");

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
  ensurePanel: () => ready,
  renderPanel: () => { renders++; },
  lastSnapshot: "",
  panelWasRendered: false,
  document: { hidden: false }
};
vm.createContext(sandbox);
vm.runInContext(tickSource, sandbox, { filename: "agent-system.tick" });

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

console.log("PASS: agent panel rendering is snapshot-driven and preserves open-ended contract behavior.");
