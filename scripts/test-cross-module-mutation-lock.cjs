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
    assert.ok(fn.includes('acquireSharedMutationLock("' + spec.owner + '")'), spec.file + " " + name + " must acquire the shared lock");
    assert.ok(fn.includes('releaseSharedMutationLock("' + spec.owner + '")'), spec.file + " " + name + " must release the shared lock");
  }
}
const sharedWindow = { structuredClone, console: { warn() {} } };
const helperContexts = moduleSpecs.map((spec, index) => {
  const sandbox = { window: sharedWindow };
  vm.createContext(sandbox);
  vm.runInContext(extractFunction(sources[index], "acquireSharedMutationLock") + "\n" +
    extractFunction(sources[index], "releaseSharedMutationLock"), sandbox);
  return { acquire: sandbox.acquireSharedMutationLock, release: sandbox.releaseSharedMutationLock };
});
assert.equal(helperContexts[0].acquire("career-experience"), true);
assert.equal(helperContexts[1].acquire("agent-system"), false);
assert.equal(helperContexts[2].acquire("story-mode"), false);
assert.equal(helperContexts[3].acquire("social-media"), false);
helperContexts[1].release("agent-system");
assert.equal(sharedWindow.__LW_DURABLE_MUTATION_LOCK__.owner, "career-experience");
helperContexts[0].release("career-experience");
assert.equal(helperContexts[1].acquire("agent-system"), true);
helperContexts[1].release("agent-system");
assert.equal(helperContexts[2].acquire("story-mode"), true);
helperContexts[2].release("story-mode");
assert.equal(helperContexts[3].acquire("social-media"), true);
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
  "acquireSharedMutationLock", "releaseSharedMutationLock",
  "clonePostRetirementMutationState", "restorePostRetirementMutationState",
  "flushPostRetirementMutation", "runAgentContractMutation", "runPostRetirementMutation"
].map(name => extractFunction(sources[1], name)).join("\n");
const agentSandbox = { window: sharedWindow, API: () => api, Promise, console: sharedWindow.console, renderPanel() {} };
vm.createContext(agentSandbox);
vm.runInContext("var agentContractMutationPending = false; var postRetirementMutationPending = false;\n" + agentFunctions, agentSandbox);

(async function run() {
  const state = { money: 1000, agentProfile: { relationship: 50 }, agentHistory: [] };
  let releaseCareer;
  sharedWindow.flushQueuedSave = () => new Promise(resolve => { releaseCareer = resolve; });
  const careerWrite = careerSandbox.runCareerMutation(state, function () { state.money = 900; return true; }, null, "finance");
  assert.equal(typeof releaseCareer, "function");
  const blockedAgent = await agentSandbox.runAgentContractMutation(state, function () { state.agentProfile.relationship = 99; return true; }, null);
  assert.equal(blockedAgent.ok, false);
  assert.equal(state.agentProfile.relationship, 50);
  releaseCareer(true);
  assert.equal((await careerWrite).ok, true);

  let releaseAgent;
  sharedWindow.flushQueuedSave = () => new Promise(resolve => { releaseAgent = resolve; });
  const agentWrite = agentSandbox.runAgentContractMutation(state, function () { state.agentProfile.relationship = 55; return true; }, null);
  assert.equal(typeof releaseAgent, "function");
  const blockedCareer = await careerSandbox.runCareerMutation(state, function () { state.money = 0; return true; }, null, "finance");
  assert.equal(blockedCareer.ok, false);
  assert.equal(state.money, 900);
  releaseAgent(true);
  assert.equal((await agentWrite).ok, true);

  let releaseRetirement;
  sharedWindow.flushQueuedSave = () => new Promise(resolve => { releaseRetirement = resolve; });
  const retirementWrite = agentSandbox.runPostRetirementMutation(state, function () { state.money -= 100; return true; });
  assert.equal(typeof releaseRetirement, "function");
  const blockedCareerByRetirement = await careerSandbox.runCareerMutation(state, function () { state.money = 0; return true; }, null, "finance");
  assert.equal(blockedCareerByRetirement.ok, false);
  assert.equal(state.money, 800);
  releaseRetirement(true);
  assert.equal((await retirementWrite).ok, true);
  console.log("PASS: career, agent-contract, post-retirement, story, and social durable mutations share one serialized write lock.");
})().catch(error => { console.error(error && error.stack ? error.stack : error); process.exitCode = 1; });
