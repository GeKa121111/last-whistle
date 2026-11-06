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

const applyMatchResultUnsafeSource = extractFunction(html, "applyMatchResultUnsafe");
const applyMatchResultSource = extractFunction(html, "applyMatchResult");
const extracted = [
  extractFunction(html, "cloneSeasonTransitionState"),
  extractFunction(html, "restoreSeasonTransitionState"),
  extractFunction(html, "persistRollbackSnapshot"),
  extractFunction(html, "ensureLeagueSegmentId"),
  applyMatchResultUnsafeSource,
  applyMatchResultSource,
  extractFunction(html, "allCareerMatchRowsForHistory"),
  extractFunction(html, "currentSeasonMatchRows"),
  extractFunction(html, "archiveLeagueSegment"),
  extractFunction(html, "playerCurrentSeasonStats")
];
assert.ok(applyMatchResultUnsafeSource.includes("recordedMatchIds.push(id)"),
  "the real settlement implementation must retain its idempotency guard");
assert.ok(applyMatchResultUnsafeSource.includes("state.careerMatchHistory,state.seasonLog,state.cupMatchHistory,state.internationalHistory"),
  "legacy match history must participate in the idempotency guard when the newer ledger is absent");
assert.ok(applyMatchResultSource.includes("cloneSeasonTransitionState(state)"),
  "the public settlement path must snapshot the career before applying a result");
assert.ok(applyMatchResultSource.includes("restoreSeasonTransitionState(snapshot)"),
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
const events = { toasts: [], renders: 0, saves: 0, failCalendar: true, storyReports: [] };
let sandbox;
sandbox = {
  state: JSON.parse(JSON.stringify(initialState)),
  window: {
    LWMatch: { validateResult: () => ({ ok: true }) },
    LWStoryContext: {
      acceptMatchReport(report, options) {
        assert.equal(options && options.deferSave, true,
          "match reports must join the already-open match persistence transaction");
        events.storyReports.push(JSON.parse(JSON.stringify(report)));
        const summary = {
          outcome: report.score.for > report.score.against ? "win" : report.score.for < report.score.against ? "loss" : "draw",
          score: report.score, minutes: report.player.minutes, rating: report.player.rating,
          goals: report.player.goals, assists: report.player.assists, key: report.matchId
        };
        sandbox.state.lastStoryMatchKey = report.matchId;
        sandbox.state.lastMatchReport = summary;
        sandbox.state.matchNarrativeLedger = Array.isArray(sandbox.state.matchNarrativeLedger) ? sandbox.state.matchNarrativeLedger : [];
        sandbox.state.matchNarrativeLedger.unshift({ key: report.matchId, summary });
        sandbox.state.inbox = Array.isArray(sandbox.state.inbox) ? sandbox.state.inbox : [];
        sandbox.state.inbox.unshift({ id: "match-report-" + report.matchId });
        return { ok: true, summary };
      }
    },
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
  flushQueuedSave: () => Promise.resolve(true),
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
  clubNameForLeague: () => "نادي الاختبار",
  structuredCloneSafe: value => JSON.parse(JSON.stringify(value)),
  SKILL_AR: {}
};

const harness = extracted.join(String.fromCharCode(10)) + String.fromCharCode(10)
  + "globalThis.settleMatch = applyMatchResult; globalThis.playerCurrentSeasonStats = playerCurrentSeasonStats; globalThis.currentSeasonMatchRows = currentSeasonMatchRows; globalThis.archiveLeagueSegment = archiveLeagueSegment;";
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
assert.equal(sandbox.state.lastStoryMatchKey, undefined,
  "a failed match must also roll back its linked story report key");
assert.equal(sandbox.state.matchNarrativeLedger, undefined,
  "a failed match must not leave a narrative ledger entry behind");
assert.equal(sandbox.state.inbox, undefined,
  "a failed match must not leave a match-report inbox item behind");
assert.equal(events.storyReports.length, 1,
  "the failed attempt should have entered the outer transaction exactly once before rollback");
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
assert.equal(events.storyReports.length, 2,
  "a committed player match must publish one story report inside the same settlement");
const storyReport = events.storyReports[1];
assert.equal(storyReport.matchId, meta.id);
assert.equal(storyReport.competitionId, "league|مصر|الدوري الممتاز");
assert.equal(storyReport.matchType, "league");
assert.deepEqual(storyReport.score, { for: 2, against: 1 });
assert.deepEqual({
  minutes: storyReport.player.minutes, rating: storyReport.player.rating,
  goals: storyReport.player.goals, assists: storyReport.player.assists,
  tackles: storyReport.player.tackles, interceptions: storyReport.player.interceptions,
  saves: storyReport.player.saves, cleanSheet: storyReport.player.cleanSheet
}, {
  minutes: 90, rating: 8, goals: 1, assists: 0,
  tackles: 5, interceptions: 3, saves: 6, cleanSheet: false
});
assert.equal(sandbox.state.lastStoryMatchKey, meta.id);
assert.equal(sandbox.state.matchNarrativeLedger.length, 1);
assert.equal(sandbox.state.inbox[0].id, "match-report-" + meta.id);
assert.equal(events.saves, 1,
  "story report handling must not start a second save outside the match transaction");
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
const storyReportCountBeforeDuplicate = events.storyReports.length;
assert.equal(sandbox.settleMatch(result, meta), false, "the same match id must remain idempotent");
assert.equal(events.storyReports.length, storyReportCountBeforeDuplicate,
  "duplicate match settlement must not publish a second story report");
assert.equal(JSON.stringify(sandbox.state), afterCommit,
  "a duplicate settlement must not increment stats or append another history row");

const legacyReplayStats = () => JSON.stringify({
  apps: sandbox.state.apps, goals: sandbox.state.goals, assists: sandbox.state.assists,
  totalCareerAppearances: sandbox.state.totalCareerAppearances,
  seasonW: sandbox.state.seasonW, seasonD: sandbox.state.seasonD, seasonL: sandbox.state.seasonL,
  seasonPoints: sandbox.state.seasonPoints, money: sandbox.state.money,
  careerRows: sandbox.state.careerMatchHistory.length, seasonRows: sandbox.state.seasonLog.length
});
delete sandbox.state.recordedMatchIds;
const beforeLegacyHistoryReplay = legacyReplayStats();
assert.equal(sandbox.settleMatch(result, meta), false,
  "a match already present in legacy career history must not be settled again when recordedMatchIds is missing");
assert.deepEqual(Array.from(sandbox.state.recordedMatchIds), [meta.id],
  "a legacy history duplicate should repopulate the idempotency ledger");
assert.equal(legacyReplayStats(), beforeLegacyHistoryReplay,
  "history-based duplicate detection must not alter player stats, money, or history rows");

sandbox.state.recordedMatchIds = [];
sandbox.state.careerMatchHistory = [];
sandbox.state.seasonLog = [{ matchId: meta.id }];
const beforeSeasonLogReplay = legacyReplayStats();
assert.equal(sandbox.settleMatch(result, meta), false,
  "a legacy seasonLog matchId must also block duplicate settlement when careerMatchHistory is unavailable");
assert.deepEqual(Array.from(sandbox.state.recordedMatchIds), [meta.id]);
assert.equal(legacyReplayStats(), beforeSeasonLogReplay,
  "seasonLog fallback detection must not change any match statistics");

sandbox.state = JSON.parse(JSON.stringify(initialState));
delete sandbox.state.recordedMatchIds;
const firstLegacySaveMeta = { ...meta, id: "legacy-save-first-match" };
const firstLegacySaveSettlement = sandbox.settleMatch(result, firstLegacySaveMeta);
assert.ok(firstLegacySaveSettlement && firstLegacySaveSettlement.record,
  "a legacy save without recordedMatchIds must still accept its first valid match");
assert.deepEqual(Array.from(sandbox.state.recordedMatchIds), [firstLegacySaveMeta.id],
  "the first legacy-save settlement must initialize and populate the idempotency ledger");
assert.equal(sandbox.state.apps, 1,
  "the first match in a legacy save must not be rejected solely because its ledger was absent");

sandbox.state.seasonLog = [
  { id: "legacy-only-3", season: 3, day: 4, minutes: 90, goals: 1, assists: 0, rating: 8, club: "نادي الاختبار", opponent: "خصم قديم" },
  { id: "legacy-duplicate-3", season: 3, day: 5, minutes: 75, goals: 0, assists: 1, rating: 7, club: "نادي الاختبار", opponent: "خصم مكرر" },
  { id: "legacy-no-season-3", day: 6, minutes: 60, goals: 1, assists: 0, rating: 7.5, club: "نادي الاختبار", opponent: "خصم بلا موسم" }
];
sandbox.state.leagueArchives = [
  { season: 3, segmentId: "archived-segment-3" },
  { season: 2, segmentId: "prior-segment-2" }
];
sandbox.state.leagueSegmentId = "active-segment-3";
sandbox.state.careerMatchHistory = [
  { id: "legacy-duplicate-3", season: 3, day: 5, scope: "league", minutes: 75, goals: 0, assists: 1, rating: 7, club: "نادي الاختبار", opponent: "خصم مكرر" },
  { id: "archived-career-3", segmentId: "archived-segment-3", day: 6, scope: "league", minutes: 90, goals: 1, assists: 0, rating: 8, club: "نادي الاختبار", opponent: "خصم مؤرشف" },
  { id: "active-career-3", segmentId: "active-segment-3", day: 6, scope: "league", minutes: 90, goals: 1, assists: 0, rating: 8, club: "نادي الاختبار", opponent: "خصم حالي" },
  { id: "cup-match-3", season: 3, day: 7, scope: "cup", minutes: 30, goals: 0, assists: 1, rating: 7, club: "نادي الاختبار", opponent: "خصم الكأس" },
  { id: "international-match-3", season: 3, day: 8, scope: "international", minutes: 90, goals: 1, assists: 0, rating: 8 },
  { id: "prior-season-match", season: 2, day: 9, scope: "league", minutes: 90, goals: 1, assists: 0, rating: 8 },
  { id: "prior-segment-no-season", segmentId: "prior-segment-2", day: 9, scope: "league", minutes: 90, goals: 1, assists: 0, rating: 8 },
  { id: "wrong-season-current-segment", season: 2, segmentId: "active-segment-3", day: 9, scope: "league", minutes: 90, goals: 1, assists: 0, rating: 8 },
  { id: "unknown-career-season", day: 10, scope: "league", minutes: 90, goals: 1, assists: 0, rating: 8 }
];
const currentSeasonRows = sandbox.currentSeasonMatchRows();
assert.deepEqual(Array.from(currentSeasonRows, row => row.id),
  ["legacy-only-3", "legacy-duplicate-3", "legacy-no-season-3", "archived-career-3", "active-career-3", "cup-match-3"],
  "current-season stats must infer the season only for legacy seasonLog rows, deduplicate overlaps, and exclude international/older/unknown career rows");
assert.equal(currentSeasonRows.find(row => row.id === "legacy-no-season-3").season, 3,
  "a legacy seasonLog row without an explicit season must inherit the active season");
assert.equal(currentSeasonRows.find(row => row.id === "archived-career-3").season, 3,
  "a season-less career row must inherit the season from its archived segment");
assert.equal(currentSeasonRows.find(row => row.id === "active-career-3").season, 3,
  "a season-less career row must inherit the season from the active segment");
assert.equal(currentSeasonRows.some(row => row.id === "prior-segment-no-season"), false,
  "a season-less career row from an archived prior-season segment must stay excluded");
assert.equal(currentSeasonRows.some(row => row.id === "wrong-season-current-segment"), false,
  "an explicit prior season must override a matching current segment id");
assert.equal(currentSeasonRows.some(row => row.id === "unknown-career-season"), false,
  "a career-history row with no season must not be assigned to the current season");
assert.deepEqual(Array.from(sandbox.currentSeasonMatchRows(row => row.scope === "league"), row => row.id),
  ["legacy-only-3", "legacy-duplicate-3", "legacy-no-season-3", "archived-career-3", "active-career-3"],
  "competition filters must work over the unified legacy/current match history");
const transferStatsState = {
  ...initialState, season: 3, leagueSegmentId: "new-active-segment",
  leagueArchives: [
    { season: 3, segmentId: "old-club-segment" },
    { season: 3, segmentId: "new-club-segment" },
    { season: 2, segmentId: "previous-season-segment" }
  ],
  seasonLog: [{
    id: "transfer-old-club-match", season: 3, segmentId: "old-club-segment",
    scope: "league", club: "Old FC", minutes: 90, goals: 1, assists: 0, rating: 8
  }],
  careerMatchHistory: [
    { id: "transfer-old-club-match", season: 3, segmentId: "old-club-segment", scope: "league", club: "Old FC", minutes: 90, goals: 1, assists: 0, rating: 8 },
    { id: "transfer-new-club-match", season: 3, segmentId: "new-club-segment", scope: "league", club: "New FC", minutes: "90", goals: "2", assists: "1", rating: "7.5" },
    { id: "transfer-old-club-legacy-segment", segmentId: "old-club-segment", scope: "league", club: "Old FC", minutes: 45, goals: 0, assists: 1, rating: 7 },
    { id: "transfer-new-club-active-segment", segmentId: "new-active-segment", scope: "league", club: "New FC", minutes: 30, goals: 0, assists: 0, rating: 6.5 },
    { id: "transfer-new-club-season-label", season: "2026/27", segmentId: "new-active-segment", scope: "league", club: "New FC", minutes: 15, goals: 0, assists: 0, rating: 7 },
    { id: "transfer-invalid-infinite-minutes", season: 3, segmentId: "new-active-segment", minutes: Infinity, goals: 9 },
    { id: "transfer-invalid-array-minutes", season: 3, segmentId: "new-active-segment", minutes: [90], goals: 9 },
    { id: "transfer-invalid-string-minutes", season: 3, segmentId: "new-active-segment", minutes: "Infinity", goals: 9 },
    { id: "transfer-invalid-object-minutes", season: 3, segmentId: "new-active-segment", minutes: { value: 90 }, goals: 9 },
    { id: "transfer-prior-season", season: 2, segmentId: "new-active-segment", minutes: 90, goals: 9 },
    { id: "transfer-international", season: 3, scope: "international", minutes: 90, goals: 9 }
  ]
};
sandbox.state = transferStatsState;
const transferSeasonRows = sandbox.currentSeasonMatchRows();
assert.deepEqual(Array.from(transferSeasonRows, row => row.id), [
  "transfer-old-club-match", "transfer-new-club-match", "transfer-old-club-legacy-segment",
  "transfer-new-club-active-segment", "transfer-new-club-season-label"
], "current-season stats must retain both clubs' appearances after a mid-season transfer while rejecting malformed minutes");
const transferSeasonStats = sandbox.playerCurrentSeasonStats(transferSeasonRows);
assert.deepEqual({
  appearances: transferSeasonStats.appearances, minutes: transferSeasonStats.minutes,
  goals: transferSeasonStats.goals, assists: transferSeasonStats.assists,
  averageRating: transferSeasonStats.averageRating
}, { appearances: 5, minutes: 270, goals: 3, assists: 2, averageRating: 7.2 },
"a mid-season transfer must preserve the combined season ledger without counting the duplicated fixture twice");
assert.equal(transferSeasonRows.some(row => String(row.id).includes("invalid-")), false,
  "current-season rows must reject Infinity, arrays, and object-shaped minute values");
const malformedSeasonStats = sandbox.playerCurrentSeasonStats([
  { minutes: 90, goals: Infinity, assists: [2], rating: Infinity, stats: { saves: Infinity, tacklesWon: [] } },
  { minutes: [90], goals: 5, assists: 5, rating: 9, stats: { saves: 8 } },
  { minutes: "Infinity", goals: 5, assists: 5, rating: 9, stats: { saves: 8 } },
  { minutes: "90", goals: "2", assists: "1", rating: "8", stats: { saves: "3", tacklesWon: "4", clearances: "5" } }
]);
assert.deepEqual({
  appearances: malformedSeasonStats.appearances, minutes: malformedSeasonStats.minutes,
  goals: malformedSeasonStats.goals, assists: malformedSeasonStats.assists,
  averageRating: malformedSeasonStats.averageRating, saves: malformedSeasonStats.saves,
  tacklesWon: malformedSeasonStats.tacklesWon, clearances: malformedSeasonStats.clearances
}, { appearances: 2, minutes: 180, goals: 2, assists: 1, averageRating: 8, saves: 3, tacklesWon: 4, clearances: 5 },
"season aggregation must ignore malformed metric values and accept valid numeric-string legacy stats");

const numericSegmentState = {
  ...initialState, season: 3, leagueSegmentId: 302,
  leagueArchives: [{ season: 3, segmentId: 301 }],
  seasonLog: [],
  careerMatchHistory: [
    { id: "numeric-archive-segment", segmentId: 301, scope: "league", minutes: 90 },
    { id: "numeric-active-segment", segmentId: 302, scope: "league", minutes: 45 },
    { id: "numeric-string-archive-segment", segmentId: "301", scope: "league", minutes: 30 },
    { id: "numeric-prior-segment", segmentId: 300, scope: "league", minutes: 90 },
    { id: "numeric-object-segment", segmentId: { value: 301 }, scope: "league", minutes: 90 }
  ]
};
sandbox.state = numericSegmentState;
assert.deepEqual(Array.from(sandbox.currentSeasonMatchRows(), row => row.id), [
  "numeric-archive-segment", "numeric-active-segment", "numeric-string-archive-segment"
], "legacy numeric segment IDs must remain compatible with string IDs without coercing objects");

sandbox.state = {
  ...initialState, season: 3.5, leagueSegmentId: "fractional-active-segment",
  leagueArchives: [{ season: 3, segmentId: "fractional-archive-segment" }],
  seasonLog: [],
  careerMatchHistory: [
    { id: "fractional-season-rounded-down", season: 3, segmentId: "fractional-active-segment", minutes: 90, scope: "league" },
    { id: "fractional-season-malformed", season: 3.5, segmentId: "fractional-active-segment", minutes: 90, scope: "league" },
    { id: "fractional-active-segment-without-season", segmentId: "fractional-active-segment", minutes: 90, scope: "league" },
    { id: "fractional-archive-row", segmentId: "fractional-archive-segment", minutes: 90, scope: "league" }
  ]
};
assert.deepEqual(Array.from(sandbox.currentSeasonMatchRows(), row => row.id), [],
  "a fractional saved season must not be rounded down or trust its active segment for seasonless rows");

const missingSeasonState = {
  ...initialState, leagueSegmentId: "missing-season-active-segment",
  leagueArchives: [], seasonLog: [],
  careerMatchHistory: [{ id: "legacy-active-without-state-season", segmentId: "missing-season-active-segment", minutes: 90, scope: "league" }]
};
delete missingSeasonState.season;
sandbox.state = missingSeasonState;
assert.deepEqual(Array.from(sandbox.currentSeasonMatchRows(), row => row.id), ["legacy-active-without-state-season"],
  "a genuinely missing season field must retain legacy active-segment inference");


events.failCalendar = false;
const segmentStartState = JSON.parse(JSON.stringify(initialState));
segmentStartState.leagueSegmentId = "";
segmentStartState.leagueArchiveSequence = 0;
segmentStartState.recordedMatchIds = [];
segmentStartState.careerMatchHistory = [];
segmentStartState.seasonLog = [];
sandbox.state = segmentStartState;

const firstSegmentCommit = sandbox.settleMatch(result, { ...meta, id: "first-match-after-segment-reset" });
assert.ok(firstSegmentCommit && firstSegmentCommit.record,
  "the first league match after a season/club transition must still commit");
const firstSegmentId = sandbox.state.leagueSegmentId;
assert.ok(firstSegmentId && firstSegmentCommit.record.segmentId === firstSegmentId,
  "league settlement must create and persist a segment ID before writing the match row");
assert.equal(sandbox.state.leagueArchiveSequence, 1,
  "the first match must allocate exactly one league segment sequence");

sandbox.state.leagueSegmentId = "";
const secondSegmentCommit = sandbox.settleMatch(result, { ...meta, id: "first-match-after-return-to-club" });
assert.ok(secondSegmentCommit && secondSegmentCommit.record,
  "a later league phase at the same club must still commit");
const secondSegmentId = sandbox.state.leagueSegmentId;
assert.notEqual(secondSegmentId, firstSegmentId,
  "returning to the same club in the same season must start a distinct archived segment");
assert.equal(secondSegmentCommit.record.segmentId, secondSegmentId,
  "the returned club's match must be tagged with the new segment, not the earlier one");
assert.equal(sandbox.state.leagueArchiveSequence, 2,
  "a second phase must advance the segment sequence exactly once");
assert.equal(sandbox.state.careerMatchHistory[0].segmentId, secondSegmentId);
assert.equal(sandbox.state.careerMatchHistory[1].segmentId, firstSegmentId);

const archiveStatsState = JSON.parse(JSON.stringify(initialState));
archiveStatsState.season = 3;
archiveStatsState.day = 120;
archiveStatsState.leagueSegmentId = "archive-stats-segment";
archiveStatsState.leagueArchiveSequence = 0;
archiveStatsState.leagueArchives = [];
archiveStatsState.league = [{ name: "نادي الاختبار", pts: 40, gf: 30, ga: 10 }];
archiveStatsState.leagueCountry = "مصر";
archiveStatsState.leagueCompetition = "الدوري الممتاز";
archiveStatsState.leagueSource = "بيانات اختبار";
archiveStatsState.leagueDivision = 1;
archiveStatsState.leagueApps = 18;
archiveStatsState.fixtureSchedule = [];
archiveStatsState.leagueRoundHistory = [];
archiveStatsState.seasonLog = [];
archiveStatsState.careerMatchHistory = [
  { id: "archive-played-1", segmentId: "archive-stats-segment", season: 3, scope: "league", club: "نادي الاختبار", country: "مصر", competition: "الدوري الممتاز", minutes: 90, goals: 1, assists: 0, rating: 8 },
  { id: "archive-bench-only", segmentId: "archive-stats-segment", season: 3, scope: "league", club: "نادي الاختبار", country: "مصر", competition: "الدوري الممتاز", minutes: 0, goals: 2, assists: 1, rating: 9 },
  { id: "archive-played-2", segmentId: "archive-stats-segment", season: 3, scope: "league", club: "نادي الاختبار", country: "مصر", competition: "الدوري الممتاز", minutes: 45, goals: 0, assists: 1, rating: 6 },
  { id: "archive-malformed-no-play", segmentId: "archive-stats-segment", season: 3, scope: "league", club: "نادي الاختبار", country: "مصر", competition: "الدوري الممتاز", minutes: Infinity, goals: Infinity, assists: Infinity, rating: Infinity }
];
sandbox.state = archiveStatsState;
const archivedSegment = sandbox.archiveLeagueSegment("transfer");
assert.equal(archivedSegment.matches.length, 4,
  "the archive must retain every fixture row, including non-appearance rows, for audit history");
assert.deepEqual({
  played: archivedSegment.stats.played,
  minutes: archivedSegment.stats.minutes,
  goals: archivedSegment.stats.goals,
  assists: archivedSegment.stats.assists,
  averageRating: archivedSegment.stats.averageRating
}, {
  played: 2, minutes: 135, goals: 1, assists: 1, averageRating: 7
}, "archived player participation stats must count only valid appearances and average only played-match ratings");


const realCareerContext = { window: {} };
vm.createContext(realCareerContext);
const realCareerBundle = fs.readFileSync(path.join(root, "source", "public", "data", "career-engine.js"), "utf8");
vm.runInContext(realCareerBundle, realCareerContext, { filename: "career-engine.js" });
const previousCareerRuntime = sandbox.window.LWCareer;
sandbox.window.LWCareer = realCareerContext.window.LWCareer;
events.failCalendar = false;
sandbox.state = JSON.parse(JSON.stringify(initialState));
sandbox.state.apps = 0;
sandbox.state.careerAppearances = 0;
sandbox.state.careerMinutes = 0;
sandbox.state.competitionStats = {};
sandbox.state.pos = "مهاجم";
sandbox.state.age = 22;
const cupResult = {
  ...result,
  player: { ...result.player, minutes: 45, goals: 1, assists: 1, rating: 7 },
  score: { for: 2, against: 1 }, outcome: "فوز", opponentName: "خصم الكأس"
};
const cupMeta = {
  ...meta, id: "cup-progression-once", scope: "cup", competition: "كأس الاختبار",
  opponent: "خصم الكأس", matchday: 1
};
const cupSettlement = sandbox.settleMatch(cupResult, cupMeta);
assert.ok(cupSettlement && cupSettlement.record,
  "a cup appearance must settle with the real career-development engine");
const cupCompetitionStats = sandbox.state.competitionStats["cup|مصر|كأس الاختبار"];
assert.deepEqual({
  appearances: cupCompetitionStats.appearances,
  qualifyingAppearances: cupCompetitionStats.qualifyingAppearances,
  minutes: cupCompetitionStats.minutes,
  goals: cupCompetitionStats.goals,
  assists: cupCompetitionStats.assists
}, {
  appearances: 1, qualifyingAppearances: 1, minutes: 45, goals: 1, assists: 1
}, "cup competition totals must be written exactly once by match development");
assert.equal(sandbox.state.careerAppearances, 1,
  "the first settled appearance must not be counted twice when legacy apps is synchronized");
assert.equal(sandbox.state.careerMinutes, 45,
  "career development must credit the exact minutes from the settled cup match");
sandbox.window.LWCareer = previousCareerRuntime;

console.log("PASS: match settlement is atomic, segment IDs stay distinct, and archived participation stats exclude non-appearances.");
