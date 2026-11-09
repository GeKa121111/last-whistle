"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const moduleSpecs = [
  { file: "career-experience.js", owner: "career-experience", transactions: ["runCareerMutation"] },
  { file: "agent-system.js", owner: "agent-system", transactions: ["runAgentContractMutation", "runPostRetirementMutation"] },
  { file: "story-mode.js", owner: "story-mode", transactions: ["runStoryMutation"] },
  { file: "social-media.js", owner: "social-media", transactions: ["runSocialMutation"] }
];
const sources = moduleSpecs.map(spec => {
  const source = fs.readFileSync(path.join(root, spec.file), "utf8");
  const deployed = fs.readFileSync(path.join(root, "public", spec.file), "utf8");
  assert.equal(source, deployed, spec.file + " root/public runtime must remain identical");
  return source;
});
function extractFunction(source, name) {
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
for (let i = 0; i < moduleSpecs.length; i++) {
  const spec = moduleSpecs[i], source = sources[i];
  assert.match(source, /window\.__LW_DURABLE_MUTATION_LOCK__/);
  for (const name of spec.transactions) {
    const fn = extractFunction(source, name);
    assert.ok(fn.includes('var mutationLock = acquireSharedMutationLock("' + spec.owner + '")'), spec.file + " " + name + " must acquire the shared lock");
    assert.ok(fn.includes('typeof mutationLock.then === "function"'), spec.file + " " + name + " must await queued lock grants");
    assert.ok(fn.includes('releaseSharedMutationLock("' + spec.owner + '")'), spec.file + " " + name + " must release the shared lock");
  }
}
const sharedWindow = { structuredClone, console: { warn() {} } };
const helperContexts = moduleSpecs.map((spec, index) => {
  const sandbox = { window: sharedWindow, Promise };
  vm.createContext(sandbox);
  const dependencies = spec.file === "agent-system.js"
    ? extractFunction(sources[index], "safeAgentText") + "\n"
    : "";
  vm.runInContext(dependencies + extractFunction(sources[index], "acquireSharedMutationLock") + "\n" +
    extractFunction(sources[index], "releaseSharedMutationLock"), sandbox);
  return { acquire: sandbox.acquireSharedMutationLock, release: sandbox.releaseSharedMutationLock };
});
(async function run() {
  await helperContexts[0].acquire("career-experience");
  let agentLockGranted = false;
  const queuedAgentLock = helperContexts[1].acquire("agent-system").then(() => { agentLockGranted = true; });
  await Promise.resolve();
  assert.equal(agentLockGranted, false, "a competing module should queue instead of entering concurrently");
  helperContexts[1].release("agent-system");
  assert.equal(sharedWindow.__LW_DURABLE_MUTATION_LOCK__.owner, "career-experience",
    "a different module must not release another module's lock");
  helperContexts[0].release("career-experience");
  await queuedAgentLock;
  assert.equal(agentLockGranted, true);
  assert.equal(sharedWindow.__LW_DURABLE_MUTATION_LOCK__.owner, "agent-system");
  helperContexts[1].release("agent-system");
  await helperContexts[2].acquire("story-mode");
  helperContexts[2].release("story-mode");
  await helperContexts[3].acquire("social-media");
  helperContexts[3].release("social-media");

  const api = { save() { return true; }, render() {}, toast() {} };
  const careerFunctions = [
    "acquireSharedMutationLock", "releaseSharedMutationLock",
    "cloneFinanceState", "restoreFinanceState", "flushFinanceState", "runCareerMutation"
  ].map(name => extractFunction(sources[0], name)).join("\n");
  const careerSandbox = { window: sharedWindow, API: () => api, Promise, console: sharedWindow.console, renderPanel() {} };
  vm.createContext(careerSandbox);
  vm.runInContext("var financeMutationPending = false;\n" + careerFunctions, careerSandbox);
  const agentFunctions = [
    "safeAgentText", "safeAgentField", "finiteAgentNumber", "safeAgentNumber", "safeWholeAmount", "acquireSharedMutationLock", "releaseSharedMutationLock",
    "inspectAgentArrayData", "safeAgentHistoryRows", "safeAgentLedgerSnapshotScalar", "cloneAgentDebtLedgerForSnapshot",
    "cloneAgentMaintenancePreview", "cloneAgentContractMutationSnapshot",
    "clonePostRetirementMutationState", "restorePostRetirementMutationState",
    "flushPostRetirementMutation", "runAgentContractMutation", "runPostRetirementMutation"
  ].map(name => extractFunction(sources[1], name)).join("\n");
  const agentSandbox = { window: sharedWindow, API: () => api, Promise, console: sharedWindow.console, renderPanel() {} };
  vm.createContext(agentSandbox);
  vm.runInContext("var agentContractMutationPending = false; var postRetirementMutationPending = false;\n" + agentFunctions, agentSandbox);

  const flushQueue = [];
  sharedWindow.flushQueuedSave = () => new Promise(resolve => flushQueue.push(resolve));
  async function waitForFlush() {
    await Promise.resolve();
    assert.equal(flushQueue.length, 1, "the active transaction should be waiting for its durable save");
  }
  function releaseFlush() {
    const resolve = flushQueue.shift();
    assert.equal(typeof resolve, "function");
    resolve(true);
  }
  const state = { money: 1000, agentProfile: { relationship: 50 }, agentHistory: [] };

  const careerWrite = careerSandbox.runCareerMutation(state, function () { state.money -= 100; return true; }, null, "finance");
  await waitForFlush();
  let agentStarted = false;
  const agentWrite = agentSandbox.runAgentContractMutation(state, function () {
    agentStarted = true;
    state.agentProfile.relationship = 99;
    return true;
  }, null);
  await Promise.resolve();
  assert.equal(agentStarted, false, "agent mutation must wait while the career save is pending");
  assert.equal(state.agentProfile.relationship, 50);
  releaseFlush();
  assert.equal((await careerWrite).ok, true);
  await waitForFlush();
  assert.equal(agentStarted, true, "queued agent mutation should run after the career transaction releases the lock");
  releaseFlush();
  assert.equal((await agentWrite).ok, true);

  const secondAgentWrite = agentSandbox.runAgentContractMutation(state, function () {
    state.agentProfile.relationship = 55;
    return true;
  }, null);
  await waitForFlush();
  const secondCareerWrite = careerSandbox.runCareerMutation(state, function () { state.money -= 100; return true; }, null, "finance");
  await Promise.resolve();
  assert.equal(state.money, 900, "career mutation must wait for the agent save");
  releaseFlush();
  assert.equal((await secondAgentWrite).ok, true);
  await waitForFlush();
  assert.equal(state.money, 800, "queued career mutation should run after the agent transaction");
  releaseFlush();
  assert.equal((await secondCareerWrite).ok, true);

  const retirementWrite = agentSandbox.runPostRetirementMutation(state, function () { state.money -= 100; return true; });
  await waitForFlush();
  const careerAfterRetirement = careerSandbox.runCareerMutation(state, function () { state.money -= 100; return true; }, null, "finance");
  await Promise.resolve();
  assert.equal(state.money, 700, "only the post-retirement debit may apply before its save is released");
  releaseFlush();
  assert.equal((await retirementWrite).ok, true);
  await waitForFlush();
  assert.equal(state.money, 600, "queued career mutation should run after post-retirement transaction");
  releaseFlush();
  assert.equal((await careerAfterRetirement).ok, true);
  assert.equal(state.money, 600);

  console.log("PASS: career, agent-contract, post-retirement, story, and social mutations share a queued, durable write lock.");
})().catch(error => { console.error(error && error.stack ? error.stack : error); process.exitCode = 1; });
