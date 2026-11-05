"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "career-experience.js"), "utf8");
const deployed = fs.readFileSync(path.join(root, "public", "career-experience.js"), "utf8");
assert.equal(source, deployed, "root/public career experience scripts must stay identical");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.equal(html, fs.readFileSync(path.join(root, "public", "index.html"), "utf8"));
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
assert.equal(sw, fs.readFileSync(path.join(root, "public", "sw.js"), "utf8"));
require("./assert-static-cache-version.cjs")(sw, 539);
require("./assert-static-cache-version.cjs").assertAssetVersionAtLeast(html, "career-experience.js", 9);

function makeHarness(overrides = {}, flushQueue = []) {
  const listeners = Object.create(null);
  const notices = [];
  let saveCalls = 0;
  let flushCalls = 0;
  let intervalCallback = null;
  const state = Object.assign({
    careerStarted: true, retired: false, injuryDays: 0, energy: 12,
    careerXP: 0, shooting: 50, composure: 50, money: 1000,
    day: 1, calendarDay: 1, season: 1, apps: 0, pos: "مهاجم"
  }, overrides);
  const overlay = {
    hidden: true, innerHTML: "",
    addEventListener() {},
    querySelector() { return { focus() {} }; }
  };
  const api = {
    getState: () => state,
    save() { saveCalls++; return true; },
    render() {},
    toast(message) { notices.push(String(message)); }
  };
  const document = {
    readyState: "loading", hidden: false,
    addEventListener(type, callback) { (listeners[type] ||= []).push(callback); },
    createElement() { return overlay; },
    body: { appendChild() {} },
    getElementById() { return null; }
  };
  const window = {
    LWStoryRuntime: api,
    console,
    flushQueuedSave(options) {
      assert.equal(options && options.backupFirst, true, "finance changes must flush a backup-first save");
      flushCalls++;
      const next = flushQueue.length ? flushQueue.shift() : true;
      return typeof next === "function" ? next() : Promise.resolve(next);
    },
    setInterval(callback) { intervalCallback = callback; return 1; },
    clearInterval() {},
    setTimeout() { return 1; },
    clearTimeout() {},
    addEventListener() {}
  };
  vm.runInNewContext(source, { window, document, Math, Number, String, JSON, Array, Promise, console }, {
    filename: "career-experience.js"
  });
  for (const callback of listeners.DOMContentLoaded || []) callback();
  async function click(action, attrs = {}) {
    const button = {
      disabled: false,
      getAttribute(name) {
        if (name === "data-lwcx-action") return action;
        return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
      }
    };
    const event = { target: { closest: () => button }, preventDefault() {} };
    return await Promise.resolve(listeners.click[0](event));
  }
  async function settleMicrotasks() {
    for (let i = 0; i < 7; i++) await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return {
    state, notices, overlay, click, settleMicrotasks,
    get saveCalls() { return saveCalls; },
    get flushCalls() { return flushCalls; },
    runInterval() { if (intervalCallback) intervalCallback(); }
  };
}
function dueState() {
  return {
    careerStarted: true, retired: false, injuryDays: 0, energy: 60,
    careerXP: 0, shooting: 50, money: 1000, day: 7, calendarDay: 7,
    season: 1, apps: 0,
    careerWorld: {
      version: 1, challengeCount: 0, challengeWins: 0, practiceAttempts: 0,
      memoryWins: 0, timingWins: 0, mentorSessions: 0, investments: [
        { id: 1, kind: "safe", label: "ادخار آمن", amount: 100, payout: 118, dueDay: 7, settled: false, successful: true }
      ], history: [], investmentSequence: 2
    }
  };
}

(async function runCareerExperienceFinanceRegressions() {
  const successful = makeHarness({ money: 1000 });
  const invested = await successful.click("invest-safe");
  assert.equal(invested.ok, true);
  assert.equal(successful.state.money, 900);
  assert.equal(successful.state.careerWorld.investments.length, 1);
  assert.equal(successful.state.careerWorld.investments[0].id, 1);
  assert.equal(successful.saveCalls, 1);
  assert.equal(successful.flushCalls, 1);

  const invalid = makeHarness({ money: Infinity });
  const invalidResult = await invalid.click("invest-safe");
  assert.equal(invalidResult.ok, false, "non-finite balances must not fund an investment");
  assert.equal(invalid.state.money, Infinity);
  assert.equal(invalid.state.careerWorld.investments.length, 0, "rejected investment must not create a partial portfolio");
  assert.equal(invalid.saveCalls, 0);

  const coercibleBalance = makeHarness({ money:[100] });
  const coercibleBalanceResult = await coercibleBalance.click("invest-safe");
  assert.equal(coercibleBalanceResult.ok, false,
    "an array that coerces to 100 must not be accepted as a cash balance");
  assert.deepEqual(coercibleBalance.state.money, [100]);
  assert.equal(coercibleBalance.state.careerWorld.investments.length, 0);
  assert.equal(coercibleBalance.saveCalls, 0,
    "a malformed balance must be rejected before any financial save is queued");

  const hostileBalance = makeHarness({
    money:{ valueOf() { throw new Error("unsafe-money-coercion"); } }
  });
  let hostileBalanceResult;
  await assert.doesNotReject(async () => {
    hostileBalanceResult = await hostileBalance.click("invest-safe");
  }, "a hostile saved balance must be rejected without crashing the finance panel");
  assert.equal(hostileBalanceResult.ok, false);
  assert.equal(hostileBalance.state.careerWorld.investments.length, 0);
  assert.equal(hostileBalance.saveCalls, 0);

  const numericStringBalance = makeHarness({ money:"100" });
  const numericStringBalanceResult = await numericStringBalance.click("invest-safe");
  assert.equal(numericStringBalanceResult.ok, true,
    "finite numeric-string balances must remain compatible with legacy saves");
  assert.equal(numericStringBalance.state.money, 0);

  const rollback = makeHarness({ money: 1000 }, [false, true]);
  const rollbackResult = await rollback.click("invest-risky");
  assert.equal(rollbackResult.ok, false);
  assert.equal(rollback.state.money, 1000, "failed investment persistence must refund the stake");
  assert.equal(rollback.state.careerWorld.investments.length, 0, "failed investment persistence must restore the portfolio");
  assert.equal(rollback.state.careerWorld.investmentSequence, 1);
  assert.equal(rollback.saveCalls, 2);
  assert.equal(rollback.flushCalls, 2);

  let releaseFirstFlush;
  const concurrent = makeHarness({ money: 1000 }, [
    () => new Promise(resolve => { releaseFirstFlush = resolve; })
  ]);
  const firstInvestment = concurrent.click("invest-safe");
  assert.equal(concurrent.state.money, 900);
  const secondInvestment = await concurrent.click("invest-risky");
  assert.equal(secondInvestment.ok, false, "a second financial click must be rejected during persistence");
  assert.equal(concurrent.state.money, 900);
  assert.equal(concurrent.state.careerWorld.investments.length, 1);
  assert.equal(concurrent.saveCalls, 1);
  releaseFirstFlush(true);
  assert.equal((await firstInvestment).ok, true);

  let releaseConcurrentRollback;
  const concurrentRollback = makeHarness({ money: 1000 }, [
    () => new Promise(resolve => { releaseConcurrentRollback = resolve; }), true
  ]);
  const pendingConcurrentInvestment = concurrentRollback.click("invest-safe");
  assert.equal(concurrentRollback.state.money, 900);
  concurrentRollback.state.apps = 1;
  concurrentRollback.state.goals = 1;
  concurrentRollback.state.age = 22;
  concurrentRollback.state.calendarDay = 15;
  concurrentRollback.state.careerWorld.challengeCount = 4;
  concurrentRollback.state.careerWorld.history.unshift({
    title: "تقرير مباراة أحدث", text: "تحديث أحدث أثناء حفظ الاستثمار", season: 1, day: 2
  });
  releaseConcurrentRollback(false);
  const concurrentRollbackResult = await pendingConcurrentInvestment;
  assert.equal(concurrentRollbackResult.ok, false);
  assert.equal(concurrentRollback.state.money, 1000, "a failed investment must reverse its own balance delta");
  assert.equal(concurrentRollback.state.careerWorld.investments.length, 0,
    "a failed investment must remove its own portfolio entry even when another history event arrives");
  assert.equal(concurrentRollback.state.careerWorld.investmentSequence, 1);
  assert.equal(concurrentRollback.state.careerWorld.challengeCount, 4,
    "finance rollback must preserve newer career-world counters outside the failed transaction");
  assert.equal(concurrentRollback.state.careerWorld.history.length, 1,
    "finance rollback must remove its own history row without deleting a newer match report");
  assert.equal(concurrentRollback.state.careerWorld.history[0].title, "تقرير مباراة أحدث");
  assert.equal(concurrentRollback.state.apps, 1);
  assert.equal(concurrentRollback.state.goals, 1);
  assert.equal(concurrentRollback.state.age, 22);
  assert.equal(concurrentRollback.state.calendarDay, 15);

  let releaseDuplicateHistoryRollback;
  const duplicateHistoryRollback = makeHarness({
    money: 1000,
    careerWorld: {
      version: 1, challengeCount: 0, challengeWins: 0, practiceAttempts: 0,
      memoryWins: 0, timingWins: 0, mentorSessions: 0,
      investments: [], investmentSequence: 1,
      history: [{
        title: "ادخار آمن",
        text: "حجزت 100 جنيه داخل اللعبة؛ الاستحقاق بعد 7 أيام.",
        season: 1, day: 1, source: "existing-same-day-event"
      }]
    }
  }, [
    () => new Promise(resolve => { releaseDuplicateHistoryRollback = resolve; }),
    true
  ]);
  const pendingDuplicateHistoryInvestment = duplicateHistoryRollback.click("invest-safe");
  duplicateHistoryRollback.state.careerWorld.history.unshift({
    title: "ادخار آمن",
    text: "حجزت 100 جنيه داخل اللعبة؛ الاستحقاق بعد 7 أيام.",
    season: 1, day: 1, source: "newer-similar-event"
  });
  releaseDuplicateHistoryRollback(false);
  const duplicateHistoryResult = await pendingDuplicateHistoryInvestment;
  assert.equal(duplicateHistoryResult.ok, false);
  assert.equal(duplicateHistoryRollback.state.money, 1000);
  assert.equal(duplicateHistoryRollback.state.careerWorld.investments.length, 0);
  assert.equal(duplicateHistoryRollback.state.careerWorld.history.length, 2,
    "rollback must remove only its exact transaction row when other events share the same title, text, season and day");
  assert.deepEqual(duplicateHistoryRollback.state.careerWorld.history.map(row => row.source).sort(),
    ["existing-same-day-event", "newer-similar-event"],
    "descriptively similar but distinct history events must both survive rollback");

  let releaseSameBalance;
  const sameBalanceUpdate = makeHarness({ money: 1000 }, [
    () => new Promise(resolve => { releaseSameBalance = resolve; }), true
  ]);
  const pendingSameBalanceInvestment = sameBalanceUpdate.click("invest-safe");
  sameBalanceUpdate.state.money = 1250;
  releaseSameBalance(false);
  const sameBalanceResult = await pendingSameBalanceInvestment;
  assert.equal(sameBalanceResult.ok, false);
  assert.equal(sameBalanceUpdate.state.money, 1350,
    "rollback must reverse only the failed investment debit while preserving a newer balance credit");

  const training = makeHarness({ money: 1000, energy: 10, shooting: 50, trainedToday: false });
  const trained = await training.click("skill-shooting");
  assert.equal(trained.ok, true);
  assert.equal(training.state.money, 820);
  assert.equal(training.state.shooting, 52);
  assert.equal(training.state.energy, 2);
  assert.equal(training.state.careerXP, 10);
  assert.equal(training.state.trainedToday, true,
    "paid focused training must consume the same daily training slot as the standard career session");
  assert.equal(training.saveCalls, 1);
  const duplicateTraining = await training.click("skill-passing");
  assert.equal(duplicateTraining.ok, false, "a second paid training session must be blocked on the same day");
  assert.equal(duplicateTraining.reason, "training-already-used");
  assert.equal(training.state.money, 820, "a blocked second session must not charge the player again");
  assert.equal(training.state.passing, undefined, "a blocked second session must not improve another skill");
  assert.equal(training.state.energy, 2);
  assert.equal(training.state.careerXP, 10);
  assert.equal(training.saveCalls, 1, "a blocked second session must not queue another save");

  const alreadyTrained = makeHarness({ money: 1000, energy: 10, trainedToday: true });
  const alreadyTrainedResult = await alreadyTrained.click("skill-shooting");
  assert.equal(alreadyTrainedResult.ok, false,
    "paid focused training must respect a training session already completed in the main career UI");
  assert.equal(alreadyTrainedResult.reason, "training-already-used");
  assert.equal(alreadyTrained.state.money, 1000);
  assert.equal(alreadyTrained.state.shooting, 50);
  assert.equal(alreadyTrained.saveCalls, 0);

  const matchDayTraining = makeHarness({ money: 1000, energy: 10, playedToday: true });
  const matchDayTrainingResult = await matchDayTraining.click("skill-shooting");
  assert.equal(matchDayTrainingResult.ok, false, "specialized training must be blocked on match days");
  assert.equal(matchDayTrainingResult.reason, "played-today");
  assert.equal(matchDayTraining.state.money, 1000);
  assert.equal(matchDayTraining.state.shooting, 50);
  assert.equal(matchDayTraining.saveCalls, 0);

  const blockedTrainingUi = makeHarness({ trainedToday: true });
  await blockedTrainingUi.click("training-skill");
  assert.match(blockedTrainingUi.overlay.innerHTML, /data-lwcx-action="skill-shooting" disabled/,
    "the specialized training UI must disable skills after the daily training slot is used");
  assert.match(blockedTrainingUi.overlay.innerHTML, /أنهيت تدريب اليوم/,
    "the specialized training UI must explain why the skill buttons are disabled");

  const failedTrainingSave = makeHarness({ money: 1000, energy: 10, shooting: 50, trainedToday: false }, [false, true]);
  const failedTrainingResult = await failedTrainingSave.click("skill-shooting");
  assert.equal(failedTrainingResult.ok, false);
  assert.equal(failedTrainingSave.state.money, 1000);
  assert.equal(failedTrainingSave.state.shooting, 50);
  assert.equal(failedTrainingSave.state.energy, 10);
  assert.equal(failedTrainingSave.state.careerXP, 0);
  assert.equal(failedTrainingSave.state.trainedToday, false,
    "a failed backup-first save must roll back the consumed training slot");
  assert.equal(failedTrainingSave.saveCalls, 2);
  assert.equal(failedTrainingSave.flushCalls, 2);

  function malformedDueState(dueDay) {
    const state = dueState();
    state.careerWorld.investments[0].dueDay = dueDay;
    return state;
  }

  for (const dueDay of [
    [7], true, Symbol("7"), 7.5, Infinity, "not-a-day",
    { valueOf() { throw new Error("unsafe-due-day-coercion"); } }
  ]) {
    const malformedDue = makeHarness(malformedDueState(dueDay));
    await malformedDue.settleMicrotasks();
    assert.equal(malformedDue.state.money, 1000,
      "invalid due-day values must never release investment payouts");
    assert.equal(malformedDue.state.careerWorld.investments[0].settled, false,
      "invalid due-day records must remain pending for manual review");
    assert.equal(malformedDue.saveCalls, 0,
      "an invalid due day must not trigger a financial save");
  }

  const legacyStringDue = makeHarness(malformedDueState("7"));
  await legacyStringDue.settleMicrotasks();
  assert.equal(legacyStringDue.state.money, 1118,
    "integer numeric-string due days must remain compatible with legacy saves");
  assert.equal(legacyStringDue.state.careerWorld.investments[0].settled, true);

  const fallbackCalendarDay = makeHarness(Object.assign(dueState(), {
    calendarDay: Symbol("invalid-calendar-day")
  }));
  await fallbackCalendarDay.settleMicrotasks();
  assert.equal(fallbackCalendarDay.state.money, 1118,
    "an invalid calendarDay must safely fall back to the valid legacy day field");

  const fallbackInvalidDay = makeHarness(Object.assign(dueState(), {
    calendarDay: { valueOf() { throw new Error("unsafe-calendar-day-coercion"); } },
    day: Symbol("invalid-day"),
    careerWorld: Object.assign(dueState().careerWorld, {
      investments: [{ id:1, kind:"safe", label:"ادخار آمن", amount:100, payout:118,
        dueDay:1, settled:false, successful:true }],
      investmentSequence:2
    })
  }));
  await fallbackInvalidDay.settleMicrotasks();
  assert.equal(fallbackInvalidDay.state.money, 1118,
    "both invalid day fields must fall back to day one without crashing settlement");
  assert.equal(fallbackInvalidDay.state.careerWorld.history[0].day, 1,
    "settlement history must use the same safe day fallback");

  const malformedPortfolio = makeHarness({
    money:1000,
    careerWorld: {
      version:1, challengeCount:0, challengeWins:0, practiceAttempts:0,
      memoryWins:0, timingWins:0, mentorSessions:0,
      investments:[null, "legacy-row", [], true, [1], { malformed:true }],
      history:[], investmentSequence:1
    }
  });
  const malformedPortfolioResult = await malformedPortfolio.click("invest-safe");
  assert.equal(malformedPortfolioResult.ok, true,
    "malformed non-record rows must not consume the five-open-investment limit");
  assert.equal(malformedPortfolio.state.money, 900);
  assert.equal(malformedPortfolio.state.careerWorld.investments.length, 7,
    "adding a valid investment must preserve every malformed legacy portfolio entry");

  const nullPortfolio = makeHarness({
    careerWorld: {
      version:1, challengeCount:0, challengeWins:0, practiceAttempts:0,
      memoryWins:0, timingWins:0, mentorSessions:0,
      investments:[null, { id:1, kind:"safe", label:"ادخار آمن", amount:100,
        payout:118, dueDay:30, settled:false, successful:true }],
      history:[], investmentSequence:2
    }
  });
  await assert.doesNotReject(async () => {
    await nullPortfolio.click("open-finance");
  }, "a legacy portfolio containing a null entry must not crash the finance screen");
  assert.equal(nullPortfolio.saveCalls, 0,
    "opening a portfolio with malformed entries must not mutate the saved career");

  const settlement = makeHarness(dueState());
  await settlement.settleMicrotasks();
  assert.equal(settlement.state.money, 1118);
  assert.equal(settlement.state.careerWorld.investments[0].settled, true);
  assert.equal(settlement.saveCalls, 1);
  settlement.runInterval();
  await settlement.settleMicrotasks();
  assert.equal(settlement.state.money, 1118, "same-day polls must not pay the same investment twice");
  assert.equal(settlement.saveCalls, 1);

  const retry = makeHarness(dueState(), [false, true, true]);
  await retry.settleMicrotasks();
  assert.equal(retry.state.money, 1000, "failed settlement persistence must restore the pre-payout balance");
  assert.equal(retry.state.careerWorld.investments[0].settled, false, "failed settlement must remain retryable");
  assert.equal(retry.saveCalls, 2);
  retry.runInterval();
  await retry.settleMicrotasks();
  assert.equal(retry.state.money, 1118, "a failed due payout must retry after rollback is confirmed");
  assert.equal(retry.state.careerWorld.investments[0].settled, true);
  assert.equal(retry.saveCalls, 3);

  const unsafeTraining = makeHarness({ money: Number.MAX_SAFE_INTEGER + 1, energy: 20 });
  const unsafeResult = await unsafeTraining.click("skill-shooting");
  assert.equal(unsafeResult.ok, false, "unsafe integer balances must not fund paid training");
  assert.equal(unsafeTraining.state.money, Number.MAX_SAFE_INTEGER + 1);
  assert.equal(unsafeTraining.state.shooting, 50);
  assert.equal(unsafeTraining.saveCalls, 0);

  let releaseAlreadyRestored;
  const alreadyRestoredBalance = makeHarness({ money: 1000 }, [
    () => new Promise(resolve => { releaseAlreadyRestored = resolve; }), true
  ]);
  const pendingAlreadyRestoredInvestment = alreadyRestoredBalance.click("invest-safe");
  alreadyRestoredBalance.state.money = 1000;
  releaseAlreadyRestored(false);
  const alreadyRestoredResult = await pendingAlreadyRestoredInvestment;
  assert.equal(alreadyRestoredResult.ok, false);
  assert.equal(alreadyRestoredBalance.state.money, 1000,
    "rollback must not double-credit a balance that a newer update has already restored to its pre-transaction value");

  console.log("PASS: career-experience finance actions are durable, rollback-safe, serialized, and idempotent.");
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
