"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const publicHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
assert.equal(html, publicHtml, "root and public app shells must remain synchronized");

function extractFunction(source, name) {
  const marker = "function " + name + "(";
  const start = source.indexOf(marker);
  assert.ok(start >= 0, "missing function: " + name);
  const brace = source.indexOf("{", start);
  let depth = 0, quote = null, escaped = false, lineComment = false, blockComment = false;
  for (let i = brace; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (lineComment) { if (c.charCodeAt(0) === 10) lineComment = false; continue; }
    if (blockComment) { if (c === "*" && n === "/") { blockComment = false; i++; } continue; }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c.charCodeAt(0) === 92) { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "/" && n === "/") { lineComment = true; i++; continue; }
    if (c === "/" && n === "*") { blockComment = true; i++; continue; }
    if (c === "'" || c === '"' || c === "`") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error("unterminated function: " + name);
}

const extracted = [
  extractFunction(html, "cloneSeasonTransitionState"),
  extractFunction(html, "restoreSeasonTransitionState"),
  extractFunction(html, "applyMatchResultUnsafe"),
  extractFunction(html, "applyMatchResult")
];
assert.ok(extracted[2].includes("recordedMatchIds.push(id)"),
  "the real settlement implementation must retain its idempotency guard");
assert.ok(extracted[3].includes("cloneSeasonTransitionState(state)"),
  "the public settlement path must snapshot the career before applying a result");
assert.ok(extracted[3].includes("restoreSeasonTransitionState(snapshot)"),
  "the public settlement path must roll back a partial settlement");

const initialState = {
  recordedMatchIds: [], suspensions: {}, bookings: {}, leagueCountry: "مصر",
  leagueCompetition: "الدوري الممتاز", season: 3, leagueSegmentId: "segment-3",
  day: 5, calendarDay: 5, clubName: "نادي الاختبار", role: "أساسي",
  nationalCaps: 0, nationalGoals: 0, totalCareerAppearances: 0,
  apps: 0, goals: 0, assists: 0, seasonGoals: 0, seasonAssists: 0,
  competitionStats: {}, lastRating: 6, averageRatingSum: 6, averageRatingCount: 1,
  leagueRatingSum: 6, leagueRatingCount: 1, energy: 90, fatigue: 0,
  morale: 50, trust: 60, money: 1000, agent: null,
  goalBonusPerGoal: 0, cleanSheetBonus: 0, sponsorContract: null,
  seasonW: 0, seasonD: 0, seasonL: 0, seasonPoints: 0, playedToday: false,
  careerMatchHistory: [], seasonLog: [], internationalHistory: [], cupMatchHistory: [],
  creatorStudio: false, sportsPsych: false, injuryDays: 0, injuryName: "",
  academyReserve: false, academyGraduationPending: false, careerLevel: 1,
  logs: [], calendarEvents: []
};
const events = { toasts: [], renders: 0, saves: 0, failCalendar: true };
let sandbox;
sandbox = {
  state: JSON.parse(JSON.stringify(initialState)),
  window: {
    LWMatch: { validateResult: () => ({ ok: true }) },
    LWCareer: { matchDevelopment: () => ({}) }
  },
  console: { error: () => {}, warn: () => {} },
  toast: message => events.toasts.push(String(message)),
  log: message => sandbox.state.logs.push(String(message)),
  render: () => { events.renders++; },
  saveGame: silent => { assert.equal(silent, true); events.saves++; },
  careerMatchPlayerEligible: () => true,
  disciplineKey: (...parts) => parts.join("|"),
  clamp: value => Math.max(0, Math.min(100, Math.round(Number(value) || 0))),
  matchOutcomeForCareerRecord: (result, meta = {}) =>
    String(meta.outcome || result?.matchOutcome || result?.outcome || "تعادل"),
  matchCleanSheetContractBonus: () => 0,
  isYouthAcademyPlayer: () => false,
  currencyLabel: () => "جنيه",
  calendarEvent: () => {
    if (events.failCalendar) throw new Error("synthetic calendar sink failure");
    sandbox.state.calendarEvents.push("match-calendar-event");
  },
  club: () => ({ name: "نادي الاختبار" }),
  SKILL_AR: {}
};

const harness = extracted.join(String.fromCharCode(10)) + String.fromCharCode(10) + "globalThis.settleMatch = applyMatchResult;";
vm.createContext(sandbox);
vm.runInContext(harness, sandbox, { filename: "match-result-transaction-harness.js" });

const result = {
  player: {
    minutes: 90, goals: 1, assists: 0, rating: 8, shots: 3, shotsOnTarget: 2,
    chances: 2, keyPasses: 1, tackles: 1, tacklesWon: 1, interceptions: 0,
    saves: 0, cleanSheet: false, yellowCards: 0, redCards: 0, injuryDays: 0,
    penaltiesSaved: 0, clearances: 0, ballRecoveries: 0, passAttempts: 20,
    passesCompleted: 17, passingAccuracy: 85
  },
  score: { for: 2, against: 1 }, events: [], extraTime: false, shootout: null,
  outcome: "فوز", tactic: "balanced", home: true, opponentName: "خصم الاختبار"
};
const meta = {
  id: "league-season-3-round-1", scope: "league", country: "مصر",
  competition: "الدوري الممتاز", teamName: "نادي الاختبار",
  opponent: "خصم الاختبار", tactic: "balanced", home: true,
  matchday: 1, suspendedAtKickoff: false
};

const beforeFailure = JSON.stringify(sandbox.state);
const failedSettlement = sandbox.settleMatch(result, meta);
assert.equal(failedSettlement, false, "a failed downstream settlement side effect must not be accepted");
assert.equal(JSON.stringify(sandbox.state), beforeFailure,
  "a failed settlement must restore every career field, history row, stat and recorded match id");
assert.equal(events.renders, 1, "a rolled-back settlement must refresh the visible career state");
assert.equal(events.saves, 1, "a rolled-back settlement must queue the restored save");
assert.ok(events.toasts.length > 0, "the player must be told that the result was not committed");

events.failCalendar = false;
const committed = sandbox.settleMatch(result, meta);
assert.ok(committed && committed.record, "a valid match must still settle after a failed attempt");
assert.deepEqual(Array.from(sandbox.state.recordedMatchIds), [meta.id]);
assert.equal(sandbox.state.apps, 1);
assert.equal(sandbox.state.goals, 1);
assert.equal(sandbox.state.seasonW, 1);
assert.equal(sandbox.state.seasonPoints, 3);
assert.equal(sandbox.state.careerMatchHistory.length, 1);
assert.equal(sandbox.state.seasonLog.length, 1);
assert.equal(sandbox.state.calendarEvents.length, 1);

const afterCommit = JSON.stringify(sandbox.state);
assert.equal(sandbox.settleMatch(result, meta), false, "the same match id must remain idempotent");
assert.equal(JSON.stringify(sandbox.state), afterCommit,
  "a duplicate settlement must not increment stats or append another history row");

console.log("PASS: match settlement is atomic on failure and remains idempotent on success.");
