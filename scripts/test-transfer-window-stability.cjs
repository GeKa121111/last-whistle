"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
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
const transferToSource = section("function transferTo(){", "\nfunction ");
const maybeOfferTransferSource = section("function maybeOfferTransfer(){", "\nfunction transferTo(){");
const legacyMigrationSource = section("function migrateLegacyPendingTransferOffer(", "\nfunction dedupeTransferOffersForWindow(");
const dedupeOffersSource = section("function dedupeTransferOffersForWindow(", "\nfunction ensureTransferOffers(){");
const normalizedTargetKeySource = section("function normalizedTargetKey(", "\nfunction transferFactors(");
const transferFactorsSource = section("function transferFactors(", "\nfunction transferAverageRating(");
const beginNegotiationSource = section("function beginTransferNegotiation(", "\nfunction negotiationTermsFromDom(");
const submitNegotiationSource = section("function submitTransferNegotiation(){", "\nfunction rejectTransferOffer(");
const freeAgentEligibilitySource = section("function careerMatchPlayerEligible(", "\nfunction simulateCareerMatch(");
const careerMatchSimulationSource = section("function simulateCareerMatch(", "\nfunction matchCleanSheetContractBonus(");
const applyMatchResultSource = section("function applyMatchResult(", "\nfunction applyLeagueResult(");

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
    + normalizedTargetKeySource + "\n" + legacyMigrationSource + "\n" + dedupeOffersSource + "\n"
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
 assert.equal(legacyWinterCompletion.state.pendingTransfer, null,
  "a completed transfer must clear its pending offer");
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

// Free-agent offers are valid only in the matching rolling 14-day window.
 const freeAgentWindowState = {
  state: { freeAgent: true, calendarDay: 30, lastOfferWindow: "", season: 1 },
  transferWindow: () => ({ open: false, id: "closed-0", name: "السوق مغلق", days: 5 })
 };
 vm.createContext(freeAgentWindowState);
 vm.runInContext(transferOfferMatchSource + "\n" + transferOfferCurrentMatchSource, freeAgentWindowState,
  { filename: "free-agent-window-identity" });
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
  + normalizedTargetKeySource + "\n" + legacyMigrationSource + "\n" + dedupeOffersSource + "\n"
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
  + normalizedTargetKeySource + "\n" + legacyMigrationSource + "\n" + dedupeOffersSource + "\n"
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
    cupHistory: [{ name: "كأس مكتمل", season: 4, champion: true, matches: 5, club: "نادي أ" }]
  }
};
vm.createContext(completedCupScenario);
vm.runInContext(cupArchiveSource, completedCupScenario, { filename: "archiveCompletedCupForTransfer" });
assert.equal(completedCupScenario.archiveCupForTransfer(), true,
  "completed cup state must be cleared when the player transfers");
assert.equal(completedCupScenario.state.cupState, null,
  "a won cup must not follow the player to the destination club");
assert.equal(completedCupScenario.state.cupHistory.length, 1,
  "an existing trophy record must not be duplicated");

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

const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const deployedSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
assert.equal(sw, deployedSw, "root and public service workers must remain synchronized");
require("./assert-static-cache-version.cjs")(sw, 175);
assert.ok(require("./assert-static-cache-version.cjs")(sw, 278) >= 278, "world-season, worker-engine, and UI changes must invalidate the deployed PWA cache");
assert.ok(sw.includes("transfer-awards-engine.js?v=10"),
  "the cached award-engine asset version must advance with the transfer eligibility fix");
require("./assert-static-cache-version.cjs").assertAssetVersionAtLeast(sw, "match-engine.js", 68);

console.log("PASS: transfer windows remain stable; automatic approaches share official negotiation, duplicate club offers are reconciled, legacy direct offers migrate safely, and pending deals cannot overlap.");
