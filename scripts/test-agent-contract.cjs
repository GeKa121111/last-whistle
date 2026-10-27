"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "agent-system.js"), "utf8");
const deployed = fs.readFileSync(path.join(root, "public", "agent-system.js"), "utf8");
assert.equal(source, deployed, "root and deployed agent-system.js must stay synchronized");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const deployedSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
assert.equal(sw, deployedSw, "root and deployed service workers must stay synchronized");
assert.ok(sw.includes('const CACHE_NAME = "last-whistle-static-v71";'),
  "open-ended agent contracts must invalidate the old offline cache");

const documentListeners = Object.create(null);
const windowListeners = Object.create(null);
const elements = new Map();
const makeNode = id => ({
  id: id || "", hidden: false, innerHTML: "", textContent: "", className: "",
  setAttribute() {}, addEventListener() {}, focus() {},
  insertAdjacentElement(_where, node) { elements.set(node.id, node); },
  querySelector() { return makeNode("dialog-close"); },
  appendChild(node) { elements.set(node.id, node); }
});
const contractGrid = makeNode("contract-grid");
const document = {
  readyState: "loading",
  body: makeNode("body"),
  addEventListener(type, callback) {
    (documentListeners[type] ||= []).push(callback);
  },
  querySelector(selector) {
    return selector === "#page-contract .grid" ? contractGrid : null;
  },
  createElement(tag) { return makeNode(tag); },
  getElementById(id) {
    if (elements.has(id)) return elements.get(id);
    if (id === "lwa-agent-system") return null;
    if (elements.has("lwa-agent-system")) {
      const node = makeNode(id);
      elements.set(id, node);
      return node;
    }
    return null;
  }
};
const state = {
  careerStarted: true, retired: false, season: 1, day: 1, apps: 0,
  weeklyWage: 1000, money: 50000, agent: false, agentProfile: null,
  agentHistory: [], storyFlags: {}, energy: 80, fatigue: 10
};
const api = {
  getState: () => state,
  save: () => true,
  render: () => {},
  toast: () => {},
  log: () => {},
  setStory: () => {},
  overall: () => 60
};
const window = {
  LWStoryRuntime: api,
  addEventListener(type, callback) { windowListeners[type] = callback; },
  setInterval() { return 1; }
};
const context = { window, document, console };
vm.createContext(context);
vm.runInContext(source, context, { filename: "agent-system.js" });
assert.ok(window.LWAgentRuntime, "agent runtime must initialize");
for (const callback of documentListeners.DOMContentLoaded || []) callback();

function click(action, agentId) {
  const button = {
    disabled: false,
    getAttribute(name) {
      if (name === "data-lwag-action") return action;
      if (name === "data-agent-id") return agentId || "";
      if (name === "data-choice-index") return "0";
      return null;
    }
  };
  for (const callback of documentListeners.click || []) {
    callback({ target: { closest: () => button }, preventDefault() {} });
  }
}

// Signing creates an open-ended contract rather than a two-season deal.
click("agent-sign", "hossam");
assert.equal(state.agent, true, "signing must activate the agent");
assert.equal(state.agentProfile.id, "hossam", "the signed representative must be persisted");
assert.equal(state.agentProfile.contractMode, "open-ended");
assert.equal(state.agentProfile.expiresSeason, null, "new representation contracts must not have an automatic expiry");

// Simulate an old saved contract and advance far beyond its former expiry season.
delete state.agentProfile.contractMode;
state.agentProfile.expiresSeason = 3;
state.season = 20;
assert.equal(windowListeners.pageshow instanceof Function, true, "pageshow must re-check a restored career");
windowListeners.pageshow();
assert.equal(state.agent, true, "an agent must remain hired after multiple seasons until the player ends the agreement");
assert.equal(state.agentProfile.id, "hossam", "legacy saves must retain their contracted representative");
assert.equal(state.agentProfile.contractMode, "open-ended", "legacy contracts must be migrated");
assert.equal(state.agentProfile.expiresSeason, null, "legacy expiry dates must be cleared");
assert.equal(state.agentHistory.some(event => event.title === "انتهاء عقد الوكيل"), false,
  "season progression must not auto-terminate an open-ended contract");

// The player can switch directly from the current representative to another one.
click("agent-meet", "nadine");
click("agent-switch-sign", "nadine");
assert.equal(state.agent, true, "switching agents should leave representation active");
assert.equal(state.agentProfile.id, "nadine", "switching must sign the newly selected agent");
assert.ok(state.agentHistory.some(event => event.title === "تغيير الوكيل"),
  "switching should write a history entry for the old and new agreement");

// The player can also end the current agreement, then sign a different agent later.
const moneyBeforeTermination = state.money;
click("agent-active", "nadine");
click("agent-end-current", "nadine");
click("agent-confirm-end", "nadine");
assert.equal(state.agent, false, "confirmed termination should remove the current representative");
assert.equal(state.agentProfile, null, "confirmed termination should clear the current profile");
assert.ok(state.money < moneyBeforeTermination, "the configured in-game exit fee should be charged on termination");
click("agent-sign", "karim");
assert.equal(state.agent, true, "the player can sign another representative after termination");
assert.equal(state.agentProfile.id, "karim", "the new representative must become active");
assert.ok(state.agentHistory.some(event => event.title === "إنهاء اتفاق الوكالة"),
  "voluntary termination should be recorded in the agent history");

console.log("PASS: open-ended agent contracts persist across seasons, migrate old saves, and can be terminated or switched.");
