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

console.log("PASS: career experience challenges enforce energy and injury eligibility before and after play.");
