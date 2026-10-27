#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "agent-system.js"), "utf8");
const publicSource = fs.readFileSync(path.join(root, "public", "agent-system.js"), "utf8");
assert.equal(source, publicSource, "root and public agent runtimes must stay in sync");
assert.doesNotMatch(source, /checkExpiry|isExpired\(/,
  "agent representation must not be removed automatically at a season boundary");
assert.ok(source.includes('p.contractType="open-ended"'),
  "existing agent saves must migrate to open-ended representation");
assert.ok(source.includes("الاتفاق مفتوح المدة") && source.includes("تقدر تنهيه في أي وقت"),
  "the current-agent panel must clearly show the indefinite contract and manual exit");

const documentListeners = {};
const windowListeners = {};
const overlays = [];
const document = {
  readyState: "complete",
  addEventListener(type, callback) { documentListeners[type] = callback; },
  querySelector() { return null; },
  getElementById() { return null; },
  createElement(tagName) {
    return {
      tagName, hidden: false, innerHTML: "", id: "", className: "",
      addEventListener() {},
      querySelector() { return null; }
    };
  },
  body: { appendChild(node) { overlays.push(node); } }
};

const state = {
  careerStarted: true, retired: false, season: 9, day: 10, apps: 0,
  seasonFinished: false, money: 10000, weeklyWage: 1000, agent: true,
  agentHistory: [],
  agentProfile: {
    id: "hossam", name: "حسام الجندي", feeRate: 0.05, customFeeRate: 0.05,
    relationship: 55, hiredSeason: 1, expiresSeason: 3, signedDay: 1,
    signedApps: 0, lastChapterApps: 0, lastChapterSeason: 1,
    lastPerformanceMilestone: 0, storyStage: 0, strategyOverride: "",
    perks: {}, feeDebt: 0, contractMultiplierDelta: 0,
    negotiationRaiseBonusDelta: 0
  }
};
let saveCount = 0;
let renderCount = 0;
const notices = [];
const api = {
  getState: () => state,
  save: () => { saveCount++; return true; },
  render: () => { renderCount++; },
  log: () => {},
  toast: (message) => notices.push(String(message)),
  setStory: () => {},
  overall: () => 70
};
const window = {
  LWStoryRuntime: api,
  setInterval() {},
  addEventListener(type, callback) { windowListeners[type] = callback; }
};
const sandbox = { window, document, console: { error() {}, log() {} } };
vm.runInNewContext(source, sandbox, { filename: "agent-system.js" });

assert.equal(state.agent, true,
  "an existing representative must remain active after the legacy two-season expiry");
assert.equal(state.agentProfile.id, "hossam");
assert.equal(state.agentProfile.contractType, "open-ended");
state.season = 99;
windowListeners.pageshow();
assert.equal(state.agent, true,
  "season progression and page refresh must not automatically terminate representation");
assert.equal(state.agentProfile.id, "hossam");

function clickAction(action, attrs = {}) {
  const button = {
    disabled: false,
    getAttribute(name) {
      if (name === "data-lwag-action") return action;
      if (name === "data-agent-id") return attrs.agentId || null;
      if (name === "data-choice-index") return attrs.choiceIndex == null ? null : String(attrs.choiceIndex);
      return null;
    }
  };
  const handler = documentListeners.click;
  assert.equal(typeof handler, "function", "agent action click handler must be installed");
  handler({ target: { closest: () => button }, preventDefault() {} });
}

clickAction("agent-meet", { agentId: "nadine" });
assert.ok(overlays.length > 0, "opening another agent must show the negotiation dialog");
assert.ok(overlays[0].innerHTML.includes("إنهاء الاتفاق الحالي"),
  "switching agents must explain the current contract exit fee");
clickAction("agent-switch-sign", { agentId: "nadine" });
assert.equal(state.agent, true);
assert.equal(state.agentProfile.id, "nadine",
  "confirming a switch must leave exactly the newly selected representative active");
assert.equal(state.agentProfile.contractType, "open-ended");
assert.equal(state.money, 9620,
  "switching must charge the current agent's configured exit fee exactly once");
assert.ok(state.agentHistory.some(entry => entry.title === "تغيير الوكيل"));
assert.ok(state.agentHistory.some(entry => entry.title === "توقيع اتفاق تمثيل مع نادين فريد"));

clickAction("agent-end-current");
assert.ok(overlays[0].innerHTML.includes("إنهاء اتفاق التمثيل"),
  "the current agent profile must expose a manual termination action");
clickAction("agent-confirm-end");
assert.equal(state.agent, false, "manual termination must deactivate representation");
assert.equal(state.agentProfile, null, "manual termination must clear only the active profile");
assert.equal(state.money, 9240,
  "manual termination must charge the agreed exit fee once");
assert.ok(state.agentHistory.some(entry => entry.title === "إنهاء اتفاق الوكالة"));

clickAction("agent-meet", { agentId: "seif" });
clickAction("agent-sign", { agentId: "seif" });
assert.equal(state.agent, true,
  "a player must be able to sign a new agent immediately after termination");
assert.equal(state.agentProfile.id, "seif");
assert.equal(state.agentProfile.contractType, "open-ended");
assert.equal(state.money, 9240, "signing a replacement agent must not charge a second exit fee");
assert.ok(saveCount >= 3, "contract changes must persist through the existing save API");
assert.ok(renderCount >= 3, "contract changes must refresh the interface");

console.log("PASS: open-ended agent contracts, legacy-save migration, manual termination, and agent switching.");
