"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "public", "ai-career-engine.js"), "utf8");
const sandbox = { window: {}, console };
vm.createContext(sandbox);
const careerEngineSource = fs.readFileSync(path.join(root, "public", "data", "career-engine.js"), "utf8");
new vm.Script(careerEngineSource, { filename: "public/data/career-engine.js" }).runInContext(sandbox);
new vm.Script(source, { filename: "public/ai-career-engine.js" }).runInContext(sandbox);
const ai = sandbox.window.LWCareerAI;
assert.equal(typeof sandbox.window.LWCareer.uniqueMatchRows, "function",
  "the shared career engine must expose the match-history deduplicator before career AI runs");
assert.ok(ai && ai.version === 1, "career AI module must initialize");

const hostileNumericValue = { valueOf: null, toString: null };
const malformedLedgerState = {
  season: 3, day: 15, calendarDay: 15, age: 25, pos: "وسط",
  clubName: "Test FC", energy: 80, fatigue: 10, trust: 65, coachRelationship: 65,
  contractSeasons: 2, careerMatchHistory: [],
  aiMemoryLedger: {
    version: hostileNumericValue,
    nextId: hostileNumericValue,
    events: [
      { id: "kept-event", type: "coach-recommendation", key: "kept", season: 3 },
      { id: "bad-event", type: "coach-recommendation", key: "bad", season: hostileNumericValue }
    ],
    decisions: [
      { id: "kept-decision", signature: "legacy-decision", type: "legacy",
        season: 3, day: 1, followUpAt: 1, outcome: "pending" }
    ]
  }
};
assert.doesNotThrow(() => ai.hasEvent(malformedLedgerState, "coach-recommendation", "kept", 3),
  "malformed saved ledger metadata must not throw during event lookup");
assert.equal(ai.hasEvent(malformedLedgerState, "coach-recommendation", "kept", 3), true,
  "a malformed ledger version must not discard valid saved career-AI history");
assert.equal(ai.hasEvent(malformedLedgerState, "coach-recommendation", "bad", 3), false,
  "a malformed event season must not be coerced into a current-season event");
assert.equal(malformedLedgerState.aiMemoryLedger.version, 1);
assert.equal(malformedLedgerState.aiMemoryLedger.events.length, 2);
assert.equal(malformedLedgerState.aiMemoryLedger.decisions.length, 1);
assert.equal(ai.recordEvent(malformedLedgerState, { type: "test", key: "new", season: 3 }), true,
  "new AI events must append safely after repairing malformed ledger metadata");
assert.ok(malformedLedgerState.aiMemoryLedger.events.some(row => row.key === "kept")
  && malformedLedgerState.aiMemoryLedger.events.some(row => row.key === "new"),
  "ledger repair must retain old valid events while accepting new events");
assert.ok(ai.decisionConsequences(malformedLedgerState).some(row => row.decisionId === "kept-decision"),
  "ledger repair must retain pending saved decisions");

const malformedSavedNumbers = ai.utilityScores({
  pos: "حارس مرمى", age: 29, energy: 85, fatigue: 15, trust: 65, contractSeasons: 3,
  clubName: "Test FC", league: [{ name: "Test FC", pts: hostileNumericValue, rank: 2 }],
  careerMatchHistory: [{
    scope: "league", minutes: 90, rating: 6.5, goals: 0, assists: 0,
    oppGoals: hostileNumericValue, stats: { saves: 3, cleanSheet: true }
  }]
}, 70);
assert.equal(malformedSavedNumbers.context.cleanSheetsLastFive, 0,
  "malformed conceded-goal values must not create a false clean sheet");
assert.equal(malformedSavedNumbers.context.leaguePoints, null,
  "malformed saved league points must be ignored without throwing");
const hostileTextValue = { toString: 1, valueOf: 1 };
assert.doesNotThrow(() => ai.coachAdvice({
  pos: "وسط", role: hostileTextValue, age: 24, energy: 80, fatigue: 15,
  trust: 20, morale: 60, careerMatchHistory: []
}, 65), "saved role objects must not crash coach advice");
const hostileTacticAdvice = ai.chooseOpponentTactic({
  state: { pos: "وسط", energy: 80, fatigue: 15, careerMatchHistory: [
    { matchId: "hostile-tactic-1", scope: "league", minutes: 90, rating: 7,
      tactic: hostileTextValue, playerTactic: hostileTextValue }
  ] },
  ourTactic: "balanced", teamPower: 65, opponentPower: 65, overall: 65
});
assert.equal(hostileTacticAdvice.repeatedStyle, 0,
  "malformed saved tactic labels must be ignored instead of coerced");
const hostileClubRecommendations = ai.recommendTransfers({
  clubName: hostileTextValue, leagueCountry: hostileTextValue, age: 22
}, [
  { name: hostileTextValue, country: "Egypt", ovr: 65 },
  { name: "Broken Country FC", country: hostileTextValue, ovr: 65 }
], 65);
assert.equal(hostileClubRecommendations.length, 0,
  "object-valued club names and countries must be excluded from transfer recommendations");
const hostileLedgerState = { season: 1, day: 1, aiMemoryLedger: {
  version: 1, nextId: 1, events: [], decisions: []
} };
assert.equal(ai.hasEvent(hostileLedgerState, hostileTextValue, "key", 1), false,
  "event lookup must reject non-primitive event types");
assert.equal(ai.recordEvent(hostileLedgerState, { type: hostileTextValue, key: "key" }), false,
  "event recording must reject non-primitive event types");
assert.equal(ai.recordDecision(hostileLedgerState, { type: hostileTextValue }), null,
  "decision recording must reject non-primitive decision types");
assert.equal(ai.resolveDecision(hostileLedgerState, hostileTextValue, "resolved"), false,
  "decision resolution must reject non-primitive IDs");
const hostileContext = ai.utilityScores({
  pos: "وسط", role: hostileTextValue, clubName: hostileTextValue,
  leagueTable: [{ club: hostileTextValue, rank: 1, points: 30 }],
  energy: 80, fatigue: 15, trust: 60, careerMatchHistory: []
}, 65).context;
assert.equal(hostileContext.clubName, "",
  "malformed saved club names must be omitted from AI context without throwing");

assert.doesNotThrow(() => ai.coachAdvice({
  pos: "مهاجم", age: 25, energy: hostileNumericValue, fatigue: 10,
  trust: 65, morale: 65, contractSeasons: 2, careerMatchHistory: []
}, 70), "career AI coaching must safely handle malformed numeric player fields");

const duplicateRecentMatch = {
  id: "recent-form-duplicate-1", scope: "league", season: 3, segmentId: "segment-3-a",
  competition: "Test League", club: "Test FC", opponent: "Opponent FC", day: 12,
  minutes: 90, rating: 10, goals: 2, assists: 1, teamGoals: 2, oppGoals: 1
};
const recentHistory = [
  duplicateRecentMatch,
  { ...duplicateRecentMatch },
  ...Array.from({ length: 4 }, (_, index) => ({
    id: "recent-form-low-" + index, scope: "league", season: 3, segmentId: "segment-3-a",
    competition: "Test League", club: "Test FC", opponent: "Opponent " + index, day: 11 - index,
    minutes: 90, rating: 6, goals: 0, assists: 0, teamGoals: 0, oppGoals: 1
  }))
];
const recentForm = ai.contextSnapshot({
  season: 3, day: 15, age: 24, pos: "مهاجم", clubName: "Test FC",
  careerMatchHistory: recentHistory, coachRelationship: 55, contractSeasons: 2
}, 70);
assert.equal(recentForm.recentMatches, 5,
  "recent form must count five unique fixtures, not duplicate legacy rows");
assert.equal(recentForm.averageRating, 6.8,
  "a duplicated high-rated fixture must not inflate the recent average rating");
assert.equal(recentForm.goalsLastFive, 2,
  "a duplicated legacy fixture must not double the player's recent goal total");
assert.equal(recentForm.assistsLastFive, 1,
  "a duplicated legacy fixture must not double the player's recent assist total");
assert.equal(fs.readFileSync(path.join(root, "ai-career-engine.js"), "utf8"), source,
  "root and public career AI engines must remain synchronized");

const injured = ai.coachAdvice({
  pos: "مهاجم", injuryDays: 4, energy: 90, fatigue: 10, trust: 70, morale: 70,
  shooting: 65, seasonGoals: 2, lastRating: 7.2
}, 70);
assert.equal(injured.page, "wellness", "injury must override performance and trigger a recovery recommendation");
assert.ok(injured.summary.includes("4 يوم"));

const tired = ai.coachAdvice({
  pos: "جناح", injuryDays: 0, energy: 22, fatigue: 81, trust: 50, morale: 55,
  speed: 70, dribbling: 68, lastRating: 7
}, 68);
assert.equal(tired.page, "wellness", "low energy and high fatigue must recommend recovery");
assert.ok(tired.score >= 0 && tired.score <= 100, "career readiness score must be bounded");

const winger = ai.coachAdvice({
  pos: "جناح", injuryDays: 0, energy: 85, fatigue: 20, trust: 65, morale: 72,
  speed: 59, dribbling: 55, lastRating: 7.4
}, 68);
assert.equal(winger.focus, "speed", "a winger must receive a position-specific primary focus");

const mobileForwardAdvice = ai.coachAdvice({
  pos: "مهاجم", injuryDays: 0, energy: 85, fatigue: 20, trust: 65, morale: 72,
  dribbling: 59, speed: 55, shooting: 64, lastRating: 7.4
}, 68);
assert.equal(mobileForwardAdvice.focus, "dribbling",
  "a mobile forward should be coached first on dribbling and movement");
const centreStrikerAdvice = ai.coachAdvice({
  pos: "رأس حربة", injuryDays: 0, energy: 85, fatigue: 20, trust: 65, morale: 72,
  shooting: 59, composure: 55, physical: 58, lastRating: 7.4
}, 68);
assert.equal(centreStrikerAdvice.focus, "shooting",
  "a centre striker should be coached first on finishing/shooting");

for (const [alias, canonical] of [
  ["GK", "حارس مرمى"], ["CB", "قلب دفاع"], ["CDM", "وسط دفاعي"],
  ["CAM", "وسط مهاجم"], ["CM", "وسط"], ["LW", "جناح"], ["CF", "مهاجم"], ["ST", "رأس حربة"]
]) {
  assert.equal(ai.normalizePosition(alias), canonical,
    "career AI must normalize the shared English position alias " + alias);
}
const hostilePositionText = { toString: 1, valueOf: 1 };
assert.doesNotThrow(() => ai.normalizePosition(hostilePositionText),
  "career AI position normalization must not coerce hostile saved objects");
assert.equal(ai.normalizePosition(hostilePositionText), "",
  "non-primitive saved positions must use the safe empty fallback");
assert.equal(ai.normalizePosition("constructor"), "constructor",
  "inherited Object prototype members must not become position aliases");
const inheritedPositionAdvice = ai.coachAdvice({
  pos: "constructor", energy: 85, fatigue: 15, trust: 65, morale: 70,
  speed: 60, dribbling: 58, lastRating: 7.2
}, 70);
assert.equal(inheritedPositionAdvice.focus, "speed",
  "inherited position keys must use the safe winger focus fallback");
const malformedPositionAdvice = ai.coachAdvice({
  pos: hostilePositionText, energy: 85, fatigue: 15, trust: 65, morale: 70,
  speed: 60, dribbling: 58, lastRating: 7.2
}, 70);
assert.equal(malformedPositionAdvice.focus, "speed",
  "malformed saved positions must not break position-specific coaching");
const inheritedTactic = ai.chooseOpponentTactic({
  ourTactic: "constructor", teamPower: 55, opponentPower: 55, managerIQ: 50,
  state: { energy: 80, fatigue: 10, lastRating: 6.5, seasonGoals: 0, careerMatchHistory: [] }
});
assert.equal(inheritedTactic.tactic, "balanced",
  "inherited tactic labels must not be accepted as valid player tactics");
assert.equal(inheritedTactic.label, "متوازن");

const centralMidfielderAdvice = ai.coachAdvice({
  pos: "CM", energy: 85, fatigue: 15, trust: 65, morale: 70,
  passing: 62, vision: 61, lastRating: 7.2
}, 70);
assert.equal(centralMidfielderAdvice.focus, "passing",
  "a CM must receive central-midfield passing guidance instead of the default winger plan");
assert.equal(centralMidfielderAdvice.context.position, "وسط",
  "coach advice context should use the normalized central-midfield role");

const englishKeeper = ai.utilityScores({
  pos: "GK", age: 29, energy: 85, fatigue: 15, trust: 65, contractSeasons: 3,
  careerMatchHistory: [{
    scope: "league", minutes: 90, rating: 7.1, goals: 0, assists: 0, teamGoals: 1, oppGoals: 0,
    stats: { saves: 3, cleanSheet: true }
  }]
}, 70);
assert.equal(englishKeeper.context.position, "حارس مرمى");
assert.equal(englishKeeper.context.cleanSheetsLastFive, 1,
  "English goalkeeper aliases must retain clean-sheet eligibility in career AI");
assert.equal(englishKeeper.context.roleContributionLastFive, true);

const englishDefender = ai.utilityScores({
  pos: "CB", age: 26, energy: 85, fatigue: 15, trust: 65, contractSeasons: 3,
  careerMatchHistory: [{
    scope: "league", minutes: 90, rating: 6.4, goals: 0, assists: 0, teamGoals: 1, oppGoals: 1,
    stats: { tackles: 4, interceptions: 2, saves: 0, keyPasses: 0, shotsOnTarget: 0 }
  }]
}, 70);
assert.equal(englishDefender.context.roleContributionLastFive, true,
  "English centre-back aliases must receive credit for real defensive contributions");

const englishCentralMidfielder = ai.utilityScores({
  pos: "CM", age: 25, energy: 85, fatigue: 15, trust: 65, contractSeasons: 3,
  careerMatchHistory: [{
    scope: "league", minutes: 90, rating: 6.5, goals: 0, assists: 0, teamGoals: 1, oppGoals: 1,
    stats: { tackles: 2, interceptions: 1, keyPasses: 2, shotsOnTarget: 0 }
  }]
}, 70);
assert.equal(englishCentralMidfielder.context.position, "وسط");
assert.equal(englishCentralMidfielder.context.roleContributionLastFive, true,
  "central-midfield key passes must count as an individual contribution for AI role assessment");

const newestForm = ai.formRating({
  careerMatchHistory: [
    ...Array.from({ length: 5 }, (_, i) => ({ scope: "league", rating: 8.8 - i * 0.1, matchId: "new-" + i })),
    ...Array.from({ length: 5 }, (_, i) => ({ scope: "league", rating: 4.8 + i * 0.1, matchId: "old-" + i }))
  ],
  lastRating: 6.0
});
assert.ok(newestForm > 8.4 && newestForm < 8.8,
  "adaptive coaching must prioritize the newest five matches, not the oldest rows in newest-first match history");


const legacySeasonLog = [
  ...Array.from({ length: 5 }, (_, i) => ({
    scope: "league", minutes: 90, rating: 4.8 + i * 0.1, tactic: "balanced", matchId: "legacy-old-" + i
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    scope: "league", minutes: 90, rating: 8.4 + i * 0.1, tactic: "attack", matchId: "legacy-new-" + i
  }))
];
const legacyState = { careerMatchHistory: [], seasonLog: legacySeasonLog, lastRating: 6.0 };
const legacyForm = ai.formRating(legacyState);
assert.ok(legacyForm > 8.4 && legacyForm < 8.8,
  "career AI form must fall back to the newest legacy seasonLog rows when modern history is empty");
const legacyAdvice = ai.coachAdvice({
  ...legacyState, pos: "رأس حربة", energy: 85, fatigue: 15, trust: 65, morale: 70, shooting: 70
}, 70);
assert.equal(legacyAdvice.rating, legacyForm,
  "coach advice must use the recovered legacy form instead of a stale lastRating");
const legacyTacticalRead = ai.chooseOpponentTactic({
  state: { ...legacyState, pos: "مهاجم", energy: 80, fatigue: 15, seasonGoals: 2 },
  ourTactic: "attack", teamPower: 70, opponentPower: 70, overall: 70
});
assert.equal(legacyTacticalRead.tactic, "compact",
  "opponents should adapt to repeated tactics preserved only in a legacy seasonLog");

const sharedMixedHistoryRow = {
  id: "mixed-history-shared-league", scope: "league", season: 4, segmentId: "segment-4-a",
  competition: "Test League", club: "Test FC", opponent: "Shared Rival", day: 22,
  minutes: 90, rating: 8.9, goals: 1, assists: 0, tactic: "attack", teamGoals: 1, oppGoals: 0
};
const partiallyMigratedHistory = {
  careerMatchHistory: [
    {
      id: "mixed-history-new-cup", scope: "cup", season: 4, segmentId: "cup-4",
      competition: "Test Cup", club: "Test FC", opponent: "Cup Rival", day: 25,
      minutes: 90, rating: 9, goals: 1, assists: 0, tactic: "attack", teamGoals: 1, oppGoals: 0
    },
    sharedMixedHistoryRow
  ],
  // Older saves may have newer cup records in careerMatchHistory while league rows
  // remain only in seasonLog. The shared league row must be counted once.
  seasonLog: [
    {
      id: "mixed-history-old-low", scope: "league", season: 4, segmentId: "segment-4-a",
      competition: "Test League", club: "Test FC", opponent: "Old Rival", day: 18,
      minutes: 90, rating: 4, goals: 0, assists: 0, tactic: "balanced", teamGoals: 0, oppGoals: 1
    },
    {
      id: "mixed-history-legacy-1", scope: "league", season: 4, segmentId: "segment-4-a",
      competition: "Test League", club: "Test FC", opponent: "Legacy Rival 1", day: 19,
      minutes: 90, rating: 8.5, goals: 1, assists: 0, tactic: "attack", teamGoals: 1, oppGoals: 0
    },
    {
      id: "mixed-history-legacy-2", scope: "league", season: 4, segmentId: "segment-4-a",
      competition: "Test League", club: "Test FC", opponent: "Legacy Rival 2", day: 20,
      minutes: 90, rating: 8.6, goals: 1, assists: 0, tactic: "attack", teamGoals: 1, oppGoals: 0
    },
    {
      id: "mixed-history-legacy-3", scope: "league", season: 4, segmentId: "segment-4-a",
      competition: "Test League", club: "Test FC", opponent: "Legacy Rival 3", day: 21,
      minutes: 90, rating: 8.7, goals: 1, assists: 0, tactic: "attack", teamGoals: 1, oppGoals: 0
    },
    sharedMixedHistoryRow
  ]
};
const mixedHistoryForm = ai.formRating(partiallyMigratedHistory);
assert.ok(Math.abs(mixedHistoryForm - 8.74) < 1e-9,
  "career AI form must merge partially migrated legacy league rows with newer cup history and deduplicate the shared fixture");
const mixedHistoryContext = ai.utilityScores(partiallyMigratedHistory, 70).context;
assert.equal(mixedHistoryContext.recentMatches, 5,
  "context-aware AI must evaluate five unique recent matches across both history stores");
assert.ok(Math.abs(mixedHistoryContext.averageRating - 8.74) < 1e-9,
  "context-aware AI must not ignore legacy league form or count a mirrored fixture twice");
assert.equal(mixedHistoryContext.goalsLastFive, 5,
  "context-aware AI must include each of the five recent mixed-history goals exactly once");

const playedForm = ai.formRating({
  careerMatchHistory: [
    { scope: "league", minutes: 0, rating: 0, matchId: "bench-1" },
    { scope: "league", minutes: 0, rating: 0, matchId: "suspension-1" },
    { scope: "league", minutes: 90, rating: 7.6, matchId: "played-1" },
    { scope: "league", minutes: 85, rating: 7.4, matchId: "played-2" }
  ],
  lastRating: 6.0
});
assert.equal(playedForm, 7.5,
  "bench or suspended appearances with zero minutes must not count as poor performance");

const strongPlan = ai.recommendPlayerTactic({
  pos: "مهاجم", energy: 90, fatigue: 15, trust: 72, morale: 80, clubPower: 76,
  seasonGoals: 8
}, 84, { name: "منافس أضعف", power: 54 });
assert.equal(strongPlan.tactic, "attack", "a strong team should be advised to attack a substantially weaker opponent");
const underdogPlan = ai.recommendPlayerTactic({
  pos: "جناح", energy: 80, fatigue: 15, trust: 55, morale: 55, clubPower: 48
}, 58, { name: "منافس قوي", power: 83 });
assert.equal(underdogPlan.tactic, "counter", "an underdog should be advised to use counter attacks");
const englishKeeperPlan = ai.recommendPlayerTactic({
  pos: "GK", energy: 90, fatigue: 15, trust: 50, morale: 50, clubPower: 55
}, 55, { name: "منافس متكافئ", power: 60 });
assert.equal(englishKeeperPlan.tactic, "defend",
  "an English GK alias must receive the same conservative tactical recommendation as its Arabic position");
const englishCentreBackPlan = ai.recommendPlayerTactic({
  pos: "CB", energy: 90, fatigue: 15, trust: 50, morale: 50, clubPower: 55
}, 55, { name: "منافس متكافئ", power: 60 });
assert.equal(englishCentreBackPlan.tactic, "defend",
  "an English CB alias must receive the same defensive tactical recommendation as its Arabic position");

assert.equal(ai.chooseOpponentTactic({
  state: { pos: "مهاجم", energy: 80, fatigue: 15, trust: 70, morale: 70, seasonGoals: 2, lastRating: 7 },
  ourTactic: "attack", teamPower: 70, opponentPower: 70, overall: 70
}).tactic, "counter", "the opponent should adapt with counter-attacks to an aggressive player tactic");
assert.equal(ai.chooseOpponentTactic({
  state: { pos: "مهاجم", energy: 80, fatigue: 15, trust: 70, morale: 70, seasonGoals: 8, lastRating: 8.2 },
  ourTactic: "balanced", teamPower: 80, opponentPower: 66, overall: 86
}).tactic, "compact", "a dangerous player should provoke a compact defensive response");
assert.equal(ai.chooseOpponentTactic({
  state: { pos: "وسط دفاعي", energy: 80, fatigue: 15 }, ourTactic: "balanced",
  teamPower: 58, opponentPower: 78, overall: 60
}).tactic, "press", "a stronger opponent should be able to choose high pressure");

const clubs = [
  { name: "النادي الحالي", country: "مصر", ovr: 61, prestige: 55 },
  { name: "نادي قريب", country: "مصر", ovr: 65, prestige: 72 },
  { name: "نادي طموح", country: "إسبانيا", ovr: 72, prestige: 90 },
  { name: "نادي غير مناسب", country: "إنجلترا", ovr: 99, prestige: 100 }
];
const recommendations = ai.recommendTransfers({
  clubName: "النادي الحالي", leagueCountry: "مصر", age: 21
}, clubs, 61);
assert.ok(recommendations.length > 0 && recommendations.length <= 3, "the agent must return up to three recommendations");
assert.ok(recommendations.every(row => row.name !== "النادي الحالي"), "the current club must not be recommended as a transfer destination");
assert.ok(recommendations.every(row => Number.isFinite(row.score) === false), "recommendation internals must not leak into UI result objects");
assert.ok(recommendations.every(row => row.gap <= 18), "unrealistic elite jumps must be filtered out");

const duplicateTransferCandidates = [
  { name: "Current Club", country: "Egypt", ovr: 61, prestige: 55 },
  { name: "Suitable FC", country: "Egypt", ovr: 99, prestige: 80 },
  { name: "Suitable FC", country: " egypt ", ovr: 65, prestige: 70 }
];
const robustRecommendations = ai.recommendTransfers({
  clubName: "  CURRENT CLUB ", leagueCountry: " egypt ", age: 22
}, duplicateTransferCandidates, 61);
assert.ok(!robustRecommendations.some(row => row.name.trim().toLocaleLowerCase() === "current club"),
  "the current club must stay excluded despite case and whitespace differences");
assert.equal(robustRecommendations.filter(row => row.name.trim().toLocaleLowerCase() === "suitable fc").length, 1,
  "duplicate club entries must collapse to one eligible transfer recommendation");
assert.equal(robustRecommendations.find(row => row.name.trim().toLocaleLowerCase() === "suitable fc").power, 65,
  "an out-of-range duplicate must not hide a later eligible entry for the same club");
assert.notEqual(robustRecommendations.find(row => row.name.trim().toLocaleLowerCase() === "suitable fc").fit,
  "مخاطرة قلة دقائق اللعب",
  "context-aware transfer scoring must use the selected eligible duplicate, not the first same-name entry");

const life = ai.lifestyleAdvice({ energy: 88, fatigue: 12, money: 500, weeklyWage: 300, contractSeasons: 1 });
assert.equal(life.page, "contract", "an expiring contract should surface a contract review");

const academyState = {
  age: 16, season: 2, calendarDay: 80, role: "ناشئ", youthAcademy: true,
  clubName: "الأهلي", pos: "جناح", ovr: 58, energy: 84, fatigue: 15, trust: 57,
  coachRelationship: 57, contractSeasons: 2, careerMatchHistory: [
    { matchId: "academy-1", minutes: 72, rating: 7.6, goals: 1, assists: 1, teamGoals: 2, oppGoals: 1 },
    { matchId: "academy-2", minutes: 50, rating: 7.1, goals: 0, assists: 0, teamGoals: 1, oppGoals: 1 }
  ], league: [{ name: "الأهلي", pts: 31, rank: 3 }]
};
const academyAdvice = ai.coachAdvice(academyState, 58);
assert.equal(academyAdvice.id, "academy-development", "academy players must receive age-stage-specific advice");
assert.equal(academyAdvice.context.stage, "academy");
assert.equal(academyAdvice.context.lastResult.outcome, "win", "context must read the latest match result");
assert.equal(academyAdvice.context.goalsLastFive, 1, "context must aggregate recent goals");
assert.equal(academyAdvice.context.assistsLastFive, 1, "context must aggregate recent assists");
assert.equal(academyAdvice.context.leaguePosition, 3, "context must read the player's team position");
const normalizedClubRank = ai.utilityScores({
  pos: "جناح", age: 25, energy: 85, fatigue: 15, trust: 65, contractSeasons: 3,
  clubName: "  CURRENT CLUB ",
  league: [{ name: "current club", pts: 31, rank: 3 }, { name: "نادي آخر", pts: 27, rank: 5 }]
}, 70);
assert.equal(normalizedClubRank.context.leaguePosition, 3,
  "league context must find the player's club despite case and surrounding whitespace differences");
assert.equal(normalizedClubRank.context.leaguePoints, 31,
  "normalized club matching must preserve points from the correct league row");
assert.ok(academyAdvice.utilities.development > 0, "the advice must include transparent utility scores");
const highFormRows = [{ scope: "league", minutes: 90, rating: 8.1, goals: 0, assists: 0, teamGoals: 0, oppGoals: 1, matchId: "loss-high-form" }];
const highFormLoss = ai.utilityScores({ pos: "وسط دفاعي", age: 25, energy: 85, fatigue: 15, trust: 65,
  contractSeasons: 3, careerMatchHistory: highFormRows }, 70);
const highFormWin = ai.utilityScores({ pos: "وسط دفاعي", age: 25, energy: 85, fatigue: 15, trust: 65,
  contractSeasons: 3, careerMatchHistory: [{ ...highFormRows[0], teamGoals: 2, oppGoals: 0, matchId: "win-high-form" }] }, 70);
assert.equal(highFormLoss.form, highFormWin.form,
  "a strong individual rating must not receive a poor-form penalty just because the team lost");
const poorFormLoss = ai.utilityScores({ pos: "وسط دفاعي", age: 25, energy: 85, fatigue: 15, trust: 65,
  contractSeasons: 3, careerMatchHistory: [{ ...highFormRows[0], rating: 5.2, teamGoals: 0, oppGoals: 2 }] }, 70);
const poorFormWin = ai.utilityScores({ pos: "وسط دفاعي", age: 25, energy: 85, fatigue: 15, trust: 65,
  contractSeasons: 3, careerMatchHistory: [{ ...highFormRows[0], rating: 5.2, teamGoals: 2, oppGoals: 0 }] }, 70);
assert.equal(poorFormLoss.form, poorFormWin.form + 2,
  "team result may contextualize genuinely poor recent individual form, not replace it");

const savedDefenderRows = [{
  scope: "league", minutes: 90, rating: 6.1, goals: 0, assists: 0,
  teamGoals: 0, oppGoals: 1, matchId: "saved-defender-loss",
  stats: { tackles: 4, interceptions: 2, saves: 0, keyPasses: 0, shotsOnTarget: 0, cleanSheet: false }
}];
const savedDefenderLoss = ai.utilityScores({
  pos: "قلب دفاع", age: 26, energy: 85, fatigue: 15, trust: 65,
  contractSeasons: 3, careerMatchHistory: savedDefenderRows
}, 70);
const savedDefenderWin = ai.utilityScores({
  pos: "قلب دفاع", age: 26, energy: 85, fatigue: 15, trust: 65,
  contractSeasons: 3,
  careerMatchHistory: [{ ...savedDefenderRows[0], teamGoals: 2, oppGoals: 0, matchId: "saved-defender-win" }]
}, 70);
assert.equal(savedDefenderLoss.context.tacklesLastFive, 4,
  "career AI must read tackles from the nested stats object saved by the match-result recorder");
assert.equal(savedDefenderLoss.context.interceptionsLastFive, 2,
  "career AI must read nested defensive interceptions from saved match records");
assert.equal(savedDefenderLoss.context.roleContributionLastFive, true,
  "meaningful saved defensive actions must count as individual contributions");
assert.equal(savedDefenderLoss.form, savedDefenderWin.form,
  "nested defensive contributions must prevent an unrelated team loss from adding a poor-form penalty");
const savedKeeper = ai.utilityScores({
  pos: "حارس مرمى", age: 29, energy: 85, fatigue: 15, trust: 65,
  contractSeasons: 3,
  careerMatchHistory: [{
    scope: "league", minutes: 90, rating: 6.0, goals: 0, assists: 0, teamGoals: 0, oppGoals: 0,
    stats: { saves: 3, cleanSheet: true }
  }]
}, 70);
assert.equal(savedKeeper.context.savesLastFive, 3,
  "career AI must read goalkeeper saves from nested persisted match stats");
assert.equal(savedKeeper.context.cleanSheetsLastFive, 1,
  "career AI must read clean sheets from nested persisted match stats");
assert.equal(savedKeeper.context.roleContributionLastFive, true,
  "goalkeeper saves and clean sheets must count toward role-aware individual form");
const shortAppearanceCleanSheet = ai.utilityScores({
  pos: "قلب دفاع", age: 26, energy: 85, fatigue: 15, trust: 65,
  contractSeasons: 3,
  careerMatchHistory: [{
    minutes: 45, rating: 5.8, goals: 0, assists: 0, teamGoals: 1, oppGoals: 0,
    stats: { tackles: 0, interceptions: 0, saves: 0, keyPasses: 0, shotsOnTarget: 0, cleanSheet: true }
  }]
}, 70);
assert.equal(shortAppearanceCleanSheet.context.cleanSheetsLastFive, 0,
  "a stale clean-sheet flag must not count when the player played fewer than 60 minutes");
assert.equal(shortAppearanceCleanSheet.context.roleContributionLastFive, false,
  "an ineligible short appearance must not create a false defensive contribution");
const attackerCleanSheet = ai.utilityScores({
  pos: "مهاجم", age: 26, energy: 85, fatigue: 15, trust: 65,
  contractSeasons: 3,
  careerMatchHistory: [{
    minutes: 90, rating: 5.8, goals: 0, assists: 0, teamGoals: 1, oppGoals: 0,
    stats: { tackles: 0, interceptions: 0, saves: 0, keyPasses: 0, shotsOnTarget: 0, cleanSheet: true }
  }]
}, 70);
assert.equal(attackerCleanSheet.context.cleanSheetsLastFive, 0,
  "clean-sheet credit must be restricted to goalkeeper and defensive positions");
assert.equal(attackerCleanSheet.context.roleContributionLastFive, false,
  "a striker must not receive a false role-aware contribution from a clean-sheet flag");
const contradictedCleanSheet = ai.utilityScores({
  pos: "قلب دفاع", age: 26, energy: 85, fatigue: 15, trust: 65,
  contractSeasons: 3,
  careerMatchHistory: [{
    minutes: 90, rating: 5.8, goals: 0, assists: 0, teamGoals: 1, oppGoals: 1,
    stats: { tackles: 0, interceptions: 0, saves: 0, keyPasses: 0, shotsOnTarget: 0, cleanSheet: true }
  }]
}, 70);
assert.equal(contradictedCleanSheet.context.cleanSheetsLastFive, 0,
  "a saved clean-sheet flag must be rejected when the recorded opponent score is non-zero");
assert.equal(contradictedCleanSheet.context.roleContributionLastFive, false,
  "a contradictory clean-sheet flag must not improve defensive form");

const legacySeasonLogRows = [
  ...Array.from({ length: 5 }, (_, i) => ({
    scope: "league", minutes: 90, rating: 4.8 + i * 0.1, goals: 0, assists: 0, matchId: "legacy-old-" + i
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    scope: "league", minutes: 90, rating: 8.4 + i * 0.1, goals: 1, assists: 0, matchId: "legacy-new-" + i
  }))
];
const legacyHistoryFallback = ai.utilityScores({
  pos: "رأس حربة", age: 25, energy: 85, fatigue: 15, trust: 65, contractSeasons: 3,
  careerMatchHistory: [], seasonLog: legacySeasonLogRows, lastRating: 6.0
}, 70);
assert.equal(legacyHistoryFallback.context.recentMatches, 5,
  "legacy saves with an empty careerMatchHistory must fall back to seasonLog");
assert.ok(legacyHistoryFallback.context.averageRating > 8.4 && legacyHistoryFallback.context.averageRating < 8.8,
  "legacy seasonLog fallback must use the latest five entries, not the oldest five");
assert.equal(legacyHistoryFallback.context.goalsLastFive, 5,
  "legacy seasonLog fallback must aggregate the latest five match contributions");
assert.equal(ai.recordRecommendation(academyState, academyAdvice), true, "the AI must persist a new recommendation into its seasonal ledger");
assert.equal(ai.recordRecommendation(academyState, academyAdvice), false, "the same recommendation must not be recorded twice in a season");
const changedAdvice = ai.coachAdvice(academyState, 58);
assert.notEqual(changedAdvice.id, academyAdvice.id, "repeated same-season advice should rotate to a distinct non-repeated recommendation");
const beforeRelationship = academyState.coachRelationship;
const decision = ai.recordDecision(academyState, { type: "criticize-coach", followUpDays: 14 });
assert.ok(decision && decision.consequence === "coach-trust-risk");
assert.ok(academyState.coachRelationship < beforeRelationship, "a remembered decision must affect the player-coach relationship");
academyState.calendarDay += 15;
assert.ok(ai.decisionConsequences(academyState).some(row => row.decisionId === decision.id),
  "the memory ledger must surface a consequence after its follow-up date");

console.log("PASS: local career AI covers position-aware coaching, match tactics, adaptive opponents, transfer fit, and life/contract recommendations.");
