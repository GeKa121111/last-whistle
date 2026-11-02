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
  extractByMarker(html, "function returnFromLoan(")
].join("\n") + "\nglobalThis.runReturnFromLoan = returnFromLoan;";
const advanceSource = extractByMarker(html, "function advanceAfterContractDecision(");
const newSeasonSource = extractByMarker(html, "async function startNewSeasonInternalUnsafe(");
const loanGuard = "if(state.loan&&returnFromLoan()===false&&state.loan)return false;";
assert.ok(newSeasonSource.includes(loanGuard),
  "a failed loan return must stop the new season from starting at the temporary host club");
assert.ok(newSeasonSource.indexOf(loanGuard) < newSeasonSource.indexOf("daysUntilNextSummerWindow"),
  "the loan return must be confirmed before off-season calendar and season mutations");

function makeHarness(options = {}) {
  const state = {
    season: 4, day: 120, calendarDay: 120,
    clubName: "Host FC", leagueCountry: "Spain", leagueDivision: 1,
    leagueCompetition: "Host League", leagueSource: "host roster",
    clubPower: 65, clubTier: 2, clubIndex: 2,
    weeklyWage: 900, contractSeasons: 3, freeAgent: false,
    contractType: "professional", role: "بديل",
    transferCooldown: 0, pendingTransfer: { club: "Next FC" },
    transferHistory: [], leagueArchives: [],
    loan: {
      parentClub: options.invalidParent ? "" : "Parent FC",
      parentCountry: options.invalidParent ? "" : "Egypt",
      parentDivision: 2, parentCompetition: "Parent League",
      parentSource: "verified parent roster", parentPower: 0,
      parentTier: 2, parentIndex: 2, parentWage: 450,
      parentContractSeasons: 2, parentFreeAgent: false,
      parentContractType: "professional", parentRole: "أساسي"
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
      return 55;
    },
    clubTierForPower(power) { return power >= 70 ? 3 : power >= 50 ? 2 : 1; },
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
  assert.deepEqual(h.events.archives, ["loan-return"]);
  assert.equal(h.events.persisted.length, 0, "a successful return must not run rollback persistence");
}

{
  const h = makeHarness({ invalidParent: true });
  assert.equal(h.sandbox.runReturnFromLoan(), false,
    "legacy loans without a verifiable parent must retain the existing recovery return value");
  assert.equal(h.state.loan, null, "an invalid legacy loan must still be cleared");
  assert.equal(h.state.weeklyWage, 0, "a malformed parent must not preserve the temporary host wage");
  assert.equal(h.state.contractSeasons, 0);
  assert.equal(h.state.contractType, "free-agent");
  assert.equal(h.state.freeAgent, true);
  assert.deepEqual(h.events.archives, ["loan-return-invalid"]);
  assert.equal(h.events.persisted.length, 0,
    "intentional legacy recovery must commit rather than be mistaken for a failed transaction");
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

function runAdvanceCase(returnResult, clearLoan) {
  const state = { loan: { parentClub: "Parent FC" } };
  let starts = 0, pages = 0;
  const sandbox = {
    state,
    returnFromLoan() { if (clearLoan) state.loan = null; return returnResult; },
    startNewSeason() { starts++; },
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
  const legacyRecovery = runAdvanceCase(false, true);
  assert.equal(legacyRecovery.starts, 1,
    "a legacy recovery that clears the loan must still allow season progression");
  assert.equal(legacyRecovery.pages, 1);
}
{
  const success = runAdvanceCase(true, true);
  assert.equal(success.starts, 1);
  assert.equal(success.pages, 1);
}

const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const publicSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
assert.equal(sw, publicSw, "root and public service workers must remain synchronized");
require("./assert-static-cache-version.cjs")(sw, 414);
console.log("PASS: loan returns are atomic, malformed legacy loans recover safely, and failed returns cannot advance the season.");
