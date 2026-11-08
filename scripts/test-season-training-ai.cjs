"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const rootHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.equal(rootHtml, html, "root and public app shells must remain byte-identical");
const start = html.indexOf("function seasonTrainingPerformanceFocus()");
const end = html.indexOf("\nfunction simulateSeasonBlock(targetApps)", start);
assert.ok(start >= 0 && end > start, "season training AI functions must exist in the app");
const source = html.slice(start, end);

const historyStart = html.indexOf("function upsertSeasonDevelopmentHistory(");
const historyEnd = html.indexOf("\nfunction simulateSeasonBlock(targetApps)", historyStart);
assert.ok(historyStart >= 0 && historyEnd > historyStart, "season development history helper must exist");
const historySource = html.slice(historyStart, historyEnd) + "\nglobalThis.__upsertSeasonHistory = upsertSeasonDevelopmentHistory;";
const historySandbox = {};
vm.createContext(historySandbox);
new vm.Script(historySource, { filename: "season-development-history.js" }).runInContext(historySandbox);
const upsertSeasonHistory = historySandbox.__upsertSeasonHistory;

const manualHelperStart = html.indexOf("function recordManualTrainingSession(");
const manualHelperEnd = html.indexOf("\nfunction train(type)", manualHelperStart);
assert.ok(manualHelperStart >= 0 && manualHelperEnd > manualHelperStart, "manual training recorder must exist");
const manualHelperSource = html.slice(manualHelperStart, manualHelperEnd) + "\nglobalThis.__recordManualTrainingSession = recordManualTrainingSession;";
const manualHelperSandbox = {};
vm.createContext(manualHelperSandbox);
new vm.Script(manualHelperSource, { filename: "manual-training-recorder.js" }).runInContext(manualHelperSandbox);
const recordManualTrainingSession = manualHelperSandbox.__recordManualTrainingSession;

function createSandbox(position, rows, attributes, plan, matchTotal = 22) {
  const sandbox = {
    state: {
      pos: position, age: 20, season: 1, seasonApps: 0, seasonMatchCount: 22,
      careerMatchHistory: rows, playerPotential: 85, trainingSessions: 0, trainingXP: {},
      energy: 70, fatigue: 20, injuryDays: 0, injuryName: "", playedToday: false,
      trainedToday: false, trainingIntensity: "normal", seasonDevelopmentSnapshot: null,
      seasonTrainingReport: null,
      shooting: 75, composure: 70, defending: 74, physical: 70,
      speed: 72, fitness: 72, dribbling: 72, passing: 72, vision: 72,
      goalkeeping: 72, ...attributes
    },
    window: {
      LWCareer: {
        positionDevelopmentPlan: () => plan,
        train: (state, focus) => {
          const age = Number(state.age) || 20;
          const threshold = age >= 30 ? 125 : age <= 21 ? 92 : 108;
          const agePenalty = age >= 30 ? Math.min(8, age - 29) : 0;
          const cap = Math.max(Number(state[focus]) || 0,
            Math.min(99, (Number(state.playerPotential) || 82) + (plan.matchSkill === focus ? 3 : 0) - agePenalty));
          state.trainingXP = state.trainingXP && typeof state.trainingXP === "object" ? state.trainingXP : {};
          state.trainingXP[focus] = (Number(state.trainingXP[focus]) || 0) + 30;
          while (state.trainingXP[focus] >= threshold && (Number(state[focus]) || 0) < cap) {
            state.trainingXP[focus] -= threshold;
            state[focus] = Math.min(cap, (Number(state[focus]) || 0) + 1);
          }
          if ((Number(state[focus]) || 0) >= cap) state.trainingXP[focus] = 0;
          state.trainingSessions = (Number(state.trainingSessions) || 0) + 1;
          state.energy = Math.max(0, state.energy - 15);
          state.fatigue = Math.min(100, state.fatigue + 15);
          state.trainedToday = true;
          return { ok: true, xp: 30, injured: false };
        }
      },
      LWCareerAI: { coachAdvice: () => ({ focus: plan.primary[0] }) }
    },
    clamp: (value, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(Number(value) || 0))),
    seasonMatchTotal: () => matchTotal,
    overall: () => 75
  };
  vm.createContext(sandbox);
  new vm.Script(source, { filename: "season-training-ai-extract.js" }).runInContext(sandbox);
  return sandbox;
}

const poorFinishingRows = [0, 1, 2].map(() => ({
  minutes: 90, oppGoals: 1,
  stats: { shots: 4, shotsOnTarget: 1, keyPasses: 0, chances: 1, tackles: 0, interceptions: 0, saves: 0 }
}));
const striker = createSandbox("رأس حربة", poorFinishingRows, { shooting: 75, composure: 70 }, {
  primary: ["shooting"], secondary: ["composure", "physical", "fitness", "speed"]
});
assert.equal(striker.seasonTrainingPerformanceFocus(), "shooting",
  "a striker with repeated low shot accuracy should focus on shooting");
assert.equal(striker.chooseSeasonTrainingFocus(), "shooting",
  "recent match evidence should be able to prioritize shooting over a larger secondary-skill gap");

const defenderRows = [0, 1].map(() => ({
  minutes: 90, oppGoals: 1,
  stats: { shots: 0, shotsOnTarget: 0, keyPasses: 1, chances: 1, tackles: 0, interceptions: 1, saves: 0 }
}));
const defender = createSandbox("قلب دفاع", defenderRows, { defending: 74, physical: 70 }, {
  primary: ["defending"], secondary: ["physical"]
});
assert.equal(defender.seasonTrainingPerformanceFocus(), "defending",
  "a centre-back with low tackle/interception output should focus on defending");

const newPlayer = createSandbox("مهاجم", [], {}, {
  primary: ["shooting"], secondary: ["composure", "physical", "fitness", "speed"]
});
assert.equal(newPlayer.seasonTrainingPerformanceFocus(), "",
  "insufficient match history should preserve the normal position/potential training plan");

// The whole-season plan runs once at season end, uses age/potential and position,
// and restores match-day condition after applying the accumulated development.
const annual = createSandbox("رأس حربة", poorFinishingRows, { shooting: 75, composure: 70 }, {
  primary: ["shooting"], secondary: ["composure", "physical", "fitness", "speed"]
});
annual.state.seasonApps = 22;
annual.state.seasonDevelopmentSnapshot = {
  season: 1, ovr: 75, sessions: 0,
  attributes: { shooting: 75, dribbling: 72, passing: 72, speed: 72, fitness: 72, composure: 70, defending: 74, goalkeeping: 72, vision: 72, physical: 70 }
};
annual.state.seasonTrainingReport = { sessions: 0, skills: {}, xp: 0, injuries: 0, completed: false };
const originalCondition = {
  energy: annual.state.energy, fatigue: annual.state.fatigue,
  injuryDays: annual.state.injuryDays, injuryName: annual.state.injuryName,
  playedToday: annual.state.playedToday, trainedToday: annual.state.trainedToday,
  trainingIntensity: annual.state.trainingIntensity
};
const annualResult = annual.runSeasonAITtraining();
assert.equal(annualResult.ok, true, "the annual development batch should complete");
assert.ok(annualResult.plannedSessions >= 45 && annualResult.plannedSessions <= 55,
  "a 22-match season should account for a realistic block of focused training days, not the old 16-session cap");
assert.equal(annualResult.sessions, annualResult.plannedSessions,
  "the annual batch should apply the full planned volume when the player still has room to develop");
assert.equal(annual.state.seasonTrainingReport.completed, true, "the season report should be marked complete");
assert.equal(annual.state.seasonTrainingReport.completedSeason, 1, "the report should be tied to the season just finished");

const longSeason = createSandbox("مهاجم", poorFinishingRows, { shooting: 75, composure: 70 }, {
  primary: ["shooting"], secondary: ["composure", "physical", "fitness", "speed"]
}, 38);
longSeason.state.seasonApps = 38;
const longSeasonResult = longSeason.runSeasonAITtraining();
assert.ok(longSeasonResult.plannedSessions > annualResult.plannedSessions * 1.6,
  "a longer 38-match season must provide proportionally more training than a 22-match season");
assert.equal(longSeasonResult.sessions, longSeasonResult.plannedSessions,
  "the longer season must receive the entire planned workload when skills have headroom");

const partlyManual = createSandbox("مهاجم", poorFinishingRows, { shooting: 75, composure: 70 }, {
  primary: ["shooting"], secondary: ["composure", "physical", "fitness", "speed"]
});
partlyManual.state.seasonApps = 22;
partlyManual.state.trainingSessions = 5;
partlyManual.state.seasonDevelopmentSnapshot = {
  season: 1, ovr: 75, sessions: 0,
  attributes: { shooting: 75, dribbling: 72, passing: 72, speed: 72, fitness: 72, composure: 70, defending: 74, goalkeeping: 72, vision: 72, physical: 70 }
};
partlyManual.state.seasonTrainingReport = { sessions: 0, skills: {}, xp: 0, injuries: 0, completed: false };
const manualResult = partlyManual.runSeasonAITtraining();
assert.equal(manualResult.manualSessions, 5, "training sessions done manually before simulation must count toward the season workload");
assert.equal(manualResult.sessions + manualResult.manualSessions, manualResult.plannedSessions,
  "annual automation must only supply the training days the player has not already completed");
assert.equal(partlyManual.state.trainingSessions, manualResult.plannedSessions,
  "manual and automatic sessions must reconcile without double-counting");
for (const key of Object.keys(originalCondition)) assert.equal(annual.state[key], originalCondition[key], "annual training must restore " + key);
const incomplete = createSandbox("رأس حربة", [], {}, {
  primary: ["shooting"], secondary: ["composure", "physical", "fitness", "speed"]
});
assert.equal(incomplete.runSeasonAITtraining().skipped, "season-incomplete", "the annual batch must not apply before the full season is complete");
assert.equal(incomplete.state.trainingSessions, 0, "an incomplete season must not receive the annual AI training batch");
const completedSessions = annual.state.seasonTrainingReport.sessions;
annual.runSeasonAITtraining();
assert.equal(annual.state.seasonTrainingReport.sessions, completedSessions, "re-entering the annual batch must not double-train the player");

// A temporary exception after one successful annual session must not falsely
// mark the report complete. A subsequent call must resume with the remaining
// work and retain the already-applied session count.
const flaky = createSandbox("رأس حربة", poorFinishingRows, { shooting: 75, composure: 70 }, {
  primary: ["shooting"], secondary: ["composure", "physical", "fitness", "speed"]
});
flaky.state.seasonApps = 22;
flaky.state.seasonDevelopmentSnapshot = {
  season: 1, ovr: 75, sessions: 0,
  attributes: { shooting: 75, dribbling: 72, passing: 72, speed: 72, fitness: 72, composure: 70, defending: 74, goalkeeping: 72, vision: 72, physical: 70 }
};
flaky.state.seasonTrainingReport = { sessions: 0, skills: {}, xp: 0, injuries: 0, completed: false };
const reliableTrain = flaky.window.LWCareer.train;
let calls = 0;
flaky.window.LWCareer.train = (state, focus, options) => {
  calls++;
  if (calls === 2) throw new Error("temporary training failure");
  return reliableTrain(state, focus, options);
};
const interrupted = flaky.runSeasonAITtraining();
assert.equal(interrupted.ok, false, "a partial annual training failure must be reported");
assert.equal(flaky.state.seasonTrainingReport.completed, false,
  "a failed annual batch must remain retryable instead of being marked completed");
assert.equal(flaky.state.seasonTrainingReport.sessions, 1,
  "the report must retain the one successful session before the failure");
flaky.window.LWCareer.train = reliableTrain;
const retried = flaky.runSeasonAITtraining();
assert.equal(retried.ok, true, "the subsequent annual training retry should finish the remaining sessions");
assert.equal(flaky.state.seasonTrainingReport.completed, true,
  "the report must be completed only after the retry succeeds");
assert.equal(flaky.state.seasonTrainingReport.sessions, retried.plannedSessions,
  "retrying must finish the plan without losing or duplicating successful sessions");
assert.equal(flaky.state.trainingSessions, retried.plannedSessions,
  "the career training-session count must match the once-applied annual plan");

const hostileSnapshotValue = JSON.parse('{"toString":1,"valueOf":1}');
// A malformed same-season snapshot must not erase completed/manual training progress.
const snapshotRecovery = createSandbox("رأس حربة", poorFinishingRows, { shooting: 75, composure: 70 }, {
  primary: ["shooting"], secondary: ["composure", "physical", "fitness", "speed"]
});
snapshotRecovery.state.season = 4;
snapshotRecovery.state.trainingSessions = 8;
snapshotRecovery.state.seasonDevelopmentSnapshot = {
  season: hostileSnapshotValue, ovr: 75, attributes: [], sessions: hostileSnapshotValue
};
snapshotRecovery.state.seasonTrainingReport = {
  sessions: "2", skills: { shooting: "1" }, xp: "30", injuries: "1",
  plannedSessions: "49", manualSessions: "5", completed: false,
  completedSeason: "4", skipped: false, lastFocus: "shooting",
  manualSkills: { shooting: "2" }, manualXP: "45", manualInjuries: "1"
};
assert.doesNotThrow(() => snapshotRecovery.ensureSeasonDevelopmentSnapshot(),
  "hostile snapshot metadata must be rebuilt without throwing");
assert.equal(snapshotRecovery.state.seasonDevelopmentSnapshot.season, 4);
assert.equal(snapshotRecovery.state.seasonDevelopmentSnapshot.sessions, 1,
  "recovery must derive the baseline without counting already-recorded manual/AI sessions twice");
assert.equal(snapshotRecovery.state.seasonDevelopmentSnapshot.attributes.shooting, 75);
assert.equal(snapshotRecovery.state.seasonTrainingReport.sessions, 2,
  "repairing a damaged snapshot must preserve already-applied annual sessions");
assert.equal(snapshotRecovery.state.seasonTrainingReport.skills.shooting, 1);
assert.equal(snapshotRecovery.state.seasonTrainingReport.xp, 30);
assert.equal(snapshotRecovery.state.seasonTrainingReport.manualSessions, 5);
assert.equal(snapshotRecovery.state.seasonTrainingReport.manualSkills.shooting, 2);
assert.equal(snapshotRecovery.state.seasonTrainingReport.manualXP, 45);
assert.equal(snapshotRecovery.state.seasonTrainingReport.manualInjuries, 1);
snapshotRecovery.state.seasonApps = 22;
const resumedAnnual = snapshotRecovery.runSeasonAITtraining();
assert.equal(resumedAnnual.ok, true, "annual training must resume after snapshot recovery");
assert.equal(resumedAnnual.manualSessions, 5,
  "manual training already completed before snapshot recovery must remain credited");
assert.equal(resumedAnnual.sessions + resumedAnnual.manualSessions, resumedAnnual.plannedSessions,
  "recovered annual training must finish the remaining plan without double-counting");
assert.equal(snapshotRecovery.state.trainingSessions, 1 + resumedAnnual.plannedSessions,
  "training-session totals must reconcile with the reconstructed season baseline");

const arraySnapshot = createSandbox("مهاجم", [], {}, {
  primary: ["shooting"], secondary: ["composure", "physical", "fitness", "speed"]
});
arraySnapshot.state.season = 2;
arraySnapshot.state.trainingSessions = 6;
arraySnapshot.state.seasonDevelopmentSnapshot = [];
arraySnapshot.state.seasonTrainingReport = {
  sessions: 1, skills: { shooting: 1 }, xp: 30, injuries: 0,
  plannedSessions: 40, manualSessions: 2, completed: false
};
arraySnapshot.ensureSeasonDevelopmentSnapshot();
assert.equal(arraySnapshot.state.seasonDevelopmentSnapshot.sessions, 3,
  "array-shaped snapshots must recover the baseline while preserving recorded progress");
assert.equal(arraySnapshot.state.seasonTrainingReport.sessions, 1);
assert.equal(arraySnapshot.state.seasonTrainingReport.manualSessions, 2);

const nextSeasonSnapshot = createSandbox("مهاجم", [], {}, {
  primary: ["shooting"], secondary: ["composure", "physical", "fitness", "speed"]
});
nextSeasonSnapshot.state.season = 2;
nextSeasonSnapshot.state.trainingSessions = 9;
nextSeasonSnapshot.state.seasonDevelopmentSnapshot = {
  season: 1, ovr: 75, attributes: { shooting: 75 }, sessions: 4
};
nextSeasonSnapshot.state.seasonTrainingReport = {
  sessions: 3, skills: { shooting: 3 }, xp: 90, injuries: 1,
  plannedSessions: 40, manualSessions: 2, completed: true, completedSeason: 1
};
nextSeasonSnapshot.ensureSeasonDevelopmentSnapshot();
assert.equal(nextSeasonSnapshot.state.seasonDevelopmentSnapshot.season, 2);
assert.equal(nextSeasonSnapshot.state.seasonDevelopmentSnapshot.sessions, 9,
  "a genuine season transition must establish the new season's training baseline");
assert.equal(nextSeasonSnapshot.state.seasonTrainingReport.sessions, 0,
  "a genuine new season must start a fresh training report");
assert.equal(nextSeasonSnapshot.state.seasonTrainingReport.completed, false);

const finishStart = html.indexOf("function finishSeasonInternal(skipAnnualTraining=false){");
const finishEnd = html.indexOf("\nfunction ", finishStart + 10);
assert.ok(finishStart >= 0 && finishEnd > finishStart, "season completion handler must be present");
const finishSource = html.slice(finishStart, finishEnd);
const trainingErrorGuard = finishSource.indexOf("if(developmentResult?.error){");
const seasonCommit = finishSource.indexOf("state.seasonFinished=true;");
assert.ok(trainingErrorGuard >= 0 && trainingErrorGuard < seasonCommit,
  "a failed annual training batch must stop before the season is finalized");
assert.ok(finishSource.slice(trainingErrorGuard, seasonCommit).includes("return;"),
  "failed training must leave the season open for a retry");
assert.ok(finishSource.includes("action:()=>finishSeason()") && finishSource.includes("action:()=>skipSeasonTrainingAndFinish()"),
  "the recovery modal must expose retry and explicit skip actions");

const skipStart = html.indexOf("function skipSeasonTrainingAndFinish(){");
const skipEnd = html.indexOf("\nfunction finishSeasonInternal(", skipStart);
assert.ok(skipStart >= 0 && skipEnd > skipStart, "an explicit annual-training skip path must exist");
const skipSource = html.slice(skipStart, skipEnd);
const skipState = { season: 6, seasonApps: 22, seasonTrainingReport: {
  sessions: 3, skills: { shooting: 2, passing: 1 }, xp: 90, injuries: 1,
  completed: false, error: "temporary failure"
} };
let skipCalled = false;
const skipSandbox = {
  state: skipState,
  log: () => {},
  seasonMatchTotal: () => 22,
  finishSeason: skip => { skipCalled = skip === true; }
};
vm.createContext(skipSandbox);
new vm.Script(skipSource + "\nthis.skip = skipSeasonTrainingAndFinish;", {
  filename: "season-training-skip.js"
}).runInContext(skipSandbox);
skipSandbox.skip();
assert.equal(skipCalled, true, "the skip action must finalize only through the explicit skip-training route");
assert.equal(skipState.seasonTrainingReport.sessions, 3, "successful training sessions must remain in the report");
assert.equal(skipState.seasonTrainingReport.completed, true, "an explicitly skipped report must become terminal");
assert.equal(skipState.seasonTrainingReport.completedSeason, 6, "the skipped report must retain its season number");
assert.equal(skipState.seasonTrainingReport.skipped, true, "the report must disclose that the player skipped the remaining plan");
assert.equal(Object.prototype.hasOwnProperty.call(skipState.seasonTrainingReport, "error"), false,
  "a consciously skipped plan must not retain a retryable error");
const arraySkipReport = [];
arraySkipReport.sessions = "3";
arraySkipReport.skills = { shooting: "2", passing: 1 };
arraySkipReport.xp = "90";
arraySkipReport.injuries = "1";
arraySkipReport.plannedSessions = "40";
arraySkipReport.manualSessions = "2";
arraySkipReport.manualSkills = { shooting: "2", speed: 1 };
arraySkipReport.manualXP = "25";
arraySkipReport.manualInjuries = "1";
arraySkipReport.error = "temporary failure";
const arraySkipState = { season: 7, seasonApps: 22, seasonTrainingReport: arraySkipReport };
let arraySkipCalled = false;
const arraySkipSandbox = {
  state: arraySkipState,
  log: () => {},
  seasonMatchTotal: () => 22,
  finishSeason: skip => { arraySkipCalled = skip === true; }
};
vm.createContext(arraySkipSandbox);
new vm.Script(skipSource + "\nthis.skip = skipSeasonTrainingAndFinish;", {
  filename: "season-training-array-skip.js"
}).runInContext(arraySkipSandbox);
assert.doesNotThrow(() => arraySkipSandbox.skip(),
  "skipping annual training must safely normalize an array-shaped report");
assert.equal(arraySkipCalled, true);
assert.equal(Array.isArray(arraySkipState.seasonTrainingReport), false,
  "the skipped report must be a serializable record, not an array with non-index properties");
assert.equal(arraySkipState.seasonTrainingReport.sessions, 3,
  "successful sessions stored on a malformed array report must be preserved");
assert.equal(arraySkipState.seasonTrainingReport.skills.shooting, 2);
assert.equal(arraySkipState.seasonTrainingReport.skills.passing, 1);
assert.equal(arraySkipState.seasonTrainingReport.xp, 90);
assert.equal(arraySkipState.seasonTrainingReport.injuries, 1);
assert.equal(arraySkipState.seasonTrainingReport.manualSessions, 2);
assert.equal(arraySkipState.seasonTrainingReport.manualSkills.shooting, 2);
assert.equal(arraySkipState.seasonTrainingReport.manualSkills.speed, 1);
assert.equal(arraySkipState.seasonTrainingReport.manualXP, 25);
assert.equal(arraySkipState.seasonTrainingReport.manualInjuries, 1);
assert.equal(arraySkipState.seasonTrainingReport.completedSeason, 7);
assert.equal(arraySkipState.seasonTrainingReport.completed, true);
assert.equal(arraySkipState.seasonTrainingReport.skipped, true);
assert.equal(Object.prototype.hasOwnProperty.call(arraySkipState.seasonTrainingReport, "error"), false);

const hostileSkipState = {
  season: JSON.parse('{"toString":1,"valueOf":1}'),
  seasonApps: 22,
  seasonTrainingReport: { sessions: JSON.parse('{"toString":1}'), skills: [], xp: [], injuries: [] }
};
const hostileSkipSandbox = {
  state: hostileSkipState, log: () => {}, seasonMatchTotal: () => 22,
  finishSeason: () => {}
};
vm.createContext(hostileSkipSandbox);
new vm.Script(skipSource + "\nthis.skip = skipSeasonTrainingAndFinish;", {
  filename: "season-training-hostile-skip.js"
}).runInContext(hostileSkipSandbox);
assert.doesNotThrow(() => hostileSkipSandbox.skip(),
  "hostile season and report values must not throw in the explicit skip path");
assert.equal(hostileSkipState.seasonTrainingReport.sessions, 0);
assert.equal(hostileSkipState.seasonTrainingReport.xp, 0);
assert.equal(hostileSkipState.seasonTrainingReport.completedSeason, 1);

assert.ok(html.includes("لم يتم اعتماد الموسم أو أرشفة نتائجه بعد"),
  "the recovery message must make clear that the season was not partially archived");


// Full season-development archive: preserve manual/AI work, skill distribution and terminal status.
const malformedHistorySeason = JSON.parse('{"toString":1,"valueOf":1}');
const initialHistory = [
  { season: "1", ovrBefore: 70, ovrAfter: 71, sessions: 1, customMarker: "keep-me",
    skills: [{ key: "legacy-skill", delta: 1 }], trainingBySkill: { shooting: 1 } },
  { season: malformedHistorySeason, legacyMarker: "do-not-drop" }
];
const archived = upsertSeasonHistory(initialHistory, "1", { ovr: 71 }, {
  sessions: "4", plannedSessions: "52", manualSessions: "3", xp: "120", injuries: "2",
  skills: { shooting: "3", passing: 2, unknownSkill: 1 },
  manualSkills: { shooting: "1", dribbling: 2 }, manualXP: "45", manualInjuries: "1",
  completed: true, skipped: true, lastFocus: "shooting"
}, 74, [{ key: "shooting", delta: 2 }, { key: "passing", delta: 1 }]);
assert.equal(archived.length, 2, "updating an existing season must not duplicate or discard history rows");
assert.equal(archived[0].customMarker, "keep-me", "unknown legacy record fields must survive an upsert");
assert.equal(archived[0].sessions, 4);
assert.equal(archived[0].manualSessions, 3);
assert.equal(archived[0].plannedSessions, 52);
assert.equal(archived[0].totalSessions, 7, "manual and automatic sessions must reconcile");
assert.equal(archived[0].manualXP, 45);
assert.equal(archived[0].totalXP, 165);
assert.equal(archived[0].manualInjuries, 1);
assert.equal(archived[0].totalInjuries, 3);
assert.equal(archived[0].automaticTrainingBySkill.shooting, 3);
assert.equal(archived[0].manualTrainingBySkill.shooting, 1);
assert.equal(archived[0].manualTrainingBySkill.dribbling, 2);
assert.equal(archived[0].trainingBySkill.shooting, 4,
  "combined skill distribution must include both manual and AI sessions");
assert.equal(archived[0].trainingBySkill.dribbling, 2);
assert.equal(archived[0].xp, 120);
assert.equal(archived[0].injuries, 2);
assert.equal(archived[0].trainingCompleted, true);
assert.equal(archived[0].trainingSkipped, true);
assert.equal(archived[0].lastFocus, "shooting");
assert.equal(archived[0].trainingBySkill.shooting, 3);
assert.equal(archived[0].trainingBySkill.passing, 2);
assert.equal(archived[0].trainingBySkill.unknownSkill, 1,
  "future or custom training-focus keys must not be dropped by a fixed whitelist");
assert.equal(archived[0].ovrBefore, 71);
assert.equal(archived[0].ovrAfter, 74);
assert.equal(archived[1].legacyMarker, "do-not-drop",
  "malformed historical rows must remain available for later recovery");

const revisedArchive = upsertSeasonHistory(archived, 1, { ovr: 71 }, {
  sessions: "5", plannedSessions: "52", manualSessions: "3", xp: "150", injuries: "2",
  skills: { shooting: 4, passing: 2, unknownSkill: 1 },
  manualSkills: { shooting: 2, dribbling: 2 }, manualXP: 60, manualInjuries: 1,
  completed: true, skipped: false, lastFocus: ""
}, 76, [{ key: "shooting", delta: 3 }]);
assert.equal(revisedArchive.length, 2, "re-finalizing the same season must update its record instead of adding a duplicate");
assert.equal(revisedArchive[0].sessions, 5, "a retry must refresh the existing season record");
assert.equal(revisedArchive[0].totalSessions, 8);
assert.equal(revisedArchive[0].totalXP, 210);
assert.equal(revisedArchive[0].totalInjuries, 3);
assert.equal(revisedArchive[0].trainingBySkill.shooting, 6);
assert.equal(revisedArchive[0].trainingSkipped, false);
assert.equal(revisedArchive[0].lastFocus, "shooting", "an empty retry focus must not erase the last successful training focus");
assert.equal(revisedArchive[0].trainingBySkill.passing, 2,
  "skill counts not repeated in a later partial report must remain preserved");

const longHistory = Array.from({ length: 25 }, (_, index) => ({ season: index + 1, marker: index }));
const extendedHistory = upsertSeasonHistory(longHistory, 26, { ovr: 80 }, {
  sessions: 1, manualSessions: 0, plannedSessions: 1, xp: 10, injuries: 0,
  skills: { speed: 1 }, completed: true, skipped: false, lastFocus: "speed"
}, 81, [{ key: "speed", delta: 1 }]);
assert.equal(extendedHistory.length, 26, "the career timeline must not be truncated to the last 20 seasons");
assert.equal(extendedHistory[0].season, 26);
assert.equal(extendedHistory[1].marker, 0);

const malformedHistoryContainer = { marker: "legacy-container" };
const recoveredHistory = upsertSeasonHistory(malformedHistoryContainer, 2, { ovr: 70 }, {
  sessions: 0, manualSessions: 0, plannedSessions: 0, xp: 0, injuries: 0,
  skills: {}, completed: true, skipped: false, lastFocus: ""
}, 70, []);
assert.equal(recoveredHistory[1].legacyHistoryValue.marker, "legacy-container",
  "a non-array legacy history container must be retained rather than silently discarded");
assert.doesNotThrow(() => upsertSeasonHistory([], malformedHistorySeason, {}, {}, 0, []),
  "hostile season identifiers must not crash the history archive");
assert.ok(finishSource.includes("upsertSeasonDevelopmentHistory("),
  "season finalization must use the tested history upsert helper");


const manualReportOnce = recordManualTrainingSession({}, "shooting", { xp: 25, injured: true });
assert.equal(manualReportOnce.manualSessions, 1);
assert.equal(manualReportOnce.manualSkills.shooting, 1);
assert.equal(manualReportOnce.manualXP, 25);
assert.equal(manualReportOnce.manualInjuries, 1);
assert.equal(manualReportOnce.lastFocus, "shooting");
const manualReportTwice = recordManualTrainingSession(manualReportOnce, "shooting", { xp: "10", injured: false });
assert.equal(manualReportTwice.manualSessions, 2, "manual training sessions must accumulate exactly once per successful session");
assert.equal(manualReportTwice.manualSkills.shooting, 2);
assert.equal(manualReportTwice.manualXP, 35);
assert.equal(manualReportTwice.manualInjuries, 1, "only actual manual-training injuries should be counted");

console.log("PASS: match evidence, position-specific focus, potential caps and one-time season-end training all work.");
