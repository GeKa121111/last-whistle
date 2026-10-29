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
  "talkCoach",
  "normalizePlayerName",
  "matchCleanSheetContractBonus",
  "performanceAdviceForRole",
  "seasonCareerChallenge",
  "startCareerFromSetup",
  "openTransferMarketPage"
].map(extractFunction).join("\n");
const notices = [];
const logs = [];
const stories = [];
const modalCalls = [];
let saveCount = 0;
let renderCount = 0;
let winterMarketCalls = 0;
let transferMarketNode = { scrollIntoView: (options) => transferScrolls.push(options) };
const startNameNode = {
  value: "",
  validityMessages: [],
  reportCount: 0,
  focusCount: 0,
  scrollOptions: [],
  setCustomValidity: (message) => startNameNode.validityMessages.push(String(message)),
  reportValidity: () => { startNameNode.reportCount++; },
  scrollIntoView: (options) => startNameNode.scrollOptions.push(options),
  focus: () => { startNameNode.focusCount++; }
};
const startScreenNode = { scrollTop: 25 };
const pageCalls = [];
const transferScrolls = [];
const sandbox = {
  state: {},
  isYouthAcademyPlayer: () => false,
  $: (id) => id === "transferMarket" ? transferMarketNode : id === "startName" ? startNameNode : id === "startScreen" ? startScreenNode : null,
  showPage: (...args) => pageCalls.push(args),
  transferWindow: () => ({ name: "الانتقالات الصيفية" }),
  window: { LWAgentRuntime: null },
  toast: (message) => notices.push(String(message)),
  log: (message) => logs.push(String(message)),
  setStory: (title, text) => stories.push({ title, text }),
  saveGame: () => { saveCount++; return true; },
  render: () => { renderCount++; },
  openWinterMarket: () => { winterMarketCalls++; },
  openModal: (title, text, choices) => { modalCalls.push({ title, text, choices }); },
  console: { error: (message) => logs.push(String(message)) }
};
vm.createContext(sandbox);
vm.runInContext(functions, sandbox, { filename: "actual-career-actions" });

assert.equal(typeof sandbox.matchCleanSheetContractBonus, "function",
  "clean-sheet contract bonus helper must be testable");
const bonusState = { cleanSheetBonus: 250 };
assert.equal(sandbox.matchCleanSheetContractBonus(bonusState, { player: { cleanSheet: true } }, false), 250,
  "a player-earned clean sheet must unlock the contracted clean-sheet bonus");
assert.equal(sandbox.matchCleanSheetContractBonus(bonusState, { player: { cleanSheet: false }, score: { against: 0 } }, false), 0,
  "a team clean sheet must not pay a personal bonus to an outfield player who did not earn it");
assert.equal(sandbox.matchCleanSheetContractBonus(bonusState, { player: { cleanSheet: false }, score: { against: 0 } }, true), 0,
  "academy/reserve players marked as unpaid must not receive the clean-sheet bonus");
assert.equal(sandbox.matchCleanSheetContractBonus({ cleanSheetBonus: -20 }, { player: { cleanSheet: true } }, false), 0,
  "negative contract bonus amounts must be clamped to zero");

const defenderAdvice = sandbox.performanceAdviceForRole("قلب دفاع",
  { goals: 0, assists: 0, tackles: 0, interceptions: 0, saves: 0, cleanSheets: 0, keyPasses: 0, shotsOnTarget: 0 },
  6.8, 85, 15);
assert.ok(defenderAdvice.includes("تمركز") && !defenderAdvice.includes("مناطق أخطر"),
  "defenders should receive positioning/tackling advice, not generic attacking advice");
const goalkeeperAdvice = sandbox.performanceAdviceForRole("حارس مرمى",
  { goals: 0, assists: 0, saves: 0, cleanSheets: 0 }, 5.9, 85, 15);
assert.ok(goalkeeperAdvice.includes("حراسة المرمى"),
  "goalkeepers with low ratings should receive goalkeeper-specific advice");
const strikerAdvice = sandbox.performanceAdviceForRole("رأس حربة",
  { goals: 0, assists: 0, shotsOnTarget: 0, keyPasses: 0 }, 6.8, 85, 15);
assert.ok(strikerAdvice.includes("المهاجم") || strikerAdvice.includes("التوقيت"),
  "strikers without attacking contributions should receive forward-specific advice");
const tiredKeeperAdvice = sandbox.performanceAdviceForRole("حارس مرمى",
  { goals: 0, assists: 0, saves: 0, cleanSheets: 0 }, 5.9, 30, 80);
assert.ok(tiredKeeperAdvice.includes("الراحة"),
  "low energy must prioritize recovery over role-specific coaching advice");

const keeperChallenge = sandbox.seasonCareerChallenge({
  pos: "حارس مرمى", season: 3, seasonGoals: 0, seasonAssists: 0,
  careerMatchHistory: [{ season: 3, minutes: 90, stats: { saves: 5, cleanSheet: true } }]
});
assert.equal(keeperChallenge.progress, 10,
  "goalkeeper challenge should count nested saves and a clean sheet");
assert.equal(keeperChallenge.done, true, "goalkeeper challenge should complete on its own defensive objective");
assert.ok(keeperChallenge.description.includes("تحدي الحراسة"),
  "goalkeeper challenge should use a goalkeeper-specific description");
const defenderChallenge = sandbox.seasonCareerChallenge({
  pos: "قلب دفاع", season: 3,
  careerMatchHistory: [{ season: 3, minutes: 90, stats: { tackles: 5, interceptions: 4, cleanSheet: true } }]
});
assert.equal(defenderChallenge.progress, 12,
  "defender challenge should combine tackles, interceptions, and clean-sheet credit");
assert.equal(defenderChallenge.done, true, "defender challenge should not depend on scoring goals");
const creatorChallenge = sandbox.seasonCareerChallenge({
  pos: "وسط مهاجم", season: 3, seasonAssists: 0,
  careerMatchHistory: [{ season: 3, scope: "cup", minutes: 90, goals: 0, assists: 2, stats: { keyPasses: 4 } }]
});
assert.equal(creatorChallenge.progress, 8,
  "attacking midfield challenge should reward key passes and assists");
assert.equal(creatorChallenge.done, true, "creative midfield challenge should reward creation without requiring goals");
const strikerChallenge = sandbox.seasonCareerChallenge({
  pos: "رأس حربة", season: 3, seasonGoals: 0, seasonAssists: 0,
  careerMatchHistory: [{ season: 3, scope: "cup", minutes: 75, goals: 2, assists: 0, stats: {} }]
});
assert.equal(strikerChallenge.progress, 2, "striker challenge should continue to track goals and assists");
assert.equal(strikerChallenge.done, false, "striker challenge should require three attacking contributions");

const priorSeasonChallenge = sandbox.seasonCareerChallenge({
  pos: "رأس حربة", season: 4, seasonGoals: 9, seasonAssists: 9,
  careerMatchHistory: [{ season: 3, scope: "cup", minutes: 90, goals: 4, assists: 1, stats: {} }]
});
assert.equal(priorSeasonChallenge.progress, 0,
  "previous-season goals and assists must not leak into the current season challenge");


// Player setup must normalize names and keep the career from starting when the name is empty.
assert.equal(sandbox.normalizePlayerName("  Mohamed  " + String.fromCharCode(10) + " Ahmed   "), "Mohamed Ahmed",
  "player names must collapse whitespace and trim edges");
assert.equal(sandbox.normalizePlayerName("123456789012345678901234567890").length, 24,
  "player names must respect the 24-character limit");
startNameNode.value = "   ";
startNameNode.validityMessages.length = 0;
startNameNode.reportCount = 0;
startNameNode.focusCount = 0;
startNameNode.scrollOptions.length = 0;
startScreenNode.scrollTop = 25;
notices.length = 0;
sandbox.startCareerFromSetup();
assert.equal(startNameNode.reportCount, 1, "empty player name must trigger browser validation");
assert.equal(startNameNode.focusCount, 1, "empty player name must focus the input");
assert.equal(startScreenNode.scrollTop, 0, "empty player name must scroll setup to the name field");
assert.ok(startNameNode.validityMessages.at(-1).includes("اسم اللاعب"),
  "empty player name must explain how to fix the form");
assert.ok(notices.some(message => message.includes("اسم اللاعب")),
  "empty player name must show a helpful notice");

const makeState = (overrides = {}) => ({
  retired: false, age: 19, academyCareer: false, academyGraduated: true,
  academyGraduationPending: false, academyReserve: false, winterBreakPending: false,
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

// Invalid day counts must not poison the in-game calendar or its counters.
for (const invalidDays of [Infinity, -Infinity, NaN, -3]) {
  sandbox.state = makeState({ day: 7, calendarDay: 7, money: 100, weeklyWage: 250 });
  sandbox.advanceCalendarDays(invalidDays, "invalid day count");
  assert.equal(sandbox.state.calendarDay, 7, "invalid day counts must not change the calendar");
  assert.equal(sandbox.state.day, 7, "invalid day counts must not change the career day");
  assert.equal(sandbox.state.money, 100, "invalid day counts must not pay wages");
}

// Legacy or runtime-corrupted balances and wages must be normalized before payroll.
for (const invalidWage of [Infinity, "Infinity", NaN, -250]) {
  sandbox.state = makeState({ day: 7, calendarDay: 7, money: 100, weeklyWage: invalidWage });
  sandbox.advanceCalendarDays(1, "invalid wage");
  assert.equal(sandbox.state.weeklyWage, 0, "invalid wages must be normalized to zero");
  assert.equal(sandbox.state.money, 100, "invalid wages must not create money");
  assert.ok(Number.isFinite(sandbox.state.money), "invalid wages must leave a finite balance");
}
for (const invalidBalance of [Infinity, "Infinity", NaN, -250]) {
  sandbox.state = makeState({ day: 7, calendarDay: 7, money: invalidBalance, weeklyWage: 250 });
  sandbox.advanceCalendarDays(1, "invalid balance");
  assert.equal(sandbox.state.money, 250, "a corrupted balance must normalize before a valid wage is credited");
  assert.ok(Number.isFinite(sandbox.state.money), "payroll must leave a finite balance");
}

// Large but finite values must be capped rather than overflowing money or agent ledgers.
logs.length = 0;
sandbox.window.LWAgentRuntime = { commissionRate: () => 0.14, dailyRecoveryBonus: () => 0 };
sandbox.state = makeState({
  day: 7, calendarDay: 7, money: Number.MAX_SAFE_INTEGER - 10,
  weeklyWage: Number.MAX_SAFE_INTEGER, agentCommissionPaid: Number.MAX_SAFE_INTEGER - 1
});
sandbox.advanceCalendarDays(14, "large finite wage");
assert.equal(sandbox.state.money, Number.MAX_SAFE_INTEGER, "wallet balance must cap at the safe integer limit");
assert.equal(sandbox.state.agentCommissionPaid, Number.MAX_SAFE_INTEGER, "agent commission ledger must cap at the safe integer limit");
assert.ok(Number.isFinite(sandbox.state.money) && Number.isFinite(sandbox.state.agentCommissionPaid),
  "large payroll calculations must remain finite");
assert.ok(logs.every(message => !/NaN|Infinity/.test(message)), "payroll logs must not contain invalid numeric values");
sandbox.window.LWAgentRuntime = null;

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

// Transfer-market navigation must land on the real contract page and scroll to its market container.
notices.length = 0; pageCalls.length = 0; transferScrolls.length = 0; saveCount = 0;
transferMarketNode = { scrollIntoView: (options) => transferScrolls.push(options) };
sandbox.state = makeState({ careerStarted: true, retired: false, journeyTransferReviewed: false });
assert.equal(sandbox.openTransferMarketPage(), true, "eligible career should open the transfer market");
assert.equal(sandbox.state.journeyTransferReviewed, true, "opening the market should record review state");
assert.deepEqual(pageCalls, [["contract", false]], "transfer market must route to the contract screen without resetting scroll before the market");
assert.equal(transferScrolls.length, 1, "market container should be brought into view");
assert.equal(saveCount, 1, "opening the market should persist the review state");
assert.ok(notices.some(message => message.includes("فتحت سوق الانتقالات")), "market opening should explain the successful route");

// A missing market target or retired/new career must fail safely without navigating to a dead screen.
transferMarketNode = null;
notices.length = 0; saveCount = 0;
const routesBeforeMissingMarket = pageCalls.length;
sandbox.state = makeState({ careerStarted: true, retired: false });
assert.equal(sandbox.openTransferMarketPage(), false, "missing market DOM must be rejected");
assert.equal(pageCalls.length, routesBeforeMissingMarket, "missing market must not navigate");
assert.equal(saveCount, 0, "missing market must not save a false review");
assert.ok(notices.some(message => message.includes("صفحة السوق غير متاحة")), "missing market must produce a useful explanation");

transferMarketNode = { scrollIntoView: () => {} };
notices.length = 0; saveCount = 0;
sandbox.state = makeState({ careerStarted: false, retired: false });
assert.equal(sandbox.openTransferMarketPage(), false, "new career without a player must not open transfers");
sandbox.state = makeState({ careerStarted: true, retired: true });
assert.equal(sandbox.openTransferMarketPage(), false, "retired career must not reopen transfers");

console.log("PASS: rest/recovery, daily reset, winter pause, weekly wages, coach actions, and transfer-market navigation guards.");
