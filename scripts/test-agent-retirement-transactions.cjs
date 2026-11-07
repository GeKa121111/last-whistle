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
assert.equal(sw, deployedSw, "root and public service workers must stay synchronized");
require("./assert-static-cache-version.cjs")(sw, 557);

function extractFunction(name) {
  const marker = "function " + name + "(";
  const functionStart = source.indexOf(marker);
  assert.ok(functionStart >= 0, "missing agent function: " + name);
  const start = source.slice(0, functionStart).endsWith("async ") ? functionStart - 6 : functionStart;
  const brace = source.indexOf("{", start);
  let depth = 0, quote = null, escaped = false, lineComment = false, blockComment = false;
  for (let i = brace; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (lineComment) { if (c === "\n") lineComment = false; continue; }
    if (blockComment) { if (c === "*" && n === "/") { blockComment = false; i++; } continue; }
    if (quote) { if (escaped) { escaped = false; continue; } if (c === "\\") { escaped = true; continue; } if (c === quote) quote = null; continue; }
    if (c === "/" && n === "/") { lineComment = true; i++; continue; }
    if (c === "/" && n === "*") { blockComment = true; i++; continue; }
    if (c === "'" || c === '"' || c.charCodeAt(0) === 96) { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error("unterminated function: " + name);
}

const names = [
  "acquireSharedMutationLock",
  "releaseSharedMutationLock",
  "safeAgentText",
  "safeAgentId",
  "agentById",
  "finiteAgentNumber",
  "safeAgentNumber",
  "safeWholeAmount",
  "postRetirementOptions",
  "clonePostRetirementMutationState",
  "restorePostRetirementMutationState",
  "flushPostRetirementMutation",
  "runPostRetirementMutation",
  "startPostRetirementAgency",
  "acquireClubControl",
  "registerAgencyPlayer"
];
const extracted = names.map(extractFunction).join("\n");
assert.doesNotMatch(
  ["startPostRetirementAgency", "acquireClubControl", "registerAgencyPlayer"].map(extractFunction).join("\n"),
  /api\.save\(\)/,
  "post-retirement operations must not report success after merely queueing a save"
);
assert.match(extractFunction("runPostRetirementMutation"), /flushPostRetirementMutation/);

function makeHarness(stateOverrides = {}, options = {}) {
  const flushResults = (options.flushQueue || []).slice();
  const saveResults = (options.saveQueue || []).slice();
  const events = { saves: 0, flushes: 0, renders: 0, toasts: [], warnings: [] };
  const state = {
    retired: true, money: 6000000, mediaReputation: 70, season: 5,
    ...stateOverrides
  };
  const api = {
    save() {
      events.saves++;
      return saveResults.length ? saveResults.shift() : true;
    },
    render() { events.renders++; },
    toast(message) { events.toasts.push(String(message)); }
  };
  const window = {
    LWStoryRuntime: api,
    console: { warn: (...args) => events.warnings.push(args) }
  };
  if (!options.noFlush) {
    window.flushQueuedSave = opts => {
      assert.equal(opts && opts.backupFirst, true, "post-retirement persistence must use the backup-first flush");
      events.flushes++;
      const next = flushResults.length ? flushResults.shift() : true;
      return typeof next === "function" ? next() : Promise.resolve(next);
    };
  }
  if (options.stateStoreFallback) {
    window.LWStateStore = {
      flush: async value => {
        assert.equal(value, state);
        events.flushes++;
        const next = flushResults.length ? flushResults.shift() : true;
        return typeof next === "function" ? next() : next;
      }
    };
  }
  const sandbox = {
    window,
    API: () => window.LWStoryRuntime,
    console: window.console,
    postRetirementMutationPending: false
  };
  vm.createContext(sandbox);
  vm.runInContext("var postRetirementMutationPending=false; var agentContractMutationPending=false;\n" + extracted +
    "\nglobalThis.runtime={postRetirementOptions,startPostRetirementAgency,acquireClubControl,registerAgencyPlayer};",
    sandbox, { filename: "agent-post-retirement-transactions" });
  return { runtime: sandbox.runtime, state, events, flushResults };
}

(async () => {
  const agency = makeHarness({ money: 500000 });
  const startedAgency = await agency.runtime.startPostRetirementAgency(agency.state, 250000);
  assert.equal(startedAgency.ok, true, "agency creation must wait for durable persistence");
  assert.equal(agency.state.money, 250000, "agency capital must be charged exactly once");
  assert.equal(agency.state.retirementCareer.type, "agency");
  assert.equal(agency.events.saves, 1);
  assert.equal(agency.events.flushes, 1);

  const agencySnapshot = JSON.stringify(agency.state.retirementCareer);
  const agencyMoney = agency.state.money;
  const duplicatePath = await agency.runtime.startPostRetirementAgency(agency.state, 250000);
  assert.equal(duplicatePath.ok, false, "an existing post-retirement path must not be replaced");
  assert.equal(JSON.stringify(agency.state.retirementCareer), agencySnapshot);
  assert.equal(agency.state.money, agencyMoney);
  assert.equal(agency.events.saves, 1, "a rejected second path must not queue another save");

  const investor = makeHarness({ money: 6000000 });
  const acquired = await investor.runtime.acquireClubControl(investor.state, "Test FC", 5000000, 51);
  assert.equal(acquired.ok, true);
  assert.equal(investor.state.retirementCareer.type, "club-owner");
  assert.equal(investor.state.retirementCareer.club, "Test FC");
  assert.equal(investor.state.retirementCareer.investment, 2550000);
  assert.equal(investor.state.money, 3450000);

  for (const invalidBalance of [undefined, NaN, Infinity, -1, "not-a-number"]) {
    const invalid = makeHarness({ money: invalidBalance });
    const options = invalid.runtime.postRetirementOptions(invalid.state);
    assert.equal(options.agent.available, false, "malformed balances must not unlock agency capital");
    assert.equal(options.clubOwner.available, false, "malformed balances must not unlock club ownership");
    assert.ok(Number.isFinite(options.agent.networkScore), "agency score must remain finite for malformed money");
    assert.ok(Number.isFinite(options.clubOwner.academyBudget), "academy budget must remain finite for malformed money");
    const agencyResult = await invalid.runtime.startPostRetirementAgency(invalid.state, 250000);
    assert.equal(agencyResult.ok, false, "agency funding must reject missing, negative, or non-finite balances");
    assert.equal(invalid.state.money, invalidBalance, "rejected agency funding must preserve the original legacy balance");
    assert.equal(invalid.state.retirementCareer, undefined);
    assert.equal(invalid.events.saves, 0, "invalid agency funding must not start a save transaction");
    const clubResult = await invalid.runtime.acquireClubControl(invalid.state, "Test FC", 5000000, 51);
    assert.equal(clubResult.ok, false, "club acquisition must reject malformed balances");
    assert.equal(invalid.state.money, invalidBalance, "rejected club acquisition must preserve the original legacy balance");
    assert.equal(invalid.state.retirementCareer, undefined);
    assert.equal(invalid.events.saves, 0, "invalid club acquisition must not start a save transaction");
  }

  const invalidFame = makeHarness({ money: 500000, mediaReputation: Infinity });
  assert.ok(Number.isFinite(invalidFame.runtime.postRetirementOptions(invalidFame.state).agent.networkScore),
    "non-finite reputation must not leak into the agency network score");

  const unsafeCapital = makeHarness({ money: Number.MAX_SAFE_INTEGER });
  const unsafeCapitalResult = await unsafeCapital.runtime.startPostRetirementAgency(
    unsafeCapital.state, Number.MAX_SAFE_INTEGER + 1
  );
  assert.equal(unsafeCapitalResult.ok, false, "unsafe capital values must not be rounded into a spendable transaction");
  assert.equal(unsafeCapital.state.money, Number.MAX_SAFE_INTEGER);
  assert.equal(unsafeCapital.events.saves, 0);

  const unsafeClubValue = makeHarness({ money: Number.MAX_SAFE_INTEGER });
  const unsafeClubResult = await unsafeClubValue.runtime.acquireClubControl(
    unsafeClubValue.state, "Test FC", Number.MAX_SAFE_INTEGER + 1, 51
  );
  assert.equal(unsafeClubResult.ok, false, "unsafe club valuations must be rejected before purchase");
  assert.equal(unsafeClubValue.state.money, Number.MAX_SAFE_INTEGER);
  assert.equal(unsafeClubValue.events.saves, 0);

  for (const invalidValue of [0, -1, NaN, "not-a-value", null]) {
    const invalid = makeHarness({ money: 6000000 });
    const result = await invalid.runtime.acquireClubControl(invalid.state, "Test FC", invalidValue, 51);
    assert.equal(result.ok, false, "invalid or non-positive club valuations must be rejected");
    assert.equal(invalid.state.money, 6000000, "invalid club valuation must never create a one-unit purchase");
    assert.equal(invalid.state.retirementCareer, undefined);
    assert.equal(invalid.events.saves, 0);
  }

  const jsonCoercionTrap = JSON.parse('{"toString":"not-callable","valueOf":"not-callable"}');
  const malformedCapital = makeHarness({ money: 500000 });
  const malformedCapitalResult = await malformedCapital.runtime.startPostRetirementAgency(
    malformedCapital.state, jsonCoercionTrap
  );
  assert.equal(malformedCapitalResult.ok, false,
    "JSON-safe objects with non-callable numeric hooks must not become retirement capital");
  assert.equal(malformedCapital.state.money, 500000);
  assert.equal(malformedCapital.state.retirementCareer, undefined);
  assert.equal(malformedCapital.events.saves, 0);

  const malformedShare = makeHarness({ money: 6000000 });
  const malformedShareResult = await malformedShare.runtime.acquireClubControl(
    malformedShare.state, "Test FC", 1000000, jsonCoercionTrap
  );
  assert.equal(malformedShareResult.ok, false,
    "an uncoercible ownership percentage must be rejected instead of defaulting to a 51% purchase");
  assert.equal(malformedShare.state.money, 6000000);
  assert.equal(malformedShare.state.retirementCareer, undefined);
  assert.equal(malformedShare.events.saves, 0);

  const safeRetirementFallback = makeHarness({
    money: 500000, season: jsonCoercionTrap, mediaReputation: jsonCoercionTrap
  });
  const safeRetirementResult = await safeRetirementFallback.runtime.startPostRetirementAgency(
    safeRetirementFallback.state, 250000
  );
  assert.equal(safeRetirementResult.ok, true,
    "valid retirement capital should still work when optional legacy season/reputation fields are malformed");
  assert.equal(safeRetirementFallback.state.retirementCareer.season, 1);
  assert.equal(safeRetirementFallback.state.retirementCareer.reputation, 1,
    "malformed reputation safely defaults to zero while the valid capital contribution remains applied");

  const noOverwrite = makeHarness({
    money: 6000000,
    retirementCareer: { type: "agency", capital: 250000, players: [{ id: "existing" }], history: [] }
  });
  const priorCareer = JSON.stringify(noOverwrite.state.retirementCareer);
  const blockedAcquisition = await noOverwrite.runtime.acquireClubControl(noOverwrite.state, "Other FC", 1000000, 51);
  assert.equal(blockedAcquisition.ok, false);
  assert.equal(JSON.stringify(noOverwrite.state.retirementCareer), priorCareer);
  assert.equal(noOverwrite.state.money, 6000000);

  const signing = makeHarness({
    retirementCareer: { type: "agency", capital: 250000, players: [], reputation: 40, history: [] }
  });
  const registered = await signing.runtime.registerAgencyPlayer(signing.state, {
    id: "verified-player-1", name: "Test Player", club: "Test FC", appearances: 12
  });
  assert.equal(registered.ok, true);
  assert.equal(signing.state.retirementCareer.players.length, 1);
  assert.equal(signing.state.retirementCareer.reputation, 41);
  assert.equal(signing.state.retirementCareer.history[0].playerId, "verified-player-1");
  assert.equal(signing.events.flushes, 1);

  const malformedAppearanceState = makeHarness({
    retirementCareer: { type: "agency", capital: 250000, players: [], reputation: jsonCoercionTrap, history: [] },
    season: jsonCoercionTrap
  });
  const malformedAppearance = await malformedAppearanceState.runtime.registerAgencyPlayer(malformedAppearanceState.state, {
    id: "verified-player-numeric-fallback", name: "Legacy Player", appearances: jsonCoercionTrap
  });
  assert.equal(malformedAppearance.ok, true,
    "an otherwise valid player can still be registered when old numeric career fields are malformed");
  assert.equal(malformedAppearanceState.state.retirementCareer.players[0].appearancesAtSigning, 0);
  assert.equal(malformedAppearanceState.state.retirementCareer.players[0].joinedSeason, 1);
  assert.equal(malformedAppearanceState.state.retirementCareer.reputation, 1);
  assert.equal(malformedAppearanceState.state.retirementCareer.history[0].season, 1);

  const duplicatePlayer = await signing.runtime.registerAgencyPlayer(signing.state, {
    id: "verified-player-1", name: "Test Player"
  });
  assert.equal(duplicatePlayer.ok, false, "an existing agency client must not be registered twice");
  assert.equal(signing.state.retirementCareer.players.length, 1);
  assert.equal(signing.events.saves, 1);

  const notRetired = makeHarness({ retired: false, retirementCareer: { type: "agency", players: [] } });
  const blockedRegistration = await notRetired.runtime.registerAgencyPlayer(notRetired.state, { id: "player-2" });
  assert.equal(blockedRegistration.ok, false, "agency registration must remain unavailable outside a retired career");
  assert.equal(notRetired.state.retirementCareer.players.length, 0);
  assert.equal(notRetired.events.saves, 0);

  const failedStart = makeHarness({ money: 500000 }, { flushQueue: [false, true] });
  const failedStartResult = await failedStart.runtime.startPostRetirementAgency(failedStart.state, 250000);
  assert.equal(failedStartResult.ok, false);
  assert.equal(failedStart.state.money, 500000, "failed agency persistence must refund the capital");
  assert.equal(failedStart.state.retirementCareer, undefined, "failed agency persistence must remove the uncommitted path");
  assert.equal(failedStart.events.saves, 2, "the rollback snapshot must be saved after a failed mutation");
  assert.equal(failedStart.events.flushes, 2, "both the attempted mutation and rollback must be flushed");

  const failedRegistration = makeHarness({
    retirementCareer: { type: "agency", capital: 250000, players: [], reputation: 40, history: [] }
  }, { flushQueue: [false, true] });
  const failedRegistrationResult = await failedRegistration.runtime.registerAgencyPlayer(failedRegistration.state, { id: "player-3" });
  assert.equal(failedRegistrationResult.ok, false);
  assert.equal(failedRegistration.state.retirementCareer.players.length, 0);
  assert.equal(failedRegistration.state.retirementCareer.reputation, 40);
  assert.equal(failedRegistration.state.retirementCareer.history.length, 0);

  const failedRollback = makeHarness({ money: 500000 }, { flushQueue: [false, false] });
  const failedRollbackResult = await failedRollback.runtime.startPostRetirementAgency(failedRollback.state, 250000);
  assert.equal(failedRollbackResult.ok, false);
  assert.equal(failedRollback.state.money, 500000, "memory must be restored even if rollback persistence also fails");
  assert.equal(failedRollback.state.retirementCareer, undefined);
  assert.equal(failedRollbackResult.rollbackPersisted, false);
  assert.ok(failedRollback.events.toasts.some(message => message.includes("صدّر نسخة احتياطية")));

  const rejectedQueue = makeHarness({ money: 500000 }, { saveQueue: [false, true], flushQueue: [true] });
  const rejectedQueueResult = await rejectedQueue.runtime.startPostRetirementAgency(rejectedQueue.state, 250000);
  assert.equal(rejectedQueueResult.ok, false);
  assert.equal(rejectedQueue.state.money, 500000);
  assert.equal(rejectedQueue.events.flushes, 1, "a rejected initial queue must skip its flush but persist the rollback");

  const fallback = makeHarness({ money: 500000 }, { noFlush: true, stateStoreFallback: true, flushQueue: [true] });
  const fallbackResult = await fallback.runtime.startPostRetirementAgency(fallback.state, 250000);
  assert.equal(fallbackResult.ok, true, "the state-store flush is a supported durable fallback");
  assert.equal(fallback.events.flushes, 1);

  let releaseFlush;
  const pending = makeHarness({ money: 500000 }, {
    flushQueue: [() => new Promise(resolve => { releaseFlush = resolve; })]
  });
  const first = pending.runtime.startPostRetirementAgency(pending.state, 250000);
  const concurrent = await pending.runtime.registerAgencyPlayer(pending.state, { id: "player-4" });
  assert.equal(concurrent.ok, false, "concurrent post-retirement actions must be rejected while persistence is pending");
  assert.equal(pending.state.retirementCareer.players.length, 0);
  releaseFlush(true);
  assert.equal((await first).ok, true);
  assert.equal(pending.state.money, 250000);
  assert.equal(pending.events.saves, 1);

  console.log("PASS: post-retirement agency and club-control transactions are durable, rollback-safe, non-overwriting, and idempotent.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
