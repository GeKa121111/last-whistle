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
  setInterval() { return 1; }
};
const context = { window, document, console };
vm.createContext(context);
vm.runInContext(source, context, { filename: "agent-system.js" });
assert.ok(window.LWAgentRuntime, "agent runtime must initialize");
for (const callback of documentListeners.DOMContentLoaded || []) callback();

function click(action, agentId) {
  const button = {
    disabled: false,
    getAttribute(name) {
      if (name === "data-lwag-action") return action;
      if (name === "data-agent-id") return agentId || "";
      if (name === "data-choice-index") return "0";
      return null;
    }
  };
  for (const callback of documentListeners.click || []) {
    callback({ target: { closest: () => button }, preventDefault() {} });
  }
}

// Signing creates an open-ended contract rather than a two-season deal.
click("agent-sign", "hossam");
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
const payrollLogs = [];
function payOneWeek() {
  const calendarContext = {
    state, window,
    clamp(value, min = 0, max = 100) { return Math.max(min, Math.min(max, Number(value) || 0)); },
    log(message) { payrollLogs.push(String(message)); },
    resetDailyActions() {}
  };
  vm.createContext(calendarContext);
  vm.runInContext(calendarSource, calendarContext, { filename: "advanceCalendarDays" });
  calendarContext.advanceCalendarDays(7, "اختبار صرف المرتب");
}
function resetCalendarForPayroll() {
  state.calendarDay = 1; state.day = 1; state.daysSinceTransfer = 0;
  state.daysSinceNegotiation = 0; state.transferCooldown = 0;
  state.agentDebtLastPayrollDay = 0;
}
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
click("agent-active", "hossam");
click("agent-end-current", "hossam");
const moneyBeforeRetiredTermination = state.money;
state.retired = true;
click("agent-confirm-end", "hossam");
assert.equal(state.agent, true, "a stale termination confirmation must not remove the representative after retirement");
assert.equal(state.agentProfile.id, "hossam", "a stale termination confirmation must preserve the active representative");
assert.equal(state.money, moneyBeforeRetiredTermination, "a stale termination confirmation must not charge an exit fee");
assert.equal(state.agentHistory.some(event => event.title === "إنهاء اتفاق الوكالة"), false,
  "a blocked post-retirement termination must not create a termination record");
click("agent-end-current", "hossam");
assert.equal(state.agent, true, "opening a termination dialog after retirement must be blocked");
assert.equal(state.money, moneyBeforeRetiredTermination, "blocked post-retirement actions must not change the balance");
state.retired = false;

// A stale switch dialog must not charge or remove the agent after the career becomes ineligible.
click("agent-meet", "nadine");
const moneyBeforeBlockedSwitch = state.money;
state.retired = true;
click("agent-switch-sign", "nadine");
assert.equal(state.agent, true, "a blocked stale switch must preserve the current representative");
assert.equal(state.agentProfile.id, "hossam", "a blocked stale switch must not replace the current agent");
assert.equal(state.money, moneyBeforeBlockedSwitch, "a blocked stale switch must not charge the exit fee");
state.retired = false;

// The player can switch directly from the current representative to another one.
click("agent-switch-sign", "nadine");
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
click("agent-active", "nadine");
click("agent-end-current", "nadine");
click("agent-confirm-end", "nadine");
assert.equal(state.agent, false, "confirmed termination should remove the current representative");
assert.equal(state.agentProfile, null, "confirmed termination should clear the current profile");
assert.ok(state.money < moneyBeforeTermination, "the configured in-game exit fee should be charged on termination");
assert.equal(window.LWAgentRuntime.outstandingFeeDebt(state), 170,
  "ending the agreement must preserve the former agent's debt");
click("agent-sign", "karim");
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

console.log("PASS: agent debt migration, FIFO repayments, switch/termination persistence, payroll idempotency, and no salary for unsigned free agents.");
