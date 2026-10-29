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
const transferOfferMatchSource = section("function transferOfferMatchesWindow(", "\nfunction canAccessTransferMarket(");
const ensureOffersSource = section("function ensureTransferOffers(){", "\nfunction offerIsAvailable(");
const offerAvailabilitySource = section("function offerIsAvailable(", "\nfunction beginTransferNegotiation(");
const transferEligibilitySource = section("function transferEligibilityReason(target){", "\nfunction transferEligible(");
const cupArchiveSource = section("function archiveCupForTransfer(){", "\nfunction leagueMatchTargetForCurrentClub()");
const transferToSource = section("function transferTo(){", "\nfunction ");

const state = {
  calendarDay: 190, season: 4, winterBreakPending: true, seasonPhase: "winterBreak",
  careerStarted: true, retired: false, loan: null, freeAgent: false, transferCooldown: 0,
  transferOffersWindowId: "winter-season-4", transferOffersAttemptKey: "legacy-attempt",
  transferOffers: [{ id: "legacy-january-offer", status: "pending", windowId: "winter-season-4" }]
};
let generatedOffers = 0;
const sandbox = {
  state,
  window: { LWTransferAwards: { generateOffers() { generatedOffers++; return []; } } },
  canAccessTransferMarket: () => true,
  activeCupInProgress: () => true,
  transferPlayerProfile: () => ({
    name: "لاعب اختبار", currentClub: "نادي اختبار", country: "مصر", appearances: 12,
    form: 7.1, ovr: 68, currentClubPower: 60, goals: 4, assists: 3, age: 24,
    potential: 80, position: "مهاجم"
  }),
  transferTargets: () => [],
  saveGame: () => {},
  log: () => {},
  setStory: () => {},
  console
};
vm.createContext(sandbox);
vm.runInContext(
  transferWindowSource + "\n" + transferOfferMatchSource + "\n" + ensureOffersSource + "\n" + offerAvailabilitySource,
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

state.calendarDay = 230;
assert.equal(sandbox.offerIsAvailable(state.transferOffers[0]), false,
  "a winter offer must become unavailable once the real calendar window closes");
state.calendarDay = 365 + 190;
state.season = 5;
assert.equal(sandbox.offerIsAvailable(state.transferOffers[0]), false,
  "a legacy offer from the previous season must not leak into the next winter window");


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

const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const deployedSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
assert.equal(sw, deployedSw, "root and public service workers must remain synchronized");
assert.match(sw, /last-whistle-static-v174/,
  "the service-worker cache must be bumped so deployed clients receive the fix");
assert.ok(sw.includes("transfer-awards-engine.js?v=7"),
  "the cached award-engine asset version must advance with the season-age fix");
assert.match(sw, /match-engine\.js\?v=18/,
  "the cached match-engine asset version must advance with the simulation fix");

console.log("PASS: winter transfer-window identity stays stable, and legacy offers survive the break-to-second-half transition.");
