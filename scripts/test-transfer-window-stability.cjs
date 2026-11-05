"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
global.window = global;
require(path.join(root, "public", "data", "career-engine.js"));
const careerEngine = global.LWCareer;
assert.ok(careerEngine && typeof careerEngine.uniqueMatchRows === "function",
  "legacy archive tests must use the deployed career-history deduplicator");
const app = fs.readFileSync(path.join(root, "index.html"), "utf8");
const deployedApp = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
assert.equal(app, deployedApp, "root and public app shells must remain synchronized");

function section(startMarker, endMarker) {
  const start = app.indexOf(startMarker);
  assert.ok(start >= 0, "missing source marker: " + startMarker);
  const end = app.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, "missing end marker: " + endMarker);
  return app.slice(start, end);
}

const transferWindowSource = section("function transferWindow(){", "\nfunction transferOfferMatchesWindow(");
const transferOfferMatchSource = section("function transferOfferMatchesWindow(", "\nfunction currentFreeAgentTransferWindowId(");
const transferOfferCurrentMatchSource = section("function currentFreeAgentTransferWindowId()", "\nfunction canAccessTransferMarket(");
const ensureOffersSource = section("function ensureTransferOffers(){", "\nfunction offerIsAvailable(");
const offerAvailabilitySource = section("function offerIsAvailable(", "\nfunction beginTransferNegotiation(");
const transferEligibilitySource = section("function transferEligibilityReason(target){", "\nfunction transferEligible(");
const cupArchiveSource = section("function archiveCupForTransfer(){", "\nfunction leagueMatchTargetForCurrentClub()");
const leagueArchiveSource = section("function ensureLeagueSegmentId(){", "\nfunction archiveSeasonRecord()");
const transitionTransactionStub = "function withCareerStateTransaction(label, operation){ return operation(); }\n";
const normalizedTargetKeySource = section("function normalizedTransferLabel(", "\nfunction transferFactors(");
const transferToSource = transitionTransactionStub + normalizedTargetKeySource + section("function transferTo(){", "\nfunction ");
const maybeOfferTransferSource = section("function maybeOfferTransfer(){", "\nfunction transferTo(){");
const legacyMigrationSource = section("function migrateLegacyPendingTransferOffer(", "\nfunction reconcileTransferNegotiation(");
const reconciliationSource = section("function reconcileTransferNegotiation(", "\nfunction dedupeTransferOffersForWindow(");
const dedupeOffersSource = section("function dedupeTransferOffersForWindow(", "\nfunction ensureTransferOffers(){");
const transferFactorsSource = section("function transferFactors(", "\nfunction transferAverageRating(");
const beginNegotiationSource = section("function beginTransferNegotiation(", "\nfunction negotiationTermsFromDom(");
const requestLoanSource = section("function requestLoan(){", "\nfunction loanTo(");
const loanToSource = transitionTransactionStub + section("function loanTo(target){", "\nfunction returnFromLoan()");
const returnFromLoanSource = transitionTransactionStub + section("function returnFromLoan()", "\nfunction renderContract()");
const submitNegotiationSource = section("function submitTransferNegotiation(){", "\nfunction rejectTransferOffer(");
const renderTransferMarketSource = section("function renderTransferMarket(){", "\nfunction renderSquadCompetition()");
const freeAgentEligibilitySource = section("function careerMatchPlayerEligible(", "\nfunction simulateCareerMatch(");
const careerMatchSimulationSource = section("function simulateCareerMatch(", "\nfunction matchCleanSheetContractBonus(");
const applyMatchResultSource = section("function applyMatchResultUnsafe(", "\nfunction applyMatchResult(");
const retirementSource = section("function retireCareer(){", "\nlet postCareerMutationPending=false;");
const retirementPersistenceSource = section("function persistRollbackSnapshot(", "\nfunction withCareerStateTransaction(");
assert.match(retirementPersistenceSource, /warningMessage/, "retirement persistence must support context-specific warnings");

function runLegacyLeagueArchive(rows, seasonRows = []) {
  const archiveState = { season: 4, day: 20, leagueCountry: "مصر", leagueCompetition: "الدوري الممتاز",
    leagueSource: "اختبار", leagueDivision: 1, leagueSegmentId: "segment-4-old-fc", leagueApps: 2,
    league: [{ name: "Old FC", pts: 4, gf: 2, ga: 1 }], fixtureSchedule: [], leagueRoundHistory: [],
    leagueArchives: [], seasonLog: seasonRows, careerMatchHistory: rows };
  const sandbox = { state: archiveState, window: { LWCareer: careerEngine }, club: () => ({ name: "Old FC" }),
    clubNameForLeague: () => "Old FC", structuredCloneSafe: value => JSON.parse(JSON.stringify(value)) };
  vm.createContext(sandbox);
  vm.runInContext(leagueArchiveSource + String.fromCharCode(10) + "this.archiveLeagueSegment = archiveLeagueSegment;", sandbox,
    { filename: "legacy-league-archive" });
  return sandbox.archiveLeagueSegment("transfer");
}
const legacySeasonLogRow = {
  id: "legacy-season-log", season: 4, segmentId: "segment-4-old-fc",
  club: "Old FC", country: "مصر", competition: "الدوري الممتاز",
  opponent: "Season Log Opponent", day: 19, minutes: 90, goals: 0, assists: 1
};
const legacyArchive = runLegacyLeagueArchive([
  { ...legacySeasonLogRow },
  { id: "legacy-no-scope", season: 4, leagueCountry: "مصر", leagueCompetition: "الدوري الممتاز", club: "Old FC", day: 14, minutes: 90, goals: 1, assists: 0 },
  { id: "legacy-whitespace-alias", scope: " ", season: 4, country: "مصر", competition: "  ", leagueCompetition: "الدوري الممتاز", club: "Old FC", day: 15, minutes: 60, goals: 0, assists: 1 },
  { id: "segment-only", segmentId: "segment-4-old-fc", scope: "league", minutes: 0, goals: 0, assists: 0 },
  { id: "cup-excluded", scope: "cup", season: 4, country: "مصر", competition: "الدوري الممتاز", club: "Old FC", day: 15, minutes: 90, goals: 2, assists: 0 },
  { id: "other-club-excluded", scope: "league", season: 4, country: "مصر", competition: "الدوري الممتاز", club: "Other FC", day: 16, minutes: 90, goals: 1, assists: 0 },
  { id: "other-season-excluded", scope: "league", season: 3, country: "مصر", competition: "الدوري الممتاز", club: "Old FC", day: 17, minutes: 90, goals: 1, assists: 0 },
  { id: "other-segment-excluded", scope: "league", season: 4, country: "مصر", competition: "الدوري الممتاز", club: "Old FC", segmentId: "different-segment", day: 18, minutes: 90, goals: 1, assists: 0 }
], [legacySeasonLogRow]);
assert.deepEqual(Array.from(legacyArchive.matches, row => row.id),
  ["legacy-season-log", "legacy-no-scope", "legacy-whitespace-alias", "segment-only"],
  "transfer archives must recover legacy league rows while excluding cups, other clubs, seasons, and segments");
assert.equal(legacyArchive.stats.played, 3,
  "archived player appearances must exclude a zero-minute fixture while retaining that fixture in the match audit");
assert.equal(legacyArchive.stats.minutes, 240);
assert.equal(legacyArchive.stats.goals, 1);
assert.equal(legacyArchive.stats.assists, 2);

const state = {
  calendarDay: 190, season: 4, winterBreakPending: true, seasonPhase: "winterBreak",
  careerStarted: true, retired: false, age: 24, loan: null, freeAgent: false,
  transferCooldown: 0, daysSinceTransfer: 14, apps: 12, trust: 60,
  clubName: "نادي أ", leagueCountry: "مصر", academyReserve: false, academyGraduationPending: false,
  transferOffersWindowId: "winter-season-4", transferOffersAttemptKey: "legacy-attempt",
  transferOffers: [{ id: "legacy-january-offer", status: "pending", windowId: "winter-season-4",
    club: "نادي ب", country: "مصر", league: "الدوري المصري", division: 1, power: 50 }]
};
let generatedOffers = 0;
const sandbox = {
  state,
  window: { LWTransferAwards: { generateOffers() { generatedOffers++; return []; } }, LWWorldDB: { normalize: value => String(value || "").trim().toLocaleLowerCase() } },
  canAccessTransferMarket: () => true,
  activeCupInProgress: () => true,
  transferPlayerProfile: () => ({
    name: "لاعب اختبار", currentClub: "نادي اختبار", country: "مصر", appearances: 12,
    form: 7.1, ovr: 68, currentClubPower: 60, goals: 4, assists: 3, age: 24,
    potential: 80, position: "مهاجم"
  }),
  transferTargets: () => [],
  transferFactors: () => ({ ageAdjustment: 0, contractAdjustment: 0, currentRoleAdjustment: 0, positionAdjustment: 0, targetRoleAdjustment: 0 }),
  transferAverageRating: () => 6.1,
  overall: () => 68,
  isYouthAcademyPlayer: () => false,
  saveGame: () => {},
  log: () => {},
  setStory: () => {},
  console
};
vm.createContext(sandbox);
vm.runInContext(freeAgentEligibilitySource, sandbox, { filename: "free-agent-match-eligibility" });
assert.equal(sandbox.careerMatchPlayerEligible({ freeAgent: false }, "league"), true,
  "a contracted player remains eligible for club matches");
assert.equal(sandbox.careerMatchPlayerEligible({ freeAgent: true }, "league"), false,
  "an unsigned free agent must not be eligible for club matches");
assert.equal(sandbox.careerMatchPlayerEligible({ freeAgent: "true" }, "cup"), false,
  "legacy string booleans must also block club appearances");
assert.equal(sandbox.careerMatchPlayerEligible({ freeAgent: " yes " }, "league"), false,
  "legacy affirmative strings must not bypass the free-agent match guard");
assert.equal(sandbox.careerMatchPlayerEligible({ freeAgent: "on" }, "league"), false,
  "legacy on/off flags must use the same parser as career-state migration");
assert.equal(sandbox.careerMatchPlayerEligible({ retired: "yes" }, "international"), false,
  "legacy affirmative retirement flags must block national-team appearances");
assert.equal(sandbox.careerMatchPlayerEligible({ freeAgent: false, contractType: " free-agent ", contractSeasons: 2 }, "league"), false,
  "whitespace around a legacy free-agent contract type must not bypass eligibility");
assert.equal(sandbox.careerMatchPlayerEligible({
  freeAgent: false, contractSeasons: 0, loan: { parentFreeAgent: " YES ", parentContractSeasons: 2 }
}, "league"), false,
  "a legacy affirmative parent free-agent flag must block an invalid loan appearance");
assert.equal(sandbox.careerMatchPlayerEligible({
  freeAgent: true, contractSeasons: 0, loan: { parentFreeAgent: "off", parentContractSeasons: 1 }
}, "league"), true,
  "a legacy explicit false parent flag must preserve an active parent contract while on loan");
assert.equal(sandbox.careerMatchPlayerEligible({ freeAgent: false, contractSeasons: 0 }, "league"), false,
  "an expired contract must block club appearances even if an old save missed the free-agent flag");
assert.equal(sandbox.careerMatchPlayerEligible({ freeAgent: false, contractType: "free-agent", contractSeasons: 2 }, "league"), false,
  "the saved free-agent contract type must block club appearances");
assert.equal(sandbox.careerMatchPlayerEligible({ freeAgent: true, contractSeasons: 0, loan: { parentFreeAgent: false, parentContractSeasons: 1 } }, "league"), true,
  "an active parent contract must remain eligible while the player is on loan");
assert.equal(sandbox.careerMatchPlayerEligible({ freeAgent: true }, "international"), true,
  "free-agent status must not block national-team appearances");
assert.equal(sandbox.careerMatchPlayerEligible({ freeAgent: true, retired: true }, "international"), false,
  "retirement must still block national-team appearances");
assert.match(careerMatchSimulationSource, /careerMatchPlayerEligible\(state,scope\)/,
  "the match simulator must make free agents unavailable for club fixtures");
assert.match(applyMatchResultSource, /careerMatchPlayerEligible\(state,incomingScope\)/,
  "result settlement must reject any club appearance that bypasses the simulator");
assert.match(app, /if\(wages&&grossWeeklyWage>0&&careerMatchPlayerEligible\(state,"league"\)\)/,
  "weekly payroll must be gated by an active club contract");
vm.runInContext(
  transferWindowSource + "\n" + transferOfferMatchSource + "\n" + transferOfferCurrentMatchSource + "\n"
    + normalizedTargetKeySource + "\n" + legacyMigrationSource + "\n" + reconciliationSource + "\n" + dedupeOffersSource + "\n"
    + transferEligibilitySource + "\n" + ensureOffersSource + "\n" + offerAvailabilitySource,
  sandbox,
  { filename: "transfer-window-regression" }
);

const winterWindowDuringBreak = sandbox.transferWindow();
assert.equal(winterWindowDuringBreak.open, true, "day 190 must be inside the winter window");
assert.equal(winterWindowDuringBreak.id, "winter-0", "winter window identity must be based on calendar year, not break UI state");
sandbox.ensureTransferOffers();
assert.equal(generatedOffers, 0, "a legacy saved winter offer must not trigger a duplicate offer batch");
assert.equal(state.transferOffers[0].status, "pending", "the saved offer must stay pending during the break");
assert.equal(sandbox.offerIsAvailable(state.transferOffers[0]), true, "the legacy offer must be negotiable during the winter break");
state.trust = 10;
assert.equal(sandbox.offerIsAvailable(state.transferOffers[0]), false, "an offer must become unavailable when coach trust falls below the eligibility threshold");
state.trust = 60;
state.daysSinceTransfer = 3;
assert.equal(sandbox.offerIsAvailable(state.transferOffers[0]), false, "an offer must not be negotiable during the seven-day post-transfer cooldown");
state.daysSinceTransfer = 14;
state.transferCooldown = 2;
assert.equal(sandbox.offerIsAvailable(state.transferOffers[0]), false, "an offer must respect the explicit transfer cooldown");
state.transferCooldown = 0;

state.winterBreakPending = false;
state.seasonPhase = "secondHalf";
const winterWindowAfterContinue = sandbox.transferWindow();
assert.equal(winterWindowAfterContinue.id, winterWindowDuringBreak.id,
  "continuing into the second half must not change the active winter transfer-window ID");
sandbox.ensureTransferOffers();
assert.equal(generatedOffers, 0, "continuing the season must not regenerate or discard offers from the same window");
assert.equal(state.transferOffers[0].status, "pending", "the legacy offer must remain pending after continuing the season");
assert.equal(sandbox.offerIsAvailable(state.transferOffers[0]), true,
  "an offer from an older save must remain negotiable after the winter-break flag is cleared");
assert.equal(sandbox.transferOfferMatchesCurrentWindow(state.transferOffers[0], winterWindowAfterContinue), true,
  "the completion validator must accept the same legacy winter offer as the negotiation UI");

state.calendarDay = 230;
assert.equal(sandbox.offerIsAvailable(state.transferOffers[0]), false,
  "a winter offer must become unavailable once the real calendar window closes");
state.calendarDay = 365 + 190;
state.season = 5;
assert.equal(sandbox.offerIsAvailable(state.transferOffers[0]), false,
  "a legacy offer from the previous season must not leak into the next winter window");
assert.equal(sandbox.transferOfferMatchesCurrentWindow(state.transferOffers[0], sandbox.transferWindow()), false,
  "the completion validator must reject a legacy offer from the previous winter");



 // A legacy January offer must pass both negotiation and final transfer validation.
 // The old transferTo check compared winter-season-N directly with winter-0.
 const legacyWinterCompletion = {
  state: {
   retired: false, age: 24, loan: null, freeAgent: false, contractType: "free-agent", calendarDay: 190, season: 4,
   clubName: "نادي أ", leagueCountry: "مصر", leagueDivision: 1, clubPower: 60,
   pendingTransfer: { club: "نادي ب", country: "مصر", league: "الدوري المصري", division: 1,
    source: "LWWorldDB", season: "2026/27", windowId: "winter-season-4",
    power: 65, wage: 700, contractSeasons: 3, role: "أساسي", currency: "ج.م", signingBonus: 120 },
   contractOffer: { club: "نادي أ", season: 4, wage: 300, seasons: 3 },
   lastOfferWindow: "", seasonApps: 12, seasonPhase: "secondHalf", winterBreakPending: false,
   trust: 55, followers: 100, money: 500, weeklyWage: 250, contractSeasons: 2,
   currentReleaseClause: 0, goalBonusPerGoal: 0, cleanSheetBonus: 0, transferCooldown: 0,
   transferOffers: [{ id: "other-pending", status: "pending" }], transferHistory: []
  },
  transferWindow: () => ({ open: true, id: "winter-0", name: "الانتقالات الشتوية", days: 24 }),
  canAccessTransferMarket: () => true,
  transferTargets: () => [{ club: "نادي ب", country: "مصر", league: "الدوري المصري" }],
  seasonMatchTotal: () => 30,
  club: () => ({ name: "نادي أ" }),
  archiveCupForTransfer: () => {},
  archiveLeagueSegment: () => {},
  clubPowerFor: () => 65,
  clubTierForPower: () => 1,
  clamp: (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0)),
  createLeague: () => ["نادي ب", "نادي تاني"],
  seedDestinationLeagueProgress: () => 18,
  buildFixtureSchedule: () => [],
  setStory: () => {},
  log: () => {},
  saveGame: () => {},
  render: () => {},
  showPage: () => {},
  toast: () => {},
  currencyLabel: () => "ج.م",
  window: { LWAgentRuntime: null }
 };
 vm.createContext(legacyWinterCompletion);
 vm.runInContext(freeAgentEligibilitySource + "\n" + transferOfferMatchSource + "\n"
  + transferOfferCurrentMatchSource + "\n" + transferToSource,
  legacyWinterCompletion, { filename: "legacy-winter-transfer-completion" });
 assert.equal(legacyWinterCompletion.transferOfferMatchesCurrentWindow(
  legacyWinterCompletion.state.pendingTransfer, legacyWinterCompletion.transferWindow()), true,
  "legacy winter-season-4 must resolve to the active winter-0 window");
 legacyWinterCompletion.transferTo();
 assert.equal(legacyWinterCompletion.state.clubName, "نادي ب",
  "an accepted legacy winter offer must complete the transfer instead of being discarded");
 assert.equal(legacyWinterCompletion.state.contractType, "professional",
  "signing a club contract must replace a legacy free-agent contract type");
 assert.equal(legacyWinterCompletion.careerMatchPlayerEligible(legacyWinterCompletion.state, "league"), true,
  "a player signed from a legacy free-agent save must become eligible for club matches");
 assert.equal(legacyWinterCompletion.careerMatchPlayerEligible({
  retired: false, freeAgent: false, contractType: "professional", contractSeasons: 0,
  loan: { parentFreeAgent: false, parentContractSeasons: 1, parentContractType: "free-agent" }
}, "league"), false, "a loan must still respect the parent contract type when the parent is a free agent");
 assert.equal(legacyWinterCompletion.state.pendingTransfer, null,
  "a completed transfer must clear its pending offer");
assert.equal(legacyWinterCompletion.state.contractOffer, null,
  "a permanent transfer must discard the previous club's pending renewal offer");
 assert.equal(legacyWinterCompletion.state.transferCooldown, 14,
  "a completed transfer must apply the normal transfer cooldown");
 assert.equal(legacyWinterCompletion.state.transferHistory.length, 1,
  "a completed transfer must be recorded exactly once");
 assert.equal(legacyWinterCompletion.state.transferOffers[0].status, "expired",
  "other pending offers must be closed after the player changes clubs");
 legacyWinterCompletion.transferTo();
 assert.equal(legacyWinterCompletion.state.transferHistory.length, 1,
  "replaying transfer completion without a pending transfer must not duplicate history");


 // Clubs with the same name in different countries are distinct destinations.
const sameNameDifferentCountry = {
  state: {
    retired: false, age: 24, loan: null, freeAgent: false, calendarDay: 30, season: 4, day: 30,
    clubName: "United", leagueCountry: "مصر", leagueDivision: 1, clubPower: 58,
    pendingTransfer: {
      club: "United", country: "إنجلترا", league: "Premier League", division: 1,
      source: "LWWorldDB", season: "2026/27", windowId: "summer-0",
      power: 72, wage: 900, contractSeasons: 3, role: "أساسي", currency: "£", signingBonus: 200
    },
    transferOffers: [], transferHistory: [], money: 500, weeklyWage: 250, contractSeasons: 2,
    currentReleaseClause: 0, goalBonusPerGoal: 0, cleanSheetBonus: 0, transferCooldown: 0,
    followers: 100, trust: 55, role: "بديل", daysSinceTransfer: 14,
    seasonApps: 12, seasonAppsTarget: 30, seasonPhase: "firstHalf", winterBreakPending: false
  },
  transferWindow: () => ({ open: true, id: "summer-0", name: "الانتقالات الصيفية", days: 20 }),
  transferTargets: () => [{ club: "United", country: "إنجلترا", league: "Premier League" }],
  canAccessTransferMarket: () => true,
  seasonMatchTotal: () => 30,
  club: () => ({ name: "United" }),
  archiveCupForTransfer: () => {},
  archiveLeagueSegment: () => {},
  clubPowerFor: () => 72,
  clubTierForPower: () => 2,
  clamp: (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0)),
  createLeague: () => ["United", "City"],
  seedDestinationLeagueProgress: () => 18,
  buildFixtureSchedule: () => [],
  setStory: () => {},
  log: () => {},
  saveGame: () => {},
  render: () => {},
  showPage: () => {},
  toast: () => {},
  currencyLabel: () => "£",
  window: { LWAgentRuntime: null }
};
vm.createContext(sameNameDifferentCountry);
vm.runInContext(
  transferOfferMatchSource + "\n" + transferOfferCurrentMatchSource + "\n" + transferToSource,
  sameNameDifferentCountry,
  { filename: "same-name-cross-country-transfer" }
);
// A new club's contract must not inherit the old club's renewal decision for this season.
const oneSeasonContractTransferScenario = {
  ...sameNameDifferentCountry,
  state: {
    ...sameNameDifferentCountry.state,
    contractDecisionSeason: 4,
    pendingTransfer: {
      ...sameNameDifferentCountry.state.pendingTransfer,
      contractSeasons: 1
    },
    transferOffers: [], transferHistory: []
  }
};
vm.createContext(oneSeasonContractTransferScenario);
vm.runInContext(
  transferOfferMatchSource + "\n" + transferOfferCurrentMatchSource + "\n" + transferToSource,
  oneSeasonContractTransferScenario,
  { filename: "one-season-transfer-renewal-reset" }
);
oneSeasonContractTransferScenario.transferTo();
assert.equal(oneSeasonContractTransferScenario.state.contractSeasons, 1,
  "the destination's one-season contract must remain intact after signing");
assert.equal(oneSeasonContractTransferScenario.state.contractDecisionSeason, 0,
  "a permanent transfer must clear the previous club's same-season renewal decision");
assert.notEqual(Number(oneSeasonContractTransferScenario.state.contractDecisionSeason),
  Number(oneSeasonContractTransferScenario.state.season),
  "the destination club must be allowed to offer renewal at the end of the current season");

// A negotiated zero signing bonus is a real contract term, not a request for the
// legacy two-week-wage fallback. Missing legacy values must still retain that fallback.
const zeroSigningBonusScenario = {
  ...sameNameDifferentCountry,
  state: {
    ...sameNameDifferentCountry.state,
    pendingTransfer: { ...sameNameDifferentCountry.state.pendingTransfer, signingBonus: 0 },
    transferOffers: [], transferHistory: [], money: 500
  }
};
vm.createContext(zeroSigningBonusScenario);
vm.runInContext(
  transferOfferMatchSource + "\n" + transferOfferCurrentMatchSource + "\n" + transferToSource,
  zeroSigningBonusScenario,
  { filename: "explicit-zero-signing-bonus" }
);
zeroSigningBonusScenario.transferTo();
assert.equal(zeroSigningBonusScenario.state.money, 500,
  "an explicitly negotiated zero signing bonus must not be replaced by two weeks of wages");

const legacyMissingSigningBonusScenario = {
  ...sameNameDifferentCountry,
  state: {
    ...sameNameDifferentCountry.state,
    pendingTransfer: { ...sameNameDifferentCountry.state.pendingTransfer },
    transferOffers: [], transferHistory: [], money: 500
  }
};
delete legacyMissingSigningBonusScenario.state.pendingTransfer.signingBonus;
vm.createContext(legacyMissingSigningBonusScenario);
vm.runInContext(
  transferOfferMatchSource + "\n" + transferOfferCurrentMatchSource + "\n" + transferToSource,
  legacyMissingSigningBonusScenario,
  { filename: "legacy-missing-signing-bonus" }
);
legacyMissingSigningBonusScenario.transferTo();
assert.equal(legacyMissingSigningBonusScenario.state.money, 2300,
  "legacy offers without a signing-bonus field must retain the two-week destination-wage fallback");
 
// Agent commission on a completed transfer is based on the actual signing bonus,
// not an assumed two weeks of wages. Legacy offers still use their two-week fallback.
const agentSigningBonusCases = [
  { label: "negotiated signing bonus", bonus: 200, expectedGross: 200 },
  { label: "explicit zero signing bonus", bonus: 0, expectedGross: 0 },
  { label: "legacy missing signing bonus", missing: true, expectedGross: 1800 }
];
for (const feeCase of agentSigningBonusCases) {
  const feeCalls = [];
  const feeState = {
    ...sameNameDifferentCountry.state,
    pendingTransfer: { ...sameNameDifferentCountry.state.pendingTransfer },
    transferOffers: [], transferHistory: [], money: 500
  };
  if (feeCase.missing) delete feeState.pendingTransfer.signingBonus;
  else feeState.pendingTransfer.signingBonus = feeCase.bonus;
  const feeScenario = {
    ...sameNameDifferentCountry,
    state: feeState,
    window: {
      LWAgentRuntime: {
        chargeFee(_state, reason, gross) {
          feeCalls.push({ reason, gross });
          return 0;
        }
      }
    }
  };
  vm.createContext(feeScenario);
  vm.runInContext(
    transferOfferMatchSource + "\n" + transferOfferCurrentMatchSource + "\n" + transferToSource,
    feeScenario,
    { filename: "agent-signing-bonus-commission-" + feeCase.label.replace(/\s+/g, "-") }
  );
  feeScenario.transferTo();
  assert.equal(feeCalls.length, 1, feeCase.label + " must call the agent fee handler exactly once");
  assert.equal(feeCalls[0].reason, "مكافأة التوقيع",
    feeCase.label + " must identify the signing-bonus commission");
  assert.equal(feeCalls[0].gross, feeCase.expectedGross,
    feeCase.label + " must calculate commission from the actual signing bonus");
}


sameNameDifferentCountry.transferTo();
assert.equal(sameNameDifferentCountry.state.clubName, "United",
  "the destination club name may legitimately match the previous club name");
assert.equal(sameNameDifferentCountry.state.leagueCountry, "إنجلترا",
  "a same-named club in another country must not be rejected as the current club");
assert.equal(sameNameDifferentCountry.state.leagueCompetition, "Premier League");
assert.equal(sameNameDifferentCountry.state.pendingTransfer, null,
  "a valid same-name cross-country transfer must complete and clear the pending offer");
assert.equal(sameNameDifferentCountry.state.money, 700,
  "the accepted destination signing bonus must still be credited");
assert.equal(sameNameDifferentCountry.state.transferHistory.length, 1,
  "the cross-country transfer must be recorded exactly once");

// Pending contract identity must survive harmless formatting changes in club/country/league labels.
const normalizedDestinationTransfer = {
  ...sameNameDifferentCountry,
  state: {
    ...sameNameDifferentCountry.state,
    clubName: "نادي أ", leagueCountry: "مصر",
    pendingTransfer: {
      ...sameNameDifferentCountry.state.pendingTransfer,
      club: "Real Betis", country: "España", league: "LaLiga",
      windowId: "summer-0", signingBonus: 250
    },
    transferOffers: [], transferHistory: [], money: 500
  },
  transferTargets: () => [{
    club: " REAL-BETIS ", country: "ESPAÑA", league: "laliga"
  }],
  window: {
    LWAgentRuntime: null,
    LWWorldDB: {
      normalize: value => String(value || "").normalize("NFD")
        .replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, "")
        .replace(/[إأآ]/g, "ا").replace(/ى/g, "ي")
        .toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]/gu, "")
    }
  }
};
vm.createContext(normalizedDestinationTransfer);
vm.runInContext(
  transferOfferMatchSource + "\n" + transferOfferCurrentMatchSource + "\n" + transferToSource,
  normalizedDestinationTransfer,
  { filename: "normalized-pending-transfer-identity" }
);
assert.doesNotThrow(() => normalizedDestinationTransfer.transferTo(),
  "format-only club/country/league differences must not invalidate a saved accepted destination");
assert.equal(normalizedDestinationTransfer.state.clubName, "Real Betis");
assert.equal(normalizedDestinationTransfer.state.leagueCountry, "España");
assert.equal(normalizedDestinationTransfer.state.pendingTransfer, null);
assert.equal(normalizedDestinationTransfer.state.transferHistory.length, 1);

// A formatting variant of the player's own club is still the current club, not a new destination.
const normalizedSelfTransfer = {
  state: {
    retired: false, age: 24, loan: null, clubName: "Al Ahly", leagueCountry: "مصر",
    freeAgent: false, lastOfferWindow: "",
    pendingTransfer: { club: "AL-AHLY", country: "مِصْر", windowId: "summer-0" }
  },
  canAccessTransferMarket: () => true,
  transferWindow: () => ({ open: true, id: "summer-0", name: "الانتقالات الصيفية", days: 20 }),
  transferTargets: () => [{ club: "AL-AHLY", country: "مِصْر", league: "الدوري المصري" }],
  seasonMatchTotal: () => { throw new Error("self-transfer must exit before mutating season state"); }
};
vm.createContext(normalizedSelfTransfer);
vm.runInContext(
  transferOfferMatchSource + "\n" + transferOfferCurrentMatchSource + "\n" + transferToSource,
  normalizedSelfTransfer,
  { filename: "normalized-self-transfer-guard" }
);
assert.doesNotThrow(() => normalizedSelfTransfer.transferTo(),
  "a case/spacing/diacritic variant of the current club must be rejected as a self-transfer");
assert.equal(normalizedSelfTransfer.state.clubName, "Al Ahly");
assert.ok(normalizedSelfTransfer.state.pendingTransfer,
  "the guard must not discard the pending state when it recognizes a self-transfer");

// Free-agent offers are valid only in the matching rolling 14-day window.
 const freeAgentWindowState = {
  state: { freeAgent: true, calendarDay: 30, lastOfferWindow: "", season: 1 },
  transferWindow: () => ({ open: false, id: "closed-0", name: "السوق مغلق", days: 5 })
 };
 vm.createContext(freeAgentWindowState);
 vm.runInContext(transferOfferMatchSource + "\n" + transferOfferCurrentMatchSource, freeAgentWindowState,
  { filename: "free-agent-window-identity" });
const freeAgentWindowBoundaries = [
  [1, "free-agent-0"],
  [14, "free-agent-0"],
  [15, "free-agent-1"],
  [28, "free-agent-1"],
  [29, "free-agent-2"],
  [42, "free-agent-2"],
  [43, "free-agent-3"]
];
for (const [calendarDay, expectedWindowId] of freeAgentWindowBoundaries) {
  freeAgentWindowState.state.calendarDay = calendarDay;
  assert.equal(freeAgentWindowState.currentFreeAgentTransferWindowId(), expectedWindowId,
    "rolling free-agent windows must use complete 14-day blocks starting on calendar day 1");
}
freeAgentWindowState.state.calendarDay = 30;
 assert.equal(freeAgentWindowState.transferOfferMatchesCurrentWindow(
  { id: "old-free-agent", windowId: "free-agent-1" }, freeAgentWindowState.transferWindow()), false,
  "an offer from the previous 14-day free-agent period must expire");
 assert.equal(freeAgentWindowState.transferOfferMatchesCurrentWindow(
  { id: "current-free-agent", windowId: "free-agent-2" }, freeAgentWindowState.transferWindow()), true,
  "the current 14-day free-agent offer must remain valid");

const cupScenario = {
  state: {
    retired: false, age: 24, academyReserve: false, academyGraduationPending: false,
    careerStarted: true, clubName: "نادي أ", leagueCountry: "مصر", loan: null,
    apps: 12, daysSinceTransfer: 14, transferCooldown: 0, trust: 60, freeAgent: false
  },
  isYouthAcademyPlayer: () => false,
  activeCupInProgress: () => true,
  transferWindow: () => ({ open: true, name: "الانتقالات الصيفية", days: 20 }),
  transferAverageRating: () => 6.8,
  transferFactors: () => ({ ageAdjustment: 0, contractAdjustment: 0, currentRoleAdjustment: 0, positionAdjustment: 0, targetRoleAdjustment: 0 }),
  overall: () => 70
};
vm.createContext(cupScenario);
vm.runInContext(transferEligibilitySource, cupScenario, { filename: "transferEligibilityReason" });
assert.equal(cupScenario.transferEligibilityReason({ club: "نادي ب", country: "مصر", power: 50 }), "",
  "active cups must not block transfer approaches during an open window");


 // A transfer approach must preserve the destination club's actual division.
 // The world database can return second-tier clubs; hard-coding division 1 silently promoted them.
 const secondTierTarget = {
   club: "نادي الدرجة الثانية", country: "مصر", division: 2,
   league: "الدوري المصري — الدرجة الثانية", season: "2026/27",
   source: "LWWorldDB", power: 58
 };
 // Automatic approaches must use the same persisted offer and negotiation flow as the transfer-market screen.
const secondTierOffer = {
  ...secondTierTarget, id: "offer-summer-0-second-tier", windowId: "summer-0",
  role: "أساسي", wage: 2500, currency: "ج.م", status: "pending",
  signingBonus: 10000, goalBonus: 450, cleanSheetBonus: 300,
  maxWage: 3000, releaseClause: 180000, contractSeasons: 3
};
const offerScenario = {
  state: {
    retired: false, age: 24, careerStarted: true, academyReserve: false,
    academyGraduationPending: false, loan: null, transferCooldown: 0,
    daysSinceTransfer: 14, apps: 12, trust: 60, clubName: "نادي أ",
    leagueCountry: "مصر", lastOfferWindow: "", agent: false,
    pendingTransfer: null, transferNegotiation: null, transferOffers: []
  },
  window: { LWAgentRuntime: null },
  canAccessTransferMarket: () => true, migrateLegacyPendingTransferOffer: () => null,
  transferWindow: () => ({ open: true, id: "summer-0", name: "الانتقالات الصيفية", days: 20 }),
  overall: () => 68, transferAverageRating: () => 7.0, randomUnit: () => 0,
  ensureTransferOffers: () => { offerScenario.state.transferOffers = [secondTierOffer]; },
  offerIsAvailable: offer => !!offer && offer.status === "pending",
  beginTransferNegotiation: id => { offerScenario.negotiationStarted = id; },
  rejectTransferOffer: id => { offerScenario.rejected = id; },
  saveGame: () => {}, render: () => {}, currencyLabel: () => "ج.م",
  openModal: (title, body, actions) => { offerScenario.modalActions = actions; }
};
vm.createContext(offerScenario);
vm.runInContext(maybeOfferTransferSource, offerScenario, { filename: "unified-second-tier-transfer-approach" });
offerScenario.maybeOfferTransfer();
assert.equal(offerScenario.state.pendingTransfer, null,
  "an automatic approach must not create a separate direct-transfer transaction");
assert.equal(offerScenario.state.transferOffers[0].division, 2,
  "the unified official offer must preserve the selected second-tier division");
assert.equal(offerScenario.state.transferOffers[0].league, secondTierTarget.league,
  "the unified offer must preserve the destination competition");
assert.equal(offerScenario.state.transferOffers[0].source, "LWWorldDB",
  "the unified offer must preserve destination data provenance");
assert.equal(offerScenario.state.lastOfferWindow, "summer-0",
  "the automatic approach must remain limited to one prompt per transfer window");
assert.ok(Array.isArray(offerScenario.modalActions) && offerScenario.modalActions.length === 3,
  "the automatic approach must offer negotiate, reject, and defer actions");
offerScenario.modalActions[0].action();
assert.equal(offerScenario.negotiationStarted, secondTierOffer.id,
  "the automatic approach must enter the official contract negotiation engine");
offerScenario.modalActions[1].action();
assert.equal(offerScenario.rejected, secondTierOffer.id,
  "rejecting an automatic approach must use the official offer rejection handler");

let blockedEnsureCalls = 0, blockedModal = false;
const blockedApproach = {
  state: { retired: false, age: 24, careerStarted: true, loan: null, transferCooldown: 0,
    daysSinceTransfer: 14, apps: 12, trust: 60, lastOfferWindow: "",
    pendingTransfer: { club: "نادي قديم", country: "مصر" }, transferNegotiation: null },
  window: { LWAgentRuntime: null }, canAccessTransferMarket: () => true,
  migrateLegacyPendingTransferOffer: () => null,
  transferWindow: () => ({ open: true, id: "summer-0" }),
  ensureTransferOffers: () => { blockedEnsureCalls++; },
  overall: () => 68, transferAverageRating: () => 7, randomUnit: () => 0,
  openModal: () => { blockedModal = true; }
};
vm.createContext(blockedApproach);
vm.runInContext(maybeOfferTransferSource, blockedApproach, { filename: "pending-transfer-guard" });
blockedApproach.maybeOfferTransfer();
assert.equal(blockedEnsureCalls, 0, "a saved direct offer must block a second automatic offer batch");
assert.equal(blockedModal, false, "a second automatic offer must not overlap an unresolved transfer");

const duplicateOfferScenario = {
  state: { transferOffers: [
    { id: "lower-offer", status: "pending", windowId: "summer-0", club: " نادي ب ", country: "مصر", wage: 900 },
    { id: "higher-offer", status: "pending", windowId: "summer-0", club: "نادي ب", country: "مصر", wage: 1500 },
    { id: "next-window", status: "pending", windowId: "winter-0", club: "نادي ب", country: "مصر", wage: 2000 }
  ], transferNegotiation: null },
  window: { LWWorldDB: { normalize: value => String(value || "").trim().toLocaleLowerCase() } }
};
vm.createContext(duplicateOfferScenario);
vm.runInContext(transferOfferMatchSource + "\n" + normalizedTargetKeySource + "\n" + dedupeOffersSource,
  duplicateOfferScenario, { filename: "duplicate-club-offer-dedupe" });
assert.equal(duplicateOfferScenario.dedupeTransferOffersForWindow("summer-0",
  { open: true, id: "summer-0", name: "الانتقالات الصيفية" }), true,
  "duplicate pending offers must be reconciled for the active transfer window");
assert.equal(duplicateOfferScenario.state.transferOffers[0].status, "superseded",
  "the weaker duplicate offer must be marked superseded, not silently deleted");
assert.equal(duplicateOfferScenario.state.transferOffers[0].supersededBy, "higher-offer",
  "the superseded offer must retain a pointer to the surviving offer");
assert.equal(duplicateOfferScenario.state.transferOffers[1].status, "pending",
  "the stronger offer from the same club must remain available");
assert.equal(duplicateOfferScenario.state.transferOffers[2].status, "pending",
  "offers from a different transfer window must not be deduplicated");

const activeNegotiationDuplicate = {
  state: { transferOffers: [
    { id: "active-negotiation", status: "pending", windowId: "summer-0", club: "نادي ج", country: "مصر", wage: 800 },
    { id: "new-higher-offer", status: "pending", windowId: "summer-0", club: "نادي ج", country: "مصر", wage: 2500 }
  ], transferNegotiation: { offerId: "active-negotiation" } },
  window: { LWWorldDB: { normalize: value => String(value || "").trim().toLocaleLowerCase() } }
};
vm.createContext(activeNegotiationDuplicate);
vm.runInContext(transferOfferMatchSource + "\n" + normalizedTargetKeySource + "\n" + dedupeOffersSource,
  activeNegotiationDuplicate, { filename: "preserve-active-transfer-negotiation" });
activeNegotiationDuplicate.dedupeTransferOffersForWindow("summer-0",
  { open: true, id: "summer-0", name: "الانتقالات الصيفية" });
assert.equal(activeNegotiationDuplicate.state.transferOffers[0].status, "pending",
  "an offer with active negotiations must not be superseded by a duplicate");
assert.equal(activeNegotiationDuplicate.state.transferOffers[1].status, "superseded",
  "a duplicate must not replace an offer the player is already negotiating");

const negotiationGuard = {
  state: { pendingTransfer: { club: "نادي قديم", country: "مصر" }, transferNegotiation: null,
    transferOffers: [{ id: "new-offer", status: "pending" }] },
  migrateLegacyPendingTransferOffer: () => null, ensureTransferOffers: () => {},
  offerIsAvailable: () => true, toast: message => { negotiationGuard.toastMessage = message; },
  renderTransferMarket: () => {}
};
vm.createContext(negotiationGuard);
vm.runInContext(beginNegotiationSource, negotiationGuard, { filename: "prevent-parallel-transfer-negotiations" });
negotiationGuard.beginTransferNegotiation("new-offer");
assert.equal(negotiationGuard.state.transferNegotiation, null,
  "the negotiation screen must not overwrite an unresolved direct transfer");
assert.match(negotiationGuard.toastMessage, /عرض انتقال معلّق/,
  "the player must be told to resolve the pending transfer first");

const legacyMigration = {
  state: { pendingTransfer: { club: "نادي محفوظ", country: "مصر", league: "الدوري المصري — الدرجة الثانية",
    division: 2, source: "LWWorldDB", windowId: "summer-0", wage: 1700, role: "أساسي", contractSeasons: 4 },
    transferOffers: [], transferHistory: [], lastOfferWindow: "summer-0", freeAgent: false,
    season: 4, day: 22, calendarDay: 100 },
  window: { LWWorldDB: { normalize: value => String(value || "").trim().toLocaleLowerCase() } },
  canAccessTransferMarket: () => true, transferWindow: () => ({ open: true, id: "summer-0", name: "الانتقالات الصيفية" }),
  stableHash: value => String(value).split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0),
  clamp: (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0)),
  currencyLabel: () => "ج.م", saveGame: () => { legacyMigration.saved = true; }
};
vm.createContext(legacyMigration);
vm.runInContext(transferOfferMatchSource + "\n" + transferOfferCurrentMatchSource + "\n"
  + normalizedTargetKeySource + "\n" + legacyMigrationSource, legacyMigration,
  { filename: "legacy-pending-transfer-migration" });
const migratedLegacyOffer = legacyMigration.migrateLegacyPendingTransferOffer();
assert.equal(legacyMigration.state.pendingTransfer, null,
  "a legacy direct pending transfer must be converted instead of blocking the new negotiation flow");
assert.equal(migratedLegacyOffer.legacyDirectOffer, true,
  "the migrated offer must retain a marker identifying its legacy origin");
assert.equal(migratedLegacyOffer.division, 2, "legacy offer migration must preserve the destination division");
assert.equal(migratedLegacyOffer.wage, 1700, "legacy offer migration must preserve the previously negotiated wage");
assert.equal(migratedLegacyOffer.windowId, "summer-0", "legacy offer migration must retain its original transfer window");
assert.equal(legacyMigration.state.transferOffersWindowId, "summer-0",
  "migration must mark the active window so ensureTransferOffers does not regenerate a replacement batch");
assert.equal(legacyMigration.saved, true, "legacy offer migration must be persisted immediately");
assert.equal(migratedLegacyOffer.contractSeasons, 4,
  "legacy offer migration must preserve the negotiated contract term");
legacyMigration.state.transferNegotiation = null;
legacyMigration.migrateLegacyPendingTransferOffer = () => migratedLegacyOffer;
legacyMigration.ensureTransferOffers = () => {};
legacyMigration.offerIsAvailable = () => true;
legacyMigration.toast = () => {};
legacyMigration.renderTransferMarket = () => {};
vm.runInContext(beginNegotiationSource, legacyMigration, { filename: "preserve-legacy-contract-term-in-negotiation" });
legacyMigration.beginTransferNegotiation(migratedLegacyOffer.id);
assert.equal(legacyMigration.state.transferNegotiation.contractSeasons, 4,
  "opening negotiations must use the migrated offer's original contract term instead of resetting it to three seasons");


const expiredLegacyMigration = {
  state: { pendingTransfer: { club: "نادي قديم", country: "مصر", windowId: "summer-0" },
    transferOffers: [], transferHistory: [], lastOfferWindow: "summer-0", freeAgent: false, season: 4, day: 30 },
  window: { LWWorldDB: { normalize: value => String(value || "").trim().toLocaleLowerCase() } },
  canAccessTransferMarket: () => true,
  transferWindow: () => ({ open: true, id: "winter-0", name: "الانتقالات الشتوية" }),
  saveGame: () => { expiredLegacyMigration.saved = true; }
};
vm.createContext(expiredLegacyMigration);
vm.runInContext(transferOfferMatchSource + "\n" + transferOfferCurrentMatchSource + "\n"
  + normalizedTargetKeySource + "\n" + legacyMigrationSource, expiredLegacyMigration,
  { filename: "expired-legacy-pending-transfer" });
assert.equal(expiredLegacyMigration.migrateLegacyPendingTransferOffer(), null,
  "a legacy offer from a closed window must not be reactivated");
assert.equal(expiredLegacyMigration.state.pendingTransfer, null,
  "an expired legacy direct offer must be cleared from the active save");
assert.match(expiredLegacyMigration.state.transferHistory[0].text, /انتهت صلاحية/,
  "an expired legacy offer must leave an audit entry in the career history");


const malformedLegacyMigration = {
  state: {
    pendingTransfer: { club: "نادي قديم", windowId: "summer-0", wage: 1700 },
    transferOffers: [{ id: "valid-after-cleanup", status: "pending", club: "نادي جديد", country: "مصر" }],
    transferHistory: [], lastOfferWindow: "summer-0", freeAgent: false, season: 4, day: 30,
    contractSeasons: 2, apps: 12, retired: false, loan: null, transferNegotiation: null
  },
  canAccessTransferMarket: () => true,
  saveGame: () => { malformedLegacyMigration.saved = true; },
  ensureTransferOffers: () => {},
  offerIsAvailable: () => true,
  clamp: (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0)),
  toast: message => { malformedLegacyMigration.toastMessage = message; },
  renderTransferMarket: () => {}
};
vm.createContext(malformedLegacyMigration);
vm.runInContext(legacyMigrationSource + "\n" + beginNegotiationSource,
  malformedLegacyMigration, { filename: "malformed-legacy-pending-transfer" });
assert.equal(malformedLegacyMigration.migrateLegacyPendingTransferOffer(), null,
  "a legacy pending transfer without a destination country must not be migrated as an active offer");
assert.equal(malformedLegacyMigration.state.pendingTransfer, null,
  "an incomplete legacy pending transfer must not keep the career transfer lock active");
assert.equal(malformedLegacyMigration.state.transferHistory[0].legacyPendingTransfer.club, "نادي قديم",
  "the incomplete legacy offer must be preserved in the career history instead of being discarded");
assert.match(malformedLegacyMigration.state.transferHistory[0].text, /غير مكتمل/,
  "the history must explain why the malformed legacy offer was retired");
assert.equal(malformedLegacyMigration.saved, true,
  "cleaning an incomplete legacy offer must be persisted immediately");
assert.equal(careerEngine.loanRequestStatus(malformedLegacyMigration.state, { windowOpen: true }), "ready",
  "cleaning an invalid legacy transfer must restore valid loan eligibility");
malformedLegacyMigration.beginTransferNegotiation("valid-after-cleanup");
assert.equal(malformedLegacyMigration.state.transferNegotiation.offerId, "valid-after-cleanup",
  "a valid new negotiation must be allowed after the malformed legacy transfer is archived");

// Stale negotiations must be reconciled before both the loan request and the final loan confirmation.
function makeStaleLoanState() {
  return {
    careerStarted: true, retired: false, age: 24, freeAgent: false, contractType: "professional",
    contractSeasons: 2, loan: null, pendingTransfer: null,
    pendingTransfer: { club: "نادي قديم", windowId: "summer-0", wage: 1700 },
    transferNegotiation: { offerId: "missing-loan-offer", round: 2, patience: 35 },
    transferOffers: [], transferHistory: [], season: 4, day: 190, apps: 12,
    clubName: "نادي أ", leagueCountry: "مصر", leagueDivision: 1,
    leagueCompetition: "الدوري المصري", leagueSource: "اختبار", clubPower: 50,
    weeklyWage: 1000, role: "بديل", trust: 55, seasonApps: 5,
    seasonPhase: "firstHalf", winterBreakPending: false, league: [],
    leagueApps: 5, leagueRoundIndex: 5, leagueSegmentId: "segment-4-a",
    leagueRoundHistory: [], fixtureSchedule: [], seasonAppsTarget: 20
  };
}
const staleLoanTarget = {
  club: "نادي ب", country: "مصر", division: 1, league: "الدوري المصري",
  power: 55, source: "اختبار", season: "2026/27"
};
const loanRequestScenario = {
  state: makeStaleLoanState(),
  window: { LWCareer: {
    loanRequestStatus: careerEngine.loanRequestStatus,
    loanTargetStatus: careerEngine.loanTargetStatus,
    loanSquadRole: () => "أساسي"
  } },
  transferWindow: () => ({ open: true, id: "summer-0", name: "الانتقالات الصيفية" }),
  canAccessTransferMarket: () => true,
  activeCupInProgress: () => false,
  transferTargets: () => [staleLoanTarget],
  overall: () => 70,
  openModal: (title, description, actions) => { loanRequestScenario.modal = { title, description, actions }; },
  toast: message => { loanRequestScenario.toastMessage = message; },
  saveGame: () => { loanRequestScenario.saveCount = (loanRequestScenario.saveCount || 0) + 1; }
};
vm.createContext(loanRequestScenario);
vm.runInContext(legacyMigrationSource + "\n" + reconciliationSource + "\n" + requestLoanSource, loanRequestScenario,
  { filename: "reconcile-stale-negotiation-before-loan-request" });
loanRequestScenario.requestLoan();
assert.equal(loanRequestScenario.state.pendingTransfer, null,
  "a malformed legacy direct offer must be archived before checking loan eligibility");
assert.equal(loanRequestScenario.state.transferHistory.find(row => row && row.legacyPendingTransfer)
  ?.legacyPendingTransfer?.club, "نادي قديم",
  "the malformed legacy direct offer must remain recoverable in career history");
assert.equal(loanRequestScenario.state.transferNegotiation, null,
  "a stale saved negotiation must not block a new loan request");
assert.ok(loanRequestScenario.modal && loanRequestScenario.modal.title === "اختار وجهة الإعارة",
  "loan destinations must be shown after the stale negotiation lock is cleared");
assert.equal(loanRequestScenario.state.transferHistory.find(row => row && row.legacyTransferNegotiation)
  ?.legacyTransferNegotiation?.offerId, "missing-loan-offer",
  "the stale negotiation must remain recoverable in history after the loan request");

const validNegotiationState = makeStaleLoanState();
validNegotiationState.transferOffers = [{
  id: "valid-loan-blocker", status: "pending", windowId: "summer-0",
  club: "نادي ب", country: "مصر", league: "الدوري المصري", division: 1, power: 55
}];
validNegotiationState.transferNegotiation = { offerId: "valid-loan-blocker", round: 1, patience: 80 };
const validNegotiationLoanScenario = {
  state: validNegotiationState,
  window: { LWCareer: { loanRequestStatus: careerEngine.loanRequestStatus } },
  transferWindow: () => ({ open: true, id: "summer-0" }),
  transferOfferMatchesCurrentWindow: () => true,
  transferEligibilityReason: () => "",
  canAccessTransferMarket: () => true,
  activeCupInProgress: () => false,
  transferTargets: () => [staleLoanTarget],
  overall: () => 70,
  openModal: () => { validNegotiationLoanScenario.modalOpened = true; },
  toast: message => { validNegotiationLoanScenario.toastMessage = message; },
  saveGame: () => {}
};
vm.createContext(validNegotiationLoanScenario);
vm.runInContext(legacyMigrationSource + "\n" + reconciliationSource + "\n" + requestLoanSource, validNegotiationLoanScenario,
  { filename: "preserve-valid-negotiation-loan-block" });
validNegotiationLoanScenario.requestLoan();
assert.equal(validNegotiationLoanScenario.state.transferNegotiation.offerId, "valid-loan-blocker",
  "a valid in-window negotiation must remain active and continue blocking a loan");
assert.equal(validNegotiationLoanScenario.modalOpened, undefined,
  "the player must not open a loan request while a valid permanent-transfer negotiation is active");
assert.match(validNegotiationLoanScenario.toastMessage || "", /مفاوضات انتقال مفتوحة/,
  "the active negotiation must keep its clear loan-blocking explanation");

const loanToScenario = {
  state: Object.assign(makeStaleLoanState(), {
    cupState: { name: "كأس النادي الأصلي", createdSeason: 4, matchesPlayed: 4, champion: true },
    cupHistory: []
  }),
  window: { LWCareer: {
    loanRequestStatus: careerEngine.loanRequestStatus,
    loanTargetStatus: careerEngine.loanTargetStatus,
    loanSquadRole: () => "أساسي"
  } },
  transferWindow: () => ({ open: true, id: "summer-0" }),
  canAccessTransferMarket: () => true,
  activeCupInProgress: () => false,
  transferTargets: () => [staleLoanTarget],
  seasonMatchTotal: () => 20,
  archiveLeagueSegment: () => {},
  clubPowerFor: () => 55,
  clubTierForPower: () => 2,
  transferWage: () => 1000,
  createLeague: () => [],
  buildFixtureSchedule: () => [],
  seedDestinationLeagueProgress: () => 5,
  clamp: (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0)),
  log: () => {}, setStory: () => {}, saveGame: () => {}, render: () => {},
  showPage: () => {}, toast: () => {}
};
vm.createContext(loanToScenario);
vm.runInContext(cupArchiveSource + "\n" + legacyMigrationSource + "\n" + reconciliationSource + "\n" + loanToSource, loanToScenario,
  { filename: "reconcile-stale-negotiation-before-loan-confirmation" });
loanToScenario.loanTo(staleLoanTarget);
assert.equal(loanToScenario.state.pendingTransfer, null,
  "the final loan confirmation must archive malformed legacy direct offers before validation");
assert.equal(loanToScenario.state.transferHistory.find(row => row && row.legacyPendingTransfer)
  ?.legacyPendingTransfer?.club, "نادي قديم",
  "the final loan confirmation must preserve the malformed legacy offer in history");
assert.equal(loanToScenario.state.loan?.hostClub, staleLoanTarget.club,
  "the final loan confirmation must proceed after archiving stale transfer locks");
assert.equal(loanToScenario.state.transferNegotiation, null,
  "the final loan confirmation must not retain a stale permanent-transfer lock");
assert.equal(loanToScenario.state.transferHistory.find(row => row && row.legacyTransferNegotiation)
  ?.legacyTransferNegotiation?.offerId, "missing-loan-offer",
  "the final loan confirmation must preserve the stale negotiation in career history");
assert.equal(loanToScenario.state.cupState, null,
  "a completed parent-club cup must be archived and cleared before the player joins the loan club");
assert.equal(loanToScenario.state.cupHistory.length, 1,
  "loan departure must preserve the parent club cup record without dropping it");
assert.equal(loanToScenario.state.cupHistory[0].club, "نادي أ");
assert.equal(loanToScenario.state.cupHistory[0].champion, true,
  "the completed parent-club trophy must remain attributed to the parent club after loan");

const loanReturnCupScenario = {
  state: Object.assign(makeStaleLoanState(), {
    clubName: "نادي ب", leagueCountry: "مصر", weeklyWage: 1500,
    loan: {
      parentClub: "نادي أ", parentCountry: "مصر", parentDivision: 1,
      parentCompetition: "الدوري المصري", parentSource: "بيانات النادي الأصلي",
      parentPower: 60, parentTier: 1, parentIndex: 1, parentWage: 1000,
      parentContractSeasons: 2, parentFreeAgent: false,
      parentContractType: "professional", parentRole: "أساسي"
    },
    cupState: { name: "كأس النادي المضيف", createdSeason: 4, matchesPlayed: 3, champion: true },
    cupHistory: []
  }),
  archiveReasons: [],
  withCareerStateTransaction: (_label, operation) => operation(),
  archiveLeagueSegment: reason => loanReturnCupScenario.archiveReasons.push(reason),
  normalizeSavedBooleanFlag: value => value === true || value === 1 || ["true", "1", "yes", "on"].includes(String(value).trim().toLowerCase()),
  clubPowerFor: () => 60,
  clubTierForPower: () => 1,
  log: () => {}
};
vm.createContext(loanReturnCupScenario);
vm.runInContext(cupArchiveSource + "\n" + returnFromLoanSource + "\nthis.returnLoanForTest = returnFromLoan;", loanReturnCupScenario,
  { filename: "archive-host-cup-before-loan-return" });
assert.equal(loanReturnCupScenario.returnLoanForTest(), true);
assert.equal(loanReturnCupScenario.state.clubName, "نادي أ",
  "loan return must restore the parent club after archiving the host cup");
assert.equal(loanReturnCupScenario.state.cupState, null,
  "the host club cup state must not follow the player back to the parent club");
assert.equal(loanReturnCupScenario.state.cupHistory.length, 1,
  "the host club cup outcome must remain in career history after loan return");
assert.equal(loanReturnCupScenario.state.cupHistory[0].club, "نادي ب");
assert.equal(loanReturnCupScenario.state.cupHistory[0].champion, true,
  "a host-club trophy earned during the loan must remain attributed to the host club");
assert.deepEqual(loanReturnCupScenario.archiveReasons, ["loan-return"]);

const underageLoanState = makeStaleLoanState();
underageLoanState.age = 17;
underageLoanState.pendingTransfer = null;
underageLoanState.transferNegotiation = null;
const underageLoanScenario = {
  state: underageLoanState,
  canAccessTransferMarket: () => false,
  toast: message => { underageLoanScenario.toastMessage = message; }
};
vm.createContext(underageLoanScenario);
vm.runInContext(loanToSource, underageLoanScenario, { filename: "reject-loan-after-access-is-lost" });
underageLoanScenario.loanTo(staleLoanTarget);
assert.equal(underageLoanScenario.state.loan, null,
  "the final loan action must not bypass the age/academy access gate after the modal was opened");
assert.match(underageLoanScenario.toastMessage || "", /سن 18/,
  "a blocked final loan confirmation must explain the professional-market eligibility requirement");




// Offers must not be generated for an ineligible player, and must become usable only after eligibility recovers.
const eligibilityState = {
  calendarDay: 190, season: 4, careerStarted: true, retired: false, age: 24, loan: null,
  freeAgent: false, transferCooldown: 0, daysSinceTransfer: 14, apps: 12, trust: 10,
  clubName: "نادي أ", leagueCountry: "مصر", clubPower: 50, pos: "ST", role: "أساسي",
  contractSeasons: 3, transferOffers: [], transferOffersWindowId: "", transferOffersAttemptKey: "",
  transferHistory: [], seasonGoals: 0, seasonAssists: 0, season: 4, day: 190
};
let eligibilityGenerationCalls = 0;
const eligibilitySandbox = {
  state: eligibilityState,
  window: { LWTransferAwards: { generateOffers: ({ windowId }) => {
    eligibilityGenerationCalls++;
    return [{ id: "eligible-offer", windowId, club: "نادي ب", country: "مصر", league: "الدوري المصري",
      division: 1, power: 50, wage: 1000, maxWage: 1200, status: "pending" }];
  } } },
  canAccessTransferMarket: () => true,
  transferPlayerProfile: () => ({ name: "لاعب اختبار", currentClub: "نادي أ", country: "مصر",
    appearances: 12, form: 6.2, ovr: 68, currentClubPower: 50, goals: 0, assists: 0, age: 24, potential: 80, position: "ST" }),
  transferTargets: () => [{ club: "نادي ب", country: "مصر", league: "الدوري المصري", division: 1, power: 50 }],
  transferFactors: () => ({ ageAdjustment: 0, contractAdjustment: 0, currentRoleAdjustment: 0, positionAdjustment: 0, targetRoleAdjustment: 0 }),
  transferAverageRating: () => 6.2, overall: () => 68, isYouthAcademyPlayer: () => false,
  saveGame: () => {}, log: () => {}, setStory: () => {}, console
};
vm.createContext(eligibilitySandbox);
vm.runInContext(transferWindowSource + "\n" + transferOfferMatchSource + "\n" + transferOfferCurrentMatchSource + "\n"
  + normalizedTargetKeySource + "\n" + legacyMigrationSource + "\n" + reconciliationSource + "\n" + dedupeOffersSource + "\n"
  + transferEligibilitySource + "\n" + ensureOffersSource + "\n" + offerAvailabilitySource,
  eligibilitySandbox, { filename: "transfer-offer-eligibility-guard" });
eligibilitySandbox.ensureTransferOffers();
assert.equal(eligibilityGenerationCalls, 0, "low coach trust must prevent official offers from being generated");
eligibilityState.trust = 25;
eligibilitySandbox.ensureTransferOffers();
assert.equal(eligibilityGenerationCalls, 1, "the same transfer window must retry once coach trust becomes eligible");
assert.equal(eligibilitySandbox.offerIsAvailable(eligibilityState.transferOffers[0]), true,
  "an offer must become negotiable once the player satisfies the shared eligibility rules");
eligibilityState.trust = 10;
assert.equal(eligibilitySandbox.offerIsAvailable(eligibilityState.transferOffers[0]), false,
  "a previously generated offer must not bypass a later loss of coach trust");
eligibilityState.trust = 25;eligibilityState.daysSinceTransfer = 3;
assert.equal(eligibilitySandbox.offerIsAvailable(eligibilityState.transferOffers[0]), false,
  "a previously generated offer must not bypass the post-transfer waiting period");


// Role and remaining contract years affect target eligibility, so a change in either must retry an empty offer search.
const roleContractState = {
  calendarDay: 190, season: 4, winterBreakPending: true, seasonPhase: "winterBreak",
  careerStarted: true, retired: false, age: 24, loan: null, freeAgent: false,
  transferCooldown: 0, daysSinceTransfer: 14, apps: 12, trust: 60,
  clubName: "نادي أ", leagueCountry: "مصر", clubPower: 50, pos: "ST",
  role: "بديل", contractSeasons: 4, transferOffers: [], transferOffersWindowId: "",
  transferOffersAttemptKey: "", transferHistory: [], seasonGoals: 0, seasonAssists: 0, day: 190
};
let roleContractGenerationCalls = 0;
const roleContractSandbox = {
  state: roleContractState,
  window: { LWTransferAwards: { generateOffers: ({ targets, windowId }) => {
    roleContractGenerationCalls++;
    return targets.length ? [{ id: "role-contract-offer", windowId, club: "نادي قوي", country: "مصر",
      league: "الدوري المصري", division: 1, power: 77, wage: 1200, maxWage: 1400, status: "pending" }] : [];
  } } },
  canAccessTransferMarket: () => true,
  transferPlayerProfile: () => ({ name: "لاعب اختبار", age: 24, position: "ST", ovr: 68, potential: 80,
    role: roleContractState.role, country: "مصر", currentClub: "نادي أ", currentClubPower: 50,
    form: 7, appearances: 12, goals: 0, assists: 0 }),
  transferTargets: () => [{ club: "نادي قوي", country: "مصر", league: "الدوري المصري",
    division: 1, power: 77, prestige: 60, currency: "ج.م" }],
  stableHash: () => 0, transferAverageRating: () => 7, overall: () => 68, isYouthAcademyPlayer: () => false,
  saveGame: () => {}, log: () => {}, setStory: () => {}, console
};
vm.createContext(roleContractSandbox);
vm.runInContext(transferWindowSource + "\n" + transferOfferMatchSource + "\n" + transferOfferCurrentMatchSource + "\n"
  + normalizedTargetKeySource + "\n" + legacyMigrationSource + "\n" + reconciliationSource + "\n" + dedupeOffersSource + "\n"
  + transferFactorsSource + "\n" + transferEligibilitySource + "\n" + ensureOffersSource + "\n" + offerAvailabilitySource,
  roleContractSandbox, { filename: "transfer-offer-role-contract-retry" });
roleContractSandbox.ensureTransferOffers();
assert.equal(roleContractGenerationCalls, 1, "an unsuitable contract/role profile must be evaluated once in the active window");
assert.equal(roleContractState.transferOffers.length, 0, "a target beyond the player's current role/contract fit must not receive an offer");
roleContractState.role = "أساسي";
roleContractState.contractSeasons = 1;
roleContractSandbox.ensureTransferOffers();
assert.equal(roleContractGenerationCalls, 2, "improving squad role and contract leverage must retry target discovery in the same window");
assert.equal(roleContractState.transferOffers.length, 1, "the improved role/contract fit must allow the previously unsuitable target");
assert.equal(roleContractSandbox.offerIsAvailable(roleContractState.transferOffers[0]), true,
  "the newly eligible offer must pass the same final availability validator");

roleContractState.transferNegotiation = { offerId: "deleted-negotiation-offer", round: 2, patience: 40 };
roleContractState.transferOffers = [];
roleContractState.transferOffersWindowId = "";
roleContractState.transferOffersAttemptKey = "";
roleContractState.transferHistory = [];
roleContractSandbox.ensureTransferOffers();
assert.equal(roleContractState.transferNegotiation, null,
  "a saved negotiation whose offer no longer exists must not keep the transfer market locked");
const staleNegotiationHistory = roleContractState.transferHistory.find(row => row && row.legacyTransferNegotiation);
assert.ok(staleNegotiationHistory,
  "a stale negotiation must be preserved in career history before its lock is cleared");
assert.equal(staleNegotiationHistory.legacyTransferNegotiation.offerId, "deleted-negotiation-offer",
  "the original stale negotiation terms must remain recoverable from career history");
assert.match(staleNegotiationHistory.text, /مفاوضات انتقال محفوظة/,
  "the career history must explain why the stale negotiation was closed");
assert.equal(roleContractGenerationCalls, 3,
  "offer discovery must resume in the same transfer window after a stale negotiation is reconciled");
assert.equal(roleContractState.transferOffers.length, 1,
  "the transfer market must repopulate with a fresh offer after the stale negotiation is cleared");

// An existing pending offer must not keep its negotiation lock after the player's eligibility changes.
const activeOfferId = roleContractState.transferOffers[0].id;
roleContractState.transferNegotiation = { offerId: activeOfferId, round: 1, patience: 55, requestedWage: 1200 };
roleContractState.trust = 10;
roleContractState.transferHistory = [];
roleContractSandbox.ensureTransferOffers();
assert.equal(roleContractState.transferNegotiation, null,
  "a negotiation must close when the player falls below the minimum coach-trust threshold");
const trustClosedNegotiation = roleContractState.transferHistory.find(row => row && row.legacyTransferNegotiation);
assert.equal(trustClosedNegotiation?.legacyTransferNegotiation?.offerId, activeOfferId,
  "the closed negotiation must retain its original offer ID in career history");
assert.match(trustClosedNegotiation?.text || "", /مفاوضات انتقال محفوظة/,
  "the history must explain why an ineligible negotiation was closed");
assert.equal(roleContractGenerationCalls, 3,
  "closing an ineligible negotiation must not trigger another offer-generation attempt");

roleContractState.trust = 60;
roleContractSandbox.transferAverageRating = () => 5.2;
roleContractState.transferNegotiation = { offerId: activeOfferId, round: 2, patience: 40 };
roleContractState.transferHistory = [];
roleContractSandbox.ensureTransferOffers();
assert.equal(roleContractState.transferNegotiation, null,
  "a negotiation must close when the player's average rating falls below the market threshold");
const formClosedNegotiation = roleContractState.transferHistory.find(row => row && row.legacyTransferNegotiation);
assert.equal(formClosedNegotiation?.legacyTransferNegotiation?.offerId, activeOfferId,
  "a form-ineligible negotiation must preserve its original terms in career history");
assert.equal(roleContractGenerationCalls, 3,
  "closing a form-ineligible negotiation must not regenerate offers in the same window");


// A successful contract negotiation must not be recorded as a completed transfer if the destination disappeared before commit.
function makeNegotiationCompletionScenario(completeTransfer) {
  const offer = { id: "vanished-club-offer", status: "pending", club: "نادي ب", country: "مصر",
    league: "الدوري المصري", division: 1, power: 50, wage: 1000, currency: "ج.م",
    signingBonus: 5000, goalBonus: 300, cleanSheetBonus: 200, contractSeasons: 3, releaseClause: 0, role: "أساسي" };
  const scenario = {
    state: { clubName: "نادي أ", leagueCountry: "مصر", season: 4, day: 190, pendingTransfer: null,
      transferNegotiation: { offerId: offer.id, patience: 100, round: 0 }, transferOffers: [offer], transferHistory: [] },
    window: { LWTransferAwards: { evaluateNegotiation: () => ({ status: "accepted", patience: 100,
      terms: { weeklyWage: 1000, signingBonus: 5000, goalBonus: 300, cleanSheetBonus: 200,
        contractSeasons: 3, releaseClause: 0 } }) } },
    offerIsAvailable: () => true, negotiationTermsFromDom: () => ({ weeklyWage: 1000 }),
    transferTo: () => {
      if (completeTransfer) { scenario.state.clubName = offer.club; scenario.state.leagueCountry = offer.country; }
      scenario.state.pendingTransfer = null; scenario.state.transferNegotiation = null;
    },
    saveGame: () => {}, renderTransferMarket: () => { scenario.rendered = true; },
    toast: message => { scenario.toastMessage = message; }, log: () => {}
  };
  vm.createContext(scenario);
  vm.runInContext(submitNegotiationSource, scenario, { filename: completeTransfer ? "completed-negotiated-transfer" : "vanished-negotiated-transfer" });
  scenario.submitTransferNegotiation();
  return scenario;
}
const vanishedTransfer = makeNegotiationCompletionScenario(false);
assert.equal(vanishedTransfer.state.clubName, "نادي أ", "a vanished destination must not change the player's club");
assert.equal(vanishedTransfer.state.transferOffers[0].status, "expired",
  "an accepted contract must be marked expired if the actual transfer cannot complete");
assert.equal(vanishedTransfer.state.transferOffers[0].expiredReason, "destination-unavailable",
  "the failed transfer must retain a machine-readable reason");
assert.equal(vanishedTransfer.state.pendingTransfer, null, "a failed completion must not leave a pending transfer behind");
assert.equal(vanishedTransfer.state.transferNegotiation, null, "a failed completion must release the negotiation lock");
assert.match(vanishedTransfer.state.transferHistory[0].text, /تعذر إتمام الانتقال/,
  "a failed completion must be recorded in the career history");
const completedTransfer = makeNegotiationCompletionScenario(true);
assert.equal(completedTransfer.state.clubName, "نادي ب", "a successful completion must apply the destination club");
assert.equal(completedTransfer.state.transferOffers[0].status, "accepted",
  "a successfully completed transfer must retain the accepted offer status");
assert.equal(completedTransfer.state.transferOffers[0].expiredReason, undefined,
  "a successful transfer must not receive a failure reason");

// A failed transaction must not be misclassified as a vanished destination.
const rolledBackNegotiatedTransfer = {
  state: {
    clubName: "نادي أ", leagueCountry: "مصر", season: 4, day: 190,
    pendingTransfer: null, transferNegotiation: { offerId: "rollback-offer", patience: 100, round: 0 },
    transferOffers: [{ id: "rollback-offer", status: "pending", club: "نادي ب", country: "مصر",
      league: "الدوري المصري", division: 1, wage: 1000, currency: "ج.م", signingBonus: 5000 }],
    transferHistory: []
  },
  window: { LWTransferAwards: { evaluateNegotiation: () => ({ status: "accepted", patience: 100,
    terms: { weeklyWage: 1000, signingBonus: 5000, goalBonus: 300, cleanSheetBonus: 200,
      contractSeasons: 3, releaseClause: 0 } }) } },
  offerIsAvailable: () => true,
  negotiationTermsFromDom: () => ({ weeklyWage: 1000 }),
  transferTo: () => false,
  saveGame: () => {},
  renderTransferMarket: () => { rolledBackNegotiatedTransfer.rendered = true; },
  toast: message => { rolledBackNegotiatedTransfer.toastMessage = message; },
  log: () => {}
};
vm.createContext(rolledBackNegotiatedTransfer);
vm.runInContext(submitNegotiationSource, rolledBackNegotiatedTransfer,
  { filename: "rolled-back-negotiated-transfer" });
rolledBackNegotiatedTransfer.submitTransferNegotiation();
assert.equal(rolledBackNegotiatedTransfer.state.transferOffers[0].status, "accepted",
  "a failed transfer transaction must preserve the accepted offer");
assert.equal(rolledBackNegotiatedTransfer.state.transferOffers[0].expiredReason, undefined,
  "a storage or transaction failure must not expire a still-valid accepted offer");
assert.equal(rolledBackNegotiatedTransfer.state.pendingTransfer.club, "نادي ب",
  "the accepted destination and negotiated terms must survive rollback for retry");
assert.equal(rolledBackNegotiatedTransfer.state.pendingTransfer.signingBonus, 5000,
  "the exact negotiated signing bonus must survive rollback");
assert.equal(rolledBackNegotiatedTransfer.rendered, true,
  "the transfer market must refresh to expose the retained accepted contract");
assert.match(rolledBackNegotiatedTransfer.toastMessage, /أعد المحاولة/,
  "the player must be told that the accepted transfer can be retried");
assert.equal(rolledBackNegotiatedTransfer.state.transferHistory.some(row => /تعذر إتمام الانتقال/.test(row.text)), false,
  "a transaction failure must not be falsely recorded as a destination disappearing");

// The transfer market must expose the accepted contract after rollback and provide a retry action.
assert.ok(renderTransferMarketSource, "the real transfer-market renderer must be available to the regression test");
const pendingTransferBox = { innerHTML: "" };
const pendingTransferElements = {
  transferMarket: pendingTransferBox,
  marketAvailability: { textContent: "" },
  transferMarketCount: { textContent: "" },
  transferMarketNotice: { textContent: "" }
};
const pendingTransferMarket = {
  state: {
    retired: false, loan: null, winterBreakPending: false, apps: 8, freeAgent: false,
    transferOffers: [],
    pendingTransfer: { club: "نادي ب", country: "مصر", wage: 1000, currency: "ج.م", signingBonus: 5000 }
  },
  $: id => pendingTransferElements[id] || null,
  ensureTransferOffers: () => {},
  transferWindow: () => ({ open: true, name: "الانتقالات الصيفية", days: 0 }),
  offerIsAvailable: () => false,
  setText: () => {},
  transferAverageRating: () => 6.5,
  safeHTML: value => String(value == null ? "" : value),
  currencyLabel: () => "ج.م",
  renderNegotiationPanel: () => "",
  updateNegotiationPreview: () => {}
};
vm.createContext(pendingTransferMarket);
vm.runInContext(renderTransferMarketSource, pendingTransferMarket, { filename: "pending-transfer-market-render" });
pendingTransferMarket.renderTransferMarket();
assert.match(pendingTransferBox.innerHTML, /data-retry-pending-transfer/,
  "a rolled-back accepted transfer must render an explicit retry button");
assert.match(pendingTransferBox.innerHTML, /نادي ب/,
  "the retry card must identify the accepted destination club");
assert.ok(app.includes('const retryPendingTransferButton=e.target.closest("[data-retry-pending-transfer]");if(retryPendingTransferButton){retryPendingTransfer();return;}'),
  "the transfer-market click handler must delegate retries to the guarded retry flow");

const retryPendingTransferSource = section("function retryPendingTransfer(){", "\nfunction negotiate(){");
function runPendingTransferRetry(mode) {
  let saveCalls = 0, renderCalls = 0, toastMessage = "";
  const retryState = {
    clubName: "نادي أ", leagueCountry: "مصر", season: 4, day: 190,
    pendingTransfer: { id: "accepted-retry", club: "نادي ب", country: "مصر", league: "الدوري المصري" },
    transferOffers: [{ id: "accepted-retry", status: "accepted", club: "نادي ب", country: "مصر", league: "الدوري المصري" }],
    transferHistory: []
  };
  const scenario = {
    state: retryState,
    transferTo() {
      if (mode === "expired") { retryState.pendingTransfer = null; return undefined; }
      if (mode === "rollback") return false;
      retryState.clubName = "نادي ب"; retryState.leagueCountry = "مصر"; retryState.pendingTransfer = null;
      return true;
    },
    saveGame() { saveCalls++; return true; },
    renderTransferMarket() { renderCalls++; },
    toast(message) { toastMessage = message; }
  };
  vm.createContext(scenario);
  vm.runInContext(retryPendingTransferSource + "\nthis.retryPendingTransfer = retryPendingTransfer;", scenario,
    { filename: "pending-transfer-retry-" + mode });
  scenario.retryPendingTransfer();
  return { state: retryState, saveCalls, renderCalls, toastMessage };
}
const expiredRetry = runPendingTransferRetry("expired");
assert.equal(expiredRetry.state.transferOffers[0].status, "expired",
  "a retry rejected by a closed window or unavailable destination must expire the accepted offer");
assert.equal(expiredRetry.state.transferOffers[0].expiredReason, "destination-unavailable");
assert.equal(expiredRetry.state.transferHistory.length, 1,
  "a rejected retry must record one expiry event without changing the current club");
assert.equal(expiredRetry.state.clubName, "نادي أ");
assert.equal(expiredRetry.saveCalls, 1, "the expired retry state must be saved");
assert.equal(expiredRetry.renderCalls, 1, "the market must refresh after an expired retry");

const rolledBackRetry = runPendingTransferRetry("rollback");
assert.equal(rolledBackRetry.state.transferOffers[0].status, "accepted",
  "a transaction rollback must keep the accepted contract available for another retry");
assert.ok(rolledBackRetry.state.pendingTransfer, "a failed transaction must preserve the pending contract");
assert.equal(rolledBackRetry.state.transferHistory.length, 0);
assert.equal(rolledBackRetry.saveCalls, 0,
  "a transaction failure must not write an expiry after rollback");

const successfulRetry = runPendingTransferRetry("success");
assert.equal(successfulRetry.state.clubName, "نادي ب");
assert.equal(successfulRetry.state.pendingTransfer, null);
assert.equal(successfulRetry.state.transferOffers[0].status, "accepted",
  "a successful retry must retain the accepted offer instead of marking it expired");
assert.equal(successfulRetry.state.transferHistory.length, 0,
  "a successful retry must not append an expiry record");

const cupArchiveScenario = {
  state: {
    season: 4, clubName: "نادي أ",
    cupState: { name: "كأس الاختبار", createdSeason: 4, matchesPlayed: 3, history: ["الجولة الأولى"] },
    cupHistory: []
  }
};
vm.createContext(cupArchiveScenario);
vm.runInContext(cupArchiveSource, cupArchiveScenario, { filename: "archiveCupForTransfer" });
assert.equal(cupArchiveScenario.archiveCupForTransfer(), true, "a club-specific cup record should be archived before transfer");
assert.equal(cupArchiveScenario.state.cupState, null, "the old club's active cup state must not follow the player");
assert.equal(cupArchiveScenario.state.cupHistory[0].leftByTransfer, true);
assert.equal(cupArchiveScenario.state.cupHistory[0].matches, 3, "completed cup-match history must be preserved");
assert.match(cupArchiveScenario.state.cupHistory[0].reason, /انتقال/);
assert.equal(cupArchiveScenario.archiveCupForTransfer(), false, "archiving must be idempotent after the active cup is cleared");

const completedCupScenario = {
  state: {
    season: 4, clubName: "نادي أ", leagueCountry: "مصر", leagueDivision: 1,
    cupState: { name: "كأس مكتمل", createdSeason: 4, matchesPlayed: 5, champion: true },
    cupHistory: [{ name: "كأس مكتمل", season: 4, champion: true, matches: 5, club: "نادي أ", country: "مصر" }]
  }
};
vm.createContext(completedCupScenario);
vm.runInContext(cupArchiveSource, completedCupScenario, { filename: "archiveCompletedCupForTransfer" });
assert.equal(completedCupScenario.archiveCupForTransfer(), true,
  "completed cup state must be cleared when the player transfers");
assert.equal(completedCupScenario.state.cupState, null,
  "a won cup must not follow the player to the destination club");
assert.equal(completedCupScenario.state.cupHistory.length, 1,
  "an existing trophy record for the same club and country must not be duplicated");

const otherClubCupScenario = {
  state: {
    season: 4, clubName: "نادي ب", leagueCountry: "مصر", leagueDivision: 1,
    cupState: { name: "كأس مكتمل", createdSeason: 4, matchesPlayed: 5, champion: true },
    cupHistory: [{ name: "كأس مكتمل", season: 4, champion: true, matches: 5, club: "نادي أ", country: "مصر" }]
  }
};
vm.createContext(otherClubCupScenario);
vm.runInContext(cupArchiveSource, otherClubCupScenario, { filename: "archiveSameCupOtherClub" });
assert.equal(otherClubCupScenario.archiveCupForTransfer(), true);
assert.equal(otherClubCupScenario.state.cupHistory.length, 2,
  "a same-name cup record from another club must not suppress the current club's history");
assert.equal(otherClubCupScenario.state.cupHistory[0].club, "نادي ب");

const sameNameCrossCountryCupScenario = {
  state: {
    season: 4, clubName: "United", leagueCountry: "Spain", leagueDivision: 1,
    cupState: { name: "National Cup", createdSeason: 4, matchesPlayed: 3, champion: true },
    cupHistory: [{ name: "National Cup", season: 4, champion: true, club: "United", country: "England" }]
  }
};
vm.createContext(sameNameCrossCountryCupScenario);
vm.runInContext(cupArchiveSource, sameNameCrossCountryCupScenario, { filename: "archiveSameNameCrossCountryCup" });
sameNameCrossCountryCupScenario.archiveCupForTransfer();
assert.equal(sameNameCrossCountryCupScenario.state.cupHistory.length, 2,
  "same-name clubs in different countries must keep separate cup records");
assert.equal(sameNameCrossCountryCupScenario.state.cupHistory[0].country, "Spain");

const activeOtherClubCupScenario = {
  state: {
    season: 4, clubName: "نادي ب", leagueCountry: "مصر", leagueDivision: 1,
    cupState: { name: "كأس انتقال", createdSeason: 4, matchesPlayed: 2, history: [] },
    cupHistory: [{ name: "كأس انتقال", season: 4, abandoned: true, leftByTransfer: true, club: "نادي أ", country: "مصر" }]
  }
};
vm.createContext(activeOtherClubCupScenario);
vm.runInContext(cupArchiveSource, activeOtherClubCupScenario, { filename: "archiveActiveSameCupOtherClub" });
activeOtherClubCupScenario.archiveCupForTransfer();
assert.equal(activeOtherClubCupScenario.state.cupHistory.length, 2,
  "a prior club's abandoned cup must not suppress the new club's transfer archive");
assert.equal(activeOtherClubCupScenario.state.cupHistory[0].club, "نادي ب");

const eliminatedCupScenario = {
  state: {
    season: 4, clubName: "نادي أ", leagueCountry: "مصر", leagueDivision: 1,
    cupState: { name: "كأس خروج", createdSeason: 4, matchesPlayed: 2, eliminated: true },
    cupHistory: []
  }
};
vm.createContext(eliminatedCupScenario);
vm.runInContext(cupArchiveSource, eliminatedCupScenario, { filename: "archiveEliminatedCupForTransfer" });
assert.equal(eliminatedCupScenario.archiveCupForTransfer(), true,
  "an eliminated cup state must be closed before transfer");
assert.equal(eliminatedCupScenario.state.cupState, null);
assert.equal(eliminatedCupScenario.state.cupHistory[0].eliminated, true,
  "an elimination missing from legacy cup history must be preserved");
assert.equal(eliminatedCupScenario.state.cupHistory[0].matches, 2);
assert.equal(eliminatedCupScenario.state.cupHistory[0].abandoned, false,
  "a completed elimination must not be mislabeled as an abandoned cup");

assert.match(transferToSource, /archiveCupForTransfer\(\)/, "transfer completion must archive the active cup before switching clubs");
assert.doesNotMatch(transferToSource, /activeCupInProgress\(\)/, "transfer completion must not stay blocked by the active cup");
assert.ok(transferToSource.includes("state.leagueDivision=Math.max(1,Number(p.division)||1)"),
  "permanent transfer completion must apply the selected destination division");


const expiryTest=()=>{
  let toastMessage="",saveCount=0,renderCount=0;
  const scenario={
    state:{retired:false,age:24,loan:null,clubName:"نادي أ",freeAgent:false,
      lastOfferWindow:"summer-0",pendingTransfer:{club:"نادي ب",country:"مصر",division:2,windowId:"summer-0"}},
    canAccessTransferMarket:()=>true,
    transferWindow:()=>({open:true,id:"winter-0",name:"الانتقالات الشتوية",days:10}),
    toast:message=>{toastMessage=message;},
    saveGame:()=>{saveCount++;},
    render:()=>{renderCount++;}
  };
  vm.createContext(scenario);
  vm.runInContext(transferOfferMatchSource + "\n" + transferOfferCurrentMatchSource + "\n" + transferToSource,scenario,{filename:"expired-transfer-offer"});
  scenario.transferTo();
  assert.equal(scenario.state.pendingTransfer,null,
    "a saved direct transfer offer from the previous window must be cleared");
  assert.equal(scenario.state.clubName,"نادي أ",
    "an expired direct transfer offer must not change the player's club");
  assert.match(toastMessage,/انتهت صلاحيته/,
    "the player must be told that the old transfer offer expired");
  assert.equal(saveCount,1,"clearing an expired offer must be persisted");
  assert.equal(renderCount,1,"the transfer UI must refresh after expiry");

  const legacy={
    state:{retired:false,age:24,loan:null,clubName:"نادي أ",freeAgent:false,
      lastOfferWindow:"summer-0",pendingTransfer:{club:"نادي ب",country:"مصر",division:2}},
    canAccessTransferMarket:()=>true,
    transferWindow:()=>({open:true,id:"winter-0",name:"الانتقالات الشتوية",days:10}),
    toast:message=>{toastMessage=message;},
    saveGame:()=>{saveCount++;},
    render:()=>{renderCount++;}
  };
  toastMessage="";saveCount=0;renderCount=0;
  vm.createContext(legacy);
  vm.runInContext(transferOfferMatchSource + "\n" + transferOfferCurrentMatchSource + "\n" + transferToSource,legacy,{filename:"expired-legacy-transfer-offer"});
  legacy.transferTo();
  assert.equal(legacy.state.pendingTransfer,null,
    "legacy direct offers without their own window ID must expire using lastOfferWindow");
  assert.equal(legacy.state.clubName,"نادي أ",
    "an expired legacy offer must not move the player");

  let targetLookups=0;
  const freeAgent={
    state:{retired:false,age:24,loan:null,clubName:"لاعب حر",freeAgent:true,calendarDay:30,
      pendingTransfer:{club:"نادي ج",country:"مصر",windowId:"free-agent-2"}},
    canAccessTransferMarket:()=>true,
    transferWindow:()=>({open:false,id:"closed-0",name:"السوق مغلق",days:5}),
    transferTargets:()=>{targetLookups++;return [];},
    toast:message=>{toastMessage=message;},
    saveGame:()=>{},
    render:()=>{}
  };
  toastMessage="";
  vm.createContext(freeAgent);
  vm.runInContext(transferOfferMatchSource + "\n" + transferOfferCurrentMatchSource + "\n" + transferToSource,freeAgent,{filename:"current-free-agent-offer"});
  freeAgent.transferTo();
  assert.equal(targetLookups,1,
    "a current 14-day free-agent offer must pass expiry validation even when regular windows are closed");
  assert.doesNotMatch(toastMessage,/انتهت صلاحيتها/,
    "a current free-agent offer must not be mislabeled as expired");
};
expiryTest();


// Retirement is terminal for transfer activity, but completed historical contracts stay intact.
function runRetirementScenario(state) {
  const counts = { saves: 0, persistence: 0, persistenceContexts: [], persistenceWarnings: [], renders: 0, modals: 0, menus: 0 };
  const sandbox = {
    state,
    club: () => ({ name: "Club A" }),
    overall: () => 71,
    log: () => {},
    saveGame: () => { counts.saves++; return true; },
    persistRollbackSnapshot: (context, warning) => { counts.persistence++; counts.persistenceContexts.push(String(context)); counts.persistenceWarnings.push(String(warning)); return true; },
    render: () => { counts.renders++; },
    openModal: () => { counts.modals++; },
    openPostCareerMenu: () => { counts.menus++; },
    showPage: () => {},
    newCareer: () => {}
  };
  vm.createContext(sandbox);
  vm.runInContext(retirementSource + "\nthis.retireCareer = retireCareer;", sandbox,
    { filename: "retirement-transfer-cleanup" });
  sandbox.retireCareer();
  return { state, counts, retireCareer: sandbox.retireCareer };
}
const activeRetirement = runRetirementScenario({
  retired: false, season: 5, day: 24, age: 40, name: "Test Player",
  apps: 25, goals: 9, assists: 4, trophies: 1,
  pendingTransfer: { id: "accepted-current", club: "Club B", country: "Egypt", league: "Premier League", wage: 1000 },
  transferNegotiation: { offerId: "pending-current", round: 2, requestedWage: 1100 },
  transferOffers: [
    { id: "pending-current", status: "pending", club: "Club C", country: "Egypt", wage: 1200 },
    { id: "accepted-current", status: "accepted", club: "Club B", country: "Egypt", wage: 1000 },
    { id: "historic-accepted", status: "accepted", club: "Club D", country: "Egypt" },
    { id: "already-rejected", status: "rejected", club: "Club E", country: "Egypt" }
  ],
  transferHistory: [{ text: "previous transfer record" }]
});
assert.equal(activeRetirement.state.retired, true, "retirement must still mark the player career as retired");
assert.equal(activeRetirement.state.pendingTransfer, null, "retirement must clear a pending accepted transfer");
assert.equal(activeRetirement.state.transferNegotiation, null, "retirement must clear an open transfer negotiation");
assert.equal(activeRetirement.state.transferOffers[0].status, "expired");
assert.equal(activeRetirement.state.transferOffers[0].expiredReason, "career-retired");
assert.equal(activeRetirement.state.transferOffers[1].status, "expired",
  "an accepted offer still awaiting its move must expire with the retirement");
assert.equal(activeRetirement.state.transferOffers[2].status, "accepted",
  "a completed historical accepted transfer must not be rewritten as expired");
assert.equal(activeRetirement.state.transferOffers[3].status, "rejected",
  "previously rejected offers must remain unchanged");
const retirementTransferAudit = activeRetirement.state.transferHistory[0];
assert.equal(retirementTransferAudit.type, "retirement-transfer-cleanup");
assert.equal(retirementTransferAudit.pendingTransfer.id, "accepted-current",
  "the accepted contract terms must remain recoverable in transfer history");
assert.equal(retirementTransferAudit.transferNegotiation.offerId, "pending-current",
  "the open negotiation terms must remain recoverable in transfer history");
assert.deepEqual(Array.from(retirementTransferAudit.expiredOffers, row => row.id),
  ["pending-current", "accepted-current"]);
assert.equal(activeRetirement.state.transferHistory.length, 2,
  "retirement cleanup must preserve the existing transfer history");
assert.equal(activeRetirement.counts.persistence, 1,
  "retirement must use the backup-first persistence helper");
assert.deepEqual(activeRetirement.counts.persistenceContexts, ["career retirement"]);
assert.match(activeRetirement.counts.persistenceWarnings[0], /سجل الاعتزال/);
assert.equal(activeRetirement.counts.renders, 1);
assert.equal(activeRetirement.counts.modals, 1);

const legacyRetiredCleanup = runRetirementScenario({
  retired: true, retirementRecord: { age: 40 }, season: 7, day: 1,
  pendingTransfer: { id: "legacy-accepted", club: "Old Club", country: "Egypt" },
  transferNegotiation: { offerId: "legacy-accepted", round: 1 },
  transferOffers: [{ id: "legacy-accepted", status: "accepted", club: "Old Club", country: "Egypt" }],
  transferHistory: []
});
assert.equal(legacyRetiredCleanup.state.pendingTransfer, null,
  "an already-retired legacy save must also clear stale pending transfers");
assert.equal(legacyRetiredCleanup.state.transferNegotiation, null,
  "an already-retired legacy save must also clear stale negotiations");
assert.equal(legacyRetiredCleanup.state.transferOffers[0].status, "expired");
assert.equal(legacyRetiredCleanup.counts.persistence, 1,
  "cleaning a previously retired save must use durable persistence");
assert.deepEqual(legacyRetiredCleanup.counts.persistenceContexts, ["career retirement legacy cleanup"]);
assert.match(legacyRetiredCleanup.counts.persistenceWarnings[0], /إصلاح سجل الاعتزال/);
assert.equal(legacyRetiredCleanup.counts.menus, 1);
legacyRetiredCleanup.retireCareer();
assert.equal(legacyRetiredCleanup.state.transferHistory.length, 1,
  "reopening an already-cleaned retirement must not duplicate the audit event");
assert.equal(legacyRetiredCleanup.counts.persistence, 1,
  "an idempotent retirement revisit must not persist another cleanup");
assert.equal(legacyRetiredCleanup.counts.menus, 2);

const cleanRetirement = runRetirementScenario({
  retired: false, season: 2, age: 40, name: "No Transfer",
  apps: 0, goals: 0, assists: 0, trophies: 0,
  transferOffers: [], transferHistory: []
});
assert.equal(cleanRetirement.state.transferHistory.length, 0,
  "retirement without active transfer state must not add a synthetic transfer record");
assert.match(retirementSource, /persistRollbackSnapshot\("career retirement"/,
  "new retirement must use durable backup-first persistence");
assert.doesNotMatch(retirementSource, /saveGame\(true\)/,
  "retirement must not bypass durable persistence confirmation");
assert.equal(cleanRetirement.counts.persistence, 1);

const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const deployedSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
assert.equal(sw, deployedSw, "root and public service workers must remain synchronized");
const cacheVersionMatch = sw.match(/const CACHE_NAME = "last-whistle-static-v(\d+)";/);
assert.ok(cacheVersionMatch && Number(cacheVersionMatch[1]) >= 471,
  "transfer completion identity changes must invalidate the deployed PWA shell cache");
require("./assert-static-cache-version.cjs")(sw, 429);
assert.ok(require("./assert-static-cache-version.cjs")(sw, 278) >= 278, "world-season, worker-engine, and UI changes must invalidate the deployed PWA cache");
assert.ok(sw.includes("transfer-awards-engine.js?v=26"),
  "the cached award-engine asset version must advance with the transfer eligibility fix");
require("./assert-static-cache-version.cjs").assertAssetVersionAtLeast(sw, "match-engine.js", 68);

console.log("PASS: transfer windows remain stable; automatic approaches share official negotiation, duplicate club offers are reconciled, legacy direct offers migrate safely, and pending deals cannot overlap.");
