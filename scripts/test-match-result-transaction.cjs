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
  extractFunction(html, "applyMatchResult"),
  extractFunction(html, "allCareerMatchRowsForHistory"),
  extractFunction(html, "currentSeasonMatchRows"),
  extractFunction(html, "playerCurrentSeasonStats")
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
    LWCareer: {
      matchDevelopment: () => ({}),
      uniqueMatchRows: rows => {
        const seen = new Set();
        return rows.filter(row => {
          const id = String(row && (row.id ?? row.matchId) || "");
          if (!id) return true;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
      }
    }
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

const harness = extracted.join(String.fromCharCode(10)) + String.fromCharCode(10)
  + "globalThis.settleMatch = applyMatchResult; globalThis.playerCurrentSeasonStats = playerCurrentSeasonStats; globalThis.currentSeasonMatchRows = currentSeasonMatchRows;";
vm.createContext(sandbox);
vm.runInContext(harness, sandbox, { filename: "match-result-transaction-harness.js" });

const result = {
  player: {
    minutes: 90, goals: 1, assists: 0, rating: 8, shots: 3, shotsOnTarget: 2,
    chances: 2, keyPasses: 2, tackles: 5, tacklesWon: 4, interceptions: 3,
    saves: 6, cleanSheet: false, yellowCards: 1, redCards: 0, injuryDays: 0,
    penaltiesSaved: 1, clearances: 7, ballRecoveries: 8, passAttempts: 31,
    passesCompleted: 27, passingAccuracy: 87, fouls: 2
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
assert.deepEqual({
  tackles: committed.record.stats.tackles,
  tacklesWon: committed.record.stats.tacklesWon,
  interceptions: committed.record.stats.interceptions,
  saves: committed.record.stats.saves,
  penaltiesSaved: committed.record.stats.penaltiesSaved,
  clearances: committed.record.stats.clearances,
  ballRecoveries: committed.record.stats.ballRecoveries,
  keyPasses: committed.record.stats.keyPasses,
  passAttempts: committed.record.stats.passAttempts,
  passesCompleted: committed.record.stats.passesCompleted,
  passingAccuracy: committed.record.stats.passingAccuracy,
  fouls: committed.record.stats.fouls
}, {
  tackles: 5, tacklesWon: 4, interceptions: 3, saves: 6, penaltiesSaved: 1,
  clearances: 7, ballRecoveries: 8, keyPasses: 2, passAttempts: 31,
  passesCompleted: 27, passingAccuracy: 87, fouls: 2
}, "match settlement must persist the complete player-stat ledger needed by season awards");
const seasonStats = sandbox.playerCurrentSeasonStats([committed.record]);
assert.deepEqual({
  appearances: seasonStats.appearances, goals: seasonStats.goals, assists: seasonStats.assists,
  averageRating: seasonStats.averageRating, saves: seasonStats.saves,
  penaltiesSaved: seasonStats.penaltiesSaved, tacklesWon: seasonStats.tacklesWon,
  interceptions: seasonStats.interceptions, clearances: seasonStats.clearances,
  ballRecoveries: seasonStats.ballRecoveries, keyPasses: seasonStats.keyPasses
}, {
  appearances: 1, goals: 1, assists: 0, averageRating: 8, saves: 6,
  penaltiesSaved: 1, tacklesWon: 4, interceptions: 3, clearances: 7,
  ballRecoveries: 8, keyPasses: 2
}, "season award aggregation must recover defensive and goalkeeper actions from persisted match history");

const mixedLegacyAndCurrentStats = sandbox.playerCurrentSeasonStats([
  { minutes: 90, goals: 0, assists: 0, rating: 7, stats: { tackles: 5 } },
  { minutes: 90, goals: 0, assists: 0, rating: 7, stats: { tackles: 8, tacklesWon: 3 } },
  { minutes: 90, goals: 0, assists: 0, rating: 7, stats: { tackles: 4, tacklesWon: 0 } },
  { minutes: 90, goals: 0, assists: 0, rating: 7, tackles: 2 }
]);
assert.equal(mixedLegacyAndCurrentStats.tacklesWon, 10,
  "mixed legacy/current history must fall back per match and respect an explicit modern zero");

const afterCommit = JSON.stringify(sandbox.state);
assert.equal(sandbox.settleMatch(result, meta), false, "the same match id must remain idempotent");
assert.equal(JSON.stringify(sandbox.state), afterCommit,
  "a duplicate settlement must not increment stats or append another history row");

sandbox.state.seasonLog = [
  { id: "legacy-only-3", season: 3, day: 4, minutes: 90, goals: 1, assists: 0, rating: 8, club: "نادي الاختبار", opponent: "خصم قديم" },
  { id: "legacy-duplicate-3", season: 3, day: 5, minutes: 75, goals: 0, assists: 1, rating: 7, club: "نادي الاختبار", opponent: "خصم مكرر" },
  { id: "legacy-no-season-3", day: 6, minutes: 60, goals: 1, assists: 0, rating: 7.5, club: "نادي الاختبار", opponent: "خصم بلا موسم" }
];
sandbox.state.careerMatchHistory = [
  { id: "legacy-duplicate-3", season: 3, day: 5, scope: "league", minutes: 75, goals: 0, assists: 1, rating: 7, club: "نادي الاختبار", opponent: "خصم مكرر" },
  { id: "cup-match-3", season: 3, day: 7, scope: "cup", minutes: 30, goals: 0, assists: 1, rating: 7, club: "نادي الاختبار", opponent: "خصم الكأس" },
  { id: "international-match-3", season: 3, day: 8, scope: "international", minutes: 90, goals: 1, assists: 0, rating: 8 },
  { id: "prior-season-match", season: 2, day: 9, scope: "league", minutes: 90, goals: 1, assists: 0, rating: 8 },
  { id: "unknown-career-season", day: 10, scope: "league", minutes: 90, goals: 1, assists: 0, rating: 8 }
];
const currentSeasonRows = sandbox.currentSeasonMatchRows();
assert.deepEqual(Array.from(currentSeasonRows, row => row.id),
  ["legacy-only-3", "legacy-duplicate-3", "legacy-no-season-3", "cup-match-3"],
  "current-season stats must infer the season only for legacy seasonLog rows, deduplicate overlaps, and exclude international/older/unknown career rows");
assert.equal(currentSeasonRows.find(row => row.id === "legacy-no-season-3").season, 3,
  "a legacy seasonLog row without an explicit season must inherit the active season");
assert.equal(currentSeasonRows.some(row => row.id === "unknown-career-season"), false,
  "a career-history row with no season must not be assigned to the current season");
assert.deepEqual(Array.from(sandbox.currentSeasonMatchRows(row => row.scope === "league"), row => row.id),
  ["legacy-only-3", "legacy-duplicate-3", "legacy-no-season-3"],
  "competition filters must work over the unified legacy/current match history");

console.log("PASS: match settlement is atomic, season stats preserve legacy history, and duplicate settlement remains idempotent.");
