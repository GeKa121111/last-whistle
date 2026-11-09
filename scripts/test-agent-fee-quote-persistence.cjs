"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "agent-system.js"), "utf8");
assert.equal(source, fs.readFileSync(path.join(root, "public", "agent-system.js"), "utf8"));
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
assert.equal(sw, fs.readFileSync(path.join(root, "public", "sw.js"), "utf8"));
require("./assert-static-cache-version.cjs")(sw, 557);

function extract(name) {
  const marker = "function " + name + "(";
  const index = source.indexOf(marker);
  assert.ok(index >= 0, "missing " + name);
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
  throw new Error("unterminated " + name);
}
const names = [
  "acquireSharedMutationLock", "releaseSharedMutationLock",
  "safeAgentText", "safeAgentId", "safeAgentField", "isPlainAgentRecord", "isSafeAgentPerkKey", "normalizeAgentPerks", "normalizeAgentProfile", "agentById", "finiteAgentNumber", "safeAgentNumber", "availableAgentBalance", "pendingAgentFeeQuote", "ensureState", "clonePostRetirementMutationState",
  "restorePostRetirementMutationState", "flushPostRetirementMutation", "runAgentContractMutation",
  "openMeeting", "negotiateFee", "applyAgentSigning", "signAgent"
];
const extracted = names.map(extract).join("\n");

function makeHarness(stateOverrides = {}, options = {}) {
  const queue = (options.flushQueue || []).slice();
  const events = { saves: 0, flushes: 0, frames: [], toasts: [], history: [] };
  const state = {
    careerStarted: true, retired: false, agent: false, agentProfile: null,
    agentHistory: [], money: 10000, weeklyWage: 1000, professionalism: 80,
    overall: 80, season: 2, day: 9, calendarDay: 39, apps: 12, storyFlags: {},
    agentNegotiationQuote: null, ...stateOverrides
  };
  const candidates = {
    hossam: { id: "hossam", name: "Hossam", feeRate: .06, counterDifficulty: 1, pitch: "pitch", style: "steady", title: "local", mark: "H", voice: "voice", origin: "origin", strength: "strength", weakness: "weakness" },
    nadine: { id: "nadine", name: "Nadine", feeRate: .08, counterDifficulty: 1, pitch: "pitch", style: "direct", title: "pro", mark: "N", voice: "voice", origin: "origin", strength: "strength", weakness: "weakness" }
  };
  const api = {
    getState: () => state,
    save: () => { events.saves++; return true; },
    render() {},
    toast: message => events.toasts.push(String(message)),
    setStory() {},
    overall: () => 80
  };
  const window = {
    LWStoryRuntime: api,
    console: { warn() {} },
    flushQueuedSave(opts) {
      assert.equal(opts && opts.backupFirst, true);
      events.flushes++;
      const next = queue.length ? queue.shift() : true;
      return typeof next === "function" ? next() : Promise.resolve(next);
    }
  };
  const sandbox = {
    window, console: window.console, API: () => api,
    BY_ID: candidates, LEGACY_AGENT: { name: "Legacy", exitFeeWeeks: .25 },
    ensureProfileShape() {}, ensureFeeDebtLedger: () => false,
    canUseAgent: s => !!s && s.careerStarted && !s.retired,
    candidate: id => candidates[id] || null,
    agentConfig: s => s.agentProfile ? { name: s.agentProfile.agentName || s.agentProfile.id, exitFeeWeeks: .25 } : null,
    makeProfile: id => ({ id, agentName: candidates[id].name, relationship: 55, perks: {} }),
    record(s, title, description) { s.agentHistory.push({ title, description }); },
    cap: (v, min, max) => Math.max(min, Math.min(max, Number(v) || 0)),
    randomUnit: () => 0,
    frame(title, kicker, html) { events.frames.push({ title, kicker, html: String(html || "") }); },
    meetingBody: (_a, _s, fee) => "<p>fee:" + fee + "</p>",
    esc: value => String(value),
    openActive() {},
    closeDialog() {},
    renderPanel() {},
    postRetirementMutationPending: false,
    agentContractMutationPending: false,
    quotedFeeRate: null,
    selectedAgentId: ""
  };
  vm.createContext(sandbox);
  vm.runInContext("var postRetirementMutationPending=false; var agentContractMutationPending=false;\n" + extracted +
    "\nglobalThis.runtime={availableAgentBalance,pendingAgentFeeQuote,ensureState,openMeeting,negotiateFee,signAgent};", sandbox, { filename: "agent-fee-quote-persistence" });
  return { runtime: sandbox.runtime, state, events, sandbox };
}

(async () => {
  const negotiated = makeHarness();
  const result = await negotiated.runtime.negotiateFee("hossam");
  assert.equal(result.ok, true);
  assert.equal(negotiated.state.agentNegotiationQuote.agentId, "hossam");
  assert.equal(negotiated.state.agentNegotiationQuote.feeRate, .045);
  assert.equal(negotiated.events.flushes, 1, "a successful counter-offer must be durably saved");

  const reloaded = makeHarness(JSON.parse(JSON.stringify(negotiated.state)));
  assert.equal(reloaded.sandbox.quotedFeeRate, null, "a page reload must not rely on module memory");
  reloaded.runtime.ensureState(reloaded.state);
  assert.equal(reloaded.runtime.pendingAgentFeeQuote(reloaded.state, "hossam"), .045);
  reloaded.runtime.openMeeting("hossam");
  assert.equal(reloaded.sandbox.quotedFeeRate, .045, "reopening a meeting must restore the saved counter-offer");
  assert.ok(reloaded.events.frames.at(-1).html.includes("fee:0.045"));
  const signed = await reloaded.runtime.signAgent("hossam", null, false);
  assert.equal(signed.ok, true);
  assert.equal(reloaded.state.agentProfile.customFeeRate, .045, "signing after reload must honor the negotiated fee");
  assert.equal(reloaded.state.agentNegotiationQuote, null, "a signed quote must be consumed exactly once");

  const wrongAgent = makeHarness({ agentNegotiationQuote: { agentId: "hossam", feeRate: .045 } });
  const otherSign = await wrongAgent.runtime.signAgent("nadine", null, false);
  assert.equal(otherSign.ok, true);
  assert.equal(wrongAgent.state.agentProfile.customFeeRate, .08, "a quote for one agent must never discount another agent");
  assert.equal(wrongAgent.state.agentNegotiationQuote, null);

  const failedSign = makeHarness({ agentNegotiationQuote: { agentId: "hossam", feeRate: .045 } }, { flushQueue: [false, true] });
  const failed = await failedSign.runtime.signAgent("hossam", null, false);
  assert.equal(failed.ok, false);
  assert.equal(failedSign.state.agent, false);
  assert.equal(failedSign.state.agentNegotiationQuote.feeRate, .045, "failed signing must preserve the negotiated offer for retry");

  const invalidQuotes = [
    { agentId: "unknown", feeRate: .045 },
    { agentId: "hossam", feeRate: NaN },
    { agentId: "hossam", feeRate: .2 },
    { agentId: "hossam", feeRate: .01 }
  ];
  for (const quote of invalidQuotes) {
    const invalid = makeHarness({ agentNegotiationQuote: quote });
    invalid.runtime.ensureState(invalid.state);
    assert.equal(invalid.state.agentNegotiationQuote, null, "invalid legacy quotes must be safely cleared");
  }

  assert.equal(negotiated.runtime.availableAgentBalance({ money: undefined }), 0);
  assert.equal(negotiated.runtime.availableAgentBalance({ money: NaN }), 0);
  assert.equal(negotiated.runtime.availableAgentBalance({ money: Infinity }), 0);
  assert.equal(negotiated.runtime.availableAgentBalance({ money: -10 }), 0);
  console.log("PASS: negotiated agent fee offers survive reloads, apply only to the matching representative, and are consumed or rolled back safely.");
})().catch(error => { console.error(error); process.exitCode = 1; });
