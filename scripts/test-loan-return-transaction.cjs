"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const publicHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
assert.equal(html, publicHtml, "root and public app shells must remain synchronized");

function extractByMarker(source, marker) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, "missing source marker: " + marker);
  const open = source.indexOf("{", start);
  let depth = 0, quote = null, escaped = false, lineComment = false, blockComment = false;
  for (let i = open; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (lineComment) { if (c === "\n") lineComment = false; continue; }
    if (blockComment) { if (c === "*" && n === "/") { blockComment = false; i++; } continue; }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === "\\") { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "/" && n === "/") { lineComment = true; i++; continue; }
    if (c === "/" && n === "*") { blockComment = true; i++; continue; }
    if (c === "'" || c === '"' || c === "`") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error("unterminated source marker: " + marker);
}
const transactionSource = [
  extractByMarker(html, "function cloneSeasonTransitionState("),
  extractByMarker(html, "function restoreSeasonTransitionState("),
  extractByMarker(html, "function withCareerStateTransaction("),
  extractByMarker(html, "function archiveCupForTransfer("),
  extractByMarker(html, "function returnFromLoan(")
].join("\n") + "\nglobalThis.runReturnFromLoan = returnFromLoan;";
const advanceSource = extractByMarker(html, "function advanceAfterContractDecision(");
const contractPreparationSource = extractByMarker(html, "function prepareContractDecisionAfterLoanReturn(");
const newSeasonSource = extractByMarker(html, "async function startNewSeasonInternalUnsafe(");
const loanGuard = "if(state.loan&&!returnFromLoan())return false;";
assert.ok(newSeasonSource.includes("return true;"), "a fully committed new season must report success");
assert.ok(newSeasonSource.includes("proceedSeasonTransition(false);return false;"), "a pending renewal modal must not be reported as a completed season");
assert.ok(newSeasonSource.includes(loanGuard),
  "a failed loan return must stop the new season from starting at the temporary host club");
assert.ok(advanceSource.includes(loanGuard),
  "contract decisions must stop on any failed loan-return transaction, even if rollback could not restore the loan marker");
assert.ok(html.includes("if(!prepareContractDecisionAfterLoanReturn(viewLeague))return;"),
  "both renewal choices must pass through the loan-return decision guard");
assert.equal(html.split("if(!prepareContractDecisionAfterLoanReturn(viewLeague))return;").length - 1, 2,
  "accept and decline actions must both use the same guarded loan-return flow");
assert.ok(!html.includes("if(state.loan)returnFromLoan();"),
  "contract offer actions must not ignore the loan-return result");
assert.ok(newSeasonSource.indexOf(loanGuard) < newSeasonSource.indexOf("daysUntilNextSummerWindow"),
  "the loan return must be confirmed before off-season calendar and season mutations");

function makeHarness(options = {}) {
  const state = {
    season: 4, day: 120, calendarDay: 120,
    clubName: "Host FC", leagueCountry: "Spain", leagueDivision: 1,
    leagueCompetition: "Host League", leagueSource: "host roster",
    clubPower: 65, clubTier: 2, clubIndex: 2,
    weeklyWage: options.stateWeeklyWage === undefined ? 900 : options.stateWeeklyWage,
    contractSeasons: options.stateContractSeasons === undefined ? 3 : options.stateContractSeasons, freeAgent: false,
    contractType: "professional", role: "بديل",
    transferCooldown: 0, pendingTransfer: { club: "Next FC" },
    transferHistory: [], leagueArchives: [],
    contractOffer: { club: "Parent FC", season: 4, wage: 900, seasons: 3 },
    loan: {
      parentClub: options.invalidParent ? "" : "Parent FC",
      parentCountry: options.invalidParent ? "" : "Egypt",
      parentDivision: options.parentDivision === undefined ? 2 : options.parentDivision,
      parentCompetition: options.parentCompetition === undefined ? "Parent League" : options.parentCompetition,
      parentSource: options.parentSource === undefined ? "verified parent roster" : options.parentSource,
      parentPower: options.parentPower === undefined ? 0 : options.parentPower,
      parentTier: options.parentTier === undefined ? 2 : options.parentTier,
      parentIndex: options.parentIndex === undefined ? 2 : options.parentIndex,
      parentWage: options.parentWage === undefined ? 450 : options.parentWage,
      parentContractSeasons: options.parentContractSeasons === undefined ? 2 : options.parentContractSeasons,
      parentFreeAgent: options.parentFreeAgent === undefined ? false : options.parentFreeAgent,
      parentContractType: options.parentContractType === undefined ? "professional" : options.parentContractType,
      parentRole: options.parentRole === undefined ? "أساسي" : options.parentRole
    }
  };
  const events = { archives: [], logs: [], toasts: [], renders: 0, persisted: [] };
  const sandbox = {
    state,
    console: { error: () => {}, warn: () => {} },
    archiveLeagueSegment(reason) {
      events.archives.push(reason);
      state.leagueArchives.push({ reason, club: state.clubName });
    },
    normalizeSavedBooleanFlag(value) {
      if (typeof value === "boolean") return value;
      if (typeof value === "string") return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
      return false;
    },
    clubPowerFor() {
      if (options.failAfterArchive) throw new Error("synthetic parent-club lookup failure");
      return options.clubPowerLookup === undefined ? 55 : options.clubPowerLookup;
    },
    clubTierForPower(power) { return power >= 70 ? 3 : power >= 50 ? 2 : 0; },
    log(message) { events.logs.push(String(message)); },
    render() { events.renders++; },
    toast(message) { events.toasts.push(String(message)); },
    persistRollbackSnapshot(label) { events.persisted.push(String(label)); return true; }
  };
  vm.createContext(sandbox);
  new vm.Script(transactionSource + "\n", { filename: "loan-return-transaction.js" }).runInContext(sandbox);
  return { sandbox, state, events };
}

{
  const h = makeHarness();
  const originalState = h.state;
  assert.equal(h.sandbox.runReturnFromLoan(), true, "a valid loan return must commit");
  assert.equal(h.sandbox.state, originalState, "a successful return must preserve the live save object");
  assert.equal(h.state.clubName, "Parent FC");
  assert.equal(h.state.leagueCountry, "Egypt");
  assert.equal(h.state.leagueDivision, 2);
  assert.equal(h.state.clubPower, 55);
  assert.equal(h.state.weeklyWage, 450);
  assert.equal(h.state.contractSeasons, 2);
  assert.equal(h.state.contractType, "professional");
  assert.equal(h.state.freeAgent, false);
  assert.equal(h.state.role, "أساسي");
  assert.equal(h.state.loan, null);
  assert.equal(h.state.contractOffer.club, "Parent FC", "a valid parent renewal offer must survive a return to an active parent contract");
  assert.deepEqual(h.events.archives, ["loan-return"]);
  assert.equal(h.events.persisted.length, 0, "a successful return must not run rollback persistence");
}

{
  const h = makeHarness({
    parentDivision: "Infinity", parentPower: "Infinity", parentTier: ["3"], parentIndex: "NaN"
  });
  assert.equal(h.sandbox.runReturnFromLoan(), true,
    "a legacy loan with malformed numeric parent metadata must still recover safely");
  assert.equal(h.state.clubName, "Parent FC");
  assert.equal(h.state.leagueDivision, 1,
    "a non-finite parent division must fall back to a valid division");
  assert.equal(h.state.clubPower, 55,
    "a non-finite saved parent power must fall back to the verified club lookup");
  assert.equal(h.state.clubTier, 2,
    "an array-shaped parent tier must fall back to the tier derived from verified club power");
  assert.equal(h.state.clubIndex, 2,
    "a malformed parent index must fall back to the restored club tier");
  for (const key of ["leagueDivision", "clubPower", "clubTier", "clubIndex"]) {
    assert.equal(Number.isFinite(h.state[key]), true,
      "loan return must leave finite " + key + " after malformed parent metadata");
  }
}

{
  const h = makeHarness({
    parentDivision: "3", parentPower: "68", parentTier: "3", parentIndex: "4"
  });
  assert.equal(h.sandbox.runReturnFromLoan(), true);
  assert.equal(h.state.leagueDivision, 3, "valid numeric-string parent divisions must remain supported");
  assert.equal(h.state.clubPower, 68, "valid numeric-string parent power must remain supported");
  assert.equal(h.state.clubTier, 3, "valid numeric-string parent tiers must remain supported");
  assert.equal(h.state.clubIndex, 4, "valid numeric-string parent indices must remain supported");
}

{
  const h = makeHarness({ parentContractSeasons: "2", parentWage: "450" });
  assert.equal(h.sandbox.runReturnFromLoan(), true);
  assert.equal(h.state.contractSeasons, 2,
    "valid numeric-string parent contract terms must remain supported");
  assert.equal(h.state.weeklyWage, 450,
    "valid numeric-string parent wages must remain supported");
  assert.equal(h.state.freeAgent, false);
}

{
  const h = makeHarness({ parentContractSeasons: [2], parentWage: [450] });
  assert.equal(h.sandbox.runReturnFromLoan(), true);
  assert.equal(h.state.contractSeasons, 0,
    "array-shaped parent contract terms must not be coerced into a valid contract");
  assert.equal(h.state.weeklyWage, 0,
    "array-shaped parent wages must not be coerced into a numeric salary");
  assert.equal(h.state.freeAgent, true);
  assert.equal(h.state.contractType, "free-agent");
}

{
  const h = makeHarness({ parentContractSeasons: "2", parentWage: [450] });
  assert.equal(h.sandbox.runReturnFromLoan(), true);
  assert.equal(h.state.contractSeasons, 2,
    "a valid parent contract must remain active when only its saved wage is malformed");
  assert.equal(h.state.weeklyWage, 0,
    "an array-shaped parent wage must not be coerced while restoring an otherwise valid contract");
  assert.equal(h.state.freeAgent, false);
}

{
  const h = makeHarness({
    parentContractSeasons: null, stateContractSeasons: [3], parentWage: "450"
  });
  assert.equal(h.sandbox.runReturnFromLoan(), true);
  assert.equal(h.state.contractSeasons, 0,
    "an invalid fallback host term must not be mistaken for the missing parent contract term");
  assert.equal(h.state.weeklyWage, 0);
  assert.equal(h.state.freeAgent, true);
}

{
  const hostileText = JSON.parse('{"toString":1,"valueOf":1}');
  const h = makeHarness({
    parentContractType: hostileText,
    parentCompetition: hostileText,
    parentSource: hostileText,
    parentRole: hostileText
  });
  const originalLoan = h.state.loan;
  let returned;
  assert.doesNotThrow(() => { returned = h.sandbox.runReturnFromLoan(); },
    "loan return must not coerce malformed parent contract or display metadata");
  assert.equal(returned, true, "a valid parent identity must still be restored when optional text metadata is malformed");
  assert.equal(h.state.contractType, "professional",
    "malformed parent contract type must fall back to the valid saved contract type");
  assert.equal(h.state.freeAgent, false);
  assert.equal(h.state.role, "بديل", "malformed parent role must fall back to the current safe role");
  assert.equal(h.state.leagueCompetition, "دوري محلي — محاكاة");
  assert.equal(h.state.leagueSource, "قائمة محلية قديمة");
  assert.equal(h.state.loan, null);
  assert.equal(originalLoan.parentContractType.toString, 1,
    "the malformed source contract metadata must remain untouched");
}

{
  const h = makeHarness({
    parentDivision: 2, parentPower: 48, parentTier: "0", parentIndex: "0"
  });
  assert.equal(h.sandbox.runReturnFromLoan(), true);
  assert.equal(h.state.leagueDivision, 2);
  assert.equal(h.state.clubPower, 48);
  assert.equal(h.state.clubTier, 0,
    "zero is a valid saved tier for second-division and academy-origin clubs");
  assert.equal(h.state.clubIndex, 0,
    "zero is a valid saved club index and must not be replaced by the tier fallback");
}

{
  const h = makeHarness({
    parentDivision: "2", parentPower: "Infinity", parentTier: ["0"], parentIndex: "NaN",
    clubPowerLookup: 48
  });
  assert.equal(h.sandbox.runReturnFromLoan(), true);
  assert.equal(h.state.leagueDivision, 2);
  assert.equal(h.state.clubPower, 48);
  assert.equal(h.state.clubTier, 0,
    "a verified club-power lookup may legitimately derive tier zero");
  assert.equal(h.state.clubIndex, 0,
    "an invalid saved index must fall back to a valid derived zero tier");
}

{
  const h = makeHarness({ invalidParent: true });
  assert.equal(h.sandbox.runReturnFromLoan(), true,
    "legacy loans without a verifiable parent must report a committed recovery, not a failed transaction");
  assert.equal(h.state.loan, null, "an invalid legacy loan must still be cleared");
  assert.equal(h.state.weeklyWage, 0, "a malformed parent must not preserve the temporary host wage");
  assert.equal(h.state.contractSeasons, 0);
  assert.equal(h.state.contractType, "free-agent");
  assert.equal(h.state.freeAgent, true);
  assert.deepEqual(h.events.archives, ["loan-return-invalid"]);
  assert.equal(h.state.contractOffer, null, "legacy recovery must clear any stale renewal offer");
  assert.equal(h.events.persisted.length, 0,
    "intentional legacy recovery must commit rather than be mistaken for a failed transaction");
}

{
  const h = makeHarness({ parentContractSeasons: 0, parentFreeAgent: true });
  assert.equal(h.sandbox.runReturnFromLoan(), true, "a valid parent record with an expired contract must still commit the return");
  assert.equal(h.state.clubName, "Parent FC", "the verified parent club should be restored even when its contract has expired");
  assert.equal(h.state.freeAgent, true, "an expired parent contract must return the player to free agency");
  assert.equal(h.state.contractOffer, null, "an expired parent contract must not retain an old renewal offer");
  assert.equal(h.state.loan, null);
}

{
  const h = makeHarness({ failAfterArchive: true });
  const before = JSON.stringify(h.state);
  const originalState = h.state;
  assert.equal(h.sandbox.runReturnFromLoan(), false,
    "a failure after the loan archive begins must reject the return");
  assert.equal(h.sandbox.state, originalState,
    "a failed return must restore the original live save object");
  assert.equal(JSON.stringify(h.state), before,
    "parent club, host club, contract, loan and archive history must roll back together");
  assert.equal(h.events.renders, 1, "the restored loan career must be rendered");
  assert.equal(h.events.persisted.length, 1,
    "the restored loan career must be queued for durable rollback persistence");
  assert.ok(h.events.logs.some(message => message.includes("synthetic parent-club lookup failure")));
  assert.ok(h.events.toasts.some(message => message.includes("جاري تأكيد حفظ النسخة")));
}

function runAdvanceCase(returnResult, clearLoan, transitionResult = true) {
  const state = { loan: { parentClub: "Parent FC" } };
  let starts = 0, pages = 0;
  const sandbox = {
    state,
    returnFromLoan() { if (clearLoan) state.loan = null; return returnResult; },
    startNewSeason() { starts++; return transitionResult; },
    showPage() { pages++; }
  };
  vm.createContext(sandbox);
  new vm.Script(advanceSource + "\nglobalThis.advance = advanceAfterContractDecision;", {
    filename: "loan-return-season-gate.js"
  }).runInContext(sandbox);
  const result = sandbox.advance(true);
  return { result, starts, pages, loan: state.loan };
}
{
  const failed = runAdvanceCase(false, false);
  assert.equal(failed.result, false);
  assert.equal(failed.starts, 0, "a failed return must not start a new season");
  assert.equal(failed.pages, 0, "a failed return must not navigate away from the recovery state");
  assert.ok(failed.loan);
}
{
  const failedAfterLoanMarkerClear = runAdvanceCase(false, true);
  assert.equal(failedAfterLoanMarkerClear.result, false,
    "a failed return must stop season advancement even if the loan marker was cleared during an unsuccessful rollback");
  assert.equal(failedAfterLoanMarkerClear.starts, 0);
  assert.equal(failedAfterLoanMarkerClear.pages, 0);
}
{
  const legacyRecovery = runAdvanceCase(true, true);
  assert.equal(legacyRecovery.starts, 1,
    "a legacy recovery that clears the loan must still allow season progression");
  assert.equal(legacyRecovery.pages, 1);
}
{
  const success = runAdvanceCase(true, true);
  assert.equal(success.starts, 1);
  assert.equal(success.pages, 1);
}
{
  const failedStart = runAdvanceCase(true, true, false);
  assert.equal(failedStart.result, false, "a failed season transition must not be reported as a successful contract decision");
  assert.equal(failedStart.starts, 1);
  assert.equal(failedStart.pages, 0, "the league page must not be shown when the season did not commit");
}

function runDeferredAdvanceCase(transitionResult) {
  const state = { loan: null };
  let resolveTransition, pages = 0, starts = 0;
  const pending = new Promise(resolve => { resolveTransition = resolve; });
  const sandbox = {
    state,
    startNewSeason() { starts++; return pending; },
    showPage() { pages++; },
    console: { error() {} },
    toast() {}
  };
  vm.createContext(sandbox);
  new vm.Script(advanceSource + String.fromCharCode(10) + "globalThis.advance = advanceAfterContractDecision;", {
    filename: "deferred-contract-season-advance.js"
  }).runInContext(sandbox);
  const result = sandbox.advance(true);
  assert.equal(typeof result.then, "function", "async season transitions must return a completion promise");
  assert.equal(pages, 0, "navigation must wait until the season transition commits");
  resolveTransition(transitionResult);
  return result.then(value => ({ value, pages, starts }));
}
(async () => {
  const committed = await runDeferredAdvanceCase(true);
  assert.equal(committed.value, true);
  assert.equal(committed.starts, 1);
  assert.equal(committed.pages, 1, "the league page should open only after a successful transition");

  const rolledBack = await runDeferredAdvanceCase(false);
  assert.equal(rolledBack.value, false);
  assert.equal(rolledBack.starts, 1);
  assert.equal(rolledBack.pages, 0, "a rolled-back transition must keep the current page visible");
  console.log("PASS: contract-decision navigation waits for a committed season transition.");
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});

function makeContractPreparationHarness(options = {}) {
  const state = { loan: options.hasLoan === false ? null : { parentClub: "Parent FC" }, freeAgent: false };
  const events = { returns: 0, advances: [], toasts: [] };
  const sandbox = {
    state,
    returnFromLoan() {
      events.returns++;
      if (options.clearLoan) state.loan = null;
      if (options.freeAgentAfterReturn !== undefined) state.freeAgent = options.freeAgentAfterReturn;
      return options.returnResult !== false;
    },
    advanceAfterContractDecision(viewLeague) { events.advances.push(viewLeague); return true; },
    toast(message) { events.toasts.push(String(message)); }
  };
  vm.createContext(sandbox);
  new vm.Script(contractPreparationSource + "\nglobalThis.prepareContractDecision = prepareContractDecisionAfterLoanReturn;", {
    filename: "loan-contract-decision-guard.js"
  }).runInContext(sandbox);
  return { result: sandbox.prepareContractDecision(true), state, events };
}
{
  const noLoan = makeContractPreparationHarness({ hasLoan: false });
  assert.equal(noLoan.result, true, "a normal contract decision should not be blocked when there is no active loan");
  assert.equal(noLoan.events.returns, 0);
  assert.equal(noLoan.events.advances.length, 0);
}
{
  const validReturn = makeContractPreparationHarness({ clearLoan: true, freeAgentAfterReturn: false });
  assert.equal(validReturn.result, true, "a verified parent contract should continue to the renewal decision");
  assert.equal(validReturn.events.returns, 1);
  assert.equal(validReturn.events.advances.length, 0);
}
{
  const expiredParent = makeContractPreparationHarness({ clearLoan: true, freeAgentAfterReturn: true });
  assert.equal(expiredParent.result, false, "an expired parent contract must bypass the stale renewal decision");
  assert.deepEqual(expiredParent.events.advances, [true], "the season should continue after committed free-agent recovery");
  assert.equal(expiredParent.events.toasts.length, 1, "the player must be told why the old renewal offer was ignored");
}
{
  const failedReturn = makeContractPreparationHarness({ returnResult: false, clearLoan: false });
  assert.equal(failedReturn.result, false, "a failed loan-return transaction must stop the contract decision");
  assert.equal(failedReturn.events.advances.length, 0);
  assert.ok(failedReturn.state.loan);
}
{
  const failedRollback = makeContractPreparationHarness({ returnResult: false, clearLoan: true, freeAgentAfterReturn: true });
  assert.equal(failedRollback.result, false, "a failed rollback must stop even if the loan marker is no longer present");
  assert.equal(failedRollback.events.advances.length, 0);
}

const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const publicSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
assert.equal(sw, publicSw, "root and public service workers must remain synchronized");
require("./assert-static-cache-version.cjs")(sw, 417);
console.log("PASS: loan returns are atomic, malformed legacy loans recover safely, and failed returns cannot advance the season.");
