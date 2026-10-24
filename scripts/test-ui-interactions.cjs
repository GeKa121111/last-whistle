#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const extractFunction = (name) => {
  const start = html.indexOf("function " + name + "(");
  if (start < 0) throw new Error("Missing game function: " + name);
  const next = html.indexOf("\nfunction ", start + 1);
  return html.slice(start, next < 0 ? html.length : next);
};

const functions = [
  "clamp",
  "resetDailyActions",
  "canUseDailyAction",
  "useDailyAction",
  "advanceCalendarDays",
  "rest",
  "talkCoach"
].map(extractFunction).join("\n");
const notices = [];
const logs = [];
const stories = [];
const modalCalls = [];
let saveCount = 0;
let renderCount = 0;
let winterMarketCalls = 0;
const sandbox = {
  state: {},
  window: { LWAgentRuntime: null },
  toast: (message) => notices.push(String(message)),
  log: (message) => logs.push(String(message)),
  setStory: (title, text) => stories.push({ title, text }),
  saveGame: () => { saveCount++; return true; },
  render: () => { renderCount++; },
  openWinterMarket: () => { winterMarketCalls++; },
  openModal: (title, text, choices) => { modalCalls.push({ title, text, choices }); },
  console
};
vm.createContext(sandbox);
vm.runInContext(functions, sandbox, { filename: "actual-career-actions" });

const makeState = (overrides = {}) => ({
  retired: false, winterBreakPending: false,
  day: 5, calendarDay: 5,
  energy: 55, fatigue: 40, injuryDays: 2, injuryName: "شد عضلي", morale: 60,
  money: 100, weeklyWage: 200,
  daysSinceTransfer: 0, daysSinceNegotiation: 0, transferCooldown: 0,
  playedToday: true, trainedToday: true, nightToday: true,
  dailyActionUsed: true, dailyActionType: "نشاط سابق", dailyActionDay: 5,
  trust: 25, coachRelationship: 35, professionalism: 65, lastRating: 0, role: "بديل",
  ...overrides
});

// Rest must advance the calendar and apply measurable recovery rather than changing only the UI.
notices.length = 0; logs.length = 0; stories.length = 0;
saveCount = 0; renderCount = 0; winterMarketCalls = 0;
sandbox.state = makeState();
sandbox.rest();
assert.equal(sandbox.state.day, 6, "rest must advance exactly one career day");
assert.equal(sandbox.state.calendarDay, 6, "rest must advance the calendar day");
assert.equal(sandbox.state.energy, 79, "base rest must restore 24 energy points without recovery upgrades");
assert.equal(sandbox.state.fatigue, 28, "rest must reduce fatigue by 12 points");
assert.equal(sandbox.state.injuryDays, 1, "rest must reduce injury duration by one day");
assert.equal(sandbox.state.morale, 64, "rest must raise morale by four points");
assert.equal(sandbox.state.dailyActionUsed, false, "a new day must reset the daily side-action gate");
assert.equal(sandbox.state.trainedToday, false, "a new day must reset the training gate");
assert.equal(sandbox.state.playedToday, false, "a new day must reset the match gate");
assert.equal(saveCount, 1, "rest must save the resulting career state");
assert.equal(renderCount, 1, "rest must refresh the UI");
assert.ok(notices.some((message) => message.includes("راحة يوم كامل")), "rest must give the player a result message");
assert.ok(stories.length > 0 && logs.length > 0, "rest must be recorded in the story and diary/log history");

// The winter pause is a blocking decision, so selecting rest must open the market decision without advancing time.
sandbox.state = makeState({ winterBreakPending: true });
saveCount = 0; renderCount = 0; winterMarketCalls = 0;
sandbox.rest();
assert.equal(winterMarketCalls, 1, "rest at winter break must open transfer/season choices");
assert.equal(sandbox.state.day, 5, "rest must not bypass the winter-break decision");
assert.equal(saveCount, 0, "blocked winter rest must not save a fake day advance");

// The wage is paid when the calendar crosses the seven-day boundary, not every time a date happens to be divisible by seven.
sandbox.state = makeState({ day: 7, calendarDay: 7, energy: 80, fatigue: 0, injuryDays: 0, morale: 50,
  money: 100, weeklyWage: 250, playedToday: false, trainedToday: false, dailyActionUsed: false,
  nightToday: false, dailyActionDay: 7 });
sandbox.advanceCalendarDays(1, "test wage boundary");
assert.equal(sandbox.state.calendarDay, 8);
assert.equal(sandbox.state.money, 350, "exactly one weekly wage is paid when crossing day 7 to day 8");

// Coach actions need to affect both numbers and use only one side-action slot per career day.
notices.length = 0; modalCalls.length = 0; saveCount = 0; renderCount = 0;
sandbox.state = makeState({ day: 3, calendarDay: 3, energy: 70, fatigue: 10, injuryDays: 0, morale: 60,
  trust: 25, coachRelationship: 35, professionalism: 65, lastRating: 0, role: "بديل",
  dailyActionUsed: false, dailyActionDay: 3, dailyActionType: "", nightToday: false });
sandbox.talkCoach();
assert.equal(modalCalls.length, 1, "talking to the coach should open the choice modal");
const promiseChoice = modalCalls[0].choices.find((choice) => choice.label === "أوعده بالالتزام");
assert.ok(promiseChoice, "the coach modal must expose the commitment choice");
promiseChoice.action();
assert.equal(sandbox.state.energy, 67, "coach commitment must charge its energy cost");
assert.equal(sandbox.state.trust, 27, "coach commitment must improve football trust by two points");
assert.equal(sandbox.state.coachRelationship, 39, "coach commitment must improve the relationship by four points");
assert.equal(sandbox.state.professionalism, 66, "coach commitment must improve professionalism");
assert.equal(sandbox.state.morale, 61, "coach commitment must improve morale");
assert.equal(sandbox.state.dailyActionUsed, true, "coach commitment must consume the side-action slot");
assert.equal(sandbox.state.dailyActionType, "حديث المدرب");
assert.equal(saveCount, 1, "coach commitment must save the state");
assert.equal(renderCount, 1, "coach commitment must refresh the interface");
sandbox.talkCoach();
assert.equal(modalCalls.length, 1, "a second coach session in the same day must not open a second modal");
assert.ok(notices.some((message) => message.includes("نشاطك الجانبي")), "the daily limit must explain why the next session is blocked");

// Asking for a role only grants one when both trust and recent match rating meet the stated requirements.
sandbox.state = makeState({ day: 8, calendarDay: 8, energy: 80, fatigue: 0, injuryDays: 0, morale: 60,
  trust: 50, coachRelationship: 40, professionalism: 65, lastRating: 7.1, role: "بديل أساسي",
  dailyActionUsed: false, dailyActionDay: 8, dailyActionType: "", nightToday: false });
sandbox.talkCoach();
const requestChance = modalCalls[1].choices.find((choice) => choice.label === "أطلب فرصة في الماتش الجاي");
assert.ok(requestChance);
requestChance.action();
assert.equal(sandbox.state.role, "بديل أساسي");
assert.equal(sandbox.state.trust, 52);
assert.equal(sandbox.state.coachRelationship, 43);

// Complaining has a downside that is reflected in the proper stats.
sandbox.state = makeState({ day: 9, calendarDay: 9, energy: 80, fatigue: 0, injuryDays: 0, morale: 60,
  trust: 50, coachRelationship: 40, professionalism: 65, lastRating: 5.0, role: "بديل",
  dailyActionUsed: false, dailyActionDay: 9, dailyActionType: "", nightToday: false });
sandbox.talkCoach();
const complaint = modalCalls[2].choices.find((choice) => choice.label === "أشتكي من قلة اللعب");
assert.ok(complaint);
complaint.action();
assert.equal(sandbox.state.trust, 46);
assert.equal(sandbox.state.coachRelationship, 36);
assert.equal(sandbox.state.professionalism, 63);
assert.equal(sandbox.state.energy, 78);
assert.equal(sandbox.state.dailyActionUsed, true);

console.log("PASS: actual rest, injury recovery, daily reset, winter pause, weekly wage boundary, coach trust/relationship choices, and once-per-day side-action guard.");
