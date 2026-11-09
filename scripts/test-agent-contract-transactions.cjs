"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "agent-system.js"), "utf8");
const deployed = fs.readFileSync(path.join(root, "public", "agent-system.js"), "utf8");
assert.equal(source, deployed, "root/public agent runtimes must stay identical");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
assert.equal(sw, fs.readFileSync(path.join(root, "public", "sw.js"), "utf8"));
require("./assert-static-cache-version.cjs")(sw, 557);

function extractFunction(name) {
  const marker = "function " + name + "(";
  const index = source.indexOf(marker);
  assert.ok(index >= 0, "missing function " + name);
  const start = source.slice(0, index).endsWith("async ") ? index - 6 : index;
  const brace = source.indexOf("{", index);
  let depth = 0, quote = null, escaped = false, line = false, block = false;
  for (let i = brace; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (line) { if (c === "\n") line = false; continue; }
    if (block) { if (c === "*" && n === "/") { block = false; i++; } continue; }
    if (quote) { if (escaped) { escaped = false; continue; } if (c === "\\") { escaped = true; continue; } if (c === quote) quote = null; continue; }
    if (c === "/" && n === "/") { line = true; i++; continue; }
    if (c === "/" && n === "*") { block = true; i++; continue; }
    if (c === "'" || c === '"' || c.charCodeAt(0) === 96) { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error("unterminated function " + name);
}

const names = [
  "acquireSharedMutationLock", "releaseSharedMutationLock",
  "safeAgentText", "safeAgentId", "safeAgentField", "agentById", "finiteAgentNumber", "safeAgentNumber", "availableAgentBalance", "pendingAgentFeeQuote", "clonePostRetirementMutationState", "restorePostRetirementMutationState",
  "flushPostRetirementMutation", "runAgentContractMutation", "applyAgentSigning",
  "signAgent", "switchAgent", "confirmEnd", "finishStory"
];
const extracted = names.map(extractFunction).join("\n");
function makeHarness(overrides = {}, flushQueue = []) {
  const events = { saves: 0, flushes: 0, renders: 0, panels: 0, closes: 0, opens: 0, toasts: [], warnings: [] };
  const state = {
    careerStarted: true, retired: false, money: 5000, weeklyWage: 1000,
    apps: 12, season: 3, mediaReputation: 40, agent: true,
    agentProfile: { id: "old", agentName: "Old Agent", exitFeeWeeks: .25, relationship: 50, perks: {}, storyStage: 0 },
    agentHistory: [], storyFlags: {}, energy: 80, fatigue: 10,
    ...overrides
  };
  const api = {
    getState: () => state,
    save() { events.saves++; return true; },
    render() { events.renders++; },
    toast(message) { events.toasts.push(String(message)); },
    setStory() {}
  };
  const window = {
    LWStoryRuntime: api,
    console: { warn: (...args) => events.warnings.push(args) },
    flushQueuedSave(opts) {
      assert.equal(opts && opts.backupFirst, true, "agent contract saves must use backup-first flushes");
      events.flushes++;
      const next = flushQueue.length ? flushQueue.shift() : true;
      return typeof next === "function" ? next() : Promise.resolve(next);
    }
  };
  const sandbox = {
    window, console: window.console, API: () => api,
    postRetirementMutationPending: false, agentContractMutationPending: false,
    renderPanel: () => { events.panels++; },
    BY_ID: { old: { id: "old", feeRate: .06 }, new: { id: "new", feeRate: .06 } },
    LEGACY_AGENT: { name: "Legacy Agent", exitFeeWeeks: .25 },
    agentConfig: s => ({ name: s.agentProfile && (s.agentProfile.agentName || s.agentProfile.id) || "Old Agent", exitFeeWeeks: .25, chapters: [{}] }),
    candidate: id => ({ id, name: id === "new" ? "New Agent" : id, feeRate: .06, counterDifficulty: 1, pitch: "pitch", style: "direct", voice: "voice" }),
    canUseAgent: s => !!s && !!s.careerStarted && !s.retired,
    record: (s, title, description) => { s.agentHistory = Array.isArray(s.agentHistory) ? s.agentHistory : []; s.agentHistory.push({ title, description }); },
    makeProfile: id => ({ id, agentName: id === "new" ? "New Agent" : id, customFeeRate: .06, feeRate: .06, relationship: 0, perks: {} }),
    closeDialog: () => { events.closes++; },
    openActive: () => { events.opens++; },
    quotedFeeRate: .06,
    currentChapter: () => ({ title: "اختبار القصة", options: [{ effects: { money: 500, energy: -5 }, strategy: "balanced", relationship: 3, outcome: "تم الاختيار" }] }),
    boundedStat: (s, key, amount) => { s[key] = (Number(s[key]) || 0) + Number(amount || 0); },
    addTrust: (s, amount) => { s.agentProfile.relationship = (Number(s.agentProfile.relationship) || 0) + Number(amount || 0); },
    cap: (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0)),
    rel: s => Number(s.agentProfile && s.agentProfile.relationship) || 0
  };
  vm.createContext(sandbox);
  vm.runInContext("var postRetirementMutationPending=false; var agentContractMutationPending=false;\n" + extracted +
    "\nglobalThis.runtime={signAgent,switchAgent,confirmEnd,finishStory};", sandbox, { filename: "agent-contract-transactions" });
  return { runtime: sandbox.runtime, state, events };
}

(async () => {
  const switched = makeHarness();
  const switchResult = await switched.runtime.switchAgent("new");
  assert.equal(switchResult.ok, true);
  assert.equal(switched.state.money, 4750, "the exit fee must be charged once");
  assert.equal(switched.state.agent, true);
  assert.equal(switched.state.agentProfile.id, "new", "new agent must be activated atomically");
  assert.ok(switched.state.agentHistory.some(row => row.title === "تغيير الوكيل"));
  assert.ok(switched.state.agentHistory.some(row => row.title.includes("توقيع اتفاق تمثيل")));
  assert.equal(switched.events.saves, 1, "switch must persist as one transaction");
  assert.equal(switched.events.flushes, 1);

  const switchRollback = makeHarness({}, [false, true]);
  const priorSwitchState = JSON.stringify(switchRollback.state);
  const failedSwitch = await switchRollback.runtime.switchAgent("new");
  assert.equal(failedSwitch.ok, false);
  assert.equal(JSON.stringify(switchRollback.state), priorSwitchState, "failed switch must restore the old agent, fee, and history");
  assert.equal(failedSwitch.rollbackPersisted, true);
  assert.equal(switchRollback.events.saves, 2, "failed switch must persist its rollback snapshot");

  const ended = makeHarness();
  const endResult = await ended.runtime.confirmEnd();
  assert.equal(endResult.ok, true);
  assert.equal(ended.state.money, 4750);
  assert.equal(ended.state.agent, false);
  assert.equal(ended.state.agentProfile, null);
  assert.ok(ended.state.agentHistory.some(row => row.title === "إنهاء اتفاق الوكالة"));

  const endRollback = makeHarness({}, [false, true]);
  const priorEndState = JSON.stringify(endRollback.state);
  const failedEnd = await endRollback.runtime.confirmEnd();
  assert.equal(failedEnd.ok, false);
  assert.equal(JSON.stringify(endRollback.state), priorEndState, "failed termination must restore the active agreement and balance");

  const story = makeHarness();
  const storyResult = await story.runtime.finishStory(0);
  assert.equal(storyResult.ok, true);
  assert.equal(story.state.money, 5500, "story rewards must be persisted with the choice");
  assert.equal(story.state.energy, 75);
  assert.equal(story.state.agentProfile.storyStage, 1);
  assert.equal(story.events.opens, 1);

  const storyRollback = makeHarness({}, [false, true]);
  const priorStoryState = JSON.stringify(storyRollback.state);
  const failedStory = await storyRollback.runtime.finishStory(0);
  assert.equal(failedStory.ok, false);
  assert.equal(JSON.stringify(storyRollback.state), priorStoryState, "failed story save must roll back money, perks, and chapter progress");

  let release;
  const concurrent = makeHarness({}, [() => new Promise(resolve => { release = resolve; })]);
  const first = concurrent.runtime.switchAgent("new");
  await Promise.resolve();
  const second = await concurrent.runtime.confirmEnd();
  assert.equal(second.ok, false, "a second contract mutation must be rejected while the first save is pending");
  assert.equal(concurrent.events.saves, 1);
  release(true);
  assert.equal((await first).ok, true);


  for (const invalidBalance of [undefined, NaN, Infinity, -1, [5000], Symbol("invalid-balance")]) {
    const blockedEnd = makeHarness({ money: invalidBalance });
    const end = await blockedEnd.runtime.confirmEnd();
    assert.equal(end.ok, false, "missing, non-finite, or negative balances must not waive an exit fee");
    assert.equal(blockedEnd.state.agent, true);
    assert.equal(blockedEnd.state.agentProfile.id, "old");
    assert.equal(blockedEnd.state.money, invalidBalance);
    assert.equal(blockedEnd.events.saves, 0);

    const blockedSwitch = makeHarness({ money: invalidBalance });
    const switched = await blockedSwitch.runtime.switchAgent("new");
    assert.equal(switched.ok, false, "switching representatives must reject malformed balances");
    assert.equal(blockedSwitch.state.agentProfile.id, "old");
    assert.equal(blockedSwitch.state.money, invalidBalance);
    assert.equal(blockedSwitch.events.saves, 0);
  }

  const sameAgent = makeHarness();
  const same = await sameAgent.runtime.signAgent("old", .06, false);
  assert.equal(same.ok, false, "re-signing the current agent must not reset the agreement");
  assert.equal(sameAgent.events.saves, 0);
  console.log("PASS: agent signing, switching, termination, and story choices are durable, atomic, rollback-safe, and serialized.");
})().catch(error => { console.error(error); process.exitCode = 1; });
