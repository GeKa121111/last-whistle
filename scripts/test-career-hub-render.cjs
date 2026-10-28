"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "career-hub.js"), "utf8");
const deployed = fs.readFileSync(path.join(root, "public", "career-hub.js"), "utf8");
assert.equal(source, deployed, "root and public career hub scripts must stay synchronized");

let intervalCallback = null;
let intervalMs = 0;
let queryCalls = 0;
const listeners = Object.create(null);
const nodes = new Map();
const makeNode = () => ({
  textContent: "", title: "", disabled: false, className: "",
  style: { width: "" },
  classList: { toggle() {} }
});
const state = {
  careerStarted: true, retired: false, winterBreakPending: false,
  energy: 65, morale: 60, fatigue: 25, trust: 55, coachRelationship: 50,
  injuryDays: 0, injuryName: "", playedToday: false, trainedToday: false,
  dailyActionUsed: false, dailyActionDay: 1, dailyActionType: "",
  day: 1, season: 1, apps: 1, totalCareerAppearances: 1,
  goals: 1, assists: 0, seasonApps: 1, pos: "رأس حربة",
  careerMatchHistory: [{ minutes: 90, scope: "league", goals: 1, assists: 0 }]
};
const coachButton = { disabled: false };
const document = {
  readyState: "complete",
  hidden: false,
  getElementById(id) { if (!nodes.has(id)) nodes.set(id, makeNode()); return nodes.get(id); },
  querySelectorAll(selector) { queryCalls++; return selector.includes('data-action="coach"') ? [coachButton] : []; },
  addEventListener(name, callback) { (listeners[name] ||= []).push(callback); }
};
const window = {
  LWStoryRuntime: { getState: () => state },
  setInterval(callback, ms) { intervalCallback = callback; intervalMs = ms; return 1; },
  addEventListener(name, callback) { (listeners["window:" + name] ||= []).push(callback); }
};
vm.runInNewContext(source, { window, document, console, Math, Number, String, JSON, Array }, { filename: "career-hub.js" });
assert.equal(intervalMs, 1500, "wellness/stat UI polling should be reduced from sub-second polling");
assert.equal(queryCalls, 1, "initial render should mount wellness controls once");

intervalCallback();
assert.equal(queryCalls, 1, "unchanged state must not rebuild the wellness UI");

state.energy = 20;
intervalCallback();
assert.equal(queryCalls, 2, "a display-relevant state change must refresh the wellness UI");
assert.equal(nodes.get("wellnessEnergyValue").textContent, "20/100");

document.hidden = true;
state.energy = 80;
intervalCallback();
assert.equal(queryCalls, 2, "background tabs must skip wellness rendering");
assert.equal(nodes.get("wellnessEnergyValue").textContent, "20/100");

document.hidden = false;
listeners.visibilitychange[0]();
assert.equal(queryCalls, 3, "returning to a visible tab must refresh immediately");
assert.equal(nodes.get("wellnessEnergyValue").textContent, "80/100");

state.careerMatchHistory.push({ minutes: 120, scope: "cup", goals: 1, assists: 1 });
state.apps = 2; state.totalCareerAppearances = 2; state.goals = 2; state.assists = 1;
intervalCallback();
assert.equal(queryCalls, 4, "new career history must invalidate the render signature");
assert.equal(nodes.get("statsGoalsPer90").textContent, "0.86");
assert.equal(nodes.get("statsAssistsPer90").textContent, "0.43");

console.log("PASS: career hub skips unchanged renders, pauses while hidden, and refreshes changed career stats.");
