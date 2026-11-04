"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "story-mode.js"), "utf8");
const deployed = fs.readFileSync(path.join(root, "public", "story-mode.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const publicHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const publicSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
assert.equal(source, deployed, "root/public story runtimes must match");
assert.equal(html, publicHtml, "root/public HTML must match");
assert.equal(sw, publicSw, "root/public service workers must match");
assert.match(html, /story-mode\.js\?v=14/);
assert.match(sw, /story-mode\.js\?v=14/);
const storyTransactionCacheVersionMatch = sw.match(/last-whistle-static-v(\d+)/);
assert.ok(storyTransactionCacheVersionMatch && Number(storyTransactionCacheVersionMatch[1]) >= 471, "story transaction cache invalidation must remain valid after newer cache bumps");
require("./assert-static-cache-version.cjs")(sw, 445);

const helperStart = source.indexOf("function cloneStoryState(");
const helperEnd = source.indexOf("\nfunction actualEvent(", helperStart);
const choiceStart = source.indexOf("async function chooseStory(");
const choiceEnd = source.indexOf("\nfunction renderOverview(", choiceStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart);
assert.ok(choiceStart >= 0 && choiceEnd > choiceStart);
const helperSource = source.slice(helperStart, helperEnd);
const choiceSource = source.slice(choiceStart, choiceEnd);

function makeHarness(flushQueue = []) {
  const state = {
    careerStarted: true, storyPendingId: "family-pressure",
    storyFlags: {}, storyHistory: [], diary: [{ type: "existing", text: "keep me" }],
    storyTitle: "", storyText: "", money: 1000, energy: 50, professionalism: 60,
    season: 1, day: 3, age: 17, calendarDay: 1, academyGraduated: false
  };
  const notices = [], logs = [];
  let saveCalls = 0, flushCalls = 0, renderCalls = 0, overviewRenders = 0, panelRenders = 0;
  const api = {
    getState: () => state, save() { saveCalls++; return true; }, render() { renderCalls++; },
    toast(message) { notices.push(String(message)); }, log(message) { logs.push(String(message)); }
  };
  const quietConsole = { warn() {}, error() {} };
  const window = {
    console: quietConsole,
    flushQueuedSave(options) {
      assert.equal(options && options.backupFirst, true);
      flushCalls++;
      const next = flushQueue.length ? flushQueue.shift() : true;
      return typeof next === "function" ? next() : Promise.resolve(next);
    }
  };
  const event = {
    id: "family-pressure", title: "مكالمة آخر الليل",
    choices: [{
      label: "أقبل شغل إضافي جنب التدريب",
      outcome: "دخلت فلوس زيادة للبيت، لكن يومك بقى أصعب.",
      effects: { money: 180, energy: -12, professionalism: -1 },
      set: { agentLead: true }
    }]
  };
  const sandbox = {
    window, console: quietConsole, Promise, JSON, Number, String, Array, Object,
    storyMutationPending: false, lastPending: "",
    API: () => api,
    storyFlags(s) { if (!s.storyFlags || typeof s.storyFlags !== "object") s.storyFlags = {}; return s.storyFlags; },
    history(s) { if (!Array.isArray(s.storyHistory)) s.storyHistory = []; return s.storyHistory; },
    eligibleEvents(s) { return s.storyFlags && s.storyFlags["family-pressure"] ? [] : [event]; },
    normaliseStat(s, key, delta) {
      const bounded = ["energy", "morale", "trust", "fatigue", "professionalism", "mediaReputation", "teamChemistry", "coachRelationship", "playerPotential", "fitness", "confidence"];
      const total = Number(s[key] || 0) + Number(delta || 0);
      if (bounded.includes(key)) s[key] = Math.max(0, Math.min(100, Math.round(total)));
      else if (["money", "followers", "injuryDays", "careerXP", "goals", "assists", "apps"].includes(key)) s[key] = Math.max(0, Math.round(total));
      else if (key === "contractSeasons") s[key] = Math.max(0, Math.min(5, Math.round(total)));
      else s[key] = total;
    },
    syncMatchContext(s, options) {
      assert.equal(options && options.deferSave, true);
      s.lastStoryMatchKey = "match-key-1";
      s.matchNarrativeLedger = [{ key: "match-key-1" }];
    },
    checkTriggers(s, apiArg, options) {
      assert.equal(options && options.deferSave, true);
      assert.equal(options && options.suppressToast, true);
      if (!s.storyPendingId) s.storyPendingId = "debut";
    },
    renderOverview() { overviewRenders++; },
    renderStoryPanel() { panelRenders++; }
  };
  vm.createContext(sandbox);
  vm.runInContext(helperSource + "\n" + choiceSource, sandbox, { filename: "story-mode.transactions" });
  return {
    state, notices, logs, chooseStory: (id = "family-pressure", index = 0) => sandbox.chooseStory(id, index),
    get saveCalls() { return saveCalls; }, get flushCalls() { return flushCalls; },
    get renderCalls() { return renderCalls; }, get overviewRenders() { return overviewRenders; },
    get panelRenders() { return panelRenders; }
  };
}

(async function run() {
  const failed = makeHarness([false, true]);
  const failedResult = await failed.chooseStory("family-pressure", 0);
  assert.equal(failedResult.ok, false);
  assert.equal(failed.state.money, 1000);
  assert.equal(failed.state.energy, 50);
  assert.equal(failed.state.professionalism, 60);
  assert.equal(failed.state.agentLead, undefined);
  assert.equal(failed.state.storyPendingId, "family-pressure");
  assert.equal(failed.state.storyFlags["family-pressure"], undefined);
  assert.equal(failed.state.storyHistory.length, 0);
  assert.equal(failed.state.diary.length, 1);
  assert.equal(failed.state.lastStoryMatchKey, undefined);
  assert.equal(failed.state.matchNarrativeLedger, undefined);
  assert.equal(failed.saveCalls, 2);
  assert.equal(failed.flushCalls, 2);
  assert.equal(failed.logs.length, 0);
  assert.equal(failed.notices.some(message => message.includes("اتسجل قرارك واتطبقت")), false);

  let releaseConcurrentSave;
  const concurrentCareerUpdate = makeHarness([
    () => new Promise(resolve => { releaseConcurrentSave = resolve; }),
    true
  ]);
  const pendingConcurrentStory = concurrentCareerUpdate.chooseStory("family-pressure", 0);
  assert.equal(concurrentCareerUpdate.state.money, 1180,
    "the story mutation should be applied in memory while its save is pending");
  concurrentCareerUpdate.state.age = 18;
  concurrentCareerUpdate.state.calendarDay = 15;
  concurrentCareerUpdate.state.academyGraduated = true;
  releaseConcurrentSave(false);
  const concurrentStoryResult = await pendingConcurrentStory;
  assert.equal(concurrentStoryResult.ok, false);
  assert.equal(concurrentCareerUpdate.state.money, 1000,
    "the failed story effect must still roll back");
  assert.equal(concurrentCareerUpdate.state.energy, 50);
  assert.equal(concurrentCareerUpdate.state.professionalism, 60);
  assert.equal(concurrentCareerUpdate.state.storyPendingId, "family-pressure");
  assert.equal(concurrentCareerUpdate.state.age, 18,
    "story rollback must not erase a newer player-age update");
  assert.equal(concurrentCareerUpdate.state.calendarDay, 15,
    "story rollback must not rewind a newer calendar update");
  assert.equal(concurrentCareerUpdate.state.academyGraduated, true,
    "story rollback must preserve newer transfer-eligibility changes");

  let releaseConcurrentMoney;
  const concurrentSameField = makeHarness([
    () => new Promise(resolve => { releaseConcurrentMoney = resolve; }),
    true
  ]);
  const pendingSameFieldStory = concurrentSameField.chooseStory("family-pressure", 0);
  concurrentSameField.state.money = 1350;
  releaseConcurrentMoney(false);
  const sameFieldResult = await pendingSameFieldStory;
  assert.equal(sameFieldResult.ok, false);
  assert.equal(concurrentSameField.state.money, 1350,
    "rollback must preserve a newer write to a field also changed by the failed story operation");
  assert.ok(concurrentSameField.notices.some(message => message.includes("احتفظنا بالتغييرات الأحدث")),
    "the player must be told when a conflicting newer field was deliberately preserved");

  const successful = makeHarness([true]);
  const successResult = await successful.chooseStory("family-pressure", 0);
  assert.equal(successResult.ok, true);
  assert.equal(successful.state.money, 1180);
  assert.equal(successful.state.energy, 38);
  assert.equal(successful.state.professionalism, 59);
  assert.equal(successful.state.agentLead, true);
  assert.equal(successful.state.storyFlags["family-pressure"], true);
  assert.equal(successful.state.storyPendingId, "debut");
  assert.equal(successful.state.storyHistory.length, 1);
  assert.equal(successful.state.diary.length, 2);
  assert.equal(successful.state.lastStoryMatchKey, "match-key-1");
  assert.equal(successful.state.matchNarrativeLedger.length, 1);
  assert.equal(successful.saveCalls, 1);
  assert.equal(successful.flushCalls, 1);
  assert.equal(successful.logs.length, 1);
  assert.equal(successful.notices.some(message => message.includes("اتسجل قرارك واتطبقت")), true);
  assert.equal(successful.overviewRenders, 1);
  assert.equal(successful.panelRenders, 1);

  const invalid = makeHarness([true]);
  const invalidResult = await invalid.chooseStory("family-pressure", 99);
  assert.equal(invalidResult.ok, false);
  assert.equal(invalid.saveCalls, 0);
  assert.equal(invalid.state.money, 1000);
  assert.equal(invalid.state.storyPendingId, "family-pressure");

  let release;
  const concurrent = makeHarness([() => new Promise(resolve => { release = resolve; })]);
  const first = concurrent.chooseStory("family-pressure", 0);
  assert.equal(concurrent.state.money, 1180);
  const second = await concurrent.chooseStory("family-pressure", 0);
  assert.equal(second.ok, false);
  assert.equal(concurrent.saveCalls, 1);
  assert.equal(concurrent.state.storyHistory.length, 1);
  assert.equal(concurrent.notices.some(message => message.includes("اتسجل قرارك واتطبقت")), false);
  release(true);
  assert.equal((await first).ok, true);
  assert.equal(concurrent.saveCalls, 1);
  assert.equal(concurrent.state.storyHistory.length, 1);
  console.log("PASS: story transactions roll back only their own changes and preserve newer concurrent career updates.");
})().catch(error => { console.error(error && error.stack ? error.stack : error); process.exitCode = 1; });
