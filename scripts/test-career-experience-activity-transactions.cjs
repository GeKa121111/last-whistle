"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "career-experience.js"), "utf8");
const deployed = fs.readFileSync(path.join(root, "public", "career-experience.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const publicHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const publicSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
assert.equal(source, deployed, "root/public career experience scripts must stay identical");
assert.equal(html, publicHtml, "root/public app shells must stay identical");
assert.equal(sw, publicSw, "root/public service workers must stay identical");
assert.match(html, /career-experience\.js\?v=9/);
const experienceCacheVersionMatch = sw.match(/last-whistle-static-v(\d+)/);
assert.ok(experienceCacheVersionMatch && Number(experienceCacheVersionMatch[1]) >= 471, "career-experience activity cache invalidation must remain valid after newer cache bumps");
assert.match(sw, /career-experience\.js\?v=9/);
require("./assert-static-cache-version.cjs")(sw, 537);
require("./assert-static-cache-version.cjs").assertAssetVersionAtLeast(html, "career-experience.js", 9);

function makeHarness(overrides = {}, flushQueue = []) {
  const listeners = Object.create(null), notices = [], intervalCallbacks = [], timeoutCallbacks = [];
  const nodes = { "lwcx-power": { value: "68" } };
  let saveCalls = 0, flushCalls = 0;
  const state = Object.assign({
    careerStarted: true, retired: false, injuryDays: 0, energy: 10, careerXP: 0,
    shooting: 50, composure: 50, vision: 50, morale: 50, trust: 50,
    coachRelationship: 40, professionalism: 60, teamChemistry: 50, fatigue: 20,
    money: 1000, day: 1, calendarDay: 1, season: 1, apps: 0
  }, overrides);
  const overlay = { hidden: true, innerHTML: "", addEventListener() {},
    querySelector(selector) { return selector === ".lwcx-close" ? { focus() {} } : null; },
    querySelectorAll() { return []; } };
  const quietConsole = { warn() {}, error() {} };
  const api = { getState: () => state, save() { saveCalls++; return true; }, render() {},
    toast(message) { notices.push(String(message)); } };
  const math = { random: () => 0, abs: Math.abs, ceil: Math.ceil, floor: Math.floor,
    max: Math.max, min: Math.min, round: Math.round, trunc: Math.trunc };
  const window = {
    LWStoryRuntime: api, console: quietConsole,
    flushQueuedSave(options) {
      assert.equal(options && options.backupFirst, true);
      flushCalls++;
      const next = flushQueue.length ? flushQueue.shift() : true;
      return typeof next === "function" ? next() : Promise.resolve(next);
    },
    setInterval(callback) { intervalCallbacks.push(callback); return intervalCallbacks.length; },
    clearInterval() {}, setTimeout(callback) { timeoutCallbacks.push(callback); return timeoutCallbacks.length; },
    clearTimeout() {}, addEventListener() {}
  };
  const document = { readyState: "loading", hidden: false,
    addEventListener(type, callback) { (listeners[type] ||= []).push(callback); },
    createElement() { return overlay; }, body: { appendChild() {} },
    getElementById(id) { return nodes[id] || null; } };
  vm.runInNewContext(source, { window, document, Math: math, Number, String, JSON, Array, Promise, console: quietConsole },
    { filename: "career-experience.js" });
  for (const callback of listeners.DOMContentLoaded || []) callback();
  function click(action, attrs = {}) {
    const button = { disabled: false, getAttribute(name) {
      if (name === "data-lwcx-action") return action;
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    } };
    return listeners.click[0]({ target: { closest: () => button }, preventDefault() {} });
  }
  return { state, notices, overlay, click, intervalCallbacks, timeoutCallbacks,
    get saveCalls() { return saveCalls; }, get flushCalls() { return flushCalls; } };
}
async function playPenalty(h) {
  await h.click("open-challenges"); await h.click("open-penalty");
  await h.click("penalty-target", { "data-dir": "right" });
  return h.click("penalty-shoot");
}
(async function run() {
  const failedPenalty = makeHarness({ energy: 10, careerXP: 0, shooting: 50 }, [false, true]);
  const failedPenaltyResult = await playPenalty(failedPenalty);
  assert.equal(failedPenaltyResult.ok, false);
  assert.equal(failedPenalty.state.energy, 10);
  assert.equal(failedPenalty.state.careerXP, 0);
  assert.equal(failedPenalty.state.shooting, 50);
  assert.equal(failedPenalty.state.careerWorld.challengeCount, 0);
  assert.equal(failedPenalty.state.careerWorld.practiceAttempts, 0);
  assert.equal(failedPenalty.state.careerWorld.challengeWins, 0);
  assert.equal(failedPenalty.state.careerWorld.history.length, 0);
  assert.equal(failedPenalty.saveCalls, 2);
  assert.equal(failedPenalty.flushCalls, 2);
  assert.match(failedPenalty.overlay.innerHTML, /النتيجة ما اتحفظتش/);

  let releaseConcurrentActivity;
  const concurrentActivity = makeHarness({ energy: 10, careerXP: 0, shooting: 50 }, [
    () => new Promise(resolve => { releaseConcurrentActivity = resolve; }), true
  ]);
  const pendingConcurrentActivity = playPenalty(concurrentActivity);
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(concurrentActivity.state.energy, 6);
  concurrentActivity.state.age = 18;
  concurrentActivity.state.calendarDay = 15;
  concurrentActivity.state.academyGraduated = true;
  concurrentActivity.state.careerWorld.matchReport = { id: "newer-match-report" };
  releaseConcurrentActivity(false);
  const concurrentActivityResult = await pendingConcurrentActivity;
  assert.equal(concurrentActivityResult.ok, false);
  assert.equal(concurrentActivity.state.energy, 10, "failed activity rollback must refund only its own energy cost");
  assert.equal(concurrentActivity.state.careerXP, 0);
  assert.equal(concurrentActivity.state.shooting, 50);
  assert.equal(concurrentActivity.state.age, 18,
    "activity rollback must preserve a newer player-age update");
  assert.equal(concurrentActivity.state.calendarDay, 15,
    "activity rollback must preserve a newer calendar update");
  assert.equal(concurrentActivity.state.academyGraduated, true,
    "activity rollback must preserve newer transfer-eligibility changes");
  assert.deepEqual(concurrentActivity.state.careerWorld.matchReport, { id: "newer-match-report" },
    "activity rollback must preserve a newer nested match report");
  assert.equal(concurrentActivity.state.careerWorld.challengeCount, 0);
  assert.equal(concurrentActivity.state.careerWorld.practiceAttempts, 0);
  assert.equal(concurrentActivity.state.careerWorld.history.length, 0);

  const successfulPenalty = makeHarness({ energy: 10, careerXP: 0, shooting: 50 }, [true]);
  const successfulPenaltyResult = await playPenalty(successfulPenalty);
  assert.equal(successfulPenaltyResult.ok, true);
  assert.equal(successfulPenalty.state.energy, 6);
  assert.equal(successfulPenalty.state.careerXP, 8);
  assert.equal(successfulPenalty.state.shooting, 51);
  assert.equal(successfulPenalty.state.careerWorld.challengeCount, 1);
  assert.equal(successfulPenalty.state.careerWorld.practiceAttempts, 1);
  assert.equal(successfulPenalty.state.careerWorld.challengeWins, 1);
  assert.equal(successfulPenalty.state.careerWorld.history.length, 1);

  const failedTiming = makeHarness({ energy: 10, careerXP: 0 }, [false, true]);
  await failedTiming.click("open-timing"); await failedTiming.click("timing-start");
  const timingTick = failedTiming.intervalCallbacks.at(-1);
  for (let i = 0; i < 24; i++) timingTick();
  const timingResult = await failedTiming.click("timing-stop");
  assert.equal(timingResult.ok, false);
  assert.equal(failedTiming.state.careerWorld.timingWins, 0);
  assert.equal(failedTiming.state.careerWorld.challengeCount, 0);
  assert.equal(failedTiming.state.energy, 10);
  assert.equal(failedTiming.state.careerXP, 0);

  const failedMemory = makeHarness({ energy: 10, careerXP: 0 }, [false, true]);
  await failedMemory.click("open-memory");
  failedMemory.timeoutCallbacks.at(-1)();
  for (const arrow of ["↓", "↑", "↑", "↓"]) await failedMemory.click("memory-answer", { "data-arrow": arrow });
  assert.equal(failedMemory.state.careerWorld.memoryWins, 0);
  assert.equal(failedMemory.state.careerWorld.challengeCount, 0);
  assert.equal(failedMemory.state.energy, 10);
  assert.equal(failedMemory.state.careerXP, 0);

  const successfulMemory = makeHarness({ energy: 10, careerXP: 0 }, [true]);
  await successfulMemory.click("open-memory");
  successfulMemory.timeoutCallbacks.at(-1)();
  for (const arrow of ["↓", "↑", "↑", "↓"]) await successfulMemory.click("memory-answer", { "data-arrow": arrow });
  assert.equal(successfulMemory.state.careerWorld.memoryWins, 1);
  assert.equal(successfulMemory.state.careerWorld.challengeCount, 1);
  assert.equal(successfulMemory.state.energy, 9);
  assert.equal(successfulMemory.state.careerXP, 8);

  const failedMentor = makeHarness({ energy: 3, coachRelationship: 40, trust: 50, professionalism: 60,
    dailyActionUsed: false, nightToday: false }, [false, true]);
  await failedMentor.click("open-mentor");
  const failedMentorResult = await failedMentor.click("mentor-coach");
  assert.equal(failedMentorResult.ok, false);
  assert.equal(failedMentor.state.coachRelationship, 40);
  assert.equal(failedMentor.state.trust, 50);
  assert.equal(failedMentor.state.professionalism, 60);
  assert.equal(failedMentor.state.energy, 3);
  assert.equal(failedMentor.state.dailyActionUsed, false);
  assert.equal(failedMentor.state.nightToday, false);
  assert.equal(failedMentor.state.careerWorld.mentorSessions, 0);
  assert.equal(failedMentor.state.careerWorld.history.length, 0);
  assert.equal(failedMentor.saveCalls, 2);
  assert.equal(failedMentor.flushCalls, 2);

  const successfulMentor = makeHarness({ energy: 3, coachRelationship: 40, trust: 50, professionalism: 60,
    dailyActionUsed: false }, [true]);
  await successfulMentor.click("open-mentor");
  const successfulMentorResult = await successfulMentor.click("mentor-coach");
  assert.equal(successfulMentorResult.ok, true);
  assert.equal(successfulMentor.state.coachRelationship, 45);
  assert.equal(successfulMentor.state.trust, 52);
  assert.equal(successfulMentor.state.professionalism, 63);
  assert.equal(successfulMentor.state.energy, 0);
  assert.equal(successfulMentor.state.dailyActionUsed, true);
  assert.equal(successfulMentor.state.careerWorld.mentorSessions, 1);
  assert.equal(successfulMentor.saveCalls, 1);
  assert.equal(successfulMentor.flushCalls, 1);

  const legacyUsedWithoutDay = makeHarness({ energy: 10, dailyActionUsed: true });
  await legacyUsedWithoutDay.click("open-mentor");
  assert.match(legacyUsedWithoutDay.overlay.innerHTML, /استخدمت نشاطك الجانبي النهارده/,
    "legacy saves with the used flag but no dailyActionDay must show the activity as consumed");
  assert.match(legacyUsedWithoutDay.overlay.innerHTML, /data-lwcx-action="mentor-reset"[^>]*disabled/,
    "the missing legacy day marker must fail closed in the activity panel");
  const legacyBlockedResult = await legacyUsedWithoutDay.click("mentor-reset");
  assert.equal(legacyBlockedResult.ok, false);
  assert.equal(legacyBlockedResult.reason, "daily-action-used");
  assert.equal(legacyUsedWithoutDay.state.morale, 50);
  assert.equal(legacyUsedWithoutDay.saveCalls, 0);

  const malformedActionDay = makeHarness({
    energy: 10, dailyActionUsed: true, dailyActionDay: Symbol("invalid-action-day")
  });
  await malformedActionDay.click("open-mentor");
  const malformedActionDayResult = await malformedActionDay.click("mentor-reset");
  assert.equal(malformedActionDayResult.ok, false,
    "a corrupt dailyActionDay must not make a previously used activity available again");
  assert.equal(malformedActionDayResult.reason, "daily-action-used");
  assert.equal(malformedActionDay.saveCalls, 0);

  const malformedCurrentDay = makeHarness({
    energy: 10, day: Symbol("invalid-current-day"), dailyActionUsed: true, dailyActionDay: 1
  });
  const malformedCurrentDayResult = await malformedCurrentDay.click("mentor-reset");
  assert.equal(malformedCurrentDayResult.ok, false,
    "a corrupt current day must use a deterministic fallback before checking the activity lock");
  assert.equal(malformedCurrentDayResult.reason, "daily-action-used");
  assert.equal(malformedCurrentDay.saveCalls, 0);

  const nextDayLegacyFlag = makeHarness({
    energy: 3, day: 2, dailyActionUsed: true, dailyActionDay: 1, coachRelationship: 40
  }, [true]);
  const nextDayResult = await nextDayLegacyFlag.click("mentor-coach");
  assert.equal(nextDayResult.ok, true,
    "a valid prior-day marker must not block a new day's activity even if an old save retained the flag");
  assert.equal(nextDayLegacyFlag.state.dailyActionDay, 2);
  assert.equal(nextDayLegacyFlag.state.dailyActionUsed, true);
  assert.equal(nextDayLegacyFlag.state.coachRelationship, 45);
  assert.equal(nextDayLegacyFlag.saveCalls, 1);

  const invalidEnergy = makeHarness({ energy: Symbol("invalid-energy"), dailyActionUsed: false });
  const invalidEnergyResult = await invalidEnergy.click("mentor-reset");
  assert.equal(invalidEnergyResult.ok, false, "invalid energy must fail closed instead of throwing or applying a reset");
  assert.equal(invalidEnergyResult.reason, "insufficient-energy");
  assert.equal(invalidEnergy.state.morale, 50);
  assert.equal(invalidEnergy.saveCalls, 0);

  let release;
  const concurrent = makeHarness({ energy: 0, morale: 50, dailyActionUsed: false }, [
    () => new Promise(resolve => { release = resolve; })
  ]);
  await concurrent.click("open-mentor");
  const first = concurrent.click("mentor-reset");
  assert.equal(concurrent.state.dailyActionUsed, true);
  await concurrent.click("mentor-reset");
  assert.equal(concurrent.saveCalls, 1);
  assert.equal(concurrent.state.careerWorld.mentorSessions, 1);
  assert.equal(concurrent.notices.some(message => message.includes("اتسجل واتأكد حفظه")), false);
  release(true);
  assert.equal((await first).ok, true);
  assert.equal(concurrent.saveCalls, 1);
  assert.equal(concurrent.state.careerWorld.mentorSessions, 1);
  console.log("PASS: challenges and mentor actions are backup-first, rollback-safe, serialized, and idempotent.");
})().catch(error => { console.error(error && error.stack ? error.stack : error); process.exitCode = 1; });
