#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "career-experience.js"), "utf8");
const deployed = fs.readFileSync(path.join(root, "public", "career-experience.js"), "utf8");
assert.equal(source, deployed, "root and public career-experience scripts must stay synchronized");

function makeHarness(overrides = {}) {
  const listeners = Object.create(null);
  const callbacks = new Map();
  const notices = [];
  let nextTimer = 1;
  let overlayCount = 0;
  let saveCount = 0;
  const state = Object.assign({
    careerStarted: true, retired: false, injuryDays: 0, energy: 10,
    careerXP: 0, shooting: 50, composure: 50, vision: 50,
    morale: 50, trust: 50, money: 1000, day: 1, calendarDay: 1,
    season: 1, apps: 0
  }, overrides);
  const timingButton = {
    textContent: "",
    attrs: { "data-lwcx-action": "timing-start" },
    setAttribute(name, value) { this.attrs[name] = value; },
    getAttribute(name) { return this.attrs[name] || null; }
  };
  const overlay = {
    hidden: true,
    innerHTML: "",
    addEventListener() {},
    querySelector(selector) {
      if (selector === ".lwcx-close") return { focus() {} };
      if (selector === '[data-lwcx-action="timing-start"]') return timingButton;
      return null;
    },
    querySelectorAll() { return []; }
  };
  const nodes = {
    "lwcx-timing-marker": { style: {} },
    "lwcx-timing-readout": { textContent: "" },
    "lwcx-power": { value: "68" },
    "lwcx-power-value": { textContent: "" }
  };
  const api = {
    getState: () => state,
    save: () => { saveCount++; return true; },
    render() {},
    toast: message => notices.push(String(message))
  };
  const fakeWindow = {
    LWStoryRuntime: api,
    setInterval(fn) { const id = nextTimer++; callbacks.set(id, fn); return id; },
    clearInterval(id) { callbacks.delete(id); },
    setTimeout(fn) { const id = nextTimer++; callbacks.set(id, fn); return id; },
    clearTimeout(id) { callbacks.delete(id); },
    addEventListener() {}
  };
  const fakeDocument = {
    readyState: "loading",
    addEventListener(type, callback) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(callback);
    },
    createElement() { overlayCount++; return overlay; },
    body: { appendChild() {} },
    getElementById(id) { return nodes[id] || null; }
  };
  vm.runInNewContext(source, { window: fakeWindow, document: fakeDocument, Math, console: { error() {} } }, {
    filename: "career-experience.js"
  });
  function click(action, attrs = {}) {
    const button = {
      disabled: false,
      getAttribute(name) {
        if (name === "data-lwcx-action") return action;
        return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
      }
    };
    const event = { target: { closest: () => button }, preventDefault() {} };
    listeners.click[0](event);
  }
  return { state, notices, overlay, click, get overlayCount() { return overlayCount; }, get saveCount() { return saveCount; } };
}

const emptyEnergy = makeHarness({ energy: 0 });
emptyEnergy.click("open-challenges");
assert.match(emptyEnergy.overlay.innerHTML, /data-lwcx-action="open-timing" disabled/,
  "timing challenge should be disabled in the menu when energy is insufficient");
emptyEnergy.click("open-timing");
assert.equal(emptyEnergy.state.careerWorld.challengeCount, 0,
  "a timing challenge with zero energy must not count an attempt");
assert.equal(emptyEnergy.state.careerXP, 0,
  "a timing challenge with zero energy must not grant XP");
assert.equal(emptyEnergy.overlayCount, 1,
  "the guard must reject the direct action without opening a challenge dialog");
assert.ok(emptyEnergy.notices.some(message => message.includes("طاقتك مش كفاية")),
  "the player should be told why the challenge is blocked");

const injured = makeHarness({ energy: 90, injuryDays: 2 });
injured.click("open-memory");
assert.equal(injured.state.careerWorld.challengeCount, 0,
  "an injured player must not start the memory challenge");
assert.equal(injured.state.careerXP, 0,
  "an injured player must not gain training XP");
assert.equal(injured.overlayCount, 0,
  "the memory challenge should not open while the player is injured");

const drainedDuringTiming = makeHarness({ energy: 3 });
drainedDuringTiming.click("open-timing");
drainedDuringTiming.click("timing-start");
drainedDuringTiming.state.energy = 0;
drainedDuringTiming.click("timing-stop");
assert.equal(drainedDuringTiming.state.careerWorld.challengeCount, 0,
  "a challenge that loses its required energy before completion must not count");
assert.equal(drainedDuringTiming.state.careerXP, 0,
  "a stale timing completion must not grant XP without enough energy");
assert.equal(drainedDuringTiming.state.composure, 50,
  "a blocked timing completion must not change attributes");
assert.equal(drainedDuringTiming.saveCount, 0,
  "a blocked timing completion must not save a fake reward");

const injuredDuringTiming = makeHarness({ energy: 3 });
injuredDuringTiming.click("open-timing");
injuredDuringTiming.click("timing-start");
injuredDuringTiming.state.injuryDays = 1;
injuredDuringTiming.click("timing-stop");
assert.equal(injuredDuringTiming.state.careerWorld.challengeCount, 0,
  "an injury acquired during a challenge must block completion rewards");
assert.equal(injuredDuringTiming.state.careerXP, 0,
  "an injured challenge completion must not grant XP");

const valid = makeHarness({ energy: 10 });
valid.click("open-timing");
valid.click("timing-start");
valid.click("timing-stop");
assert.equal(valid.state.careerWorld.challengeCount, 1,
  "a valid timing challenge should still count once");
assert.equal(valid.state.careerWorld.practiceAttempts, 1);
assert.equal(valid.state.energy, 7, "a valid timing challenge should charge its three-energy cost");
assert.equal(valid.state.careerXP, 3, "a valid unsuccessful attempt should retain the intended practice XP");
assert.equal(valid.saveCount, 1, "a valid challenge result should be saved once");

const makeOpenInvestments = count => Array.from({ length: count }, (_, index) => ({
  id: index + 1, kind: "safe", label: "ادخار آمن", amount: 100, payout: 118, dueDay: 30, settled: false
}));
const fullPortfolio = makeHarness({
  money: 1000,
  careerWorld: { investments: makeOpenInvestments(5), investmentSequence: 1 }
});
fullPortfolio.click("open-finance");
fullPortfolio.click("invest-safe");
assert.equal(fullPortfolio.state.money, 1000,
  "the sixth open investment must not charge the player");
assert.equal(fullPortfolio.state.careerWorld.investments.length, 5,
  "the action handler must enforce the five-open-investment limit, not only the disabled UI");
assert.equal(fullPortfolio.state.careerWorld.investmentSequence, 6,
  "legacy investment sequence counters must advance past existing IDs without reusing one");
assert.ok(fullPortfolio.notices.some(message => message.includes("5 عمليات استثمار مفتوحة")),
  "the player should be told when the portfolio limit blocks a new investment");

const availablePortfolio = makeHarness({
  money: 1000,
  careerWorld: { investments: makeOpenInvestments(4), investmentSequence: 1 }
});
availablePortfolio.click("open-finance");
availablePortfolio.click("invest-safe");
assert.equal(availablePortfolio.state.money, 900,
  "a player with fewer than five open investments should still be able to invest");
assert.equal(availablePortfolio.state.careerWorld.investments.length, 5);
assert.equal(availablePortfolio.state.careerWorld.investments.at(-1).id, 5,
  "new investment IDs must remain unique when a legacy sequence counter is stale");

const lowEnergyCoach = makeHarness({
  energy: 2, coachRelationship: 40, trust: 50, professionalism: 60, dailyActionUsed: false
});
lowEnergyCoach.click("mentor-coach");
assert.equal(lowEnergyCoach.state.coachRelationship, 40,
  "a coach session must not grant relationship points without its three-energy cost");
assert.equal(lowEnergyCoach.state.trust, 50);
assert.equal(lowEnergyCoach.state.professionalism, 60);
assert.equal(lowEnergyCoach.state.energy, 2);
assert.equal(lowEnergyCoach.state.dailyActionUsed, false,
  "a blocked coach session must not consume the daily action");
assert.equal(lowEnergyCoach.state.careerWorld.mentorSessions, 0);
assert.ok(lowEnergyCoach.notices.some(message => message.includes("طاقتك مش كفاية")));

const lowEnergyTeammate = makeHarness({ energy: 0, teamChemistry: 50, morale: 50, dailyActionUsed: false });
lowEnergyTeammate.click("mentor-teammate");
assert.equal(lowEnergyTeammate.state.teamChemistry, 50,
  "supporting a teammate must not grant free chemistry without one energy");
assert.equal(lowEnergyTeammate.state.morale, 50);
assert.equal(lowEnergyTeammate.state.dailyActionUsed, false);

const validCoach = makeHarness({
  energy: 3, coachRelationship: 40, trust: 50, professionalism: 60, dailyActionUsed: false
});
validCoach.click("mentor-coach");
assert.equal(validCoach.state.coachRelationship, 45);
assert.equal(validCoach.state.trust, 52);
assert.equal(validCoach.state.professionalism, 63);
assert.equal(validCoach.state.energy, 0);
assert.equal(validCoach.state.dailyActionUsed, true);
assert.equal(validCoach.state.careerWorld.mentorSessions, 1,
  "a valid coach session should retain its intended daily reward");

const restAtZero = makeHarness({ energy: 0, morale: 50, fatigue: 20, dailyActionUsed: false });
restAtZero.click("mentor-reset");
assert.equal(restAtZero.state.energy, 7,
  "mental rest must remain available when the player has no energy");
assert.equal(restAtZero.state.morale, 55);
assert.equal(restAtZero.state.fatigue, 16);
assert.equal(restAtZero.state.dailyActionUsed, true);

const invalidMentorAction = makeHarness({ energy: 0, morale: 50, dailyActionUsed: false });
invalidMentorAction.click("mentor-hack");
assert.equal(invalidMentorAction.state.energy, 0,
  "unknown mentor action IDs must not fall through to mental rest");
assert.equal(invalidMentorAction.state.morale, 50);
assert.equal(invalidMentorAction.state.dailyActionUsed, false);
assert.ok(invalidMentorAction.notices.some(message => message.includes("النشاط ده مش متاح")));

console.log("PASS: challenge energy, investment limits, and daily mentor eligibility are enforced.");
