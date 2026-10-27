#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
function extractFunction(name) {
  const start = html.indexOf("function " + name + "(");
  assert.ok(start >= 0, "Missing game function: " + name);
  const next = html.indexOf("\nfunction ", start + 1);
  return html.slice(start, next < 0 ? html.length : next);
}
const source = [
  "startPostCareerPath",
  "openPostCareerMenu",
  "performPostCareerAction"
].map(extractFunction).join("\n");

function makeSandbox(overrides = {}) {
  const notices = [], logs = [], stories = [], modals = [];
  const state = {
    retired: true, retirementRecord: { age: 40 }, season: 10,
    clubName: "Test FC", clubPower: 60, professionalism: 65,
    money: 50000, randomSeed: 1234,
    ...overrides
  };
  const sandbox = {
    state,
    club: () => ({ name: state.clubName || "Test FC" }),
    toast: message => notices.push(String(message)),
    clamp: (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0)),
    log: message => logs.push(String(message)),
    setStory: (title, body) => stories.push({ title: String(title), body: String(body) }),
    saveGame: () => true,
    render: () => {},
    openModal: (title, body, choices) => modals.push({ title: String(title), body: String(body), choices }),
    newCareer: () => { state.resetRequested = true; },
    showPage: page => { state.lastPage = page; },
    currencyLabel: () => "£",
    randomUnit: () => 0.01,
    console: { error: () => {} }
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "post-career-actions" });
  return { sandbox, state, notices, logs, stories, modals };
}

const agent = makeSandbox();
agent.sandbox.startPostCareerPath("agent");
assert.equal(agent.state.postCareer.path, "agent", "agent path must be persisted");
assert.equal(agent.modals.at(-1).title, "وكالة اللاعبين");
agent.sandbox.performPostCareerAction("scout");
assert.equal(agent.state.postCareer.clients, 1, "a successful scout action must add an agency client");
assert.ok(agent.state.money > 50000, "agency fees must be credited after a successful signing");
assert.ok(agent.state.postCareer.earnings > 0);
assert.match(agent.state.postCareer.lastAction, /أتعاب/);
agent.sandbox.performPostCareerAction("negotiate");
assert.ok(agent.state.postCareer.actions >= 2, "agency actions must be recorded");
assert.ok(agent.logs.some(row => row.includes("مرحلة ما بعد الاعتزال")));

const investor = makeSandbox();
investor.sandbox.startPostCareerPath("investor");
investor.sandbox.performPostCareerAction("buy-share");
assert.equal(investor.state.postCareer.shares, 1, "investor path must purchase a one-percent share");
assert.ok(investor.state.postCareer.investment > 0);
investor.sandbox.performPostCareerAction("operate-year");
assert.equal(investor.state.postCareer.yearsOperated, 1);
assert.equal(investor.state.postCareer.dividendsDue, 1, "operating a year must create one dividend due");
investor.sandbox.performPostCareerAction("dividend");
assert.equal(investor.state.postCareer.dividendsDue, 0, "a dividend can be collected only when it is due");
assert.ok(investor.state.postCareer.earnings > 0);
const moneyAfterDividend = investor.state.money;
investor.sandbox.performPostCareerAction("dividend");
assert.equal(investor.state.money, moneyAfterDividend, "dividends cannot be claimed repeatedly without another operated year");
assert.ok(investor.notices.length > 0);

const inactive = makeSandbox({ retired: false, retirementRecord: null });
inactive.sandbox.startPostCareerPath("agent");
assert.equal(inactive.state.postCareer, undefined, "post-career paths must not start before retirement");
assert.ok(inactive.notices.length > 0);

console.log("PASS: post-retirement agency and club-investor paths, recorded actions, and dividend guards.");
