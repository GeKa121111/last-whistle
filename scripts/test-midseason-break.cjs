"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const start = html.indexOf("function activateMidSeasonBreakIfDue(){");
const end = html.indexOf("\nfunction cupParticipants", start);
assert.ok(start >= 0 && end > start, "shared mid-season break transition must exist");
const source = html.slice(start, end);

function run(overrides = {}) {
  const state = {
    age: 24, retired: false, seasonFinished: false, seasonPhase: "firstHalf",
    seasonApps: 19, calendarDay: 150, winterBreakPending: false,
    journeyTransferReviewed: true, season: 3,
    ...overrides
  };
  const advances = [], stories = [], logs = [];
  let saves = 0;
  const sandbox = {
    state,
    seasonMatchTotal: () => 38,
    seasonMidpoint: () => 19,
    canAccessTransferMarket: () => state.age >= 18 && !state.retired,
    advanceCalendarDays(days, reason) {
      advances.push({ days, reason });
      state.calendarDay += days;
    },
    setStory: (title, body) => stories.push({ title, body }),
    log: message => logs.push(String(message)),
    saveGame: () => { saves++; }
  };
  vm.createContext(sandbox);
  new vm.Script(source, { filename: "activateMidSeasonBreakIfDue" }).runInContext(sandbox);
  const activated = sandbox.activateMidSeasonBreakIfDue();
  return { state, advances, stories, logs, saves, activated };
}

const beforeMidpoint = run({ seasonApps: 18 });
assert.equal(beforeMidpoint.activated, false);
assert.equal(beforeMidpoint.state.calendarDay, 150);
assert.equal(beforeMidpoint.state.winterBreakPending, false);

const aligned = run();
assert.equal(aligned.activated, true, "fixture midpoint should activate the winter break");
assert.equal(aligned.state.calendarDay, 184, "calendar should align with the opening day of the winter window");
assert.equal(aligned.state.seasonPhase, "winterBreak");
assert.equal(aligned.state.winterBreakPending, true);
assert.equal(aligned.state.journeyTransferReviewed, false);
assert.equal(aligned.advances.reduce((sum, step) => sum + step.days, 0), 34,
  "date movement must use the normal calendar path for wages and recovery");
assert.equal(aligned.stories.length, 1);
assert.equal(aligned.logs.length, 1);
assert.equal(aligned.saves, 1);

const alreadyInWinter = run({ calendarDay: 195 });
assert.equal(alreadyInWinter.activated, true);
assert.equal(alreadyInWinter.state.calendarDay, 195);
assert.equal(alreadyInWinter.advances.length, 0);

const staleWindow = run({ calendarDay: 220 });
assert.equal(staleWindow.activated, false);
assert.equal(staleWindow.state.seasonPhase, "secondHalf",
  "a missed winter window must not block the career until next year");
assert.equal(staleWindow.state.winterBreakPending, false);

const youth = run({ age: 15 });
assert.equal(youth.activated, false, "academy players must not be blocked by the professional winter market");
assert.equal(youth.state.calendarDay, 150);

const finished = run({ seasonApps: 38 });
assert.equal(finished.activated, false, "a completed season must not create a mid-season pause");

assert.equal(html, fs.readFileSync(path.join(root, "public", "index.html"), "utf8"),
  "root and public app shell must stay synchronized");
assert.ok(html.includes("if(activateMidSeasonBreakIfDue())break;"),
  "season simulation must stop immediately at the shared midpoint transition");
assert.ok(html.includes("activateMidSeasonBreakIfDue();\n const tactics="),
  "manual matches must use the shared midpoint transition");
assert.ok(html.includes('setStory(state.winterBreakPending?"وصلنا لنص الموسم — راجع انتقالات الشتاء":"صافرة النهاية: "+result.outcome,story);'),
  "manual match results must preserve guidance when the winter break activates");

console.log("PASS: winter-break timing follows the actual match midpoint and stays inside the winter transfer window.");
