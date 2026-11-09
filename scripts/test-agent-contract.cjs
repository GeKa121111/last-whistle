"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "agent-system.js"), "utf8");
const deployed = fs.readFileSync(path.join(root, "public", "agent-system.js"), "utf8");
assert.equal(source, deployed, "root and deployed agent-system.js must stay synchronized");
assert.ok(!source.includes("اتفاق جديد لمدة موسمين"), "agent-switch copy must not promise automatic expiry");
assert.doesNotMatch(source, /function isExpired\(|function checkExpiry\(/,
  "agent representation must not contain an automatic season-expiry path");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const deployedSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
assert.equal(sw, deployedSw, "root and deployed service workers must stay synchronized");
require("./assert-static-cache-version.cjs")(sw, 682);
const cacheDeclaration = sw.split("\n").find(line => line.startsWith("const CACHE_NAME = "));
assert.ok(cacheDeclaration && cacheDeclaration.includes("last-whistle-static-v"),
  "the offline service worker must use a versioned cache name");

const documentListeners = Object.create(null);
const windowListeners = Object.create(null);
const elements = new Map();
const makeNode = id => ({
  id: id || "", hidden: false, innerHTML: "", textContent: "", className: "",
  setAttribute() {}, addEventListener() {}, focus() {},
  insertAdjacentElement(_where, node) { elements.set(node.id, node); },
  querySelector() { return makeNode("dialog-close"); },
  appendChild(node) { elements.set(node.id, node); }
});
const contractGrid = makeNode("contract-grid");
const document = {
  readyState: "loading",
  body: makeNode("body"),
  addEventListener(type, callback) {
    (documentListeners[type] ||= []).push(callback);
  },
  querySelector(selector) {
    return selector === "#page-contract .grid" ? contractGrid : null;
  },
  createElement(tag) { return makeNode(tag); },
  getElementById(id) {
    if (elements.has(id)) return elements.get(id);
    if (id === "lwa-agent-system") return null;
    if (elements.has("lwa-agent-system")) {
      const node = makeNode(id);
      elements.set(id, node);
      return node;
    }
    return null;
  }
};
const state = {
  careerStarted: true, retired: false, season: 1, day: 1, apps: 0,
  weeklyWage: 1000, money: 50000, agent: false, agentProfile: null,
  agentHistory: [], storyFlags: {}, energy: 80, fatigue: 10
};
const api = {
  getState: () => state,
  save: () => true,
  render: () => {},
  toast: () => {},
  log: () => {},
  setStory: () => {},
  overall: () => 60
};
const window = {
  LWStoryRuntime: api,
  addEventListener(type, callback) { windowListeners[type] = callback; },
  setInterval() { return 1; },
  flushQueuedSave(opts) { assert.equal(opts && opts.backupFirst, true); return Promise.resolve(true); }
};
const context = { window, document, console };
vm.createContext(context);
vm.runInContext(source, context, { filename: "agent-system.js" });
assert.ok(window.LWAgentRuntime, "agent runtime must initialize");
for (const callback of documentListeners.DOMContentLoaded || []) callback();

async function click(action, agentId) {
  const button = {
    disabled: false,
    getAttribute(name) {
      if (name === "data-lwag-action") return action;
      if (name === "data-agent-id") return agentId || "";
      if (name === "data-choice-index") return "0";
      return null;
    }
  };
  const pending = [];
  for (const callback of documentListeners.click || []) {
    const result = callback({ target: { closest: () => button }, preventDefault() {} });
    if (result && typeof result.then === "function") pending.push(result);
  }
  await Promise.all(pending);
}

(async function runAgentContractRegression(){
// Signing creates an open-ended contract rather than a two-season deal.
await click("agent-sign", "hossam");
assert.equal(state.agent, true, "signing must activate the agent");
assert.equal(state.agentProfile.id, "hossam", "the signed representative must be persisted");
assert.equal(state.agentProfile.contractMode, "open-ended");
assert.equal(state.agentProfile.expiresSeason, null, "new representation contracts must not have an automatic expiry");
// Weekly payroll must charge the active agent's configured commission, while a player
// without representation receives the full wage. Exercise the actual calendar function
// extracted from the shipped app shell rather than duplicating its payroll arithmetic.
assert.equal(typeof window.LWAgentRuntime.commissionRate, "function",
  "the agent runtime must expose its effective commission rate to payroll");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.equal(html, fs.readFileSync(path.join(root, "public", "index.html"), "utf8"),
  "root and public app shells must stay synchronized");
const calendarStart = html.indexOf("function advanceCalendarDays(");
const calendarEnd = html.indexOf("\nfunction ", calendarStart + 10);
assert.ok(calendarStart >= 0 && calendarEnd > calendarStart,
  "the shared calendar function must be available for payroll regression testing");
const calendarSource = html.slice(calendarStart, calendarEnd);
const counterStart = html.indexOf("function safeTransferCounter(");
const counterEnd = html.indexOf("\nfunction transferEligibilityReason(", counterStart + 10);
assert.ok(counterStart >= 0 && counterEnd > counterStart,
  "the shared safe transfer counter must be available to calendar payroll");
const safeTransferCounterSource = html.slice(counterStart, counterEnd);
const eligibilityStart = html.indexOf("function careerMatchPlayerEligible(");
const eligibilityEnd = html.indexOf("\nfunction simulateCareerMatch(", eligibilityStart + 10);
assert.ok(eligibilityStart >= 0 && eligibilityEnd > eligibilityStart,
  "the shared club-contract eligibility helper must be available for payroll regression testing");
const eligibilitySource = html.slice(eligibilityStart, eligibilityEnd);
const payrollLogs = [];
function payOneWeek(calendarState = state) {
  const calendarContext = {
    state: calendarState, window,
    clamp(value, min = 0, max = 100) { return Math.max(min, Math.min(max, Number(value) || 0)); },
    log(message) { payrollLogs.push(String(message)); },
    resetDailyActions() {}
  };
  vm.createContext(calendarContext);
  vm.runInContext(safeTransferCounterSource, calendarContext, { filename: "safeTransferCounter" });
  vm.runInContext(eligibilitySource, calendarContext, { filename: "careerMatchPlayerEligible" });
  vm.runInContext(calendarSource, calendarContext, { filename: "advanceCalendarDays" });
  calendarContext.advanceCalendarDays(7, "اختبار صرف المرتب");
}
function resetCalendarForPayroll() {
  state.calendarDay = 1; state.day = 1; state.daysSinceTransfer = 0;
  state.daysSinceNegotiation = 0; state.transferCooldown = 0;
  state.agentDebtLastPayrollDay = 0;
}
const hostileCooldownState = JSON.parse(JSON.stringify(state));
hostileCooldownState.calendarDay = 1;
hostileCooldownState.day = 1;
hostileCooldownState.daysSinceTransfer = 0;
hostileCooldownState.daysSinceNegotiation = 0;
hostileCooldownState.transferCooldown = JSON.parse('{"toString":1,"valueOf":1}');
hostileCooldownState.agentDebtLastPayrollDay = 0;
assert.doesNotThrow(() => payOneWeek(hostileCooldownState),
  "calendar progression must not coerce a malformed saved transfer cooldown");
assert.equal(hostileCooldownState.transferCooldown, 0,
  "a malformed cooldown must use a conservative seven-day fallback that expires after a week");
const signedAgent = state.agent;
const signedProfile = state.agentProfile;
state.agent = false;
state.agentProfile = null;
state.agentCommissionPaid = 0;
resetCalendarForPayroll();
const noAgentBalance = state.money;
payOneWeek();
assert.equal(state.money - noAgentBalance, 1000,
  "players without an agent must receive the full weekly wage");
assert.equal(Number(state.agentCommissionPaid) || 0, 0,
  "no commission should accrue without representation");
state.agent = signedAgent;
state.agentProfile = signedProfile;
resetCalendarForPayroll();
const activeCommissionRate = window.LWAgentRuntime.commissionRate(state);
assert.ok(activeCommissionRate >= 0.02 && activeCommissionRate <= 0.14,
  "the signed agent's effective fee must remain within the configured bounds");
const agentPayrollBalance = state.money;
payOneWeek();
const expectedAgentCommission = Math.round(1000 * activeCommissionRate);
assert.equal(state.money - agentPayrollBalance, 1000 - expectedAgentCommission,
  "weekly salary must be credited net of the active agent's commission");
assert.equal(state.agentCommissionPaid, expectedAgentCommission,
  "paid agent commission must be tracked in the career save");
assert.ok(payrollLogs.some(message => message.includes("عمولة الوكيل")),
  "the diary must explain the agent's weekly commission");

// Migrate a legacy profile debt, then add a new unpaid fee to the durable ledger.
state.money = 0;
state.agentProfile.feeDebt = 50;
delete state.agentFeeDebtLedger;
window.LWAgentRuntime.ensureState(state);
assert.equal(window.LWAgentRuntime.outstandingFeeDebt(state), 50,
  "legacy profile debt must migrate into the persistent ledger");
assert.equal(window.LWAgentRuntime.chargeFee(state, "اختبار ترحيل الدين", 19000), 0,
  "an unaffordable agent fee must not be paid from a negative balance");
assert.equal(window.LWAgentRuntime.outstandingFeeDebt(state), 1000,
  "legacy debt and the new unpaid fee must both remain outstanding");
assert.equal(state.agentProfile.feeDebt, 1000,
  "the active profile debt must mirror its ledger balance");
windowListeners.pageshow();
const debtBanner = document.getElementById("lwa-agent-debt");
assert.ok(debtBanner && !debtBanner.hidden, "the agent panel must show outstanding debt");
assert.ok(debtBanner.innerHTML.includes("1000"), "the debt banner must display the outstanding amount");
state.money = 50000;

// Simulate an old saved contract and advance far beyond its former expiry season.
delete state.agentProfile.contractMode;
state.agentProfile.expiresSeason = 3;
state.season = 20;
assert.equal(typeof windowListeners.pageshow, "function", "pageshow must re-check a restored career");
windowListeners.pageshow();
assert.equal(state.agent, true, "an agent must remain hired after multiple seasons until the player ends the agreement");
assert.equal(state.agentProfile.id, "hossam", "legacy saves must retain their contracted representative");
assert.equal(state.agentProfile.contractMode, "open-ended", "legacy contracts must be migrated");
assert.equal(state.agentProfile.expiresSeason, null, "legacy expiry dates must be cleared");
assert.equal(state.agentHistory.some(event => event.title === "انتهاء عقد الوكيل"), false,
  "season progression must not auto-terminate an open-ended contract");

// A termination dialog opened before retirement must not charge or end the agreement afterward.
await click("agent-active", "hossam");
await click("agent-end-current", "hossam");
const moneyBeforeRetiredTermination = state.money;
state.retired = true;
await click("agent-confirm-end", "hossam");
assert.equal(state.agent, true, "a stale termination confirmation must not remove the representative after retirement");
assert.equal(state.agentProfile.id, "hossam", "a stale termination confirmation must preserve the active representative");
assert.equal(state.money, moneyBeforeRetiredTermination, "a stale termination confirmation must not charge an exit fee");
assert.equal(state.agentHistory.some(event => event.title === "إنهاء اتفاق الوكالة"), false,
  "a blocked post-retirement termination must not create a termination record");
await click("agent-end-current", "hossam");
assert.equal(state.agent, true, "opening a termination dialog after retirement must be blocked");
assert.equal(state.money, moneyBeforeRetiredTermination, "blocked post-retirement actions must not change the balance");
state.retired = false;

// A stale switch dialog must not charge or remove the agent after the career becomes ineligible.
await click("agent-meet", "nadine");
const moneyBeforeBlockedSwitch = state.money;
state.retired = true;
await click("agent-switch-sign", "nadine");
assert.equal(state.agent, true, "a blocked stale switch must preserve the current representative");
assert.equal(state.agentProfile.id, "hossam", "a blocked stale switch must not replace the current agent");
assert.equal(state.money, moneyBeforeBlockedSwitch, "a blocked stale switch must not charge the exit fee");
state.retired = false;

// The player can switch directly from the current representative to another one.
await click("agent-switch-sign", "nadine");
assert.equal(state.agent, true, "switching agents should leave representation active");
assert.equal(state.agentProfile.id, "nadine", "switching must sign the newly selected agent");
assert.ok(state.agentHistory.some(event => event.title === "تغيير الوكيل"),
  "switching should write a history entry for the old and new agreement");
assert.equal(window.LWAgentRuntime.outstandingFeeDebt(state), 1000,
  "switching representatives must preserve the former agent's unpaid balance");
const nadineCommissionBefore = Number(state.agentCommissionPaid) || 0;
const balanceBeforeFirstDebtPay = state.money;
payOneWeek();
const nadineCommission = Math.round(1000 * window.LWAgentRuntime.commissionRate(state));
assert.equal(state.money - balanceBeforeFirstDebtPay, 0,
  "the first future wage should be fully applied to the debt when the debt exceeds net pay");
assert.equal(window.LWAgentRuntime.outstandingFeeDebt(state), 1000 - (1000 - nadineCommission),
  "partial repayment must leave the exact unpaid balance");
assert.equal(state.agentDebtPaid, 1000 - nadineCommission,
  "debt repayments must be tracked separately from agent commission");
const duplicateSettlement = window.LWAgentRuntime.collectDebtFromPayroll(state, 1000 - nadineCommission, state.calendarDay);
assert.equal(duplicateSettlement.paid, 0, "the same payroll day must never collect twice");
assert.equal(window.LWAgentRuntime.outstandingFeeDebt(state), 1000 - (1000 - nadineCommission),
  "a duplicate payroll callback must not reduce the debt again");
const balanceBeforeSecondDebtPay = state.money;
payOneWeek();
assert.equal(state.money - balanceBeforeSecondDebtPay, 1000 - nadineCommission - nadineCommission,
  "the next salary must settle the remainder and credit only the surplus");
assert.equal(window.LWAgentRuntime.outstandingFeeDebt(state), 0,
  "the old representative's debt must clear after sufficient future wages");
assert.equal(state.agentDebtPaid, 1000, "all debt repayments must remain auditable");
assert.equal(state.agentCommissionPaid - nadineCommissionBefore, nadineCommission * 2,
  "weekly commissions must remain separate from debt repayments");

// Create a second unpaid balance, then terminate the current representation agreement.
state.money = 0;
assert.equal(window.LWAgentRuntime.chargeFee(state, "اختبار دين بعد تغيير الوكيل", 2000), 0);
assert.equal(window.LWAgentRuntime.outstandingFeeDebt(state), 170,
  "the new unpaid fee must be attributed to the newly hired representative");
state.money = 50000;

// The player can also end the current agreement, then sign a different agent later.
const moneyBeforeTermination = state.money;
await click("agent-active", "nadine");
await click("agent-end-current", "nadine");
await click("agent-confirm-end", "nadine");
assert.equal(state.agent, false, "confirmed termination should remove the current representative");
assert.equal(state.agentProfile, null, "confirmed termination should clear the current profile");
assert.ok(state.money < moneyBeforeTermination, "the configured in-game exit fee should be charged on termination");
assert.equal(window.LWAgentRuntime.outstandingFeeDebt(state), 170,
  "ending the agreement must preserve the former agent's debt");
await click("agent-sign", "karim");
assert.equal(state.agent, true, "the player can sign another representative after termination");
assert.equal(state.agentProfile.id, "karim", "the new representative must become active");
assert.ok(state.agentHistory.some(event => event.title === "إنهاء اتفاق الوكالة"),
  "voluntary termination should be recorded in the agent history");
const balanceBeforeFormerAgentDebtPay = state.money;
payOneWeek();
const karimCommission = Math.round(1000 * window.LWAgentRuntime.commissionRate(state));
assert.equal(state.money - balanceBeforeFormerAgentDebtPay, 1000 - karimCommission - 170,
  "a debt from a terminated agent must be collected from a later club wage");
assert.equal(window.LWAgentRuntime.outstandingFeeDebt(state), 0,
  "the former agent's debt must clear after repayment");
assert.equal(state.agentDebtPaid, 1170, "repayments across representatives must remain auditable");
const duplicateAfterSettlement = window.LWAgentRuntime.collectDebtFromPayroll(state, 1000 - karimCommission, state.calendarDay);
assert.equal(duplicateAfterSettlement.paid, 0, "a repeated callback after settlement must remain idempotent");

// A legacy/free-agent save can retain an old wage value. It must not generate salary or agent commission.
const balanceBeforeUnsignedPayroll = state.money;
const commissionBeforeUnsignedPayroll = state.agentCommissionPaid;
const debtPaidBeforeUnsignedPayroll = state.agentDebtPaid;
state.freeAgent = true;
state.contractSeasons = 0;
state.contractType = "free-agent";
state.weeklyWage = 1000;
payOneWeek();
assert.equal(state.money, balanceBeforeUnsignedPayroll,
  "an unsigned player must not receive a stale weekly wage");
assert.equal(state.agentCommissionPaid, commissionBeforeUnsignedPayroll,
  "an unsigned player must not accrue a new weekly agent commission");
assert.equal(state.agentDebtPaid, debtPaidBeforeUnsignedPayroll,
  "no debt may be collected when no contracted wage is paid");

// Malformed legacy balances must never be treated as spendable funds.
 const malformedBalanceFeeRate = window.LWAgentRuntime.commissionRate(state);
 const expectedMalformedBalanceFee = Math.round(2000 * malformedBalanceFeeRate);
 function makeMalformedFeeState(money) {
   return {
     agent: true,
     agentProfile: { ...JSON.parse(JSON.stringify(state.agentProfile)), feeDebt: 0 },
     money,
     agentFeeDebtLedger: [],
     agentFeeDebtSequence: 0,
     agentDebtPaid: 0,
     agentDebtLastPayrollDay: 0,
     season: state.season,
     day: state.day,
     agentHistory: [],
     randomSeed: 1
   };
 }
 for (const malformedBalance of [undefined, NaN, Infinity, -100, [5000], true, {}, Symbol("invalid-balance")]) {
   const feeState = makeMalformedFeeState(malformedBalance);
   const paid = window.LWAgentRuntime.chargeFee(feeState, "اختبار رصيد مالي غير صالح", 2000);
   assert.equal(paid, 0, "invalid balances must not be treated as spendable money");
   assert.equal(feeState.money, 0, "invalid balances must be normalized before a fee is applied");
   assert.equal(window.LWAgentRuntime.outstandingFeeDebt(feeState), expectedMalformedBalanceFee,
     "an unpaid fee must remain recorded when the saved balance is invalid");
 }
 for (const invalidGross of [Infinity, [2000], true, {}, Symbol("invalid-fee-base")]) {
   const invalidGrossState = makeMalformedFeeState(500);
   const invalidGrossPaid = window.LWAgentRuntime.chargeFee(invalidGrossState, "اختبار قيمة عمولة غير صالحة", invalidGross);
   assert.equal(invalidGrossPaid, 0, "malformed fee bases must be rejected without charging the player");
   assert.equal(invalidGrossState.money, 500, "an invalid fee base must not consume a valid balance");
   assert.equal(window.LWAgentRuntime.outstandingFeeDebt(invalidGrossState), 0,
     "an invalid fee base must not create an uncollectable debt");
 }

 const numericStringBalanceState = makeMalformedFeeState("5000");
 const numericStringPaid = window.LWAgentRuntime.chargeFee(numericStringBalanceState, "اختبار توافق الرصيد النصي", "2000");
 assert.equal(numericStringPaid, expectedMalformedBalanceFee,
   "valid numeric-string balances and fee bases must remain compatible with legacy saves");
 assert.equal(numericStringBalanceState.money, 5000 - expectedMalformedBalanceFee,
   "numeric-string balances must be normalized to the correctly debited numeric balance");

 const malformedLedgerState = makeMalformedFeeState(5000);
 malformedLedgerState.agentProfile.feeDebt = Symbol("invalid-profile-debt");
 malformedLedgerState.agentFeeDebtLedger = [{
   id: "malformed-array-debt", agentId: String(malformedLedgerState.agentProfile.id),
   agentName: "Malformed legacy agent", reason: "Invalid legacy amount",
   amount: Symbol("invalid-ledger-amount"), paid: [200], outstanding: [500],
   createdSeason: [3], createdDay: [4]
 }];
 malformedLedgerState.agentFeeDebtSequence = [1];
 const malformedLedgerChanged = window.LWAgentRuntime.ensureState(malformedLedgerState);
 assert.equal(malformedLedgerChanged, true, "malformed legacy debt fields must be normalized and marked for persistence");
 assert.equal(window.LWAgentRuntime.outstandingFeeDebt(malformedLedgerState), 0,
   "coercible arrays and symbols must not create or preserve an invalid agent debt");
 assert.equal(malformedLedgerState.agentProfile.feeDebt, 0,
   "malformed profile debt must not be migrated into the financial ledger");
 assert.equal(malformedLedgerState.agentFeeDebtLedger[0].amount, 0);
 assert.equal(malformedLedgerState.agentFeeDebtLedger[0].paid, 0);
 assert.equal(malformedLedgerState.agentFeeDebtLedger[0].outstanding, 0);
 assert.equal(malformedLedgerState.agentFeeDebtLedger[0].createdSeason, 1);
 assert.equal(malformedLedgerState.agentFeeDebtLedger[0].createdDay, 1);
 assert.equal(malformedLedgerState.agentFeeDebtSequence, 0);

 const numericStringDebtState = makeMalformedFeeState(5000);
 numericStringDebtState.agentProfile.feeDebt = "375";
 numericStringDebtState.agentFeeDebtLedger = [{
   id: "legacy-string-debt", agentId: String(numericStringDebtState.agentProfile.id),
   agentName: "Legacy string agent", reason: "Legacy numeric strings",
   amount: "500", paid: "125", outstanding: "375", createdSeason: "3", createdDay: "4"
 }];
 window.LWAgentRuntime.ensureState(numericStringDebtState);
 assert.equal(window.LWAgentRuntime.outstandingFeeDebt(numericStringDebtState), 375,
   "valid numeric-string debt fields must retain their exact outstanding balance");
 assert.equal(numericStringDebtState.agentProfile.feeDebt, 375);
 assert.equal(numericStringDebtState.agentFeeDebtLedger[0].amount, 500);
 assert.equal(numericStringDebtState.agentFeeDebtLedger[0].paid, 125);
 assert.equal(numericStringDebtState.agentFeeDebtLedger[0].createdSeason, 3);


 const malformedProfileRateState = makeMalformedFeeState(5000);
 malformedProfileRateState.agentProfile.feeRate = [0.14];
 malformedProfileRateState.agentProfile.customFeeRate = [0.14];
 const defaultCommissionState = makeMalformedFeeState(5000);
 defaultCommissionState.agentProfile.customFeeRate = null;
 const expectedDefaultCommission = window.LWAgentRuntime.commissionRate(defaultCommissionState);
 assert.equal(window.LWAgentRuntime.commissionRate(malformedProfileRateState), expectedDefaultCommission,
   "array-shaped custom rates must not raise commission before save normalization");
 const malformedProfileRateChanged = window.LWAgentRuntime.ensureState(malformedProfileRateState);
 assert.equal(malformedProfileRateChanged, true, "malformed profile fee rates must be marked for persistence");
 assert.equal(malformedProfileRateState.agentProfile.feeRate, 0.06);
 assert.equal(malformedProfileRateState.agentProfile.customFeeRate, null);

 const malformedQuoteState = makeMalformedFeeState(5000);
 malformedQuoteState.agentNegotiationQuote = {
   agentId: String(malformedQuoteState.agentProfile.id), feeRate: [0.14], season: 2, calendarDay: 30
 };
 const malformedQuoteChanged = window.LWAgentRuntime.ensureState(malformedQuoteState);
 assert.equal(malformedQuoteChanged, true, "coercible saved quote rates must be discarded and persisted");
 assert.equal(malformedQuoteState.agentNegotiationQuote, null,
   "array-shaped saved negotiation rates must not become valid commission quotes");

 const numericStringRateState = makeMalformedFeeState(5000);
 numericStringRateState.agentProfile.feeRate = "0.08";
 numericStringRateState.agentProfile.customFeeRate = "0.09";
 numericStringRateState.agentNegotiationQuote = {
   agentId: String(numericStringRateState.agentProfile.id), feeRate: "0.05", season: "2", calendarDay: "30"
 };
 window.LWAgentRuntime.ensureState(numericStringRateState);
 assert.equal(numericStringRateState.agentProfile.feeRate, 0.08);
 assert.equal(numericStringRateState.agentProfile.customFeeRate, 0.09);
 assert.equal(numericStringRateState.agentNegotiationQuote.feeRate, 0.05,
   "valid numeric-string fee rates must remain compatible with legacy saves");
 assert.equal(window.LWAgentRuntime.commissionRate(numericStringRateState), 0.09);

 const coercionTrap = JSON.parse('{"toString":"not-callable","valueOf":"not-callable"}');

 const hostileLedgerState = makeMalformedFeeState(5000);
 hostileLedgerState.agentProfile.strategyOverride = coercionTrap;
 hostileLedgerState.agentProfile.perks = { malformedValue: coercionTrap };
 hostileLedgerState.agentFeeDebtLedger = [{
   id: coercionTrap, agentId: coercionTrap, agentName: coercionTrap, reason: coercionTrap,
   amount: "500", paid: "125", outstanding: "375", createdSeason: "3", createdDay: "4"
 }];
 hostileLedgerState.agentNegotiationQuote = {
   agentId: coercionTrap, feeRate: "0.08", season: "2", calendarDay: "30"
 };
 assert.doesNotThrow(() => window.LWAgentRuntime.ensureState(hostileLedgerState),
   "JSON-safe objects with non-callable toString fields must not crash agent state migration");
 assert.equal(hostileLedgerState.agentProfile.strategyOverride, "",
   "malformed strategy values must be replaced with a safe default");
 assert.equal(hostileLedgerState.agentNegotiationQuote, null,
   "an uncoercible saved quote agent id must be discarded safely");
 assert.equal(window.LWAgentRuntime.outstandingFeeDebt(hostileLedgerState), 375,
   "malformed ledger labels must not erase a valid numeric debt balance");
 assert.ok(/^agent-fee-debt-/.test(hostileLedgerState.agentFeeDebtLedger[0].id),
   "an uncoercible legacy ledger id must receive a safe generated id");
 assert.equal(hostileLedgerState.agentFeeDebtLedger[0].agentId, "legacy");
 assert.equal(hostileLedgerState.agentFeeDebtLedger[0].agentName, "وكيل سابق");
 assert.equal(hostileLedgerState.agentFeeDebtLedger[0].reason, "أتعاب وكالة غير مسددة");
 assert.equal(hostileLedgerState.agentFeeDebtLedger[0].amount, 500);
 assert.equal(hostileLedgerState.agentFeeDebtLedger[0].paid, 125);
 assert.equal(hostileLedgerState.agentFeeDebtLedger[0].outstanding, 375);

 const hostileProfileState = makeMalformedFeeState(5000);
 hostileProfileState.agentProfile.id = coercionTrap;
 hostileProfileState.agentProfile.strategyOverride = coercionTrap;
 hostileProfileState.agentProfile.feeDebt = 250;
 assert.doesNotThrow(() => window.LWAgentRuntime.ensureState(hostileProfileState),
   "an uncoercible legacy agent profile id must not prevent loading the career");
 assert.equal(hostileProfileState.agentProfile.id, "legacy",
   "an unknown saved agent id must migrate to the legacy representative");
 assert.equal(window.LWAgentRuntime.outstandingFeeDebt(hostileProfileState), 250,
   "the previous profile's outstanding debt must survive fallback to the legacy representative");
 assert.equal(hostileProfileState.agentProfile.feeDebt, 250,
   "the legacy profile must retain the migrated outstanding debt");

 const numericCoercionTrap = JSON.parse('{"toString":"not-callable","valueOf":"not-callable"}');
 const hostileNumericState = makeMalformedFeeState(5000);
 hostileNumericState.season = numericCoercionTrap;
 hostileNumericState.day = numericCoercionTrap;
 hostileNumericState.apps = numericCoercionTrap;
 Object.assign(hostileNumericState.agentProfile, {
   relationship: numericCoercionTrap,
   hiredSeason: numericCoercionTrap,
   signedApps: numericCoercionTrap,
   lastChapterApps: numericCoercionTrap,
   lastChapterSeason: numericCoercionTrap,
   lastPerformanceMilestone: numericCoercionTrap,
   storyStage: numericCoercionTrap,
   contractMultiplierDelta: numericCoercionTrap,
   negotiationRaiseBonusDelta: numericCoercionTrap
 });
 assert.doesNotThrow(() => window.LWAgentRuntime.ensureState(hostileNumericState),
   "JSON-safe objects with non-callable numeric coercion hooks must not crash agent migration");
 assert.equal(hostileNumericState.agentProfile.relationship, 0,
   "an invalid explicit saved relationship must fail closed");
 assert.equal(hostileNumericState.agentProfile.hiredSeason, 1,
   "an invalid saved signing season must use a safe legacy fallback");
 assert.equal(hostileNumericState.agentProfile.signedApps, 0);
 assert.equal(hostileNumericState.agentProfile.lastChapterApps, 0);
 assert.equal(hostileNumericState.agentProfile.lastChapterSeason, 1);
 assert.equal(hostileNumericState.agentProfile.lastPerformanceMilestone, 0);
 assert.equal(hostileNumericState.agentProfile.storyStage, 0);
 assert.doesNotThrow(() => window.LWAgentRuntime.chapterProgress(hostileNumericState),
   "story progress must remain readable when old numeric fields are malformed");
 assert.doesNotThrow(() => window.LWAgentRuntime.contractTerms(hostileNumericState),
   "agent contract bonuses must not coerce malformed saved deltas");
 assert.ok(Number.isFinite(window.LWAgentRuntime.contractTerms(hostileNumericState).contractMultiplier));

 const prototypeAgentState = makeMalformedFeeState(5000);
 prototypeAgentState.agentProfile.id = "__proto__";
 assert.doesNotThrow(() => window.LWAgentRuntime.ensureState(prototypeAgentState),
   "prototype keys must not be accepted as agent catalogue entries");
 assert.equal(prototypeAgentState.agentProfile.id, "legacy",
   "prototype-like unknown identifiers must safely fall back to the legacy agent");

 // Agent perks are JSON data records, not arbitrary object containers. Named properties
 // attached to arrays, Dates, Maps, Sets, or typed arrays must be migrated before export.
 function makePerkState(perks){
   const fixture=makeMalformedFeeState(5000);
   fixture.agentProfile.id="salim";
   fixture.agentProfile.feeDebt=0;
   fixture.agentFeeDebtLedger=[];
   fixture.agentProfile.perks=perks;
   return fixture;
 }
 const arrayPerks=[];
 arrayPerks.recovery=true;
 const arrayPerkState=makePerkState(arrayPerks);
 assert.equal(window.LWAgentRuntime.ensureState(arrayPerkState),true,
   "array-shaped perk containers must be normalized and marked for persistence");
 assert.equal(Array.isArray(arrayPerkState.agentProfile.perks),false);
 assert.deepEqual(JSON.parse(JSON.stringify(arrayPerkState.agentProfile.perks)),{recovery:true},
   "named legacy perks must survive a JSON backup after array-container migration");
 assert.equal(window.LWAgentRuntime.dailyRecoveryBonus(arrayPerkState),3);
 const reloadedPerkState=JSON.parse(JSON.stringify(arrayPerkState));
 window.LWAgentRuntime.ensureState(reloadedPerkState);
 assert.equal(window.LWAgentRuntime.dailyRecoveryBonus(reloadedPerkState),3,
   "agent perks must remain active after a save/export/reload round trip");
 const nonEnumerablePerks={};
 Object.defineProperty(nonEnumerablePerks,"recovery",{value:true,enumerable:false});
 const nonEnumerablePerkState=makePerkState(nonEnumerablePerks);
 assert.doesNotThrow(() => window.LWAgentRuntime.ensureState(nonEnumerablePerkState));
 assert.equal(Object.prototype.propertyIsEnumerable.call(nonEnumerablePerkState.agentProfile.perks,"recovery"),true,
   "non-enumerable legacy perks must become JSON-enumerable before persistence");
 assert.deepEqual(JSON.parse(JSON.stringify(nonEnumerablePerkState.agentProfile.perks)),{recovery:true});
 const accessorPerks={};
 Object.defineProperty(accessorPerks,"recovery",{enumerable:true,get(){throw new Error("hostile perk getter");}});
 const accessorPerkState=makePerkState(accessorPerks);
 assert.doesNotThrow(() => window.LWAgentRuntime.ensureState(accessorPerkState),
   "throwing perk getters must be ignored without interrupting agent migration");
 assert.equal(window.LWAgentRuntime.dailyRecoveryBonus(accessorPerkState),0);
 const prototypeKeyPerks=JSON.parse('{"__proto__":true,"constructor":true,"recovery":true}');
 const prototypeKeyPerkState=makePerkState(prototypeKeyPerks);
 window.LWAgentRuntime.ensureState(prototypeKeyPerkState);
 assert.deepEqual(JSON.parse(JSON.stringify(prototypeKeyPerkState.agentProfile.perks)),{recovery:true},
   "prototype-like perk keys must be discarded without losing supported boolean perks");
 assert.equal(Object.prototype.recovery,undefined,"normalizing perks must never mutate Object.prototype");
 const exoticPerkFactories=[
   () => Object.assign(new Date("2026-11-09T00:00:00.000Z"),{recovery:true}),
   () => Object.assign(new Map(),{recovery:true}),
   () => Object.assign(new Set(),{recovery:true}),
   () => Object.assign(new Uint8Array([1,2]),{recovery:true}),
   () => Object.assign(new (class LegacyPerks {})(),{recovery:true})
 ];
 exoticPerkFactories.forEach(function(makePerks){
   const fixture=makePerkState(makePerks());
   assert.doesNotThrow(() => window.LWAgentRuntime.ensureState(fixture),
     "exotic perk containers must be normalized without throwing");
   assert.equal(Array.isArray(fixture.agentProfile.perks),false);
   assert.deepEqual(JSON.parse(JSON.stringify(fixture.agentProfile.perks)),{recovery:true});
   assert.equal(window.LWAgentRuntime.dailyRecoveryBonus(fixture),3);
 });
 const throwingPerks=new Proxy({recovery:true},{ownKeys(){throw new Error("hostile perk ownKeys");}});
 const throwingPerkState=makePerkState(throwingPerks);
 assert.doesNotThrow(() => window.LWAgentRuntime.ensureState(throwingPerkState),
   "a hostile proxy used as a perk container must fail closed without breaking migration");
 assert.deepEqual(JSON.parse(JSON.stringify(throwingPerkState.agentProfile.perks)),{});
 assert.equal(window.LWAgentRuntime.dailyRecoveryBonus(throwingPerkState),0);
 // Runtime bonus reads must also be safe before ensureState migrates a legacy save.
 const directValidPerkState=makePerkState({recovery:true});
 assert.equal(window.LWAgentRuntime.dailyRecoveryBonus(directValidPerkState),3,
   "a valid saved recovery perk must work before state normalization");
 const directThrowingPerks=new Proxy({recovery:true},{
   get(target,key,receiver){
     if(key==="recovery")throw new Error("hostile direct perk read");
     return Reflect.get(target,key,receiver);
   }
 });
 const directThrowingPerkState=makePerkState(directThrowingPerks);
 assert.doesNotThrow(() => window.LWAgentRuntime.dailyRecoveryBonus(directThrowingPerkState),
   "a hostile perk getter must not crash a bonus read before migration");
 assert.equal(window.LWAgentRuntime.dailyRecoveryBonus(directThrowingPerkState),0);
 const directRevokedPerks=Proxy.revocable({recovery:true},{});
 directRevokedPerks.revoke();
 const directRevokedPerkState=makePerkState(directRevokedPerks.proxy);
 assert.doesNotThrow(() => window.LWAgentRuntime.dailyRecoveryBonus(directRevokedPerkState),
   "a revoked perks proxy must fail closed before state normalization");
 assert.equal(window.LWAgentRuntime.dailyRecoveryBonus(directRevokedPerkState),0);
 const directRevokedProfile=Proxy.revocable({perks:{recovery:true}},{});
 directRevokedProfile.revoke();
 const directRevokedProfileState=makePerkState({});
 directRevokedProfileState.agentProfile=directRevokedProfile.proxy;
 assert.doesNotThrow(() => window.LWAgentRuntime.dailyRecoveryBonus(directRevokedProfileState),
   "a revoked agent profile must not crash the recovery bonus read");
 assert.equal(window.LWAgentRuntime.dailyRecoveryBonus(directRevokedProfileState),0);
 const directThrowingAgentState=makePerkState({recovery:true});
 Object.defineProperty(directThrowingAgentState,"agent",{
   configurable:true,get(){throw new Error("hostile agent flag getter");}
 });
 assert.doesNotThrow(() => window.LWAgentRuntime.dailyRecoveryBonus(directThrowingAgentState),
   "a malformed agent flag must not crash the recovery bonus read");
 assert.equal(window.LWAgentRuntime.dailyRecoveryBonus(directThrowingAgentState),0);
 const exoticProfile=Object.assign(new Date("2026-11-09T00:00:00.000Z"),{
   id:"hossam",name:"حسام",feeRate:.05,customFeeRate:null,relationship:63,feeDebt:75,
   perks:Object.assign([],{recovery:true})
 });
 const exoticProfileState=makePerkState({});
 exoticProfileState.agentProfile=exoticProfile;
 assert.doesNotThrow(() => window.LWAgentRuntime.ensureState(exoticProfileState),
   "Date-shaped saved profiles must be converted to plain records before mutation or persistence");
 assert.equal(exoticProfileState.agentProfile instanceof Date,false);
 assert.equal(exoticProfileState.agentProfile.id,"hossam");
 assert.equal(exoticProfileState.agentProfile.relationship,63);
 assert.equal(exoticProfileState.agentProfile.feeDebt,75);
 assert.equal(window.LWAgentRuntime.outstandingFeeDebt(exoticProfileState,"hossam"),75,
   "legacy profile debt must survive exotic-profile normalization");
 assert.equal(window.LWAgentRuntime.dailyRecoveryBonus(exoticProfileState),3);
 assert.equal(JSON.parse(JSON.stringify(exoticProfileState.agentProfile)).feeDebt,75);
 const exoticHistoryState=makePerkState({});
 const dateHistoryRow=Object.assign(new Date("2026-11-09T00:00:00.000Z"),{
   season:2,day:9,title:"حدث محفوظ",text:"تفاصيل محفوظة"
 });
 const arrayHistoryRow=[];
 Object.assign(arrayHistoryRow,{season:"3",day:"4",title:"حدث قديم",description:"وصف قديم"});
 const nonEnumerableHistoryRow={};
 for(const [key,value] of Object.entries({season:4,day:7,title:"حدث غير قابل للتعداد",text:"لازم يفضل محفوظ"})){
   Object.defineProperty(nonEnumerableHistoryRow,key,{value,enumerable:false});
 }
 const throwingHistoryRow=new Proxy({season:5,day:8,text:"وصف متاح"},{
   get(target,key,receiver){if(key==="title")throw new Error("hostile history title getter");return Reflect.get(target,key,receiver);}
 });
 const revokedHistory=Proxy.revocable({title:"غير متاح",text:""},{});revokedHistory.revoke();
 exoticHistoryState.agentHistory=[dateHistoryRow,arrayHistoryRow,nonEnumerableHistoryRow,throwingHistoryRow,revokedHistory.proxy,null];
 assert.doesNotThrow(() => window.LWAgentRuntime.ensureState(exoticHistoryState),
   "exotic and hostile agent-history rows must be normalized without interrupting career loading");
 assert.equal(exoticHistoryState.agentHistory.length,4,
   "unreadable and empty history rows must be discarded while readable events remain");
 assert.deepEqual(JSON.parse(JSON.stringify(exoticHistoryState.agentHistory)),[
   {season:2,day:9,title:"حدث محفوظ",text:"تفاصيل محفوظة"},
   {season:3,day:4,title:"حدث قديم",text:"وصف قديم"},
   {season:4,day:7,title:"حدث غير قابل للتعداد",text:"لازم يفضل محفوظ"},
   {season:5,day:8,title:"حدث مع الوكيل",text:"وصف متاح"}
 ],"history from Date, array, non-enumerable, and getter-backed rows must survive JSON export");
 assert.equal(window.LWAgentRuntime.ensureState(exoticHistoryState),false,
   "normalized agent history must not trigger repeated migrations on later state checks");
 const hostileDebtRowState=makePerkState({});
 const hostileDebtRow=new Proxy({id:"hostile",agentId:"salim",amount:200,paid:50,outstanding:150,createdSeason:2,createdDay:3},{
   get(target,key,receiver){if(key==="amount")throw new Error("hostile debt getter");return Reflect.get(target,key,receiver);}
 });
 hostileDebtRowState.agentFeeDebtLedger=[hostileDebtRow];
 assert.doesNotThrow(() => window.LWAgentRuntime.ensureState(hostileDebtRowState),
   "a debt row with a throwing field getter must not break agent migration");
 assert.equal(window.LWAgentRuntime.outstandingFeeDebt(hostileDebtRowState,"salim"),150,
   "a valid outstanding field must preserve debt when another legacy field throws");
 // A legacy profile balance is migrated once and advances the durable debt sequence.
const legacyDebtSequenceState = makeMalformedFeeState(0);
legacyDebtSequenceState.agentProfile.feeDebt = 50;
legacyDebtSequenceState.agentFeeDebtSequence = 7;
window.LWAgentRuntime.ensureState(legacyDebtSequenceState);
assert.equal(legacyDebtSequenceState.agentFeeDebtSequence,8,
  "migrating a legacy profile balance must persist the next debt sequence");
assert.equal(window.LWAgentRuntime.outstandingFeeDebt(legacyDebtSequenceState),50);
const migratedLegacyDebtId = legacyDebtSequenceState.agentFeeDebtLedger[0].id;
assert.equal(window.LWAgentRuntime.chargeFee(legacyDebtSequenceState,"اختبار تسلسل المديونية",19000),0);
assert.equal(legacyDebtSequenceState.agentFeeDebtSequence,9,
  "the next unpaid fee must advance the sequence after legacy migration");
assert.notEqual(legacyDebtSequenceState.agentFeeDebtLedger[1].id,migratedLegacyDebtId,
  "legacy debt migration must not cause duplicate future ledger IDs");

// Recover a stale sequence counter from existing generated debt IDs before appending new rows.
const staleDebtSequenceState = makeMalformedFeeState(0);
staleDebtSequenceState.agentFeeDebtSequence = 2;
staleDebtSequenceState.agentFeeDebtLedger = [{
  id:"agent-fee-debt-1-1-8",agentId:"former-agent",agentName:"وكيل سابق",reason:"دين محفوظ",
  amount:100,paid:0,outstanding:100,createdSeason:1,createdDay:1
}];
window.LWAgentRuntime.ensureState(staleDebtSequenceState);
assert.equal(staleDebtSequenceState.agentFeeDebtSequence,8,
  "the persisted ledger ID suffix must repair a stale sequence counter");
assert.equal(window.LWAgentRuntime.chargeFee(staleDebtSequenceState,"اختبار استعادة التسلسل",19000),0);
assert.equal(staleDebtSequenceState.agentFeeDebtSequence,9);
assert.notEqual(staleDebtSequenceState.agentFeeDebtLedger[1].id,staleDebtSequenceState.agentFeeDebtLedger[0].id,
  "new debt IDs must not collide with a higher existing sequence suffix");

// Saved debt ledgers may override Array.prototype methods through own JSON keys.
const hostileDebtLedgerState = makeMalformedFeeState(0);
const hostileDebtLedger = [
  {id:"legacy-debt-first",agentId:"former-agent",agentName:"وكيل سابق",reason:"دين أقدم",amount:100,paid:0,outstanding:100,createdSeason:1,createdDay:1},
  {id:"legacy-debt-second",agentId:"another-agent",agentName:"وكيل آخر",reason:"دين أحدث",amount:200,paid:0,outstanding:200,createdSeason:1,createdDay:2}
];
hostileDebtLedger.forEach = "not-callable";
hostileDebtLedger.reduce = "not-callable";
hostileDebtLedgerState.agentFeeDebtLedger = hostileDebtLedger;
assert.equal(window.LWAgentRuntime.outstandingFeeDebt(hostileDebtLedgerState),300,
  "debt totals must ignore overridden forEach/reduce properties without losing valid rows");
const hostileDebtPayroll = window.LWAgentRuntime.collectDebtFromPayroll(hostileDebtLedgerState,150,88);
assert.equal(hostileDebtPayroll.paid,150,"payroll must collect from a ledger with overridden array methods");
assert.equal(hostileDebtPayroll.netPay,0,"debt collection must consume only the available wage");
assert.equal(hostileDebtPayroll.remaining,150,"partial FIFO repayment must retain the exact remaining balance");
assert.equal(hostileDebtLedgerState.agentFeeDebtLedger[0].outstanding,0,
  "the oldest debt row must be settled first");
assert.equal(hostileDebtLedgerState.agentFeeDebtLedger[1].outstanding,150,
  "the newer debt row must retain its unpaid remainder");
assert.equal(hostileDebtLedgerState.agentDebtPaid,150,
  "payroll debt repayments must remain auditable after hostile-array normalization");
assert.equal(Object.prototype.hasOwnProperty.call(hostileDebtLedgerState.agentFeeDebtLedger,"forEach"),false);
assert.equal(Object.prototype.hasOwnProperty.call(hostileDebtLedgerState.agentFeeDebtLedger,"reduce"),false);
assert.equal(JSON.parse(JSON.stringify(hostileDebtLedgerState.agentFeeDebtLedger)).length,2,
  "both valid debt rows must survive JSON export after normalization");
const duplicateHostileDebtPayroll = window.LWAgentRuntime.collectDebtFromPayroll(hostileDebtLedgerState,150,88);
assert.equal(duplicateHostileDebtPayroll.paid,0,"a duplicate payroll day must not collect hostile-ledger debt twice");
assert.equal(duplicateHostileDebtPayroll.duplicate,true);
assert.equal(window.LWAgentRuntime.outstandingFeeDebt(hostileDebtLedgerState),150);

const accessorDebtLedgerState = makeMalformedFeeState(0);
const accessorDebtLedger = [
  {id:"readable-debt",agentId:"legacy",amount:100,paid:0,outstanding:100,createdSeason:1,createdDay:1},
  {id:"unreadable-debt",agentId:"legacy",amount:900,paid:0,outstanding:900,createdSeason:1,createdDay:2}
];
Object.defineProperty(accessorDebtLedger,"1",{enumerable:true,configurable:true,get(){throw new Error("hostile debt row getter");}});
accessorDebtLedgerState.agentFeeDebtLedger = accessorDebtLedger;
assert.doesNotThrow(() => window.LWAgentRuntime.ensureState(accessorDebtLedgerState),
  "a getter-backed ledger row must not interrupt debt migration");
assert.equal(window.LWAgentRuntime.outstandingFeeDebt(accessorDebtLedgerState),100,
  "a readable debt row must survive when a separate row accessor throws");
assert.equal(accessorDebtLedgerState.agentFeeDebtLedger.length,1);

const revokedDebtLedgerState = makeMalformedFeeState(0);
const revokedDebtLedger = Proxy.revocable([], {});
revokedDebtLedger.revoke();
revokedDebtLedgerState.agentFeeDebtLedger = revokedDebtLedger.proxy;
assert.doesNotThrow(() => window.LWAgentRuntime.ensureState(revokedDebtLedgerState),
  "a revoked ledger proxy must fail closed without crashing career hydration");
assert.equal(Array.isArray(revokedDebtLedgerState.agentFeeDebtLedger),true,
  "an uninspectable ledger container must be replaced with a plain array");
assert.equal(revokedDebtLedgerState.agentFeeDebtLedger.length,0,
  "replacing an uninspectable ledger must not touch unrelated career records");
assert.equal(window.LWAgentRuntime.outstandingFeeDebt(revokedDebtLedgerState),0);

console.log("PASS: agent debt migration, FIFO repayments, strict fee/quote normalization, switch/termination persistence, payroll idempotency, malformed-fee guards, and no salary for unsigned free agents.");
})().catch(error => { console.error(error); process.exitCode = 1; });
