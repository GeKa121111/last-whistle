"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const start = html.indexOf("function seasonTrainingPerformanceFocus()");
const end = html.indexOf("\nfunction simulateSeasonBlock(targetApps)", start);
assert.ok(start >= 0 && end > start, "season training AI functions must exist in the app");
const source = html.slice(start, end);

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
  completedSeason: "4", skipped: false, lastFocus: "shooting"
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
assert.ok(html.includes("لم يتم اعتماد الموسم أو أرشفة نتائجه بعد"),
  "the recovery message must make clear that the season was not partially archived");

console.log("PASS: match evidence, position-specific focus, potential caps and one-time season-end training all work.");
