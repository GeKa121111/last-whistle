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
  activeCupInProgress: () => false,
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

const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const deployedSw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
assert.equal(sw, deployedSw, "root and public service workers must remain synchronized");
assert.match(sw, /last-whistle-static-v102/,
  "the service-worker cache must be bumped so deployed clients receive the fix");
assert.ok(sw.includes("transfer-awards-engine.js?v=5"),
  "the cached award-engine asset version must advance with the season-age fix");
assert.match(sw, /match-engine\.js\?v=7/,
  "the cached match-engine asset version must advance with the simulation fix");

console.log("PASS: winter transfer-window identity stays stable, and legacy offers survive the break-to-second-half transition.");
